import * as THREE from 'three';
import type { AnimState, CharacterId } from '../characters/types';
import type { Kit } from '../engine/kit';
import type { Atmosphere, GameRenderer } from '../engine/renderer';
import { frame, silhouette, type Framing, type StageCover } from './framing';
import { HeroDisplay } from './hero-display';
import { TILE_RADIUS } from './stage-deck';
import { BASE_RADIUS, STAND_TOP, StageSet } from './stage-set';
import { turntable } from './stage-turn';

export const IDLE: AnimState = {
  localVelocity: { x: 0, z: 0 },
  speed: 0,
  grounded: true,
  verticalVelocity: 0,
  crouch: 0,
  sprint: false,
  aimPitch: -0.12,
  ads: 0,
  weapon: 'ar',
  sinceShot: 99,
  reload: -1,
  melee: -1,
  grenade: -1,
  sinceHurt: 99,
  hurtDirection: { x: 0, z: 0 }
};

/** A dusk-blue studio for the lab's figure scenes: the sky is the backdrop, and its sun sits under the floor so no disc shows. */
export const STUDIO: Atmosphere = {
  zenith: '#050812',
  horizon: '#33426f',
  ground: '#1a2238',
  sunColor: '#000000',
  sunIntensity: 0,
  sunDirection: new THREE.Vector3(0, -1, 0),
  fogNear: 14
};

const FOV = 22;
/** Heights above the stand: the lens sits below the chest and looks slightly up at a point on the torso. */
const LENS = { fov: FOV, eye: 0.8, aim: 1.1 };
const FACING = Math.PI * 0.84;
/** How far the idle sway and the camera's drift turn the figure against the lens, either way. */
const SWAY = 0.1;
const DRIFT = 0.045;
const VIEWS = [FACING - SWAY - DRIFT, FACING, FACING + SWAY + DRIFT];
const REVEAL = 0.5;
const TURN = Math.PI * 2;
/** Seconds over which the figure's turning speed is averaged for its hanging parts: drags arrive in uneven steps. */
const SPIN_SMOOTHING = 0.08;
/** Every figure is framed as if it reached at least this high above the deck: the stand keeps its size from one character to the next, and a shorter one stands shorter. */
const HEADROOM = 2.02;
/**
 * A screen this short is a sideways phone (framing's own threshold): the header row bounds the head, so each figure is
 * framed by its own height to stand as tall as it can, and the stand keeps `AIR` meters clear of the bottom edge.
 */
const SHORT = 560;
const AIR = 0.07;
/** The menu draws at the screen's own resolution on every tier, up to this many pixels. */
const MAX_PIXELS = 2560 * 1440;

let cover: StageCover | null = null;
let coverVersion = 0;

/** The menu overlay reports what it puts on screen, so the figure is framed in the space left; null when it is gone. */
export function coverStage(next: StageCover | null) {
  cover = next;
  coverVersion++;
}

/**
 * Main-menu backdrop: the chosen character posed on a round stand in a studio of its own color. It draws itself, the
 * same way on every quality tier: straight to the canvas with its multisampling, the key light's shadow and no post-processing.
 */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  readonly display: HeroDisplay;
  private readonly stage = new StageSet();
  private readonly now: Framing = { scale: 300, x: 0, y: 0 };
  private goal: Framing = this.now;
  private width = 1;
  private height = 1;
  private seenCover = -1;
  private settled = false;
  private time = 0;
  private reveal = 0;
  private distance = 8;
  private frame = 0;
  /** The figure's turn last frame, and how fast it is turning (radians per second, smoothed over a few frames); NaN after a cut. */
  private yaw = NaN;
  private spin = 0;

  constructor(
    _kit: Kit,
    private readonly renderer: GameRenderer,
    character: CharacterId
  ) {
    this.display = new HeroDisplay(renderer.renderer, TILE_RADIUS - 0.01);
    this.display.group.position.y = STAND_TOP;
    this.scene.add(this.stage.group, this.display.group);
    this.scene.environment = this.display.environment;
    this.scene.fog = this.stage.haze;
    this.setCharacter(character);
  }

  /** Back from a match: the figure is revealed again. */
  enter() {
    this.reveal = 0;
    this.yaw = NaN;
    turntable.reset();
    this.display.spark();
  }

  setCharacter(id: CharacterId) {
    this.display.setCharacter(id);
    this.stage.setCharacter(id);
    this.reveal = 0;
    this.yaw = NaN;
    turntable.reset();
    this.refit();
  }

  /**
   * Builds what a hero's first pick would build (their far set, their figure and weapons) and compiles its shaders, so
   * the pick itself only swaps built things. For idle time, one hero at a time.
   */
  async prewarm(id: CharacterId) {
    this.stage.prebuild(id);
    const ghost = this.display.ghost(id);
    // Out of every view while its shaders compile.
    ghost.root.position.y = -200;
    this.scene.add(ghost.root);
    try {
      const renderer = this.renderer.renderer;
      const shadows = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = true;
      await renderer.compileAsync(this.scene, this.camera);
      if (ghost.root.parent) this.warmDraw(ghost.root);
      renderer.shadowMap.enabled = shadows;
    } finally {
      ghost.root.removeFromParent();
      ghost.dispose();
    }
  }

  /**
   * Draws `root` once into a single pixel of the canvas: a compiled program's first draw still links it, and that must
   * not land on a pick. The menu's next frame clears and redraws the whole canvas, and the shadow map is left as it was.
   */
  private warmDraw(root: THREE.Object3D) {
    const renderer = this.renderer.renderer;
    const eye = new THREE.PerspectiveCamera(FOV, 1, 0.1, 30);
    eye.position.set(root.position.x, root.position.y + 1, root.position.z + 8);
    eye.lookAt(root.position.x, root.position.y + 1, root.position.z);
    const scissor = renderer.getScissorTest();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    renderer.autoClear = false;
    renderer.render(this.scene, eye);
    renderer.setScissorTest(scissor);
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.settled = false;
    this.refit();
  }

  /** Frames the figure's own outline, with what it holds and wears and the stand under it, in the space the menu leaves free. */
  private refit() {
    this.seenCover = coverVersion;
    let goal = this.goal;
    let distance = this.distance;
    const short = this.height < SHORT;
    // The outline's perspective depends on the distance, which depends on the framing: two rounds settle it.
    for (let round = 0; round < 2; round++) {
      const outline = silhouette(this.display.outline, VIEWS, LENS, distance, BASE_RADIUS, STAND_TOP + (short ? AIR : 0), short ? 0 : HEADROOM);
      goal = frame(outline, this.width, this.height, cover);
      distance = this.reach(goal.scale);
    }
    this.goal = goal;
  }

  /** Distance along the floor from the stand's axis to the lens for a scale in pixels per meter. */
  private reach(scale: number) {
    const focal = this.height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    return Math.sqrt(Math.max(1, (focal / scale) ** 2 - (LENS.aim - LENS.eye) ** 2));
  }

  update(dt: number) {
    this.time += dt;
    if (this.seenCover !== coverVersion) this.refit();
    // A new character or panel layout glides into its framing; a resize snaps.
    const k = this.settled ? 1 - Math.exp(-dt * 9) : 1;
    this.settled = true;
    this.now.scale += (this.goal.scale - this.now.scale) * k;
    this.now.x += (this.goal.x - this.now.x) * k;
    this.now.y += (this.goal.y - this.now.y) * k;
    this.distance = this.reach(this.now.scale);
    this.camera.aspect = this.width / this.height;
    // Shifts the picture instead of turning the camera, so the figure stays square to a long lens wherever it sits.
    this.camera.setViewOffset(this.width, this.height, this.width / 2 - this.now.x, this.height / 2 - this.now.y, this.width, this.height);

    this.reveal = Math.min(1, this.reveal + dt / REVEAL);
    const ease = 1 - (1 - this.reveal) ** 3;
    const back = 1 + 2.4 * (this.reveal - 1) ** 3 + 1.4 * (this.reveal - 1) ** 2;
    turntable.update(dt, Math.sin(this.time * 0.35) * SWAY);
    const figure = this.display.figure;
    // Turns the last stretch to face the lens while it pops up to size, then sways unless a hand is turning it.
    const yaw = FACING - (1 - ease) * 0.75 + turntable.turn;
    const step = Number.isNaN(this.yaw) || dt <= 0 ? 0 : yaw - this.yaw - Math.round((yaw - this.yaw) / TURN) * TURN;
    if (Number.isNaN(this.yaw)) this.spin = 0;
    else if (dt > 0) this.spin += (step / dt - this.spin) * (1 - Math.exp(-dt / SPIN_SMOOTHING));
    this.yaw = yaw;
    figure.rotation.y = yaw;
    figure.scale.setScalar(0.9 + 0.1 * back);
    this.display.update(dt, this.spin);

    const drift = Math.sin(this.time * 0.17) * DRIFT;
    const y = STAND_TOP + LENS.eye + Math.sin(this.time * 0.11) * 0.03;
    this.camera.position.set(Math.sin(drift) * this.distance, y, Math.cos(drift) * this.distance);
    this.camera.lookAt(0, STAND_TOP + LENS.aim, 0);
    this.camera.updateMatrixWorld();
    this.stage.update(this.camera, this.time, this.display.pulse, -this.now.x / this.now.scale, (this.width - this.now.x) / this.now.scale, yaw);
  }

  /** The pixel ratio the menu draws at on a screen of this size: the screen's own on every tier, up to `MAX_PIXELS`. */
  pixelRatio(width = this.width, height = this.height) {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.max(this.renderer.pixelRatio, Math.min(dpr, 2, Math.sqrt(MAX_PIXELS / (width * height))));
  }

  render() {
    const renderer = this.renderer.renderer;
    const ratio = this.pixelRatio();
    // The match's pixel ratio comes back with the renderer's next resize.
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = true;
    // The idle is slow: a shadow map drawn every other frame is indistinguishable, and half the figure's triangles.
    renderer.shadowMap.needsUpdate = this.reveal < 1 || turntable.engaged || this.frame++ % 2 === 0;
    renderer.info.reset();
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.shadowMap.enabled = shadows;
  }

  dispose() {
    this.display.dispose();
    this.stage.dispose();
    this.scene.clear();
  }
}

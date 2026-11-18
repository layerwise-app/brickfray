import * as THREE from 'three';
import type { AnimState, CharacterId } from '../characters/types';
import { BrickBuilder } from '../engine/bricks';
import { partGeometry, PLATE } from '../engine/geometry';
import { buildGround } from '../engine/ground';
import type { Kit } from '../engine/kit';
import { PLASTIC } from '../engine/palette';
import { QUALITY } from '../engine/quality';
import type { Atmosphere, GameRenderer } from '../engine/renderer';
import { HeroDisplay } from './hero-display';

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

/** A dusk-blue studio: the sky is the backdrop, and its sun sits under the floor so no disc shows. */
export const STUDIO: Atmosphere = {
  zenith: '#050812',
  horizon: '#33426f',
  ground: '#1a2238',
  sunColor: '#000000',
  sunIntensity: 0,
  sunDirection: new THREE.Vector3(0, -1, 0),
  fogNear: 14
};

/** Each character's own color for the stand's light ring, and a backdrop glow that sets its suit off. */
const ACCENTS: Record<CharacterId, { ring: string; glow: string }> = {
  rivet: { ring: '#ff9a2e', glow: '#3d6fe0' },
  vega: { ring: '#27d3c8', glow: '#7a55d8' },
  clack: { ring: '#ff4a3c', glow: '#4a63d6' },
  coral: { ring: '#ff7d6b', glow: '#1f93a8' },
  moss: { ring: '#86cc52', glow: '#d4682e' },
  nova: { ring: '#9d70ff', glow: '#6a48dc' }
};

const FOV = 22;
/** Nominal height of a figure with its headgear, and the point on it the lens centers on. */
const FIGURE = 1.95;
const AIM = 1.1;
/** Camera height above the stand: below the chest, looking slightly up. */
const EYE = 0.8;
const FACING = Math.PI * 0.84;
/** Below this width the menu stacks its panels across the bottom (Tailwind `lg`); they are about this tall. */
const STACK_BELOW = 1024;
const STACK_UI = 510;
/** In the wide layout the menu's left panel and right buttons leave this band free. */
const ROW_LEFT = 420;
const ROW_RIGHT = 372;

/** Main-menu backdrop: the chosen character posed on a brick display stand in a dark studio. */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
  readonly display: HeroDisplay;
  private readonly stage = new THREE.Group();
  private readonly ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly ground: THREE.Mesh;
  private readonly ringColor = new THREE.Color();
  private readonly standTop: number;
  private time = 0;
  private reveal = 0;
  private distance = 8;

  constructor(
    _kit: Kit,
    private readonly renderer: GameRenderer,
    character: CharacterId
  ) {
    this.display = new HeroDisplay(renderer.renderer, STAND_RADIUS);
    // The stage is a handful of parts, so it gets the display's materials and bevels on every tier.
    const p = this.display.kit.profile;
    const b = new BrickBuilder(p, this.display.kit.materials);
    // The stand: a base plate ringed by studded plates, a lit band, and a smooth tile for the figure to stand on.
    b.part({ w: 4, d: 4, h: 1, studs: false }, 0, 0, 0, { color: PLASTIC.charcoal, yaw: STAND_YAW });
    for (let i = 0; i < 4; i++) {
      const a = STAND_YAW + (i * Math.PI) / 2;
      b.part({ w: 5, d: 1, h: 1 }, -0.2 * Math.cos(a) - Math.sin(a), 0, 0.2 * Math.sin(a) - Math.cos(a), { color: PLASTIC.charcoal, yaw: a });
    }
    const tile = { w: 4, d: 4, h: 1, studs: false };
    const top = partGeometry(tile, p);
    top.computeBoundingBox();
    this.standTop = PLATE + RING + top.boundingBox!.max.y;
    b.part(tile, 0, PLATE + RING, 0, { color: '#666e77', yaw: STAND_YAW });
    this.ground = buildGround([{ x0: -40, z0: -60, x1: 40, z1: 16, y: 0, color: '#1d2740' }], p);

    this.ring = new THREE.Mesh(top, new THREE.MeshBasicMaterial({ toneMapped: false }));
    this.ring.scale.set(1.045, RING / top.boundingBox!.max.y, 1.045);
    this.ring.position.y = PLATE;
    this.ring.rotation.y = STAND_YAW;
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    );
    this.glow.position.set(0, 3.2, -30);
    this.glow.renderOrder = -5;

    this.stage.add(this.ground, b.build(), backdrop(this.display.kit), this.ring, this.glow);
    this.display.group.position.y = this.standTop;
    this.scene.add(this.stage, this.display.group);
    this.enter();
    this.setCharacter(character);
  }

  /** The renderer's sky and lights move to whichever scene was dressed last; a match takes them. Here only the sky stays, and the display lights the scene. */
  enter() {
    this.renderer.atmosphere = STUDIO;
    this.renderer.dress(this.scene);
    this.scene.fog = new THREE.Fog(STUDIO.horizon, STUDIO.fogNear, 64);
    this.display.takeOver(this.scene, this.renderer);
  }

  setCharacter(id: CharacterId) {
    this.display.setCharacter(id);
    this.ringColor.set(ACCENTS[id].ring);
    this.glow.material.color.set(ACCENTS[id].glow);
    this.reveal = 0;
  }

  resize(width: number, height: number) {
    const h = Math.max(1, height);
    let x = width / 2;
    let scale: number;
    let feet: number;
    if (width < STACK_BELOW) {
      // Head under the header, cut at mid-thigh where the panels start; the legs run on behind them.
      const head = 92;
      const room = Math.max(240, h - STACK_UI - head);
      scale = Math.min(room / 1.15, width / 1.45);
      feet = head + FIGURE * scale;
    } else {
      x = (ROW_LEFT + width - ROW_RIGHT) / 2;
      scale = Math.min((h * 0.8) / FIGURE, width / 2.6);
      feet = h * 0.885;
    }
    this.distance = h / 2 / (scale * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    this.camera.aspect = width / h;
    // Shifts the picture instead of turning the camera, so the figure stays square to a long lens wherever it sits.
    this.camera.setViewOffset(width, h, width / 2 - x, h / 2 - (feet - AIM * scale), width, h);
  }

  update(dt: number) {
    this.time += dt;
    this.reveal = Math.min(1, this.reveal + dt / 0.75);
    const ease = 1 - (1 - this.reveal) ** 3;
    const figure = this.display.figure;
    // Spins in to face the camera, then sways.
    figure.rotation.y = FACING + (1 - ease) * Math.PI * 1.15 + Math.sin(this.time * 0.35) * 0.1;
    figure.scale.setScalar(0.94 + 0.06 * ease);
    this.display.update(dt);
    const pulse = this.display.pulse ** 2;
    this.ring.material.color.copy(this.ringColor).multiplyScalar(0.9 + pulse * 1.6);
    this.glow.material.opacity = 0.5 + pulse * 0.35;

    const drift = Math.sin(this.time * 0.17) * 0.045;
    const y = this.standTop + EYE + Math.sin(this.time * 0.11) * 0.03;
    this.camera.position.set(Math.sin(drift) * this.distance, y, Math.cos(drift) * this.distance);
    this.camera.lookAt(0, this.standTop + AIM, 0);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.display.dispose();
    this.ring.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.map?.dispose();
    this.glow.material.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.stage.traverse((o) => {
      if ((o as THREE.BatchedMesh).isBatchedMesh) (o as THREE.BatchedMesh).dispose();
    });
    this.scene.clear();
  }
}

const STAND_RADIUS = 0.79;
const STAND_YAW = 0.5;
/** Height of the lit band between the stand's base and its top plate. */
const RING = 0.045;

/**
 * Giant bricks far behind, off to both sides: flat silhouettes the haze softens, leaving the figure a clean background.
 * They are never seen close, so they take the lighter medium-tier shapes.
 */
function backdrop(kit: Kit) {
  const b = new BrickBuilder(QUALITY.medium, kit.materials);
  const giant = (w: number, d: number, x: number, y: number, z: number, color: string, yaw: number, size = 3) =>
    b.part({ w, d, h: 3 }, x, y * 0.48 * size, z, { color, yaw, finish: 'glow', scale: new THREE.Vector3(size, size, size) });
  giant(2, 4, -6.2, 0, -15, '#22305c', 0.5);
  giant(2, 4, -5.8, 1, -15.4, '#31406f', 0.3);
  giant(2, 2, -6.6, 2, -15.2, '#1b2647', 0.62);
  giant(2, 4, 6.4, 0, -16, '#2b3464', -0.42);
  giant(2, 2, 5.8, 1, -16.2, '#3a3472', -0.2);
  giant(2, 4, 13, 0, -27, '#243058', 0.25, 4);
  return b.build();
}

/** Soft round light on the backdrop behind the figure. */
function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

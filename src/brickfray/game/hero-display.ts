import * as THREE from 'three';
import { createCharacter, STANCES } from '../characters';
import { ClothSwing, type ClothSwingSpec } from '../characters/dangles';
import { clothSway, type ClothSway } from '../characters/material';
import { Rig } from '../characters/rig';
import { BONE } from '../characters/skeleton';
import type { CharacterId, CharacterRig } from '../characters/types';
import type { Kit } from '../engine/kit';
import { Materials } from '../engine/materials';
import { QUALITY } from '../engine/quality';
import type { GameRenderer } from '../engine/renderer';
import { createWeaponModel } from '../weapons';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';
import { ContactShadow, SHADOW_EXTENT, SHADOW_LAYER } from './contact-shadow';
import { IDLE_STATE, measure } from './hero-bounds';
import { Eyelids } from './hero-blink';
import { HeroLife } from './hero-life';
import { aimed, blobTexture, KEY_DIRECTION, STUDIO_LIGHTS, studioEnvironment } from './studio';

/** Seeds for each hero's own breathing and glancing rate (`Animator.vary`): Clack and Coral slow and heavy, Rivet quick. */
const TEMPO: Record<CharacterId, number> = { rivet: 1, vega: 8, clack: 13, coral: 2, moss: 7, nova: 3 };

/** How the cloth on a hero's back and hip bones bends on the turntable: Vega's scarf tails trail a turn, Clack's tabard panels trail it and flare out. */
const CLOTH: Partial<Record<CharacterId, Partial<Record<'back' | 'hip', ClothSwingSpec>>>> = {
  vega: { back: { trail: 0.075, fling: 0, max: 0.6, hz: 1.3, zeta: 0.22 } },
  clack: { hip: { trail: 0.04, fling: 0.006, max: 0.45, hz: 1.5, zeta: 0.3 } }
};
const CLOTH_BONES = { back: BONE.dangleBack, hip: BONE.dangleHip } as const;
const clothLengths = new WeakMap<THREE.BufferGeometry, Map<number, number>>();

/** A hero's figure as the stage shows it: the model in its stance with its weapons and lids, and its measured outline. */
interface Figure {
  rig: CharacterRig;
  gun: WeaponModel;
  melee: WeaponModel | null;
  lids: Eyelids | null;
  outline: Float32Array;
}

/** The stance each hero model is baked for; portraits ask for the same hands so they share the geometry. */
export function heroHands(id: CharacterId) {
  const { arms } = STANCES[id];
  return { L: arms.L.shape, R: arms.R.shape };
}

/**
 * The character on show: the showroom build of the model in its signature
 * stance with its primary, under studio lights. It always uses the best
 * materials, whatever quality the match runs at — it is one figure on a
 * static stage.
 */
export class HeroDisplay {
  /** The figure with its lights and ground shadows; turning it turns the whole studio. */
  readonly group = new THREE.Group();
  /** Turn this to face the figure. */
  readonly figure = new THREE.Group();
  readonly kit: Kit = { profile: QUALITY.high, materials: new Materials(QUALITY.high) };
  readonly environment: THREE.Texture;
  private readonly envTarget: THREE.WebGLRenderTarget;
  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly kicker: THREE.DirectionalLight;
  private readonly contact: ContactShadow;
  private readonly blob: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  /**
   * The posed figure's extent with everything it holds and wears: corners of the boxes around its rigid parts,
   * eight points each in the figure's frame, gathered over a couple of seconds of its idle.
   */
  outline: Float32Array = new Float32Array(0);
  /**
   * Every figure built so far, kept off stage once shown or warmed: showing one again only swaps it in, and its
   * materials keep their shader programs linked (a figure disposed while the only user of one throws it away).
   */
  private readonly figures = new Map<CharacterId, Figure>();
  private rig: CharacterRig | null = null;
  private life: HeroLife | null = null;
  private lids: Eyelids | null = null;
  private cloth: { uniforms: ClothSway; swings: [number, ClothSwing][] } | null = null;
  private flash = 0;
  private frame = 0;

  /** `floorRadius` clips the ground shadows to a round stand; without it they fade out on an open floor. */
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    floorRadius = SHADOW_EXTENT
  ) {
    this.envTarget = studioEnvironment(renderer);
    this.environment = this.envTarget.texture;

    const { key, rim, kicker, fill, sky } = STUDIO_LIGHTS;
    this.key = aimed({ ...key, position: [KEY_DIRECTION.x * 7, KEY_DIRECTION.y * 7 + 1, KEY_DIRECTION.z * 7] });
    // A tight shadow frustum around the one figure; it is drawn wherever the renderer has shadow maps on.
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.radius = 3;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.015;
    const frustum = this.key.shadow.camera;
    frustum.left = frustum.bottom = -2.1;
    frustum.right = frustum.top = 2.1;
    frustum.near = 1;
    frustum.far = 14;
    this.rim = aimed(rim);
    this.kicker = aimed(kicker);
    for (const light of [this.key, this.rim, this.kicker, aimed(fill)]) this.group.add(light, light.target);
    this.group.add(new THREE.HemisphereLight(sky.color, sky.ground, sky.intensity));

    const blobRadius = Math.min(0.95, floorRadius);
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(blobRadius, 40),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6, fog: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.003;
    this.blob.renderOrder = 1;
    this.contact = new ContactShadow(floorRadius);
    this.group.add(this.figure, this.blob, this.contact.mesh, this.contact.camera);
  }

  /** `id`'s figure off stage, built the first time it is asked for: a warm-up builds it ahead of the pick that shows it. */
  prepare(id: CharacterId): THREE.Object3D {
    return this.build(id).rig.root;
  }

  private build(id: CharacterId): Figure {
    const known = this.figures.get(id);
    if (known) return known;
    const stance = STANCES[id];
    const rig = createCharacter(id, this.kit, { hands: heroHands(id) });
    rig.setStance(stance);
    const gun = createWeaponModel(LOADOUTS[id].primary, this.kit, 'first');
    rig.setWeapon(gun.root, gun.supportGrip);
    const melee = stance.melee ? createWeaponModel(LOADOUTS[id].melee, this.kit, 'first') : null;
    rig.setMelee(melee?.root ?? null);
    rig.root.traverse((o) => o.layers.enable(SHADOW_LAYER));
    // Measured in a frame like the figure's, which turns and scales the whole of it.
    const frame = new THREE.Group().add(rig.root);
    const outline = measure(rig, frame);
    frame.remove(rig.root);
    const figure = { rig, gun, melee, lids: rig instanceof Rig ? Eyelids.fit(rig) : null, outline };
    this.figures.set(id, figure);
    return figure;
  }

  setCharacter(id: CharacterId) {
    this.rig?.root.removeFromParent();
    const figure = this.build(id);
    this.rig = figure.rig;
    this.lids = figure.lids;
    this.outline = figure.outline;
    figure.rig.root.position.setScalar(0);
    this.figure.add(figure.rig.root);
    this.life = new HeroLife(id);
    if (this.rig instanceof Rig) {
      this.rig.animator.vary(TEMPO[id]);
      this.rig.animator.life = this.life;
      this.cloth = swingCloth(this.rig, CLOTH[id]);
    } else this.cloth = null;
    this.flash = 1;
    this.frame = 0;
  }

  /**
   * Makes this display the scene's lighting: its reflections, and the renderer's own sun and sky light put away.
   * Call after `dress()`; the next scene to be dressed (a match) takes them back.
   */
  takeOver(scene: THREE.Scene, gr: GameRenderer) {
    scene.remove(gr.sun, gr.sun.target, gr.hemi);
    scene.environment = this.environment;
  }

  /** 1 right after a character change, fading to 0: the reveal's light pulse. */
  get pulse() {
    return this.flash;
  }

  /** Starts the light pulse again without changing the character. */
  spark() {
    this.flash = 1;
  }

  /** `spin` is how fast the figure is being turned on its stand, in radians per second. */
  update(dt: number, spin = 0) {
    if (this.rig instanceof Rig) this.rig.animator.spin = spin;
    this.life?.update(dt, this.figure.rotation.y);
    this.rig?.update(dt, IDLE_STATE);
    if (this.cloth) {
      for (const [k, swing] of this.cloth.swings) {
        swing.update(dt, spin);
        this.cloth.uniforms.sway.value[k]!.set(swing.lateral, swing.flare, 0, 0);
      }
    }
    this.lids?.set(this.life?.blink ?? 0);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    const boost = 1 + this.flash ** 2 * 1.6;
    this.rim.intensity = STUDIO_LIGHTS.rim.intensity * boost;
    this.kicker.intensity = STUDIO_LIGHTS.kicker.intensity * boost;
    // The shadow is soft and the figure moves slowly: redrawing it every other frame halves its cost.
    if (this.frame++ % 2) return;
    let root: THREE.Object3D = this.group;
    while (root.parent) root = root.parent;
    if ((root as THREE.Scene).isScene) this.contact.render(this.renderer, root as THREE.Scene);
  }

  dispose() {
    for (const { rig, gun, melee, lids } of this.figures.values()) {
      lids?.dispose();
      rig.dispose();
      gun.dispose();
      melee?.dispose();
    }
    this.figures.clear();
    this.blob.geometry.dispose();
    this.blob.material.map?.dispose();
    this.blob.material.dispose();
    this.contact.dispose();
    this.key.dispose();
    this.kit.materials.dispose();
    this.envTarget.dispose();
  }
}

/** Turns on the turntable bend for a figure's back and hip cloth: each bone's bind position and the cloth's length below it. */
function swingCloth(rig: Rig, spec: Partial<Record<'back' | 'hip', ClothSwingSpec>> | undefined) {
  const uniforms = clothSway(rig.mesh.material as THREE.Material);
  if (!spec || !uniforms) return null;
  const swings: [number, ClothSwing][] = [];
  (['back', 'hip'] as const).forEach((name, k) => {
    const s = spec[name];
    const bone = CLOTH_BONES[name];
    const anchor = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(rig.mesh.skeleton.boneInverses[bone]!).invert());
    const length = s ? clothLength(rig.mesh, bone, anchor) : 0;
    uniforms.anchor.value[k]!.set(anchor.x, anchor.y, anchor.z, length > 0.02 ? 1 / length : 0);
    uniforms.sway.value[k]!.set(0, 0, 0, 0);
    if (s && length > 0.02) swings.push([k, new ClothSwing(s)]);
  });
  uniforms.on.value = swings.length ? 1 : 0;
  return { uniforms, swings };
}

/** How far a bone's parts hang below its bind position, in the bind pose. */
function clothLength(mesh: THREE.SkinnedMesh, bone: number, anchor: THREE.Vector3) {
  let known = clothLengths.get(mesh.geometry);
  if (!known) clothLengths.set(mesh.geometry, (known = new Map()));
  let length = known.get(bone);
  if (length !== undefined) return length;
  length = 0;
  const index = mesh.geometry.getAttribute('skinIndex');
  const position = mesh.geometry.getAttribute('position');
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    if (index.getX(i) === bone) length = Math.max(length, anchor.y - p.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix).y);
  }
  known.set(bone, length);
  return length;
}

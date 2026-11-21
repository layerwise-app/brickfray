import * as THREE from 'three';
import { createCharacter, STANCES } from '../characters';
import { Rig } from '../characters/rig';
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
  outline = new Float32Array(0);
  private rig: CharacterRig | null = null;
  private life: HeroLife | null = null;
  private lids: Eyelids | null = null;
  private gun: WeaponModel | null = null;
  private melee: WeaponModel | null = null;
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

  setCharacter(id: CharacterId) {
    this.rig?.dispose();
    const stance = STANCES[id];
    this.rig = createCharacter(id, this.kit, { hands: heroHands(id) });
    this.rig.setStance(stance);
    const primary = LOADOUTS[id].primary;
    if (this.gun?.id !== primary) {
      this.gun?.dispose();
      this.gun = createWeaponModel(primary, this.kit, 'first');
    }
    this.rig.setWeapon(this.gun.root, this.gun.supportGrip);
    this.melee?.dispose();
    this.melee = stance.melee ? createWeaponModel(LOADOUTS[id].melee, this.kit, 'first') : null;
    this.rig.setMelee(this.melee?.root ?? null);
    this.figure.add(this.rig.root);
    this.figure.traverse((o) => o.layers.enable(SHADOW_LAYER));
    this.outline = measure(this.rig, this.figure);
    this.life = new HeroLife(id);
    this.lids?.dispose();
    this.lids = null;
    if (this.rig instanceof Rig) {
      this.rig.animator.life = this.life;
      this.lids = Eyelids.fit(this.rig);
    }
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
    this.lids?.dispose();
    this.rig?.dispose();
    this.gun?.dispose();
    this.melee?.dispose();
    this.blob.geometry.dispose();
    this.blob.material.map?.dispose();
    this.blob.material.dispose();
    this.contact.dispose();
    this.key.dispose();
    this.kit.materials.dispose();
    this.envTarget.dispose();
  }
}

import * as THREE from 'three';
import { createCharacter } from '../characters';
import type { AnimState, CharacterId, CharacterRig } from '../characters/types';
import { BrickBuilder } from '../engine/bricks';
import { buildGround } from '../engine/ground';
import type { Kit } from '../engine/kit';
import { PLASTIC } from '../engine/palette';
import type { Atmosphere, GameRenderer } from '../engine/renderer';
import { createWeaponModel } from '../weapons';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';

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

const ATMOSPHERE: Atmosphere = {
  zenith: '#4f8fe0',
  horizon: '#f3d7b5',
  ground: '#c9b79c',
  sunColor: '#fff0d8',
  sunIntensity: 2.6,
  sunDirection: new THREE.Vector3(-0.45, 0.62, 0.64).normalize(),
  fogNear: 18
};

/** Main-menu backdrop: the chosen character idling on a little brick stage. */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  private rig: CharacterRig | null = null;
  private gun: WeaponModel | null = null;
  private pose: AnimState = IDLE;
  private stage: THREE.Object3D;
  private time = 0;
  private narrow = false;
  private spin = 0;

  constructor(
    private readonly kit: Kit,
    private readonly renderer: GameRenderer,
    character: CharacterId
  ) {
    this.enter();
    this.stage = this.buildStage();
    this.scene.add(this.stage);
    this.setCharacter(character);
  }

  /** The renderer's lights, sky and reflections move to whichever scene was dressed last; a match takes them. */
  enter() {
    this.renderer.atmosphere = ATMOSPHERE;
    this.renderer.dress(this.scene);
    this.renderer.sun.position.set(0, 1, 0);
    this.renderer.sun.target.position.set(0, 0, 0);
    this.scene.fog = new THREE.Fog('#f0d9bd', 18, 70);
  }

  private buildStage() {
    const group = new THREE.Group();
    const p = this.kit.profile;
    group.add(buildGround([{ x0: -24, z0: -24, x1: 24, z1: 24, y: 0, color: PLASTIC.sandGreen }], p));
    const b = new BrickBuilder(p, this.kit.materials);
    // Round display stand.
    b.part({ w: 6, d: 6, h: 1, shape: 'round', studs: false }, 0, 0, 0, { color: PLASTIC.darkGray });
    b.part({ w: 5, d: 5, h: 1, shape: 'round' }, 0, 0.16, 0, { color: PLASTIC.yellow });
    // A few stacks and a wall corner behind, for depth.
    const colors = [PLASTIC.red, PLASTIC.blue, PLASTIC.white, PLASTIC.orange, PLASTIC.azure, PLASTIC.lime];
    let c = 0;
    for (let layer = 0; layer < 7; layer++) {
      for (let x = 0; x < 6; x++) {
        if (layer > 4 && x > 3 - (layer - 5)) continue;
        b.grid({ w: 2, d: 1, h: 3 }, -14 + x * 2 + (layer % 2), layer * 3, -16, { color: colors[c++ % colors.length]! });
      }
    }
    for (let layer = 0; layer < 3; layer++) b.grid({ w: 2, d: 2, h: 3 }, 6, layer * 3, -9, { color: layer === 2 ? PLASTIC.red : PLASTIC.white });
    b.grid({ w: 2, d: 2, h: 3 }, 9, 0, -7, { color: PLASTIC.blue });
    b.grid({ w: 4, d: 2, h: 1 }, 8, 3, -8, { color: PLASTIC.yellow });
    b.grid({ w: 1, d: 1, h: 3 }, -7, 0, 3, { color: PLASTIC.orange, turns: 1 });
    b.grid({ w: 2, d: 2, h: 6, shape: 'cone' }, -9, 0, -6, { color: PLASTIC.green });
    b.grid({ w: 2, d: 2, h: 6, shape: 'cone' }, -9, 6, -6, { color: PLASTIC.darkGreen });
    group.add(b.build());
    return group;
  }

  setCharacter(id: CharacterId) {
    if (this.rig) {
      this.scene.remove(this.rig.root);
      this.rig.dispose();
    }
    this.rig = createCharacter(id, this.kit);
    const primary = LOADOUTS[id].primary;
    if (this.gun?.id !== primary) {
      this.gun?.dispose();
      this.gun = createWeaponModel(primary, this.kit, 'third');
    }
    this.pose = { ...IDLE, weapon: primary };
    this.rig.setWeapon(this.gun.root, this.gun.supportGrip);
    this.rig.root.position.set(0, 0.32, 0);
    this.spin = 0;
    this.scene.add(this.rig.root);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.narrow = this.camera.aspect < 1.1;
    this.camera.fov = this.narrow ? 40 : 30;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    this.time += dt;
    this.spin = Math.min(1, this.spin + dt * 1.5);
    if (this.rig) {
      // Slow turn toward the camera with a gentle sway.
      const ease = 1 - (1 - this.spin) ** 3;
      this.rig.root.rotation.y = Math.PI * 0.82 + (1 - ease) * Math.PI * 1.2 + Math.sin(this.time * 0.35) * 0.12;
      this.rig.update(dt, this.pose);
    }
    const t = this.time * 0.05;
    // Wide screens keep the character on the left third, leaving room for the menu.
    const lookX = this.narrow ? 0 : 1.05;
    this.camera.position.set(lookX - 0.15 + Math.sin(t) * 0.35, this.narrow ? 1.5 : 1.35, (this.narrow ? 7 : 5.6) + Math.cos(t) * 0.2);
    this.camera.lookAt(lookX, this.narrow ? 1.25 : 1.05, 0);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.rig?.dispose();
    this.gun?.dispose();
    this.scene.clear();
  }
}

import * as THREE from 'three';
import { createCharacter } from '../characters';
import { stowPlaceOf } from '../characters/stow';
import type { AnimState, BotKind, CharacterId, CharacterRig, ShatterPiece } from '../characters/types';
import { FootStrikes } from '../audio/step-triggers';
import type { Kit } from '../engine/kit';
import { createWeaponModel } from '../weapons';
import type { WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';

export type Look = CharacterId | BotKind;

/** A figure with both of its guns, in a remote's hands or hidden and waiting for one. */
export interface Figure {
  rig: CharacterRig;
  guns: Partial<Record<WeaponId, WeaponModel>>;
  feet: FootStrikes;
}

/** What `arm` keeps up to date on a figure: the gun in hand (none while the hand goes from one gun to the other). */
export interface Armed {
  rig: CharacterRig;
  guns: Partial<Record<WeaponId, WeaponModel>>;
  weapon: WeaponId | null;
  armed: boolean;
}

/**
 * Builds, arms and keeps the figures other players and the local player's death are drawn with. Each is built at
 * load with both of its guns, hidden, so the match's first frame (which draws hidden objects once) compiles and
 * uploads it: a first draw mid-match stalls a frame for up to ~250 ms.
 */
export class Figures {
  /** Hidden figures ready for whoever joins next with that look. */
  private readonly spare = new Map<Look, Figure[]>();
  /**
   * Never shown, drawn only by the match's warm-up frame: one broken-up figure per look (its pieces fly at a kill)
   * and the plain kit finishes that a hand carries during a reload (shells, rounds, bolts).
   */
  private readonly unseen = new THREE.Group();
  private readonly shattered = new Set<Look>();
  private readonly stub = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  private own: (Figure & Armed) | null = null;

  constructor(
    private readonly kit: Kit,
    private readonly group: THREE.Group
  ) {
    this.unseen.visible = false;
    group.add(this.unseen);
    for (const finish of ['plastic', 'metal'] as const) {
      const mesh = new THREE.Mesh(this.stub, kit.materials.get('#ffffff', finish));
      mesh.castShadow = kit.profile.shadows;
      this.unseen.add(mesh);
    }
  }

  /** Hidden figures for looks that join later (solo waves). */
  prepare(looks: readonly Look[]) {
    for (const look of looks) if (!this.spare.get(look)?.length) this.release(this.build(look));
  }

  /** A hidden figure with that look, from the spares or built now. */
  take(look: Look): Figure {
    return this.spare.get(look)?.pop() ?? this.build(look);
  }

  /** A figure no one uses any more: it waits, hidden, for the next one with the same look (solo waves come and go). */
  release(figure: Figure) {
    const { rig, guns } = figure;
    rig.setWeapon(null, null);
    for (const gun of Object.values(guns)) rig.stow(gun!.root, null);
    rig.reset();
    rig.setTint(null);
    rig.root.visible = false;
    rig.root.userData.gun = undefined;
    const spare = this.spare.get(rig.id) ?? [];
    spare.push({ rig, guns, feet: figure.feet });
    this.spare.set(rig.id, spare);
  }

  /** Puts `weapon` in the hand (or nothing) and carries every other gun of the loadout slung or holstered. */
  arm(r: Armed, weapon: WeaponId | null) {
    if (r.armed && r.weapon === weapon) return;
    if (weapon) r.guns[weapon] ??= createWeaponModel(weapon, this.kit, 'third');
    const held = weapon ? r.guns[weapon]! : null;
    r.rig.setWeapon(held ? held.root : null, held ? held.supportGrip : null);
    if (held) held.root.visible = true;
    for (const [id, gun] of Object.entries(r.guns) as [WeaponId, WeaponModel][]) if (id !== weapon) r.rig.stow(gun.root, stowPlaceOf(id));
    r.weapon = weapon;
    r.armed = true;
    // Effects tell which gun fired (its flash and tracer) from the muzzle a shot starts at.
    r.rig.root.userData.gun = held ? { weapon, muzzle: held.muzzle } : undefined;
  }

  /** The local player's own figure, built hidden at load, broken apart where they die for the death camera to watch. */
  prepareOwn(look: Look) {
    this.own ??= { ...this.build(look), weapon: null, armed: false };
  }

  /** Poses the local player's figure where they died and breaks it into pieces flying along `impulse`. */
  shatterOwn(at: THREE.Vector3, yaw: number, weapon: WeaponId, crouch: number, pitch: number, impulse: THREE.Vector3): ShatterPiece[] {
    const own = this.own;
    if (!own) return [];
    this.arm(own, weapon);
    own.rig.reset();
    own.rig.root.position.copy(at);
    own.rig.root.rotation.y = yaw;
    const still: AnimState = { localVelocity: { x: 0, z: 0 }, speed: 0, grounded: true, verticalVelocity: 0, crouch, sprint: false, aimPitch: pitch, ads: 0, weapon, sinceShot: 9, reload: -1, melee: -1, grenade: -1, sinceHurt: 9, hurtDirection: { x: 0, z: 0 }, hurtAmount: 30, swap: -1, swapFrom: null, slide: false, alert: false };
    for (let i = 0; i < 4; i++) own.rig.update(0.1, still);
    const pieces = own.rig.shatter(impulse);
    own.rig.root.visible = false;
    return pieces;
  }

  dispose() {
    for (const figures of this.spare.values()) {
      for (const { rig, guns } of figures) {
        rig.dispose();
        for (const gun of Object.values(guns)) gun?.dispose();
      }
    }
    this.spare.clear();
    if (this.own) {
      this.own.rig.dispose();
      for (const gun of Object.values(this.own.guns)) gun?.dispose();
    }
    this.unseen.clear();
    this.stub.dispose();
  }

  /** A hidden figure with its loadout's guns stowed (hidden) on it; the first of each look also leaves its pieces. */
  private build(look: Look): Figure {
    const rig = createCharacter(look, this.kit);
    const guns: Figure['guns'] = {};
    const loadout = LOADOUTS[look];
    for (const weapon of [loadout.primary, loadout.secondary]) {
      const gun = (guns[weapon] ??= createWeaponModel(weapon, this.kit, 'third'));
      // Stowed once so the holster is built now; then hidden on the figure until a remote takes it.
      rig.stow(gun.root, stowPlaceOf(weapon));
      rig.stow(gun.root, null);
    }
    if (!this.shattered.has(look)) {
      this.shattered.add(look);
      for (const piece of rig.shatter(new THREE.Vector3())) this.unseen.add(piece.mesh);
      rig.reset();
    }
    rig.root.visible = false;
    this.group.add(rig.root);
    return { rig, guns, feet: new FootStrikes(rig.root) };
  }
}

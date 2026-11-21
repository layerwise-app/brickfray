import * as THREE from 'three';
import { createCharacter } from '../characters';
import { Rig } from '../characters/rig';
import type { AnimState, BotKind, CharacterId, CharacterRig } from '../characters/types';
import { FootStrikes } from '../audio/step-triggers';
import type { Kit } from '../engine/kit';
import type { RemoteSnapshotPlayer, Snapshot } from '../net/codec';
import type { RosterEntry } from '../net/protocol';
import type { HitPose } from '../sim/hitboxes';
import { createWeaponModel } from '../weapons';
import type { WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';

export const TEAM_COLORS = ['#2f7dff', '#ff7a1a'] as const;

export interface Remote {
  entry: RosterEntry;
  rig: CharacterRig;
  guns: Partial<Record<WeaponId, WeaponModel>>;
  weapon: WeaponId | null;
  state: RemoteSnapshotPlayer | null;
  alive: boolean;
  shots: number;
  /** Seconds since this remote last fired (for animation and flashes). */
  sinceShot: number;
  sinceHurt: number;
  hurtDir: { x: number; z: number };
  position: THREE.Vector3;
  yaw: number;
  visible: boolean;
  knock: THREE.Vector3;
  /** Heel strikes of the rig's walk, for footsteps. */
  feet: FootStrikes;
}

const anim: AnimState = {
  localVelocity: { x: 0, z: 0 },
  speed: 0,
  grounded: true,
  verticalVelocity: 0,
  crouch: 0,
  sprint: false,
  aimPitch: 0,
  ads: 0,
  weapon: 'ar',
  sinceShot: 9,
  reload: -1,
  melee: -1,
  grenade: -1,
  sinceHurt: 9,
  hurtDirection: { x: 0, z: 0 }
};

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

type Look = CharacterId | BotKind;

/** A figure with both of its guns, in a remote's hands or hidden and waiting for one. */
interface Figure {
  rig: CharacterRig;
  guns: Partial<Record<WeaponId, WeaponModel>>;
  feet: FootStrikes;
}

/**
 * Other players, drawn 100 ms in the past between two snapshots (brief
 * extrapolation if packets are late), with their rigs animated from the
 * interpolated state.
 */
export class Remotes {
  readonly group = new THREE.Group();
  readonly map = new Map<number, Remote>();
  onFire: ((remote: Remote) => void) | null = null;
  onStep: ((remote: Remote, loud: boolean) => void) | null = null;
  /** Hidden figures ready for whoever joins next with that look. */
  private readonly spare = new Map<Look, Figure[]>();
  /**
   * Never shown, drawn only by the match's warm-up frame: one broken-up figure per look (its pieces fly at a kill)
   * and the plain kit finishes that a hand carries during a reload (shells, rounds, bolts).
   */
  private readonly unseen = new THREE.Group();
  private readonly shattered = new Set<Look>();
  private readonly stub = new THREE.BoxGeometry(0.01, 0.01, 0.01);

  constructor(
    private readonly kit: Kit,
    private self: number
  ) {
    this.group.name = 'remotes';
    this.unseen.visible = false;
    this.group.add(this.unseen);
    for (const finish of ['plastic', 'metal'] as const) {
      const mesh = new THREE.Mesh(this.stub, kit.materials.get('#ffffff', finish));
      mesh.castShadow = kit.profile.shadows;
      this.unseen.add(mesh);
    }
  }

  /**
   * Build hidden figures with both guns for looks that join later (solo waves), so the match's first frame, which
   * draws hidden objects once, compiles and uploads them: a first draw mid-match stalls a frame for up to ~250 ms.
   */
  prepare(looks: readonly Look[]) {
    for (const look of looks) if (!this.spare.get(look)?.length) this.release(this.build(look));
  }

  setSelf(id: number) {
    this.self = id;
    this.remove(id);
  }

  syncRoster(roster: Map<number, RosterEntry>) {
    for (const [id, entry] of roster) {
      if (id === this.self) continue;
      let r = this.map.get(id);
      if (!r || r.entry.character !== entry.character) {
        if (r) this.remove(id);
        const { rig, guns, feet } = this.spare.get(entry.character)?.pop() ?? this.build(entry.character);
        if (rig instanceof Rig) rig.animator.vary(id);
        r = { entry, rig, guns, weapon: null, state: null, alive: false, shots: 0, sinceShot: 9, sinceHurt: 9, hurtDir: { x: 0, z: 0 }, position: new THREE.Vector3(), yaw: 0, visible: false, knock: new THREE.Vector3(), feet };
        this.map.set(id, r);
      }
      r.entry = entry;
      r.rig.setTint(entry.team !== -1 ? TEAM_COLORS[entry.team] : null);
    }
    for (const id of [...this.map.keys()]) if (!roster.has(id)) this.remove(id);
  }

  /** A remote leaves: its figure waits, hidden, for the next one with the same look (solo waves come and go). */
  remove(id: number) {
    const r = this.map.get(id);
    if (!r) return;
    this.map.delete(id);
    this.release(r);
  }

  /** A hidden figure with its loadout's guns stowed (hidden) on it; the first of each look also leaves its pieces. */
  private build(look: Look): Figure {
    const rig = createCharacter(look, this.kit);
    const guns: Figure['guns'] = {};
    const loadout = LOADOUTS[look];
    for (const weapon of [loadout.primary, loadout.secondary]) {
      const gun = (guns[weapon] ??= createWeaponModel(weapon, this.kit, 'third'));
      gun.root.visible = false;
      rig.root.add(gun.root);
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

  private release(figure: Figure) {
    const { rig, guns } = figure;
    rig.setWeapon(null, null);
    for (const gun of Object.values(guns)) {
      gun!.root.visible = false;
      rig.root.add(gun!.root);
    }
    rig.reset();
    rig.setTint(null);
    rig.root.visible = false;
    rig.root.userData.gun = undefined;
    const spare = this.spare.get(rig.id) ?? [];
    spare.push({ rig, guns, feet: figure.feet });
    this.spare.set(rig.id, spare);
  }

  private equip(r: Remote, weapon: WeaponId) {
    if (r.weapon === weapon) return;
    let gun = r.guns[weapon];
    if (!gun) {
      gun = createWeaponModel(weapon, this.kit, 'third');
      r.guns[weapon] = gun;
    }
    const held = r.weapon ? r.guns[r.weapon] : undefined;
    r.rig.setWeapon(gun.root, gun.supportGrip);
    gun.root.visible = true;
    // The gun put away stays on the figure, hidden, so it is never drawn for the first time mid-match.
    if (held) {
      held.root.visible = false;
      r.rig.root.add(held.root);
    }
    r.weapon = weapon;
    // Effects tell which gun fired (its flash and tracer) from the muzzle a shot starts at.
    r.rig.root.userData.gun = { weapon, muzzle: gun.muzzle };
  }

  /** Interpolate every remote at `renderTime` (host clock) from the snapshot buffer. */
  update(dt: number, snapshots: readonly Snapshot[], renderTime: number) {
    let older: Snapshot | undefined;
    let newer: Snapshot | undefined;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i]!.time <= renderTime) {
        older = snapshots[i];
        newer = snapshots[i + 1];
        break;
      }
    }
    older ??= snapshots[0];
    const k = older && newer ? THREE.MathUtils.clamp((renderTime - older.time) / Math.max(1e-4, newer.time - older.time), 0, 1) : 0;
    const extra = older && !newer ? Math.min(0.25, Math.max(0, renderTime - older.time)) : 0;
    if (older?.self) this.group.userData.selfWeapon = older.self.arms.weapon;
    for (const r of this.map.values()) {
      const a = older?.players.find((p) => p.id === r.entry.id);
      if (!a) {
        r.rig.root.visible = false;
        r.visible = false;
        continue;
      }
      const b = newer?.players.find((p) => p.id === r.entry.id) ?? a;
      const s = k < 0.5 ? a : b;
      r.state = s;
      if (s.alive && !r.alive) {
        r.rig.reset();
        r.feet.reset();
      }
      r.alive = s.alive;
      r.position.set(a.x + (b.x - a.x) * k + a.vx * extra, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k + a.vz * extra);
      r.yaw = lerpAngle(a.yaw, b.yaw, k);
      const pitch = a.pitch + (b.pitch - a.pitch) * k;
      r.visible = s.alive;
      r.rig.root.visible = s.alive;
      if (!s.alive) continue;
      this.equip(r, s.weapon);
      if (s.shots !== r.shots) {
        const fresh = r.shots !== 0;
        r.shots = s.shots;
        if (fresh) {
          r.sinceShot = 0;
          this.onFire?.(r);
        }
      }
      r.sinceShot += dt;
      r.sinceHurt += dt;
      r.knock.multiplyScalar(Math.exp(-dt * 14));
      r.rig.root.position.copy(r.position).add(r.knock);
      r.rig.root.rotation.y = r.yaw;
      const vx = a.vx + (b.vx - a.vx) * k;
      const vz = a.vz + (b.vz - a.vz) * k;
      const sin = Math.sin(r.yaw);
      const cos = Math.cos(r.yaw);
      // Local frame: forward is -Z at yaw 0, right is +X.
      anim.localVelocity.x = vx * cos - vz * sin;
      anim.localVelocity.z = -(vx * sin + vz * cos);
      anim.speed = Math.hypot(vx, vz);
      anim.grounded = s.grounded;
      anim.verticalVelocity = a.vy + (b.vy - a.vy) * k;
      anim.crouch = a.crouch + (b.crouch - a.crouch) * k;
      anim.sprint = s.sprinting;
      anim.aimPitch = pitch;
      anim.ads = s.ads;
      anim.weapon = s.weapon;
      anim.sinceShot = r.sinceShot;
      anim.reload = s.reload;
      anim.melee = s.melee;
      anim.grenade = s.grenade;
      anim.sinceHurt = r.sinceHurt;
      anim.hurtDirection = r.hurtDir;
      r.rig.update(dt, anim);
      if (r.feet.update() > 0 && anim.grounded && anim.speed > 1.2 && anim.crouch < 0.5) this.onStep?.(r, s.sprinting);
    }
  }

  hurt(id: number, from: [number, number, number]) {
    const r = this.map.get(id);
    if (!r) return;
    r.sinceHurt = 0;
    const dx = from[0] - r.position.x;
    const dz = from[2] - r.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const sin = Math.sin(r.yaw);
    const cos = Math.cos(r.yaw);
    r.hurtDir = { x: (dx * cos - dz * sin) / len, z: -(dx * sin + dz * cos) / len };
    // A small shove away from the shooter sells the hit.
    r.knock.set(-dx / len, 0, -dz / len).multiplyScalar(0.07);
    r.rig.flash();
  }

  /** World muzzle position of a remote's current gun (falls back to the eye). */
  muzzleOf(r: Remote, out: THREE.Vector3): THREE.Vector3 {
    const gun = r.weapon ? r.guns[r.weapon] : undefined;
    if (gun && r.visible) {
      gun.muzzle.updateWorldMatrix(true, false);
      return gun.muzzle.getWorldPosition(out);
    }
    return out.set(r.position.x, r.position.y + 1.45, r.position.z);
  }

  /** Pose used for local hit prediction (same boxes the host uses). */
  pose(r: Remote): HitPose | null {
    if (!r.visible || !r.state) return null;
    return { x: r.position.x, y: r.position.y, z: r.position.z, crouch: r.state.crouch, scale: r.entry.bot === 'boss' ? 1.6 : 1 };
  }

  dispose() {
    for (const id of [...this.map.keys()]) this.remove(id);
    for (const figures of this.spare.values()) {
      for (const { rig, guns } of figures) {
        rig.dispose();
        for (const gun of Object.values(guns)) gun?.dispose();
      }
    }
    this.spare.clear();
    this.unseen.clear();
    this.stub.dispose();
  }
}

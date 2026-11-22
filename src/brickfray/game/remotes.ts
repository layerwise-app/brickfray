import * as THREE from 'three';
import { Rig } from '../characters/rig';
import { stowPlaceOf, swapGrab } from '../characters/stow';
import type { AnimState, CharacterRig, ShatterPiece } from '../characters/types';
import type { FootStrikes } from '../audio/step-triggers';
import type { Kit } from '../engine/kit';
import { MELEE_SPAN, type RemoteSnapshotPlayer, type Snapshot } from '../net/codec';
import type { RosterEntry } from '../net/protocol';
import { INTERP_DELAY } from '../sim/constants';
import type { HitPose } from '../sim/hitboxes';
import { MELEES, type WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponModel } from '../weapons/types';
import { Figures, type Look } from './figures';

export const TEAM_COLORS = ['#2f7dff', '#ff7a1a'] as const;

export interface Remote {
  entry: RosterEntry;
  rig: CharacterRig;
  guns: Partial<Record<WeaponId, WeaponModel>>;
  /** The gun in hand (none while the hand goes from one gun to the other). */
  weapon: WeaponId | null;
  armed: boolean;
  state: RemoteSnapshotPlayer | null;
  alive: boolean;
  shots: number;
  /** Seconds since this remote last fired (for animation and flashes). */
  sinceShot: number;
  sinceHurt: number;
  hurtDir: { x: number; z: number };
  hurtAmount: number;
  position: THREE.Vector3;
  yaw: number;
  visible: boolean;
  knock: THREE.Vector3;
  /** Direction of the last hit's shove. */
  shove: THREE.Vector3;
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
  hurtDirection: { x: 0, z: 0 },
  hurtAmount: 30,
  slide: false,
  swap: -1,
  swapFrom: null,
  alert: false
};

/** Progress that runs forward between two snapshots is blended; a restart or an end is taken as it comes. */
const between = (a: number, b: number, k: number, step: number) => (a >= 0 && b >= a ? a + (b - a) * k : step);

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

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
  private readonly figures: Figures;

  constructor(
    kit: Kit,
    private self: number
  ) {
    this.group.name = 'remotes';
    this.figures = new Figures(kit, this.group);
  }

  /** Build hidden figures with both guns for looks that join later (solo waves), so the warm-up frame draws them. */
  prepare(looks: readonly Look[]) {
    this.figures.prepare(looks);
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
        const { rig, guns, feet } = this.figures.take(entry.character);
        if (rig instanceof Rig) rig.animator.vary(id);
        r = { entry, rig, guns, weapon: null, armed: false, state: null, alive: false, shots: -1, sinceShot: 9, sinceHurt: 9, hurtDir: { x: 0, z: 0 }, hurtAmount: 30, position: new THREE.Vector3(), yaw: 0, visible: false, knock: new THREE.Vector3(), shove: new THREE.Vector3(), feet };
        this.map.set(id, r);
      }
      r.entry = entry;
      r.rig.setTint(entry.team !== -1 ? TEAM_COLORS[entry.team] : null);
    }
    for (const id of [...this.map.keys()]) if (!roster.has(id)) this.remove(id);
  }

  /** The local player's own figure, built hidden at load, broken apart where they die for the death camera to watch. */
  prepareOwn(look: Look) {
    this.figures.prepareOwn(look);
  }

  /** Poses the local player's figure where they died and breaks it into pieces flying along `impulse`. */
  shatterOwn(at: THREE.Vector3, yaw: number, weapon: WeaponId, crouch: number, pitch: number, impulse: THREE.Vector3): ShatterPiece[] {
    return this.figures.shatterOwn(at, yaw, weapon, crouch, pitch, impulse);
  }

  /** A remote leaves: its figure waits, hidden, for the next one with the same look. */
  remove(id: number) {
    const r = this.map.get(id);
    if (!r) return;
    this.map.delete(id);
    this.figures.release(r);
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
      const latest = snapshots[snapshots.length - 1]?.players.find((p) => p.id === r.entry.id);
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
      // A switch: the gun in hand (the loadout's other one) goes to its place, then the hand fetches `weapon`.
      const loadout = LOADOUTS[r.entry.character];
      const other = s.weapon === loadout.primary ? loadout.secondary : loadout.primary;
      const swap = between(a.swap ?? -1, b.swap ?? -1, k, s.swap ?? -1);
      const putting = swap >= 0 && swap < 0.5;
      const from = swap >= 0.5 ? other : null;
      const empty = from !== null && swap < swapGrab(stowPlaceOf(from), stowPlaceOf(s.weapon));
      this.figures.arm(r, putting ? other : empty ? null : s.weapon);
      let fired = false;
      if (s.shots !== r.shots) {
        fired = r.shots !== -1;
        r.shots = s.shots;
        if (fired) r.sinceShot = 0;
      }
      r.sinceShot += dt;
      if (r.sinceHurt < 0 && r.sinceHurt + dt >= 0) this.jolt(r);
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
      anim.weapon = putting ? other : s.weapon;
      anim.swap = swap;
      anim.swapFrom = from;
      anim.slide = s.sliding ?? false;
      anim.sinceShot = r.sinceShot;
      anim.alert = !!latest && latest.alive && latest.shots !== r.shots;
      anim.reload = between(a.reload, b.reload, k, s.reload);
      const melee = between(a.melee, b.melee, k, s.melee);
      anim.melee = melee < 0 ? -1 : Math.min(1, (melee * MELEE_SPAN) / (MELEES[loadout.melee].cooldown * 0.62));
      anim.grenade = between(a.grenade, b.grenade, k, s.grenade);
      anim.sinceHurt = r.sinceHurt;
      anim.hurtDirection = r.hurtDir;
      anim.hurtAmount = r.hurtAmount;
      r.rig.update(dt, anim);
      // After the pose, so the flash leaves the gun where it is drawn this frame.
      if (fired) this.onFire?.(r);
      if (r.feet.update() > 0 && anim.grounded && anim.speed > 1.2 && anim.crouch < 0.5) this.onStep?.(r, s.sprinting);
    }
  }

  /**
   * A hit on a remote. Another remote's shot shows when that shooter is drawn firing, `INTERP_DELAY` after the event
   * arrives, so the jolt waits for it; the local player's own hit shows at once.
   */
  hurt(id: number, from: [number, number, number], amount = 30, attacker = this.self) {
    const r = this.map.get(id);
    if (!r) return;
    r.sinceHurt = attacker === this.self ? 0 : -INTERP_DELAY;
    r.hurtAmount = amount;
    const dx = from[0] - r.position.x;
    const dz = from[2] - r.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const sin = Math.sin(r.yaw);
    const cos = Math.cos(r.yaw);
    r.hurtDir = { x: (dx * cos - dz * sin) / len, z: -(dx * sin + dz * cos) / len };
    r.shove.set(-dx / len, 0, -dz / len);
    if (r.sinceHurt >= 0) this.jolt(r);
  }

  /** A small shove away from the shooter and the white flash; the body's own jolt is the animator's flinch. */
  private jolt(r: Remote) {
    r.knock.copy(r.shove).multiplyScalar(0.04);
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
    this.figures.dispose();
  }
}

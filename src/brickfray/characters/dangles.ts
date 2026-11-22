import * as THREE from 'three';
import { clamp } from './ik';
import type { Pose } from './pose';
import { BONE } from './skeleton';
import type { DangleSpec } from './style';

const GRAVITY = 9.81;
/** How far from its anchor a hanging or upright part's own weight sits, in meters: what a turn swings out. */
const REACH = { hang: 0.16, up: 0.1 };
/** A toy's hair and cloth are light for their size: they swing out and trail a turn given by hand more than real ones would. */
const SWING = 1.8;
const AIR = 2.5;
/**
 * Tilt the bind pose allows toward the body, in radians: past it a ponytail or back cloth would sink into the head or
 * back (the parts are modelled lying against them). Away from the body and to the sides they swing up to these.
 */
const CLEAR: Partial<Record<number, { toward: number; away: number; side: number }>> = {
  [BONE.dangleBack]: { toward: 0.12, away: 0.85, side: 0.32 },
  [BONE.dangleHead]: { toward: 0.16, away: 1.1, side: 0.75 },
  // Panels front and back on one bone: either way is toward the body for one of them.
  [BONE.dangleHip]: { toward: 0.12, away: 0.12, side: 0.3 }
};

interface Turned {
  toward: number;
  away: number;
  side: number;
  lag: number;
  twist: number;
  /** Where the part's weight sits in the bone's frame, when it is not straight below the anchor. */
  weight?: [number, number, number];
  /** Swing per unit of the turn's pull, for cloth lighter than its size (1 by default). */
  gain?: number;
}

/**
 * A held stance on the turntable, per hanging bone: how far it swings away from the body and sideways (a cloak lifts
 * like cloth, it never planes out), how long it takes to follow the pull (s), and how far it twists about its own
 * length to trail the turn. A swing past the range is caught by a soft stop and keeps its follow-through.
 */
const TURNED: Partial<Record<number, Turned>> = {
  // The cape shader bends a swing away from the back into a curve; a sideways swing stays rigid, so it is kept small.
  [BONE.dangleBack]: { toward: 0.12, away: 0.46, side: 0.08, lag: 0.1, twist: 0.05 },
  [BONE.dangleHead]: { toward: 0.16, away: 1.1, side: 0.75, lag: 0.04, twist: 0 },
  // The tabard's panels hang a few centimetres in front of and behind the thighs and share one bone: a twist past a
  // little swings their edges into the thighs, so they trail a turn mostly by swinging sideways in their own planes,
  // the way the front panel (`weight`) is pulled, and swing back past the rest when it stops. A twist turns the front
  // and back panels opposite ways and opens the leg between them at the side.
  [BONE.dangleHip]: { toward: 0.05, away: 0.05, side: 0.3, lag: 0.1, twist: 0.05, weight: [0, -0.2, -0.13], gain: 2 }
};
/** Twist toward the trailing side per radian per second of turn. */
const TWIST_GAIN = 0.05;
/** How much stiffer than the part's own spring the soft stop past its range is. */
const STOP = 8;

/** How a showroom cloth bends on the turntable (material.ts ClothSway): rad of hem per rad/s of turn and per (rad/s)², its own sway in Hz and damping ratio. */
export interface ClothSwingSpec {
  trail: number;
  fling: number;
  max: number;
  hz: number;
  zeta: number;
}

/**
 * The bend a turn gives a cloth along its length, on top of its bone's swing: the hem trails the turn and flares out
 * with it, late, and swings past the rest a couple of times when the turn stops.
 */
export class ClothSwing {
  lateral = 0;
  flare = 0;
  private vl = 0;
  private vf = 0;

  constructor(readonly spec: ClothSwingSpec) {}

  update(dt: number, spin: number) {
    const { trail, fling, max, hz, zeta } = this.spec;
    const w = Math.PI * 2 * hz;
    const tl = soft(-trail * spin, -max, max);
    const tf = soft(fling * spin * spin, -max, max);
    const steps = Math.ceil(Math.max(dt, 0) / (1 / 120));
    const h = dt / Math.max(steps, 1);
    for (let i = 0; i < steps; i++) {
      this.vl += (w * w * (tl - this.lateral) - 2 * zeta * w * this.vl) * h;
      this.vf += (w * w * (tf - this.flare) - 2 * zeta * w * this.vf) * h;
      this.lateral += this.vl * h;
      this.flare = Math.max(0, this.flare + this.vf * h);
    }
  }
}

/** Eases an angle into [min, max]: unchanged up to 70% of the way to an end, then flattening toward it. */
function soft(angle: number, min: number, max: number) {
  const end = angle < 0 ? min : max;
  const knee = 0.7 * end;
  if (Math.abs(angle) <= Math.abs(knee)) return angle;
  const room = end - knee;
  return knee + room * Math.tanh((angle - knee) / room);
}

/** How far an angle is past [min, max]; 0 inside. */
const beyond = (angle: number, min: number, max: number) => (angle < min ? angle - min : angle > max ? angle - max : 0);

const down = new THREE.Vector3();
const vel = new THREE.Vector3();
const acc = new THREE.Vector3();
const reach = new THREE.Vector3();
const pull = new THREE.Vector3();
const inv = new THREE.Quaternion();
const e = new THREE.Euler();

/**
 * Secondary motion for a hanging or springy part (ponytail, scarf, plume,
 * antenna): a damped spring on pitch/roll pulled by gravity, the anchor's
 * acceleration and movement drag. Runs in the body frame; `spin` is how fast
 * that frame itself turns about the vertical through its origin (a turntable),
 * which swings the part out, makes it lag a change of pace and trail the turn.
 */
export class Dangle {
  private pitch = 0;
  private roll = 0;
  private twist = 0;
  private vp = 0;
  private vr = 0;
  private vt = 0;
  /** The pull the spring follows on the turntable, lagging the raw one. */
  private lagged = { pitch: 0, roll: 0, twist: 0 };
  private last = new THREE.Vector3();
  private lastVel = new THREE.Vector3();
  private lastSpin = 0;
  private primed = false;
  private readonly clear: { toward: number; away: number; side: number } | undefined;

  constructor(
    readonly bone: number,
    readonly parent: number,
    readonly spec: DangleSpec
  ) {
    this.clear = spec.up ? undefined : CLEAR[bone];
    this.turned = spec.up ? undefined : TURNED[bone];
  }

  private readonly turned: Turned | undefined;

  reset() {
    this.pitch = this.lagged.pitch = this.spec.rest[0];
    this.roll = this.lagged.roll = this.spec.rest[1];
    this.twist = this.lagged.twist = 0;
    this.vp = this.vr = this.vt = 0;
    this.primed = false;
  }

  /** `spin` is given for a held stance on the turntable (0 when it stands still) and left out in a match. */
  update(dt: number, pose: Pose, move: THREE.Vector3, spin?: number) {
    const S = this.spec;
    pose.solve(this.bone);
    const anchor = pose.mp[this.bone]!;
    const shown = spin !== undefined && this.turned ? this.turned : undefined;
    spin ??= 0;
    if (!this.primed || dt <= 0) {
      this.last.copy(anchor);
      this.lastVel.copy(move);
      this.lastSpin = spin;
      this.primed = true;
    }
    const h = Math.max(dt, 1e-4);
    vel.subVectors(anchor, this.last).divideScalar(h).add(move);
    acc.subVectors(vel, this.lastVel).divideScalar(h).clampLength(0, 40);
    this.last.copy(anchor);
    this.lastVel.copy(vel);

    // Gravity as the part feels it in the turning frame: less the turn's pull toward its axis and its change of pace
    // at the part's own weight, and the air it trails through. Without a turn it is plain gravity.
    const sign = S.up ? -1 : 1;
    down.set(0, -GRAVITY, 0);
    if (spin !== 0 || this.lastSpin !== 0) {
      const spinAcc = (spin - this.lastSpin) / h;
      const weight = shown?.weight;
      // Measured from the anchor, not the stand's axis: the hips sit off the axis, and a pull from there would swing
      // the panels to one side whichever way the figure turns.
      if (weight) reach.set(...weight).applyQuaternion(pose.mq[this.parent]!);
      else reach.set(0, S.up ? 1 : -1, 0).applyQuaternion(pose.mq[this.bone]!).multiplyScalar(S.up ? REACH.up : REACH.hang).add(anchor);
      // Panels on both sides of one bone cannot both flare out: they are left only the turn's drag and change of pace.
      const fling = weight ? 0 : spin * spin;
      const gain = shown?.gain ?? 1;
      pull.set(-fling * reach.x + spinAcc * reach.z, 0, -fling * reach.z - spinAcc * reach.x).multiplyScalar(SWING * gain).clampLength(0, 40);
      const air = S.drag * GRAVITY * AIR * gain;
      down.x -= pull.x + air * spin * reach.z;
      down.z -= pull.z - air * spin * reach.x;
    }
    this.lastSpin = spin;
    if (S.up) down.negate();
    down.normalize();

    inv.copy(pose.mq[this.parent]!).invert();
    down.applyQuaternion(inv);
    vel.applyQuaternion(inv);
    acc.applyQuaternion(inv);
    const gp = S.up ? Math.atan2(down.z, down.y) : Math.atan2(-down.z, -down.y);
    const gr = S.up ? Math.atan2(-down.x, down.y) : Math.atan2(down.x, -down.y);
    const c = this.clear;
    const away = shown?.away ?? c?.away ?? S.limit;
    const side = shown?.side ?? c?.side ?? S.limit;
    const toward = shown?.toward ?? c?.toward ?? S.limit;
    let tp = soft(S.rest[0] + (gp - S.rest[0]) * S.hang + sign * (S.drag * vel.z + S.inertia * acc.z), -away, toward);
    let tr = soft(S.rest[1] + (gr - S.rest[1]) * S.hang - sign * (S.drag * vel.x + S.inertia * acc.x), -side, side);
    let tt = 0;
    if (shown) {
      // Cloth answers a pull late and swings on past it once: the spring chases a lagging copy of its target.
      const k = 1 - Math.exp(-h / shown.lag);
      const L = this.lagged;
      tt = shown.twist > 0 ? soft(-TWIST_GAIN * spin, -shown.twist, shown.twist) : 0;
      tp = L.pitch += (tp - L.pitch) * k;
      tr = L.roll += (tr - L.roll) * k;
      tt = L.twist += (tt - L.twist) * k;
    }
    const steps = Math.ceil(h / (1 / 120));
    const sd = h / steps;
    for (let i = 0; i < steps; i++) {
      this.vp += (S.k * (tp - this.pitch) - S.damping * this.vp - (shown ? S.k * STOP * beyond(this.pitch, -away, toward) : 0)) * sd;
      this.vr += (S.k * (tr - this.roll) - S.damping * this.vr - (shown ? S.k * STOP * beyond(this.roll, -side, side) : 0)) * sd;
      this.vt += (S.k * (tt - this.twist) - S.damping * this.vt) * sd;
      this.pitch += this.vp * sd;
      this.roll += this.vr * sd;
      this.twist += this.vt * sd;
    }
    if (shown) {
      // The soft stop may let a swing run a little past the range, never into the body.
      this.pitch = this.stop(this.pitch, -away * 1.3, toward, 'vp');
      this.roll = this.stop(this.roll, -side * 1.3, side * 1.3, 'vr');
    } else {
      this.pitch = c ? this.stop(this.pitch, -c.away, c.toward, 'vp') : clamp(this.pitch, -S.limit, S.limit);
      this.roll = c ? this.stop(this.roll, -c.side, c.side, 'vr') : clamp(this.roll, -S.limit, S.limit);
    }
    pose.q[this.bone]!.setFromEuler(e.set(this.pitch, this.twist, this.roll, 'XYZ'));
    pose.solve(this.bone);
  }

  /** Holds an angle inside its range; a part that reaches the edge loses its speed into it instead of sticking there. */
  private stop(angle: number, min: number, max: number, speed: 'vp' | 'vr') {
    if (angle < min || angle > max) this[speed] = 0;
    return clamp(angle, min, max);
  }
}

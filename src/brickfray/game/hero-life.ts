import * as THREE from 'three';
import { STANCES } from '../characters';
import { hprQuat } from '../characters/ik';
import type { Pose } from '../characters/pose';
import { BONE, type V3 } from '../characters/skeleton';
import type { Stance, StanceLife } from '../characters/stance';
import type { CharacterId } from '../characters/types';

/** The showroom idle on top of each hero's stance: weight shifts from leg to leg, blinks, and a gesture of its own every few seconds. */
export class HeroLife implements StanceLife {
  readonly pelvis: V3 = [0, 0, 0];
  readonly pelvisRot: V3 = [0, 0, 0];
  readonly chest: V3 = [0, 0, 0];
  readonly head: V3 = [0, 0, 0];
  /** 0 with the eyes open, 1 shut. */
  blink = 0;
  private readonly stance: Stance;
  private readonly gesture: Gesture;
  private time = 0;
  private nextBlink = 1.6;
  private blinkAt = -1;
  private blinks = 0;
  private gestureAt: number;
  private gestures = 0;
  /** Where the gesture is (0…1, or -1 between them), and the turn it gives the gun this frame. */
  private u = -1;
  private carry = false;
  private readonly pivot = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  /** The figure's heading toward the lens, in its own frame. */
  private viewer = -0.5;

  constructor(readonly id: CharacterId) {
    this.stance = STANCES[id];
    this.gesture = GESTURES[id];
    this.gestureAt = this.gesture.first;
  }

  /** `yaw` is the figure's turn on its stand, which says where the lens is. */
  update(dt: number, yaw: number) {
    this.time += dt;
    const t = this.time;
    this.viewer = wrap(yaw - Math.PI);
    // Weight goes over to one leg in about a second, stays a few seconds and comes back: the hips slide and drop on the
    // free side, the shoulders and head level against them.
    const shift = SHIFT[this.id] * Math.tanh(2.6 * Math.sin((t * Math.PI * 2) / 11 + 0.6)) / Math.tanh(2.6);
    this.pelvis[0] = 0.032 * shift;
    this.pelvis[1] = -0.012 * (1 - shift * shift);
    this.pelvis[2] = 0;
    this.pelvisRot[0] = 0.03 * shift;
    this.pelvisRot[1] = 0;
    this.pelvisRot[2] = 0.05 * shift;
    this.chest[0] = -0.02 * shift;
    this.chest[1] = 0;
    this.chest[2] = -0.035 * shift;
    this.head[0] = 0;
    this.head[1] = 0;
    this.head[2] = -0.03 * shift;

    if (t >= this.gestureAt + this.gesture.length) {
      this.gestures++;
      this.gestureAt = t + 4.2 + ((this.gestures * 0.618) % 1) * 2.6;
    }
    this.u = t >= this.gestureAt ? (t - this.gestureAt) / this.gesture.length : -1;
    if (this.u >= 0) this.gesture.body?.(this.u, this, this.stance, this.viewer);
    this.updateBlink(t);
  }

  hand(side: 'L' | 'R', wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose) {
    if (this.u < 0) return;
    if (side === 'R') this.carry = this.gesture.gun?.(this.u, wrist, rotation, pose, this.pivot, this.turn) ?? false;
    if (this.carry) {
      wrist.sub(this.pivot).applyQuaternion(this.turn).add(this.pivot);
      rotation.premultiply(this.turn);
    }
    if (side === 'L') this.gesture.left?.(this.u, wrist, rotation, pose);
  }

  private updateBlink(t: number) {
    if (this.blinkAt < 0 && t >= this.nextBlink) {
      this.blinkAt = t;
      this.blinks++;
      // Every third blink comes as a quick pair.
      const double = this.blinks % 3 === 0;
      this.nextBlink = t + (double ? 0.32 : 2.4 + ((this.blinks * 0.754) % 1) * 2.8);
    }
    if (this.blinkAt < 0) {
      this.blink = 0;
      return;
    }
    const k = t - this.blinkAt;
    // Shuts in 60 ms, stays shut a frame or two, opens in 110 ms.
    this.blink = k < 0.06 ? k / 0.06 : k < 0.1 ? 1 : Math.max(0, 1 - (k - 0.1) / 0.11);
    if (k >= 0.21) this.blinkAt = -1;
  }
}

interface Gesture {
  /** Seconds before the first one, and how long one takes. */
  first: number;
  length: number;
  /** Adds to the body's offsets at gesture time `u` (0…1). */
  body?(u: number, life: HeroLife, stance: Stance, viewer: number): void;
  /** Turns the gun and both hands on it together: sets `pivot` and `turn` from the right hand's target; false leaves them. */
  gun?(u: number, wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose, pivot: THREE.Vector3, turn: THREE.Quaternion): boolean;
  /** Moves the left hand alone. */
  left?(u: number, wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose): void;
}

/** How far each hero moves its weight from leg to leg: the aimed or braced ones less. */
const SHIFT: Record<CharacterId, number> = { rivet: 1, vega: 0.8, clack: 0.7, coral: 1, moss: 0.5, nova: 0.9 };

const v = new THREE.Vector3();
const w = new THREE.Vector3();
const q = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 0 before `a`, easing to 1 by `b`, holding, easing back to 0 from `c` to `d`. */
const span = (u: number, a: number, b: number, c: number, d: number) => smooth((u - a) / (b - a)) * (1 - smooth((u - c) / (d - c)));
/** A quick lift that drops back faster than it rose, peaking at `at`. */
const tap = (u: number, at: number, width: number) => {
  const x = (u - at) / width;
  return x < -1 || x > 0.6 ? 0 : x < 0 ? smooth(x + 1) : 1 - smooth(x / 0.6);
};
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

/** As far as a neck turns from the stance, and the turn past which the figure does not look round at all. */
const NECK = 1.1;
const BEHIND = [1.3, 1.9] as const;

/** Turns the head toward an absolute model-space aim [heading, pitch, roll], by `k`; an aim behind the figure is left alone. */
function aim(life: HeroLife, stance: Stance, target: V3, k: number) {
  const turn = wrap(target[0] - stance.head[0]);
  const reach = 1 - smooth(Math.min(1, Math.max(0, (Math.abs(turn) - BEHIND[0]) / (BEHIND[1] - BEHIND[0]))));
  life.head[0] += (Math.max(-NECK, Math.min(NECK, turn)) * reach - life.head[0]) * k;
  for (let i = 1; i < 3; i++) life.head[i] += (wrap(target[i]! - stance.head[i]!) * reach - life.head[i]!) * k;
}

/** Rotates a hand's rotation about one of its own axes. */
function twist(rotation: THREE.Quaternion, axis: V3, angle: number) {
  rotation.multiply(q2.setFromAxisAngle(v.set(...axis), angle));
}

const GESTURES: Record<CharacterId, Gesture> = {
  // Lifts the mallet off his shoulder and taps it down twice, glancing at it.
  rivet: {
    first: 2.6,
    length: 2.1,
    body(u, life) {
      const e = span(u, 0, 0.2, 0.75, 1);
      life.head[0] -= 0.22 * e;
      life.head[1] -= 0.05 * e + 0.04 * (tap(u, 0.42, 0.14) + tap(u, 0.68, 0.14));
      life.chest[2] -= 0.03 * e;
    },
    left(u, wrist, rotation) {
      const lift = 0.18 * span(u, 0.05, 0.25, 0.8, 1) + 0.14 * (tap(u, 0.42, 0.14) + tap(u, 0.68, 0.14));
      twist(rotation, [1, 0, 0], -lift);
      wrist.y += 0.04 * lift;
    }
  },
  // Rolls the rifle over to look along its side, head down to it, then back to the ready.
  vega: {
    first: 3.2,
    length: 2.6,
    body(u, life) {
      const e = span(u, 0, 0.25, 0.7, 1);
      life.head[0] += 0.3 * e;
      life.head[1] -= 0.3 * e;
      life.chest[0] += 0.12 * e;
    },
    gun(u, wrist, rotation, _pose, pivot, turn) {
      const e = span(u, 0, 0.25, 0.7, 1);
      w.set(0, 0, -1).applyQuaternion(rotation);
      pivot.copy(wrist).addScaledVector(w, 0.1);
      turn.setFromAxisAngle(w, -0.9 * e).premultiply(q.setFromAxisAngle(v.crossVectors(w, DOWN).normalize(), 0.5 * e));
      return true;
    }
  },
  // A quick flourish of the sword: the blade flicks out and back, the wrist rolling under it.
  clack: {
    first: 2.2,
    length: 1.6,
    body(u, life) {
      const e = span(u, 0, 0.2, 0.7, 1);
      life.head[1] -= 0.08 * e;
      life.head[0] -= 0.1 * e;
    },
    left(u, _wrist, rotation) {
      const flick = tap(u, 0.32, 0.18) + 0.75 * tap(u, 0.6, 0.16);
      twist(rotation, [0, 0, 1], 0.8 * flick);
      twist(rotation, [1, 0, 0], -0.35 * flick);
    }
  },
  // Lets go of the fore-grip to settle the air hose on the left shoulder, tugs it, and takes the grip again.
  coral: {
    first: 3,
    length: 2.8,
    body(u, life) {
      const e = span(u, 0.05, 0.3, 0.7, 0.95);
      life.head[0] -= 0.35 * e;
      life.head[1] -= 0.12 * e;
      life.chest[0] -= 0.12 * e;
    },
    gun(u, wrist, rotation, pose, pivot, turn) {
      const e = span(u, 0, 0.3, 0.72, 1);
      pivot.copy(pose.mp[BONE.upperArmR]!);
      w.set(0, 0, -1).applyQuaternion(rotation);
      turn.setFromAxisAngle(v.crossVectors(w, DOWN).normalize(), 0.18 * e);
      return true;
    },
    left(u, wrist, rotation, pose) {
      const e = span(u, 0.04, 0.32, 0.68, 0.98);
      const tug = 0.012 * (tap(u, 0.47, 0.08) + tap(u, 0.58, 0.08));
      pose.toModel(BONE.chest, v.set(-0.15, 0.2 - tug, -0.16), w);
      wrist.lerp(w, e);
      rotation.slerp(q.copy(pose.mq[BONE.chest]!).multiply(hprQuat(0.6, 1.25, -1.2, q2)), e);
    }
  },
  // Lowers the rifle from his eye, turns to look straight at the viewer, and goes back to the scope.
  moss: {
    first: 2.8,
    length: 3.4,
    body(u, life, stance, viewer) {
      const e = span(u, 0, 0.22, 0.74, 1);
      life.pelvisRot[0] -= 0.15 * e;
      life.chest[0] -= 0.55 * e;
      aim(life, stance, [viewer, -0.06, 0], span(u, 0.06, 0.3, 0.7, 0.94));
    },
    gun(u, wrist, rotation, pose, pivot, turn) {
      const e = span(u, 0, 0.22, 0.74, 1);
      pivot.copy(pose.mp[BONE.upperArmR]!);
      w.set(0, 0, -1).applyQuaternion(rotation);
      turn.setFromAxisAngle(v.crossVectors(w, DOWN).normalize(), 0.42 * e);
      return true;
    }
  },
  // Nova's gesture is the wave its stance already carries.
  nova: { first: 1e9, length: 1 }
};

import * as THREE from 'three';
import { hprQuat } from '../characters/ik';
import type { Pose } from '../characters/pose';
import { BONE, type V3 } from '../characters/skeleton';
import type { Stance } from '../characters/stance';
import type { CharacterId } from '../characters/types';

/** Furthest the head turns from the chest (about 40 degrees), the stance's own wandering glance included. */
export const NECK = 0.7;

/** What a gesture may change: the life's body offsets, added to the stance's. */
export interface GestureBody {
  pelvisRot: V3;
  chest: V3;
  head: V3;
}

export interface Gesture {
  length: number;
  /** Adds to the body's offsets at gesture time `u` (0…1). */
  body?(u: number, life: GestureBody, stance: Stance, viewer: number): void;
  /** Turns the gun and both hands on it together: sets `pivot` and `turn` from the right hand's target; false leaves them. */
  gun?(u: number, wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose, pivot: THREE.Vector3, turn: THREE.Quaternion): boolean;
  /** Moves the left hand alone. */
  left?(u: number, wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose): void;
}

/**
 * Each hero's own idle tempo: the weight shift's period (s), phase, size and how quickly it goes over (`snap`), and the
 * gestures' first start and the rest between them (`gap` seconds plus up to `spread` more).
 */
export interface Rhythm {
  period: number;
  phase: number;
  amount: number;
  snap: number;
  first: number;
  gap: number;
  spread: number;
}

export const RHYTHM: Record<CharacterId, Rhythm> = {
  rivet: { period: 8.6, phase: 0.6, amount: 1, snap: 3.2, first: 2.4, gap: 3.4, spread: 2.2 },
  vega: { period: 12.4, phase: 2.2, amount: 0.8, snap: 2.4, first: 3.4, gap: 4.6, spread: 3 },
  clack: { period: 7.4, phase: 4.1, amount: 0.85, snap: 1.8, first: 1.6, gap: 2.6, spread: 1.8 },
  coral: { period: 14.2, phase: 1.3, amount: 1, snap: 1.5, first: 3, gap: 5.4, spread: 3.2 },
  moss: { period: 16.5, phase: 3.4, amount: 0.5, snap: 2.2, first: 3.6, gap: 6, spread: 3 },
  nova: { period: 10.2, phase: 5.1, amount: 0.9, snap: 2.8, first: 1e9, gap: 0, spread: 0 }
};

const v = new THREE.Vector3();
const w = new THREE.Vector3();
const q = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const MOSS_LOW = { drop: 0.6, turn: 0.45, below: 0.35 };

/** Smootherstep: no jump in acceleration where a move starts or stops. */
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10));
/** 0 before `a`, easing to 1 by `b`, holding, easing back to 0 from `c` to `d`. */
const span = (u: number, a: number, b: number, c: number, d: number) => smooth((u - a) / (b - a)) * (1 - smooth((u - c) / (d - c)));
/** A quick lift that drops back faster than it rose, peaking at `at`. */
const tap = (u: number, at: number, width: number) => {
  const x = (u - at) / width;
  return x < -1 || x > 0.6 ? 0 : x < 0 ? smooth(x + 1) : 1 - smooth(x / 0.6);
};
export const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

/** How far the lens may sit off the chest's front before a look toward it starts to give up, and where it has given up. */
const GIVE_UP = [0.8, 1.35] as const;

/**
 * Turns the head toward an absolute model-space aim [heading, pitch, roll], by `k`: never more than `NECK` off the
 * chest, and back to the stance's own look once the aim swings round past the shoulder.
 */
function aim(life: GestureBody, stance: Stance, target: V3, k: number) {
  const chest = stance.chest[0] + life.chest[0];
  const turn = wrap(target[0] - chest);
  const reach = 1 - smooth((Math.abs(turn) - GIVE_UP[0]) / (GIVE_UP[1] - GIVE_UP[0]));
  const rest = wrap(stance.head[0] - chest);
  const head = Math.max(-NECK, Math.min(NECK, turn)) * reach + rest * (1 - reach);
  life.head[0] += (wrap(chest + head - stance.head[0]) - life.head[0]) * k;
  for (let i = 1; i < 3; i++) life.head[i] += (wrap(target[i]! - stance.head[i]!) * reach - life.head[i]!) * k;
}

/** Rotates a hand's rotation about one of its own axes. */
function twist(rotation: THREE.Quaternion, axis: V3, angle: number) {
  rotation.multiply(q2.setFromAxisAngle(v.set(...axis), angle));
}

/**
 * Tips the gun in the right hand about the shoulder: muzzle down by `drop` (negative raises it), rolled by `roll` about
 * the barrel. A pivot `below` the shoulder swings the hands out in front as the muzzle drops instead of into the belly.
 */
function tipGun(rotation: THREE.Quaternion, pose: Pose, pivot: THREE.Vector3, turn: THREE.Quaternion, drop: number, roll = 0, below = 0) {
  pivot.copy(pose.mp[BONE.upperArmR]!);
  pivot.y -= below;
  w.set(0, 0, -1).applyQuaternion(rotation);
  turn.setFromAxisAngle(w, roll).premultiply(q.setFromAxisAngle(v.crossVectors(w, DOWN).normalize(), drop));
  return true;
}

/** Each hero's gestures, taken in turn. */
export const GESTURES: Record<CharacterId, readonly Gesture[]> = {
  rivet: [
    // Lifts the mallet off his shoulder and taps it down twice, glancing at it.
    {
      length: 2.1,
      body(u, life) {
        const e = span(u, 0, 0.2, 0.75, 1);
        life.head[0] -= 0.22 * e;
        life.head[1] -= 0.05 * e + 0.04 * (tap(u, 0.42, 0.14) + tap(u, 0.68, 0.14));
        life.chest[2] -= 0.03 * e;
      },
      left(u, wrist, rotation) {
        // The head swings up and out to the side, clear of the hard hat's brim, and drops back onto the shoulder.
        const lift = 0.18 * span(u, 0.05, 0.25, 0.8, 1) + 0.14 * (tap(u, 0.42, 0.14) + tap(u, 0.68, 0.14));
        twist(rotation, [0, 0, 1], 1.6 * lift);
        twist(rotation, [1, 0, 0], -0.5 * lift);
        wrist.y += 0.1 * lift;
        wrist.x -= 0.08 * lift;
      }
    },
    // Brings the nailer up to look it over, then lets it drop back to his side.
    {
      length: 2.2,
      body(u, life) {
        const e = span(u, 0.05, 0.3, 0.65, 0.95);
        life.head[0] += 0.18 * e;
        life.head[1] -= 0.12 * e;
        life.chest[0] += 0.06 * e;
      },
      gun: (u, _wrist, rotation, pose, pivot, turn) => tipGun(rotation, pose, pivot, turn, -0.7 * span(u, 0, 0.3, 0.62, 1), -0.6 * span(u, 0.1, 0.35, 0.6, 0.9))
    }
  ],
  vega: [
    // Rolls the rifle over to look along its side, head down to it, then back to the ready.
    {
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
    }
  ],
  clack: [
    // Raises the sword before his visor in a salute, flicks the blade out and back, and lowers it.
    {
      length: 2.2,
      body(u, life) {
        const e = span(u, 0, 0.2, 0.72, 1);
        life.head[1] += 0.06 * e - 0.08 * tap(u, 0.3, 0.14);
        life.head[0] -= 0.12 * e;
        life.chest[1] += 0.05 * e;
      },
      left(u, wrist, rotation) {
        const e = span(u, 0, 0.22, 0.7, 1);
        const flick = tap(u, 0.42, 0.16) + 0.75 * tap(u, 0.62, 0.14);
        wrist.y += 0.09 * e;
        wrist.z -= 0.05 * e;
        twist(rotation, [1, 0, 0], -0.3 * e - 0.35 * flick);
        twist(rotation, [0, 0, 1], 0.8 * flick);
      }
    },
    // Tips the shotgun up onto his shoulder line, turns his helm to check it, and brings it back down to the ready.
    {
      length: 2.4,
      body(u, life) {
        const e = span(u, 0.08, 0.32, 0.66, 0.92);
        life.head[0] += 0.3 * e;
        life.head[1] += 0.05 * e;
        life.chest[0] += 0.1 * e;
        life.pelvisRot[0] += 0.04 * e;
      },
      gun: (u, _wrist, rotation, pose, pivot, turn) => tipGun(rotation, pose, pivot, turn, -0.6 * span(u, 0, 0.3, 0.68, 1), 0.3 * span(u, 0.2, 0.4, 0.55, 0.75))
    }
  ],
  coral: [
    // Lets go of the fore-grip to settle the air hose on the left shoulder, tugs it, and takes the grip again.
    {
      length: 2.8,
      body(u, life) {
        const e = span(u, 0.05, 0.3, 0.7, 0.95);
        life.head[0] -= 0.28 * e;
        life.head[1] -= 0.12 * e;
        life.chest[0] -= 0.18 * e;
      },
      gun: (u, _wrist, rotation, pose, pivot, turn) => tipGun(rotation, pose, pivot, turn, 0.18 * span(u, 0, 0.3, 0.72, 1)),
      left(u, wrist, rotation, pose) {
        const e = span(u, 0.04, 0.32, 0.68, 0.98);
        const tug = 0.012 * (tap(u, 0.47, 0.08) + tap(u, 0.58, 0.08));
        pose.toModel(BONE.chest, v.set(-0.15, 0.2 - tug, -0.16), w);
        wrist.lerp(w, e);
        rotation.slerp(q.copy(pose.mq[BONE.chest]!).multiply(hprQuat(0.6, 1.25, -1.2, q2)), e);
      }
    }
  ],
  moss: [
    // Lowers the rifle from his eye, turns to look straight at the viewer, and goes back to the scope.
    {
      length: 3.8,
      body(u, life, stance, viewer) {
        const e = span(u, 0, 0.28, 0.7, 1);
        life.pelvisRot[0] -= 0.15 * e;
        life.chest[0] -= 0.55 * e;
        aim(life, stance, [viewer, -0.06, 0], span(u, 0.06, 0.3, 0.7, 0.94));
      },
      // The rifle comes down off the eye to a low ready: muzzle dipped toward the ground ahead and kept turned off the viewer
      // as the chest comes round, so it never points out of the screen or swings its stock through the glove.
      gun(u, _wrist, rotation, pose, pivot, turn) {
        const e = span(u, 0, 0.28, 0.7, 1);
        tipGun(rotation, pose, pivot, turn, MOSS_LOW.drop * e, 0, MOSS_LOW.below);
        turn.premultiply(q.setFromAxisAngle(UP, MOSS_LOW.turn * e));
        return true;
      }
    }
  ],
  // Nova's gesture is the wave its stance already carries.
  nova: []
};

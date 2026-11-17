import * as THREE from 'three';
import { keyed, smooth, window4 } from './ik';

/** Where the left hand goes during an action, in the aim frame (shoulder center, heading 0, x right, y up, z back). */
export interface HandAction {
  /** 0 = on the support grip, 1 = fully on this action's path. */
  weight: number;
  pos: THREE.Vector3;
  /** Direction the hand's -Z axis points (mallet handle, throw), and its up. */
  forward: THREE.Vector3;
  up: THREE.Vector3;
  /** Lower the gun to one-handed carry. */
  lower: number;
  /** Extra chest heading (positive turns left) and pitch. */
  twist: number;
  bend: number;
  mallet: number;
  grenade: number;
}

export function emptyAction(): HandAction {
  return { weight: 0, pos: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0), lower: 0, twist: 0, bend: 0, mallet: 0, grenade: 0 };
}

const k6 = [0, 0, 0, 0, 0, 0];

/** Mallet swing: wind up over the left shoulder, chop down across the body, follow through low right. */
const MELEE = [
  [0.0, -0.1, 0.0, -0.4, 0.4, 0],
  [0.18, -0.24, 0.3, 0.05, 2.3, 0.3],
  [0.3, -0.2, 0.34, 0.02, 2.5, 0.25],
  [0.46, 0.0, 0.02, -0.5, -0.4, -0.1],
  [0.6, 0.14, -0.24, -0.34, -1.2, -0.3],
  [0.85, 0.05, -0.1, -0.4, -0.2, 0],
  [1, 0.05, -0.1, -0.4, -0.2, 0]
] as const;

/** Overhand off-hand throw: wind-up behind the head (cooking holds at 0.25), release over the shoulder, follow through. */
const THROW = [
  [0.0, -0.12, 0.0, -0.4, 0.3, 0],
  [0.2, -0.27, 0.22, 0.14, 1.9, 0.4],
  [0.25, -0.28, 0.23, 0.16, 2.0, 0.4],
  [0.42, -0.1, 0.3, -0.36, 0.6, 0],
  [0.56, 0.08, -0.1, -0.42, -0.8, -0.2],
  [0.8, 0.0, -0.08, -0.4, -0.2, 0],
  [1, 0.0, -0.08, -0.4, -0.2, 0]
] as const;

function path(keys: readonly (readonly number[])[], t: number, out: HandAction) {
  keyed(t, keys, k6);
  out.pos.set(k6[0]!, k6[1]!, k6[2]!);
  const pitch = k6[3]!;
  const heading = k6[4]!;
  out.forward.set(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), -Math.cos(heading) * Math.cos(pitch));
  out.up.set(0, Math.cos(pitch) > 0.2 ? 1 : 0, Math.cos(pitch) > 0.2 ? 0 : 1);
}

export function meleeAction(m: number, out: HandAction) {
  path(MELEE, m, out);
  out.weight = window4(m, 0, 0.12, 0.72, 0.95);
  out.lower = window4(m, 0, 0.1, 0.75, 0.95);
  out.twist = 0.5 * window4(m, 0, 0.18, 0.3, 0.42) - 0.4 * window4(m, 0.38, 0.5, 0.6, 0.85);
  out.bend = -0.25 * window4(m, 0.38, 0.5, 0.6, 0.85);
  out.mallet = window4(m, 0.0, 0.06, 0.82, 0.9);
  out.grenade = 0;
}

export function throwAction(g: number, out: HandAction) {
  path(THROW, g, out);
  out.weight = window4(g, 0, 0.12, 0.66, 0.9);
  out.lower = window4(g, 0, 0.12, 0.7, 0.92);
  out.twist = 0.5 * window4(g, 0, 0.2, 0.26, 0.4) - 0.35 * window4(g, 0.36, 0.5, 0.6, 0.85);
  out.bend = -0.2 * window4(g, 0.36, 0.48, 0.58, 0.8);
  out.mallet = 0;
  out.grenade = g < 0.43 ? smooth(g, 0.04, 0.12) : 0;
}

export interface ReloadFrame {
  /** Gun tilt weight. */
  tilt: number;
  /** Hand position as a blend of points: 0 support, 1 magazine well, 2 belt pouch. */
  a: number;
  b: number;
  mix: number;
  /** Extra offset in gun space while pulling / seating the magazine. */
  drop: number;
  weight: number;
}

const RELOAD = [
  [0.0, 0, 0],
  [0.14, 1, 0],
  [0.24, 1, -0.06],
  [0.4, 2, 0],
  [0.52, 2, 0],
  [0.66, 1, -0.07],
  [0.74, 1, 0.0],
  [0.8, 1, 0.015],
  [0.9, 0, 0],
  [1, 0, 0]
] as const;

/** Reload: tilt the gun, strip the magazine, fetch one from the left hip, seat it, back to the grip. */
export function reloadAt(r: number, out: ReloadFrame) {
  out.tilt = window4(r, 0, 0.12, 0.84, 0.98);
  out.weight = window4(r, 0, 0.1, 0.84, 0.95);
  let i = 0;
  while (i < RELOAD.length - 2 && r > RELOAD[i + 1]![0]) i++;
  const k0 = RELOAD[i]!;
  const k1 = RELOAD[i + 1]!;
  out.a = k0[1];
  out.b = k1[1];
  out.mix = smooth(r, k0[0], k1[0]);
  out.drop = k0[2] + (k1[2] - k0[2]) * out.mix;
  return out;
}

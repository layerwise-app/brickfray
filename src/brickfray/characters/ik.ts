import * as THREE from 'three';

const n = new THREE.Vector3();
const pole = new THREE.Vector3();
const x = new THREE.Vector3();
const y = new THREE.Vector3();
const z = new THREE.Vector3();
const m = new THREE.Matrix4();

export const UP = new THREE.Vector3(0, 1, 0);

/**
 * Two-bone IK in one space. Limb bones point down their local -Y in the rest
 * pose; `kneeForward` bends like a leg (joint points along local -Z), otherwise
 * like an arm (elbow points along +Z). Writes the two model rotations and the
 * middle joint position; returns the reached end point in `end`.
 */
export function twoBoneIK(
  root: THREE.Vector3,
  target: THREE.Vector3,
  a: number,
  b: number,
  poleDir: THREE.Vector3,
  kneeForward: boolean,
  outUpper: THREE.Quaternion,
  outLower: THREE.Quaternion,
  mid: THREE.Vector3,
  end: THREE.Vector3
) {
  n.subVectors(target, root);
  let d = n.length();
  if (d < 1e-6) n.set(0, -1, 0);
  else n.divideScalar(d);
  d = THREE.MathUtils.clamp(d, Math.abs(a - b) + 0.01, (a + b) * 0.9995);
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  pole.copy(poleDir).addScaledVector(n, -poleDir.dot(n));
  if (pole.lengthSq() < 1e-8) pole.set(0, 0, kneeForward ? -1 : 1).addScaledVector(n, -n.z * (kneeForward ? -1 : 1));
  pole.normalize();
  mid.copy(root).addScaledVector(n, along).addScaledVector(pole, h);
  end.copy(root).addScaledVector(n, d);

  y.subVectors(root, mid).normalize();
  z.copy(pole).multiplyScalar(kneeForward ? -1 : 1);
  z.addScaledVector(y, -z.dot(y)).normalize();
  x.crossVectors(y, z).normalize();
  outUpper.setFromRotationMatrix(m.makeBasis(x, y, z));

  y.subVectors(mid, end).normalize();
  z.crossVectors(x, y).normalize();
  outLower.setFromRotationMatrix(m.makeBasis(x, y, z));
}

/** Rotation whose local -Z points along `forward` with local +Y as close to `up` as possible. */
export function lookRotation(forward: THREE.Vector3, up: THREE.Vector3, out: THREE.Quaternion) {
  z.copy(forward).normalize().negate();
  x.crossVectors(up, z);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  y.crossVectors(z, x);
  return out.setFromRotationMatrix(m.makeBasis(x, y, z));
}

/** Yaw (right-positive heading, 0 = -Z) as a rotation about +Y. */
export function yawQuat(heading: number, out: THREE.Quaternion) {
  return out.setFromAxisAngle(UP, -heading);
}

const e = new THREE.Euler();
/** Heading, pitch (toe/barrel up positive), roll; applied in that order. */
export function hprQuat(heading: number, pitch: number, roll: number, out: THREE.Quaternion) {
  e.set(pitch, -heading, roll, 'YXZ');
  return out.setFromEuler(e);
}

export function damp(current: number, target: number, rate: number, dt: number) {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function dampAngle(current: number, target: number, rate: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-rate * dt));
}

export const smooth = THREE.MathUtils.smoothstep;
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;

/** Smoothstep window: 0 before a, rises to 1 at b, holds, falls back to 0 between c and d. */
export function window4(t: number, a: number, b: number, c: number, d: number) {
  return smooth(t, a, b) * (1 - smooth(t, c, d));
}

/** Piecewise keyframes [time, value...] with smoothstep easing between keys. */
export function keyed(t: number, keys: readonly (readonly number[])[], out: number[]) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1]![0]!) i++;
  const k0 = keys[i]!;
  const k1 = keys[Math.min(i + 1, keys.length - 1)]!;
  const span = k1[0]! - k0[0]!;
  const u = span <= 0 ? 1 : smooth(t, k0[0]!, k1[0]!);
  for (let j = 1; j < k0.length; j++) out[j - 1] = lerp(k0[j]!, k1[j]!, u);
  return out;
}

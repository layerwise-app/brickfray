import * as THREE from 'three';

export type V3 = readonly [number, number, number];

/** A hand placement relative to a node: palm frame position and orientation. */
export interface Goal {
  node: THREE.Object3D;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}

const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const m = new THREE.Matrix4();

/**
 * Hand orientation from the back-of-hand direction and the grip axis
 * (pinky → index). `side` 1 = right hand, -1 = left (mirrored mesh).
 */
export function gripQuat(back: V3, axis: V3, side: 1 | -1): THREE.Quaternion {
  by.set(...axis).normalize();
  bx.set(...back).multiplyScalar(side);
  bx.addScaledVector(by, -bx.dot(by)).normalize();
  bz.crossVectors(bx, by);
  return new THREE.Quaternion().setFromRotationMatrix(m.makeBasis(bx, by, bz));
}

/** Hand orientation for a held tool: its handle along `axis`, the fingers' side facing `face`. */
export function holdQuat(axis: V3, face: V3): THREE.Quaternion {
  by.set(...axis).normalize();
  bz.set(...face).negate();
  bz.addScaledVector(by, -bz.dot(by)).normalize();
  bx.crossVectors(by, bz);
  return new THREE.Quaternion().setFromRotationMatrix(m.makeBasis(bx, by, bz));
}

export function goal(node: THREE.Object3D, pos: V3, quat: THREE.Quaternion): Goal {
  return { node, pos: new THREE.Vector3(...pos), quat };
}

const tmpLocal = new THREE.Matrix4();
const pa = new THREE.Vector3();
const pb = new THREE.Vector3();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const sc = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);

/** World matrix of a goal (nodes must have up-to-date world matrices). */
export function goalMatrix(g: Goal, out: THREE.Matrix4) {
  tmpLocal.compose(g.pos, g.quat, one);
  return out.multiplyMatrices(g.node.matrixWorld, tmpLocal);
}

const ma = new THREE.Matrix4();
const mb = new THREE.Matrix4();

/** Blend two goals by t (position lerp, rotation slerp) into a world matrix. */
export function blendGoals(a: Goal, b: Goal | null, t: number, out: THREE.Matrix4) {
  goalMatrix(a, ma);
  if (!b || t <= 0) return out.copy(ma);
  goalMatrix(b, mb);
  if (t >= 1) return out.copy(mb);
  ma.decompose(pa, qa, sc);
  mb.decompose(pb, qb, sc);
  pa.lerp(pb, t);
  qa.slerp(qb, t);
  return out.compose(pa, qa, one);
}

/** Blend two world matrices (rigid). */
export function blendMatrices(a: THREE.Matrix4, b: THREE.Matrix4, t: number, out: THREE.Matrix4) {
  a.decompose(pa, qa, sc);
  b.decompose(pb, qb, sc);
  pa.lerp(pb, t);
  qa.slerp(qb, t);
  return out.compose(pa, qa, one);
}

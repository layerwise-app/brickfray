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

/** A hand travelling from one goal to the next, with the goals on either side of that leg. */
export interface HandPath {
  before: Goal;
  from: Goal;
  to: Goal;
  after: Goal;
  /** Linear progress along the leg, 0…1. */
  t: number;
  /** Durations of the previous, current and next legs. */
  spans: readonly [number, number, number];
}

const ma = new THREE.Matrix4();
const mb = new THREE.Matrix4();
const p0 = new THREE.Vector3();
const p3 = new THREE.Vector3();
const m1 = new THREE.Vector3();
const m2 = new THREE.Vector3();
const leg = new THREE.Vector3();
const HOLD = 1e-4;
/** A leg this short is a cut (a snap between goals), not a motion to carry on from. */
const CUT = 1e-3;

/** Velocity through a waypoint from the legs on either side; zero when either leg is a hold or a cut. */
function through(prev: THREE.Vector3, at: THREE.Vector3, next: THREE.Vector3, hPrev: number, hNext: number, out: THREE.Vector3) {
  if (prev.distanceToSquared(at) < HOLD * HOLD || at.distanceToSquared(next) < HOLD * HOLD || hPrev < CUT || hNext < CUT) return out.set(0, 0, 0);
  out.subVectors(at, prev);
  leg.subVectors(next, at);
  // A hand that doubles back pauses at the turn instead of swinging wide of it.
  const straight = (1 + out.dot(leg) / (out.length() * leg.length())) / 2;
  out.multiplyScalar(hNext / hPrev).addScaledVector(leg, hPrev / hNext);
  return out.multiplyScalar(straight / (hPrev + hNext));
}

/**
 * World matrix of a hand on its path: the position arcs through the goals
 * without stopping on them (it eases only where the hand really rests), and
 * the rotation keeps the same pace.
 */
export function followPath(path: HandPath, out: THREE.Matrix4) {
  goalMatrix(path.from, ma).decompose(pa, qa, sc);
  if (path.from === path.to || path.t <= 0) return out.compose(pa, qa, one);
  goalMatrix(path.to, mb).decompose(pb, qb, sc);
  if (path.t >= 1) return out.compose(pb, qb, one);
  const [h0, h1, h2] = path.spans;
  if (path.before === path.from) p0.copy(pa);
  else p0.setFromMatrixPosition(goalMatrix(path.before, ma));
  if (path.after === path.to) p3.copy(pb);
  else p3.setFromMatrixPosition(goalMatrix(path.after, mb));
  // Capped so a short neighbouring leg cannot fling the hand past its goal.
  const reach = pa.distanceTo(pb) * 2;
  through(p0, pa, pb, h0, h1, m1).multiplyScalar(h1).clampLength(0, reach);
  through(pa, pb, p3, h1, h2, m2).multiplyScalar(h1).clampLength(0, reach);
  const t = path.t;
  const t2 = t * t;
  const t3 = t2 * t;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const turn = h10 * (m1.lengthSq() > 0 ? 1 : 0) + h01 + h11 * (m2.lengthSq() > 0 ? 1 : 0);
  pa.multiplyScalar(1 - h01).addScaledVector(m1, h10).addScaledVector(pb, h01).addScaledVector(m2, h11);
  qa.slerp(qb, turn);
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

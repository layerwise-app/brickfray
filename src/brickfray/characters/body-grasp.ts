import * as THREE from 'three';
import type { V3 } from './skeleton';

/** The hand is modelled at life size against the forearm, then scaled up to the figure's chunky proportions. */
export const SIZE = 1.05;

/** Knuckle positions and proportions, index to pinky, as a right hand (wrist at the origin, fingers along -Z, palm toward -X). */
export const FINGERS: { at: V3; len: V3; r: number }[] = [
  { at: [0.002, 0.0325, -0.088], len: [0.031, 0.021, 0.018], r: 0.0112 },
  { at: [0.002, 0.0108, -0.092], len: [0.034, 0.023, 0.019], r: 0.0115 },
  { at: [0.002, -0.0107, -0.089], len: [0.032, 0.021, 0.018], r: 0.0108 },
  { at: [0.002, -0.031, -0.082], len: [0.025, 0.017, 0.015], r: 0.0098 }
];
export const THUMB = { at: [-0.004, 0.026, -0.018] as V3, len: [0.036, 0.028, 0.025] as V3, r: [0.0165, 0.0128, 0.0116] as V3 };

/**
 * A gun's fore-end a `hold` hand closes round: a box with rounded edges seen end on, lying across the palm.
 * `half` is half its depth off the palm and half its width along the fingers.
 */
export interface ForeEnd {
  half: [number, number];
  corner: number;
  /** Turn of the box about its own axis, toward the fingertips' side of the palm. */
  roll?: number;
  /** Angle between the box's axis and the hand's Y about the palm's normal: the fore-end crosses the palm on a slant. */
  yaw?: number;
  /** A round tube along the top of the box (an air tube, a barrel): its radius and its centre's height over the box's. */
  over?: { r: number; at: number };
  /** How far the far face lies past the middle finger's knuckle toward the fingertips; by default just inside it. */
  seat?: number;
  /** How far the handle presses into the palm's pad: a hard grip on a thick fore-end, so the fingers reach over its top. */
  sink?: number;
}

/**
 * The pistol grip every gun shares, in the gun's frame (origin at the top of the grip, barrel along -Z): a point on its
 * axis, its rake back from upright, its section across the palm and along the fingers, and how far it sits into the
 * fingers: the knuckles ride its front corner, so the fingers fold evenly round it.
 */
export const PISTOL = { at: [0, -0.02, 0.0196] as V3, rake: 0.25, half: [0.015, 0.024] as [number, number], corner: 0.01, seat: 0.012 };

export interface Digit {
  from: V3;
  dir: V3;
  toward: V3;
  len: V3;
  r: number;
  /** Largest bend at each joint, and the smallest (negative lifts the segment off the handle). */
  max: V3;
  min?: V3;
  /** How far each segment may press into the handle; the soft tip most. */
  press?: V3;
  /**
   * The least bend at the middle and end joints, so a finger on a flat face arches with its pad on the face instead of
   * lying on it like a stick; each joint then bends only as far as leaves the rest of the finger, so curled, clear of it.
   */
  curl?: V3;
}

/** How deep the palm's skin is under a handle laid on it, and how far each segment of a digit may press into the handle: the soft tip most. */
const PALM = 0.0165;
const PRESS: V3 = [0.0012, 0.002, 0.0045];
/** The middle finger's knuckle: a slanted fore-end's far face passes just inside it. */
const KNUCKLE = { y: 0.011, z: -0.09 };

/** Where a fore-end lies in a right hand (wrist at the origin, fingers along -Z, palm toward -X): its centre. */
export function foreCentre(f: ForeEnd, fingerR = 0.0112): V3 {
  const [hx, hz] = extent(f);
  const yaw = f.yaw ?? 0;
  return [-(PALM - (f.sink ?? 0) + hx), 0, KNUCKLE.z + fingerR * 0.9 - (f.seat ?? 0) + hz / Math.cos(yaw) + KNUCKLE.y * Math.tan(yaw)];
}

/** Half extents of the rolled box along the hand's X and Z. */
function extent(f: ForeEnd): [number, number] {
  const c = Math.abs(Math.cos(f.roll ?? 0));
  const s = Math.abs(Math.sin(f.roll ?? 0));
  const [a, b] = f.half;
  const r = f.corner;
  return [(a - r) * c + (b - r) * s + r, (a - r) * s + (b - r) * c + r];
}

/** Signed distance from a point in the hand's space to the fore-end's surface, measured across the hand's Y. */
export function foreDistance(f: ForeEnd, centre: V3, x: number, y: number, z: number) {
  const yaw = f.yaw ?? 0;
  const dx = x - centre[0];
  const dz = (z - centre[2] + y * Math.tan(yaw)) * Math.cos(yaw);
  const c = Math.cos(f.roll ?? 0);
  const s = Math.sin(f.roll ?? 0);
  const lx = c * dx + s * dz;
  const lz = -s * dx + c * dz;
  const qx = Math.abs(lx) - (f.half[0] - f.corner);
  const qz = Math.abs(lz) - (f.half[1] - f.corner);
  const box = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - f.corner;
  return f.over ? Math.min(box, Math.hypot(lx + f.over.at, lz) - f.over.r) : box;
}

const p = new THREE.Vector3();
const d = new THREE.Vector3();
const n = new THREE.Vector3();
const axis = new THREE.Vector3();
const q = new THREE.Vector3();
const t = new THREE.Vector3();
const r = new THREE.Vector3();

/**
 * Bends of a digit's three joints that lay it along the fore-end: each segment turns toward the handle as far as it
 * can without sinking into it, so the chain hugs its faces and folds at its edges. Lengths are in the hand's unscaled
 * space; the handle is given there too.
 */
export function wrapDigit(f: ForeEnd, centre: V3, g: Digit): V3 {
  p.set(...g.from);
  d.set(...g.dir).normalize();
  n.set(...g.toward).normalize();
  axis.crossVectors(d, n).normalize();
  const press = g.press ?? PRESS;
  const out: V3 = [0, 0, 0];
  /** The worst clearance past what may press in, of segment `i` bent by `bend` and, with a curl, the rest of the chain at it. */
  const clear = (i: number, bend: number) => {
    let worst = Infinity;
    q.copy(p);
    t.copy(d).applyAxisAngle(axis, bend);
    for (let j = i; j < 3; j++) {
      if (j > i) t.applyAxisAngle(axis, g.curl![j]!);
      for (let k = 1; k <= 6; k++) {
        r.copy(q).addScaledVector(t, (g.len[j]! * k) / 6);
        worst = Math.min(worst, foreDistance(f, centre, r.x, r.y, r.z) - g.r + press[j]!);
      }
      if (!g.curl) break;
      q.addScaledVector(t, g.len[j]!);
    }
    return worst;
  };
  for (let i = 0; i < 3; i++) {
    const lo = Math.max(g.min?.[i] ?? 0, g.curl?.[i] ?? 0);
    let best = lo;
    let bestGap = -Infinity;
    for (let bend = g.max[i]!; bend >= lo - 1e-9; bend -= 0.01) {
      const gap = clear(i, bend);
      if (gap >= 0) {
        best = bend;
        break;
      }
      if (gap > bestGap) {
        bestGap = gap;
        best = bend;
      }
    }
    out[i] = best;
    d.applyAxisAngle(axis, best);
    p.addScaledVector(d, g.len[i]!);
  }
  return out;
}

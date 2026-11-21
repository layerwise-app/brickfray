import * as THREE from 'three';
import { box, latheZ, tube } from '../shapes';
import type { Surface } from '../surface';

/** Color slots the character palette fills in: sleeve = primary, trim = secondary. */
export type Slot = 'sleeve' | 'trim' | 'glove' | 'pad' | 'seam' | 'cuff';

export interface ArmPiece {
  geometry: THREE.BufferGeometry;
  /** Placement in the frame of the joint the piece rides on. */
  matrix: THREE.Matrix4;
  slot: Slot;
  surface: Surface;
  /** Index into HAND_JOINTS; 0 (the hand itself) when omitted. */
  joint?: number;
}

/**
 * Hand frame: origin on the axis of whatever the hand holds, +Y along that
 * axis (pinky → index), back of the hand toward +X, fingers wrapping around
 * through -Z, thumb through +Z. Right hand; the left one is mirrored.
 *
 * Finger and thumb segments live in joint frames: the joint at the origin,
 * the segment running down -Z, its pad toward -X, so bending is a turn about +Y.
 */
export const WRIST = new THREE.Vector3(0.024, -0.014, 0.064);

export interface HandJoint {
  parent: number;
  /** Offset from the parent joint, right hand. */
  pos: THREE.Vector3;
}

/** Joint of a finger (0 index … 3 pinky) segment (0 knuckle, 1 middle, 2 tip). */
export const fingerJoint = (finger: number, segment: number) => 1 + finger * 3 + segment;
/** First of the thumb's three joints (base, knuckle, tip). */
export const THUMB_JOINT = 13;

interface Digit {
  base: readonly [number, number, number];
  /** Segment lengths, joint to joint (the last to the centre of the rounded tip). */
  len: readonly [number, number, number];
  /** Half thickness at each joint and at the tip. */
  r: readonly [number, number, number, number];
  width: readonly [number, number, number];
}

const FINGERS: readonly Digit[] = [
  { base: [0.0272, 0.0288, -0.021], len: [0.036, 0.0235, 0.0185], r: [0.0097, 0.009, 0.0083, 0.0072], width: [0.0186, 0.0178, 0.0168] },
  { base: [0.0275, 0.0094, -0.0245], len: [0.039, 0.0265, 0.0195], r: [0.01, 0.0092, 0.0085, 0.0074], width: [0.0194, 0.0185, 0.0174] },
  { base: [0.0272, -0.0102, -0.0215], len: [0.036, 0.0245, 0.0185], r: [0.0097, 0.009, 0.0083, 0.0072], width: [0.0186, 0.0178, 0.0168] },
  { base: [0.0262, -0.0286, -0.0155], len: [0.0285, 0.0185, 0.0165], r: [0.0088, 0.0081, 0.0075, 0.0066], width: [0.0166, 0.0158, 0.015] }
];
const THUMB: Digit = { base: [0.0235, 0.0235, 0.043], len: [0.035, 0.0265, 0.02], r: [0.0126, 0.0106, 0.0095, 0.0082], width: [0.026, 0.021, 0.0195] };

export const HAND_JOINTS: readonly HandJoint[] = (() => {
  const joints: HandJoint[] = [{ parent: -1, pos: new THREE.Vector3() }];
  for (const d of [...FINGERS, THUMB]) {
    const first = joints.length;
    joints.push({ parent: 0, pos: new THREE.Vector3(...d.base) });
    joints.push({ parent: first, pos: new THREE.Vector3(0, 0, -d.len[0]) });
    joints.push({ parent: first + 1, pos: new THREE.Vector3(0, 0, -d.len[1]) });
  }
  return joints;
})();

/** Thickness of the cuff over its width: a wrist is an oval, flat like the palm. */
const CUFF_FLAT = 0.8;

const ARC = [0, 0.25, 0.5, 0.75, 1].map((t) => t * Math.PI);
const inside = new THREE.Vector3();
const ea = new THREE.Vector3();
const eb = new THREE.Vector3();
const en = new THREE.Vector3();

/**
 * One finger segment: a bevelled block from its joint down -Z whose two ends
 * are rounded about the joints, so neighbours overlap at any bend.
 */
function phalanx(len: number, rA: number, rB: number, width: number, bevel: number): THREE.BufferGeometry {
  const ring = (inset: number, y: number) => {
    const a = rA - inset;
    const b = rB - inset;
    return [
      ...ARC.map((t) => new THREE.Vector3(Math.cos(t) * a, y, Math.sin(t) * a)),
      ...ARC.map((t) => new THREE.Vector3(-Math.cos(t) * b, y, -len - Math.sin(t) * b))
    ];
  };
  const h = width / 2;
  const rings = [ring(bevel, -h), ring(0, -h + bevel), ring(0, h - bevel), ring(bevel, h)];
  const faces: THREE.Vector3[][] = [rings[0]!, rings[3]!];
  const n = rings[0]!.length;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([rings[k]![i]!, rings[k]![j]!, rings[k + 1]![j]!, rings[k + 1]![i]!]);
    }
  }
  inside.set(0, 0, -len / 2);
  const positions: number[] = [];
  const normals: number[] = [];
  for (const face of faces) {
    en.crossVectors(ea.subVectors(face[1]!, face[0]!), eb.subVectors(face[2]!, face[0]!)).normalize();
    const flip = en.dot(ea.subVectors(face[0]!, inside)) < 0;
    if (flip) en.negate();
    for (let i = 1; i < face.length - 1; i++) {
      for (const p of flip ? [face[0]!, face[i + 1]!, face[i]!] : [face[0]!, face[i]!, face[i + 1]!]) {
        positions.push(p.x, p.y, p.z);
        normals.push(en.x, en.y, en.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

const at = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

function digit(out: ArmPiece[], d: Digit, first: number, fingers: boolean) {
  for (let k = 0; k < 3; k++) {
    const len = d.len[k]!;
    const w = d.width[k]!;
    out.push({ geometry: phalanx(len, d.r[k]!, d.r[k + 1]!, w, 0.0034), matrix: new THREE.Matrix4(), slot: 'glove', surface: 'satin', joint: first + k });
    if (fingers || k > 0) {
      // Armour plate over most of the back of the segment, clear of both joints: it outlines the finger on a glove-coloured gun.
      const r = (d.r[k]! + d.r[k + 1]!) / 2;
      const long = k === 2 ? 0.55 : 0.74;
      out.push({ geometry: box(0.0036, w * 0.86, len * long, 0.0013), matrix: at(r + 0.0006, 0, -len * (k === 2 ? 0.42 : 0.5)), slot: 'pad', surface: 'rubber', joint: first + k });
    }
  }
}

/** Gloved hand: palm, cuff, four fingers and a thumb, every segment on its own joint. */
export function handPieces(): ArmPiece[] {
  const out: ArmPiece[] = [];
  const glove = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => out.push({ geometry, matrix, slot: 'glove', surface: 'satin' });
  const pad = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => out.push({ geometry, matrix, slot: 'pad', surface: 'rubber' });
  // Palm slab from the heel to the knuckle line, the pinky edge a touch shorter.
  glove(box(0.0235, 0.058, 0.078, 0.0105), at(0.0282, 0.0095, 0.0175));
  glove(box(0.0225, 0.03, 0.07, 0.0075), at(0.0274, -0.024, 0.0205));
  // Heel of the hand and the pad under the knuckles: the hollow between them takes the held object.
  glove(box(0.013, 0.036, 0.036, 0.0055), at(0.0205, -0.019, 0.0385));
  glove(box(0.009, 0.07, 0.013, 0.004), at(0.0185, 0, -0.0185));
  pad(box(0.0055, 0.042, 0.029, 0.0034), at(0.041, 0.003, 0.022));
  FINGERS.forEach((f, i) => {
    digit(out, f, fingerJoint(i, 0), true);
    pad(box(0.0075, f.width[0] * 0.82, 0.0155, 0.003), at(f.base[0] + 0.0092, f.base[1], f.base[2] + 0.0035));
  });
  digit(out, THUMB, THUMB_JOINT, false);
  // Short oval cuff behind the heel of the hand, aimed back along the forearm and domed shut at the back, so a bent wrist
  // shows a rounded joint, never an open or flat-capped tube; no wider than the palm, so it never hides the fingers.
  const dir = WRIST.clone().sub(new THREE.Vector3(0.03, -0.002, 0.018)).normalize();
  const cuff = new THREE.Matrix4().compose(WRIST.clone().addScaledVector(dir, 0.006), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(CUFF_FLAT, 1, 1));
  glove(latheZ([[0, -0.016], [0.024, -0.016], [0.0275, -0.009], [0.0288, 0.002], [0.0268, 0.012], [0.019, 0.0195], [0, 0.0225]], 16), cuff);
  return out;
}

/** Upper arm along +Y from the shoulder; length in meters. */
export function upperArmPieces(length: number): ArmPiece[] {
  const up = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  return [{ geometry: latheZ([[0, 0], [0.054, 0], [0.05, length * 0.6], [0.047, length], [0, length + 0.02]], 16), matrix: up, slot: 'sleeve', surface: 'satin' }];
}

/**
 * Forearm along +Y from the elbow to the wrist: sleeve to mid-forearm ending in a thin hem, then the glove's gauntlet,
 * flared over the sleeve and tapering to the wrist, where it is rounded off like the cuff it meets.
 */
export function forearmPieces(length: number): ArmPiece[] {
  const segs = 18;
  const up = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const ring = (y: number) => up.clone().premultiply(new THREE.Matrix4().makeTranslation(0, y, 0));
  const cut = length * 0.5;
  return [
    { geometry: latheZ([[0, -0.035], [0.037, -0.03], [0.042, 0.0], [0.0425, cut * 0.5], [0.0405, cut - 0.012], [0.039, cut], [0, cut]], segs), matrix: up, slot: 'sleeve', surface: 'satin' },
    { geometry: tube(0.0412, 0.008, segs, 0.003), matrix: ring(cut - 0.006), slot: 'trim', surface: 'plastic' },
    {
      geometry: latheZ([[0, cut - 0.012], [0.0355, cut - 0.012], [0.0372, cut + 0.006], [0.0345, cut + 0.03], [0.0285, length * 0.66], [0.0232, length * 0.84], [0.0205, length - 0.008], [0.016, length + 0.002], [0, length + 0.006]], segs),
      matrix: up,
      slot: 'cuff',
      surface: 'satin'
    },
    { geometry: tube(0.0352, 0.003, segs), matrix: ring(cut + 0.026), slot: 'seam', surface: 'dark' }
  ];
}

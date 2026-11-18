import * as THREE from 'three';
import type { BodyStyle } from './body';
import { orb, tone } from './body-kit';
import { blockCup, blockGrip } from './body-low';
import type { HandShape, Look, PartSet } from './parts';
import * as S from './shapes';
import type { V3 } from './skeleton';

interface HandPose {
  /** Index to pinky: bend of the knuckle, middle and end joints in radians. */
  fingers: [V3, V3, V3, V3];
  /** Fan of each finger away from straight ahead, toward the thumb positive. */
  spread: [number, number, number, number];
  /** The thumb's first direction, what it curls toward, and its three bends. */
  thumb: { dir: V3; toward: V3; flex: V3 };
  /** Where the hand sits off the wrist and its [pitch, yaw, roll], for hands shaped around a weapon. */
  at?: V3;
  rot?: V3;
}

const CURLED: V3 = [1.45, 1.7, 1.15];
const TUCKED = { dir: [-0.6, 0.15, -0.78], toward: [-0.25, -0.9, -0.2], flex: [0, 0.75, 0.6] } satisfies HandPose['thumb'];

/**
 * Hand shapes as a right hand: wrist at the origin, fingers along -Z, thumb up, palm toward -X.
 * The left hand is the mirror image.
 */
const POSES: Record<HandShape, HandPose> = {
  open: {
    fingers: [
      [0.06, 0.1, 0.06],
      [0.04, 0.08, 0.05],
      [0.07, 0.1, 0.06],
      [0.1, 0.12, 0.08]
    ],
    spread: [0.17, 0.04, -0.08, -0.22],
    thumb: { dir: [-0.2, 0.82, -0.55], toward: [-0.6, -0.3, -0.75], flex: [0, 0.12, 0.1] }
  },
  relaxed: {
    fingers: [
      [0.3, 0.5, 0.3],
      [0.42, 0.6, 0.35],
      [0.52, 0.66, 0.4],
      [0.62, 0.7, 0.42]
    ],
    spread: [0.07, 0.01, -0.04, -0.1],
    thumb: { dir: [-0.5, 0.5, -0.7], toward: [-0.5, -0.5, -0.7], flex: [0.05, 0.3, 0.3] }
  },
  fist: {
    fingers: [CURLED, CURLED, CURLED, [1.5, 1.7, 1.15]],
    spread: [0.03, 0, -0.02, -0.05],
    thumb: TUCKED
  },
  point: {
    fingers: [[0.04, 0.05, 0.03], CURLED, CURLED, [1.5, 1.7, 1.15]],
    spread: [0.02, 0, -0.02, -0.05],
    thumb: TUCKED
  },
  grip: {
    fingers: [
      [0.95, 0.5, 0.45],
      [1.25, 0.5, 1.05],
      [1.25, 0.5, 1.05],
      [1.25, 0.55, 1.05]
    ],
    spread: [0.04, 0, -0.01, -0.03],
    thumb: { dir: [-0.85, 0.3, -0.45], toward: [0, -0.2, -1], flex: [0, 0.5, 0.3] },
    at: [0.011, 0.03, 0],
    rot: [-0.22, 0, 0]
  },
  cup: {
    fingers: [
      [0.6, 0.95, 0.7],
      [0.65, 1, 0.7],
      [0.65, 1, 0.7],
      [0.7, 1, 0.7]
    ],
    spread: [0.03, 0, -0.02, -0.04],
    thumb: { dir: [-0.35, 0.7, -0.6], toward: [-1, 0.1, -0.3], flex: [0, 0.35, 0.3] },
    at: [0.012, 0.012, -0.012],
    rot: [0, 0.87, -Math.PI / 2]
  }
};

/** Knuckle positions and proportions, index to pinky. */
const FINGERS: { at: V3; len: V3; r: number }[] = [
  { at: [0.002, 0.0325, -0.088], len: [0.031, 0.021, 0.018], r: 0.0112 },
  { at: [0.002, 0.0108, -0.092], len: [0.034, 0.023, 0.019], r: 0.0115 },
  { at: [0.002, -0.0107, -0.089], len: [0.032, 0.021, 0.018], r: 0.0108 },
  { at: [0.002, -0.031, -0.082], len: [0.025, 0.017, 0.015], r: 0.0098 }
];
/** The hand is modelled at life size against the forearm, then scaled up to the figure's chunky proportions. */
const SIZE = 1.05;
const THUMB = { at: [-0.004, 0.026, -0.018] as V3, len: [0.036, 0.028, 0.025] as V3, r: [0.0165, 0.0128, 0.0116] as V3 };

type Paint = [color: string, look: Look];

const d = new THREE.Vector3();
const n = new THREE.Vector3();
const axis = new THREE.Vector3();
const zAxis = new THREE.Vector3();
const p = new THREE.Vector3();
const basis = new THREE.Matrix4();
const euler = new THREE.Euler();
const base = new THREE.Matrix4();
const baseQ = new THREE.Quaternion();

/**
 * One hand on its bone. Showroom and high tiers get a palm and five jointed digits;
 * medium and low keep the mitten blocks that only exist for the two weapon holds.
 */
export function hand(b: PartSet, s: BodyStyle, side: 'L' | 'R', shape: HandShape) {
  if (b.detail < 2 && side === 'R' && shape === 'grip') return blockGrip(b, s);
  if (b.detail < 2 && side === 'L' && shape === 'cup') return blockCup(b, s);
  const bone = `hand${side}` as const;
  const sign = side === 'R' ? 1 : -1;
  const pose = POSES[shape];
  const glove = s.glove;
  const gloveLook = s.gloveLook ?? 'rubber';
  const bare = s.fingers !== undefined;
  const gloved: Paint = [glove, gloveLook];
  const tips: Paint = bare ? [s.fingers!, 'skin'] : gloved;
  const radial = b.hero ? 8 : 6;
  // Six-sided fingers read thinner than round ones.
  const girth = b.hero ? 1 : 1.07;

  baseQ.setFromEuler(euler.set(pose.rot?.[0] ?? 0, pose.rot?.[1] ?? 0, pose.rot?.[2] ?? 0, 'YXZ'));
  base.compose(p.set(...(pose.at ?? [0, 0, 0])), baseQ, new THREE.Vector3(1, 1, 1));

  /** Places a part whose local Y runs along `along` and local +Z faces `facing`, both in right-hand space. */
  const place = (geometry: THREE.BufferGeometry, color: string, look: Look, at: THREE.Vector3, along: THREE.Vector3, facing: THREE.Vector3) => {
    const y = along.clone().transformDirection(base);
    const z = facing.clone().transformDirection(base);
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    z.crossVectors(x, y);
    const o = at.clone().multiplyScalar(SIZE).applyMatrix4(base);
    if (sign < 0) {
      o.x = -o.x;
      y.x = -y.x;
      z.x = -z.x;
      x.set(-x.x, x.y, x.z).negate();
    }
    euler.setFromRotationMatrix(basis.makeBasis(x, y, z), 'YXZ');
    b.add(bone, geometry, color, { at: [o.x, o.y, o.z], rot: [euler.x, euler.y, euler.z], scale: [SIZE, SIZE, SIZE], look });
  };

  const segment = (len: number, r: number, tip = false) =>
    S.loft(
      [
        { y: 0, rx: r, rz: r * 0.94, e: 2.3 },
        { y: len, rx: r * 0.94, rz: r * 0.88, e: 2.3 }
      ],
      radial,
      { bottom: r * 0.75, top: r * 0.8, domes: tip && b.hero ? 2 : 1 }
    );

  /** Three segments curling from `from` along `dir` toward `toward`; outside the showroom the last two are one piece. */
  const digit = (from: V3, dir: V3, toward: V3, len: V3, r: V3, flex: V3, paints: Paint[], nail: boolean) => {
    p.set(...from);
    d.set(...dir).normalize();
    n.set(...toward).normalize();
    axis.crossVectors(d, n).normalize();
    const simple = !b.hero;
    for (let i = 0; i < 3; i++) {
      let length = len[i]!;
      let bend = flex[i]!;
      if (simple && i === 1) {
        bend += flex[2]! * 0.5;
        length += len[2]! * 0.9;
      }
      d.applyAxisAngle(axis, bend);
      zAxis.crossVectors(axis, d);
      const [color, look] = paints[i]!;
      place(segment(length, r[i]! * girth, i === 2 || (simple && i === 1)), color, look, p, d, zAxis);
      if (nail && i === 2) {
        const tip = p.clone().addScaledVector(d, length * 0.62).addScaledVector(zAxis, -r[i]! * 0.7);
        place(S.blob(r[i]! * 1.4, length * 0.62, 0.005, 0.8, 8, 0), tone(color, 1.22), 'gloss', tip, d, zAxis);
      }
      p.addScaledVector(d, length);
      if (simple && i === 1) break;
    }
  };

  // Wrist ball, palm, and the pad over the knuckles.
  orb(b, bone, 0.024, b.hero ? 12 : 8, glove, { look: gloveLook });
  const forward = new THREE.Vector3(0, 0, -1);
  const palmSide = new THREE.Vector3(-1, 0, 0);
  place(
    S.loft(
      [
        { y: 0.004, rx: 0.029, rz: 0.014, back: 0.013, e: 2.6 },
        { y: 0.036, rx: 0.042, rz: 0.0155, back: 0.017, cx: 0.002, e: 2.8 },
        { y: 0.072, rx: 0.0445, rz: 0.0145, back: 0.014, cx: 0.001, e: 3 },
        { y: 0.091, rx: 0.0435, rz: 0.0125, back: 0.0115, cx: 0.001, e: 3 }
      ],
      b.hero ? 14 : 8,
      { steps: b.hero ? 2 : 1, bottom: 0.006, top: 0.006 }
    ),
    glove,
    gloveLook,
    new THREE.Vector3(),
    forward,
    palmSide
  );
  if (b.hero) place(S.blob(0.076, 0.022, 0.012, 0.6, 10, 0), tone(glove, bare ? 0.85 : 0.9), gloveLook, new THREE.Vector3(0.0135, 0.001, -0.076), forward, palmSide);

  FINGERS.forEach((f, i) => {
    const spread = pose.spread[i]!;
    const dir: V3 = [0, Math.sin(spread), -Math.cos(spread)];
    const r: V3 = [f.r, f.r * 0.95, f.r * 0.9];
    // Fingerless gloves cover the first joint: a sleeve in the showroom, the whole segment on the simpler tier.
    digit(f.at, dir, [-1, 0, 0], f.len, r, pose.fingers[i]!, [bare && !b.hero ? gloved : tips, tips, tips], b.hero && bare);
    if (bare && b.hero) {
      p.set(...f.at);
      d.set(...dir);
      n.set(-1, 0, 0);
      axis.crossVectors(d, n).normalize();
      d.applyAxisAngle(axis, pose.fingers[i]![0]);
      zAxis.crossVectors(axis, d);
      place(segment(f.len[0] * 0.42, f.r * 1.09), glove, gloveLook, p, d, zAxis);
    }
  });
  const thumb = pose.thumb;
  digit(THUMB.at, thumb.dir, thumb.toward, THUMB.len, THUMB.r, thumb.flex, [gloved, tips, tips], b.hero && bare);
}

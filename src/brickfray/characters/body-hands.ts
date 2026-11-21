import * as THREE from 'three';
import type { BodyStyle } from './body';
import { orb, tone } from './body-kit';
import { blockCup, blockGrip } from './body-low';
import { FINGERS, foreCentre, PISTOL, SIZE, THUMB, wrapDigit, type ForeEnd } from './body-grasp';
import { foreGrip } from './body-hold';
import type { HandShape, Look, PartSet } from './parts';
import * as S from './shapes';
import type { V3 } from './skeleton';
import { SOCKET_R } from './upper';

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
  /** How far the finger roots roll toward the palm, as the knuckles do when a hand closes hard round a thick handle. */
  root?: number;
}

const CURLED: V3 = [1.45, 1.7, 1.15];
const TUCKED = { dir: [-0.6, 0.15, -0.78], toward: [-0.25, -0.9, -0.2], flex: [0, 0.75, 0.6] } satisfies HandPose['thumb'];

/**
 * Hand shapes as a right hand: wrist at the origin, fingers along -Z, thumb up, palm toward -X.
 * The left hand is the mirror image.
 */
const POSES: Record<HandShape, HandPose> = {
  // A greeting hand: fingers fanned and softly curled, more toward the little finger, the thumb out, so it never reads as a flat paddle.
  open: {
    fingers: [
      [0.1, 0.16, 0.1],
      [0.13, 0.2, 0.12],
      [0.2, 0.26, 0.16],
      [0.3, 0.34, 0.22]
    ],
    spread: [0.24, 0.06, -0.11, -0.3],
    thumb: { dir: [-0.22, 0.74, -0.64], toward: [-0.62, -0.2, -0.76], flex: [0.04, 0.22, 0.2] }
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
  // Each finger lies tangent to a handle of `HANDLE.radius` on the axis at `HANDLE.at`; the thumb closes over the index finger.
  hold: {
    fingers: [
      [1.32, 0.49, 1.04],
      [1.45, 0.51, 1.13],
      [1.37, 0.49, 1.06],
      [1.14, 0.28, 0.98]
    ],
    spread: [0.02, 0, -0.01, -0.03],
    thumb: { dir: [-0.7, 0.34, -0.63], toward: [-0.5, -0.7, -0.5], flex: [0, 0.6, 0.6] }
  },
  // A handguard lies across the palm at 50° to the fingers, so each finger meets its far edge at a different joint.
  cup: {
    fingers: [
      [0.25, 1.3, 0.8],
      [1.2, 0.5, 0.8],
      [1.5, 0.45, 0.8],
      [1.8, 0.4, 0.6]
    ],
    spread: [0.03, 0, -0.02, -0.04],
    thumb: { dir: [-0.6, 0.3, -0.75], toward: [-0.7, -0.2, -0.6], flex: [0, 0.3, 0.3] },
    at: [0.012, 0.012, -0.012],
    rot: [0, 0.87, -Math.PI / 2]
  }
};

/** The handle a `hold` hand is closed around, as a right hand: a point on its axis, which runs along the hand's Y. */
export const HANDLE = { at: [-0.0307, 0, -0.0735] as V3, radius: 0.0155 };

/** Where a hand's wrist sits off its bone, in the bone's space: the hands shaped around a gun are built off-center. */
export function wristOffset(shape: HandShape, side: 'L' | 'R'): V3 {
  const [x, y, z] = (shape === 'grip' ? GRIP.at : POSES[shape].at) ?? [0, 0, 0];
  return [side === 'R' ? x : -x, y, z];
}

/**
 * The `grip` hand on the pistol grip, which hangs off the bone at SOCKET_R: the grip as a fore-end in the hand's space
 * (palm on its right face, its front face just inside the knuckles) and where the hand sits on its bone to put it there.
 */
const GRIP = (() => {
  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(...POSES.grip.rot!, 'YXZ'));
  const up = new THREE.Vector3(0, Math.cos(PISTOL.rake), -Math.sin(PISTOL.rake));
  const local = up.clone().applyQuaternion(turn.clone().invert());
  const fore: ForeEnd = { half: [PISTOL.half[0] / SIZE, PISTOL.half[1] / SIZE], corner: PISTOL.corner / SIZE, yaw: Math.atan2(-local.z, local.y), seat: PISTOL.seat / SIZE };
  const centre = new THREE.Vector3(...foreCentre(fore)).multiplyScalar(SIZE).applyQuaternion(turn);
  const axis = new THREE.Vector3(...PISTOL.at).add(SOCKET_R);
  const t = (POSES.grip.at![1] + centre.y - axis.y) / up.y;
  return { fore, at: [axis.x - centre.x, POSES.grip.at![1], axis.z + t * up.z - centre.z] as V3 };
})();

/** The `grip` hand's fingers and thumb closed onto the pistol grip. */
function pistolGrip(girth: number): HandPose {
  const { fore } = GRIP;
  const centre = foreCentre(fore);
  const g = POSES.grip;
  const fingers = FINGERS.map((f, i) =>
    wrapDigit(fore, centre, { from: f.at, dir: [0, Math.sin(g.spread[i]!), -Math.cos(g.spread[i]!)], toward: [-1, 0, 0], len: f.len, r: f.r * girth * 0.96, max: [1.75, 1.8, 1.35] })
  ) as HandPose['fingers'];
  return { ...g, at: GRIP.at, fingers };
}

/** Hands that hold nothing; a glove on thick limbs is cut bigger so it is not lost on its cuff. Weapon holds keep their size, the weapon fixes it. */
const FREE = new Set<HandShape>(['open', 'relaxed', 'fist', 'point']);

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
  const glove = s.glove;
  const gloveLook = s.gloveLook ?? 'rubber';
  const bare = s.fingers !== undefined;
  const gloved: Paint = [glove, gloveLook];
  const tips: Paint = bare ? [s.fingers!, 'skin'] : gloved;
  const radial = b.hero ? 12 : 6;
  const mitt = !bare && FREE.has(shape);
  const puff = mitt ? Math.min(1.2, Math.max(1, 1 + ((s.limbs ?? 1) - 1) * 1.5)) : 1;
  const size = SIZE * puff;
  // Six-sided fingers read thinner than round ones; a free glove's fingers are padded, more so on a suit's thick limbs.
  const pad = 1 + (puff - 1) * 1.2;
  const girth = (b.hero ? 1 : 1.07) * (mitt ? 1.14 * pad : 1) * (s.fingerGirth ?? 1);
  const pose: HandPose = shape === 'hold' && s.fore ? foreGrip(s.fore, girth, POSES.hold.spread) : shape === 'grip' ? pistolGrip(girth) : POSES[shape];

  baseQ.setFromEuler(euler.set(pose.rot?.[0] ?? 0, pose.rot?.[1] ?? 0, pose.rot?.[2] ?? 0, 'YXZ'));
  base.compose(p.set(...(pose.at ?? [0, 0, 0])), baseQ, new THREE.Vector3(1, 1, 1));

  /** Places a part whose local Y runs along `along` and local +Z faces `facing`, both in right-hand space. */
  const place = (geometry: THREE.BufferGeometry, color: string, look: Look, at: THREE.Vector3, along: THREE.Vector3, facing: THREE.Vector3) => {
    const y = along.clone().transformDirection(base);
    const z = facing.clone().transformDirection(base);
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    z.crossVectors(x, y);
    const o = at.clone().multiplyScalar(size).applyMatrix4(base);
    if (sign < 0) {
      o.x = -o.x;
      y.x = -y.x;
      z.x = -z.x;
      x.set(-x.x, x.y, x.z).negate();
    }
    euler.setFromRotationMatrix(basis.makeBasis(x, y, z), 'YXZ');
    b.add(bone, geometry, color, { at: [o.x, o.y, o.z], rot: [euler.x, euler.y, euler.z], scale: [size, size, size], look });
  };

  // Showroom fingers are near round: close up, a squarer or coarser section reads as faceted blocks.
  const e = b.hero ? 2.1 : 2.3;
  const segment = (len: number, r: number, tip = false) =>
    S.loft(
      [
        { y: 0, rx: r, rz: r * 0.94, e },
        { y: len, rx: r * 0.94, rz: r * 0.88, e }
      ],
      radial,
      { bottom: r * 0.75, top: r * 0.8, domes: b.hero ? (tip ? 3 : 2) : 1 }
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
  orb(b, bone, 0.024, b.hero ? 12 : 8, glove, { at: wristOffset(shape, side), look: gloveLook });
  const forward = new THREE.Vector3(0, 0, -1);
  const palmSide = new THREE.Vector3(-1, 0, 0);
  // The showroom's back of the hand is domed, with a knuckle over each folded finger; a boxy palm reads as a slab close up.
  const dome = b.hero ? 1.2 : 1;
  // Its heel is thick too: seen edge on along a handle, a thin palm reads as one more finger standing out of the cuff.
  const heel = b.hero ? 1.5 : 1;
  place(
    S.loft(
      [
        { y: 0.004, rx: 0.029, rz: 0.014 * pad * dome * heel, back: 0.013 * pad * heel, e: b.hero ? 2.3 : 2.6 },
        { y: 0.036, rx: 0.042, rz: 0.0155 * pad * dome * Math.sqrt(heel), back: 0.017 * pad, cx: 0.002, e: b.hero ? 2.45 : 2.8 },
        { y: 0.072, rx: 0.0445, rz: 0.0145 * pad * dome, back: 0.014 * pad, cx: 0.001, e: b.hero ? 2.55 : 3 },
        // A padded glove's fingers are thicker than the palm's end; it swells to meet them, or they cut ragged notches in it.
        { y: 0.091, rx: 0.0435, rz: 0.0125 * pad, back: 0.0115 * pad + 0.0105 * Math.max(0, girth - 1), cx: 0.001, e: b.hero ? 2.55 + (mitt ? 0.6 : 0) : 3 }
      ],
      b.hero ? 18 : 8,
      { steps: b.hero ? 2 : 1, bottom: 0.006, top: 0.006 }
    ),
    glove,
    gloveLook,
    new THREE.Vector3(),
    forward,
    palmSide
  );
  if (b.hero && shape !== 'open' && shape !== 'relaxed') {
    const knuckle = bare ? tone(glove, 0.88) : glove;
    FINGERS.forEach((f) => place(S.blob(f.r * 2.3, 0.024, 0.011 * pad, 0.88, 14, 0), knuckle, gloveLook, new THREE.Vector3(0.0105 * pad, f.at[1] * 0.97, f.at[2] + 0.011), forward, palmSide));
  }

  FINGERS.forEach((f, i) => {
    const spread = pose.spread[i]!;
    const dir: V3 = [0, Math.sin(spread), -Math.cos(spread)];
    const r: V3 = [f.r, f.r * 0.95, f.r * 0.9];
    const from: V3 = [f.at[0] + (pose.root ?? 0), f.at[1], f.at[2]];
    // Fingerless gloves cover the first joint: a sleeve in the showroom, the whole segment on the simpler tier.
    digit(from, dir, [-1, 0, 0], f.len, r, pose.fingers[i]!, [bare && !b.hero ? gloved : tips, tips, tips], b.hero && bare);
    if (bare && b.hero) {
      p.set(...from);
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

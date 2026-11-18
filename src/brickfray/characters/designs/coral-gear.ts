import * as THREE from 'three';
import * as S from '../shapes';
import type { Look, PartSet } from '../parts';
import type { V3 } from '../skeleton';
import { cutout, mounted, rivets, sweep } from './plate-fittings';
import { join, Loft, pick, placed, tier, type Spot } from './plate-forms';

export const SUIT = '#f26b5b';
export const SEAM = '#c9493c';
export const BRASS = '#c99a3e';
export const BRONZE = '#a87a2c';
export const COPPER = '#b8733a';
export const RUBBER = '#3a3f47';
export const LEAD = '#7a828b';
const ROPE = '#dccba0';
const SHELL = '#ece5d2';

/** Brass and copper are mirror-polished in the showroom; under a match's open sky that finish turns green, so they go satin. */
export const shine = (b: PartSet): Look => (b.hero ? 'gold' : 'metal');

const ACROSS: V3 = [0, 0, Math.PI / 2];
/** Lofts built along Y and laid along the foot: their y runs toward the heel, their front faces up. */
const LAID: V3 = [Math.PI / 2, 0, 0];

/** The suit's chest: everything strapped to it is cut from, or seated on, this loft. */
export const TORSO = new Loft([
  { y: -0.072, w: 0, f: 0 },
  { y: -0.064, w: 0.14, f: 0.086, e: 0.78 },
  { y: -0.05, w: 0.167, f: 0.107, b: 0.104, e: 0.78 },
  { y: 0.04, w: 0.19, f: 0.116, b: 0.108, e: 0.75 },
  { y: 0.12, w: 0.214, f: 0.122, b: 0.114, e: 0.72 },
  { y: 0.19, w: 0.216, f: 0.116, b: 0.114, e: 0.72 },
  { y: 0.235, w: 0.18, f: 0.1, b: 0.1, e: 0.78 },
  { y: 0.27, w: 0.105, f: 0.078, b: 0.08, e: 0.9 },
  { y: 0.285, w: 0, f: 0 }
]);
const WAIST = new Loft([
  { y: -0.1, w: 0, f: 0 },
  { y: -0.085, w: 0.15, f: 0.094, e: 0.78 },
  { y: 0.02, w: 0.158, f: 0.1, e: 0.78 },
  { y: 0.11, w: 0.158, f: 0.1, e: 0.78 },
  { y: 0.15, w: 0.14, f: 0.088, e: 0.78 },
  { y: 0.165, w: 0, f: 0 }
]);
const BELT = new Loft([
  { y: 0.002, w: 0.18, f: 0.118, b: 0.116, e: 0.8 },
  { y: 0.072, w: 0.178, f: 0.116, b: 0.114, e: 0.8 }
]);

const WEIGHT: [number, number][] = [
  [-0.062, 0.052],
  [0.062, 0.052],
  [0.072, 0.036],
  [0.072, -0.03],
  [0.052, -0.06],
  [0, -0.072],
  [-0.052, -0.06],
  [-0.072, -0.03],
  [-0.072, 0.036]
];
const ANCHOR: [number, number][] = [
  [-0.005, 0.03],
  [0.005, 0.03],
  [0.005, 0.016],
  [0.02, 0.016],
  [0.02, 0.008],
  [0.005, 0.008],
  [0.005, -0.022],
  [0.017, -0.017],
  [0.026, -0.004],
  [0.034, -0.008],
  [0.024, -0.026],
  [0, -0.038],
  [-0.024, -0.026],
  [-0.034, -0.008],
  [-0.026, -0.004],
  [-0.017, -0.017],
  [-0.005, -0.022],
  [-0.005, 0.008],
  [-0.02, 0.008],
  [-0.02, 0.016],
  [-0.005, 0.016]
];

/** Canvas suit torso with its seam, the front weight on its straps and the tank harness strap. */
export function suit(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 12, 16, 28);
  const rows = q === 3 ? 2 : 1;
  b.add('chest', TORSO.mesh({ cols, rows }), SUIT, { look: 'rubber' });
  b.add('spine', WAIST.mesh({ cols, rows }), SUIT, { look: 'rubber' });
  b.add('chest', TORSO.mesh({ from: 0, to: 0.05, t0: TORSO.tAt(-0.04), t1: TORSO.tAt(0.16), cols: 1, lift: 0.004, thick: 0.004, back: false, mirror: true }), SEAM, { look: 'rubber' });

  // Front weight: a lead plate with an anchor, hung on two straps.
  const front = TORSO.point(0, TORSO.tAt(0.06), new THREE.Vector3()).z;
  b.add('chest', cutout(WEIGHT, 0.03, q >= 2 ? 0.007 : 0), LEAD, { at: [0, 0.062, front - 0.004], rot: [0, Math.PI, 0], look: 'plastic' });
  b.add('chest', TORSO.mesh({ from: 0.17, to: 0.3, t0: TORSO.tAt(0.085), t1: TORSO.tAt(0.2), cols: 1, lift: 0.006, thick: 0.005, back: false, mirror: true }), RUBBER, { look: 'rubber' });
  if (q >= 2) {
    b.add('chest', cutout(ANCHOR, 0.007, 0.002), BRASS, { at: [0, 0.064, front - 0.033], rot: [0, Math.PI, 0], scale: [1.25, 1.25, 1], look: shine(b) });
    b.mirror((_, sign) => b.box('chest', [0.036, 0.02, 0.012], BRASS, { at: [sign * 0.058, 0.118, front - 0.03], look: shine(b), bevel: 0.004 }));
    b.add('chest', TORSO.mesh({ t0: TORSO.tAt(-0.004), t1: TORSO.tAt(0.024), cols, lift: 0.005, thick: 0.005, back: false }), RUBBER, { look: 'rubber' });
  }
}

/** Copper tank on a back plate, brass bands and manifold, ribbed hoses over the shoulders to the corselet. */
export function tank(b: PartSet) {
  const q = tier(b);
  const seg = pick(b, 10, 14, 24);
  const at: V3 = [0, 0.04, 0.198];
  b.lathe(
    'chest',
    [
      [0, -0.172],
      [0.042, -0.166],
      [0.066, -0.148],
      [0.072, -0.124],
      [0.072, 0.124],
      [0.066, 0.148],
      [0.042, 0.166],
      [0.02, 0.172],
      [0.02, 0.19],
      [0, 0.19]
    ],
    COPPER,
    { at, look: shine(b), seg }
  );
  b.box('chest', [0.19, 0.25, 0.022], RUBBER, { at: [0, 0.05, 0.124], look: 'rubber' });
  for (const y of [-0.085, 0.085]) b.cyl('chest', 0.0755, 0.0755, 0.022, BRASS, { at: [0, at[1] + y, at[2]], look: shine(b), seg, open: true });
  b.box('chest', [0.09, 0.032, 0.044], BRASS, { at: [0, 0.242, 0.196], look: shine(b), bevel: 0.006 });
  if (q >= 2) {
    b.cyl('chest', 0.008, 0.008, 0.03, BRONZE, { at: [0, 0.27, 0.196], look: 'metal', seg: 6 });
    b.cyl('chest', 0.026, 0.026, 0.008, BRONZE, { at: [0, 0.288, 0.196], look: 'metal', seg: pick(b, 8, 10, 16) });
  }
  b.mirror((_, sign) => {
    const path: V3[] = [
      [sign * 0.046, 0.244, 0.196],
      [sign * 0.112, 0.3, 0.172],
      [sign * 0.168, 0.326, 0.09],
      [sign * 0.178, 0.312, 0],
      [sign * 0.152, 0.278, -0.052],
      [sign * 0.126, 0.25, -0.08]
    ];
    const ribs = 17;
    b.add('chest', sweep(path, q === 3 ? (t) => 0.0145 + 0.003 * Math.max(0, Math.cos(t * ribs * Math.PI * 2)) : 0.016, { seg: q === 3 ? ribs * 4 : pick(b, 6, 10, 0), radial: pick(b, 5, 6, 8) }), RUBBER, { look: 'rubber' });
    if (q >= 2) {
      b.cyl('chest', 0.021, 0.021, 0.022, BRASS, { at: [sign * 0.052, 0.249, 0.194], rot: [0.9, sign * 1.92, 0], look: shine(b), seg: pick(b, 6, 8, 12) });
      b.cyl('chest', 0.022, 0.022, 0.026, BRASS, { at: [sign * 0.13, 0.254, -0.076], rot: [0.94, sign * 0.75, 0], look: shine(b), seg: pick(b, 6, 8, 12) });
    }
  });
  if (q === 3) b.add('chest', barnacles([[0.05, -0.1, 0.25], [0.066, -0.075, 0.228], [0.036, -0.128, 0.256]], [0.4, 0, 1], [1, 0.75, 1.15]), SHELL, { look: 'plastic' });
}

/** A cluster of barnacles at the given points, opening along `out`. */
function barnacles(points: V3[], out: V3, sizes: number[]) {
  const n = new THREE.Vector3(...out).normalize();
  const cone = new THREE.LatheGeometry(
    [
      [0.013, 0],
      [0.008, 0.01],
      [0.0055, 0.01],
      [0.004, 0.004]
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    8
  );
  return join(...points.map((p, i) => mounted([[new THREE.Vector3(...p), n]], placed(cone, [0, 0, 0], [0, i * 1.3, 0], [sizes[i]!, sizes[i]!, sizes[i]!]))));
}

/** Weighted belt with a brass buckle, the coiled line on the right hip. */
export function belt(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 12, 16, 28);
  b.add('pelvis', BELT.mesh({ cols, thick: 0.012, back: false }), RUBBER, { look: 'rubber' });
  const mid = 0.5;
  const blocks = BELT.spots(
    [0.62, -0.62, 2.0, -2.0, 2.68, -2.68].map((a) => [a, mid] as [number, number]),
    0.006
  );
  b.add('pelvis', mounted(blocks, S.box(0.066, 0.032, 0.078, q >= 2 ? 0.009 : 0)), LEAD, { look: 'plastic' });
  const frame: [number, number][] = [
    [-0.044, -0.036],
    [0.044, -0.036],
    [0.044, 0.036],
    [-0.044, 0.036]
  ];
  b.add('pelvis', cutout(frame, 0.014, q >= 2 ? 0.004 : 0, [frame.map(([x, y]) => [x * 0.66, y * 0.6] as [number, number])]), BRASS, { at: [0, 0.037, -0.119], rot: [0, Math.PI, 0], look: shine(b) });
  if (q >= 2) {
    b.box('pelvis', [0.01, 0.05, 0.012], BRASS, { at: [0, 0.037, -0.128], look: shine(b), bevel: 0.003 });
    b.add('pelvis', rivets(BELT.spots([0.62, -0.62, 2.0, -2.0, 2.68, -2.68].map((a) => [a, mid] as [number, number]), 0.022), 0.008, pick(b, 5, 6, 8)), BRASS, { look: shine(b) });
  }

  // Coiled line: three loops of rope hung from the belt by a strap.
  const loop = (r: number, x: number, lean: number): V3[] =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return [0.202 + x + Math.sin(a) * lean, -0.058 + Math.cos(a) * r, 0.006 + Math.sin(a) * r * 0.92];
    });
  const loops: [number, number, number][] = q >= 2 ? [[0.06, 0, 0.004], [0.054, 0.014, -0.006], [0.063, 0.024, 0.002]] : [[0.058, 0.01, 0]];
  for (const [r, x, lean] of loops) b.add('pelvis', sweep(loop(r, x, lean), q >= 2 ? 0.0095 : 0.014, { seg: pick(b, 8, 12, 24), radial: pick(b, 4, 5, 7), loop: true, up: [1, 0, 0] }), ROPE, { look: 'cloth' });
  b.box('pelvis', [0.05, 0.05, 0.018], RUBBER, { at: [0.2, 0.004, 0.006], rot: [0, Math.PI / 2, 0], look: 'rubber', bevel: 0.004 });
  if (q >= 2) b.cyl('pelvis', 0.014, 0.014, 0.05, BRASS, { at: [0.214, -0.114, 0.006], rot: ACROSS, look: shine(b), seg: pick(b, 6, 8, 12) });
}

const SHEATH = new Loft([
  { y: -0.156, w: 0.005, f: 0.008, e: 0.7 },
  { y: -0.142, w: 0.011, f: 0.02, e: 0.7 },
  { y: -0.02, w: 0.012, f: 0.022, e: 0.7 },
  { y: -0.008, w: 0.015, f: 0.026, e: 0.7 },
  { y: 0.004, w: 0.015, f: 0.026, e: 0.7 },
  { y: 0.006, w: 0, f: 0 }
]);

/** Patches, wrist clamps, and the knife strapped to the left thigh. */
export function fittings(b: PartSet) {
  const q = tier(b);
  const seg = pick(b, 8, 12, 20);
  b.mirror((side, sign) => {
    const fa = `forearm${side}` as const;
    const sh = `shin${side}` as const;
    const round = pick(b, 6, 10, 18);
    b.add(sh, S.blob(0.112, 0.124, 0.056, 0.62, round, 0), SEAM, { at: [0, -0.006, -0.05], look: 'rubber' });
    b.add(fa, S.blob(0.094, 0.1, 0.05, 0.62, round, 0), SEAM, { at: [0, -0.008, 0.03], look: 'rubber' });
    b.cyl(fa, 0.0605, 0.0605, 0.016, BRASS, { at: [0, -0.212, 0], look: shine(b), seg, open: true });
    if (q >= 2) {
      b.box(fa, [0.02, 0.022, 0.018], BRASS, { at: [sign * 0.062, -0.212, 0], look: shine(b), bevel: 0.004 });
      b.cyl(`shin${side}`, 0.062, 0.058, 0.02, SEAM, { at: [0, -0.3, 0.002], look: 'rubber', seg, open: true });
    }
  });
  if (q < 2) return;

  // Raised seams down the outside of each limb; the radii follow the body's limbs at Coral's thickness.
  const seams: [string, [number, number][]][] = [
    ['upperArm', [[-0.07, 0.0655], [-0.12, 0.061], [-0.19, 0.056], [-0.25, 0.0525]]],
    ['forearm', [[-0.06, 0.053], [-0.1, 0.0545], [-0.15, 0.051], [-0.195, 0.047]]],
    ['thigh', [[-0.07, 0.0915], [-0.17, 0.089], [-0.3, 0.077], [-0.4, 0.069]]],
    ['shin', [[-0.08, 0.0655], [-0.14, 0.067], [-0.22, 0.059], [-0.29, 0.054]]]
  ];
  b.mirror((side, sign) => {
    for (const [bone, line] of q === 3 ? seams : seams.filter(([bone]) => bone === 'upperArm' || bone === 'thigh')) {
      const path = line.map(([y, r]) => [sign * (r + 0.0005), y, 0] as V3);
      b.add(`${bone}${side}` as 'thighL', sweep(path, () => [0.0055, 0.003], { seg: pick(b, 3, 4, 8), radial: pick(b, 4, 4, 6), up: [sign, 0, 0] }), SEAM, { look: 'rubber' });
    }
  });

  const x = -0.107;
  for (const [y, r] of [
    [-0.14, 0.0945],
    [-0.27, 0.0855]
  ] as const) {
    b.cyl('thighL', r, r - 0.003, 0.02, RUBBER, { at: [0, y, -0.004], scale: [1, 1, 1.04], look: 'rubber', seg, open: true });
  }
  const tilt: V3 = [0, 0, -0.06];
  b.add('thighL', SHEATH.mesh({ cols: pick(b, 6, 8, 12) }), BRASS, { at: [x, -0.135, 0], rot: tilt, look: shine(b) });
  b.box('thighL', [0.02, 0.012, 0.064], BRONZE, { at: [x + 0.001, -0.125, 0], rot: tilt, look: 'metal', bevel: 0.003 });
  b.cyl('thighL', 0.0115, 0.013, 0.075, '#8a5a34', { at: [x + 0.003, -0.082, 0], rot: tilt, look: 'plastic', seg: pick(b, 6, 8, 12) });
  b.ball('thighL', 0.0165, BRASS, { at: [x + 0.006, -0.04, 0], look: shine(b) });
}

const UPPER = new Loft([
  { y: -0.136, w: 0, f: 0, b: 0 },
  { y: -0.128, w: 0.066, f: 0.05, b: 0.014, e: 0.8 },
  { y: -0.07, w: 0.069, f: 0.064, b: 0.014, e: 0.8 },
  { y: -0.02, w: 0.068, f: 0.09, b: 0.014, e: 0.8 },
  { y: 0.04, w: 0.066, f: 0.094, b: 0.014, e: 0.8 },
  { y: 0.085, w: 0.058, f: 0.078, b: 0.014, e: 0.8 },
  { y: 0.104, w: 0.034, f: 0.05, b: 0.012, e: 0.8 },
  { y: 0.11, w: 0, f: 0, b: 0 }
]);
const CAP = new Loft([
  { y: -0.108, w: 0, f: 0, b: 0 },
  { y: -0.1, w: 0.04, f: 0.032, b: 0.012, e: 0.8 },
  { y: -0.07, w: 0.066, f: 0.05, b: 0.014, e: 0.8 },
  { y: -0.02, w: 0.072, f: 0.057, b: 0.014, e: 0.8 },
  { y: 0.014, w: 0.07, f: 0.056, b: 0.014, e: 0.8 },
  { y: 0.02, w: 0, f: 0, b: 0 }
]);
const SOLE = new Loft([
  { y: -0.136, w: 0, f: 0 },
  { y: -0.13, w: 0.077, f: 0.017, e: 0.5 },
  { y: 0.09, w: 0.074, f: 0.017, e: 0.5 },
  { y: 0.112, w: 0.05, f: 0.017, e: 0.5 },
  { y: 0.118, w: 0, f: 0 }
]);
const TOE_SOLE = new Loft([
  { y: -0.116, w: 0, f: 0 },
  { y: -0.108, w: 0.048, f: 0.017, e: 0.5 },
  { y: -0.08, w: 0.074, f: 0.017, e: 0.5 },
  { y: 0.016, w: 0.077, f: 0.017, e: 0.5 },
  { y: 0.022, w: 0, f: 0 }
]);

/** Heavy boots: brass uppers with a copper toe cap, lead soles, instep straps, a riveted ankle ring. */
export function boots(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 8, 10, 18);
  const rows = q === 3 ? 3 : 1;
  const stud = pick(b, 5, 6, 8);
  b.mirror((side, sign) => {
    const ft = `foot${side}` as const;
    const toe = `toe${side}` as const;
    const laid = { at: [0, -0.048, 0] as V3, rot: LAID };
    b.add(ft, UPPER.mesh({ cols, rows }), BRASS, { ...laid, look: shine(b) });
    b.add(ft, SOLE.mesh({ cols }), LEAD, { at: [0, -0.068, 0], rot: LAID, look: 'plastic' });
    b.lathe(
      ft,
      [
        [0.066, -0.03],
        [0.068, 0.07],
        [0.076, 0.082],
        [0.076, 0.096],
        [0.064, 0.1],
        [0.05, 0.094]
      ],
      BRASS,
      { at: [0, 0, 0.012], look: shine(b), seg: cols + 2 }
    );
    b.add(toe, CAP.mesh({ cols, rows }), COPPER, { at: [0, 0.007, 0], rot: LAID, look: shine(b) });
    b.add(toe, TOE_SOLE.mesh({ cols }), LEAD, { at: [0, -0.013, 0], rot: LAID, look: 'plastic' });
    if (q < 2) return;

    for (const [y0, y1] of [
      [-0.104, -0.078],
      [-0.03, -0.004]
    ]) {
      b.add(ft, UPPER.mesh({ from: -1.75, to: 1.75, t0: UPPER.tAt(y0), t1: UPPER.tAt(y1), cols: cols - 2, lift: 0.005, thick: 0.005, back: false }), RUBBER, { ...laid, look: 'rubber' });
    }
    const buckles: Spot[] = UPPER.spots(
      [
        [sign * 1.05, UPPER.tAt(-0.091)],
        [sign * 1.05, UPPER.tAt(-0.017)]
      ],
      0.006
    );
    b.add(ft, mounted(buckles, S.box(0.024, 0.008, 0.03, 0.003)), BRONZE, { ...laid, look: 'metal' });
    const ring: Spot[] = Array.from({ length: 8 }, (_, i) => {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      return [new THREE.Vector3(Math.sin(a) * 0.076, 0.089, 0.012 - Math.cos(a) * 0.076), new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))];
    });
    b.add(ft, rivets(ring, 0.0065, stud), BRONZE, { look: 'metal' });
    b.add(toe, CAP.mesh({ t0: CAP.tAt(-0.006), t1: CAP.tAt(0.014), cols, lift: 0.004, thick: 0.004, back: false }), BRASS, { at: [0, 0.007, 0], rot: LAID, look: shine(b) });
    if (q === 3 && sign < 0) b.add(toe, barnacles([[-0.03, 0.05, -0.05], [-0.012, 0.058, -0.066]], [-0.3, 1, -0.3], [0.9, 0.7]), SHELL, { look: 'plastic' });
  });
}

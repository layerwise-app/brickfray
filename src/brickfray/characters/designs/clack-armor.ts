import * as THREE from 'three';
import type { PartSet } from '../parts';
import type { V3 } from '../skeleton';
import { cutout, rivets } from './plate-fittings';
import { Loft, pick, surface, tier, type Spot } from './plate-forms';

export const STEEL = '#b9c0c8';
export const DARK_STEEL = '#7d848c';
export const SHADOW = '#2a2e35';
export const MAIL = '#6b737b';
export const RED = '#c8231b';
export const RED_LIGHT = '#e0402f';
export const GOLD = '#d4a640';
export const LEATHER = '#5b3a24';

const ACROSS: V3 = [0, 0, Math.PI / 2];
/** Half angle of the tabard strip down the front and back. */
const TABARD = 0.5;
const UNIT = new THREE.Vector3(1, 1, 1);
/** Pulls the belt's top edge in to the fauld, closing the gap seen from above. */
const INSET = new THREE.Vector3(0.86, 1, 0.78);

const TORSO = new Loft([
  { y: -0.1, w: 0.166, f: 0.118, b: 0.112, e: 0.8 },
  { y: -0.07, w: 0.16, f: 0.112, b: 0.106, e: 0.8, keel: 0.01 },
  { y: 0.02, w: 0.196, f: 0.136, b: 0.112, e: 0.78, keel: 0.012 },
  { y: 0.1, w: 0.228, f: 0.146, b: 0.12, e: 0.75, keel: 0.008 },
  { y: 0.17, w: 0.226, f: 0.132, b: 0.118, e: 0.75, keel: 0.006 },
  { y: 0.218, w: 0.19, f: 0.106, b: 0.106, e: 0.8, keel: 0.002 },
  { y: 0.25, w: 0.112, f: 0.086, b: 0.09, e: 0.9 }
]);
const WAIST = new Loft([
  { y: -0.06, w: 0.152, f: 0.103, b: 0.1, e: 0.8 },
  { y: 0.02, w: 0.146, f: 0.1, b: 0.097, e: 0.8 },
  { y: 0.09, w: 0.14, f: 0.092, b: 0.076, e: 0.8 }
]);
const HIPS = new Loft([
  { y: -0.165, w: 0, f: 0 },
  { y: -0.15, w: 0.07, f: 0.065, e: 0.8 },
  { y: -0.11, w: 0.125, f: 0.09, e: 0.8 },
  { y: -0.04, w: 0.156, f: 0.1, e: 0.8 },
  { y: 0.05, w: 0.152, f: 0.1, e: 0.8 }
]);
const FAULD = new Loft([
  { y: -0.088, w: 0.2, f: 0.136, b: 0.13, e: 0.8 },
  { y: -0.04, w: 0.19, f: 0.128, b: 0.123, e: 0.8 },
  { y: 0.005, w: 0.176, f: 0.116, b: 0.11, e: 0.8 },
  { y: 0.05, w: 0.162, f: 0.107, b: 0.103, e: 0.8 }
]);
const BELT = new Loft([
  { y: 0.014, w: 0.184, f: 0.149, b: 0.143, e: 0.8 },
  { y: 0.058, w: 0.18, f: 0.146, b: 0.14, e: 0.8 }
]);

const TOWER: [number, number][] = [
  [-0.034, -0.042],
  [0.034, -0.042],
  [0.034, -0.032],
  [0.026, -0.029],
  [0.026, 0.014],
  [0.036, 0.02],
  [0.036, 0.044],
  [0.022, 0.044],
  [0.022, 0.031],
  [0.008, 0.031],
  [0.008, 0.044],
  [-0.008, 0.044],
  [-0.008, 0.031],
  [-0.022, 0.031],
  [-0.022, 0.044],
  [-0.036, 0.044],
  [-0.036, 0.02],
  [-0.026, 0.014],
  [-0.026, -0.029],
  [-0.034, -0.032]
];
const DOOR: [number, number][] = [
  [-0.009, -0.034],
  [0.009, -0.034],
  [0.009, -0.014],
  [0.005, -0.005],
  [0, -0.002],
  [-0.005, -0.005],
  [-0.009, -0.014]
];

/** Both sides of a run of spots on a loft that is symmetric about the centerline. */
function pair(loft: Loft, a0: number, t0: number, a1: number, t1: number, n: number, lift = 0): Spot[] {
  return [...loft.row(a0, t0, a1, t1, n, lift), ...loft.row(-a0, t0, -a1, t1, n, lift)];
}

/** Breastplate with a ridge, the tabard strip and its device, gorget, waist lames, fauld and belt. */
export function cuirass(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 6, 9, 16);
  const rows = q === 3 ? 3 : 1;
  const strip = pick(b, 2, 3, 5);
  const ring = pick(b, 10, 16, 28);
  const stud = pick(b, 5, 5, 8);

  b.add('chest', TORSO.mesh({ from: 0, to: Math.PI, cols, rows, thick: 0.02, back: false, mirror: true }), STEEL, { look: 'metal' });
  // Tabard: a bib front and back that ends in a point above the waist, edged in gold.
  const neck = TORSO.tAt(0.246);
  for (const back of [false, true]) {
    const panel = (inner: number, outer: number) => (t: number): [number, number] => {
      const reach = TABARD * Math.min(1, 0.04 + t * 4.5);
      return back ? [Math.PI - reach - outer, Math.PI - Math.max(0, reach - inner)] : [Math.max(0, reach - inner), reach + outer];
    };
    const top = back ? TORSO.tAt(0.208) : neck;
    b.add('chest', TORSO.mesh({ t0: 1, t1: top, cols: strip, rows, lift: 0.012, thick: 0.008, back: false, mirror: true, cut: panel(9, 0) }), RED, { look: 'cloth' });
    if (q < 2) continue;
    b.add('chest', TORSO.mesh({ t0: 1, t1: top, cols: 1, rows, lift: 0.0155, thick: 0.004, back: false, mirror: true, cut: panel(0.05, 0.012) }), GOLD, { look: 'gold' });
    if (back) b.add('chest', TORSO.mesh({ from: Math.PI - TABARD - 0.012, to: Math.PI, t0: top - 0.17, t1: top + 0.02, cols: strip, lift: 0.0155, thick: 0.004, back: false, mirror: true }), GOLD, { look: 'gold' });
  }
  const front = TORSO.point(0, TORSO.tAt(0.1), new THREE.Vector3()).z;
  b.add('chest', cutout(TOWER, 0.012, q === 3 ? 0.003 : 0, q >= 2 ? [DOOR] : []), GOLD, { at: [0, 0.098, front - 0.006], rot: [0, Math.PI, 0], look: 'gold' });
  if (q >= 2) {
    const shield: [number, number][] = [
      [-0.064, 0.07],
      [0.064, 0.07],
      [0.064, 0.004],
      [0.05, -0.044],
      [0, -0.084],
      [-0.05, -0.044],
      [-0.064, 0.004]
    ];
    const inner = shield.map(([x, y]) => [x * 0.84, y * 0.86 - 0.001] as [number, number]);
    b.add('chest', cutout(shield, 0.008, q === 3 ? 0.002 : 0, [inner]), GOLD, { at: [0, 0.098, front - 0.005], rot: [0, Math.PI, 0], look: 'gold' });
    b.add('chest', TORSO.mesh({ from: 0, to: Math.PI, t0: 0.02, t1: 0.42, cols, lift: 0.006, thick: 0.006, back: false, mirror: true }), STEEL, { look: 'metal' });
    b.add('chest', rivets([...pair(TORSO, 0.82, 1.3, 0.98, 4.1, q === 3 ? 5 : 4), ...pair(TORSO, 0.85, 0.2, 2.45, 0.2, q === 3 ? 6 : 4, 0.006)], 0.0065, stud), GOLD, { look: 'gold' });
  }

  // Gorget over a mail collar.
  b.lathe(
    'chest',
    q === 3
      ? [
          [0.128, 0.224],
          [0.115, 0.243],
          [0.118, 0.247],
          [0.103, 0.268],
          [0.106, 0.272],
          [0.092, 0.292],
          [0.092, 0.304],
          [0.098, 0.31],
          [0.086, 0.316],
          [0.07, 0.312]
        ]
      : [
          [0.128, 0.224],
          [0.092, 0.292],
          [0.094, 0.312],
          [0.07, 0.312]
        ],
    STEEL,
    { look: 'metal', seg: ring }
  );
  if (q === 3) b.torus('chest', 0.098, 0.006, GOLD, { at: [0, 0.31, 0], rot: [Math.PI / 2, 0, 0], look: 'gold' });
  b.cyl('neck', 0.064, 0.072, 0.13, MAIL, { at: [0, 0.015, 0], look: 'metal', seg: pick(b, 8, 12, 20) });

  // Waist: lames over a dark underlayer.
  if (q >= 2) {
    b.add('spine', WAIST.mesh({ cols: ring, lift: -0.004 }), SHADOW, { look: 'metal' });
    [0, 1, 2].forEach((i) => b.add('spine', WAIST.mesh({ cols: ring, t0: i * 0.62, t1: i * 0.62 + 0.76, lift: 0.002 + i * 0.003, thick: 0.006, back: false }), STEEL, { look: 'metal' }));
  } else b.add('spine', WAIST.mesh({ cols: ring, lift: 0.004 }), STEEL, { look: 'metal' });

  // Hips in mail, a three-lame fauld, the tabard skirt front and back.
  b.add('pelvis', HIPS.mesh({ cols: ring, rows: q === 3 ? 2 : 1 }), MAIL, { look: 'metal' });
  if (q >= 2) [0, 1, 2].forEach((i) => b.add('pelvis', FAULD.mesh({ cols: ring, t0: i * 0.95, t1: i * 0.95 + 1.1, lift: i * 0.003, thick: 0.008, back: q === 3 }), STEEL, { look: 'metal' }));
  else b.add('pelvis', FAULD.mesh({ cols: ring, thick: 0.008, back: false }), STEEL, { look: 'metal' });
  for (const s of [-1, 1]) {
    b.add('pelvis', skirt(s, 0, 1, 0, strip * 2, pick(b, 2, 3, 6)), RED, { look: 'cloth' });
    if (q >= 2) b.add('pelvis', skirt(s, 0, 0.12, 0.004, strip * 2, 1), GOLD, { look: 'gold' });
  }

  // Belt with a framed buckle and a hanging strap end.
  b.add('pelvis', BELT.mesh({ cols: ring, thick: 0.012, back: false }), LEATHER, { look: 'cloth' });
  const shelf = surface(ring, 1, (u, v, out) => BELT.point(u * Math.PI * 2, 1, out).multiply(v ? INSET : UNIT), { closed: true, inward: true });
  b.add('pelvis', shelf, SHADOW, { look: 'rubber' });
  const buckle: [number, number][] = [
    [-0.036, -0.03],
    [0.036, -0.03],
    [0.036, 0.03],
    [-0.036, 0.03]
  ];
  b.add('pelvis', cutout(buckle, 0.012, q >= 2 ? 0.003 : 0, [buckle.map(([x, y]) => [x * 0.64, y * 0.6] as [number, number])]), GOLD, { at: [0, 0.036, -0.15], rot: [0, Math.PI, 0], look: 'gold' });
  if (q >= 2) {
    b.box('pelvis', [0.008, 0.044, 0.01], GOLD, { at: [0.004, 0.036, -0.159], look: 'gold', bevel: 0.002 });
    b.box('pelvis', [0.034, 0.1, 0.008], LEATHER, { at: [-0.05, -0.012, -0.157], rot: [0.06, 0, 0.1], look: 'cloth', bevel: 0.003 });
    b.box('pelvis', [0.036, 0.016, 0.01], GOLD, { at: [-0.055, -0.056, -0.16], rot: [0.06, 0, 0.1], look: 'gold', bevel: 0.003 });
  }
}

/**
 * Tabard skirt panel hanging from the belt: `s` -1 front, 1 back; v0…v1 picks
 * a band of it from the hem up (the gold hem is the same panel, lifted).
 */
function skirt(s: number, v0: number, v1: number, lift: number, nu: number, nv: number) {
  return surface(
    nu,
    nv,
    (u, v, out) => {
      const x = u * 2 - 1;
      const up = v0 + (v1 - v0) * v;
      const down = 1 - up;
      const hem = -0.262 - 0.04 * (1 - Math.abs(x));
      const wide = x * (0.094 + 0.022 * down);
      const round = (1 - (Math.abs(wide) / 0.2) ** 2.5) ** 0.4;
      out.set(wide, hem + (0.03 - hem) * up, s * (((s < 0 ? 0.136 : 0.13) + 0.055 * down) * round + lift));
    },
    { thick: 0.006, inward: s < 0 }
  );
}

const SCABBARD = new Loft([
  { y: -0.47, w: 0.004, f: 0.006, e: 0.6 },
  { y: -0.45, w: 0.01, f: 0.018, e: 0.6 },
  { y: -0.2, w: 0.012, f: 0.027, e: 0.6 },
  { y: 0, w: 0.014, f: 0.032, e: 0.6 }
]);

/** Slanted sword belt and the scabbard on the left hip; `drawn` leaves the scabbard empty. */
export function swordBelt(b: PartSet, drawn: boolean) {
  const q = tier(b);
  const ring = pick(b, 10, 16, 28);
  const hang: V3 = [-0.6, 0, -0.07];
  const mouth = new THREE.Vector3(-0.218, -0.035, -0.03);
  const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(hang[0], hang[1], hang[2], 'YXZ'));
  const along = (d: number) => mouth.clone().addScaledVector(dir, d).toArray() as V3;
  b.add('pelvis', BELT.mesh({ cols: ring, t0: 0.2, t1: 0.8, lift: 0.006, thick: 0.006, back: false }), LEATHER, { at: [0, -0.03, 0], rot: [0, 0, 0.2], look: 'cloth' });
  b.add('pelvis', SCABBARD.mesh({ cols: pick(b, 6, 8, 12) }), '#3f2718', { at: along(0), rot: hang, look: 'plastic' });
  if (q >= 2) {
    for (const [t0, t1] of [
      [0, 0.9],
      [1.9, 2.05],
      [2.72, 3]
    ]) {
      b.add('pelvis', SCABBARD.mesh({ cols: pick(b, 6, 8, 12), t0, t1, lift: 0.003 }), GOLD, { at: along(0), rot: hang, look: 'gold' });
    }
  }
  if (drawn) return;
  b.box('pelvis', [0.026, 0.02, 0.15], GOLD, { at: along(0.012), rot: hang, look: 'gold' });
  b.cyl('pelvis', 0.0125, 0.0125, 0.1, RED, { at: along(0.072), rot: hang, look: 'cloth', seg: pick(b, 6, 8, 12) });
  b.ball('pelvis', 0.021, GOLD, { at: along(0.135), rot: hang, scale: [0.75, 1, 1], look: 'gold' });
}

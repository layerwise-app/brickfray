import * as THREE from 'three';
import * as S from '../shapes';
import type { PartSet } from '../parts';
import type { V3 } from '../skeleton';
import { GOLD, RED, RED_LIGHT, SHADOW, STEEL } from './clack-armor';
import { mounted, rivets, sweep } from './plate-fittings';
import { Loft, pick, surface, symmetric, tier } from './plate-forms';

const ACROSS: V3 = [0, 0, Math.PI / 2];

const SKULL = new Loft([
  { y: -0.038, w: 0.1, f: 0.106, b: 0.116, e: 0.9 },
  { y: -0.015, w: 0.11, f: 0.12, b: 0.118, e: 0.9 },
  { y: 0.035, w: 0.13, f: 0.14, b: 0.134, e: 0.88 },
  { y: 0.1, w: 0.139, f: 0.146, b: 0.146, e: 0.88 },
  { y: 0.17, w: 0.131, f: 0.136, b: 0.142, e: 0.9 },
  { y: 0.226, w: 0.1, f: 0.104, b: 0.112, e: 0.95 },
  { y: 0.256, w: 0.052, f: 0.055, b: 0.06 },
  { y: 0.266, w: 0, f: 0 }
]);
/** The visor rides just outside the skull and comes to a prow down the middle. */
const VISOR = new Loft(
  [
    { y: -0.038, w: 0.107, f: 0.116, keel: 0.004, e: 0.9 },
    { y: 0, w: 0.128, f: 0.139, keel: 0.02, e: 0.9 },
    { y: 0.04, w: 0.14, f: 0.151, keel: 0.032, e: 0.9 },
    { y: 0.075, w: 0.144, f: 0.153, keel: 0.024, e: 0.9 },
    { y: 0.1, w: 0.146, f: 0.155, keel: 0.004, e: 0.9 },
    { y: 0.14, w: 0.142, f: 0.151, e: 0.9 },
    { y: 0.165, w: 0.137, f: 0.145, e: 0.9 }
  ],
  0.5
);
const REACH = 1.72;
const smooth = THREE.MathUtils.smoothstep;
/** Bottom edge of the brow plate: a stern V over the eyes that closes the slit toward the temples. */
const brow = (a: number) => 0.093 - 0.009 * (1 - smooth(a, 0, 0.55)) - 0.027 * smooth(a, 0.85, 1.3);
/** Top edge of the lower visor: the eye slit's sill, rising into a nasal bar that tucks just under the brow plate. */
const sill = (a: number) => Math.min(0.066 + 0.04 * (1 - smooth(a, 0.03, 0.15)), brow(a) + 0.004);

/** One half of a visor plate between two edges that vary with the angle, mirrored into a whole. */
function visorPlate(lower: (a: number) => number, upper: (a: number) => number, cols: number, rows: number, lift = 0, thick = 0.008) {
  const n = new THREE.Vector3();
  const half = surface(
    cols,
    rows,
    (u, v, out) => {
      const a = u * REACH;
      const t = VISOR.tAt(lower(a) + (upper(a) - lower(a)) * v);
      VISOR.point(a, t, out);
      if (lift) out.addScaledVector(VISOR.normal(a, t, n), lift);
    },
    { thick, back: false, inward: true, butt: [true, false] }
  );
  return symmetric(half);
}

/** Armet: egg skull with a comb, a prowed visor with two eye slits and breaths, pivot bolts, gold brow. */
export function helm(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 12, 18, 32);
  const half = pick(b, 5, 8, 24);
  const stud = pick(b, 5, 5, 12);
  b.add('head', SKULL.mesh({ cols, rows: q === 3 ? 4 : 1, thick: 0.014, back: false }), STEEL, { look: 'metal' });
  b.add('head', visorPlate((a) => sill(a) - 0.014, (a) => brow(a) + 0.016, half, 2, -0.009, 0), SHADOW, { look: 'rubber' });
  b.add('head', visorPlate(() => -0.036, sill, half, pick(b, 2, 3, 14)), STEEL, { look: 'metal' });
  b.add('head', visorPlate(brow, () => 0.156, half, pick(b, 1, 2, 6)), STEEL, { look: 'metal' });

  // Pivot bolts.
  b.mirror((_, sign) => {
    b.cyl('head', 0.024, 0.027, 0.014, q >= 2 ? GOLD : STEEL, { at: [sign * 0.149, 0.088, 0.006], rot: ACROSS, look: q >= 2 ? 'gold' : 'metal', seg: pick(b, 8, 12, 20) });
    if (q >= 2) b.dome('head', 0.012, STEEL, { at: [sign * 0.155, 0.088, 0.006], rot: [0, 0, sign * -Math.PI / 2], look: 'metal' });
  });
  if (q < 2) return;

  b.add('head', visorPlate(brow, (a) => brow(a) + 0.012, half, 1, 0.004, 0.004), GOLD, { look: 'gold' });
  b.add('head', SKULL.mesh({ cols, t0: 0, t1: 0.4, lift: 0.0045, thick: 0.005, back: false }), GOLD, { look: 'gold' });
  const breaths = [0.52, 0.66, 0.8, 0.94].slice(0, q === 3 ? 4 : 3).flatMap((a) => [a, -a]);
  b.add('head', mounted(VISOR.spots(breaths.map((a) => [a, VISOR.tAt(0.018)] as [number, number])), S.box(0.0075, 0.004, 0.036, 0)), SHADOW, { look: 'rubber' });
  const top = VISOR.tAt(0.146);
  const edge = (sign: number) => VISOR.row(sign * 1.6, VISOR.tAt(-0.012), sign * 1.6, VISOR.tAt(0.05), 3);
  b.add('head', rivets([...VISOR.row(-1.5, top, 1.5, top, 9), ...(q === 3 ? [...edge(1), ...edge(-1)] : [])], 0.006, stud), GOLD, { look: 'gold' });

  // Comb from the brow over the crown to the nape.
  const pole = SKULL.spans;
  const ridge = [...SKULL.path([[0, SKULL.tAt(0.168)], [0, pole]], 0.002, 6).slice(0, -1), ...SKULL.path([[Math.PI, pole], [Math.PI, SKULL.tAt(0.03)]], 0.002, 8)];
  b.add('head', sweep(ridge, (t) => [0.013, 0.003 + 0.009 * Math.sin(Math.PI * Math.min(1, t * 1.06)) ** 0.5], { seg: pick(b, 8, 12, 24), radial: pick(b, 5, 6, 8), up: [0, 0, -1] }), STEEL, { look: 'metal' });
  if (q === 3) nape(b, stud);
}

/** The back of the armet: a nape plate riveted on under the crown with a gilt upper edge, and a rondel on a short stem. */
function nape(b: PartSet, stud: number) {
  const [t0, t1] = [SKULL.tAt(-0.02), SKULL.tAt(0.075)];
  const back = { from: 1.6, to: Math.PI, cols: 16, back: false, mirror: true };
  b.add('head', SKULL.mesh({ ...back, t0, t1, rows: 4, lift: 0.004, thick: 0.005 }), STEEL, { look: 'metal' });
  b.add('head', SKULL.mesh({ ...back, t0: t1 - 0.14, t1, rows: 1, lift: 0.0088, thick: 0.003 }), GOLD, { look: 'gold' });
  const row = SKULL.tAt(0.058);
  b.add('head', rivets(SKULL.row(Math.PI - 1.35, row, Math.PI + 1.35, row, 9, 0.009), 0.0055, stud), GOLD, { look: 'gold' });
  const at: [number, number][] = [[Math.PI, SKULL.tAt(0.022)]];
  b.add('head', mounted(SKULL.spots(at, 0.009), new THREE.CylinderGeometry(0.007, 0.009, 0.012, 12)), STEEL, { look: 'metal' });
  b.add('head', mounted(SKULL.spots(at, 0.016), new THREE.CylinderGeometry(0.028, 0.028, 0.005, 32)), GOLD, { look: 'gold' });
  b.add('head', rivets(SKULL.spots(at, 0.0185), 0.02, 24, 0.45), STEEL, { look: 'metal' });

  // Fluting fanning down the back of the skull from beside the comb to the nape plate, each flute swelling out of the
  // surface and sinking back in at its ends.
  const [high, low] = [SKULL.tAt(0.214), SKULL.tAt(0.09)];
  for (const k of [1, 2, 3]) {
    for (const sign of [-1, 1]) {
      const [a0, a1] = [Math.PI + sign * 0.2 * k, Math.PI + sign * 0.44 * k];
      const mid = (a0 + a1) / 2;
      const flute = SKULL.path([[a0, high], [a1, low]], 0, 10);
      b.add('head', sweep(flute, (t) => [0.012 - 0.003 * t, 0.0034 * Math.sin(Math.PI * t) ** 0.9], { seg: 18, radial: 10, up: [Math.sin(mid), 0, -Math.cos(mid)] }), STEEL, { look: 'metal' });
    }
  }
}

const LOCK: V3[] = [
  [0, 0.012, 0],
  [0, 0.1, -0.012],
  [0, 0.19, 0.03],
  [0, 0.236, 0.118],
  [0, 0.204, 0.214],
  [0, 0.128, 0.262],
  [0, 0.07, 0.246]
];
const UNDER: V3[] = [
  [0, 0.012, 0.006],
  [0, 0.075, 0.045],
  [0, 0.108, 0.135],
  [0, 0.074, 0.215],
  [0, 0.022, 0.236]
];
const TUFT: V3[] = [
  [0, 0.012, -0.004],
  [0, 0.078, -0.04],
  [0, 0.136, -0.026],
  [0, 0.158, 0.02]
];

/** Plume on the swinging head bone: a gold socket and layered locks sweeping up and back. */
export function plume(b: PartSet) {
  const q = tier(b);
  const seg = pick(b, 6, 9, 20);
  const radial = pick(b, 5, 6, 12);
  const lock = (points: V3[], wide: number, deep: number, color: string, o: { at?: V3; rot?: V3; scale?: V3 } = {}) => {
    const g = sweep(
      points,
      (t) => {
        const k = Math.max(Math.sin(Math.PI * t ** 0.62) ** 0.8, 0.36 * (1 - t));
        return [wide * k, deep * k];
      },
      { seg, radial, up: [0, 0, -1] }
    );
    b.add('dangleHead', g, color, { ...o, look: 'cloth' });
  };
  b.lathe(
    'dangleHead',
    [
      [0.022, -0.014],
      [0.027, -0.006],
      [0.021, 0.01],
      [0.025, 0.026],
      [0.019, 0.034],
      [0, 0.034]
    ],
    GOLD,
    { look: 'gold', seg: pick(b, 8, 10, 16) }
  );
  lock(LOCK, 0.05, 0.056, RED);
  for (const side of [-1, 1]) lock(LOCK, 0.04, 0.048, RED_LIGHT, { at: [side * 0.012, 0, 0.004], rot: [0.16, side * 0.34, side * -0.1], scale: [0.9, 0.82, 0.86] });
  if (q < 2) return;
  lock(UNDER, 0.04, 0.042, RED_LIGHT);
  lock(TUFT, 0.032, 0.03, RED);
}

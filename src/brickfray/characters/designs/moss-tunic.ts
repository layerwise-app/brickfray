import { limbBand } from '../body-limbs';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { V3 } from '../skeleton';
import { C, HIDE } from './moss-gear';
import { loop, lump, pick, samples, sgnPow, surface, TAU, type Surface } from './sheet';
import { limbGarment, strand, type Garment } from './tailor';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The shared torso's cross-sections are superellipses of about this exponent. */
const ROUND = 0.69;
/** Height on the spine bone of the yoke seam's lower edge, where the gathered half comes out from under it. */
const HEM = 0.128;

/**
 * The tunic's gathered lower half on the waist bone: v runs down from inside the chest shell to the sash.
 * It leaves the chest's hem smooth and blouses out over the sash in folds.
 */
const bloused =
  (folds: number): Surface =>
  (u, v) => {
    const al = u * TAU;
    const y = 0.2 - 0.178 * v;
    const inside = Math.min(1, Math.max(0, (y - HEM) / 0.02));
    const below = Math.min(1, Math.max(0, (HEM - y) / 0.07));
    const tuck = v > 0.8 ? ((v - 0.8) / 0.2) ** 2 : 0;
    const fold = sgnPow(Math.sin(al * folds + Math.PI / 2 + 0.7 * Math.sin(al * 4)), 0.7);
    const grow = -0.0025 - 0.007 * inside + 0.0085 * Math.sin(below * (Math.PI / 2)) - 0.012 * tuck + 0.0052 * below * below * (1 - 0.6 * tuck) * fold;
    return [(lerp(0.16, 0.139, v) + grow) * sgnPow(Math.sin(al), ROUND), y, -(lerp(0.097, 0.089, v) + grow) * sgnPow(Math.cos(al), ROUND)];
  };

/** The sash's face on the waist bone at height y, `a` around from the front. */
function onSash(a: number, y: number, lift = 0): V3 {
  const k = 1 - (y / 0.04) ** 2;
  return [(0.1425 + 0.0035 * k + lift) * sgnPow(Math.sin(a), ROUND), y, -(0.092 + 0.0035 * k + lift) * sgnPow(Math.cos(a), ROUND)];
}

/** Tunic body: a laced placket on the chest, the bloused waist, and a wound sash knotted on the right hip. */
export function tunic(b: PartSet) {
  const around = pick(b, 12, 22, 52);
  // Coarse tiers get one fold per two columns, so every column lands on a ridge or a valley.
  b.add('spine', surface(loop(around), samples(pick(b, 3, 4, 12)), bloused(b.hero ? 15 : around / 2), true), C.tunic, { look: 'cloth' });
  // The yoke seam the lower half is gathered from, along the chest shell's hem.
  const hem = (y: number) => ({ y, rx: 0.1557 + (y + 0.014) * 0.19, rz: 0.0975 + (y + 0.014) * 0.06, e: 2.9 });
  if (b.detail > 1) b.add('chest', S.loft([hem(-0.032), hem(-0.014)], pick(b, 12, 16, 28), { bottom: b.hero ? 0.007 : 0 }), C.tunicDark, { look: 'cloth' });
  const ring = (y: number, grow: number) => ({ y, rx: 0.1425 + grow, rz: 0.092 + grow, e: 2.9 });
  b.add('spine', S.loft(b.detail > 1 ? [ring(-0.04, 0), ring(0, 0.0035), ring(0.04, 0)] : [ring(-0.04, 0.002), ring(0.04, 0.002)], pick(b, 10, 16, 28), b.hero ? { steps: 2, bottom: 0.004, top: 0.004 } : {}), C.sash, { look: 'cloth' });
  if (b.detail < 2) return;

  // The knot and its two tails, hanging over the belt and the skirt.
  const knot = onSash(0.62, 0.002, 0.01);
  lump(b, 'spine', [0.05, 0.03, 0.024], C.sashDark, pick(b, 6, 8, 12), { at: knot, rot: [0, -0.5, 0.25], look: 'cloth', e: 0.7 });
  const tails: [V3[], number][] = [
    [
      [
        [knot[0] + 0.004, -0.012, knot[2] - 0.006],
        [knot[0] + 0.012, -0.055, -0.111],
        [knot[0] + 0.018, -0.11, -0.124],
        [knot[0] + 0.02, -0.17, -0.129]
      ],
      0.02
    ],
    [
      [
        [knot[0] - 0.008, -0.012, knot[2] - 0.004],
        [knot[0] - 0.012, -0.05, -0.115],
        [knot[0] - 0.02, -0.092, -0.127],
        [knot[0] - 0.026, -0.125, -0.132]
      ],
      0.017
    ]
  ];
  for (const [points, r] of b.hero ? tails : tails.slice(0, 1)) {
    b.add('spine', strand(points, (t) => r * (0.5 + 0.5 * Math.sin(Math.min(1, t * 1.25) * (Math.PI / 2))), { flat: 0.13, side: [0.86, 0, -0.5], seg: pick(b, 4, 4, 8), radial: pick(b, 6, 6, 8) }), C.sash, { look: 'cloth' });
  }
  if (!b.hero) return;
  for (const y of [-0.014, 0.014]) b.add('spine', S.loft([ring(y - 0.0022, 0.003), ring(y + 0.0022, 0.003)], 28), C.sashDark, { look: 'cloth' });

  // Placket down the chest with crossed lacing.
  b.box('chest', [0.03, 0.12, 0.006], C.tunicDark, { at: [0, 0.055, -0.0995], rot: [-0.06, 0, 0], look: 'cloth', bevel: 0.002 });
  for (let i = 0; i < 4; i++) {
    const y = 0.012 + i * 0.024;
    for (const lean of [-1, 1]) b.box('chest', [0.026, 0.0036, 0.004], C.thread, { at: [0, y, -0.1035 - (y - 0.055) * 0.06], rot: [-0.06, 0, lean * 0.55], look: 'cloth', bevel: 0 });
  }
}

/** Sleeves and trouser legs: bunched folds, a buckled arm strap, side seams. */
export function sleevesAndLegs(b: PartSet, side: 'L' | 'R', sign: number) {
  const ua = `upperArm${side}` as const;
  const th = `thigh${side}` as const;
  if (b.detail < 2) return;
  b.add(ua, limbBand(b, 'upperArm', 1, -0.172, -0.15, 0.0042), C.leather, { look: HIDE });
  b.box(ua, [0.009, 0.028, 0.03], C.steel, { at: [sign * 0.0562, -0.161, 0], look: 'metal', bevel: b.hero ? 0.003 : 0 });
  for (const [y, grow] of [
    [-0.232, 0.0034],
    [-0.209, 0.0045]
  ] as const) {
    b.add(ua, limbBand(b, 'upperArm', 1, y - 0.008, y + 0.008, grow), C.tunicDark, { look: 'cloth' });
  }
  if (!b.hero) {
    if (side === 'R') knife(b, limbGarment('thigh', 1));
    return;
  }
  b.add(ua, limbBand(b, 'upperArm', 1, -0.151, -0.147, 0.0052), C.leatherDark, { look: HIDE });
  b.add(ua, limbBand(b, 'upperArm', 1, -0.175, -0.171, 0.0052), C.leatherDark, { look: HIDE });
  b.add(`forearm${side}`, limbBand(b, 'forearm', 1, -0.072, -0.05, 0.0045), C.tunicDark, { look: 'cloth' });

  const leg = limbGarment('thigh', 1);
  const out = (sign * Math.PI) / 2;
  if (side === 'R') knife(b, leg);
  b.add(th, leg.panel({ y: [-0.4, -0.13], a: [out - 0.05, out + 0.05], lift: 0, thick: 0.0028, seg: [1, 6] }), C.pantsDark, { look: 'cloth' });
  for (const y of [-0.372, -0.352]) b.add(th, limbBand(b, 'thigh', 1, y - 0.006, y + 0.006, 0.003), C.pantsDark, { look: 'cloth' });
}

/** Hunting knife in a stitched sheath strapped to the right thigh. */
function knife(b: PartSet, leg: Garment) {
  const a = 0.5;
  for (const y of [-0.165, -0.262]) b.add('thighR', limbBand(b, 'thigh', 1, y - 0.008, y + 0.008, 0.004), C.leatherDark, { look: HIDE });
  b.box('thighR', [0.034, 0.14, 0.014], C.leather, { ...leg.place(-0.215, a, 0.008), look: HIDE, bevel: 0.005 });
  b.box('thighR', [0.046, 0.009, 0.018], C.brass, { ...leg.place(-0.14, a, 0.01), look: 'gold', bevel: 0.003 });
  b.cyl('thighR', 0.0095, 0.0085, 0.052, C.leatherDark, { ...leg.place(-0.108, a, 0.011), look: HIDE, seg: pick(b, 6, 6, 10) });
  b.add('thighR', S.sphere(0.0115, pick(b, 6, 6, 10), 5), C.brass, { ...leg.place(-0.078, a, 0.011), look: 'gold' });
  if (!b.hero) return;
  b.box('thighR', [0.026, 0.02, 0.016], C.leatherDark, { ...leg.place(-0.276, a, 0.008), look: HIDE, bevel: 0.004 });
  for (const x of [-0.012, 0.012]) {
    for (let i = 0; i < 7; i++) b.box('thighR', [0.003, 0.009, 0.003], C.thread, { ...leg.place(-0.16 - i * 0.017, a + x / 0.075, 0.0156), look: 'cloth', bevel: 0 });
  }
}

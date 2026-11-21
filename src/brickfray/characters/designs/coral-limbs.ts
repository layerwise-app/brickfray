import * as THREE from 'three';
import { even, orb } from '../body-kit';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { LoftRing } from '../shapes';
import type { V3 } from '../skeleton';
import { BRASS, BRONZE, PATCH, ROPE, RUBBER, SEAM, shine, SUIT } from './coral-gear';
import { foldedLoft, type Fold } from './coral-folds';
import { rivets, sweep } from './plate-fittings';
import { Loft, pick, tier, type Spot } from './plate-forms';

const ACROSS: V3 = [0, 0, Math.PI / 2];
const CANVAS = { look: 'rubber' } as const;

/** A ring's height and half width, with its front and back depth as shares of a round section. */
type Stop = [y: number, r: number, front?: number, back?: number];
const rings = (stops: Stop[]): LoftRing[] => stops.map(([y, r, front = 1, back = 1]) => ({ y, rx: r, rz: r * 1.04 * front, back: r * 1.04 * back, e: 2.15 }));

/**
 * The canvas hangs loose on the limbs and bunches where it is gathered: above the elbow and knee, into the cuff and the boot.
 * Slack sags behind the upper arm, the forearm is broad below the elbow, the thigh is full in front and the calf behind.
 */
export const UPPER_ARM = rings([[-0.268, 0.056], [-0.246, 0.0695, 1, 1.08], [-0.222, 0.0585, 0.98, 1.04], [-0.19, 0.07, 1.02, 1.24], [-0.11, 0.069, 1.08, 1.12], [-0.03, 0.0715, 1, 1.04]]);
export const FOREARM = rings([[-0.206, 0.048], [-0.186, 0.0595, 1, 1.04], [-0.164, 0.0535, 0.96, 1], [-0.13, 0.0625, 0.94, 1.1], [-0.07, 0.07, 0.88, 0.98], [-0.014, 0.062, 0.94, 0.98]]);
export const THIGH = rings([[-0.416, 0.07], [-0.392, 0.0885, 1.06, 1], [-0.366, 0.0715, 1, 0.98], [-0.325, 0.088, 1.1, 1], [-0.18, 0.098, 1.14, 0.98], [-0.04, 0.098, 1, 1.04]]);
export const SHIN = rings([[-0.342, 0.054], [-0.32, 0.061], [-0.296, 0.0745, 1, 1.06], [-0.27, 0.0605, 1, 1.02], [-0.225, 0.068, 0.98, 1.16], [-0.12, 0.075, 0.96, 1.28], [-0.02, 0.067, 1, 1.08]]);
const KNEE: V3 = [0.12, 0.132, 0.058];
/**
 * The showroom's folds, for the right limbs: drag lines from the crotch and the armpit, the canvas bunched above the knee,
 * the boot, the crook of the elbow and the cuff, and creased behind the seat and the knee. Clear of the patches, straps and lacing.
 */
const FOLDS: Record<'upperArm' | 'forearm' | 'thigh' | 'shin', Fold[]> = {
  upperArm: [[-0.06, -0.074, -1.4, 0.3, 0.01, 0.006], [-0.17, -0.176, -0.8, 0.6, 0.007, 0.006], [-0.192, -0.204, -1.2, 0.9, 0.008, 0.008], [-0.212, -0.2, 2.3, 3.9, 0.008, 0.007]],
  forearm: [[-0.058, -0.074, -1.0, 0.7, 0.01, 0.006], [-0.15, -0.156, -1.6, 0.8, 0.008, 0.008]],
  thigh: [[-0.068, -0.104, -1.3, 0.2, 0.012, 0.011], [-0.1, -0.116, -0.7, 0.9, 0.01, 0.008], [-0.172, -0.186, 0.05, 1.35, 0.01, 0.008], [-0.064, -0.076, 2.4, 3.9, 0.012, 0.008], [-0.19, -0.2, 2.0, 4.0, 0.016, 0.007], [-0.33, -0.318, -1.3, 1.2, 0.01, 0.012], [-0.352, -0.358, -0.8, 0.9, 0.008, 0.008], [-0.37, -0.36, 2.2, 4.1, 0.009, 0.009]],
  shin: [[-0.1, -0.112, -1.0, 0.8, 0.01, 0.006], [-0.15, -0.18, -0.9, 1.0, 0.013, 0.007], [-0.235, -0.225, 1.8, 2.7, 0.009, 0.007], [-0.24, -0.25, -2.7, -1.7, 0.009, 0.007], [-0.255, -0.262, -1.6, 1.3, 0.009, 0.01], [-0.28, -0.287, -1.0, 2.0, 0.008, 0.008]]
};
const girth = (limb: LoftRing[], y: number) => S.loftRingAt(limb, y).rx;
/** A band lying on a limb from y0 to y1, `grow` proud of the canvas. */
const wrap = (limb: LoftRing[], y0: number, y1: number, grow: number): LoftRing[] =>
  [y0, y1].map((y) => {
    const r = S.loftRingAt(limb, y);
    return { ...r, y, rx: r.rx + grow, rz: r.rz + grow, back: r.back + grow };
  });

const SHEATH = new Loft([
  { y: -0.156, w: 0.005, f: 0.008, e: 0.7 },
  { y: -0.142, w: 0.011, f: 0.02, e: 0.7 },
  { y: -0.02, w: 0.012, f: 0.022, e: 0.7 },
  { y: -0.008, w: 0.015, f: 0.026, e: 0.7 },
  { y: 0.004, w: 0.015, f: 0.026, e: 0.7 },
  { y: 0.006, w: 0, f: 0 }
]);

/** Baggy canvas arms and legs with reinforced joints, in place of the shared body's limbs. */
export function limbs(b: PartSet) {
  const q = tier(b);
  const n = b.hero ? 18 : even(b.seg(6, 8, 12));
  const steps = b.hero ? 2 : 1;
  const hinge = b.hero ? 20 : b.seg(6, 10, 10);
  const round = pick(b, 6, 8, 18);
  // The medium tier's arms drop the gathered fold above the elbow and the cuff.
  const arm = (limb: LoftRing[]) => (q === 1 ? limb.filter((_, i) => i !== 1 && i !== 2) : limb);
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;

    orb(b, ua, 0.062, b.hero ? 18 : b.seg(6, 8, 10), SUIT, CANVAS);
    const skin = (limb: LoftRing[], part: keyof typeof FOLDS, bottom: number, top: number) => (b.hero ? foldedLoft(limb, FOLDS[part], sign, n, { bottom, top }) : S.loft(limb, n, { steps, bottom, top }));
    b.add(ua, skin(arm(UPPER_ARM), 'upperArm', 0.014, 0.03), SUIT, CANVAS);
    b.add(ua, S.loft(wrap(UPPER_ARM, -0.145, -0.095, 0.003), b.seg(6, 10, 10)), '#ffffff', { look: 'tint' });

    // Elbow: doubled canvas with a chafing patch behind it; in the showroom the sleeve simply bends over the joint.
    if (b.hero) orb(b, fa, 0.057, 18, SUIT, { at: [0, 0.002, 0.002], scale: [1.02, 1, 1.06], ...CANVAS });
    else b.cyl(fa, 0.052, 0.052, 0.112, q === 1 ? SUIT : PATCH, { rot: ACROSS, ...CANVAS, seg: hinge });
    b.add(fa, S.blob(0.1, 0.112, 0.056, 0.62, round, 0), PATCH, { at: [0, -0.01, 0.03], ...CANVAS });
    b.add(fa, skin(arm(FOREARM), 'forearm', 0.006, 0.02), SUIT, CANVAS);
    cuff(b, fa, sign);

    b.add(th, skin(THIGH, 'thigh', 0.016, 0.078), SUIT, CANVAS);
    if (b.hero) orb(b, sh, 0.068, 20, SUIT, { at: [0, 0.002, 0.003], scale: [1.02, 1.04, 1.06], ...CANVAS });
    else b.cyl(sh, 0.065, 0.065, 0.142, PATCH, { rot: ACROSS, ...CANVAS, seg: hinge });
    b.add(sh, S.blob(KNEE[0], KNEE[1], KNEE[2], 0.62, round, 0), PATCH, { at: [0, -0.006, -0.054], ...CANVAS });
    b.add(sh, skin(SHIN, 'shin', 0, 0.02), SUIT, CANVAS);
    if (q < 3) return;
    lacing(b, sh);
    // Stitching inside the knee patch's edge.
    for (let i = 0; i < 18; i++) {
      const a = ((i + 0.5) / 18) * Math.PI * 2;
      const [x, y] = [Math.cos(a) * KNEE[0] * 0.37, Math.sin(a) * KNEE[1] * 0.37];
      const z = (KNEE[2] / 2) * (1 - Math.abs((2 * x) / KNEE[0]) ** 3.2 - Math.abs((2 * y) / KNEE[1]) ** 3.2) ** (1 / 3.2);
      b.box(sh, [0.011, 0.003, 0.003], ROPE, { at: [x, y - 0.006, -0.054 - z - 0.0005], rot: [0, 0, a + Math.PI / 2], look: 'cloth', bevel: 0 });
    }
  });
  if (q < 2) return;
  seams(b, q === 3);
  knife(b);
}

/** Vulcanised rubber wrist seal under a brass clamp with its wing nut. */
function cuff(b: PartSet, fa: 'forearmL' | 'forearmR', sign: number) {
  const seg = b.hero ? 20 : b.seg(6, 10, 12);
  const seal: [number, number][] = b.hero
    ? [[0, -0.272], [0.034, -0.27], [0.044, -0.264], [0.047, -0.256], [0.047, -0.25], [0.0505, -0.247], [0.0505, -0.241], [0.047, -0.238], [0.047, -0.233], [0.0505, -0.23], [0.0505, -0.224], [0.047, -0.221], [0.047, -0.204], [0, -0.204]]
    : [[0, -0.264], [0.045, -0.264], [0.049, -0.21], [0, -0.21]];
  b.lathe(fa, seal, RUBBER, { look: 'rubber', seg });
  b.lathe(fa, [[0.046, -0.22], [0.0545, -0.218], [0.0555, -0.211], [0.0545, -0.204], [0.046, -0.202]], BRASS, { look: shine(b), seg });
  if (b.detail < 2) return;
  b.box(fa, [0.016, 0.02, 0.018], BRASS, { at: [sign * 0.059, -0.211, 0], look: shine(b), bevel: 0.004 });
  if (b.hero) b.box(fa, [0.006, 0.012, 0.03], BRONZE, { at: [sign * 0.068, -0.211, 0], look: 'metal', bevel: 0.002 });
}

/** Lacing down the back of the calf that keeps air out of the legs: a doubled strip, brass eyelets, crossed cord. */
function lacing(b: PartSet, sh: 'shinL' | 'shinR') {
  const back = (y: number, lift: number): V3 => [0, y, S.loftRingAt(SHIN, y).back + lift];
  const ys = [-0.062, -0.1, -0.14, -0.18, -0.218, -0.25];
  b.add(sh, sweep(ys.map((y) => back(y, 0.0005)), () => [0.021, 0.0035], { seg: 10, radial: 6, up: [0, 0, 1], caps: true }), PATCH, CANVAS);
  const eyelets: Spot[] = [];
  for (let i = 0; i < 6; i++) {
    const y = -0.075 - i * 0.033;
    const z = back(y, 0.0045)[2];
    for (const x of [-0.013, 0.013]) eyelets.push([new THREE.Vector3(x, y, z - 0.001), new THREE.Vector3(0, 0, 1)]);
    if (i === 5) break;
    for (const lean of [-1, 1]) b.cyl(sh, 0.0024, 0.0024, 0.042, ROPE, { at: [0, y - 0.0165, back(y - 0.0165, 0.0055)[2]], rot: [0, 0, lean * 0.67], look: 'cloth', seg: 5 });
  }
  b.add(sh, rivets(eyelets, 0.0048, 6), BRASS, { look: shine(b) });
}

/** Raised flat-felled seams down the outside of each limb. */
function seams(b: PartSet, all: boolean) {
  const runs: [string, LoftRing[], number[]][] = [
    ['upperArm', UPPER_ARM, [-0.06, -0.11, -0.16, -0.2]],
    ['thigh', THIGH, [-0.07, -0.15, -0.24, -0.33]],
    ['forearm', FOREARM, [-0.04, -0.08, -0.12]],
    ['shin', SHIN, [-0.05, -0.11, -0.17, -0.225]]
  ];
  b.mirror((side, sign) => {
    for (const [bone, limb, ys] of all ? runs : runs.slice(0, 2)) {
      const path = ys.map((y) => [sign * (girth(limb, y) + 0.0005), y, 0] as V3);
      b.add(`${bone}${side}` as 'thighL', sweep(path, () => [0.0055, 0.003], { seg: pick(b, 3, 4, 8), radial: pick(b, 4, 4, 6), up: [sign, 0, 0] }), SEAM, CANVAS);
    }
  });
}

/** Diving knife in a brass sheath strapped to the left thigh. */
function knife(b: PartSet) {
  for (const y of [-0.14, -0.27]) {
    b.add('thighL', S.loft(wrap(THIGH, y - 0.01, y + 0.01, 0.0035), b.hero ? 18 : even(b.seg(6, 8, 10))), RUBBER, { look: 'rubber' });
  }
  const x = -(girth(THIGH, -0.2) + 0.013);
  const tilt: V3 = [0, 0, -0.06];
  b.add('thighL', SHEATH.mesh({ cols: pick(b, 6, 8, 12) }), BRASS, { at: [x, -0.135, 0], rot: tilt, look: shine(b) });
  b.box('thighL', [0.02, 0.012, 0.064], BRONZE, { at: [x + 0.001, -0.125, 0], rot: tilt, look: 'metal', bevel: 0.003 });
  b.cyl('thighL', 0.0115, 0.013, 0.075, '#8a5a34', { at: [x + 0.003, -0.082, 0], rot: tilt, look: 'plastic', seg: pick(b, 6, 8, 12) });
  b.ball('thighL', 0.0165, BRASS, { at: [x + 0.006, -0.04, 0], look: shine(b) });
}

import { tone } from '../body-kit';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { LoftRing } from '../shapes';
import type { V3 } from '../skeleton';
import { buildAnchor } from '../../weapons/models/anchor';
import { BRASS, PATCH, ROPE, RUBBER, SEAM, SUIT, WAIST, shine } from './coral-gear';
import { FOREARM, SHIN, THIGH, UPPER_ARM } from './coral-limbs';
import { mounted } from './plate-fittings';
import { on } from './coral-folds';
import { surface, type Spot } from './plate-forms';
import { stow } from './stowed';

const CANVAS = { look: 'rubber' } as const;

/** A piece of doubled canvas lying on a limb, with a rim. */
function patch(limb: LoftRing[], y: [number, number], a: [number, number], lift: number, cols = 4) {
  const out = surface(
    cols,
    3,
    (u, v, point) => point.copy(on(limb, y[0] + (y[1] - y[0]) * v, a[0] + (a[1] - a[0]) * u, lift + 0.0035)[0]),
    { thick: 0.0035, back: false, inward: a[1] > a[0] }
  );
  return out;
}

const stitch = S.box(0.0028, 0.0022, 0.0085, 0);
/** Where the elbow's chafing patch runs down the forearm. */
const ELBOW_PATCH: [number, number] = [-0.09, -0.017];

/** Two rows of stitches down a limb at `a`, each `gap` to one side: the mark of a flat-felled seam. */
function seamStitches(limb: LoftRing[], y0: number, y1: number, a: number, gap: number, lift: number, count: number) {
  const spots: Spot[] = [];
  for (let i = 0; i < count; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5)) / count;
    const r = S.loftRingAt(limb, y).rx;
    for (const d of [-gap, gap]) spots.push(on(limb, y, a + d / r, lift));
  }
  return mounted(spots, stitch);
}

/** Stitches round the edge of a patch. */
function patchStitches(limb: LoftRing[], y: [number, number], a: [number, number], lift: number) {
  const spots: Spot[] = [];
  const inset = 0.007;
  const r = S.loftRingAt(limb, (y[0] + y[1]) / 2).rx;
  const a0 = Math.min(a[0], a[1]) + inset / r;
  const a1 = Math.max(a[0], a[1]) - inset / r;
  for (const at of [a0, a1]) for (let i = 0; i < 5; i++) spots.push(on(limb, y[0] + inset + ((y[1] - y[0] - inset * 2) * (i + 0.5)) / 5, at, lift + 0.0035));
  return mounted(spots, stitch);
}

/** What makes the suit read as heavy canvas up close, with the folds in its limbs: stitched seams, a gusset and mended patches. */
export function canvas(b: PartSet) {
  const thread = tone(ROPE, 0.92);
  b.mirror((side, sign) => {
    const out = (sign * Math.PI) / 2;
    const runs: ['upperArm' | 'forearm' | 'thigh' | 'shin', LoftRing[], number, number, number][] = [
      ['upperArm', UPPER_ARM, -0.064, -0.196, 8],
      ['forearm', FOREARM, -0.044, -0.116, 5],
      ['thigh', THIGH, -0.075, -0.325, 13],
      ['shin', SHIN, -0.055, -0.22, 9]
    ];
    for (const [bone, limb, y0, y1, count] of runs) b.add(`${bone}${side}`, seamStitches(limb, y0, y1, out, 0.0036, 0.0036, count), thread, { look: 'cloth' });
  });

  // A mended tear on the right thigh, a chafing patch on the left forearm, and one behind each elbow: on the forearm's
  // canvas below the joint, so a bent arm never folds it into the upper sleeve.
  const mends: ['thighR' | 'forearmL' | 'forearmR', LoftRing[], [number, number], [number, number], string, number][] = [
    ['thighR', THIGH, [-0.262, -0.196], [-0.62, 0.02], tone(SUIT, 1.16), 4],
    ['forearmL', FOREARM, [-0.15, -0.096], [-2.0, -1.2], PATCH, 4],
    ['forearmL', FOREARM, ELBOW_PATCH, [Math.PI - 0.95, Math.PI + 0.95], PATCH, 12],
    ['forearmR', FOREARM, ELBOW_PATCH, [Math.PI - 0.95, Math.PI + 0.95], PATCH, 12]
  ];
  for (const [bone, limb, y, a, color, cols] of mends) {
    b.add(bone, patch(limb, y, a, 0.0006, cols), color, CANVAS);
    b.add(bone, patchStitches(limb, y, a, 0.0012), thread, { look: 'cloth' });
  }

  // The suit's front seam runs on down the waist.
  b.add('spine', WAIST.mesh({ from: 0, to: 0.045, t0: WAIST.tAt(-0.03), t1: WAIST.tAt(0.1), cols: 1, rows: 2, lift: 0.0035, thick: 0.004, back: false, mirror: true }), SEAM, CANVAS);
  const waistStitches: Spot[] = [];
  for (let i = 0; i < 7; i++) for (const a of [-0.03, 0.03]) waistStitches.push(...WAIST.spots([[a, WAIST.tAt(-0.02 + i * 0.017)]], 0.0036));
  b.add('spine', mounted(waistStitches, stitch), thread, { look: 'cloth' });
}

/** Leans the slung anchor's crown in toward the small of the back. */
const SLING_LEAN = 0.14;

/** The anchor slung crown-down behind the tank: its ring on a brass hook, its grip strapped to the tank. */
export function anchorSling(b: PartSet) {
  const at: V3 = [0, -0.06, 0.291];
  stow(b, 'chest', buildAnchor, at, [0, Math.PI / 2, Math.PI + SLING_LEAN]);
  const ringY = at[1] + 0.106 * Math.cos(SLING_LEAN);
  const ringZ = at[2] + 0.106 * Math.sin(SLING_LEAN);
  b.box('chest', [0.014, 0.012, ringZ - 0.262], BRASS, { at: [0, ringY + 0.008, (ringZ + 0.262) / 2], look: shine(b), bevel: 0.003 });
  b.box('chest', [0.014, 0.022, 0.01], BRASS, { at: [0, ringY + 0.014, ringZ + 0.006], look: shine(b), bevel: 0.003 });
  // One rubber strap round the tank and the rope grip together.
  const far = at[2] + 0.021;
  b.cyl('chest', 0.079, 0.079, 0.02, RUBBER, { at: [0, at[1] + 0.03, (0.124 + far) / 2], scale: [1, 1, (far - 0.124) / 0.158], look: 'rubber', seg: 28, open: true });
}

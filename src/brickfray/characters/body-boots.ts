import * as THREE from 'three';
import { even, tone, type BodyKit } from './body-kit';
import * as S from './shapes';
import type { LoftRing } from './shapes';
import type { V3 } from './skeleton';

/** Lofts built along Y and laid forward: their y runs toward the toes, `back` is the height above the centre line. */
const FORWARD: V3 = [-Math.PI / 2, 0, 0];
const UPPER_Y = -0.04;
const UPPER: LoftRing[] = [
  { y: -0.056, rx: 0.043, rz: 0.024, back: 0.05, e: 2.6 },
  { y: -0.02, rx: 0.0545, rz: 0.024, back: 0.074, e: 2.7 },
  { y: 0.03, rx: 0.057, rz: 0.024, back: 0.068, e: 2.8 },
  { y: 0.075, rx: 0.058, rz: 0.024, back: 0.045, e: 2.8 },
  { y: 0.118, rx: 0.057, rz: 0.024, back: 0.031, e: 2.8 }
];
const TOE: LoftRing[] = [
  { y: -0.004, rx: 0.057, rz: 0.012, back: 0.033, e: 2.7 },
  { y: 0.035, rx: 0.0565, rz: 0.012, back: 0.031, e: 2.6 },
  { y: 0.062, rx: 0.05, rz: 0.012, back: 0.026, e: 2.5 }
];

const c1 = new THREE.Color();
const c2 = new THREE.Color();
/** Half the sole's width: no wider than the upper, so no dark lip shows round the boot from a distance. */
const SOLE_X = 0.0572;

/** A near-black sole reads as a hard black rim under a boot seen from a distance: it takes a dark shade of the boot instead. */
function soleTone(sole: string, boot: string) {
  c1.set(sole);
  if (c1.r * 0.21 + c1.g * 0.72 + c1.b * 0.07 > 0.06) return sole;
  return `#${c1.lerp(c2.set(boot).multiplyScalar(0.4), 0.7).getHexString()}`;
}

/** Where the boot's upper is at `forward` of the ankle, in foot space: the height of its top line and its slope. */
export function instep(forward: number) {
  const top = (f: number) => UPPER_Y + S.loftRingAt(UPPER, f).back;
  return { y: top(forward), pitch: Math.atan2(top(forward + 0.01) - top(forward - 0.01), 0.02) };
}

/** Boot on the foot and toe bones: padded shaft, heel counter and instep, toe box, welted sole with a heel block. */
export function boot(k: BodyKit, side: 'L' | 'R') {
  const { b, s, fine } = k;
  // The shaft follows the leg up to the width of the sole it stands on.
  const L = Math.min(k.legs, 1.12);
  const steps = k.limbSteps;
  const ft = `foot${side}` as const;
  const toe = `toe${side}` as const;
  const look = s.bootLook ?? 'plastic';
  const sole = soleTone(s.sole ?? '#2b2f33', s.boot);
  const n = b.hero ? 16 : even(b.seg(6, 8, 10));
  const closure = s.bootClosure ?? (look === 'metal' || look === 'chrome' || look === 'gold' ? 'lames' : 'laces');

  b.add(
    ft,
    S.loft(
      [
        { y: -0.012, rx: 0.0555 * L, rz: 0.057 * L, cz: 0.003 },
        { y: 0.048, rx: 0.0565 * L, rz: 0.058 * L, cz: 0.003 },
        { y: 0.066, rx: 0.0575 * L, rz: 0.059 * L, cz: 0.003 },
        { y: 0.078, rx: 0.0605 * L, rz: 0.061 * L, cz: 0.002 }
      ],
      n,
      { steps, top: 0.007 }
    ),
    s.boot,
    { look }
  );
  b.add(ft, S.loft(UPPER, n, { steps, bottom: 0.013 }), s.boot, { at: [0, UPPER_Y, 0], rot: FORWARD, look });
  b.add(toe, S.loft(TOE, n, { steps, top: 0.022 }), s.boot, { at: [0, 0.004, 0.012], rot: FORWARD, look });

  const slab = (y0: number, y1: number, cz: number, half: number, grow = 0): LoftRing[] => [
    { y: y0, rx: SOLE_X + grow, rz: half + grow, cz, e: 3.4 },
    { y: y1, rx: SOLE_X + grow, rz: half + grow, cz, e: 3.4 }
  ];
  const toeSlab = (y0: number, y1: number, grow = 0): LoftRing[] => [
    { y: y0, rx: SOLE_X + grow, rz: 0.048 + grow, back: 0.036, cz: -0.03, e: 3 },
    { y: y1, rx: SOLE_X + grow, rz: 0.048 + grow, back: 0.036, cz: -0.03, e: 3 }
  ];
  if (!b.hero) {
    b.add(ft, S.loft(slab(-0.085, -0.061, -0.025, 0.093), n), sole, { look: 'rubber' });
    b.add(toe, S.loft(toeSlab(-0.03, -0.006), n), sole, { look: 'rubber' });
    if (fine) b.box(ft, [0.118, 0.012, 0.03], sole, { at: [0, -0.05, 0.05], look: 'rubber' });
    return;
  }

  // Welt, forefoot tread and a heel block with the arch between them.
  const welt = tone(sole, sole === s.boot ? 0.8 : 1.12);
  b.add(ft, S.loft(slab(-0.071, -0.059, -0.025, 0.093), n), welt, { look: 'rubber' });
  b.add(ft, S.loft(slab(-0.085, -0.07, -0.079, 0.039), n), sole, { look: 'rubber' });
  b.add(ft, S.loft(slab(-0.085, -0.07, 0.037, 0.031), n), sole, { look: 'rubber' });
  b.add(toe, S.loft(toeSlab(-0.016, -0.004), n), welt, { look: 'rubber' });
  b.add(toe, S.loft(toeSlab(-0.03, -0.015), n), sole, { look: 'rubber' });
  for (const x of [-1, 1]) {
    for (const z of [-0.1, -0.078, -0.056, 0.026, 0.048]) b.box(ft, [0.008, 0.013, 0.012], sole, { at: [x * (SOLE_X - 0.0005), -0.0785, z], look: 'rubber', bevel: 0 });
    for (const z of [-0.012, -0.034, -0.056]) b.box(toe, [0.008, 0.013, 0.012], sole, { at: [x * (SOLE_X - 0.0005), -0.0235, z], look: 'rubber', bevel: 0 });
  }

  // Toe cap seam, heel counter and what closes the boot: laces, lames on armour, or the costume's own seal.
  const seam = tone(s.boot, 0.82);
  b.add(toe, S.loft([{ ...TOE[0]!, y: 0.014, rx: 0.0582, rz: 0.012, back: 0.0335 }, { ...TOE[0]!, y: 0.019, rx: 0.0582, rz: 0.012, back: 0.0335 }], n), seam, { at: [0, 0.004, 0.012], rot: FORWARD, look });
  b.add(ft, S.blob(0.094, 0.052, 0.03, 0.7, 10), seam, { at: [0, -0.034, 0.056], look });
  if (closure === 'sealed') return;
  if (closure === 'lames') {
    for (const forward of [0.05, 0.078, 0.106]) {
      const { y, pitch } = instep(forward);
      b.add(ft, S.blob(0.1, 0.012, 0.03, 0.6, 10), seam, { at: [0, y - 0.004, -forward], rot: [pitch, 0, 0], look });
    }
    return;
  }
  const lace = tone(s.boot, 1.55);
  const tongue = tone(s.boot, 0.9);
  for (let i = 0; i < 4; i++) {
    const forward = 0.04 + i * 0.019;
    const { y, pitch } = instep(forward);
    b.add(ft, S.blob(0.034, 0.012, 0.022, 0.7, 8), tongue, { at: [0, y - 0.002, -forward], rot: [pitch, 0, 0], look });
    for (const lean of [-1, 1]) b.cyl(ft, 0.0034, 0.0034, 0.05, lace, { at: [0, y + 0.0035, -forward], rot: [pitch, lean * 0.42, Math.PI / 2], look: 'cloth', seg: 6 });
  }
  b.box(ft, [0.016, 0.03, 0.007], seam, { at: [0, 0.07, 0.063 * L + 0.003], look, bevel: 0.003 });
}

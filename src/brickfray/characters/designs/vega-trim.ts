import * as THREE from 'three';
import { limbBand } from '../body-limbs';
import { tone } from '../body-kit';
import type { PartSet } from '../parts';
import { cloth, samples, surface, type Surface } from './sheet';
import { limbGarment, tier } from './tailor';
import { C } from './vega-hair';
import { CHEST, L, ON, THIGH, WAIST } from './vega-kit';

const HALF = Math.PI / 2;
const { lerp, smoothstep } = THREE.MathUtils;
const SEAM = tone(C.slate, 1.17);
const SHIN = limbGarment('shin', L);

interface Tail {
  /** Where it leaves the knot and where its end hangs, across the back. */
  x: [number, number];
  length: number;
  width: [number, number];
  phase: number;
  /** How far the end kicks out from the back. */
  kick: number;
  /** How far its lower half turns about its own length, so it shows an edge from behind. */
  twist: number;
}

/** A scarf tail on the swinging back bone: u across it, v down it. It ripples, drifts sideways and curls at the edges. */
const tailAt =
  (t: Tail, lift = 0): Surface =>
  (u, v) => {
    const across = u - 0.5;
    const free = Math.min(1, v * 2.5);
    const x = lerp(t.x[0], t.x[1], v) + 0.014 * Math.sin(v * 5 + t.phase) * v;
    const z = lerp(-0.016, 0.022, smoothstep(v, 0, 0.16)) + 0.012 * v + t.kick * Math.max(0, v - 0.6) ** 2;
    const ripple = 0.012 * Math.sin(v * 10.5 + t.phase + across * 2.4) * free;
    const curl = 0.02 * (2 * across) ** 2 * (0.35 + 0.65 * v);
    // Gathered at the knot, widest a third of the way down, tapering to the end.
    const wide = lerp(t.width[0], t.width[1], smoothstep(v, 0, 0.3)) * (1 - 0.4 * smoothstep(v, 0.45, 1));
    const half = across * wide * (1 - 0.1 * Math.sin(v * 10.5 + t.phase) * free);
    const turn = t.twist * smoothstep(v, 0.4, 1);
    return [x + half * Math.cos(turn), 0.012 - t.length * v, z + ripple + curl + lift + half * Math.sin(turn)];
  };

const LONG: Tail = { x: [-0.05, -0.028], length: 0.46, width: [0.04, 0.1], phase: 0.4, kick: 0.3, twist: 0.6 };
const SHORT: Tail = { x: [-0.078, -0.118], length: 0.3, width: [0.036, 0.085], phase: 2.3, kick: 0.16, twist: -0.35 };

/** Two scarf tails down the back from the knot behind her left shoulder, the long one striped and fringed at its end. */
export function scarfTails(b: PartSet) {
  const hi = b.detail >= 2;
  const us = samples(tier(b, 2, 3, 6), b.hero ? 0.1 : 0);
  const vs = samples(tier(b, 5, 7, 16));
  for (const [t, color] of hi ? ([[LONG, C.scarf], [SHORT, C.scarfDark]] as const) : ([[LONG, C.scarf]] as const)) {
    const piece = cloth(us, vs, tailAt(t), 0.007, { flip: true, round: [0.14, 0.03] });
    b.add('dangleBack', piece.outer, color, { look: 'cloth' });
    b.add('dangleBack', piece.inner, tone(color, 0.82), { look: 'cloth' });
  }
  for (const v of hi ? [0.8, 0.87] : [0.84]) b.add('dangleBack', surface(us, [v, v + 0.035], tailAt(LONG, 0.0016), false, true), C.scarfDark, { look: 'cloth' });
  if (!b.hero) return;
  for (let i = 0; i < 9; i++) {
    const [x, y, z] = tailAt(LONG)(0.06 + (i / 8) * 0.88, 1);
    b.cyl('dangleBack', 0.0038, 0.002, 0.03, C.scarfDark, { at: [x, y - 0.012, z + 0.003], rot: [0.3, 0, (i - 4) * 0.035], look: 'cloth', seg: 5 });
  }
}

/** The jacket's back: a yoke seam, shaping seams down to the hem and a snapped half belt. */
export function jacketBack(b: PartSet) {
  const hero = b.hero;
  const yoke: [number, number] = [CHEST.back(0.132, 0.158), CHEST.back(0.132, -0.158)];
  b.add('chest', CHEST.panel({ y: [0.128, 0.137], a: yoke, lift: ON, thick: 0.0016, seg: [tier(b, 4, 6, 14), 1] }), C.tealDark, { look: 'cloth' });
  const belt: [number, number] = [WAIST.back(0.05, 0.098), WAIST.back(0.05, -0.098)];
  b.add('spine', WAIST.panel({ y: [0.036, 0.07], a: belt, lift: ON, thick: 0.0035, seg: [tier(b, 4, 6, 12), 1] }), C.white, { look: 'cloth' });
  b.mirror((_, sign) => {
    b.cyl('spine', 0.0065, 0.0065, 0.004, C.steel, { ...WAIST.stud(0.053, WAIST.back(0.053, sign * 0.082), ON + 0.0045), look: 'chrome', seg: tier(b, 6, 6, 10) });
    if (!hero) return;
    for (const [bone, g, y0, y1] of [
      ['chest', CHEST, -0.048, 0.128],
      ['spine', WAIST, -0.008, 0.15]
    ] as const) {
      const a = g.back((y0 + y1) / 2, sign * 0.088);
      b.add(bone, g.panel({ y: [y0, y1], a: [a - 0.022, a + 0.022], lift: ON, thick: 0.0012, seg: [1, 4] }), C.tealDark, { look: 'cloth' });
    }
    // Stitching along the half belt and a reflective tab above the hem.
    for (const y of [0.0405, 0.0655]) b.add('spine', WAIST.panel({ y: [y - 0.001, y + 0.001], a: [WAIST.back(y, sign * 0.092), WAIST.back(y, sign * 0.012)], lift: ON + 0.0036, thick: 0.0006, seg: [4, 1] }), C.tealDark, { look: 'cloth' });
    b.box('spine', [0.03, 0.012, 0.003], C.white, { ...WAIST.place(-0.004, WAIST.back(-0.004, sign * 0.118), ON + 0.001), look: 'gloss', bevel: 0.001 });
  });
}

/** Scout trousers: fly and slanted hip zips, an inner-leg panel, a zipped thigh pocket, knee seams and calf zips. */
export function trousers(b: PartSet) {
  const hero = b.hero;
  // Fly and hip pockets on the hips.
  b.box('pelvis', [0.011, 0.066, 0.005], SEAM, { at: [0.012, -0.03, -0.0845], rot: [-0.3, 0, 0], look: 'cloth', bevel: 0 });
  b.mirror((_, sign) => {
    b.box('pelvis', [0.052, 0.0065, 0.005], C.steel, { at: [sign * 0.088, -0.006, -0.079], rot: [-0.2, sign * -0.55, sign * 0.5], look: 'metal', bevel: 0 });
    if (hero) b.box('pelvis', [0.008, 0.014, 0.006], C.teal, { at: [sign * 0.108, 0.005, -0.068], rot: [-0.2, sign * -0.6, sign * 0.5], look: 'gloss', bevel: 0.002 });
  });
  b.mirror((side, sign) => {
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    // Inner-leg panel of tougher cloth and two seams where the knee is articulated.
    b.add(th, THIGH.panel({ y: [-0.35, -0.11], a: [-sign * (HALF + 0.62), -sign * (HALF - 0.62)], lift: 0.0008, thick: 0.0022, seg: [tier(b, 3, 3, 6), tier(b, 1, 1, 3)] }), C.dark, { look: 'cloth' });
    for (const y of [-0.338, -0.316]) b.add(th, limbBand(b, 'thigh', L, y - 0.0028, y + 0.0028, 0.0026), SEAM, { look: 'cloth' });
    if (!hero) return;
    // Calf zip down the outside, shin seam down the front.
    const out = sign * HALF;
    b.add(sh, SHIN.panel({ y: [-0.282, -0.15], a: [out - 0.05, out + 0.05], lift: 0.0006, thick: 0.002, seg: [1, 4] }), C.steel, { look: 'metal' });
    b.box(sh, [0.008, 0.016, 0.012], C.teal, { ...SHIN.place(-0.146, out, 0.004), look: 'gloss', bevel: 0.002 });
    b.add(sh, SHIN.panel({ y: [-0.285, -0.085], a: [-0.045, 0.045], lift: 0.0006, thick: 0.0016, seg: [1, 4] }), SEAM, { look: 'cloth' });
    for (const y of [-0.215, -0.24]) b.add(sh, limbBand(b, 'shin', L, y - 0.0028, y + 0.0028, 0.0024), SEAM, { look: 'cloth' });
  });
  // Zipped pocket on the front of her right thigh.
  const at = (y: number, lift: number) => THIGH.place(y, 0.32, lift, 0.16);
  b.box('thighR', [0.02, 0.092, 0.004], SEAM, { ...at(-0.15, 0.0008), look: 'cloth', bevel: 0 });
  b.box('thighR', [0.0065, 0.08, 0.004], C.steel, { ...at(-0.15, 0.0026), look: 'metal', bevel: 0 });
  if (hero) b.box('thighR', [0.01, 0.018, 0.006], C.teal, { ...at(-0.112, 0.005), look: 'gloss', bevel: 0.002 });
}

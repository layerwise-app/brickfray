import { T } from '../builder';
import { box, slab, stud, torus, tube } from '../shapes';
import { bladeSlab } from './forms';
import { shade } from './details';
import type { MeleeBuilder } from './melee-kit';

const C = { teal: '#1fa7a0', white: '#f2f2ee', rubber: '#2a2f38', steel: '#d3d9e0', edge: '#f1f4f7', scarf: '#f5a623' };

/** Snap Knife: Vega's compact folding utility knife; origin at the grip, blade up +Y, edge toward -Z. */
export function buildKnife(b: MeleeBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Teal frame with finger grooves on the edge side, white scales and rubber ribs.
  const frame: [number, number][] = [
    [0.0135, -0.066],
    [0.0145, 0.02],
    [0.0125, 0.056],
    [-0.012, 0.056],
    [-0.0175, 0.044],
    [-0.0135, 0.03],
    [-0.0165, 0.014],
    [-0.0125, -0.002],
    [-0.0165, -0.018],
    [-0.0125, -0.034],
    [-0.0145, -0.058],
    [-0.0095, -0.068]
  ];
  b.add(slab(frame, 0.019, lod, 0.004), C.teal, 'plastic', T());
  const scale: [number, number][] = [
    [0.0105, -0.056],
    [0.0115, 0.036],
    [-0.0095, 0.036],
    [-0.0105, -0.056]
  ];
  const sc = slab(scale, 0.0032, lod, 0.004);
  for (const side of [-1, 1]) {
    b.add(sc, C.white, 'plastic', T(side * 0.0106, 0, 0));
    if (d >= 1) for (let i = 0; i < 5; i++) b.add(box(0.0016, 0.0042, 0.016, 0), C.rubber, 'rubber', T(side * 0.0126, -0.044 + i * 0.016, 0.0005));
  }

  // Lanyard loop in Vega's scarf orange.
  b.add(torus(0.0085, 0.0022, lod.segSmall + 4), C.scarf, 'rubber', T(0, -0.074, 0.002, 0, Math.PI / 2));

  // Pivot bolster: white cap on a teal hub, pinned by a steel hex screw on each side.
  b.add(tube(0.0115, 0.022, lod.seg, 0.002), C.teal, 'plastic', T(0, 0.052, 0.001, 0, Math.PI / 2));
  for (const side of [-1, 1]) {
    b.add(tube(0.0085, 0.0025, lod.seg, 0.0008), C.white, 'plastic', T(side * 0.0112, 0.052, 0.001, 0, Math.PI / 2));
    b.add(tube(0.0052, 0.003, 6), C.steel, 'chrome', T(side * 0.0128, 0.052, 0.001, 0, Math.PI / 2));
    if (d >= 1) b.add(tube(0.0023, 0.0036, lod.segSmall), C.rubber, 'dark', T(side * 0.0128, 0.052, 0.001, 0, Math.PI / 2));
  }

  // Drop-point blade: straight spine, belly sweeping up to the tip, wide flat grind.
  const blade: [number, number][] = [
    [0.0105, 0.05],
    [0.0115, 0.19],
    [0.0092, 0.216],
    [0.0035, 0.237],
    [-0.004, 0.25],
    [-0.0105, 0.236],
    [-0.0172, 0.207],
    [-0.0205, 0.165],
    [-0.0205, 0.072],
    [-0.013, 0.058],
    [-0.006, 0.05]
  ];
  b.add(bladeSlab(blade, 0.006, 0.008), C.steel, 'metal', T());
  b.add(bladeSlab(blade, 0.0016, 0.0012), C.edge, 'chrome', T(0, 0.15, -0.005, 0, 0, 0, 1, 1.006, 1.05).multiply(T(0, -0.15, 0.005)));
  // Teal thumb stud near the spine and jimping notches along it.
  b.add(stud(0.0042, 0.003, lod.segSmall, d >= 2), C.teal, 'plastic', T(0.0029, 0.088, 0, 0, 0, -Math.PI / 2));
  b.add(stud(0.0042, 0.003, lod.segSmall, d >= 2), C.teal, 'plastic', T(-0.0029, 0.088, 0, 0, 0, Math.PI / 2));
  if (d >= 2) for (let i = 0; i < 5; i++) b.add(box(0.0062, 0.0022, 0.0024), shade(C.steel, 0.55), 'dark', T(0, 0.102 + i * 0.0055, 0.0111));
}

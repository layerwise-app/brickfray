import { T } from '../builder';
import { ball, box, latheZ, slab, tube } from '../shapes';
import { bladeSlab } from './forms';
import { shade } from './details';
import { ring, turned, wide, type MeleeBuilder } from './melee-kit';

const C = { steel: '#d3d9e0', edge: '#f1f4f7', fuller: '#aab3bd', grip: '#b3201a', gold: '#d4a640', gem: '#d0241c' };
const UP = -Math.PI / 2;
const GUARD_Y = 0.078;

/** Brick Blade: Sir Clack's short arming sword; origin at the grip, blade up +Y, edges toward ±Z. */
export function buildSword(b: MeleeBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Leather grip, oval and swelling to fill the fist, cross-wrapped between gold ferrules.
  const grip: [number, number][] = [
    [0, -0.058],
    [0.0138, -0.058],
    [0.0151, -0.03],
    [0.0156, 0],
    [0.015, 0.03],
    [0.0136, 0.058],
    [0, 0.058]
  ];
  b.add(latheZ(grip, lod.seg), C.grip, 'satin', T(0, 0, 0, UP, 0, 0, 0.94, 1.06, 1));
  if (d >= 1) {
    for (let i = 0; i < 8; i++) {
      const tilt = i % 2 ? 0.26 : -0.26;
      b.add(ring(0.015, 0.0022, lod), shade(C.grip, 0.62), 'satin', T(0, -0.0455 + i * 0.013, 0, Math.PI / 2 + tilt, 0, 0, 0.94, 1.06, 1));
    }
  }
  for (const y of [-0.0605, 0.0605]) b.add(tube(0.0163, 0.008, lod.seg, 0.0025), C.gold, 'metal', T(0, y, 0, UP, 0, 0, 0.94, 1.06, 1));

  // Wheel pommel: a round disc with a rolled rim, a red enamel boss on each flat.
  const wheel: [number, number][] = [
    [0, -0.0105],
    [0.0125, -0.0105],
    [0.0145, -0.0085],
    [0.0195, -0.0085],
    [0.0225, -0.0065],
    [0.0238, -0.003],
    [0.0238, 0.003],
    [0.0225, 0.0065],
    [0.0195, 0.0085],
    [0.0145, 0.0085],
    [0.0125, 0.0105],
    [0, 0.0105]
  ];
  b.add(turned(wheel, wide(lod)), C.gold, 'metal', T(0, -0.0865, 0, 0, Math.PI / 2));
  for (const side of [-1, 1]) b.add(ball(0.0095, lod.segSmall + 4), C.gem, 'plastic', T(side * 0.0094, -0.0865, 0, 0, 0, 0, 0.42, 1, 1));

  // Crossguard along the edges: quillons bowing toward the blade from a boss with a gem, a langet up each flat.
  const half: [number, number][] = [
    [0.021, 0.066],
    [0.031, 0.0712],
    [0.07, 0.0772],
    [0.089, 0.083],
    [0.095, 0.09],
    [0.089, 0.097],
    [0.07, 0.0925],
    [0.031, 0.0892],
    [0.0215, 0.093],
    [0.0165, 0.108]
  ];
  const guard: [number, number][] = [...half, ...half.map(([z, y]) => [-z, y] as [number, number]).reverse()];
  b.add(slab(guard, 0.02, lod, 0.004), C.gold, 'metal', T());
  const bev = Math.max(lod.bevel * 2, d >= 1 ? 0.003 : 0);
  b.add(box(0.03, 0.027, 0.034, bev), C.gold, 'metal', T(0, GUARD_Y, 0));
  for (const side of [-1, 1]) {
    b.add(ball(0.0118, 16), C.gold, 'metal', T(0, 0.09, side * 0.094));
    if (d >= 1) b.add(ring(0.0085, 0.0022, lod), C.gold, 'metal', T(0, 0.0885, side * 0.083, 0.3 * side, 0, 0));
    b.add(ball(0.0088, lod.segSmall + 4), C.gem, 'plastic', T(side * 0.0148, GUARD_Y, 0, 0, 0, 0, 0.5, 1, 1));
    if (d >= 1) b.add(ring(0.0088, 0.0016, lod), C.gold, 'metal', T(side * 0.0152, GUARD_Y, 0, 0, Math.PI / 2));
  }

  // Blade: polished flats ground down to a bright honed edge, tapering to a point.
  const blade: [number, number][] = [
    [-0.025, 0.09],
    [-0.0215, 0.4],
    [-0.0175, 0.455],
    [-0.0105, 0.497],
    [0, 0.53],
    [0.0105, 0.497],
    [0.0175, 0.455],
    [0.0215, 0.4],
    [0.025, 0.09]
  ];
  b.add(bladeSlab(blade, 0.0115, 0.0085), C.steel, 'metal', T());
  b.add(bladeSlab(blade, 0.0022, 0.0016), C.edge, 'chrome', T(0, 0, 0, 0, 0, 0, 1, 1.002, 1.035));
  // A fuller down each flat, running out before the point, and a gold lozenge on the ricasso.
  if (d >= 1) {
    const fuller: [number, number][] = [
      [0, 0.128],
      [0.0048, 0.142],
      [0.004, 0.33],
      [0, 0.378],
      [-0.004, 0.33],
      [-0.0048, 0.142]
    ];
    const lozenge = slab([[0, 0.104], [0.0062, 0.113], [0, 0.122], [-0.0062, 0.113]], 0.0008, lod, 0.001);
    for (const side of [-1, 1]) {
      b.add(slab(fuller, 0.0008, lod, 0.003), C.fuller, 'chrome', T(side * 0.0056, 0, 0));
      b.add(lozenge, C.gold, 'metal', T(side * 0.0057, 0, 0));
    }
  }
}

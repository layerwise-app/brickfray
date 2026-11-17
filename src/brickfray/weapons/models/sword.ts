import { T, type ModelBuilder } from '../builder';
import { ball, box, stud, torus, tube } from '../shapes';
import { bladeSlab } from './forms';
import { shade } from './details';

const C = { steel: '#ccd3db', fuller: '#8d969f', grip: '#c8231b', gold: '#d4a640', gem: '#c8231b' };
const UP = -Math.PI / 2;

/** Brick Blade: Sir Clack's short arming sword; origin at the grip, blade up +Y, edges toward ±Z. */
export function buildSword(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Red leather grip with a spiral wrap between gold ferrules.
  b.add(tube(0.0128, 0.118, lod.seg, 0.002), C.grip, 'satin', T(0, 0, 0, UP));
  if (d >= 1) for (let i = 0; i < 7; i++) b.add(torus(0.0129, 0.0021, lod.seg), shade(C.grip, 0.72), 'satin', T(0, -0.048 + i * 0.016, 0, Math.PI / 2 + 0.22));
  for (const y of [-0.061, 0.061]) b.add(tube(0.0152, 0.009, lod.seg, 0.0025), C.gold, 'metal', T(0, y, 0, UP));

  // Wheel pommel, flats to the sides with a stud on each.
  b.add(tube(0.0225, 0.019, lod.seg, 0.004), C.gold, 'metal', T(0, -0.085, 0, 0, Math.PI / 2));
  const s = stud(0.009, 0.0055, lod.segSmall, d >= 1);
  for (const side of [-1, 1]) b.add(s, C.gold, 'metal', T(side * 0.0095, -0.085, 0, 0, 0, -side * Math.PI / 2));

  // Crossguard along the edges: center block with red gems, flared quillons ending in balls.
  const bev = Math.max(lod.bevel * 2, d >= 1 ? 0.0025 : 0);
  b.add(box(0.03, 0.026, 0.044, bev), C.gold, 'metal', T(0, 0.077, 0));
  for (const side of [-1, 1]) {
    b.add(box(0.02, 0.016, 0.062, bev * 0.7), C.gold, 'metal', T(0, 0.08, side * 0.05, side * -0.12));
    b.add(ball(0.0125, lod.segSmall + 2), C.gold, 'metal', T(0, 0.085, side * 0.085));
    b.add(ball(0.009, lod.segSmall + 2), C.gem, 'plastic', T(side * 0.0148, 0.077, 0, 0, 0, 0, 0.55, 1, 1));
  }

  // Blade: flat-ground steel with a darker fuller, tapering to a rounded point.
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
  b.add(bladeSlab(blade, 0.011, 0.0085), C.steel, 'satin', T());
  b.add(box(0.02, 0.012, 0.05, lod.bevel), C.steel, 'satin', T(0, 0.095, 0));
  if (d >= 1) for (const side of [-1, 1]) b.add(box(0.001, 0.25, 0.0085), C.fuller, 'metal', T(side * 0.0052, 0.245, 0));
  // Two gold studs on the ricasso mark it as a brick blade.
  if (d >= 1) for (const side of [-1, 1]) b.add(stud(0.0055, 0.0034, lod.segSmall, d >= 2), C.gold, 'metal', T(side * 0.0098, 0.098, 0, 0, 0, -side * Math.PI / 2));
}

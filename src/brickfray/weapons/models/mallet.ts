import { T, type ModelBuilder } from '../builder';
import { box, latheZ, torus, tube } from '../shapes';
import { studGrid } from './details';

const C = { head: '#c8231b', shaft: '#f6c624', grip: '#2b3036', collar: '#9aa1a8', cap: '#f58a1f' };
const UP = -Math.PI / 2;

/** Brick Mallet: a 2×4 brick head on a sturdy handle; origin at the grip, head up +Y. */
export function buildMallet(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;
  b.add(tube(0.0115, 0.3, lod.seg, 0.002), C.shaft, 'plastic', T(0, 0.09, 0, UP));
  b.add(tube(0.0145, 0.135, lod.seg, 0.003), C.grip, 'rubber', T(0, -0.008, 0, UP));
  if (d >= 1) for (let i = 0; i < 7; i++) b.add(torus(0.0146, 0.0018, lod.seg, Math.PI * 2), C.grip, 'rubber', T(0, -0.062 + i * 0.018, 0, Math.PI / 2));
  b.add(latheZ([[0, 0], [0.016, 0], [0.019, -0.006], [0.019, -0.014], [0.014, -0.02], [0, -0.021]], lod.seg), C.cap, 'plastic', T(0, -0.075, 0, UP));
  b.add(tube(0.0158, 0.016, lod.seg, 0.002), C.collar, 'metal', T(0, 0.232, 0, UP));
  // The 2×4 head: studs up, striking faces at ±Z.
  b.add(box(0.1, 0.118, 0.2, Math.max(lod.bevel * 2.5, d >= 1 ? 0.003 : 0)), C.head, 'plastic', T(0, 0.299, 0));
  studGrid(b, 0, 0.358, 0, 2, 4, 0.05, 0.015, C.head);
}

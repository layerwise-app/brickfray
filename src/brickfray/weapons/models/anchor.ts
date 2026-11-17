import { T, type ModelBuilder } from '../builder';
import { ball, box, slab, stud, torus, tube } from '../shapes';
import { shade } from './details';

const C = { iron: '#5f666d', brass: '#c99a3e', rope: '#d8b77c', coral: '#f26b5b' };
const UP = -Math.PI / 2;
/** Arms: an arc around a center on the shank, ending short of horizontal so the flukes flare out. */
const ARM_R = 0.13;
const ARM_Y = 0.232;
const ARM_END = 0.22;

/** Coral's boat anchor: grip on the rope-wrapped shank, crown up +Y, arms and flukes along ±Z. */
export function buildAnchor(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Iron shank, rope grip, brass collars, mooring ring below the hand.
  b.add(tube(0.0112, 0.43, lod.seg, 0.002), C.iron, 'satin', T(0, 0.135, 0, UP));
  b.add(tube(0.0122, 0.128, lod.seg), C.rope, 'satin', T(0, 0, 0, UP));
  if (d >= 1) for (let i = 0; i < 9; i++) b.add(torus(0.0124, 0.0036, lod.seg), i % 2 ? C.rope : shade(C.rope, 0.86), 'satin', T(0, -0.058 + i * 0.0145, 0, Math.PI / 2 + 0.16));
  for (const y of [-0.072, 0.072]) b.add(tube(0.0158, 0.011, lod.seg, 0.002), C.brass, 'metal', T(0, y, 0, UP));
  b.add(box(0.012, 0.016, 0.016, lod.bevel), C.brass, 'metal', T(0, -0.084, 0));
  b.add(torus(0.019, 0.0048, lod.seg), C.brass, 'metal', T(0, -0.106, 0, 0, Math.PI / 2));

  // Brass stock across the shank, ball-ended.
  b.add(tube(0.0145, 0.02, lod.seg, 0.002), C.brass, 'metal', T(0, 0.1, 0, UP));
  b.add(tube(0.0062, 0.13, lod.segSmall + 4, 0.001), C.brass, 'metal', T(0, 0.1, 0, 0, Math.PI / 2));
  for (const side of [-1, 1]) b.add(ball(0.0105, lod.segSmall + 4), C.brass, 'metal', T(side * 0.066, 0.1, 0));

  // Arms and flukes in the Y-Z plane, so a fluke leads the swing.
  b.add(torus(ARM_R, 0.0135, lod.seg, Math.PI - 2 * ARM_END), C.iron, 'satin', T(0, ARM_Y, 0, 0, -Math.PI / 2, ARM_END));
  const fluke = slab(
    [
      [0.007, 0.01],
      [0.03, -0.004],
      [0.034, -0.016],
      [0.005, -0.056],
      [0, -0.059],
      [-0.005, -0.056],
      [-0.034, -0.016],
      [-0.03, -0.004],
      [-0.007, 0.01]
    ],
    0.016,
    lod,
    0.004
  );
  for (const side of [-1, 1]) {
    const z = side * ARM_R * Math.cos(ARM_END);
    const y = ARM_Y + ARM_R * Math.sin(ARM_END);
    const tilt = -side * ARM_END;
    b.add(fluke, C.coral, 'plastic', T(0, y, z, tilt));
    const sy = y - 0.022 * Math.cos(tilt);
    const sz = z - 0.022 * Math.sin(tilt);
    if (d >= 1) for (const x of [-1, 1]) b.add(stud(0.0066, 0.004, lod.segSmall, d >= 2), C.coral, 'plastic', T(x * 0.0078, sy, sz, 0, 0, -x * Math.PI / 2));
  }

  // Brass crown cap with two studs on top.
  b.add(box(0.032, 0.03, 0.05, Math.max(lod.bevel * 2, d >= 1 ? 0.003 : 0)), C.brass, 'metal', T(0, ARM_Y + ARM_R, 0));
  const s = stud(0.0078, 0.0048, lod.segSmall, d >= 1);
  for (const z of [-0.012, 0.012]) b.add(s, C.brass, 'metal', T(0, ARM_Y + ARM_R + 0.015, z));
}

import { T } from '../builder';
import { ball, box, slab, torus, tube } from '../shapes';
import { arc } from './forms';
import { shade } from './details';
import { ring, wedge, type MeleeBuilder } from './melee-kit';

const C = { iron: '#6b737b', brass: '#c99a3e', rope: '#d8b77c', coral: '#f26b5b' };
const UP = -Math.PI / 2;
/** Arms: a crescent around a center on the shank, ending short of horizontal so the flukes flare out. */
const ARM_R = 0.139;
const ARM_Y = 0.232;
const ARM_END = 0.22;
/** The crescent's inner edge: a tighter arc about a lower center, so the arms are stoutest at the crown. */
const INNER_R = 0.118;
const INNER_DROP = 0.012;
const MID_R = 0.128;

/** Coral's boat anchor: grip on the rope-wrapped shank, crown up +Y, arms and flukes along ±Z. */
export function buildAnchor(b: MeleeBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Iron shank, stouter toward the crown; rope grip, brass collars, mooring ring below the hand.
  b.add(tube(0.0138, 0.43, lod.seg, 0.002, 0.0112), C.iron, 'metal', T(0, 0.135, 0, UP));
  b.add(tube(0.0122, 0.128, lod.seg), C.rope, 'satin', T(0, 0, 0, UP));
  if (d >= 1) for (let i = 0; i < 9; i++) b.add(ring(0.0124, 0.0036, lod), i % 2 ? C.rope : shade(C.rope, 0.84), 'satin', T(0, -0.058 + i * 0.0145, 0, Math.PI / 2 + 0.16));
  for (const y of [-0.072, 0.072]) b.add(tube(0.0162, 0.011, lod.seg, 0.0025), C.brass, 'metal', T(0, y, 0, UP));
  b.add(box(0.012, 0.016, 0.016, lod.bevel), C.brass, 'metal', T(0, -0.084, 0));
  b.add(torus(0.019, 0.0048, lod.seg), C.brass, 'metal', T(0, -0.106, 0, 0, Math.PI / 2));

  // Brass stock across the shank, ball-ended.
  b.add(tube(0.0158, 0.022, lod.seg, 0.003), C.brass, 'metal', T(0, 0.1, 0, UP));
  b.add(tube(0.0066, 0.13, lod.segSmall + 4, 0.001), C.brass, 'metal', T(0, 0.1, 0, 0, Math.PI / 2));
  for (const side of [-1, 1]) b.add(ball(0.0108, 14), C.brass, 'metal', T(side * 0.066, 0.1, 0));

  // One forged crescent for both arms, in the Y-Z plane so a fluke leads the swing.
  const steps = Math.max(6, lod.curve * 4);
  const crescent = [...arc(0, ARM_Y, ARM_R, ARM_END, Math.PI - ARM_END, steps), ...arc(0, ARM_Y - INNER_DROP, INNER_R, Math.PI - ARM_END - 0.1, ARM_END + 0.1, steps)];
  b.add(slab(crescent, 0.021, lod, 0.0025), C.iron, 'metal', T());

  // Spade flukes, broad at the arm and thinning to the bill, a brass rivet through each.
  const fluke: [number, number][] = [
    [0.009, 0.012],
    [0.031, -0.002],
    [0.035, -0.015],
    [0.006, -0.058],
    [0, -0.061],
    [-0.006, -0.058],
    [-0.035, -0.015],
    [-0.031, -0.002],
    [-0.009, 0.012]
  ];
  const palm = wedge(fluke, (_, y) => 0.008 + ((y + 0.061) / 0.073) * 0.024, 'anchor-fluke');
  for (const side of [-1, 1]) {
    const z = side * MID_R * Math.cos(ARM_END);
    const y = ARM_Y + MID_R * Math.sin(ARM_END) - 0.004;
    const tilt = -side * ARM_END;
    b.add(palm, C.coral, 'plastic', T(0, y, z, tilt));
    const ry = y - 0.016 * Math.cos(tilt);
    const rz = z - 0.016 * Math.sin(tilt);
    if (d >= 1) for (const x of [-1, 1]) b.add(ball(0.0058, lod.segSmall + 2), C.brass, 'metal', T(x * 0.0128, ry, rz, 0, 0, 0, 0.5, 1, 1));
  }

  // Brass crown band with a boss on each face and a cap where the shank comes through.
  const top = ARM_Y + ARM_R;
  b.add(box(0.031, 0.036, 0.05, Math.max(lod.bevel * 2, d >= 1 ? 0.004 : 0)), C.brass, 'metal', T(0, top - 0.016, 0));
  b.add(tube(0.0115, 0.008, lod.seg, 0.003), C.brass, 'metal', T(0, top + 0.005, 0, UP));
  if (d >= 1) for (const side of [-1, 1]) b.add(ball(0.0085, lod.segSmall + 4), C.brass, 'metal', T(side * 0.0152, top - 0.016, 0, 0, 0, 0, 0.45, 1, 1));
}

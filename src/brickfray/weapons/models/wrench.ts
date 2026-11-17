import { T, type ModelBuilder } from '../builder';
import { ball, box, slab, stud, torus, tube } from '../shapes';
import { arc } from './forms';
import { shade } from './details';

const C = { white: '#eef0f4', shade: '#d4d8df', purple: '#7b4fd6', glow: '#b48cff', slot: '#2a2346' };
const UP = -Math.PI / 2;
const HEAD_Y = 0.305;
const HEAD_R = 0.056;
/** The jaw opens up and tilted toward -Z, so its tips lead the swing. */
const JAW = Math.PI / 2 + 0.3;
const JAW_W = 0.02;

/** Torque Wrench: Nova's big open-end space wrench; origin at the grip, jaw up +Y. */
export function buildWrench(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Flat white bar, slimmer under the grip, with a hanging hole at the butt.
  const bar: [number, number][] = [
    [0.017, -0.104],
    [0.017, -0.075],
    [0.0115, -0.064],
    [0.0115, 0.064],
    [0.016, 0.08],
    [0.0175, 0.27],
    [-0.0175, 0.27],
    [-0.016, 0.08],
    [-0.0115, 0.064],
    [-0.0115, -0.064],
    [-0.017, -0.075],
    [-0.017, -0.104]
  ];
  b.add(slab(bar, 0.02, lod, [0.008, 0.002, 0.004, 0.004, 0.004, 0, 0, 0.004, 0.004, 0.004, 0.002, 0.008], [arc(0, -0.088, 0.0062, 0, (Math.PI * 2 * 11) / 12, 11)]), C.white, 'plastic', T());

  // Purple rubber grip sleeve with ribs and white end rings.
  b.add(tube(0.0158, 0.124, lod.seg, 0.003), C.purple, 'rubber', T(0, 0, 0, UP));
  if (d >= 1) for (let i = 0; i < 6; i++) b.add(torus(0.0159, 0.0018, lod.seg), shade(C.purple, 0.8), 'rubber', T(0, -0.045 + i * 0.018, 0, Math.PI / 2));
  for (const y of [-0.064, 0.064]) b.add(tube(0.0172, 0.007, lod.seg, 0.002), C.shade, 'plastic', T(0, y, 0, UP));

  // Glowing torque gauge set into both faces of the bar.
  for (const side of [-1, 1]) {
    b.add(box(0.0012, 0.104, 0.013, 0), C.slot, 'dark', T(side * 0.0101, 0.165, 0));
    b.add(box(0.0016, 0.094, 0.0055, 0), C.glow, 'glow', T(side * 0.0102, 0.165, 0));
    if (d >= 2) for (let i = 0; i < 5; i++) b.add(box(0.0016, 0.0015, 0.0034), C.shade, 'plastic', T(side * 0.0103, 0.127 + i * 0.019, 0.0072));
  }

  // Purple collar with a stud on each face.
  b.add(box(0.026, 0.022, 0.044, Math.max(lod.bevel * 2, d >= 1 ? 0.003 : 0)), C.purple, 'plastic', T(0, 0.248, 0));
  const s = stud(0.0068, 0.0042, lod.segSmall, d >= 1);
  for (const side of [-1, 1]) b.add(s, C.purple, 'plastic', T(side * 0.0128, 0.248, 0, 0, 0, -side * Math.PI / 2));

  // Open-end jaw head with a glowing dot under the throat.
  b.add(slab(jaw(), 0.024, lod, 0.003), C.white, 'plastic', T());
  const dz = -Math.cos(JAW) * 0.039;
  const dy = HEAD_Y - Math.sin(JAW) * 0.039;
  for (const side of [-1, 1]) b.add(ball(0.0062, lod.segSmall + 2), C.glow, 'glow', T(side * 0.012, dy, dz, 0, 0, 0, 0.45, 1, 1));
}

/** Head outline [z, y]: a disc with a straight-sided slot ending in a round throat. */
function jaw(): [number, number][] {
  const ux = Math.cos(JAW);
  const uy = Math.sin(JAW);
  const reach = Math.sqrt(HEAD_R * HEAD_R - JAW_W * JAW_W);
  const tilt = Math.atan2(JAW_W, reach);
  const outer = arc(0, HEAD_Y, HEAD_R, JAW + tilt, JAW - tilt + Math.PI * 2, 18);
  const throat = arc(-ux * 0.004, HEAD_Y - uy * 0.004, JAW_W, JAW - Math.PI / 2, JAW - Math.PI * 1.5, 8);
  return [...outer, ...throat];
}

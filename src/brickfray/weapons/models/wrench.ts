import { T } from '../builder';
import { ball, box, slab, tube } from '../shapes';
import { arc } from './forms';
import { shade } from './details';
import { ring, type MeleeBuilder } from './melee-kit';

const C = { white: '#eef0f4', shade: '#d4d8df', purple: '#7b4fd6', glow: '#b48cff', slot: '#2a2346', chrome: '#dfe3ea' };
const UP = -Math.PI / 2;
const HEAD_Y = 0.305;
const HEAD_R = 0.056;
/** The jaw opens up and tilted toward -Z, so its tips lead the swing. */
const JAW = Math.PI / 2 + 0.3;
const JAW_W = 0.02;

/** Torque Wrench: Nova's big open-end space wrench; origin at the grip, jaw up +Y. */
export function buildWrench(b: MeleeBuilder) {
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
  if (d >= 1) for (let i = 0; i < 6; i++) b.add(ring(0.0159, 0.0018, lod), shade(C.purple, 0.8), 'rubber', T(0, -0.045 + i * 0.018, 0, Math.PI / 2));
  for (const y of [-0.064, 0.064]) b.add(tube(0.0172, 0.007, lod.seg, 0.002), C.shade, 'plastic', T(0, y, 0, UP));

  // Glowing torque gauge set into both faces of the bar.
  for (const side of [-1, 1]) {
    b.add(box(0.0012, 0.104, 0.013, 0), C.slot, 'dark', T(side * 0.0101, 0.165, 0));
    b.add(box(0.0016, 0.094, 0.0055, 0), C.glow, 'glow', T(side * 0.0102, 0.165, 0));
    if (d >= 2) for (let i = 0; i < 5; i++) b.add(box(0.0016, 0.0015, 0.0034), C.shade, 'plastic', T(side * 0.0103, 0.127 + i * 0.019, 0.0072));
  }

  // Raised rails along both edges of the bar, so its faces sit in a shallow channel.
  if (d >= 1) for (const z of [-1, 1]) b.add(box(0.0228, 0.168, 0.0052, lod.bevel), C.white, 'plastic', T(0, 0.166, z * 0.0142));

  // Purple collar clamped by a chrome hex bolt on each face.
  b.add(box(0.027, 0.022, 0.045, Math.max(lod.bevel * 2, d >= 1 ? 0.003 : 0)), C.purple, 'plastic', T(0, 0.248, 0));
  for (const side of [-1, 1]) {
    b.add(tube(0.0072, 0.004, 6), C.chrome, 'chrome', T(side * 0.0142, 0.248, 0, 0, Math.PI / 2));
    if (d >= 1) b.add(tube(0.0034, 0.0052, lod.segSmall), C.slot, 'dark', T(side * 0.0142, 0.248, 0, 0, Math.PI / 2));
  }

  // Open-end jaw head, thicker than the bar, with purple grip pads lining the jaw and a ringed status light under the throat.
  b.add(slab(jaw(), 0.026, lod, 0.003), C.white, 'plastic', T());
  // A shallow grey face plate on each side, set in from the rim and the slot, so the head is not one plain white disc.
  if (d >= 1) for (const side of [-1, 1]) b.add(slab(jaw(0.0065), 0.0012, lod, 0.002), C.shade, 'plastic', T(side * 0.0131, 0, 0));
  const ux = Math.cos(JAW);
  const uy = Math.sin(JAW);
  if (d >= 1) {
    for (const side of [-1, 1]) {
      const along = 0.03;
      const z = ux * along - uy * side * (JAW_W - 0.0008);
      const y = HEAD_Y + uy * along + ux * side * (JAW_W - 0.0008);
      b.add(box(0.0265, 0.026, 0.0022, lod.bevel), C.purple, 'rubber', T(0, y, z, Math.PI / 2 - JAW));
    }
  }
  const dz = -ux * 0.039;
  const dy = HEAD_Y - uy * 0.039;
  for (const side of [-1, 1]) {
    b.add(ball(0.0062, lod.segSmall + 2), C.glow, 'glow', T(side * 0.013, dy, dz, 0, 0, 0, 0.45, 1, 1));
    if (d >= 1) b.add(ring(0.0078, 0.0016, lod), C.purple, 'plastic', T(side * 0.0131, dy, dz, 0, Math.PI / 2));
  }
}

/** Head outline [z, y]: a disc with a straight-sided slot ending in a round throat, `inset` in from the rim and the slot. */
function jaw(inset = 0): [number, number][] {
  const ux = Math.cos(JAW);
  const uy = Math.sin(JAW);
  const r = HEAD_R - inset;
  const w = JAW_W + inset;
  const reach = Math.sqrt(r * r - w * w);
  const tilt = Math.atan2(w, reach);
  const outer = arc(0, HEAD_Y, r, JAW + tilt, JAW - tilt + Math.PI * 2, 18);
  const throat = arc(-ux * 0.004, HEAD_Y - uy * 0.004, w, JAW - Math.PI / 2, JAW - Math.PI * 1.5, 8);
  return [...outer, ...throat];
}

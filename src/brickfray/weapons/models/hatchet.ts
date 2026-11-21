import { T } from '../builder';
import { box, latheZ, slab, tube } from '../shapes';
import { arc } from './forms';
import { shade } from './details';
import { ring, wedge, type MeleeBuilder } from './melee-kit';

const C = { wood: '#96683f', wrap: '#4f7a3a', cord: '#6e4a2f', forged: '#6b747d', poll: '#8b949d', edge: '#e3e8ed', leaf: '#a6c629' };
const UP = -Math.PI / 2;
/** The bit's edge is an arc about this point on the eye. */
const EYE: [number, number] = [-0.02, 0.278];
const EDGE_R = 0.103;
/** Where the dark forged cheeks give way to the bright ground bevel. */
const GRIND_R = 0.086;
const TOP: [[number, number], [number, number]] = [[-0.02, 0.314], [-0.1104, 0.3274]];
const HEEL: [number, number] = [-0.1038, 0.2182];
const BEARD: [number, number][] = [[-0.075, 0.236], [-0.045, 0.256], [-0.02, 0.258]];
const CHEEK = 0.031;
const SLOPE = (CHEEK - 0.0008) / EDGE_R;

/** The head's full width at a point: its cheeks thin evenly from the eye to the cutting edge. */
const thick = (z: number) => Math.max(0.0008, CHEEK - (EYE[0] - z) * SLOPE);

/** Moss's woodsman hatchet: origin at the grip, head up +Y, bit toward -Z, poll toward +Z. */
export function buildHatchet(b: MeleeBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Oval hickory handle: a swelled knob, a waist under the hand, thicker again into the eye.
  const handle: [number, number][] = [
    [0, -0.104],
    [0.0125, -0.104],
    [0.0172, -0.097],
    [0.0176, -0.084],
    [0.0136, -0.07],
    [0.0128, 0.0],
    [0.0114, 0.12],
    [0.0112, 0.2],
    [0.0124, 0.25],
    [0.0124, 0.321],
    [0, 0.321]
  ];
  b.add(latheZ(handle, lod.seg), C.wood, 'satin', T(0, 0, 0, UP, 0, 0, 1, 1.18, 1));
  // Green leather wrap, spiral-bound, tied off with cord at each end.
  b.add(tube(0.0146, 0.118, lod.seg, 0.002), C.wrap, 'satin', T(0, -0.004, 0, UP, 0, 0, 1, 1.12, 1));
  if (d >= 1) for (let i = 0; i < 7; i++) b.add(ring(0.0146, 0.002, lod), shade(C.wrap, 0.7), 'satin', T(0, -0.052 + i * 0.016, 0, Math.PI / 2 + 0.25, 0, 0, 1, 1, 1.12));
  for (const y of [-0.064, 0.056]) b.add(tube(0.0156, 0.008, lod.seg, 0.002), C.cord, 'rubber', T(0, y, 0, UP, 0, 0, 1, 1.12, 1));

  // Forged eye around the handle, a lighter hammer face on the poll, a steel wedge driven into the wood on top.
  b.add(slab([[-0.026, 0.25], [0.033, 0.255], [0.035, 0.316], [-0.026, 0.32]], 0.033, lod, 0.006), C.forged, 'metal', T());
  b.add(box(0.027, 0.05, 0.006, Math.max(lod.bevel, d >= 1 ? 0.0015 : 0)), C.poll, 'metal', T(0, 0.2855, 0.0365));
  if (d >= 1) b.add(box(0.003, 0.002, 0.02, 0), C.poll, 'metal', T(0, 0.3215, 0.001));

  // Bearded bit: cheeks thinning from the eye, then a bright bevel ground to the edge.
  const outer = arc(EYE[0], EYE[1], EDGE_R, Math.PI - 0.5, Math.PI + 0.62, 10);
  const inner = grind();
  b.add(wedge([TOP[0], ...inner, ...BEARD], thick, 'hatchet-cheek'), C.forged, 'metal', T());
  b.add(wedge([inner[0]!, TOP[1], ...outer.slice(1, -1), HEEL, inner[inner.length - 1]!, ...inner.slice(1, -1).reverse()], thick, 'hatchet-bevel'), C.edge, 'chrome', T());

  // A leaf stamped on each cheek, lying on its slope.
  if (d >= 1) {
    const leaf = slab([[0.016, 0], [0.006, 0.0062], [-0.008, 0.0058], [-0.016, 0], [-0.008, -0.0058], [0.006, -0.0062]], 0.0012, lod, 0.003);
    const lean = Math.atan(SLOPE * 0.5 * Math.cos(0.55));
    for (const side of [-1, 1]) b.add(leaf, C.leaf, 'plastic', T(side * (thick(-0.054) / 2 + 0.0003), 0.287, -0.054, 0.55, side * lean));
  }
}

/** The grind line: an arc inside the edge, cut off where it meets the bit's top and its beard. */
function grind(): [number, number][] {
  const inside = ([z, y]: [number, number]) => {
    const [a, c] = TOP;
    const top = a[1] + ((c[1] - a[1]) * (z - a[0])) / (c[0] - a[0]);
    const k = BEARD[0]!;
    const bottom = HEEL[1] + ((k[1] - HEEL[1]) * (z - HEEL[0])) / (k[0] - HEEL[0]);
    return y <= top && y >= bottom;
  };
  const at = (a: number): [number, number] => [EYE[0] + Math.cos(a) * GRIND_R, EYE[1] + Math.sin(a) * GRIND_R];
  let from = Math.PI;
  let to = Math.PI;
  while (inside(at(from - 0.005))) from -= 0.005;
  while (inside(at(to + 0.005))) to += 0.005;
  return arc(EYE[0], EYE[1], GRIND_R, from, to, 8);
}

import { box, T, type Piece } from './temple-layout';

/**
 * The east strip from camp to camp along the village (the west strip is its half turn, along the gorge): outcrops
 * from the rim and towers and screens from the court wall alternate, so the open lane bends and no line runs its
 * whole length; boulders, ruins and stelae stand between them every 6-8 m.
 */
const E = T.edgeX;
const W = T.courtOut;

export function eastStrip(): Piece[] {
  const p: Piece[] = [];
  for (const s of [-1, 1]) {
    // Each end: a spur (cliff to the north, river bluff to the south) and a tower in the camp's corner.
    p.push(box('spur', 31.2, 0, s * T.edge, E, 7.2, s * 35.2));
    p.push(box('kiosk', 27.2, 0, s * T.edge, 31.2, 4.8, s * 38.4));
    // A drum tower at each court corner, where the strip opens into the end yard.
    p.push(box('kiosk', W, 0, s * 24.0, 28.8, 6.4, s * T.row));
  }
  // Screens before the court gates: from the strip a gate is seen only from close by.
  p.push(box('screen', 28.8, 0, -14.4, 29.6, 2.88, -8.0));
  p.push(box('screen', 28.8, 0, 5.6, 29.6, 2.88, 11.2));
  // The waist: an outcrop from the rim and a fallen gate tower from the court wall overlap across the lane with a
  // 3.2 m way between them, so the strip is two long lanes and no line runs from end to end.
  p.push(box('rock', 30.4, 0, -5.6, E, 4.0, -1.6));
  p.push(box('ruin', W, 0, 1.6, 31.2, 2.4, 4.0));
  // Waist-high cover every 6-8 m, alternating sides, kept 4.8 m off the rim so nothing climbed reaches the edge.
  p.push(box('ruin', W, 0, -18.4, 29.6, 1.36, -17.6));
  p.push(box('boulder', 32.0, 0, -12.0, 33.6, 1.44, -10.4));
  p.push(box('boulder', 32.0, 0, -27.2, 33.6, 1.44, -25.6));
  p.push(box('ruin', 28.0, 0, -32.8, 31.2, 1.36, -32.0));
  p.push(box('boulder', 32.0, 0, 9.6, 33.6, 1.44, 11.2));
  p.push(box('ruin', W, 0, 17.6, 31.2, 2.4, 18.4));
  p.push(box('boulder', 31.2, 0, 26.4, 32.8, 1.44, 28.0));
  p.push(box('ruin', 28.0, 0, 31.2, 31.2, 1.36, 32.0));
  return p;
}

/**
 * The four edges, each its own kind and each open to the world beyond: boulders and balustrade over the waterfall
 * stream at the cliff foot (north), the gorge rim (west), village fronts (east), the river terrace over the ghats (south).
 */
export function edges(): Piece[] {
  const p: Piece[] = [];
  const Zs = T.edge;
  // North: fallen boulders from the cliff with balustrade between them, the stream and the cliff beyond.
  const north: [number, number, number][] = [[-27.2, -23.2, 3.6], [-15.2, -11.2, 4.4], [-5.6, -2.4, 3.2], [2.4, 6.4, 4.0], [14.4, 18.4, 3.2], [24.0, 27.2, 4.4]];
  let x = -27.2;
  for (const [x0, x1, h] of north) {
    if (x0 > x + 0.1) p.push(box('rail', x, 0, -Zs - 0.4, x0, T.parapet, -Zs));
    p.push(box('rock', x0, 0, -Zs - 2.4, x1, h, -Zs));
    x = x1 === -2.4 ? 2.4 : x1;
  }
  p.push(box('rail', -E - 0.4, 0, -35.2, -E, T.parapet, 35.2));
  p.push(box('rail', -31.2, 0, Zs, 31.2, T.parapet, Zs + 0.4));
  const houses: [number, number][] = [[-35.2, -28.0], [-25.6, -18.4], [-16.0, -8.8], [-6.4, 1.6], [4.0, 11.2], [13.6, 20.8], [23.2, 35.2]];
  let z = -35.2;
  for (const [z0, z1] of houses) {
    if (z0 > z) p.push(box('fence', E, 0, z, E + 0.2, 2.4, z0, { surface: 'wood', bulletsPass: true }));
    p.push(box('house', E, 0, z0, E + 7.2, 6.4, z1));
    z = z1;
  }
  return p;
}

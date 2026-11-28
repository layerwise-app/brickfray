import { F, type Works } from './fortress-plan';
import { propSolid, type PropTag } from './fortress-props';

const STONE = new Set<PropTag>(['masonry', 'block', 'stones', 'trough', 'millstones', 'well', 'cross', 'anvil']);

type Prop = [PropTag, number, number, number, number, number];

/** Ground height under a prop: the knoll, the crag street's terrace, the east quay, or the yard. */
export function groundAt(x: number, z: number) {
  if (Math.abs(x) < 10.4 && z < -35.2) return F.knoll;
  if (z < (x < 4.0 ? F.laneN : F.laneNE) && Math.abs(x) < F.terrace) return F.street;
  if (x > 12.8 && x < 40.0 && z > F.laneSE) return F.quay;
  return 0;
}

/**
 * Cover in clusters, CS-site style: a standing piece (1.6 m+) with low pieces (about 1 m) beside it, clean ground
 * between clusters. Each half has its own [tag, x0, z0, x1, z1, height].
 */
const WEST: Prop[] = [
  // Crag street: a hay wagon at the square end, the woodpile under the loft, fallen masonry on the knoll.
  ['wagon', -44.0, -38.4, -40.0, -36.4, 2.4],
  ['bales', -40.0, -37.6, -37.6, -36.4, 1.0],
  ['woodpile', -25.6, -37.6, -22.4, -36.0, 1.8],
  ['trough', -20.8, -36.0, -18.4, -35.2, 0.8],
  ['masonry', -10.4, -40.0, -8.0, -37.6, 2.0],
  ['block', -13.6, -36.0, -12.0, -34.4, 1.0],
  // River path: a boat on trestles with barrels, a cart of barrels with sacks, millstones by the ford.
  ['boat', -47.2, 37.6, -42.4, 39.2, 1.9],
  ['barrels', -40.0, 38.4, -38.4, 40.0, 1.1],
  ['cart', -27.2, 35.2, -23.2, 36.8, 1.8],
  ['sacks', -21.6, 40.0, -20.0, 41.6, 1.0],
  ['millstones', -12.0, 38.4, -10.4, 40.0, 1.0],
  ['sacks', -12.0, 40.0, -10.4, 41.6, 1.0],
  // Bailey: a market stall with barrels (north), the well with a trough (south), the masons' stack by the keep.
  ['stall', -31.2, -15.2, -28.0, -13.6, 3.2],
  ['barrels', -28.0, -15.2, -26.4, -13.6, 1.1],
  ['well', -30.4, 13.6, -28.0, 15.6, 3.4],
  ['trough', -26.4, 14.4, -24.0, 15.2, 0.8],
  ['stones', -15.2, 6.4, -12.8, 8.0, 1.9],
  ['block', -15.2, -8.0, -13.6, -6.4, 1.0],
  // Town square: a market stall with barrels, hay at each spawn yard's mouth.
  ['stall', -60.0, -1.6, -58.4, 1.6, 3.2],
  ['barrels', -60.0, 1.6, -58.4, 3.2, 1.1],
  ['bales', -51.2, -12.8, -50.0, -10.4, 1.0],
  ['bales', -51.2, 10.4, -50.0, 12.8, 1.0]
];

const EAST: Prop[] = [
  // Crag street: a log stack under the ledge, a cart by its stair, fallen stones on the knoll, hay at the farm end.
  ['timber', 23.2, -36.0, 26.4, -34.4, 1.8],
  ['trough', 19.2, -34.4, 21.6, -33.6, 0.8],
  ['cart', 28.8, -36.0, 32.8, -34.4, 1.8],
  ['stones', 8.0, -34.4, 10.4, -32.8, 1.9],
  ['block', 13.6, -33.6, 15.2, -32.0, 1.0],
  ['bales', 43.2, -34.4, 45.6, -32.8, 1.0],
  // Quay: an upturned boat with barrels by the corner tower, a fish cart with sacks, millstones at the ford.
  ['boat', 29.6, 33.6, 34.4, 35.2, 1.9],
  ['barrels', 36.8, 33.6, 38.4, 35.2, 1.1],
  ['cart', 17.6, 32.8, 21.6, 34.4, 1.8],
  ['sacks', 21.6, 36.8, 23.2, 38.4, 1.0],
  ['millstones', 10.4, 38.4, 12.0, 40.0, 1.0],
  ['barrels', 10.4, 40.0, 12.0, 41.6, 1.1],
  // Bailey: the siege ram left inside the breach (north), a cart with barrels (south), stones by the keep.
  ['ram', 26.4, -15.2, 30.4, -13.6, 2.0],
  ['woodpile', 24.0, -15.2, 26.4, -13.6, 1.0],
  ['cart', 26.4, 13.6, 30.4, 15.2, 1.8],
  ['barrels', 24.8, 13.6, 26.4, 15.2, 1.1],
  ['stones', 12.8, -8.0, 15.2, -6.4, 1.9],
  ['block', 13.6, 6.4, 15.2, 8.0, 1.0],
  // Farmyard: a wagon by the paddock, hay at each spawn yard's mouth.
  ['wagon', 56.8, -2.0, 58.8, 2.0, 2.4],
  ['bales', 50.0, -12.8, 51.2, -10.4, 1.0],
  ['bales', 50.0, 10.4, 51.2, 12.8, 1.0],
  ['bales', 48.8, 28.8, 51.2, 30.0, 1.0]
];

/** In the keep courts, straddling x = 0: a smithy's coal cart with an anvil and a trough (north), the market cross with sacks (south). */
const CENTRE: Prop[] = [
  ['cart', -2.0, -16.8, 2.0, -15.2, 1.8],
  ['anvil', 4.0, -19.2, 5.2, -18.4, 1.0],
  ['trough', -5.6, -14.4, -3.2, -13.6, 0.8],
  ['cross', -1.0, 14.4, 1.0, 16.4, 2.6],
  ['sacks', 3.2, 13.6, 4.8, 15.2, 1.0],
  ['barrels', -4.8, 18.4, -3.2, 20.0, 1.1]
];

const put = (w: Works, [tag, x0, z0, x1, z1, h]: Prop) => {
  const y = groundAt((x0 + x1) / 2, (z0 + z1) / 2);
  w.box('prop', x0, y, z0, x1, y + h, z1, { tag, surface: STONE.has(tag) ? 'stone' : tag === 'bales' ? 'foliage' : 'wood' });
  const q = w.pieces[w.pieces.length - 1]!;
  q.solid = propSolid(q);
};

export function westCover(w: Works) {
  for (const p of WEST) put(w, p);
}

export function eastCover(w: Works) {
  for (const p of EAST) put(w, p);
}

export function centreCover(w: Works) {
  for (const p of CENTRE) put(w, p);
}

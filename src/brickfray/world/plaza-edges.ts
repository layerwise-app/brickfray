import { EDGE, type Layout } from './plaza-layout';
import { STATION } from './plaza-north';

const X = EDGE.x;
const Z = EDGE.z;
/** Side streets off the west edge, closed by iron gates (z ranges). */
export const SIDE_STREETS: [number, number][] = [[-32.0, -28.8], [28.8, 32.0]];

/**
 * The town's edges, each its own kind: railings over the railway cutting (north), the canal quay (east), the park's
 * iron railings on the road (south), house fronts with gated side streets (west). Then the quay's cover.
 */
export function edgeDistrict(L: Layout) {
  west(L);
  north(L);
  east(L);
  south(L);
  quay(L);
}

/** Kerb and railing too tall to vault, sharing one footprint so nobody stands on the kerb. */
function guard(L: Layout, x0: number, z0: number, x1: number, z1: number, tag: string, base = 0) {
  L.add('parapet', x0, base, z0, x1, 0.48, z1, { tag });
  L.add('rail', x0, 0.48, z0, x1, 1.44, z1, { pass: true, surface: 'metal', tag });
}

function west(L: Layout) {
  const [a, b] = SIDE_STREETS;
  L.block(-X - 4.8, -Z - 0.8, -X, a![0], 13.92, ['e'], 'west');
  L.block(-X - 4.8, a![1], -X, -12.0, 10.56, ['e'], 'west');
  L.block(-X - 4.8, 12.0, -X, b![0], 10.56, ['e'], 'west');
  L.block(-X - 4.8, b![1], -X, Z + 0.8, 13.92, ['e'], 'west');
  for (const [z0, z1] of SIDE_STREETS) L.add('rail', -X - 0.4, 0, z0, -X, 2.64, z1, { pass: true, surface: 'metal', tag: 'gate-w' });
}

function north(L: Layout) {
  guard(L, -X, -Z - 0.4, STATION.x0, -Z, 'cutting');
  guard(L, STATION.x1, -Z - 0.4, X, -Z, 'cutting');
}

function east(L: Layout) {
  guard(L, X, -Z - 0.4, X + 0.4, -2.4, 'canal');
  guard(L, X, -2.4, X + 0.4, 2.4, 'canal', -2.4);
  guard(L, X, 2.4, X + 0.4, Z + 0.4, 'canal');
}

function south(L: Layout) {
  L.add('parapet', -X, 0, Z, X, 0.48, Z + 0.4, { tag: 'railing' });
  L.add('rail', -X, 0.48, Z, X, 2.64, Z + 0.4, { pass: true, surface: 'metal', tag: 'railing' });
}

/**
 * Quay along the east canal (the long lane): two staggered timber stacks cut it into a 42 m middle field between two
 * short ends, so no line runs its full length; crate clusters across the field are crouch cover every few metres.
 */
function quay(L: Layout) {
  const tag = 'quay';
  const full: [number, number, number, number, number][] = [
    [30.4, -27.2, 37.6, -25.6, 2.8], [36.0, -22.4, X, -20.8, 2.8],
    [36.0, 20.8, X, 22.4, 2.8], [30.4, 25.6, 37.6, 27.2, 2.8],
    // Timber at the mouths of the streets past the town hall.
    [30.4, -16.0, 32.8, -12.8, 2.8], [33.6, 15.2, 36.0, 17.6, 2.8]
  ];
  for (const [a, b, c, e, h] of full) L.add('stack', a, 0, b, c, h, e, { surface: 'wood', tag });
  // Crate clusters at the bridge heads: the middle of the lane is one 35 m field crossed from cover to cover.
  const low: [number, number, number, number][] = [
    [30.4, -9.6, 32.0, -8.0], [32.0, -8.8, 33.6, -7.2], [35.2, 8.0, 36.8, 9.6],
    [36.0, -32.0, 37.6, -30.4], [32.0, -12.0, 33.6, -10.4], [36.8, -8.8, 38.4, -7.2],
    [36.8, 7.2, 38.4, 8.8], [32.0, 10.4, 33.6, 12.0], [36.0, 30.4, 37.6, 32.0],
    [37.6, -27.2, 39.2, -25.6], [37.6, -14.4, 39.2, -12.8], [37.6, 12.8, 39.2, 14.4], [37.6, 24.8, 39.2, 26.4]
  ];
  for (const [a, b, c, e] of low) L.add('stack', a, 0, b, c, 1.28, e, { surface: 'wood', tag: 'crates' });
}

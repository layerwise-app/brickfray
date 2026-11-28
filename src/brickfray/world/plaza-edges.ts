import { BLVD, halves, houses, LAND, type Layout, QUAY } from './plaza-layout';

/** Openings in the west town wall: the iron-grille gate and a railed breach over the moat (z ranges). */
export const WALL_GAPS: [number, number][] = [[-4.8, 0.0], [25.6, 33.6]];
/** Canal beyond the south rail. */
export const CANAL = { z0: QUAY.side + 0.4, z1: 48.0, water: -0.9 } as const;

/**
 * The town's edges, each its own kind: house fronts along the north (shops and doors on the boulevard), the canal rail
 * along the south, the old town wall with its grille gate and a railed breach behind the west base, the railway fence
 * behind the east base (the tram depot shows through it).
 */
export function edgeDistrict(L: Layout) {
  const X = LAND.x;
  const j = BLVD.jog;
  halves(L, (S) => {
    houses(S, -X, -BLVD.mid, LAND.north - 6.4, LAND.north, [13.92, 10.56, 12.24, 10.56, 15.6], 's', S.tag('north-w', 'north-e'), ['e']);
    houses(S, -BLVD.mid, 0, LAND.north - j - 6.4, LAND.north - j, [15.6, 12.24, 13.92], 's', S.tag('north-w', 'north-e'), [], true);
    // Base road: two planters against the town wall / fence, cover between the spawn groups.
    for (const z of [-8.8, 7.2]) S.add('garden', -X, 0, z, -X + 1.6, 1.32, z + 2.4, { tag: 'planter' });
  });
  // West: the town wall, two openings fitted with iron (bars stop players, not eyes).
  let at: number = LAND.north;
  for (const [a, b] of WALL_GAPS) {
    L.add('wall', -X - 1.6, 0, at, -X, 6.4, a, { tag: 'townwall' });
    L.add('rail', -X - 1.6, 0, a, -X, 4.8, b, { pass: true, surface: 'metal', tag: 'grille' });
    L.add('lintel', -X - 1.6, 4.8, a, -X, 6.4, b, { tag: 'townwall' });
    at = b;
  }
  L.add('wall', -X - 1.6, 0, at, -X, 6.4, LAND.south + 0.4, { tag: 'townwall' });
  // East: kerb and a tall see-through fence over the railway.
  L.add('parapet', X, 0, LAND.north, X + 0.4, 0.48, LAND.south + 0.4, { tag: 'fence' });
  L.add('rail', X, 0.48, LAND.north, X + 0.4, 2.64, LAND.south + 0.4, { pass: true, surface: 'metal', tag: 'fence' });
  // South: the canal kerb and railing (too tall to stand on), the water beyond; the canal bends out round the middle.
  const { side, mid } = QUAY;
  const guard = (x0: number, z0: number, x1: number, z1: number) => {
    L.add('parapet', x0, 0, z0, x1, 0.48, z1, { tag: 'canal' });
    L.add('rail', x0, 0.48, z0, x1, 1.44, z1, { pass: true, surface: 'metal', tag: 'canal' });
  };
  guard(-mid, LAND.south, mid, LAND.south + 0.4);
  for (const s of [-1, 1]) {
    guard(s * X, side, s * mid, side + 0.4);
    guard(s * mid, side + 0.4, s * (mid + 0.4), LAND.south + 0.4);
    L.add('bed', s * (X + 1.6), -2.4, CANAL.z0, s * (mid + 0.4), -1.6, CANAL.z1, { tag: 'canal' });
    L.add('quay', s * mid, -2.4, side + 0.4, s * (mid + 0.4), 0, LAND.south + 0.4, { tag: 'canal' });
  }
  L.add('bed', -mid - 0.4, -2.4, LAND.south + 0.4, mid + 0.4, -1.6, CANAL.z1, { tag: 'canal' });
}

import { EDGE, type Layout } from './plaza-layout';

const Z = EDGE.z;

/** Station concourse on the north edge: a hall the length of the forecourt, three doors, windows over the cutting. */
export const STATION = { x0: -11.2, x1: 11.2, z0: -Z - 0.8, z1: -29.6, wall: 0.8, top: 6.4, roof: 14.4 } as const;
/** North row between the terminus and the square: bakery shop, Gate Street under its arch, the boatyard. */
export const NORTH_ROW = { z0: -22.4, z1: -16.0 } as const;

/** Tram Terminus (team 1), Bakery Lane, the station, the north row with the bakery and the Town Gate, the boatyard. */
export function northDistrict(L: Layout) {
  row(L);
  station(L);
  terminus(L);
  bakery(L);
  gate(L);
  boatyard(L);
}

function row(L: Layout) {
  const { z0, z1 } = NORTH_ROW;
  L.block(-21.6, z0, -18.4, z1, 10.56, ['n', 's'], 'row-n');
  L.block(-8.8, z0, 2.4, z1, 10.56, ['n', 's', 'w'], 'row-n');
  L.block(2.4, z0, 13.6, z1, 13.92, ['n', 's'], 'row-n');
  L.block(13.6, z0, 20.8, z1, 10.56, ['n', 's'], 'row-n');
}

/** Concourse: doors to the forecourt and both platforms, a ticket booth and benches, iron columns. */
function station(L: Layout) {
  const { x0, x1, z0, z1, wall: w, top } = STATION;
  const tag = 'station';
  // North wall: tall windows over the railway cutting (bars stop players, not bullets or eyes).
  const win: [number, number][] = [[-8.8, -6.4], [-4.0, -1.6], [1.6, 4.0], [6.4, 8.8]];
  let at: number = x0;
  for (const [a, b] of win) {
    L.add('wall', at, 0, z0, a, top, z0 + w, { tag });
    L.add('wall', a, 0, z0, b, 1.2, z0 + w, { tag });
    L.add('lintel', a, 4.0, z0, b, top, z0 + w, { tag });
    L.add('rail', a, 1.2, z0, b, 4.0, z0 + w, { pass: true, surface: 'metal', tag });
    at = b;
  }
  L.add('wall', at, 0, z0, x1, top, z0 + w, { tag });
  L.run('wall', true, x0, x1, z1 - w, z1, 0, top, [[-1.6, 1.6, 3.2]], { tag });
  L.run('wall', false, z0 + w, z1 - w, x0, x0 + w, 0, top, [[-36.8, -33.6, 3.2]], { tag });
  L.run('wall', false, z0 + w, z1 - w, x1 - w, x1, 0, top, [[-36.8, -33.6, 3.2]], { tag });
  L.add('ceiling', x0, top, z0, x1, STATION.roof, z1, { tag });
  L.add('kiosk', -1.6, 0, -37.6, 1.6, 2.72, -33.6, { tag });
  for (const x of [-5.6, 5.6]) L.add('pillar', x - 0.3, 0, -35.9, x + 0.3, top, -35.3, { surface: 'metal', tag });
  for (const x of [-8.0, 8.0]) L.add('counter', x - 1.2, 0, -33.2, x + 1.2, 1.04, -32.4, { tag: 'bench' });
  for (const [x, z] of [[-8.0, -38.4], [-4.0, -38.4], [4.0, -38.4], [8.0, -38.4], [-4.0, -32.0], [4.0, -32.0], [-8.0, -35.2], [8.0, -35.2]] as const) L.seed(x, 0, z);
}

/** Forecourt and the two platform wings: trams on their tracks, shelters and kiosks break the open ground. */
function terminus(L: Layout) {
  const tag = 'terminus';
  L.add('tram', -30.4, 0, -36.0, -18.4, 3.2, -33.6, { surface: 'metal', tag });
  L.add('tram', 18.4, 0, -36.0, 30.4, 3.2, -33.6, { surface: 'metal', tag });
  for (const [x0, x1] of [[-28.0, -22.4], [21.6, 27.2]] as const) {
    L.add('shelter', x0, 0, -28.8, x1, 2.32, -28.0, { surface: 'glass', tag });
    L.add('roof', x0, 2.32, -28.8, x1, 2.48, -26.4, { surface: 'glass', tag });
  }
  // News and flower stands in staggered pairs cut the forecourt into a west and an east half.
  L.add('kiosk', -16.0, 0, -31.2, -13.6, 2.72, -25.2, { tag });
  L.add('kiosk', -14.4, 0, -25.6, -12.0, 2.72, -22.4, { tag });
  L.add('kiosk', 13.6, 0, -31.2, 16.0, 2.72, -25.2, { tag });
  L.add('kiosk', 12.0, 0, -25.6, 14.4, 2.72, -22.4, { tag });
  // Platform cover: crates on the west wing, ticket booths at both ends (too tall to climb, out of reach of the railings).
  for (const [a, b] of [[-38.4, -33.6], [-36.0, -28.0]] as const) L.add('stack', a, 0, b, a + 1.6, 1.04, b + 1.6, { surface: 'wood', tag: 'crates' });
  for (const [a, b] of [[-34.4, -39.2], [39.2, -38.4]] as const) L.add('kiosk', a, 0, b, a + 1.6 + (a > 0 ? 0.8 : 0), 2.72, b + 1.6, { tag });
  // A pump house in Bakery Lane against the west houses: no line runs down the lane into the market hall.
  L.add('kiosk', -44.0, 0, -20.0, -38.4, 2.72, -17.6, { tag: 'lane' });
}

/** Walk-through bakery: doors at opposite corners and shelves between them, so no line runs through. */
function bakery(L: Layout) {
  const { z0, z1 } = NORTH_ROW;
  const top = 3.6;
  const tag = 'bakery';
  L.run('wall', true, -32.8, -21.6, z0, z0 + 0.8, 0, top, [[-31.2, -28.0, 2.72]], { tag });
  L.run('wall', true, -32.8, -21.6, z1 - 0.8, z1, 0, top, [[-25.6, -22.4, 2.72]], { tag });
  L.add('wall', -32.8, 0, z0 + 0.8, -32.0, top, z1 - 0.8, { tag });
  L.add('wall', -22.4, 0, z0 + 0.8, -21.6, top, z1 - 0.8, { tag });
  L.add('ceiling', -32.8, top, z0, -21.6, 10.56, z1, { tag });
  L.add('shelf', -28.8, 0, -20.0, -25.6, 2.4, -19.2, { tag });
  L.add('counter', -31.2, 0, -18.4, -29.6, 1.28, -16.8, { tag });
  for (const [x, z] of [[-29.6, -20.8], [-26.8, -20.8], [-23.2, -20.8], [-27.2, -17.6], [-23.6, -17.6]] as const) L.seed(x, 0, z);
}

/** Town Gate: Gate Street runs under a double arch in the north row from the terminus into the square's north-west corner. */
function gate(L: Layout) {
  const { z0, z1 } = NORTH_ROW;
  L.add('ceiling', -18.4, 5.6, z0, -8.8, 13.92, z1, { tag: 'gate' });
  L.add('wall', -14.4, 0, z0, -12.8, 5.6, z1, { tag: 'gate' });
}

/**
 * Boatyard on the quay: high walls open to the sky (grenades lob in), a loft along the north wall with a stair up
 * each end, a boat on its cradle inside the boat doors to the quay.
 */
function boatyard(L: Layout) {
  const H = 7.2;
  const tag = 'shed';
  const x0 = 20.8;
  const x1 = 30.4;
  const z0 = -28.8;
  const z1 = -16.0;
  L.run('wall', true, x0, x1, z0, z0 + 0.8, 0, H, [[24.0, 26.4, 2.72]], { tag });
  L.add('wall', x0, 0, z0 + 0.8, x0 + 0.8, H, z1, { tag });
  L.run('wall', true, x0 + 0.8, x1, z1 - 0.8, z1, 0, H, [[24.0, 26.4, 2.72]], { tag });
  // Quay wall: the boat doors.
  L.run('wall', false, z0 + 0.8, z1 - 0.8, x1 - 0.8, x1, 0, H, [[-22.4, -19.2, 3.04]], { tag });
  // Loft over the north half: a stair up each end wall, a solid balustrade over the floor.
  L.add('slab', x0 + 0.8, 2.8, z0 + 0.8, x1 - 0.8, 3.2, -24.8, { walk: true, surface: 'wood', tag });
  L.add('parapet', 23.2, 3.2, -25.0, 28.0, 4.16, -24.8, { surface: 'wood', tag });
  L.add('rail', 23.2, 4.16, -25.0, 28.0, 4.64, -24.8, { pass: true, surface: 'wood', tag });
  L.flight(22.4, -18.4, 0, 'n', 1.6, 8, 0.4, tag);
  L.flight(28.8, -18.4, 0, 'n', 1.6, 8, 0.4, tag);
  // The west flight climbs behind a boarded wall (an approach the loft cannot watch); the east one has a banister.
  L.add('wall', 23.2, 0, -24.8, 23.4, 4.8, -18.4, { surface: 'wood', tag });
  L.add('rail', 27.8, 0, -24.8, 28.0, 4.8, -18.4, { pass: true, surface: 'wood', tag });
  // The boat on its cradle: waist-high cover, no line in from the quay doors to the west door.
  L.add('stack', 24.8, 0, -22.4, 26.4, 1.6, -18.4, { surface: 'wood', tag });
  for (const [x, z] of [[27.2, -17.6], [25.6, -23.2], [22.4, -16.9], [29.0, -16.9], [25.2, -27.2]] as const) L.seed(x, 0, z);
  L.seed(25.6, 3.2, -26.4).seed(29.0, 3.2, -26.4);
}

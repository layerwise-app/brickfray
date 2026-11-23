import { EDGE, type Layout } from './plaza-layout';

/**
 * Town hall on the square's east side: a council hall behind the arcade, the clock tower over its middle. Its main
 * doors line up along x at z = 0 (audio/rooms.ts reads `x0`, `x1`, `tunnel`, `tunnelTop`); the tower stands over
 * `towerX0..towerX1`, its belfry over `x0..shaftX1` measured from the tower's west face. `hall` is the half-depth.
 */
export const TOWER = {
  x0: 13.6, x1: 26.4, z: 2.4, tunnel: 1.6, tunnelTop: 3.04, floor: 13.92, top: 13.92, hall: 10.4,
  towerX0: 17.6, shaftX1: 22.4, belfryTop: 24.0, wall: 0.8, ceiling: 6.4
} as const;
/** Colonnade along the town hall's west face under the loggia deck; the hall wall behind it (audio/rooms.ts). */
export const ARCADE = { x0: 10.4, x1: 13.6, z0: -10.4, z1: 10.4, deck: 3.84, slab: 0.48, back: 13.6 } as const;
/** Market hall: its west wall is the edge of town, its east front the square's west side, the gallery over its square doors. */
export const HALL = {
  x0: -EDGE.x, x1: -16.8, z0: -12.0, z1: 12.0, wall: 0.8, top: 7.2, gallery: 3.2, galleryX: -20.8,
  windows: [[-4.4, -3.6], [3.6, 4.4]] as [number, number][]
} as const;
/** Canal arm from the town hall's back door to the east canal; footbridge at its head, road bridge for the quay. */
export const CANAL = { x0: TOWER.x1, z: 2.4, parapet: 1.44, foot: [26.4, 29.6], road: [33.6, 42.4] } as const;
/** The square between the hall yard and the arcade, the north and south rows. */
export const SQUARE = { x0: -16.8, x1: ARCADE.x0, z0: -16.0, z1: 16.0 } as const;

export function middleDistrict(L: Layout) {
  hall(L);
  square(L);
  arcade(L);
  townHall(L);
  canal(L);
}

function hall(L: Layout) {
  const { x0, x1, z0, z1, wall: w, top, gallery: g, galleryX: gx } = HALL;
  const tag = 'hall';
  L.run('wall', true, x0, x1, z0, z0 + w, 0, top, [[-41.6, -38.4, 3.2]], { tag });
  L.run('wall', true, x0, x1, z1 - w, z1, 0, top, [[-33.6, -30.4, 3.2]], { tag });
  // West wall on the edge of town: two tall barred windows onto the street behind (bars stop players, not eyes).
  let at: number = z0 + w;
  for (const [a, b] of [[-5.2, -2.8], [2.8, 5.2]] as const) {
    L.add('wall', x0, 0, at, x0 + w, top, a, { tag });
    L.add('wall', x0, 0, a, x0 + w, 1.2, b, { tag });
    L.add('lintel', x0, 4.0, a, x0 + w, top, b, { tag });
    L.add('rail', x0, 1.2, a, x0 + w, 4.0, b, { pass: true, surface: 'metal', tag });
    at = b;
  }
  L.add('wall', x0, 0, at, x0 + w, top, z1 - w, { tag });
  L.run('wall', false, z0 + w, z1 - w, x1 - w, x1, 0, g, [[-10.4, -7.2, 2.72], [7.2, 10.4, 2.72]], { tag });
  // Over the gallery the square front has two windows facing the loggia across the square: the gallery's rival.
  at = z0 + w;
  for (const [a, b] of HALL.windows) {
    L.add('wall', x1 - w, g, at, x1, top, a, { tag });
    L.add('wall', x1 - w, g, a, x1, g + 1.0, b, { tag });
    L.add('lintel', x1 - w, g + 2.4, a, x1, top, b, { tag });
    L.add('rail', x1 - w, g + 1.0, a, x1, g + 1.44, b, { pass: true, surface: 'metal', tag });
    at = b;
  }
  L.add('wall', x1 - w, g, at, x1, top, z1 - w, { tag });
  // Each window sits at the back of a 1.6 m bay: it frames the loggia and a strip of the square, not the whole square.
  for (const [a, b] of HALL.windows) for (const [c0, c1] of [[a - 0.4, a], [b, b + 0.4]]) L.add('wall', x1 - w - 1.6, g, c0, x1 - w, top, c1, { tag });
  L.add('roof', x0, top, z0, x1, top + 0.4, z1, { tag });
  // Gallery along the east wall over the square doors, reached by a stair along each end wall.
  L.add('slab', gx, g - 0.4, z0 + w, x1 - w, g, z1 - w, { walk: true, surface: 'wood', tag });
  L.add('parapet', gx - 0.4, g, -9.6, gx, g + 0.96, 9.6, { tag });
  L.add('rail', gx - 0.4, g + 0.96, -9.6, gx, g + 1.44, 9.6, { pass: true, surface: 'metal', tag });
  L.flight(gx - 6.4, -10.4, 0, 'e', 1.6, 8, 0.4, tag);
  L.flight(gx - 6.4, 10.4, 0, 'e', 1.6, 8, 0.4, tag);
  // The north stair climbs behind a solid wall (an approach the gallery cannot watch); the south one has a banister.
  L.add('wall', gx - 6.4, 0, -9.6, gx, 4.8, -9.4, { tag });
  L.add('rail', gx - 6.4, 0, 9.4, gx, 4.8, 9.6, { pass: true, surface: 'metal', tag });
  for (const z of [-8.0, -3.2, 3.2, 8.0]) L.seed(-20.0, g, z);
  // Iron columns, stall counters (too tall to hop) and stall stands: half cover on the floor, 20 m aisles kept across.
  for (const [px, pz] of [[-36.0, -4.8], [-36.0, 4.8], [-28.0, -4.8], [-28.0, 4.8]] as const) L.add('pillar', px - 0.4, 0, pz - 0.4, px + 0.4, top, pz + 0.4, { tag });
  for (const [cx, cz] of [[-32.0, -7.2], [-32.0, 0], [-32.0, 7.2], [-24.4, -2.4], [-24.4, 2.4]] as const) L.add('counter', cx - 1.6, 0, cz - 0.6, cx + 1.6, 1.28, cz + 0.6, { tag });
  L.add('shelf', -40.8, 0, -1.6, -37.6, 2.4, 1.6, { tag });
  L.add('shelf', -40.0, 0, 6.4, -39.2, 2.4, 8.8, { tag });
  L.add('shelf', -40.0, 0, -8.8, -39.2, 2.4, -6.4, { tag });
  for (const s of [-1, 1]) L.add('shelf', -25.6, 0, s > 0 ? 5.6 : -9.6, -24.8, 2.4, s > 0 ? 9.6 : -5.6, { tag });
  for (const [x, z] of [[-42.0, -8.8], [-42.0, 8.8], [-37.6, -3.2], [-37.6, 3.2], [-32.0, -3.6], [-32.0, 3.6], [-28.0, -8.8], [-28.0, 8.8], [-24.4, 0], [-22.4, -6.4], [-22.4, 6.4]] as const) L.seed(x, 0, z);
}

/** The square: a fountain, statue and kiosks round its middle, the bandstand in one corner, half walls between. */
function square(L: Layout) {
  const tag = 'square';
  // Bandstand (raised 0.96 m, roofed) in the north-west quarter: eyes on it stay under the kiosk roofs.
  const bz = 0.8;
  L.add('stage', -15.2, 0, -13.6 + bz, -8.8, 0.96, -7.2 + bz, { walk: true, surface: 'wood', tag });
  for (const [px, pz] of [[-14.8, -13.2], [-9.2, -13.2], [-14.8, -7.6], [-9.2, -7.6]] as const) L.add('pillar', px - 0.25, 0.96, pz + bz - 0.25, px + 0.25, 3.84, pz + bz + 0.25, { tag });
  L.add('roof', -15.8, 3.84, -14.2 + bz, -8.2, 4.52, -6.6 + bz, { tag });
  L.flight(-12.0, -5.6 + bz, 0, 'n', 2.4, 2, 0.48, tag);
  L.flight(-7.2, -10.4 + bz, 0, 'w', 2.4, 2, 0.48, tag);
  for (const x of [-13.6, -10.8]) L.add('parapet', x, 0, -7.2 + bz, x + 0.4, 0.96, -5.6 + bz, { tag });
  for (const z of [-12.0, -9.2]) L.add('parapet', -8.8, 0, z + bz, -7.2, 0.96, z + bz + 0.4, { tag });
  // Balustrade round the deck (open at the two stairs), its handrail out of reach: the arch frames the bandstand, not the square.
  for (const [a, b, c, e] of [[-15.2, -13.6, -8.8, -13.2], [-15.2, -13.2, -14.8, -7.6], [-15.2, -7.6, -13.2, -7.2], [-10.8, -7.6, -8.8, -7.2], [-9.2, -13.2, -8.8, -11.6], [-9.2, -9.2, -8.8, -7.6]] as const) {
    L.add('parapet', a, 0.96, b + bz, c, 1.92, e + bz, { surface: 'wood', tag: 'bandstand' });
    L.add('rail', a, 1.92, b + bz, c, 2.32, e + bz, { pass: true, surface: 'wood', tag: 'bandstand' });
  }
  // The monument in the middle (a waist-high plinth round a thin obelisk) and the fountain in the south-west quarter.
  L.add('plinth', -5.6, 0, -2.4, -0.8, 1.28, 2.4, { tag });
  L.add('plinth', -3.6, 1.28, -0.4, -2.8, 7.2, 0.4, { tag });
  L.add('basin', -14.4, 0, 4.8, -8.0, 0.48, 11.2, { walk: true, tag });
  L.add('pillar', -12.4, 0, 6.8, -10.0, 2.72, 9.2, { tag: 'fountain' });
  // Market counters and flower beds: waist-high cover in clusters, so rifles see across the square from cover to cover.
  for (const [a, b, c, e] of [[2.4, 6.0, 5.6, 7.2], [-5.6, 8.8, -2.4, 10.0], [2.4, -14.4, 5.6, -13.2]] as const) {
    L.add('counter', a, 0, b, c, 1.28, e, { tag: 'stall' });
  }
  for (const [a, b, c, e] of [[8.0, -12.8, 9.6, -10.4], [8.0, 10.4, 9.6, 12.8]] as const) L.add('garden', a, 0, b, c, 1.28, e, { tag: 'planter' });
  // Flower and news stands against the rows: they close the strips along the square's edges, so the streets past the
  // town hall never line up with the hall doors.
  for (const [a, b, c, e] of [[-16.8, 13.6, -13.6, 16.0], [-13.6, 13.6, -10.4, 16.0], [-1.6, 11.6, 0.8, 16.0], [-4.8, -16.0, -2.4, -13.6]] as const) L.add('kiosk', a, 0, b, c, 2.72, e, { tag });
  // A news stand against the bandstand where the gate opens: the gate shows the yard or the bandstand, never the square's length.
  L.add('kiosk', -19.2, 0, -15.2, -15.2, 2.72, -12.0, { tag });
  // A poster column at the east arch's mouth and a flower stall on the hall's south-east corner: no line runs from the
  // terminus through the gate to Café Steps, or from the laundrette across the square to the town hall door.
  L.add('pillar', -9.2, 0, -14.8, -8.0, 2.72, -13.6, { tag: 'poster' });
  L.add('kiosk', -18.4, 0, 12.0, -16.8, 2.72, 13.2, { tag: 'flowers' });
  // Market stalls across the hall's side streets: the lanes reach the hall doors, the yard the shops.
  L.add('kiosk', -30.4, 0, -16.0, -28.0, 2.72, -12.0, { tag: 'lane' });
  L.add('kiosk', -30.4, 0, 12.0, -28.0, 2.72, 16.0, { tag: 'lane' });
  // Half walls (planters) every few metres: crouch cover across the open stone.
  for (const [a, b, c, e] of [[4.0, -12.0, 7.2, -11.2], [-1.6, 8.8, 0.8, 9.6], [6.4, -0.8, 7.2, 2.4], [-14.4, -1.6, -13.6, 1.6], [-4.8, -10.4, -1.6, -9.6]] as const) {
    L.add('garden', a, 0, b, c, 1.28, e, { tag: 'planter' });
  }
}

/** Colonnade with a loggia above (a window at each end, a grenade's throw from the square), one town hall stair up each end. */
function arcade(L: Layout) {
  const { x0, x1, z0, z1, deck, slab } = ARCADE;
  const tag = 'arcade';
  const low = deck - slab;
  for (let z = z0; z <= z1 + 1e-6; z += 3.2) L.add('pillar', x0, 0, Math.max(z0, z - 0.25), x0 + 0.5, low, Math.min(z1, z + 0.25), { tag });
  L.add('slab', x0, low, z0, x1, deck, z1, { walk: true, surface: 'stone', tag });
  const roof = deck + 3.2;
  const sill = deck + 1.0;
  const head = deck + 2.4;
  const win: [number, number][] = [[-7.6, -6.8], [6.8, 7.6]];
  let at: number = z0;
  for (const [a, b] of win) {
    L.add('wall', x0, deck, at, x0 + 0.4, roof, a, { tag });
    L.add('wall', x0, deck, a, x0 + 0.4, sill, b, { tag });
    L.add('lintel', x0, head, a, x0 + 0.4, roof, b, { tag });
    L.add('rail', x0, sill, a, x0 + 0.4, deck + 1.44, b, { pass: true, surface: 'metal', tag });
    at = b;
  }
  L.add('wall', x0, deck, at, x0 + 0.4, roof, z1, { tag });
  L.add('wall', x0 + 0.4, deck, z0, x1, roof, z0 + 0.4, { tag });
  L.add('wall', x0 + 0.4, deck, z1 - 0.4, x1, roof, z1, { tag });
  // Two staggered piers halfway along: the loggia between the stairs is a loop with a dog-leg, not one 20 m line.
  L.add('wall', x0 + 0.4, deck, -2.4, 12.4, roof, -1.6, { tag });
  L.add('wall', 12.0, deck, 1.6, x1, roof, 2.4, { tag });
  L.add('roof', x0, roof, z0, x1, roof + 0.4, z1, { tag });
  for (const [x, z] of [[12.0, -8.8], [12.0, -6.4], [12.0, -4.0], [13.0, -2.0], [12.2, 0], [11.4, 2.0], [12.0, 4.0], [12.0, 6.4], [12.0, 8.8]] as const) L.seed(x, deck, z);
  for (const z of [-8.8, -4.0, 4.0, 8.8]) L.seed(9.2, 0, z);
}

/**
 * Council hall: doors on all four sides (west from the arcade and east onto the canal footbridge on one axis),
 * columns and benches, a stair up each end of the west wall behind a stringer wall to the loggia doors.
 */
function townHall(L: Layout) {
  const { x0, x1, hall: h, wall: w, ceiling } = TOWER;
  const tag = 'townhall';
  const t = TOWER.tunnel;
  const deck = ARCADE.deck;
  // West wall: the main door on the axis, and above the arcade deck a door into each end of the loggia.
  L.add('wall', x0, 0, -h, x0 + w, deck, -t, { tag });
  L.add('wall', x0, 0, t, x0 + w, deck, h, { tag });
  L.add('lintel', x0, TOWER.tunnelTop, -t, x0 + w, deck, t, { tag });
  L.seed(x0 - 1.0, 0, 0).seed(x0 + w + 1.0, 0, 0);
  L.run('wall', false, -h, h, x0, x0 + w, deck, ceiling, [[-(h - w), -(h - w) + 1.6, deck + 2.4], [h - w - 1.6, h - w, deck + 2.4]], { tag });
  L.run('wall', false, -h, h, x1 - w, x1, 0, ceiling, [[4.8, 8.0, TOWER.tunnelTop]], { tag });
  L.run('wall', true, x0 + w, x1 - w, -h, -h + w, 0, ceiling, [[19.2, 22.4, 3.04]], { tag });
  L.run('wall', true, x0 + w, x1 - w, h - w, h, 0, ceiling, [[19.2, 22.4, 3.04]], { tag });
  L.add('ceiling', x0, ceiling, -h, x1, TOWER.top, h, { tag });
  L.add('tower', TOWER.towerX0, TOWER.top, -TOWER.z, TOWER.shaftX1, TOWER.belfryTop, TOWER.z, { surface: 'stone', tag });
  // Loggia stairs: up along the west wall from beside the main door to the loggia doors, behind a stringer wall up to
  // the ceiling (the hall cannot see who climbs, the stair cannot see the hall).
  const inner = x0 + w;
  for (const s of [-1, 1]) {
    const foot = s * 3.2;
    const zEnd = s * (h - w);
    L.flight(inner + 0.8, foot, 0, s < 0 ? 'n' : 's', 1.6, 8, deck / 8, tag);
    L.add('wall', inner + 1.6, 0, Math.min(foot, zEnd), inner + 2.0, ceiling, Math.max(foot, zEnd), { tag });
  }
  for (const [px, pz] of [[18.8, -4.8], [23.2, -4.8], [18.8, 4.8], [23.2, 4.8]] as const) L.add('pillar', px - 0.4, 0, pz - 0.4, px + 0.4, ceiling, pz + 0.4, { surface: 'stone', tag });
  L.add('counter', 18.4, 0, -1.2, 20.0, 1.28, 1.2, { tag: 'bench' });
  L.add('counter', 22.4, 0, -1.2, 24.0, 1.28, 1.2, { tag: 'bench' });
  L.add('shelf', 23.6, 0, 4.0, 24.0, 2.72, h - w, { tag });
  for (const [x, z] of [[21.0, -8.0], [21.0, 8.0], [17.4, -6.4], [17.4, 6.4], [24.8, -6.4], [24.8, 6.4], [21.0, -2.8], [21.0, 2.8], [16.8, 0], [25.0, 0]] as const) L.seed(x, 0, z);
  for (const s of [-1, 1]) L.seed(inner + 0.8, deck, s * 9.0);
  // A news stand in the street behind the town hall, overlapping the lock hut's line: no line runs from the square to the quay.
  L.add('kiosk', 22.4, 0, 12.4, 24.8, 2.72, 16.0, { tag: 'news' });
}

/** Canal arm from the town hall's back door to the east canal: a flat footbridge at its head, a road bridge for the quay. */
function canal(L: Layout) {
  const { z, parapet } = CANAL;
  const tag = 'canal';
  const guard = (a: number, b: number, c0: number, c1: number, y: number, alongX: boolean) => {
    const kerb = y + 0.48;
    const top = y + parapet;
    if (alongX) {
      L.add('parapet', a, y, c0, b, kerb, c1, { tag });
      L.add('rail', a, kerb, c0, b, top, c1, { pass: true, surface: 'metal', tag });
    } else {
      L.add('parapet', c0, y, a, c1, kerb, b, { tag });
      L.add('rail', c0, kerb, a, c1, top, b, { pass: true, surface: 'metal', tag });
    }
  };
  const [f0, f1] = CANAL.foot;
  const [r0, r1] = CANAL.road;
  L.add('bed', f1, -2.4, -z, EDGE.x, -1.6, z, { tag });
  L.add('deck', f0, -2.4, -z, f1, 0, z, { walk: true, surface: 'stone', tag });
  L.add('deck', r0, -0.8, -z, r1, 0, z, { walk: true, surface: 'stone', tag });
  for (const s of [-1, 1]) {
    const za = s < 0 ? -z - 0.4 : z;
    guard(f1, r0, za, za + 0.4, 0, true);
    guard(r1, EDGE.x, za, za + 0.4, 0, true);
  }
  guard(-z - 0.4, z + 0.4, f1, f1 + 0.4, 0, false);
  for (const x of [r0 - 0.4, r1]) guard(-z - 0.4, z + 0.4, x, x + 0.4, 0, false);
  // Lock-keeper's huts on the canal-head corners: the streets past the town hall end at a hut, not down the quay.
  for (const s of [-1, 1]) L.add('kiosk', TOWER.x1, 0, s < 0 ? -12.8 : 10.4, TOWER.x1 + 2.4, 2.72, s < 0 ? -10.4 : 12.8, { tag: 'lock' });
  L.seed((f0 + f1) / 2, 0, 0).seed((r0 + r1) / 2, 0, 0).seed((r0 + r1) / 2, 0, -1.6).seed((r0 + r1) / 2, 0, 1.6);
}

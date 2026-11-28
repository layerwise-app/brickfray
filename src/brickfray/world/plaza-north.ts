import { BASE, BLVD, halves, houses, type Layout, NROW, type Side, STREET, SQ } from './plaza-layout';

/** Market hall (west) and the tram station hall (east) between the boulevard and the square: the north connector. */
export const HALL = { x0: -38.4, x1: -20.8, z0: NROW.z0, z1: NROW.z1, wall: 0.8, top: 7.2, north: [-36.0, -32.0], south: [-26.4, -22.4] } as const;
/** Grand Café: the middle of the north row, its first-floor balcony over the boulevard (raised place R3). */
export const CAFE = { x: 12.8, deck: 3.6, z0: BLVD.z1 - BLVD.jog - 2.2, z1: BLVD.z1 - BLVD.jog, h: 13.92, back: -21.6 } as const;
/** The parked tram on the north kerb in the boulevard's middle. */
export const TRAM = { x: 8.0, z0: BLVD.z0 - BLVD.jog, z1: BLVD.z0 - BLVD.jog + 2.4, h: 3.2 } as const;

/** The tram boulevard (north lane), the north row of houses, both halls, the Grand Café and its balcony. */
export function northDistrict(L: Layout) {
  halves(L, (S) => {
    row(S);
    hall(S);
    boulevard(S);
  });
  cafe(L);
}

function row(S: Side) {
  // North-west corner block: house fronts on the boulevard and the base road, on Market Street and the square.
  houses(S, -BASE, HALL.x0, NROW.z0, -25.2, [10.56, 13.92, 12.24], 'n', S.tag('old', 'stn'), ['w']);
  S.block(-BASE, -25.2, HALL.x0, NROW.z1, 10.56, ['w'], S.tag('old', 'stn'));
  houses(S, -BASE, SQ.x0, NROW.z1, STREET.z0, [12.24, 10.56, 13.92, 10.56], 's', S.tag('old', 'stn'), ['w', 'e']);
}

/**
 * Hall of iron columns and stall rows: the boulevard door at its west end, the square door at its east end, so the
 * line between them runs diagonally across the floor (15 m) past the columns.
 */
function hall(S: Side) {
  const { x0, x1, z0, z1, wall: w, top } = HALL;
  const tag = S.tag('hall', 'station');
  S.run('wall', true, x0, x1, z0, z0 + w, 0, top, [[HALL.north[0], HALL.north[1], 3.6]], { tag });
  S.run('wall', true, x0, x1, z1 - w, z1, 0, top, [[HALL.south[0], HALL.south[1], 3.6]], { tag });
  S.add('wall', x0, 0, z0 + w, x0 + w, top, z1 - w, { tag });
  S.add('wall', x1 - w, 0, z0 + w, x1, top, z1 - w, { tag });
  S.add('roof', x0, top, z0, x1, top + 0.4, z1, { tag });
  // Iron columns down the middle, stall counters (waist high) along the walls.
  for (const x of [-34.4, -28.0, -24.8]) S.add('pillar', x - 0.3, 0, -25.5, x + 0.3, top, -24.9, { tag, surface: 'metal' });
  S.add('counter', -37.6, 0, -20.8, -34.4, 1.32, -20.0, { tag });
  S.add('counter', -27.2, 0, -30.4, -24.0, 1.32, -29.6, { tag });
  for (const [x, z] of [[-35.2, -28.0], [-32.0, -26.8], [-27.2, -22.0], [-23.2, -26.0], [-33.6, -21.6], [-25.6, -24.4]] as const) S.seed(x, 0, z);
}

/**
 * Boulevard cover, west half (the east mirrors it): a news kiosk with a planter against the corner block at the base
 * mouth, a tram shelter on the north kerb, a delivery van on the pavement at the market hall, an advert column
 * mid-street; the middle has the tram, the ticket kiosk and the café planters.
 */
function boulevard(S: Side) {
  const z1 = BLVD.z1;
  S.add('kiosk', -50.4, 0, z1 - 2.4, -48.0, 2.72, z1, { tag: 'news' });
  S.add('garden', -52.8, 0, z1 - 1.2, -50.4, 1.32, z1, { tag: 'planter' });
  S.add('shelter', -37.2, 0, BLVD.z0, -32.4, 2.4, BLVD.z0 + 1.6, { surface: 'glass', tag: 'tram' });
  S.add('roof', -37.6, 2.4, BLVD.z0, -32.0, 2.56, BLVD.z0 + 2.4, { surface: 'glass', tag: 'shelter' });
  S.add('garden', -48.0, 0, BLVD.z0, -45.6, 1.32, BLVD.z0 + 1.2, { tag: 'planter' });
  S.add('stack', -30.4, 0, z1 - 2.0, -25.6, 2.4, z1, { surface: 'metal', tag: 'van' });
  S.add('stack', -25.6, 0, z1 - 1.2, -24.0, 1.32, z1, { surface: 'wood', tag: 'crates' });
  S.add('pillar', -26.4, 0, -38.8, -25.2, 2.72, -37.6, { tag: 'poster' });
}

/** The café front between the halls; its balcony over the boulevard with an iron stair down each end along the front. */
function cafe(L: Layout) {
  const { x, deck, z0, z1, h } = CAFE;
  const front = NROW.z0 - BLVD.jog;
  L.block(HALL.x1, front, -x, CAFE.back, 12.24, ['n', 's', 'w'], 'cafe-w');
  L.block(-x, front, x, CAFE.back, h, ['n', 's'], 'cafe');
  L.block(x, front, -HALL.x1, CAFE.back, 12.24, ['n', 's', 'e'], 'cafe-e');
  L.add('slab', -x, deck - 0.4, z0, x, deck, z1, { walk: true, surface: 'stone', tag: 'balcony' });
  L.add('parapet', -x, deck, z0, x, deck + 1.0, z0 + 0.4, { tag: 'balcony' });
  L.add('rail', -x, deck + 1.0, z0, x, deck + 1.6, z0 + 0.4, { pass: true, surface: 'metal', tag: 'balcony' });
  L.flight(-x - 7.2, z1 - 0.8, 0, 'e', 1.6, 9, deck / 9, 'balcony');
  L.flight(x + 7.2, z1 - 0.8, 0, 'w', 1.6, 9, deck / 9, 'balcony');
  for (const sx of [-8, -2.4, 2.4, 8]) L.seed(sx, deck, (z0 + z1) / 2 + 0.2);
  // Middle of the boulevard: the tram on the north kerb, the ticket kiosk in the street, café planters by the front.
  L.add('tram', -TRAM.x, 0, TRAM.z0, TRAM.x, TRAM.h, TRAM.z1, { surface: 'metal', tag: 'tram' });
  L.add('kiosk', -1.2, 0, -41.6, 1.2, 2.72, -39.2, { tag: 'tickets' });
  for (const s of [-1, 1]) L.add('garden', s * 3.2, 0, z0 - 2.0, s * 5.6, 1.32, z0 - 0.8, { tag: 'planter' });
}

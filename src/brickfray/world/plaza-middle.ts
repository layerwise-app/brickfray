import { halves, type Layout, type Side, SQ, STREET } from './plaza-layout';
import { CAFE } from './plaza-north';
import { ARCADE } from './plaza-south';

/**
 * Town hall between the two squares: the council hall inside (audio/rooms.ts reads `x0`, `x1`), the clock tower over
 * its north half, the portico (raised place R1) along its south front. `ceiling` is the hall's inner height.
 */
export const TOWER = {
  x0: SQ.x1, x1: -SQ.x1, z0: -11.2, z1: 6.4, wall: 0.8, ceiling: 6.4, top: 13.92, door: 1.6, doorTop: 3.04,
  shaft: { x0: -3.2, x1: 3.2, z0: -11.2, z1: -4.8 }, belfryTop: 24.8
} as const;
/** Portico: a stone podium along the town hall's south front, steps down into each square at its ends. */
export const PORTICO = { z0: TOWER.z1, z1: 10.4, deck: 2.88, steps: 6, stepX: 14.4 } as const;
/** Tower Street (north of the town hall) and Portico Lane (south of the portico) join the squares. */
export const LANES = { tower: [CAFE.back, TOWER.z0], portico: [PORTICO.z1, ARCADE.lane] } as const;

/** Market Street (middle lane), both squares and their cover, the town hall with its council hall and portico. */
export function middleDistrict(L: Layout) {
  halves(L, (S) => {
    street(S);
    square(S);
    // Steps up to the portico between two cheek walls (no stepping onto them from the side).
    const { z0, z1, deck, stepX, steps } = PORTICO;
    S.flight(-stepX, (z0 + z1) / 2, 0, 'e', z1 - z0 - 1.6, steps, deck / steps, 'portico');
    for (const [a, b] of [[z0, z0 + 0.8], [z1 - 0.8, z1]] as const) S.add('parapet', -stepX, 0, a, TOWER.x0, deck + 1.6, b, { tag: 'portico' });
  });
  townHall(L);
  portico(L);
  lanes(L);
}

/** Market Street: a delivery van with its crates against the south houses, a flower stall against the north ones. */
function street(S: Side) {
  const { z0, z1 } = STREET;
  S.add('stack', -47.2, 0, z1 - 1.6, -43.2, 1.32, z1, { surface: 'wood', tag: 'crates' });
  S.add('kiosk', -38.4, 0, z0, -36.0, 2.72, z0 + 2.4, { tag: S.tag('flowers', 'news') });
  S.add('counter', -36.0, 0, z0, -33.6, 1.32, z0 + 1.2, { tag: 'flowers' });
}

/**
 * Fountain Square (west) / Market Square (east): three clusters with clean stone between them. North: a stall kiosk
 * with crates and a counter (the hall door's first stop); middle: the fountain (statue in the east) right in front of
 * Market Street's mouth; south bay: the café kiosk and its planters by Portico Lane.
 */
function square(S: Side) {
  const west = S.west;
  S.add('kiosk', -20.0, 0, -16.0, -17.6, 2.72, -13.6, { tag: west ? 'stall' : 'flowers' });
  S.add('stack', -17.6, 0, -15.2, -16.4, 1.32, -14.0, { surface: 'wood', tag: 'crates' });
  S.add('counter', -23.2, 0, -16.0, -20.0, 1.32, -14.8, { tag: 'stall' });
  if (west) {
    S.add('basin', -22.4, 0, -5.6, -16.0, 1.32, 0.8, { tag: 'square' });
    S.add('pillar', -20.0, 1.32, -3.2, -18.4, 3.92, -1.6, { tag: 'fountain' });
  } else {
    S.add('plinth', -21.6, 0, -4.0, -16.8, 1.32, 0.8, { tag: 'square' });
    S.add('plinth', -19.6, 1.32, -2.0, -18.8, 7.2, -1.2, { tag: 'square' });
  }
  S.add('kiosk', SQ.bay, 0, 9.6, SQ.bay + 2.4, 2.72, 12.0, { tag: west ? 'cafe' : 'news' });
  S.add('garden', -27.2, 0, 7.2, -24.8, 1.32, 8.4, { tag: 'planter' });
  S.add('garden', -22.4, 0, 11.2, -20.0, 1.32, 12.4, { tag: 'planter' });
  for (const [x, z] of [[-24.0, -16.8], [-14.4, -14.4], [-25.6, -4.0], [-13.6, -1.6], [-26.4, 4.0], [-17.6, 4.8], [-16.0, 13.6], [-27.2, 14.4]] as const) S.seed(x, 0, z);
}

/**
 * Council hall: a door from Tower Street, a notice-board stand in front of it so no line runs through, columns, and a
 * straight stair up the middle to the door onto the portico (its hidden way up).
 */
function townHall(L: Layout) {
  const { x0, x1, z0, z1, wall: w, ceiling: c, top, door, doorTop } = TOWER;
  const tag = 'townhall';
  const deck = PORTICO.deck;
  L.run('wall', true, x0, x1, z0, z0 + w, 0, c, [[-door, door, doorTop]], { tag });
  L.add('wall', x0, 0, z1 - w, -door, c, z1, { tag });
  L.add('wall', door, 0, z1 - w, x1, c, z1, { tag });
  L.add('wall', -door, 0, z1 - w, door, deck, z1, { tag });
  L.add('lintel', -door, deck + 3.04, z1 - w, door, c, z1, { tag });
  L.add('wall', x0, 0, z0 + w, x0 + w, c, z1 - w, { tag });
  L.add('wall', x1 - w, 0, z0 + w, x1, c, z1 - w, { tag });
  L.add('ceiling', x0, c, z0, x1, top, z1, { tag });
  L.add('tower', TOWER.shaft.x0, top, TOWER.shaft.z0, TOWER.shaft.x1, TOWER.belfryTop, TOWER.shaft.z1, { surface: 'stone', tag });
  // One straight stair up the middle to the portico door (its hidden way up), columns either side.
  const foot = z1 - w - PORTICO.steps * 0.8;
  L.flight(0, foot, 0, 's', 2 * door, PORTICO.steps, deck / PORTICO.steps, tag);
  for (const s of [-1, 1]) L.add('rail', s * door, 0, foot + 0.8, s * (door + 0.2), deck + 1.6, z1 - w, { pass: true, surface: 'wood', tag });
  for (const s of [-1, 1]) L.add('pillar', s * 4.8 - 0.4, 0, -6.8, s * 4.8 + 0.4, c, -6.0, { surface: 'stone', tag });
  L.add('shelf', -2.4, 0, -4.0, 2.4, 2.4, -3.2, { tag: 'notices' });
  for (const [x, z] of [[0, -8.8], [-4.0, -8.8], [4.0, -8.8], [-4.0, -1.2], [4.0, -1.2], [0, 0.8], [-6.4, -4.0], [6.4, -4.0]] as const) L.seed(x, 0, z);
}

/** The portico: a podium the width of the front, a parapet and four columns along it, a roof over it. */
function portico(L: Layout) {
  const { z0, z1, deck } = PORTICO;
  const x = TOWER.x1;
  const tag = 'portico';
  L.add('landing', -x, 0, z0, x, deck, z1, { walk: true, surface: 'stone', tag });
  L.add('parapet', -x, deck, z1 - 0.4, x, deck + 1.0, z1, { tag });
  L.add('rail', -x, deck + 1.0, z1 - 0.4, x, deck + 1.6, z1, { pass: true, surface: 'metal', tag });
  for (const px of [-8.8, -3.2, 3.2, 8.8]) L.add('pillar', px - 0.25, deck + 1.0, z1 - 0.4, px + 0.25, deck + 3.2, z1, { tag });
  L.add('roof', -x, deck + 3.2, z0, x, deck + 3.52, z1, { tag });
  for (const px of [-6.4, 0, 6.4]) L.seed(px, deck, (z0 + z1) / 2);
}

/** Tower Street and Portico Lane keep their middles clear: planters only, against the walls. */
function lanes(L: Layout) {
  for (const s of [-1, 1]) {
    L.add('garden', s * 3.2, 0, LANES.tower[0], s * 5.6, 1.32, LANES.tower[0] + 1.2, { tag: 'planter' });
    L.add('garden', s * 3.2, 0, ARCADE.lane - 1.2, s * 5.6, 1.32, ARCADE.lane, { tag: 'planter' });
  }
}

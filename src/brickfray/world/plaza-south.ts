import { type Layout } from './plaza-layout';

/** South row between the square and the park: laundrette, Café Steps, shops. */
export const SOUTH_ROW = { z0: 16.0, z1: 22.4 } as const;
/** Building site between the park and the quay: a yard, an unfinished frame with a boarded first floor. */
export const SITE = { x0: 21.6, x1: 30.4, z0: 22.4, z1: 31.2, floor: 3.2 } as const;

/** Park Gardens (team 0), the south row with Café Steps and the walk-through laundrette, Laundry Alley, the building site. */
export function southDistrict(L: Layout) {
  row(L);
  laundrette(L);
  park(L);
  site(L);
}

function row(L: Layout) {
  const { z0, z1 } = SOUTH_ROW;
  L.block(-21.6, z0, -8.8, z1, 10.56, ['n', 's'], 'row-s');
  L.block(-8.8, z0, 2.4, z1, 13.92, ['n', 's', 'e'], 'row-s');
  L.block(12.0, z0, 20.8, z1, 10.56, ['n', 's', 'e', 'w'], 'row-s');
  // The café's counter kiosk in Café Steps: the gap shows the park or the town hall door, never both.
  L.add('kiosk', 7.2, 0, 17.6, 9.6, 2.72, 20.0, { tag: 'cafe' });
}

/** Walk-through laundrette: doors at opposite corners and a dryer stack in the middle. */
function laundrette(L: Layout) {
  const { z0, z1 } = SOUTH_ROW;
  const top = 3.6;
  const tag = 'laundrette';
  L.run('wall', true, -32.8, -21.6, z0, z0 + 0.8, 0, top, [[-24.8, -22.4, 2.72]], { tag });
  L.run('wall', true, -32.8, -21.6, z1 - 0.8, z1, 0, top, [[-31.2, -28.0, 2.72]], { tag });
  L.add('wall', -32.8, 0, z0 + 0.8, -32.0, top, z1 - 0.8, { tag });
  L.add('wall', -22.4, 0, z0 + 0.8, -21.6, top, z1 - 0.8, { tag });
  L.add('ceiling', -32.8, top, z0, -21.6, 10.56, z1, { tag });
  L.add('counter', -31.2, 0, 17.6, -29.6, 1.28, 19.2, { tag });
  L.add('shelf', -28.8, 0, 19.2, -25.6, 2.4, 20.0, { tag });
  for (const [x, z] of [[-29.6, 20.8], [-26.8, 20.8], [-23.2, 20.8], [-27.2, 17.6], [-23.6, 17.6]] as const) L.seed(x, 0, z);
}

/** Park: lawns with low hedges, a pavilion and a pond, a gatehouse by the alley, iron railings along the road. */
function park(L: Layout) {
  const tag = 'park';
  // Yew hedges too tall to see over split the lawns into three gardens, their gaps at opposite ends.
  for (const [a, b, c, e] of [[-24.8, 22.4, -24.4, 35.2], [0.0, 27.2, 16.8, 27.6], [-4.0, 27.6, -3.6, 40.0]] as const) L.add('garden', a, 0, b, c, 2.88, e, { tag: 'yew' });
  for (const [a, b, c, e] of [[-17.6, 26.4, -12.0, 26.8], [-30.4, 33.6, -29.6, 37.6]] as const) L.add('garden', a, 0, b, c, 1.28, e, { tag });
  L.add('stage', -11.2, 0, 30.4, -5.6, 0.48, 35.2, { walk: true, surface: 'wood', tag });
  for (const [px, pz] of [[-10.8, 30.8], [-6.0, 30.8], [-10.8, 34.8], [-6.0, 34.8]] as const) L.add('pillar', px - 0.2, 0.48, pz - 0.2, px + 0.2, 3.36, pz + 0.2, { tag });
  L.add('roof', -11.8, 3.36, 29.8, -5.0, 4.0, 35.8, { tag });
  L.add('basin', 8.8, 0, 30.4, 16.0, 0.48, 34.4, { walk: true, tag });
  // Planters along the railings: crouch cover on the open lawns; the yews stand taller than anyone on them.
  for (const [a, b] of [[-41.6, -38.4], [-23.2, -21.6], [-16.8, -13.6], [-1.6, 3.2], [30.4, 33.6], [36.8, 39.2]] as const) L.add('garden', a, 0, 34.4, b, 1.28, 35.2, { tag: 'planter' });
  // A gatehouse at the alley mouth and garden walls by the road: no line runs the length of the lawns.
  L.add('kiosk', -31.2, 0, 26.4, -28.8, 2.72, 30.4, { tag });
  // A well head in Laundry Alley in front of the hall door.
  L.add('kiosk', -36.0, 0, 16.0, -32.8, 2.72, 19.2, { tag: 'lane' });
  for (const z of [25.6, 31.2]) L.seed(-30.0, 0, z);
}

/**
 * Building site: an unfinished frame whose first floor (3.2 m) looks over the site yard through one window, reached by
 * a boarded stair and a stair with a banister inside the shell; the site office and material stacks in the yard.
 */
function site(L: Layout) {
  const tag = 'site';
  const { x0, x1, z0, z1, floor: fl } = SITE;
  // Hoarding between the park and the site.
  L.add('hoarding', 20.8, 0, SOUTH_ROW.z1, 21.2, 2.4, 35.2, { tag });
  for (const x of [x0, x1 - 0.8]) for (const z of [z0, z1 - 0.8]) L.add('frame', x, 0, z, x + 0.8, 6.4, z + 0.8, { tag });
  // Ground floor: blockwork west and east walls, the south wall with a door onto the road, open to the yard.
  L.add('wall', x0, 0, z0 + 0.8, x0 + 0.8, fl, z1 - 0.8, { tag });
  L.add('wall', x1 - 0.8, 0, z0 + 0.8, x1, fl, z1 - 0.8, { tag });
  L.run('wall', true, x0 + 0.8, x1 - 0.8, z1 - 0.8, z1, 0, fl, [[24.8, 27.2, 2.72]], { tag });
  // First floor: slab round the two stair wells, blockwork to 6.4 m, one window over the yard.
  L.add('slab', 24.0, fl - 0.4, z0, 28.0, fl, z1, { walk: true, surface: 'stone', tag });
  L.add('slab', x0, fl - 0.4, 29.6, 24.0, fl, z1, { walk: true, surface: 'stone', tag });
  L.add('slab', 28.0, fl - 0.4, 29.6, x1, fl, z1, { walk: true, surface: 'stone', tag });
  L.add('slab', x0, fl - 0.4, z0, 24.0, fl, 23.2, { walk: true, surface: 'stone', tag });
  L.add('slab', 28.0, fl - 0.4, z0, x1, fl, 23.2, { walk: true, surface: 'stone', tag });
  L.add('wall', x0, fl, z0, x0 + 0.8, 6.4, z1, { tag });
  L.add('wall', x1 - 0.8, fl, z0, x1, 6.4, z1, { tag });
  L.add('wall', x0 + 0.8, fl, z1 - 0.8, x1 - 0.8, 6.4, z1, { tag });
  // The window is over the yard's west half: the town hall stands behind what it sees, not the canal quay.
  L.add('wall', x0 + 0.8, fl, z0, 24.0, 6.4, z0 + 0.4, { tag });
  L.add('wall', 26.4, fl, z0, x1 - 0.8, 6.4, z0 + 0.4, { tag });
  L.add('wall', 24.0, fl, z0, 26.4, fl + 1.0, z0 + 0.4, { tag });
  L.add('rail', 24.0, fl + 1.0, z0, 26.4, fl + 1.44, z0 + 0.4, { pass: true, surface: 'metal', tag });
  L.add('lintel', 24.0, fl + 2.4, z0, 26.4, 6.4, z0 + 0.4, { tag });
  // Two flights up from the yard side: the west one boarded in (the floor cannot watch it), the east one open.
  L.flight(23.2, 23.2, 0, 's', 1.6, 8, fl / 8, tag);
  L.flight(28.8, 23.2, 0, 's', 1.6, 8, fl / 8, tag);
  // Both stop two steps short of the top, so each stair head opens onto the floor (a loop, not a landing pocket).
  L.add('wall', 24.0, 0, 23.2, 24.2, fl + 1.6, 28.0, { surface: 'wood', tag });
  L.add('rail', 27.8, 0, 23.2, 28.0, fl + 1.44, 28.0, { pass: true, surface: 'metal', tag });
  for (const [x, z] of [[26.0, 24.8], [26.0, 28.0], [23.2, 30.0], [28.8, 30.0]] as const) L.seed(x, fl, z);
  for (const [x, z] of [[26.0, 23.6], [26.0, 27.2], [26.0, 29.6]] as const) L.seed(x, 0, z);
  // Site office, the welfare cabins stacked two high (they hide the quay from the window), a skip and stacks.
  L.add('kiosk', 20.8, 0, 17.6, 24.0, 2.72, 20.0, { tag: 'site-office' });
  L.add('kiosk', 26.8, 0, 16.0, 30.4, 5.44, 20.4, { tag: 'site-office' });
  L.add('stack', 25.2, 0, 26.0, 26.8, 2.0, 27.6, { tag });
  L.add('stack', 24.0, 0, 34.4, 26.4, 1.6, 35.6, { tag: 'skip' });
}

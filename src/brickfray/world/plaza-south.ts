import { BASE, halves, houses, type Layout, QUAY, type Side, SQ, SROW, STREET } from './plaza-layout';

/** Town Gate (west; the east has its twin): a double arch under the gate house from Market Street into the yard. */
export const GATE = { x0: -44.0, x1: -36.0, pier: [-40.8, -39.2], z0: STREET.z1, z1: 8.8, arch: 4.0, top: 12.24 } as const;
/** Laundry Yard (west) / Bakery Yard (east) behind the gate. */
export const YARD = { x0: -48.8, x1: GATE.x1, z0: GATE.z1, z1: 19.2 } as const;
/** Steps Alley from the yard to the quay, and the walk-through laundrette (bakery in the east) beside it. */
export const ALLEY = { x0: YARD.x0, x1: -44.8 } as const;
export const SHOP = { x0: ALLEY.x1, x1: GATE.x1, z0: YARD.z1, z1: SROW.z1, top: 3.6, north: [-40.0, -36.8], south: [-44.0, -40.8] } as const;
/** Canal gallery over the arcade (raised place R2); audio/rooms.ts reads x0, x1, z0, z1, deck and slab. */
/** Portico Lane widens to `lane` between the arcade's back and the portico. */
export const ARCADE = { lane: 18.4, x0: -14.4, x1: 14.4, z0: 24.8, z1: SROW.z1, deck: 3.6, slab: 0.48, stair: 11.2, landing: 4.0 } as const;
/** Lock-keeper's house on the canal edge in the middle of the quay. */
export const LOCK = { x: 4.8, z0: 33.6, h: 5.6 } as const;

/** Gate, yard, alley and shop (the south connector), the south row, the canal gallery, the quay and its cover. */
export function southDistrict(L: Layout) {
  halves(L, (S) => {
    blocks(S);
    gate(S);
    shop(S);
    quay(S);
  });
  gallery(L);
}

function blocks(S: Side) {
  const t = S.tag('old', 'stn');
  S.block(-BASE, STREET.z1, GATE.x0, GATE.z1, 10.56, ['n', 'w'], t);
  S.block(GATE.x1, STREET.z1, SQ.bay, GATE.z1, 12.24, ['e', 'n'], t);
  S.block(GATE.x1, GATE.z1, SQ.bay, SROW.z0, 10.56, ['e', 'w'], t);
  S.block(GATE.x1, SROW.z0, SQ.bay, SROW.z1, 12.24, ['s'], t);
  S.block(-BASE, YARD.z0, YARD.x0, SROW.z1, 12.24, ['w', 'e', 's'], t);
  // South row between the square and the quay: fronts on Portico Lane / the square and backs on the quay.
  houses(S, SQ.bay, ARCADE.x0, SROW.z0, 22.8, [10.56, 13.92, 12.24], 'n', S.tag('row-s', 'row-e'));
  houses(S, SQ.bay, ARCADE.x0, 22.8, SROW.z1, [12.24, 10.56, 13.92], 's', S.tag('quay', 'quay-e'));
}

/** The double arch: two 3.2 m passages either side of a pier, the gate house over them. */
function gate(S: Side) {
  const { x0, x1, pier, z0, z1, arch, top } = GATE;
  const tag = S.tag('gate', 'gate-e');
  S.add('ceiling', x0, arch, z0, x1, top, z1, { tag });
  S.add('wall', pier[0], 0, z0, pier[1], arch, z1, { tag });
  for (const x of [(x0 + pier[0]) / 2, (pier[1] + x1) / 2]) for (const z of [z0 - 1.0, (z0 + z1) / 2, z1 + 1.0]) S.seed(x, 0, z);
  // The yard's well and the washing baskets beside it.
  S.add('kiosk', YARD.x0, 0, 11.2, YARD.x0 + 1.6, 2.4, 12.8, { tag: S.tag('well', 'pump') });
  S.add('stack', YARD.x0, 0, 12.8, YARD.x0 + 1.2, 1.32, 14.0, { surface: 'wood', tag: 'baskets' });
  for (const [x, z] of [[-46.4, 11.2], [-38.4, 11.2], [-46.4, 17.2], [-38.4, 17.2]] as const) S.seed(x, 0, z);
}

/** Walk-through laundrette / bakery: yard door at its east end, quay door at its west end, a row of washers between. */
function shop(S: Side) {
  const { x0, x1, z0, z1, top } = SHOP;
  const tag = S.tag('laundrette', 'bakery');
  S.run('wall', true, x0, x1, z0, z0 + 0.8, 0, top, [[SHOP.north[0], SHOP.north[1], 2.72]], { tag });
  S.run('wall', true, x0, x1, z1 - 0.8, z1, 0, top, [[SHOP.south[0], SHOP.south[1], 2.72]], { tag });
  S.add('wall', x0, 0, z0 + 0.8, x0 + 0.8, top, z1 - 0.8, { tag });
  S.add('wall', x1 - 0.8, 0, z0 + 0.8, x1, top, z1 - 0.8, { tag });
  S.add('ceiling', x0, top, z0, x1, 10.56, z1, { tag });
  S.add('counter', -41.6, 0, 23.2, -39.2, 1.32, 24.4, { tag: 'washers' });
  for (const [x, z] of [[-38.4, 21.2], [-42.4, 21.6], [-42.4, 26.4], [-40.0, 26.8], [-38.4, 24.0]] as const) S.seed(x, 0, z);
  for (const z of [20.8, 24.0, 27.2]) S.seed((ALLEY.x0 + ALLEY.x1) / 2, 0, z);
}

/** Quay cover: crates at the base end, the boat-ticket kiosk on the rail with a bench, a bookstall at the gallery's end. */
function quay(S: Side) {
  const { z0 } = QUAY;
  S.add('stack', -50.4, 0, 32.0, -48.0, 1.32, 33.2, { surface: 'wood', tag: 'crates' });
  S.add('kiosk', -40.0, 0, QUAY.side - 2.4, -37.6, 2.72, QUAY.side, { tag: S.tag('boats', 'ices') });
  S.add('counter', -22.4, 0, 33.6, -20.0, 1.32, 34.8, { tag: 'bench' });
  S.add('kiosk', -26.4, 0, z0, -24.0, 2.72, z0 + 2.0, { tag: 'books' });
  S.add('stack', -24.0, 0, z0, -22.8, 1.32, z0 + 1.2, { surface: 'wood', tag: 'crates' });
  for (const [x, z] of [[-52.0, 31.2], [-44.0, 34.4], [-36.0, 31.2], [-28.0, 32.0], [-16.0, 34.4], [-8.0, 31.2], [-12.0, 37.6]] as const) S.seed(x, 0, z);
}

/**
 * The arcade under the canal gallery: columns on the quay edge, the gallery floor over them with an open stair up at
 * each end along the back wall, a parapet with a handrail, and a lean-to roof on posts. The lock-keeper's house stands
 * in front of it on the canal edge.
 */
function gallery(L: Layout) {
  const { x0, x1, z0, z1, deck, slab, stair, landing } = ARCADE;
  const tag = 'arcade';
  const back = z0 + 1.6;
  L.block(x0, ARCADE.lane, x1, z0, 13.92, ['n', 's'], 'arcade');
  for (let x = -10.8; x <= 10.81; x += 3.6) L.add('pillar', x - 0.25, 0, z1 - 0.4, x + 0.25, deck - slab, z1, { tag });
  L.add('slab', x0, deck - slab, back, x1, deck, z1, { walk: true, surface: 'stone', tag });
  L.add('slab', -landing, deck - slab, z0, landing, deck, back, { walk: true, surface: 'stone', tag });
  for (const s of [-1, 1]) {
    L.flight(s * stair, (z0 + back) / 2, 0, s < 0 ? 'e' : 'w', 1.6, 9, deck / 9, tag);
    L.add('rail', s * stair, 0, back, s * landing, deck + 1.6, back + 0.2, { pass: true, surface: 'metal', tag });
  }
  L.add('parapet', x0, deck, z1 - 0.4, x1, deck + 1.0, z1, { tag });
  L.add('rail', x0, deck + 1.0, z1 - 0.4, x1, deck + 1.6, z1, { pass: true, surface: 'metal', tag });
  for (const x of [-10.8, -3.6, 3.6, 10.8]) L.add('pillar', x - 0.2, deck + 1.0, z1 - 0.4, x + 0.2, deck + 3.2, z1, { tag: 'gallery' });
  L.add('roof', x0, deck + 3.2, z0, x1, deck + 3.52, z1, { tag });
  for (const x of [-8.0, -2.4, 2.4, 8.0]) L.seed(x, deck, z1 - 1.2);
  for (const x of [-12.8, -1.6, 1.6, 12.8]) L.seed(x, 0, z0 + 2.4);
  L.block(-LOCK.x, LOCK.z0, LOCK.x, QUAY.z1, LOCK.h, ['n', 'e', 'w'], 'lock');
  for (const x of [-8.0, 8.0]) L.seed(x, 0, 35.2);
}

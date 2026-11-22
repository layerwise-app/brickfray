import { F, type Works } from './fortress-plan';

const H = F.curtain;
const D = F.door;

/** West lane, the close route: the orchard with its dovecote, the stables and the paddock across the middle, the stable yard and tithe barn. */
export function west(w: Works) {
  w.run('wall', false, F.bandN, -8.0, F.core0 - 0.8, F.core0, 0, 6.4, [[-16.8, -10.4, 6.4]]);
  w.run('wall', false, 8.0, F.bandS, F.core0 - 0.8, F.core0, 0, 6.4, [[9.6, 16.0, 6.4]]);
  gateTower(w, -16.8, -12.0);
  gateTower(w, 9.6, 14.4);
  orchard(w);
  stables(w);
  paddock(w);
  yard(w);
}

/** The paddock between the stables and the west flank: [x0, z0, x1, z1] of its wagon shed and its hay stack. */
export const PADDOCK = { shed: [-33.6, -8.8, -27.2, -4.0], hay: [-28.0, 4.0, -22.4, 8.8] } as const;

/**
 * Paddock where the west range stood: open ground from the orchard to the stable yard, the stables' east doors on one side
 * and the wall of the west flank on the other (the gate towers north and south lead through it); a wagon shed in its
 * north half and a hay stack in its south half, on opposite sides, so the lane bends round them and no line runs the
 * length of the west lane.
 */
function paddock(w: Works) {
  w.box('wall', F.core0 - 0.8, 0, -8.8, F.core0, 6.4, 8.8);
  const [a, b, c, d] = PADDOCK.shed;
  w.shed('timber', a, b, c, d, 2.88, '#7a5434');
  const [e, f, g, h] = PADDOCK.hay;
  w.box('hay', e, 0, f, g, 3.2, h);
}

/** Gate tower in the wall between the west lane and the core: a 4 m passage, so lines through it stay short. */
function gateTower(w: Works, z0: number, passage: number) {
  const [x0, x1] = [F.core0 - 2.4, F.core0 + 1.6];
  w.box('tower', x0, 0, z0, x1, 6.4, passage - 3.2);
  w.box('tower', x0, 0, passage, x1, 6.4, z0 + 6.4);
  w.box('tower', x0, D, passage - 3.2, x1, 6.4, passage);
  w.openings.push({ kind: 'tower', alongX: false, a0: passage - 3.2, a1: passage, c0: x0, c1: x1, y0: 0, y1: D, door: true });
  w.roof({ x0: x0 - 0.2, z0: z0 - 0.2, x1: x1 + 0.2, z1: z0 + 6.6, base: 6.4, face: 'e', color: '#2f5d93', wall: '#7f8287' });
}

/** The orchard's dovecote tower: [x0, z0, x1, z1]. */
export const DOVECOTE = [-37.6, -21.6, -32.8, -16.8] as const;

function orchard(w: Works) {
  w.shed('hall', -28.0, -16.0, -24.0, -11.2, 3.2, '#8a3a2a');
  w.box('tower', DOVECOTE[0], 0, DOVECOTE[1], DOVECOTE[2], 6.4, DOVECOTE[3]);
  w.roof({ x0: DOVECOTE[0] - 0.2, z0: DOVECOTE[1] - 0.2, x1: DOVECOTE[2] + 0.2, z1: DOVECOTE[3] + 0.2, base: 6.4, face: 's', color: '#2f5d93', wall: '#7f8287' });
  w.box('wall', -32.0, 0, -21.6, -29.6, F.rail, -20.8);
  w.box('wall', -27.2, 0, -21.6, -24.0, F.rail, -20.8);
}

/** Hay loft over the west half of the stables. */
export const LOFT = { x0: F.west, x1: -40.0, top: 2.88 } as const;

/**
 * Stables against the west edge, two doors east into the paddock. The hay loft is climbed by a stair inside or an
 * open stair from the stable yard to its loft door.
 */
function stables(w: Works) {
  const [x0, x1, z0, z1] = [F.west, -33.6, -8.8, 8.8];
  const top = F.inner;
  const L = LOFT.top;
  w.windows('timber', true, x0, x1, z0, z0 + 0.8, 0, L, [[-37.6, -35.2, 0, D]]);
  w.windows('timber', true, x0, x1, z0, z0 + 0.8, L, top, [[-46.4, -44.8, 3.6, 4.56]]);
  w.windows('timber', true, x0, x1, z1 - 0.8, z1, 0, L, [[-40.0, -37.6, 0, D]]);
  w.windows('timber', true, x0, x1, z1 - 0.8, z1, L, top, [[-47.2, -45.6, L, top]]);
  w.run('timber', false, z0 + 0.8, z1 - 0.8, x1 - 0.8, x1, 0, top, [[-1.2, 1.2, D], [4.0, 6.4, D]]);
  for (const z of [-4.0, 0.0, 4.0]) w.box('timber', x0, 0, z - 0.1, -44.8, 1.36, z + 0.1);
  w.box('hay', LOFT.x1, 0, -1.6, -36.0, 1.92, 1.6);
  w.box('deck', x0, L - 0.24, z0 + 0.8, LOFT.x1, L, 1.6, { walk: true, surface: 'wood' });
  w.box('deck', x0, L - 0.24, 1.6, LOFT.x1 - 1.6, L, z1 - 0.8, { walk: true, surface: 'wood' });
  w.box('deck', LOFT.x1 - 1.6, 0, 0.0, LOFT.x1, L, 1.6, { walk: true, surface: 'wood' });
  w.stairs({ x: LOFT.x1 - 0.8, z: 6.4, y0: 0, dir: 'n', width: 1.6, steps: 6, wood: true });
  w.box('timber', LOFT.x1 - 1.6, 0, 2.4, LOFT.x1 - 1.4, L + F.rail, 6.4);
  w.box('parapet', LOFT.x1, L, z0 + 0.8, LOFT.x1 + 0.2, L + 1.28, 0.0, { surface: 'wood', bulletsPass: true });
  w.box('deck', x0, 0, z1, -45.6, L, z1 + 1.6, { walk: true, surface: 'wood' });
  w.stairs({ x: -40.8, z: z1 + 0.8, y0: 0, dir: 'w', width: 1.6, steps: 6, wood: true });
  w.roof({ x0, z0, x1, z1, base: top, face: 'e', color: '#7a5434', wall: '#c9b48a' });
}

/** Stable yard: the tithe barn in its south-west corner, a cart shed screening the sally passage from the barbican. */
function yard(w: Works) {
  const [x0, x1, z0, z1] = [F.west, -36.0, 16.0, F.bandS];
  const top = F.inner;
  w.run('timber', true, x0, x1, z0, z0 + 0.8, 0, top, [[-42.4, -40.0, D]]);
  w.run('timber', false, z0 + 0.8, z1, x1 - 0.8, x1, 0, top, [[19.2, 21.6, D]]);
  w.roof({ x0, z0, x1, z1, base: top, face: 'e', color: '#8a3a2a', wall: '#c9b48a' });
  w.shed('timber', -31.2, 20.8, -24.0, 24.0, 3.2, '#7a5434');
  w.box('hay', -28.8, 0, 8.8, -24.8, 3.2, 15.2);
  w.box('wall', -28.0, 0, F.bandS, -25.6, F.inner, F.gate);
}

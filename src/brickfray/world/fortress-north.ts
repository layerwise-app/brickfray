import { F, type Works } from './fortress-plan';

const H = F.curtain;
const D = F.door;

/** Upper ward (team 1 spawns), its gates west to the kitchen garden and east to the postern lane, and the hall row. */
export function north(w: Works) {
  w.run('curtain', false, F.ward, F.bandN, -22.4, -20.0, 0, H, [[-44.8, -41.6, D], [-34.4, -31.2, D]]);
  w.run('curtain', false, F.ward, F.hall, 24.0, 26.4, 0, H, [[-46.4, -44.0, D]]);
  w.shed('timber', -0.8, -46.4, 2.4, -41.6, 2.4, '#7a5434');
  w.shed('timber', -28.0, -46.4, -24.8, -41.6, 2.4, '#6e665a');
  w.box('timber', 8.8, 0, -42.4, 10.4, 2.4, -40.8);
  w.box('wall', -6.4, 0, F.ward, -4.8, 2.4, -44.0);
  w.box('curtain', 20.8, 0, F.hall, 26.4, H, F.bandN);
  w.box('wall', 21.6, 0, F.ward, 22.4, 3.2, -43.2);


  kitchen(w);
  greatHall(w);
  chapel(w);
}

/** The bake-oven house in the kitchen garden, in front of the great hall's garden door: [x0, z0, x1, z1]. */
export const OVEN = [-28.8, -38.4, -25.6, -29.6] as const;

/**
 * Kitchen garden, open from the upper ward to the orchard: a hedge closes the west half of its mouth; the bake-oven
 * house stands in front of the great hall's garden door and between the mouth and the side spawns, so no line runs from
 * the hall into the garden and nothing in the orchard sees the spawns; doors through the curtain into the ward and the hall.
 */
function kitchen(w: Works) {
  w.box('hedge', EDGE_GARDEN, 0, F.bandN - 0.8, -28.0, 2.88, F.bandN);
  w.shed('hall', OVEN[0], OVEN[1], OVEN[2], OVEN[3], 2.88, '#6e665a');
  w.box('timber', -24.0, 0, -40.0, -22.4, 2.4, -36.8);
}

const EDGE_GARDEN = -34.4;

/** The great hall's central hearth: a stone stack under a louvre, standing between the ward door and the east court door. */
export const HEARTH = [-6.4, -33.6, -3.2, -31.2] as const;

/**
 * Great hall x -20..2.4, 9.6 m inside: a door from the ward (behind a porch), two to the inner court; a hearth stack
 * in the middle, a long table in the north aisle, a high table at the east end.
 * A gallery over the west end looks over the hall and, through a window, into the court; a turning stair climbs to it
 * inside, an open stair outside from the ward.
 */
function greatHall(w: Works) {
  const [x0, x1, z0, z1] = [-20.0, 2.4, F.hall, F.bandN];
  const top = 6.4;
  const S = F.storey;
  w.windows('hall', true, x0, x1, z0, z0 + 0.8, 0, S, [[-8.8, -5.6, 0, D]]);
  w.windows('hall', true, x0, x1, z0, z0 + 0.8, S, top, [[-19.2, -17.6, S, 6.0]]);
  w.windows('hall', true, x0, x1, z1 - 0.8, z1, 0, S, [[-17.6, -14.4, 0, D], [-4.0, -0.8, 0, D]]);
  w.windows('hall', true, x0, x1, z1 - 0.8, z1, S, top, [[-15.2, -14.4, 4.8, 5.92]]);
  w.box('hall', x1 - 0.8, 0, z0 + 0.8, x1, top, z1 - 0.8);
  w.box('slab', x0, S - 0.48, z0 + 0.8, -13.6, S, z1 - 0.8, { walk: true });
  w.box('parapet', -13.8, S, z0 + 0.8, -13.6, S + 1.28, -29.6, { surface: 'wood', bulletsPass: true });
  w.uStair(-13.6, -31.2, 'e', 4, 'hall');
  w.box('timber', -12.8, 0, -35.2, -8.0, 0.96, -34.4);
  w.box('timber', -1.6, 0, -35.2, -0.8, 0.96, -31.2);
  w.box('hall', HEARTH[0], 0, HEARTH[1], HEARTH[2], top, HEARTH[3]);
  w.box('block', x0, 0, z0 - 1.6, -16.8, S, z0, { walk: true });
  w.stairs({ x: -10.4, z: z0 - 0.8, y0: 0, dir: 'w', width: 1.6, steps: 8 });
  w.box('wall', x0, 0, z0 - 2.4, -10.4, S + 1.92, z0 - 1.6);
  // The porch: the stair wall turns along the ward door, so nothing in the court sees through the hall into the ward.
  w.box('wall', -11.2, 0, z0 - 4.0, -1.6, 3.2, z0 - 2.4);
  w.roof({ x0, z0, x1, z1, base: top, face: 's', color: '#8a3a2a', wall: '#d3ccbb' });
}

/** Chapel x 2.4..16: door from the ward at its west end, to the court at its east end, a rood screen between. */
function chapel(w: Works) {
  const [x0, x1, z0, z1] = [2.4, 16.0, F.hall, F.bandN];
  const top = 5.6;
  w.run('hall', true, x0, x1, z0, z0 + 0.8, 0, top, [[3.2, 6.4, D]]);
  w.run('hall', true, x0, x1, z1 - 0.8, z1, 0, top, [[11.2, 14.4, D]]);
  w.box('timber', 7.2, 0, -33.6, 11.2, 3.2, -32.0);
  w.box('block', 13.6, 0, -34.8, 15.2, 1.2, -30.8);
  w.box('tower', x1, 0, z0, 20.8, 9.6, z1);
  w.roof({ x0, z0, x1, z1, base: top, face: 's', color: '#2f5d93', wall: '#e3dccb' });
}

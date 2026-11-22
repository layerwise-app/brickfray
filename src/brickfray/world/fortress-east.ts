import { F, type Works } from './fortress-plan';

const H = F.curtain;
const D = F.door;

/**
 * East lane, the long one: the old curtain with its breach, then the river terrace and the wadeable ford. The water mill
 * stands across the ford's west half, so the lane bends past it on the terrace; north of it the ruined tower, south of
 * it the jetty, the net store and the boathouse. Lines of 35-45 m run along the water and across the bend, broken every
 * 6-8 m by sacks, timber stacks and boulders; nothing in the lane is a room.
 */
export function east(w: Works) {
  w.run('curtain', false, F.bandN, F.bandS, F.core1, F.terrace, 0, H, [[BREACH[0], BREACH[1], H], [MILL_DOOR[0], MILL_DOOR[1], D]]);
  w.box('rubble', 18.4, 0, BREACH[0], 24.0, 0.48, BREACH[1]);
  w.box('rubble', F.terrace, 0, -24.0, RUIN.x0, F.inner, BREACH[0]);
  w.box('ford', F.ford0, -2.4, F.bandN, F.ford1, F.ford, 40.0, { walk: true, surface: 'water' });
  ruin(w);
  mill(w);
  terrace(w);
  w.box('deck', 33.6, -0.4, 18.4, 36.8, 0.16, 21.6, { walk: true, surface: 'wood' });
  w.box('rubble', ISLAND.x0, F.ford, ISLAND.z0, F.ford1, 2.4, ISLAND.z1);
  w.shed('timber', BOATHOUSE[0], BOATHOUSE[1], BOATHOUSE[2], BOATHOUSE[3], 3.2, '#7a5434');
  w.shed('timber', NET_STORE[0], NET_STORE[1], NET_STORE[2], NET_STORE[3], 3.2, '#6e665a');
}

/** Cover along the lane every 6-8 m: sacks, timber stacks, a beached boat, boulders standing in the ford. */
function terrace(w: Works) {
  w.box('stall', 24.8, 0, -9.6, 27.2, F.rail, -8.8);
  w.box('timber', 30.4, 0, -5.6, 33.6, 2.4, -4.0);
  w.box('stall', 24.0, 0, 0.0, 26.4, F.rail, 0.8);
  w.box('timber', 24.0, 0, 20.8, 27.2, 0.96, 22.4);
  w.box('timber', 29.6, 0, 23.2, 33.6, 2.4, 25.6);
  w.box('timber', 30.4, 0, 36.0, 32.8, 2.4, 37.6);
  for (const [x, z] of [[40.0, -20.0], [38.4, -10.4], [42.4, -2.4], [41.6, 27.2], [38.4, 33.6]] as const) {
    w.box('rubble', x, F.ford, z, x + 1.6, 0.72, z + 1.6);
  }
}

/** Ruined tower outside the breach. */
export const RUIN = { x0: 26.4, x1: 34.4, z0: -21.6, z1: -13.6 } as const;

/**
 * Ruined tower: a solid stump (no room inside) with a broken top, climbed by an open flight along its south face from
 * the terrace or by the rubble ramp up its east side from the north bank. The top is head high toward the breach and the
 * court, waist high toward the ford and the terrace south: it watches the long lane, and the mill roof line and the ford
 * answer it.
 */
function ruin(w: Works) {
  const { x0, x1, z0, z1 } = RUIN;
  const S = F.storey;
  w.box('tower', x0, 0, z0, x1, S, z1, { walk: true });
  w.box('parapet', x0, S, z0, 30.4, S + 1.92, z0 + 0.8);
  w.box('parapet', x0, S, z0 + 0.8, x0 + 0.8, S + 1.92, z1 - 0.8);
  w.box('parapet', 31.2, S, z0, x1 - 0.8, S + 1.92, z0 + 0.8);
  w.box('parapet', x1 - 0.8, S, RAMP_TOP, x1, S + F.rail, z1);
  w.box('parapet', 28.8, S, z1 - 0.8, x1 - 0.8, S + F.rail, z1);
  w.stairs({ x: x1 + 0.8, z: z1 + 0.8, y0: 0, dir: 'w', width: 1.6, steps: 8 });
  // A wall along its open side, a rail higher than the landing, so nobody jumps onto the flight or climbs off it.
  w.box('wall', 28.8, 0, z1 + 1.6, x1 + 0.8, S + F.rail, z1 + 2.0);
  w.box('block', x0, 0, z1, 28.8, S, z1 + 1.6, { walk: true });
  // The rubble ramp up its east side starts clear of the crag, so the north bank opens onto the river 3.2 m wide.
  w.stairs({ x: 35.2, z: RAMP_TOP - 6.4, y0: 0, dir: 's', width: 1.6, steps: 8 });
}

/** Where the ruin's east ramp reaches the top (z): the east parapet starts here. */
const RAMP_TOP = -17.6;

/** Water mill across the ford's west half and the terrace's edge: solid, its wheel on the north face in the water. */
export const MILL = { x0: 30.4, x1: 40.8, z0: 4.8, z1: 12.8 } as const;
/** The wheel turns in the ford against the mill's north face. */
export const WHEEL = { x0: F.ford0, x1: 40.8, z0: 4.8 } as const;
/** A gravel island against the far bank south of the mill. */
export const ISLAND = { x0: 40.0, z0: 18.4, z1: 24.0 } as const;
/** Net store against the curtain and the boathouse by the water, south of the mill: [x0, z0, x1, z1]. */
export const NET_STORE = [F.terrace, 16.0, 28.8, 20.0] as const;
export const BOATHOUSE = [26.4, 28.0, F.ford0, 33.6] as const;
/** The door through the curtain from the east flank onto the terrace beside the mill. */
const MILL_DOOR = [5.6, 8.8] as const;
/** The breach in the old curtain between the inner court and the terrace, a buttress of fallen masonry north of it. */
const BREACH = [-21.6, -16.8] as const;

function mill(w: Works) {
  const { x0, x1, z0, z1 } = MILL;
  w.box('timber', x0, F.ford - 2.08, z0, x1, F.inner, z1);
  w.box('wheel', WHEEL.x0 - 0.2, F.ford, WHEEL.z0 - 0.6, WHEEL.x1 + 0.2, 3.2, WHEEL.z0, { surface: 'wood' });
  w.roof({ x0, z0, x1, z1, base: F.inner, face: 's', color: '#7a5434', wall: '#c9b48a' });
}

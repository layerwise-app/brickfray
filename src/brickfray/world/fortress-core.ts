import { F, type Works } from './fortress-plan';
import { K } from './keep';

const R = K.rock;
const D = F.door;

/**
 * The mid lane is a ring round the keep: the inner court north of it, the outer bailey south, joined by a flank either
 * side of the rock. Each yard is 40 x 16 m, open in the middle, its cover in clusters with clear lanes between them; each
 * flank has an outbuilding at each end, one against the rock and one against the outer wall, overlapping 2.4 m across
 * the flank, so its middle is open but nothing sees from yard to yard past the keep.
 */
export function core(w: Works) {
  innerCourt(w);
  flanks(w);
  outerBailey(w);
}

/** The inner court's hay wagon: [x0, z0, x1, z1]. */
export const COURT_WAGON = [-15.2, -21.6, -12.0, -19.2] as const;

/** Inner court: a hay wagon and a horse trough west, the well in the middle third, a timber stack east, low walls. */
function innerCourt(w: Works) {
  const [hx0, hz0, hx1, hz1] = COURT_WAGON;
  w.box('timber', hx0, 0, hz0, hx1, 0.96, hz1);
  w.box('hay', hx0, 0.96, hz0, hx1, 2.88, hz1);
  w.box('wall', -10.4, 0, -15.2, -7.2, F.rail, -14.4);
  w.box('wall', -3.2, 0, -21.6, 0.0, F.rail, -20.8);
  w.box('block', 4.0, 0, -18.4, 6.4, F.rail, -16.0);
  w.box('wall', 8.8, 0, -24.0, 9.6, F.rail, -21.6);
  w.box('timber', 14.4, 0, -21.6, 16.8, 2.4, -16.0);
  w.box('wall', 14.4, 0, -14.4, 17.6, F.rail, -13.6);
}

/** Flank outbuildings: [x0, z0, x1, z1] each, the one against the rock and the one against the outer wall. */
export const FLANK_SHEDS: [number, number, number, number][] = [
  [-16.8, -R, -R, -6.4],
  [F.core0, 6.4, -14.4, R],
  [R, 6.4, 16.8, 14.4],
  [14.4, -R, F.core1, -6.4]
];

/**
 * West flank: a woodshed against the rock and the trough house against the paddock wall; east flank: the coal store
 * against the rock and the smithy's forge against the curtain. Each keep door and each door in the outer walls opens
 * on the flank's open middle or the pass beside a shed, not onto a shed.
 */
function flanks(w: Works) {
  const colors = ['#7a5434', '#6e665a', '#6e665a', '#7a5434'];
  FLANK_SHEDS.forEach(([x0, z0, x1, z1], i) => w.shed(i % 2 ? 'hall' : 'timber', x0, z0, x1, z1, 2.88, colors[i]!));
}

/** The bailey woodpile in its south-west corner: [x0, z0, x1, z1]. */
export const WOODPILE = [F.core0, 22.4, -17.6, 24.8] as const;

/** Outer bailey: an open market stall row west, a hay wagon east, a low timber cart, low walls, the bakehouse in the south-east corner. */
function outerBailey(w: Works) {
  for (const x of [-17.6, -13.6, -9.6]) {
    w.box('stall', x, 0, 19.2, x + 3.2, F.rail, 20.0);
    w.box('roof', x - 0.2, 2.4, 18.4, x + 3.4, 2.56, 20.24, { surface: 'wood' });
  }
  w.box('timber', 5.6, 0, 21.6, 8.8, 0.96, 24.0);
  w.box('hay', 5.6, 0.96, 21.6, 8.8, 2.88, 24.0);
  w.box('timber', -16.0, 0, 13.6, -13.6, F.rail, 15.2);
  w.box('timber', WOODPILE[0], 0, WOODPILE[1], WOODPILE[2], 2.4, WOODPILE[3]);
  w.box('wall', 1.6, 0, 15.2, 4.8, F.rail, 16.0);
  w.box('wall', -4.0, 0, 22.4, -3.2, F.rail, 25.6);
  w.box('block', -8.0, 0, 13.6, -5.6, F.rail, 16.0);
  const [x0, x1, z0, z1] = [12.0, F.core1, 19.2, F.bandS];
  w.run('hall', true, x0, x1, z0, z0 + 0.8, 0, 3.6);
  w.run('hall', false, z0 + 0.8, z1, x0, x0 + 0.8, 0, 3.6, [[23.2, 26.4, D]]);
  w.box('block', 16.0, 0, 23.2, x1, 2.4, z1 + 0.4);
  w.roof({ x0, z0, x1, z1, base: 3.6, face: 's', color: '#9a4a2a', wall: '#d9c9a8' });
}

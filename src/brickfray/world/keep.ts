import { drawBlock, type Masonry } from './blocks';
import { WALK_TILE } from './castle-parts';
import type { Element } from './plan';
import { box, type PlanCollider, type Vec3 } from './util';

/**
 * The keep on its rock at the middle of the map: a hall (the audio room) 17.6 m across with four doors in a pinwheel,
 * the west and east ones into the flanks, a hearth column at the middle that stops every line from door to door, a long
 * table against the wall in each of the two corners no door opens on and a pillar between each pair of doors, so a rifle has 18-21 m
 * lines past the column inside. The tower and the rock are out of reach.
 */
export const K = {
  half: 9.6,
  wall: 0.8,
  /** Hall ceiling top; the tower walls rise to `top`. */
  roof: 7.2,
  slab: 0.48,
  top: 12.0,
  rock: 11.2,
  doorTop: 2.88,
  doorN: [0.8, 4.0],
  doorS: [-4.0, -0.8],
  doorW: [0.8, 4.0],
  doorE: [-4.0, -0.8],
  column: 1.6,
  /** The rock skirt stands back this far (m) either side of each door. */
  notch: 1.6
} as const;

/** Long tables against the walls of the north-west and south-east corners of the hall: [x0, z0, x1, z1], 0.96 high. */
export const KEEP_TABLES: [number, number, number, number][] = [
  [-7.2, -8.8, -2.4, -8.0],
  [2.4, 8.0, 7.2, 8.8]
];

/** Pillars between the two doors of the north-east and of the south-west quarter: [x0, z0, x1, z1], to the ceiling. */
export const KEEP_PILLARS: [number, number, number, number][] = [
  [5.4, -6.6, 6.6, -5.4],
  [-6.6, 5.4, -5.4, 6.6]
];

/** Grey ashlar: the keep is the one grey building among the beige halls. */
const KEEP_STONE: Masonry = { colors: ['#a4a8ab', '#979b9f', '#b1b4b6', '#8c9094'], variance: 0.3, lens: [3, 4, 2, 5] };
const OAK: Masonry = { colors: ['#8a5f3a', '#7a5434', '#9a6a3f'], variance: 0.25, lens: [4, 6] };
const ROCK: Masonry = { colors: ['#8a8578', '#7d786c', '#969083', '#706b60'], variance: 0.4, lens: [2, 3, 5] };

interface Piece {
  min: Vec3;
  max: Vec3;
  rock?: boolean;
  wood?: boolean;
}

function pieces(): Piece[] {
  const { half: h, wall: t, top, rock: r, doorTop: dt } = K;
  const out: Piece[] = [];
  const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, rock = false) => out.push({ min: [x0, y0, z0], max: [x1, y1, z1], rock });
  // Walls along x (north/south) with one door each, lintel above.
  for (const [z0, z1, [d0, d1]] of [[-h, -h + t, K.doorN], [h - t, h, K.doorS]] as const) {
    b(-h, 0, z0, d0, top, z1);
    b(d1, 0, z0, h, top, z1);
    b(d0, dt, z0, d1, top, z1);
  }
  for (const [x0, x1, [d0, d1]] of [[-h, -h + t, K.doorW], [h - t, h, K.doorE]] as const) {
    b(x0, 0, -h + t, x1, top, d0);
    b(x0, 0, d1, x1, top, h - t);
    b(x0, dt, d0, x1, top, d1);
  }
  b(-h + t, K.roof - K.slab, -h + t, h - t, K.roof, h - t);
  b(-K.column, 0, -K.column, K.column, K.roof - K.slab, K.column);
  for (const [x0, z0, x1, z1] of KEEP_PILLARS) b(x0, 0, z0, x1, K.roof - K.slab, z1);
  for (const [x0, z0, x1, z1] of KEEP_TABLES) out.push({ min: [x0, 0, z0], max: [x1, 0.96, z1], wood: true });
  // Rock skirt, cut back in a notch NOTCH m wider than the door either side, so the door shows from the yard.
  const n = K.notch;
  const rockTop = (x: number, z: number) => 2.88 + ((Math.abs(Math.round(x * 3 + z * 7)) % 5) * 0.48);
  const strip = (x0: number, z0: number, x1: number, z1: number) => b(x0, 0, z0, x1, rockTop(x0 + x1, z0 + z1), z1, true);
  for (const [z0, z1, [d0, d1]] of [[-r, -h, K.doorN], [h, r, K.doorS]] as const) {
    strip(-r, z0, d0 - n, z1);
    strip(d1 + n, z0, r, z1);
  }
  for (const [x0, x1, [d0, d1]] of [[-r, -h, K.doorW], [h, r, K.doorE]] as const) {
    strip(x0, -h, x1, d0 - n);
    strip(x0, d1 + n, x1, h);
  }
  return out;
}

export const KEEP: Element<Record<string, never>> = {
  colliders: () => pieces().map((q): PlanCollider => box(q.min, q.max, q.wood ? 'wood' : 'stone')),
  nav() {
    const out: Vec3[] = [];
    const m = (a: readonly [number, number]) => (a[0] + a[1]) / 2;
    const o = K.rock + 1.0;
    const i = K.half - 1.6;
    out.push([m(K.doorN), 0, -o], [m(K.doorN), 0, -i], [m(K.doorS), 0, o], [m(K.doorS), 0, i]);
    out.push([-i, 0, m(K.doorW)], [i, 0, m(K.doorE)], [-K.half, 0, m(K.doorW)], [K.half, 0, m(K.doorE)]);
    for (const [x, z] of [[-4.0, -4.0], [4.0, -4.0], [-4.0, 4.0], [4.0, 4.0], [-6.4, 0], [6.4, 0], [0, -6.4], [0, 6.4], [-7.2, -6.8], [7.2, 6.8], [7.6, -3.2], [-7.6, 3.2]] as const) out.push([x, 0, z]);
    return out;
  },
  draw(d) {
    for (const q of pieces()) {
      if (q.wood) drawBlock(d, { min: q.min, max: q.max, surface: 'wood', style: OAK, top: 'tiles', topColor: '#b98a5a' });
      else drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: q.rock ? ROCK : KEEP_STONE, top: 'tiles', topColor: q.rock ? '#7f9a5a' : WALK_TILE });
    }
  }
};

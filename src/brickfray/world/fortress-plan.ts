import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/**
 * Sunset Keep gameplay geometry. The teams camp at the west and east ends (x): the town square and the farm. Three
 * lanes run between them: the crag street along the north under the village and the crag, the gate road through each
 * team's gatehouse into the castle's baileys and round the closed keep, and the river path along the south bank past
 * the mill and its ford. The castle's ranges keep the lanes apart; each team joins them by its own postern and water
 * gate. Gameplay is mirrored about x = 0; the dressing of the two halves differs.
 */
export const F = {
  /** Playable half-extents: the moats at |x|, the crag field wall (north) and the river wall (south) at |z|. */
  edgeX: 62.4,
  edge: 44.8,
  /** Curtain walls: too tall to see over from anywhere a player stands. */
  curtain: 6.4,
  /** Walls of single-storey buildings. */
  inner: 4.8,
  /** Gate room floor; loft and mill gallery floor. */
  storey: 3.84,
  loft: 3.36,
  slab: 0.48,
  door: 2.88,
  /** Railings and parapets: just higher than a jump, so nobody stands on them. */
  rail: 1.28,
  rise: 0.48,
  run: 0.8,
  /** Ford bed and water surface: wadeable, shallow enough that bots walk it too. */
  ford: -0.32,
  water: -0.14,
  /** The crag street stands on a terrace this high, from `terrace` (|x|) to the middle. */
  street: 0.96,
  terrace: 46.4,
  /** The knoll the crag street crests on at the ruin, and the raised quay on the east river path. */
  knoll: 1.44,
  quay: 0.48,
  /** The east half's crag street and river path are wider: its ranges stand back from the lanes. */
  laneNE: -28.0,
  laneSE: 27.2,
  /** Bands (z): the crag street's south side, the ranges' inner faces. */
  laneN: -30.4,
  rangeN: -21.6,
  rangeS: 21.6,
  laneS: 30.4,
  /** Columns (x, west half): the camp's inner edge, the curtain's outer and inner faces, the keep's half size. */
  camp: -48.0,
  castle: -36.8,
  wallIn: -35.2,
  keep: 9.6
} as const;

export type Kind =
  | 'curtain'
  | 'wall'
  | 'hall'
  | 'timber'
  | 'tower'
  | 'rock'
  | 'slab'
  | 'parapet'
  | 'pillar'
  | 'rubble'
  | 'bank'
  | 'ford'
  | 'block'
  | 'screen'
  | 'deck'
  | 'stall'
  | 'roof'
  | 'hay'
  | 'wheel'
  | 'breast'
  | 'stakes'
  | 'paling'
  | 'gate'
  | 'grille'
  | 'hedge'
  | 'rail'
  | 'barrier'
  | 'prop';

export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
  bulletsPass?: boolean;
  /** Collider boxes that follow an open shape (a cart, a well) instead of its bounds. */
  solid?: [Vec3, Vec3][];
  /** What a prop is, or which building a block belongs to, for the drawing. */
  tag?: string;
}

/** A straight flight of steps (blocks.ts STAIRS without the style). */
export interface Flight {
  x: number;
  z: number;
  y0: number;
  dir: Face;
  width: number;
  steps: number;
  wood?: boolean;
}

/** A gable roof over a rectangle; the ridge runs parallel to `face`. */
export interface Roof {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  base: number;
  face: Face;
  color: string;
  wall: string;
  /** Outbuilding roof: no chimney. */
  small?: boolean;
}

/** Door in a wall run: [from, to, top] along the run. */
export type Door = [number, number, number];

/** A door or window left in a wall run, for the trim: the run's axis, its cross-section c0..c1, the hole a0..a1 x y0..y1. */
export interface Opening {
  kind: Kind;
  alongX: boolean;
  a0: number;
  a1: number;
  c0: number;
  c1: number;
  y0: number;
  y1: number;
  /** Sill at the run's foot: a door. */
  door: boolean;
  /** A shut door or a glazed window drawn on a solid front: only the `face` side (-1 = c0, 1 = c1) gets the trim. */
  blind?: boolean;
  face?: -1 | 1;
}

const FLIP: Record<Face, Face> = { n: 'n', s: 's', e: 'w', w: 'e' };

/** Collects the pieces, stairs, roofs and extra bot waypoints of the whole map. */
export class Works {
  readonly pieces: Piece[] = [];
  readonly flights: Flight[] = [];
  readonly roofs: Roof[] = [];
  readonly seeds: Vec3[] = [];
  readonly openings: Opening[] = [];

  box(kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}) {
    this.pieces.push({ kind, min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], ...extra });
    return this;
  }

  /** Wall along x (`alongX`) or z from a0 to a1, cross-section c0..c1, with doors (lintels above) and waypoints either side. */
  run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = []) {
    const mk = (s: number, e: number, b: number, t: number, k: Kind = kind) => (alongX ? this.box(k, s, b, c0, e, t, c1) : this.box(k, c0, b, s, c1, t, e));
    let at = a0;
    for (const [from, to, top] of [...doors].sort((a, b) => a[0] - b[0])) {
      if (from > at) mk(at, from, y0, y1);
      if (top < y1) mk(from, to, top, y1);
      this.openings.push({ kind, alongX, a0: from, a1: to, c0, c1, y0, y1: Math.min(top, y1), door: true });
      at = to;
      const a = (from + to) / 2;
      for (const c of [c0 - 1.0, c1 + 1.0]) this.seeds.push(alongX ? [a, y0, c] : [c, y0, a]);
    }
    if (at < a1) mk(at, a1, y0, y1);
    return this;
  }

  /** Wall run with windows [from, to, sill, top]: sill and head pieces stay solid. */
  windows(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, holes: [number, number, number, number][]) {
    const mk = (s: number, e: number, b: number, t: number) => (alongX ? this.box(kind, s, b, c0, e, t, c1) : this.box(kind, c0, b, s, c1, t, e));
    let at = a0;
    for (const [from, to, sill, top] of [...holes].sort((a, b) => a[0] - b[0])) {
      if (from > at) mk(at, from, y0, y1);
      if (sill > y0) mk(from, to, y0, sill);
      if (top < y1) mk(from, to, top, y1);
      this.openings.push({ kind, alongX, a0: from, a1: to, c0, c1, y0: Math.max(sill, y0), y1: Math.min(top, y1), door: sill <= y0 });
      at = to;
    }
    if (at < a1) mk(at, a1, y0, y1);
    return this;
  }

  /** Shut doors and windows drawn on a solid front at c, facing `face`: [from, to, sill, top] along the front. */
  blind(kind: Kind, alongX: boolean, c: number, face: -1 | 1, holes: [number, number, number, number][]) {
    for (const [a0, a1, y0, y1] of holes) this.openings.push({ kind, alongX, a0, a1, c0: c, c1: c, y0, y1, door: y0 <= 1.0, blind: true, face });
    return this;
  }

  stairs(f: Flight) {
    this.flights.push(f);
    return this;
  }

  roof(r: Roof) {
    this.roofs.push(r);
    return this;
  }

  /** A closed outbuilding: a solid block under a gable roof whose ridge runs along its longer side. */
  shed(kind: Kind, x0: number, z0: number, x1: number, z1: number, top: number, color: string, tag?: string) {
    this.box(kind, x0, 0, z0, x1, top, z1, { tag });
    return this.roof({ x0, z0, x1, z1, base: top, face: x1 - x0 >= z1 - z0 ? 's' : 'e', color, wall: kind === 'timber' ? '#9a6a3f' : '#d3ccbb', small: true });
  }

  seed(x: number, y: number, z: number) {
    this.seeds.push([x, y, z]);
    return this;
  }

  /** Adds the mirror image across x = 0 of everything collected so far (the west half becomes the east half too). */
  mirror() {
    const nx = (a: number, b: number): [number, number] => [-b, -a];
    for (const q of [...this.pieces]) {
      const [x0, x1] = nx(q.min[0], q.max[0]);
      const solid = q.solid?.map(([a, b]): [Vec3, Vec3] => [[-b[0], a[1], a[2]], [-a[0], b[1], b[2]]]);
      this.pieces.push({ ...q, min: [x0, q.min[1], q.min[2]], max: [x1, q.max[1], q.max[2]], ...(solid ? { solid } : {}) });
    }
    for (const f of [...this.flights]) this.flights.push({ ...f, x: -f.x, dir: FLIP[f.dir] });
    for (const r of [...this.roofs]) {
      const [x0, x1] = nx(r.x0, r.x1);
      this.roofs.push({ ...r, x0, x1, face: FLIP[r.face] });
    }
    for (const s of [...this.seeds]) this.seeds.push([-s[0], s[1], s[2]]);
    for (const o of [...this.openings]) {
      if (o.alongX) {
        const [a0, a1] = nx(o.a0, o.a1);
        this.openings.push({ ...o, a0, a1 });
      } else {
        const [c0, c1] = nx(o.c0, o.c1);
        this.openings.push({ ...o, c0, c1 });
      }
    }
    return this;
  }
}

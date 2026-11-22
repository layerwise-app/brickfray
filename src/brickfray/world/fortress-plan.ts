import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/**
 * Sunset Keep gameplay geometry. North (-z) is the upper ward where team 1 spawns, south the barbican for team 0;
 * between them a band of three lanes (orchard and stables to the west, the courts round the keep in the middle, the
 * river terrace and mill to the east), each broken half way by a building you can walk through.
 */
export const F = {
  /** Curtain walls: too tall to see over from anywhere a player stands. */
  curtain: 7.2,
  /** Walls between districts and of single-storey buildings. */
  inner: 4.8,
  /** Upper floors (gate room, gallery, tower top). */
  storey: 3.84,
  slab: 0.48,
  door: 2.88,
  /** Railings and parapets: just higher than a jump, so nobody stands on them. */
  rail: 1.28,
  rise: 0.48,
  run: 0.8,
  /** River bed and water surface: the ford is wadeable everywhere, and shallow enough that bots (sim/bot-nav treats a
   * floor under killY + 0.4 as deadly) walk it too. */
  ford: -0.32,
  water: -0.14,
  /** Middle band (z) and its rows. */
  bandN: -27.2,
  bandS: 27.2,
  rowN: -9.6,
  rowS: 9.6,
  /** Columns (x). */
  west: -48,
  core0: -20,
  core1: 20,
  terrace: 22.4,
  ford0: 36.8,
  ford1: 44.8,
  /** North ward and south barbican (z). */
  ward: -48,
  hall: -38.4,
  gate: 34.4,
  barbican: 44.8
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
  | 'hedge';

export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
  bulletsPass?: boolean;
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
}

const DIR: Record<Face, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const BACK: Record<Face, Face> = { n: 's', s: 'n', e: 'w', w: 'e' };

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

  stairs(f: Flight) {
    this.flights.push(f);
    return this;
  }

  /**
   * Stair turning back on itself in a well 3.2 wide: `steps` up going `dir` from (x, z) (the outer corner of the first
   * flight), a landing, the same back; the second flight sits on a solid fill, so nobody walks under it.
   */
  /** Two flights turning on a landing, with a wall between them so neither can be left halfway up. */
  uStair(x: number, z: number, dir: Face, steps: number, kind: Kind, y0 = 0) {
    const [dx, dz] = DIR[dir];
    const [px, pz] = [-dz, dx];
    const P = (u: number, v: number): [number, number] => [x + px * u + dx * v, z + pz * u + dz * v];
    const rect = (u0: number, v0: number, u1: number, v1: number, y1: number, walk: boolean, k: Kind = 'block') => {
      const [ax, az] = P(u0, v0);
      const [bx, bz] = P(u1, v1);
      this.box(k, ax, y0, az, bx, y1, bz, { walk });
    };
    const len = steps * F.run;
    const mid = y0 + steps * F.rise;
    const [f1x, f1z] = P(0.8, 0);
    this.stairs({ x: f1x, z: f1z, y0, dir, width: 1.6, steps });
    rect(0, len, 3.2, len + 1.6, mid, true);
    rect(1.6, 0, 3.2, len, mid, false);
    const [f2x, f2z] = P(2.4, len);
    this.stairs({ x: f2x, z: f2z, y0: mid, dir: BACK[dir], width: 1.6, steps });
    rect(1.5, F.run, 1.7, len, y0 + 2 * steps * F.rise + F.rail, false, kind);
    return this;
  }

  roof(r: Roof) {
    this.roofs.push(r);
    return this;
  }

  /** A closed outbuilding: a solid block under a gable roof whose ridge runs along its longer side. */
  shed(kind: Kind, x0: number, z0: number, x1: number, z1: number, top: number, color: string) {
    this.box(kind, x0, 0, z0, x1, top, z1);
    return this.roof({ x0, z0, x1, z1, base: top, face: x1 - x0 >= z1 - z0 ? 's' : 'e', color, wall: kind === 'timber' ? '#9a6a3f' : '#d3ccbb', small: true });
  }

  seed(x: number, y: number, z: number) {
    this.seeds.push([x, y, z]);
    return this;
  }
}

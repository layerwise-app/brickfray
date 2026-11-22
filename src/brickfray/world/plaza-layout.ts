import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/** Paving top: squares, sidewalks and floors stand on 0.16 m plates over the road. */
export const P = 0.16;
/** Playable half-extent: the canal, the railway cutting, the park railings and the west house fronts stand on it. */
export const EDGE = { x: 44.0, z: 40.0 } as const;
export const RISE = 0.48;
export const RUN = 0.8;

export type Kind =
  | 'wall'
  | 'lintel'
  | 'ceiling'
  | 'roof'
  | 'slab'
  | 'parapet'
  | 'pillar'
  | 'kiosk'
  | 'counter'
  | 'shelf'
  | 'tram'
  | 'shelter'
  | 'plinth'
  | 'rail'
  | 'quay'
  | 'bed'
  | 'deck'
  | 'hoarding'
  | 'frame'
  | 'stack'
  | 'garden'
  | 'stage'
  | 'tower'
  | 'basin'
  | 'landing';

/** One gameplay box: the collider and the shape the dressing draws around it. */
export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
  pass?: boolean;
  /** Which district dresses it. */
  tag?: string;
}

/** A solid building block from the ground to `h`; `faces` look into play and get a façade. */
export interface Block {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  faces: Face[];
  tag?: string;
}

/** A straight flight (blocks.ts STAIRS without the style). */
export interface Flight {
  x: number;
  z: number;
  y0: number;
  dir: Face;
  width: number;
  steps: number;
  rise: number;
  run: number;
  tag?: string;
}

export interface Pave {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
}

/** Door in a wall run: [from, to] along the run and the lintel height. */
export type Door = [number, number, number];

/** Pure-data town plan; districts push into it. */
export class Layout {
  readonly pieces: Piece[] = [];
  readonly blocks: Block[] = [];
  readonly flights: Flight[] = [];
  readonly seeds: Vec3[] = [];
  readonly paves: Pave[] = [];

  add(kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}) {
    this.pieces.push({ kind, min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], ...extra });
    return this;
  }

  block(x0: number, z0: number, x1: number, z1: number, h: number, faces: Face[], tag?: string) {
    this.blocks.push({ x0, z0, x1, z1, h, faces, tag });
    return this;
  }

  flight(x: number, z: number, y0: number, dir: Face, width: number, steps: number, rise = RISE, tag?: string) {
    this.flights.push({ x, z, y0, dir, width, steps, rise, run: RUN, tag });
    return this;
  }

  pave(x0: number, z0: number, x1: number, z1: number, y = P) {
    this.paves.push({ x0, z0, x1, z1, y });
    return this;
  }

  seed(x: number, y: number, z: number) {
    this.seeds.push([x, y, z]);
    return this;
  }

  /**
   * Wall along x (`alongX`) or z from a0 to a1, cross-section c0..c1, with doors (lintels above them) and bot seeds
   * on both sides of every door so links run straight through.
   */
  run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = [], extra: Partial<Piece> = {}) {
    const mk = (s: number, e: number, b: number, t: number, k: Kind) =>
      alongX ? this.add(k, s, b, c0, e, t, c1, extra) : this.add(k, c0, b, s, c1, t, e, extra);
    let at = a0;
    for (const [from, to, top] of [...doors].sort((a, b) => a[0] - b[0])) {
      if (from > at) mk(at, from, y0, y1, kind);
      if (top < y1) mk(from, to, top, y1, 'lintel');
      at = to;
      const a = (from + to) / 2;
      for (const c of [c0 - 1.0, c1 + 1.0]) this.seed(alongX ? a : c, y0, alongX ? c : a);
    }
    if (at < a1) mk(at, a1, y0, y1, kind);
    return this;
  }
}

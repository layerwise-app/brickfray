import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/** Paving top: squares, sidewalks and floors stand on 0.16 m plates over the road. */
export const P = 0.16;
/** Playable ground: x across the town from the west base to the east base, z from the north house fronts to the canal rail. */
export const LAND = { x: 64.8, north: -44.0, south: 40.0 } as const;
/** Back half-extent kept for the bounds and the backdrop. */
export const EDGE = { x: LAND.x, z: 44.0 } as const;
/** Base roads run along |x| > BASE; the three lanes start at it. */
export const BASE = 54.4;
/** North lane: the tram boulevard; its middle (|x| < mid) runs `jog` further north, so it bends twice. */
export const BLVD = { z0: LAND.north, z1: -31.2, jog: 3.2, mid: 20.8 } as const;
/** Building row between the boulevard and the middle. */
export const NROW = { z0: BLVD.z1, z1: -19.2 } as const;
/** Middle lane (west half): Market Street into the square (mirrored east). */
export const STREET = { x0: -BASE, x1: -28.0, z0: -9.6, z1: 0.8 } as const;
/** West square: x0 its west edge north of the street, bay its west edge south of it, x1 the town hall side. */
export const SQ = { x0: -28.0, bay: -30.4, x1: -9.6, z0: NROW.z1, z1: 16.8 } as const;
/** Building row between the middle and the canal. */
export const SROW = { z0: SQ.z1, z1: 28.8 } as const;
/** South lane: the canal quay; the rail stands on z1 in the middle (|x| < mid) and on `side` beyond, the water past it. */
export const QUAY = { z0: SROW.z1, z1: LAND.south, side: 37.6, mid: 30.4 } as const;
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
  | 'landing'
  | 'podium';

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

/** Door in a wall run: [from, to] along the run and the lintel height. */
export type Door = [number, number, number];

/** Pure-data town plan; districts push into it. */
export class Layout {
  readonly pieces: Piece[] = [];
  readonly blocks: Block[] = [];
  readonly flights: Flight[] = [];
  readonly seeds: Vec3[] = [];
  /** Wall lanterns: x, z on a house front, quarter turns facing out (0 = +z). */
  readonly lamps: [number, number, number][] = [];

  add(kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}) {
    this.pieces.push({ kind, min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], ...extra });
    return this;
  }

  block(x0: number, z0: number, x1: number, z1: number, h: number, faces: Face[], tag?: string) {
    this.blocks.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h, faces, tag });
    return this;
  }

  flight(x: number, z: number, y0: number, dir: Face, width: number, steps: number, rise = RISE, tag?: string) {
    this.flights.push({ x, z, y0, dir, width, steps, rise, run: RUN, tag });
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
    let at = Math.min(a0, a1);
    const end = Math.max(a0, a1);
    const sorted = doors.map(([f, t, top]): Door => [Math.min(f, t), Math.max(f, t), top]).sort((a, b) => a[0] - b[0]);
    for (const [from, to, top] of sorted) {
      if (from > at) mk(at, from, y0, y1, kind);
      if (top < y1) mk(from, to, top, y1, 'lintel');
      at = to;
      const a = (from + to) / 2;
      for (const c of [Math.min(c0, c1) - 1.0, Math.max(c0, c1) + 1.0]) this.seed(alongX ? a : c, y0, alongX ? c : a);
    }
    if (at < end) mk(at, end, y0, y1, kind);
    return this;
  }
}

const MIRROR: Record<Face, Face> = { n: 'n', s: 's', e: 'w', w: 'e' };

/**
 * One half of the town, written in west-half coordinates (x < 0): `s` 1 draws it as written, -1 mirrors it east
 * (x -> -x, east and west faces swapped). `tag` picks the half's own name for a place.
 */
export class Side {
  constructor(
    readonly L: Layout,
    readonly s: 1 | -1
  ) {}

  get west() {
    return this.s > 0;
  }

  tag(west: string, east: string) {
    return this.s > 0 ? west : east;
  }

  x(v: number) {
    return this.s * v;
  }

  face(f: Face): Face {
    return this.s > 0 ? f : MIRROR[f];
  }

  add(kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}) {
    this.L.add(kind, this.s * x0, y0, z0, this.s * x1, y1, z1, extra);
    return this;
  }

  block(x0: number, z0: number, x1: number, z1: number, h: number, faces: Face[], tag?: string) {
    this.L.block(this.s * x0, z0, this.s * x1, z1, h, faces.map((f) => this.face(f)), tag);
    return this;
  }

  flight(x: number, z: number, y0: number, dir: Face, width: number, steps: number, rise = RISE, tag?: string) {
    this.L.flight(this.s * x, z, y0, this.face(dir), width, steps, rise, tag);
    return this;
  }

  seed(x: number, y: number, z: number) {
    this.L.seed(this.s * x, y, z);
    return this;
  }

  lamp(x: number, z: number, turns: number) {
    this.L.lamps.push([this.s * x, z, this.s > 0 || turns % 2 === 0 ? turns : turns + 2]);
    return this;
  }

  run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = [], extra: Partial<Piece> = {}) {
    if (alongX) this.L.run(kind, true, this.s * a0, this.s * a1, c0, c1, y0, y1, doors.map(([f, t, top]) => [this.s * f, this.s * t, top]), extra);
    else this.L.run(kind, false, a0, a1, this.s * c0, this.s * c1, y0, y1, doors, extra);
    return this;
  }
}

/** Both halves: the west as written, then its mirror. */
export function halves(L: Layout, fn: (S: Side) => void) {
  fn(new Side(L, 1));
  fn(new Side(L, -1));
}

/** Every other house front steps back (west-half order), so no street wall runs dead straight. */
const RECESS = [0, 0.8, 0, 0.4];
const TURNS: Record<Face, number> = { s: 0, e: 1, n: 2, w: 3 };

/**
 * A row of town houses filling x0..x1 (west-half coordinates, any order) by z0..z1, fronts on `face` (n or s); the
 * first and last house also dress their ends when `ends` lists them. Widths cycle so no two neighbours match, fronts
 * step back by RECESS, and every second house gets a lantern by its door.
 */
export function houses(S: Side, x0: number, x1: number, z0: number, z1: number, h: number[], face: Face, tag: string, ends: Face[] = [], flat = false) {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const widths = [7.2, 5.6, 8.0, 6.4];
  let at = a;
  let i = 0;
  while (at < b - 0.01) {
    let w = widths[(i + Math.round(Math.abs(a) * 1.25)) % widths.length]!;
    if (b - (at + w) < 4.0) w = b - at;
    const first = at === a;
    const last = at + w >= b - 0.01;
    const faces: Face[] = [face];
    if (first && ends.includes('w')) faces.push('w');
    if (last && ends.includes('e')) faces.push('e');
    const r = flat ? 0 : RECESS[i % RECESS.length]!;
    const [za, zb] = face === 'n' ? [z0 + r, z1] : [z0, z1 - r];
    S.block(at, za, at + w, zb, h[i % h.length]!, faces, tag);
    if (i % 2 === 0) S.lamp(at + w / 2 + 1.4, face === 'n' ? za - 0.02 : zb + 0.02, TURNS[face]);
    at += w;
    i++;
  }
}

/** The same along z (fronts on e or w), without steps. */
export function housesZ(S: Side, x0: number, x1: number, z0: number, z1: number, h: number[], face: Face, tag: string, ends: Face[] = []) {
  const a = Math.min(z0, z1);
  const b = Math.max(z0, z1);
  const widths = [6.4, 8.0, 5.6, 7.2];
  let at = a;
  let i = 0;
  while (at < b - 0.01) {
    let w = widths[(i + Math.round(Math.abs(a) * 1.25)) % widths.length]!;
    if (b - (at + w) < 4.0) w = b - at;
    const faces: Face[] = [face];
    if (at === a && ends.includes('n')) faces.push('n');
    if (at + w >= b - 0.01 && ends.includes('s')) faces.push('s');
    S.block(x0, at, x1, at + w, h[i % h.length]!, faces, tag);
    at += w;
    i++;
  }
}

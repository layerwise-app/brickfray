import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/**
 * Jade Temple plan: a great hall (nave, aisles, galleries over the aisles) along the team axis at the middle, a court
 * either side of it, a forecourt and a range of halls at each end before the camps, and long open strips along the
 * gorge (west) and the village (east). The gameplay core is symmetric under a half turn about the centre (north team
 * ↔ south team); the four edges are each their own kind.
 */
export const T = {
  /** Playable half-extents: gorge rim and village fronts at |x|, cliff foot and river terrace at |z|. */
  edgeX: 38.4,
  edge: 41.6,
  /** Gallery floor. */
  high: 3.84,
  slab: 0.48,
  /** River and gorge water, far below the terrace. */
  water: -6.4,
  /** Across the hall (|x|): nave floor, column row, aisle to the arcade piers, court, court outer wall. */
  shrine: 6.0,
  col: 6.8,
  galleryIn: 6.8,
  galleryOut: 12.0,
  arcade: 12.8,
  court: 25.6,
  courtOut: 26.4,
  /** Along the hall (|z|): end walls, the gate hall's camp mouth, the camp's front (the yards' back). */
  hallZ: 20.8,
  row: 21.6,
  gate: 36.8,
  rangeOut: 34.4,
  /** Gallery roof (out of reach), nave roof, range roofs. */
  roofTop: 7.2,
  hallTop: 9.6,
  rangeTop: 4.8,
  /** Court and terrace walls a player cannot get onto, and the rails along drops. */
  courtWall: 3.2,
  parapet: 1.28,
  rise: 0.48,
  run: 0.8
} as const;

export type Kind =
  | 'cliff'
  | 'rock'
  | 'spur'
  | 'pillar'
  | 'pier'
  | 'roof'
  | 'wall'
  | 'hall'
  | 'cloister'
  | 'lintel'
  | 'slab'
  | 'parapet'
  | 'rail'
  | 'screen'
  | 'banner'
  | 'statue'
  | 'burner'
  | 'kiosk'
  | 'stele'
  | 'ruin'
  | 'boulder'
  | 'stall'
  | 'stack'
  | 'house'
  | 'fence'
  | 'planter'
  | 'dais';

export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
  bulletsPass?: boolean;
}

/** A straight flight of steps (blocks.ts STAIRS params without the style). */
export interface Flight {
  x: number;
  z: number;
  y0: number;
  dir: Face;
  width: number;
  steps: number;
}

const FLIP: Record<Face, Face> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** The half-turn copy of a piece (x, z) → (-x, -z). */
export function turned(p: Piece): Piece {
  return { ...p, min: [-p.max[0], p.min[1], -p.max[2]], max: [-p.min[0], p.max[1], -p.min[2]] };
}

export function turnedFlight(f: Flight): Flight {
  return { ...f, x: -f.x, z: -f.z, dir: FLIP[f.dir] };
}

export const box = (kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}): Piece => ({
  kind,
  min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
  max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
  ...extra
});

/** Door in a wall run: [from, to] along the run, open up to `top`. */
export type Door = [number, number, number];

/** Bot waypoints on both sides of every door, so links go straight through instead of clipping a jamb. */
export const doorways: Vec3[] = [];

/** Wall along x (`alongX`) or z from a0 to a1, cross-section c0..c1, with doors and lintels over them. */
export function run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = []): Piece[] {
  const out: Piece[] = [];
  const mk = (s: number, e: number, b: number, t: number, k: Kind = kind) => out.push(alongX ? box(k, s, b, c0, e, t, c1) : box(k, c0, b, s, c1, t, e));
  let at = a0;
  for (const [from, to, top] of [...doors].sort((a, b) => a[0] - b[0])) {
    if (from > at) mk(at, from, y0, y1);
    if (top < y1) mk(from, to, top, y1, 'lintel');
    at = to;
    const a = (from + to) / 2;
    for (const c of [c0 - 1.0, c1 + 1.0]) doorways.push(alongX ? [a, y0, c] : [c, y0, a]);
  }
  if (at < a1) mk(at, a1, y0, y1);
  return out;
}

/** Balustrade blocks (0.8 m long) along an edge every 1.6 m, skipping the given gaps. */
export function parapet(alongX: boolean, a0: number, a1: number, c0: number, c1: number, y: number, skip: [number, number][] = []): Piece[] {
  const out: Piece[] = [];
  for (let a = a0 + 0.4; a + 0.8 <= a1 - 0.2; a += 1.6) {
    if (skip.some(([s, e]) => a + 0.8 > s && a < e)) continue;
    out.push(alongX ? box('parapet', a, y, c0, a + 0.8, y + T.parapet, c1) : box('parapet', c0, y, a, c1, y + T.parapet, a + 0.8));
  }
  return out;
}

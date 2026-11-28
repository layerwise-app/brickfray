import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/**
 * Jade Temple plan. The teams camp at the west and east ends (x); three lanes run between them: the gorge path along
 * the north rim with the stone bridge at its middle, the processional way through the lotus courts and the great hall,
 * and the village street along the river terrace in the south. Solid blocks 12 m deep keep the lanes apart; each team
 * joins them through its own sutra passage and village lane. Gameplay is mirrored about x = 0; the dressing of the two
 * halves differs. The great hall at the centre is symmetric both ways (the audio rooms rely on it).
 */
export const T = {
  /** Playable half-extents: the camps' cliffs at |x|, the gorge rail (north) and river rail (south) at |z|. */
  edgeX: 64.8,
  edge: 44.8,
  /** Gallery floor. */
  high: 3.84,
  slab: 0.48,
  /** River and gorge water, far below the terrace. */
  water: -6.4,
  /** Across the hall (|x|): column row, gallery from the columns to its back wall, arcade outer face. */
  col: 6.8,
  galleryIn: 6.8,
  galleryOut: 12.0,
  arcade: 12.8,
  /** Along the hall (|z|): end walls, the end vestibules' outer wall. */
  hallZ: 12.8,
  row: 13.6,
  gate: 20.8,
  /** Gallery roof (out of reach), nave roof, vestibule roofs. */
  roofTop: 7.2,
  hallTop: 9.6,
  rangeTop: 4.8,
  parapet: 1.28,
  rise: 0.48,
  run: 0.8
} as const;

/** Lane bands (z) and the blocks between them. */
export const BAND = { north: -28.8, midN: -17.6, midS: 17.6, south: 28.8 } as const;
/** West camp's inner edge, the processional road's half width, the lotus court (|x|), the guest hall / refectory. */
export const CAMP = 52.0;
export const ROAD = 7.2;
export const COURT = { x0: 12.8, x1: 34.4, wall: 35.2 } as const;
/** The ravine under the stone bridge (|x|) and the bridge deck (z). */
export const RAVINE = 7.2;
export const BRIDGE = { z0: -43.2, z1: -33.6 } as const;

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
  | 'dais'
  | 'deck'
  | 'prop';

export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
  bulletsPass?: boolean;
  /** Collider boxes that follow an open shape (a statue, a roofed burner) instead of its bounds. */
  solid?: [Vec3, Vec3][];
  /** Drawing hint for pieces of one kind that look different (a house's district, a block's use). */
  tag?: string;
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

const FLIP: Record<Face, Face> = { n: 'n', s: 's', e: 'w', w: 'e' };

/** The mirror copy of a piece across x = 0 (west half to east half). */
export function mirrored(p: Piece): Piece {
  return { ...p, min: [-p.max[0], p.min[1], p.min[2]], max: [-p.min[0], p.max[1], p.max[2]] };
}

export function mirroredFlight(f: Flight): Flight {
  return { ...f, x: -f.x, dir: FLIP[f.dir] };
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
export function run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = [], extra: Partial<Piece> = {}): Piece[] {
  const out: Piece[] = [];
  const mk = (s: number, e: number, b: number, t: number, k: Kind = kind) => out.push(alongX ? box(k, s, b, c0, e, t, c1, extra) : box(k, c0, b, s, c1, t, e, extra));
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

/**
 * A balustrade along an edge of a raised floor at `y`: a solid stone wall to y + 1.0 (cover for whoever holds the floor)
 * and a see-through handrail on it to y + 1.6, so nobody stands on the wall's top.
 */
export function balustrade(x0: number, z0: number, x1: number, z1: number, y: number, tag?: string): Piece[] {
  return [box('parapet', x0, y, z0, x1, y + 1.0, z1, { tag }), box('rail', x0, y + 1.0, z0, x1, y + 1.6, z1, { bulletsPass: true, tag: 'handrail' })];
}

/** Balustrade blocks (0.8 m long) along an edge every 1.6 m, skipping the given gaps. */
export function parapet(alongX: boolean, a0: number, a1: number, c0: number, c1: number, y: number, skip: [number, number][] = [], h: number = T.parapet): Piece[] {
  const out: Piece[] = [];
  for (let a = a0 + 0.4; a + 0.8 <= a1 - 0.2; a += 1.6) {
    if (skip.some(([s, e]) => a + 0.8 > s && a < e)) continue;
    out.push(alongX ? box('parapet', a, y, c0, a + 0.8, y + h, c1) : box('parapet', c0, y, a, c1, y + h, a + 0.8));
  }
  return out;
}

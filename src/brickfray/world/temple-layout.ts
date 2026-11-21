import type { Surface } from './types';
import type { Face, Vec3 } from './util';

/**
 * Jade Temple gameplay geometry, symmetric under a half turn about the centre (north team ↔ south team).
 * A sunken court (|z| < canyon) holds the shrine and the bridges that cross it east–west; a row of tall
 * buildings walls it in on each side, so nothing high sees past the rows into the spawn districts or the lanes.
 */
export const T = {
  /** Playable half-size: stream banks at |x|, cliff feet at |z|. */
  edge: 30.4,
  /** Bridges, terraces and the shrine roof. */
  high: 3.84,
  slab: 0.48,
  water: -1.2,
  /** Half-depth of the central court, and the back of the building rows. */
  canyon: 10.4,
  row: 18.4,
  /** Gallery outer wall (lane side) and inner pillar line. */
  galleryOut: 24.8,
  galleryIn: 21.6,
  /** Shrine half-size and its stupa. */
  shrine: 6.4,
  stupa: 1.6,
  stupaTop: 10.08,
  /** Parapets are too tall to jump onto, so nobody stands above a deck. */
  parapet: 1.28,
  /** Every roof is out of reach: deck + parapet would still fall short of it. */
  roofTop: 6.24,
  hallTop: 6.72,
  rockTop: 6.72,
  cliffTop: 8.16,
  rise: 0.48,
  run: 0.8
} as const;

export type Kind =
  | 'cliff'
  | 'bank'
  | 'rock'
  | 'pillar'
  | 'roof'
  | 'wall'
  | 'hall'
  | 'lintel'
  | 'slab'
  | 'deck'
  | 'pier'
  | 'parapet'
  | 'stupa'
  | 'kiosk'
  | 'tower'
  | 'bell'
  | 'altar'
  | 'screen';

export interface Piece {
  kind: Kind;
  min: Vec3;
  max: Vec3;
  walk?: boolean;
  surface?: Surface;
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

const box = (kind: Kind, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<Piece> = {}): Piece => ({
  kind,
  min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
  max: [Math.max(x0, x1), y1, Math.max(z0, z1)],
  ...extra
});

/** Door in a wall run: [from, to] along the run, open up to `top`. */
type Door = [number, number, number];

/** Bot waypoints on both sides of every door, so links go straight through instead of clipping a jamb. */
const doorways: Vec3[] = [];

/** Wall along x (`alongX`) or z from a0 to a1, cross-section c0..c1, with doors and lintels over them. */
function run(kind: Kind, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, doors: Door[] = []): Piece[] {
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

/** Parapet blocks (0.8 m long) along an edge every 1.6 m, skipping the given gaps. */
function parapet(alongX: boolean, a0: number, a1: number, c0: number, c1: number, y: number, skip: [number, number][] = []): Piece[] {
  const out: Piece[] = [];
  for (let a = a0 + 0.4; a + 0.8 <= a1 - 0.2; a += 1.6) {
    if (skip.some(([s, e]) => a + 0.8 > s && a < e)) continue;
    out.push(alongX ? box('parapet', a, y, c0, a + 0.8, y + T.parapet, c1) : box('parapet', c0, y, a, c1, y + T.parapet, a + 0.8));
  }
  return out;
}

/** Stupa colliders as [half-width, bottom, top] above the shrine roof: terraces, bell dome, harmika and spire. */
export const STUPA: [number, number, number][] = [
  [T.stupa, 0, 1.44],
  [1.4, 1.44, 2.16],
  [1.2, 2.16, 2.76],
  [0.85, 2.76, 3.96],
  [0.45, 3.96, T.stupaTop - T.high]
];

const H = T.high;
const S = T.shrine;
const C = T.canyon;
const R = T.row;
const LOW = H - T.slab;

function perimeter(p: Piece[]) {
  const E = T.edge;
  p.push(box('cliff', -38.4, 0, -34.4, 38.4, T.cliffTop, -E));
  // The bank stops where the rock outcrop (its half-turn copy) meets the stream, leaving no ledge behind the rock.
  p.push(box('bank', -31.2, -2.4, -E, -E, 0.96, 14.4));
  p.push(box('cliff', -38.4, -2.4, -E, -34.4, T.cliffTop, E));
  p.push(box('rock', T.galleryOut, -2.4, -E, 31.2, T.rockTop, -14.4));
}

/** West gallery: solid lane-side wall with doors, pillars toward the court, one roof out of reach. */
function gallery(p: Piece[]) {
  const top = T.roofTop - 0.48;
  const out = T.galleryOut;
  p.push(...run('wall', false, -R, R, -out, -out + 0.8, 0, top, [[-15.2, -12.8, 2.88], [11.2, 13.6, 2.88]]));
  for (let z = -C + 0.4; z <= R - 0.4 + 1e-6; z += 3.2) if (z < C || z > C + 0.8) p.push(box('pillar', -T.galleryIn - 0.8, 0, z - 0.4, -T.galleryIn, top, z + 0.4));
  p.push(box('roof', -out - 0.4, top, -R - 0.4, -T.galleryIn + 0.4, T.roofTop, R + 0.4));
}

/** North row: west hall (two rooms), crypt corridor, bell house, altar house, east gateway. */
function northRow(p: Piece[], f: Flight[]) {
  const top = T.roofTop;
  // West hall, x -21.6..-4.8 (its east wall is the corridor's west wall).
  // Each room has a screen wall between its court door and its district door: no line runs through both.
  p.push(...run('hall', true, -T.galleryIn, -5.6, -R, -R + 0.8, 0, top, [[-18.4, -16.0, 2.88], [-10.4, -8.0, 2.88]]));
  p.push(...run('hall', true, -T.galleryIn, -5.6, -C - 0.8, -C, 0, top, [[-18.4, -16.0, 2.88], [-10.4, -8.0, 2.88]]));
  p.push(...run('hall', false, -R + 0.8, -C - 0.8, -T.galleryIn, -T.galleryIn + 0.8, 0, top, [[-17.2, -15.2, 2.88]]));
  p.push(...run('hall', false, -R + 0.8, -C - 0.8, -13.6, -12.8, 0, top, [[-14.0, -11.6, 2.88]]));
  p.push(box('screen', -19.2, 0, -14.8, -15.2, 3.36, -14.0));
  p.push(box('screen', -11.2, 0, -14.8, -7.2, 3.36, -14.0));
  p.push(box('roof', -T.galleryIn, top, -R - 0.2, -4.8, T.hallTop, -C + 0.2));
  // Crypt corridor from the district to the shrine's north door, through the row and across the court.
  const vault = T.roofTop - 0.48;
  p.push(...run('wall', false, -R, -S, -5.6, -4.8, 0, vault, [[-17.2, -15.2, 2.88]]));
  p.push(...run('wall', false, -R, -S, -2.4, -1.6, 0, vault, [[-17.2, -15.2, 2.88]]));
  p.push(box('lintel', -4.8, 3.36, -R, -2.4, vault, -R + 0.8));
  p.push(box('roof', -5.8, vault, -R - 0.2, -1.4, T.roofTop, -S));
  p.push(box('wall', -4.8, H, -S, -2.4, vault, -S + 0.4));
  // Bell house with its tower.
  p.push(...run('hall', true, -1.6, 7.2, -R, -R + 0.8, 0, top, [[1.6, 4.0, 2.88]]));
  p.push(...run('hall', true, -1.6, 7.2, -C - 0.8, -C, 0, top, [[1.6, 4.0, 2.88]]));
  p.push(box('screen', 0.8, 0, -14.8, 4.8, 3.36, -14.0));
  p.push(box('hall', 7.2, 0, -R, 8.0, top, -C));
  p.push(box('roof', -1.6, top, -R - 0.2, 8.0, T.hallTop, -C + 0.2));
  p.push(box('bell', 1.6, T.hallTop, -17.6, 4.8, 10.4, -14.4));
  // Altar house: a room below, a terrace over the court, a tall back room over the inner stair.
  const ax0 = 8.0;
  const ax1 = 18.4;
  p.push(...run('wall', true, ax0, ax1, -R, -R + 0.8, 0, LOW, [[16.0, 17.6, 2.56]]));
  p.push(...run('wall', true, ax0, ax1, -C - 0.8, -C, 0, LOW, [[8.8, 11.2, 2.56]]));
  p.push(box('wall', ax0, 0, -R + 0.8, ax0 + 0.8, LOW, -C - 0.8));
  p.push(box('wall', ax1 - 0.8, 0, -R + 0.8, ax1, LOW, -C - 0.8));
  f.push({ x: 9.6, z: -16.8, y0: 0, dir: 'e', width: 1.6, steps: 8 });
  // The stairwell opens from the third step, so a climbing head clears the slab edge.
  p.push(box('slab', ax0, LOW, -R, ax1, H, -R + 0.8));
  p.push(box('slab', ax0, LOW, -R + 0.8, 11.2, H, -16.0));
  p.push(box('slab', 16.0, LOW, -R + 0.8, ax1, H, -16.0, { walk: true }));
  p.push(box('slab', ax0, LOW, -16.0, ax1, H, -C, { walk: true }));
  const back = -14.4;
  p.push(box('tower', ax0, H, -R, ax1, 7.2, -R + 0.4));
  p.push(box('tower', ax0, H, -R + 0.4, ax0 + 0.4, 7.2, back));
  p.push(box('tower', ax1 - 0.4, H, -R + 0.4, ax1, 7.2, back));
  p.push(...run('tower', true, ax0 + 0.4, ax1 - 0.4, back - 0.4, back, H, 7.2, [[16.0, ax1 - 0.4, H + 2.4]]));
  p.push(box('roof', ax0 - 0.2, 7.2, -R - 0.2, ax1 + 0.2, 7.68, back + 0.2));
  p.push(box('wall', ax1 - 0.4, H, back, ax1, top, -C));
  p.push(...parapet(true, ax0, ax1 - 0.4, -C - 0.4, -C, H, [[16.4, 18.0]]));
  f.push({ x: 11.2, z: -C + 0.8, y0: 0, dir: 'e', width: 1.6, steps: 8 });
  // East gateway: a roofed passage between the altar house and the east gallery.
  p.push(box('roof', ax1, T.roofTop - 0.48, -R - 0.2, T.galleryIn, T.roofTop, -C));
  p.push(box('lintel', ax1, 2.88, -C - 0.8, T.galleryIn, T.roofTop - 0.48, -C));
}

/** Shrine at the centre: four doors, two inner stairs up to kiosks on the roof, a stupa on top. */
function shrine(p: Piece[], f: Flight[]) {
  p.push(...run('wall', true, -S, S, -S, -S + 0.8, 0, LOW, [[-4.8, -2.4, 2.56]]));
  p.push(...run('wall', false, -S + 0.8, S - 0.8, -S, -S + 0.8, 0, LOW, [[-1.2, 1.2, 2.56]]));
  p.push(box('altar', -1.2, 0, -1.2, 1.2, LOW, 0));
  // Porch cheeks at the west door: only a line from straight down the bridge's shadow reaches inside.
  for (const [z0, z1] of [[-2.0, -1.0], [1.0, 2.0]] as const) p.push(box('wall', -S - 3.2, 0, z0, -S, LOW, z1));
  p.push(box('slab', -S, LOW, -S, 0, H, -4.0, { walk: true }));
  p.push(box('slab', 4.8, LOW, -S, S, H, -4.0, { walk: true }));
  p.push(box('slab', 0, LOW, -S, 4.8, H, -5.6));
  p.push(box('slab', -S, LOW, -4.0, S, H, 0, { walk: true }));
  f.push({ x: -1.6, z: -4.8, y0: 0, dir: 'e', width: 1.6, steps: 8 });
  // Solid under the landing past the top step: no dead-end cubby under the floor beside the stair.
  p.push(box('wall', 4.8, 0, -S + 0.8, S - 0.8, LOW, -4.0));
  const kiosk = H + 2.4;
  p.push(box('kiosk', -0.4, H, -S, S, kiosk, -6.0));
  p.push(box('kiosk', -0.4, H, -3.6, 4.8, kiosk, -3.2));
  p.push(box('kiosk', -0.4, H, -6.0, 0, kiosk, -3.6));
  p.push(box('kiosk', 6.0, H, -6.0, S, kiosk, -3.6));
  p.push(box('roof', -0.6, kiosk, -S - 0.2, S + 0.2, kiosk + 0.32, -3.0));
  doorways.push([5.4, H, -4.6], [5.4, H, -2.2]);
  // Stupa tiers; the first is too tall to jump onto, so no ledge above it can be reached.
  for (const [r, y0, y1] of STUPA) p.push(box('stupa', -r, H + y0, -r, r, H + y1, 0));
  p.push(...parapet(true, -S, -0.4, -S, -S + 0.4, H, [[-4.8, -2.4]]));
  p.push(...parapet(false, -S, 0, -S, -S + 0.4, H, [[-1.6, 1.6]]));
  p.push(...parapet(false, -3.2, 0, S - 0.4, S, H, [[-1.6, 1.6]]));
}

/** West bridge: a landing on a solid pier, a deck on two piers, parapets both sides, steps down to the south. */
function bridge(p: Piece[], f: Flight[]) {
  p.push(box('tower', -20.0, 0, -1.6, -17.6, H, 1.6, { walk: true }));
  p.push(box('deck', -17.6, LOW, -1.6, -S, H, 1.6));
  for (let x = -18.8; x <= -S + 1e-6; x += 1.6) doorways.push([x, H, 0]);
  for (const x of [-15.2, -12.0]) p.push(box('pier', x, 0, -1.6, x + 0.8, LOW, 1.6));
  doorways.push([-16.4, 0, 0], [-13.2, 0, 0]);
  p.push(...parapet(true, -17.6, -S, -1.6, -1.2, H));
  p.push(...parapet(true, -20.0, -S, 1.2, 1.6, H));
  p.push(...parapet(false, -1.6, 1.6, -20.0, -19.6, H));
  f.push({ x: -18.8, z: -8.0, y0: 0, dir: 's', width: 2.4, steps: 8 });
}

function northHalf(): { pieces: Piece[]; flights: Flight[] } {
  const p: Piece[] = [];
  const f: Flight[] = [];
  perimeter(p);
  gallery(p);
  northRow(p, f);
  shrine(p, f);
  bridge(p, f);
  return { pieces: p, flights: f };
}

export function templeGeometry(): { pieces: Piece[]; flights: Flight[]; doorways: Vec3[] } {
  doorways.length = 0;
  const { pieces, flights } = northHalf();
  const seeds = doorways.flatMap((d): Vec3[] => [d, [-d[0], d[1], -d[2]]]);
  return { pieces: [...pieces, ...pieces.map(turned)], flights: [...flights, ...flights.map(turnedFlight)], doorways: seeds };
}

/** Team spawns in the north district (team 1); the south district gets their half-turn copies. */
export const CAMP_SPAWNS: [number, number][] = [
  [-21.6, -27.2],
  [-16.0, -28.8],
  [-10.4, -26.4],
  [-4.8, -28.8],
  [0.8, -26.4],
  [6.4, -28.8],
  [12.0, -26.4],
  [17.6, -28.8],
  [21.6, -24.8],
  [-26.4, -28.8]
];

/** Free-for-all spawns (north half; mirrored), all on the ground and out of the court's sight. */
export const FFA_SPAWNS: [number, number, number][] = [
  [-27.6, 0, -20.0],
  [-23.2, 0, -14.0],
  [-17.6, 0, -16.4],
  [-9.6, 0, -16.4],
  [3.2, 0, -16.4],
  [14.4, 0, -24.0],
  [19.2, 0, -21.6],
  [-12.0, 0, -22.4],
  [8.8, 0, -22.4]
];

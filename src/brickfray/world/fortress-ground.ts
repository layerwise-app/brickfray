import { DECAL, GROUND, type GroundParams } from './blocks';
import { KNOLL, MILL, QUAY } from './fortress-layout';
import { F } from './fortress-plan';
import type { Element, Plan } from './plan';
import { mix, Rng, shade } from './util';

type Rect = [number, number, number, number];

const X = F.edgeX;
const E = F.edge;
const R = MILL.race;
/** Inside the sealed keep there is no floor: nobody stands there, and bots get no waypoints in it. */
const H = F.keep - 0.8;

/** Walkable ground at 0: everything inside the edges but the keep, the mill race (the ford crosses it lower) and the cove. */
const LAND: Rect[] = [
  [-X, -E, X, -H],
  [-X, -H, -H, H],
  [H, -H, X, H],
  [-X, H, X, MILL.front],
  [-X, MILL.front, -R, E],
  [R, MILL.front, QUAY.cove0, E],
  [QUAY.cove0, MILL.front, QUAY.cove1, QUAY.coveZ],
  [QUAY.cove1, MILL.front, X, E]
];
/** Raised floors [rect, height]: the crag street's terrace, the knoll at the ruin, the east quay. Highest wins. */
const RAISED: [Rect, number][] = [
  [[-F.terrace, -E, 4.0, F.laneN], F.street],
  [[4.0, -E, F.terrace, F.laneNE], F.street],
  [[-KNOLL.half, -E, KNOLL.half, KNOLL.south], F.knoll],
  [[QUAY.x0, F.laneSE, QUAY.x1, QUAY.coveZ], F.quay],
  [[QUAY.x0, QUAY.coveZ, QUAY.cove0, E], F.quay],
  [[QUAY.cove1, QUAY.coveZ, QUAY.x1, E], F.quay]
];
const raisedAt = (x: number, z: number) => RAISED.reduce((y, [[x0, z0, x1, z1], h]) => (x > x0 && x < x1 && z > z0 && z < z1 ? Math.max(y, h) : y), 0);

const SAND = '#d6c290';
const GRASS = '#86ad52';
const FLAGS = '#c9c0ac';
const EARTH = '#c4a476';
const COBBLE = '#cbbd9c';
const COURT = '#b8b2a4';
const GRAVEL = '#beb39b';
const SANDSTONE = '#c9ab8c';
const PLANKS = '#a88a64';
/** The east bailey after the siege: trampled earth and weeds between the flags. */
const TRAMPLED = '#b3ad86';
const STRAW = '#c8b27a';
const GATE_Z = 10.4;

/** District floors, first match wins; everything else is sand. Each lane has its own ground. */
const ZONES: [Rect, string][] = [
  [[-X, -E, F.camp, E], SANDSTONE],
  [[-F.camp, -E, X, E], GRASS],
  [[-KNOLL.half, -E, KNOLL.half, KNOLL.south], GRASS],
  [[F.camp, -E, -F.camp, F.laneNE], EARTH],
  [[QUAY.x0, F.laneSE, QUAY.x1, E], PLANKS],
  [[F.camp, F.laneSE, -F.camp, E], GRAVEL],
  [[-46.4, -GATE_Z, F.castle, GATE_Z], COBBLE],
  [[-44.8, -30.4, F.castle, 30.4], COBBLE],
  [[-F.castle, -GATE_Z, 46.4, GATE_Z], STRAW],
  [[-F.castle, F.laneNE, 44.8, F.laneSE], STRAW],
  [[F.castle, -2.8, -F.castle, 2.8], COBBLE],
  [[F.keep, F.rangeN, -F.wallIn, F.rangeS], TRAMPLED],
  [[F.wallIn, F.rangeN, -F.wallIn, F.rangeS], COURT],
  [[F.castle, F.laneNE, -F.castle, F.laneSE], FLAGS]
];

const STEP = 4.8;

/** Ground colliders plus a patchwork of district floors in 4.8 m plates, each a slightly different tone. */
export function fortressGround(p: Plan) {
  for (const [x0, z0, x1, z1] of LAND) p.add(FLOOR, { x0, z0, x1, z1, y: 0, color: SAND, surface: 'plastic' });
  for (const [[x0, z0, x1, z1], y] of RAISED) p.add(FLOOR, { x0, z0, x1, z1, y, depth: y + 2, color: SAND, surface: 'plastic' });
  const rng = new Rng(29);
  const tone = new Map<string, number>();
  const cuts = (lo: number, hi: number, edges: number[]) => {
    const out = new Set<number>([lo, hi]);
    for (let v = Math.ceil(lo / STEP) * STEP; v < hi; v += STEP) out.add(+v.toFixed(3));
    for (const e of edges) if (e > lo && e < hi) out.add(e);
    return [...out].sort((a, b) => a - b);
  };
  const rects = [...ZONES.map(([r]) => r), ...RAISED.map(([r]) => r)];
  const ex = rects.flatMap((r) => [r[0], r[2]]);
  const ez = rects.flatMap((r) => [r[1], r[3]]);
  const floors: [Rect, number][] = [...LAND.map((r): [Rect, number] => [r, 0]), ...RAISED];
  for (const [[x0, z0, x1, z1], y] of floors) {
    const xs = cuts(x0, x1, ex);
    const zs = cuts(z0, z1, ez);
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        const [a, b, c, e] = [xs[i]!, zs[j]!, xs[i + 1]!, zs[j + 1]!];
        const cx = (a + c) / 2;
        const cz = (b + e) / 2;
        // Each plate is drawn once, at the height of the floor that shows there.
        if (raisedAt(cx, cz) !== y) continue;
        const base = ZONES.find(([[r0, s0, r1, s1]]) => cx > r0 && cx < r1 && cz > s0 && cz < s1)?.[1] ?? SAND;
        const key = `${Math.floor(cx / STEP)},${Math.floor(cz / STEP)},${base}`;
        if (!tone.has(key)) tone.set(key, rng.pick([0.045, 0.02, 0, -0.025, -0.045]));
        p.add(PLATE, { x0: a, z0: b, x1: c, z1: e, y, color: shade(base, tone.get(key)!), surface: 'plastic' });
      }
    }
  }
}

/**
 * Low draws the ground without the sky's reflection and without shadows, so sand turns a saturated yellow there: its
 * plates take a greyer tone to match medium and high.
 */
const PLATE: Element<GroundParams> = { draw: (d, p) => DECAL.draw(d, d.detail === 0 ? { ...p, color: mix(p.color, '#a7a9aa', 0.38) } : p) };

/** A walkable ground collider drawn by nothing: its look comes from the plates. */
const FLOOR: Element<GroundParams> = { colliders: GROUND.colliders, draw() {} };

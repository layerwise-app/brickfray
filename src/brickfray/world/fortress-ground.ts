import { DECAL, GROUND, type GroundParams } from './blocks';
import { F } from './fortress-plan';
import type { Element, Plan } from './plan';
import { Rng, shade } from './util';

type Rect = [number, number, number, number];

/** Walkable ground of the outline: the middle band, the upper ward, the barbican and the meadow south of the curtain. */
const LAND: Rect[] = [
  [-48.4, F.bandN, F.ford0, F.bandS],
  [-34.4, -48.8, 34.4, F.bandN],
  [-28.0, F.bandS, 10.4, 45.6],
  [10.4, F.bandS, F.ford0, 40.8]
];

const SAND = '#d6c290';
const GRASS = '#86ad52';
const FLAGS = '#c9c0ac';
const EARTH = '#c4a476';
const STRAW = '#d9c27a';
const COBBLE = '#cbbd9c';
const FORGE = '#a49b8c';

/** District floors, first match wins; everything else is sand. */
const ZONES: [Rect, string][] = [
  [[-5.6, -5.6, 5.6, 5.6], FLAGS],
  [[-20.0, -36.0, 16.0, -27.2], FLAGS],
  [[-20.0, -48.0, 24.0, -36.0], FLAGS],
  [[10.4, -7.2, 19.2, 7.2], FORGE],
  [[-19.2, -7.2, -10.4, 7.2], FLAGS],
  [[F.west, -8.8, -33.6, 8.8], STRAW],
  [[-33.6, -8.8, F.core0, 8.8], EARTH],
  [[-30.4, -48.0, -22.4, -27.2], GRASS],
  [[F.west, -27.2, -20.8, -8.8], GRASS],
  [[F.west, 8.8, -25.6, 27.2], EARTH],
  [[F.terrace, 29.6, F.ford0, 40.0], GRASS],
  [[32.0, 6.4, F.ford0, 29.6], GRASS],
  [[F.terrace, -27.2, 26.4, -21.6], GRASS]
];

/** Worn paths from the gates to the keep doors, a shade off the yard they cross. */
const PATHS: Rect[] = [
  [-7.2, 9.6, -4.0, 27.2],
  [-4.0, 9.6, -1.2, 12.0],
  [1.2, -27.2, 3.6, -9.6],
  [-3.2, -27.2, 1.2, -24.8]
];

const STEP = 4.8;

/** Ground colliders plus a patchwork of district floors in 4.8 m plates, each a slightly different tone. */
export function fortressGround(p: Plan) {
  for (const [x0, z0, x1, z1] of LAND) p.add(FLOOR, { x0, z0, x1, z1, y: 0, color: SAND, surface: 'plastic' });
  const rng = new Rng(29);
  const tone = new Map<string, number>();
  const cuts = (lo: number, hi: number, edges: number[]) => {
    const out = new Set<number>([lo, hi]);
    for (let v = Math.ceil(lo / STEP) * STEP; v < hi; v += STEP) out.add(+v.toFixed(3));
    for (const e of edges) if (e > lo && e < hi) out.add(e);
    return [...out].sort((a, b) => a - b);
  };
  const ex = ZONES.flatMap(([r]) => [r[0], r[2]]);
  const ez = ZONES.flatMap(([r]) => [r[1], r[3]]);
  for (const [x0, z0, x1, z1] of LAND) {
    const xs = cuts(x0, x1, ex);
    const zs = cuts(z0, z1, ez);
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        const [a, b, c, e] = [xs[i]!, zs[j]!, xs[i + 1]!, zs[j + 1]!];
        const cx = (a + c) / 2;
        const cz = (b + e) / 2;
        const base = ZONES.find(([[r0, s0, r1, s1]]) => cx > r0 && cx < r1 && cz > s0 && cz < s1)?.[1] ?? SAND;
        const key = `${Math.floor(cx / STEP)},${Math.floor(cz / STEP)},${base}`;
        if (!tone.has(key)) tone.set(key, rng.pick([0.045, 0.02, 0, -0.025, -0.045]));
        p.add(DECAL, { x0: a, z0: b, x1: c, z1: e, y: 0, color: shade(base, tone.get(key)!), surface: 'plastic' });
      }
    }
  }
  for (const [x0, z0, x1, z1] of PATHS) p.add(DECAL, { x0, z0, x1, z1, y: 0.003, color: COBBLE, surface: 'plastic' });
}

/** A walkable ground collider drawn by nothing: its look comes from the plates. */
const FLOOR: Element<GroundParams> = { colliders: GROUND.colliders, draw() {} };

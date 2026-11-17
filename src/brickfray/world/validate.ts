import { ColliderIndex, moveTo } from './nav';
import type { MapLayout } from './types';
import { MOVE, type Vec3 } from './util';

export interface LayoutReport {
  colliders: number;
  waypoints: number;
  links: number;
  reachableStates: number;
  spawnIssues: string[];
  /** Reachable standing spots outside bounds (walking, dropping or running jumps). */
  leaks: Vec3[];
  /** First 60 reachable spots with no waypoint nearby. */
  uncovered: Vec3[];
  /** Uncovered spots on floors of at least FLOOR_AREA m² (not incidental prop tops). */
  uncoveredFloor: Vec3[];
  /** Waypoints not mutually reachable with waypoint 0. */
  stranded: Vec3[];
  deadEnds: Vec3[];
  ms: number;
}

const STEP = 0.8;
const FLOOR_AREA = 16;
const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
const JUMPS: [number, number][] = [...DIRS, [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];

/** Flood-fills everywhere a player can stand from the spawns and checks the layout against it. */
export function validateLayout(layout: MapLayout): LayoutReport {
  const t0 = performance.now();
  const index = new ColliderIndex(layout.colliders);
  const { bounds, killY } = layout;
  const spawnIssues: string[] = [];
  layout.spawns.forEach((s, i) => {
    const [x, y, z] = s.position;
    const sup = index.support(x, z, y + 0.3);
    if (Math.abs(sup - y) > 0.03) spawnIssues.push(`spawn ${i} floats or sinks: y=${y} support=${sup}`);
    if (!index.clear(x, z, y)) spawnIssues.push(`spawn ${i} is inside a collider`);
    const near = layout.waypoints.some((w) => Math.hypot(w.position[0] - x, w.position[2] - z) < 3.5 && Math.abs(w.position[1] - y) < 1);
    if (!near) spawnIssues.push(`spawn ${i} has no waypoint within 3.5 m`);
  });

  const seen = new Set<string>();
  const queue: Vec3[] = [];
  const key = (p: Vec3) => `${Math.round(p[0] / STEP)},${Math.round(p[2] / STEP)},${Math.round(p[1] * 10)}`;
  const push = (p: Vec3) => {
    const k = key(p);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push(p);
  };
  for (const s of layout.spawns) push([Math.round(s.position[0] / STEP) * STEP, s.position[1], Math.round(s.position[2] / STEP) * STEP]);
  const leaks: Vec3[] = [];
  const reach: Vec3[] = [];
  const outside = (p: Vec3) => p[0] < bounds.min[0] || p[0] > bounds.max[0] || p[2] < bounds.min[2] || p[2] > bounds.max[2];
  while (queue.length && reach.length < 120000) {
    const p = queue.pop()!;
    reach.push(p);
    if (outside(p)) {
      if (leaks.length < 40) leaks.push(p);
      continue;
    }
    let edge = false;
    for (const [dx, dz] of DIRS) {
      const x = p[0] + dx * STEP;
      const z = p[2] + dz * STEP;
      const y = moveTo(index, p, x, z, killY, 100);
      if (y !== null) push([x, y, z]);
      if (y === null || y < p[1] - 0.3) edge = true;
    }
    if (!edge) continue;
    for (const [dx, dz] of JUMPS) {
      for (const dist of [1.6, 2.4, 3.2, 4.0]) {
        const x = Math.round((p[0] + dx * dist) / STEP) * STEP;
        const z = Math.round((p[2] + dz * dist) / STEP) * STEP;
        const land = index.support(x, z, p[1] + 0.5);
        if (land === -Infinity || land <= killY) continue;
        if (!index.clear(x, z, land)) continue;
        let arc = true;
        for (let k = 1; k < 4 && arc; k++) arc = index.clear(p[0] + (x - p[0]) * (k / 4), p[2] + (z - p[2]) * (k / 4), p[1] + 0.9, MOVE.radius, 1.2);
        if (arc) push([x, land, z]);
      }
    }
  }

  const uncovered: Vec3[] = [];
  const uncoveredFloor: Vec3[] = [];
  for (const p of reach) {
    if (outside(p)) continue;
    const ok = layout.waypoints.some((w) => Math.abs(w.position[1] - p[1]) < 1.3 && Math.hypot(w.position[0] - p[0], w.position[2] - p[2]) < 4.2);
    if (ok) continue;
    if (uncovered.length < 60) uncovered.push(p);
    let floor = false;
    index.forEach(p[0] - 0.3, p[2] - 0.3, p[0] + 0.3, p[2] + 0.3, (c) => {
      if (Math.abs(c.max[1] - p[1]) < 0.05 && (c.max[0] - c.min[0]) * (c.max[2] - c.min[2]) >= FLOOR_AREA) floor = true;
    });
    if (floor) uncoveredFloor.push(p);
  }

  const n = layout.waypoints.length;
  const fwd = new Uint8Array(n);
  const back = new Uint8Array(n);
  const reverse: number[][] = Array.from({ length: n }, () => []);
  layout.waypoints.forEach((w, i) => w.links.forEach((j) => reverse[j]!.push(i)));
  const flood = (mark: Uint8Array, next: (i: number) => number[]) => {
    if (!n) return;
    const stack = [0];
    mark[0] = 1;
    while (stack.length) for (const j of next(stack.pop()!)) if (!mark[j]) (mark[j] = 1), stack.push(j);
  };
  flood(fwd, (i) => layout.waypoints[i]!.links);
  flood(back, (i) => reverse[i]!);
  const stranded = layout.waypoints.filter((_, i) => !(fwd[i] && back[i])).map((w) => w.position);
  const deadEnds = layout.waypoints.filter((w) => w.links.length === 0).map((w) => w.position);
  return {
    colliders: layout.colliders.length,
    waypoints: n,
    links: layout.waypoints.reduce((a, w) => a + w.links.length, 0),
    reachableStates: reach.length,
    spawnIssues,
    leaks,
    uncovered,
    uncoveredFloor,
    stranded,
    deadEnds,
    ms: Math.round(performance.now() - t0)
  };
}

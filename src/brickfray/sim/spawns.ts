import type { MapLayout, SpawnPoint } from '../world/types';
import { nearestWaypoint } from './bot-nav';
import type { CollisionWorld } from './collision';
import { MOVE, PLAYER } from './constants';
import type { PlayerState } from './types';

export interface RecentDeath {
  x: number;
  z: number;
  time: number;
}

/** For each spawn, how far (m) an enemy at each waypoint has to run before it sees that spawn. */
export type SpawnWatch = Map<SpawnPoint, Float32Array>;

/** Farther than this (m) an enemy can't make out a player across any map; nearer, a clear line counts against a spawn. */
const SIGHT = 120;
/** A waypoint this near a spawn (m) with a clear line to it is a place an enemy sees someone appear there from. */
const WATCH = 70;
/** An enemy that can run to such a place within this many seconds counts against the spawn, more the sooner it gets there. */
const REACH = 4;

/**
 * Pick the spawn that is farthest from enemies, out of their sight, out of reach of a quick look round a corner, and
 * away from recent deaths; a team player only takes its own team's spawns (when the map has them). A little noise keeps
 * it from always choosing the same spot. `watch` (from `spawnWatch`) adds the look round the corner.
 */
export function pickSpawn(
  world: CollisionWorld,
  spawns: readonly SpawnPoint[],
  player: PlayerState,
  players: Iterable<PlayerState>,
  deaths: readonly RecentDeath[],
  now: number,
  random: () => number,
  watch: { layout: MapLayout; runs: SpawnWatch } | null = null
): SpawnPoint {
  const enemies = [...players].filter((p) => p.alive && p.id !== player.id && (player.team < 0 || p.team !== player.team));
  const candidates = spawns.filter((s) => player.team < 0 || s.team === player.team);
  const pool = candidates.length ? candidates : spawns;
  const wps = watch?.layout.waypoints;
  // Where each enemy joins the waypoint graph, and how far it stands off it.
  const onGraph = wps?.length
    ? enemies.map((e) => {
        const i = nearestWaypoint(wps, e.move.x, e.move.y, e.move.z);
        const [x, , z] = wps[i]!.position;
        return { i, off: Math.hypot(x - e.move.x, z - e.move.z) };
      })
    : null;
  let best = pool[0]!;
  let bestScore = -Infinity;
  for (const s of pool) {
    const [x, y, z] = s.position;
    const runs = watch?.runs.get(s);
    let score = random() * 4;
    let nearest = 80;
    enemies.forEach((e, k) => {
      const d = Math.hypot(e.move.x - x, e.move.z - z);
      nearest = Math.min(nearest, d);
      const seen = d < SIGHT && world.clearLine(e.move.x, e.move.y + PLAYER.eye, e.move.z, x, y + PLAYER.eye, z);
      if (seen) score -= 30;
      if (runs && onGraph) {
        const g = onGraph[k]!;
        const secs = seen ? 0 : (runs[g.i]! + g.off) / MOVE.sprint;
        score -= 25 * Math.max(0, 1 - secs / REACH);
      }
    });
    score += Math.min(nearest, 40);
    if (nearest < 8) score -= 60;
    for (const d of deaths) {
      if (now - d.time < 8 && Math.hypot(d.x - x, d.z - z) < 10) score -= 15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/**
 * Per spawn, the run (m, along the waypoint graph) from every waypoint to the nearest waypoint with a clear line to
 * the spawn: how soon an enemy there could see someone appear. Built once per match; null without a graph.
 */
export function spawnWatch(world: CollisionWorld, layout: MapLayout): SpawnWatch | null {
  const wps = layout.waypoints;
  if (!wps.length) return null;
  const into: number[][] = wps.map(() => []);
  wps.forEach((w, i) => {
    for (const j of w.links) into[j]!.push(i);
  });
  const length = (a: number, b: number) => {
    const p = wps[a]!.position;
    const q = wps[b]!.position;
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  };
  const out: SpawnWatch = new Map();
  for (const s of layout.spawns) {
    const [sx, sy, sz] = s.position;
    const run = new Float32Array(wps.length).fill(Infinity);
    const heap = new Heap();
    wps.forEach((w, i) => {
      const [x, y, z] = w.position;
      if (Math.hypot(x - sx, z - sz) < WATCH && world.clearLine(x, y + PLAYER.eye, z, sx, sy + PLAYER.eye, sz)) {
        run[i] = 0;
        heap.push(0, i);
      }
    });
    // Backwards along the links: the run from each waypoint to the nearest one that sees the spawn.
    while (heap.size) {
      const [d, j] = heap.pop();
      if (d > run[j]!) continue;
      for (const i of into[j]!) {
        const nd = d + length(i, j);
        if (nd < run[i]!) {
          run[i] = nd;
          heap.push(nd, i);
        }
      }
    }
    out.set(s, run);
  }
  return out;
}

/** Binary min-heap of (cost, node). */
class Heap {
  private costs: number[] = [];
  private nodes: number[] = [];

  get size() {
    return this.costs.length;
  }

  push(cost: number, node: number) {
    const c = this.costs;
    const n = this.nodes;
    let i = c.length;
    c.push(cost);
    n.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p]! <= cost) break;
      c[i] = c[p]!;
      n[i] = n[p]!;
      i = p;
    }
    c[i] = cost;
    n[i] = node;
  }

  pop(): [number, number] {
    const c = this.costs;
    const n = this.nodes;
    const top: [number, number] = [c[0]!, n[0]!];
    const cost = c.pop()!;
    const node = n.pop()!;
    if (c.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= c.length) break;
        const r = l + 1;
        const m = r < c.length && c[r]! < c[l]! ? r : l;
        if (c[m]! >= cost) break;
        c[i] = c[m]!;
        n[i] = n[m]!;
        i = m;
      }
      c[i] = cost;
      n[i] = node;
    }
    return top;
  }
}

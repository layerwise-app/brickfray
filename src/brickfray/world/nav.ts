import type { Collider, Waypoint } from './types';
import { MOVE, type PlanCollider, type Vec3 } from './util';

/** Uniform grid over collider footprints for fast support and clearance queries. */
export class ColliderIndex {
  private cells = new Map<number, number[]>();
  private stamp: Uint32Array;
  private tick = 0;

  constructor(
    readonly colliders: readonly Collider[],
    readonly cell = 4
  ) {
    this.stamp = new Uint32Array(colliders.length);
    colliders.forEach((c, i) => {
      for (let cx = Math.floor(c.min[0] / cell); cx <= Math.floor(c.max[0] / cell); cx++) {
        for (let cz = Math.floor(c.min[2] / cell); cz <= Math.floor(c.max[2] / cell); cz++) {
          const key = this.key(cx, cz);
          const list = this.cells.get(key);
          if (list) list.push(i);
          else this.cells.set(key, [i]);
        }
      }
    });
  }

  private key(cx: number, cz: number) {
    return (cx + 512) * 1024 + (cz + 512);
  }

  forEach(x0: number, z0: number, x1: number, z1: number, fn: (c: Collider) => boolean | void) {
    this.tick++;
    for (let cx = Math.floor(x0 / this.cell); cx <= Math.floor(x1 / this.cell); cx++) {
      for (let cz = Math.floor(z0 / this.cell); cz <= Math.floor(z1 / this.cell); cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const i of list) {
          if (this.stamp[i] === this.tick) continue;
          this.stamp[i] = this.tick;
          if (fn(this.colliders[i]!) === true) return;
        }
      }
    }
  }

  /** Highest top under a standing footprint at (x, z) that is at most `maxY`; -Infinity over the void. */
  support(x: number, z: number, maxY: number, r: number = MOVE.radius * 0.9) {
    let best = -Infinity;
    this.forEach(x - r, z - r, x + r, z + r, (c) => {
      if (x + r < c.min[0] || x - r > c.max[0] || z + r < c.min[2] || z - r > c.max[2]) return;
      const top = c.max[1];
      if (top <= maxY + 1e-4 && top > best) best = top;
    });
    return best;
  }

  /** True when a standing body at feet height `y` overlaps nothing it could not step onto. */
  clear(x: number, z: number, y: number, r: number = MOVE.radius, h: number = MOVE.height) {
    let ok = true;
    const y0 = y + MOVE.step;
    const y1 = y + h;
    this.forEach(x - r, z - r, x + r, z + r, (c) => {
      if (c.max[1] <= y0 || c.min[1] >= y1) return;
      if (x + r <= c.min[0] || x - r >= c.max[0] || z + r <= c.min[2] || z - r >= c.max[2]) return;
      ok = false;
      return true;
    });
    return ok;
  }
}

/**
 * Walk from a toward (x, z): step, jump up to MOVE.jump, or drop. Returns the
 * final feet height, or null when blocked, over the void, or a drop is too deep.
 */
export function moveTo(index: ColliderIndex, a: Vec3, x1: number, z1: number, killY: number, maxDrop: number = MOVE.maxDrop) {
  const dx = x1 - a[0];
  const dz = z1 - a[2];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  let y = a[1];
  let px = a[0];
  let pz = a[2];
  for (let i = 1; i <= n; i++) {
    const x = a[0] + (dx * i) / n;
    const z = a[2] + (dz * i) / n;
    const sup = index.support(x, z, y + MOVE.jump);
    if (sup === -Infinity || sup <= killY) return null;
    if (y - sup > maxDrop) return null;
    if (!index.clear(x, z, sup)) return null;
    if (sup > y + MOVE.step) {
      if (!index.clear(px, pz, sup)) return null;
      // The body is wider than the footprint that found `sup`; a taller block beside it stops the jump.
      if (index.support(x, z, y + MOVE.jump + MOVE.step, MOVE.radius) > y + MOVE.jump) return null;
    }
    y = sup;
    px = x;
    pz = z;
  }
  return y;
}

export function walkable(index: ColliderIndex, a: Vec3, b: Vec3, killY: number) {
  const y = moveTo(index, a, b[0], b[2], killY);
  return y !== null && Math.abs(y - b[1]) < 0.1;
}

const SPACING = 3.2;
const LINK = 5.8;

/** Evenly spaced positions across a floor span, reaching to 0.6 m from both ends. */
function lattice(min: number, max: number) {
  const lo = min + 0.6;
  const hi = max - 0.6;
  if (hi < lo) return [(min + max) / 2];
  const n = Math.max(1, Math.ceil((hi - lo) / SPACING));
  return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n);
}

/**
 * Waypoints on a lattice over every walkable floor plus seeds (stairs,
 * doors, spawns), linked wherever `walkable` succeeds.
 */
export function buildNav(colliders: PlanCollider[], seeds: Vec3[], bounds: { min: Vec3; max: Vec3 }, killY: number): Waypoint[] {
  const index = new ColliderIndex(colliders);
  const nodes: Vec3[] = [];
  const inBounds = (x: number, z: number) => x > bounds.min[0] && x < bounds.max[0] && z > bounds.min[2] && z < bounds.max[2];
  const tryAdd = (x: number, y: number, z: number, minGap: number) => {
    if (!inBounds(x, z)) return false;
    if (Math.abs(index.support(x, z, y + MOVE.step) - y) > 0.02) return false;
    if (!index.clear(x, z, y)) return false;
    for (const n of nodes) if (Math.abs(n[1] - y) < 0.4 && Math.hypot(n[0] - x, n[2] - z) < minGap) return true;
    nodes.push([x, y, z]);
    return true;
  };
  const JITTER = [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8]] as const;
  for (const s of seeds) {
    const y = index.support(s[0], s[2], s[1] + 0.6);
    if (y > killY) tryAdd(s[0], y, s[2], 0.5);
  }
  for (const c of colliders) {
    if (!c.walk) continue;
    for (const x of lattice(c.min[0], c.max[0])) {
      for (const z of lattice(c.min[2], c.max[2])) {
        for (const [jx, jz] of JITTER) {
          const px = x + jx;
          const pz = z + jz;
          if (px < c.min[0] || px > c.max[0] || pz < c.min[2] || pz > c.max[2]) continue;
          if (tryAdd(px, c.max[1], pz, 1.4)) break;
        }
      }
    }
  }
  const waypoints: Waypoint[] = nodes.map((position) => ({ position, links: [] }));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) > LINK) continue;
      if (Math.abs(b[1] - a[1]) > 4.5) continue;
      if (walkable(index, a, b, killY)) waypoints[i]!.links.push(j);
    }
  }
  return waypoints;
}

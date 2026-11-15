// Navigation grid auto-generated from the collision world (multi-level: one node per walkable surface per cell).
import * as THREE from 'three';
import type { Collider, Vec3Like, World } from './physics';

/** Horizontal extent of the area the grid covers. */
export interface NavBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A directed edge to a neighbouring node. */
export interface NavLink {
  to: number;
  cost: number;
  /** Height change along the link (positive = climbing). */
  dy: number;
}

/** A walkable spot: the centre of a grid cell on top of one surface. */
export interface NavNode {
  x: number;
  y: number;
  z: number;
  ix: number;
  iz: number;
  links: NavLink[];
}

/** Waypoints from start to goal; `complete` is false when the goal was not reached (the path ends nearest to it). */
export type NavPath = THREE.Vector3[] & { complete: boolean };

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();
const _q: Collider[] = [];
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** [priority, node id] */
type HeapEntry = [number, number];

/** Binary min-heap keyed on priority. */
class Heap {
  private readonly a: HeapEntry[] = [];

  push(f: number, n: number): void {
    const a = this.a;
    a.push([f, n]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  /** Remove and return the smallest entry. Only call while `size > 0`. */
  pop(): HeapEntry {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }

  get size(): number {
    return this.a.length;
  }
}

/** Walkable-surface graph over the collision world, with A* path finding. Call {@link build} before use. */
export class NavGrid {
  readonly world: World;
  readonly cell: number;
  readonly minX: number;
  readonly minZ: number;
  readonly nx: number;
  readonly nz: number;
  readonly nodes: NavNode[] = [];
  /** Node ids per grid cell (null = no walkable surface). */
  readonly cells: (number[] | null)[];
  // per-search scratch, sized by build()
  private gen = new Int32Array(0);
  private g = new Float32Array(0);
  private from = new Int32Array(0);
  private searchId = 0;

  constructor(world: World, bounds: NavBounds, cell = 1.0) {
    this.world = world;
    this.cell = cell;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.nx = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.nz = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.cells = new Array<number[] | null>(this.nx * this.nz).fill(null);
  }

  build(): this {
    const w = this.world;
    const c = this.cell;
    for (let iz = 0; iz < this.nz; iz++) {
      for (let ix = 0; ix < this.nx; ix++) {
        const x = this.minX + (ix + 0.5) * c;
        const z = this.minZ + (iz + 0.5) * c;
        _min.set(x - 0.05, -30, z - 0.05);
        _max.set(x + 0.05, 90, z + 0.05);
        w.query(_min, _max, _q);
        if (_q.length === 0) continue;
        const tops = new Set<number>();
        for (const b of _q) {
          if (!b.data.noNav) tops.add(b.max.y);
        }
        for (const y of [...tops].sort((a, b) => a - b)) {
          if (y < -5 || y > 70) continue;
          _min.set(x - 0.3, y + 0.5, z - 0.3);
          _max.set(x + 0.3, y + 1.85, z + 0.3);
          if (w.overlapsAABB(_min, _max)) continue;
          const id = this.nodes.length;
          this.nodes.push({ x, y, z, ix, iz, links: [] });
          const ci = iz * this.nx + ix;
          (this.cells[ci] || (this.cells[ci] = [])).push(id);
        }
      }
    }
    for (const A of this.nodes) {
      for (const [dx, dz] of DIRS) {
        const nix = A.ix + dx;
        const niz = A.iz + dz;
        if (nix < 0 || niz < 0 || nix >= this.nx || niz >= this.nz) continue;
        const cand = this.cells[niz * this.nx + nix];
        if (!cand) continue;
        for (const id of cand) {
          const B = this.nodes[id];
          const dy = B.y - A.y;
          if (dy > 1.35 || dy < -8) continue;
          if (
            dx !== 0 && dz !== 0 &&
            (!this.hasNodeNear(A.ix + dx, A.iz, A.y, B.y) || !this.hasNodeNear(A.ix, A.iz + dz, A.y, B.y))
          ) {
            continue;
          }
          if (!this.linkClear(A, B)) continue;
          if (dy < -0.6 && !this.dropClear(A, B)) continue;
          const horiz = Math.hypot(dx, dz) * c;
          let cost = Math.hypot(horiz, dy);
          if (dy > 0.6) cost *= 1 + dy * 1.1;
          else if (dy < -0.6) cost += -dy * 0.35;
          A.links.push({ to: id, cost, dy });
        }
      }
    }
    this.gen = new Int32Array(this.nodes.length);
    this.g = new Float32Array(this.nodes.length);
    this.from = new Int32Array(this.nodes.length);
    return this;
  }

  private hasNodeNear(ix: number, iz: number, y1: number, y2: number): boolean {
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return false;
    const cand = this.cells[iz * this.nx + ix];
    if (!cand) return false;
    for (const id of cand) {
      const y = this.nodes[id].y;
      if (Math.abs(y - y1) < 0.75 || Math.abs(y - y2) < 0.75) return true;
    }
    return false;
  }

  private linkClear(A: NavNode, B: NavNode): boolean {
    // Start above knee height so the next stair tread does not read as a wall; railings are
    // a metre tall and still block, which is what keeps enemies off balconies they cannot reach.
    const yBase = Math.max(A.y, B.y);
    _min.set(Math.min(A.x, B.x) - 0.25, yBase + 0.5, Math.min(A.z, B.z) - 0.25);
    _max.set(Math.max(A.x, B.x) + 0.25, yBase + 1.7, Math.max(A.z, B.z) + 0.25);
    return !this.world.overlapsAABB(_min, _max);
  }

  private dropClear(A: NavNode, B: NavNode): boolean {
    _min.set(B.x - 0.2, B.y + 0.05, B.z - 0.2);
    _max.set(B.x + 0.2, A.y + 0.05, B.z + 0.2);
    return !this.world.overlapsAABB(_min, _max);
  }

  /** Id of the best node near `pos` within `r` cells (preferring ones within `maxDy` below / 2.2 above), or -1. */
  nearestNode(pos: Vec3Like, r = 3, maxDy = 4): number {
    const c = this.cell;
    const cx = Math.floor((pos.x - this.minX) / c);
    const cz = Math.floor((pos.z - this.minZ) / c);
    let best = -1;
    let bestS = Infinity;
    let bestAny = -1;
    let bestAnyS = Infinity;
    for (let iz = cz - r; iz <= cz + r; iz++) {
      for (let ix = cx - r; ix <= cx + r; ix++) {
        if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) continue;
        const cand = this.cells[iz * this.nx + ix];
        if (!cand) continue;
        for (const id of cand) {
          const n = this.nodes[id];
          const dy = n.y - pos.y;
          const h = Math.hypot(n.x - pos.x, n.z - pos.z);
          const sAny = h + Math.abs(dy) * 2.0;
          if (sAny < bestAnyS) {
            bestAnyS = sAny;
            bestAny = id;
          }
          if (dy < -maxDy || dy > 2.2) continue;
          const s = h + Math.abs(dy) * 1.5;
          if (s < bestS) {
            bestS = s;
            best = id;
          }
        }
      }
    }
    return best >= 0 ? best : bestAny;
  }

  // A* between two world positions; returns array of Vector3 or null
  findPath(from: Vec3Like, to: Vec3Like, maxExpand = 40000): NavPath | null {
    const start = this.nearestNode(from, 3, 3);
    const goal = this.nearestNode(to, 4, 8);
    if (start < 0 || goal < 0) return null;
    const nodes = this.nodes;
    const gen = this.gen;
    const g = this.g;
    const fromArr = this.from;
    const sid = ++this.searchId;
    const G = nodes[goal];
    const h = (n: NavNode): number => Math.hypot(n.x - G.x, n.y - G.y, n.z - G.z) * 1.15;
    const heap = new Heap();
    gen[start] = sid;
    g[start] = 0;
    fromArr[start] = -1;
    heap.push(h(nodes[start]), start);
    let bestN = start;
    let bestH = h(nodes[start]);
    let expanded = 0;
    let found = false;
    const closed = new Set<number>();
    while (heap.size) {
      const [, cur] = heap.pop();
      if (closed.has(cur)) continue;
      closed.add(cur);
      if (cur === goal) {
        found = true;
        bestN = cur;
        break;
      }
      if (++expanded > maxExpand) break;
      const N = nodes[cur];
      const hc = h(N);
      if (hc < bestH) {
        bestH = hc;
        bestN = cur;
      }
      for (const l of N.links) {
        const ng = g[cur] + l.cost;
        if (gen[l.to] !== sid || ng < g[l.to]) {
          gen[l.to] = sid;
          g[l.to] = ng;
          fromArr[l.to] = cur;
          heap.push(ng + h(nodes[l.to]), l.to);
        }
      }
    }
    const points: THREE.Vector3[] = [];
    let n = bestN;
    while (n >= 0) {
      const nd = nodes[n];
      points.push(new THREE.Vector3(nd.x, nd.y, nd.z));
      n = fromArr[n];
    }
    points.reverse();
    return Object.assign(points, { complete: found });
  }

  randomNode(): NavNode {
    return this.nodes[Math.floor(Math.random() * this.nodes.length)];
  }
}

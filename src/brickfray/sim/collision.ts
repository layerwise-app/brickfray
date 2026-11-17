import type { Collider, Surface } from '../world/types';

export interface RayHit {
  t: number;
  normal: [number, number, number];
  surface: Surface;
  index: number;
}

const CELL = 4;
const cellKey = (cx: number, cz: number) => ((cx + 4096) << 13) | (cz + 4096);

/** Static box world shared by movement, bullets, grenades and bots. */
export class CollisionWorld {
  readonly boxes: Float64Array;
  readonly count: number;
  private readonly grid = new Map<number, number[]>();
  private readonly stamp: Uint32Array;
  private stampId = 0;

  constructor(readonly colliders: readonly Collider[]) {
    this.count = colliders.length;
    this.boxes = new Float64Array(this.count * 6);
    this.stamp = new Uint32Array(this.count);
    colliders.forEach((c, i) => {
      this.boxes.set([...c.min, ...c.max], i * 6);
      for (let cx = Math.floor(c.min[0] / CELL); cx <= Math.floor(c.max[0] / CELL); cx++) {
        for (let cz = Math.floor(c.min[2] / CELL); cz <= Math.floor(c.max[2] / CELL); cz++) {
          const key = cellKey(cx, cz);
          const list = this.grid.get(key);
          if (list) list.push(i);
          else this.grid.set(key, [i]);
        }
      }
    });
  }

  /** Indices of boxes overlapping the given box (open intervals, touching doesn't count). */
  overlaps(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, out: number[]): number[] {
    out.length = 0;
    const id = ++this.stampId;
    const b = this.boxes;
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const list = this.grid.get(cellKey(cx, cz));
        if (!list) continue;
        for (const i of list) {
          if (this.stamp[i] === id) continue;
          this.stamp[i] = id;
          const o = i * 6;
          if (x1 > b[o]! && x0 < b[o + 3]! && y1 > b[o + 1]! && y0 < b[o + 4]! && z1 > b[o + 2]! && z0 < b[o + 5]!) out.push(i);
        }
      }
    }
    return out;
  }

  /** First box hit along origin + dir * t for t in [0, maxT]; dir need not be normalized. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number, forBullets: boolean): RayHit | null {
    const b = this.boxes;
    let bestT = maxT;
    let best = -1;
    let axis = 0;
    let sign = 1;
    const ix = 1 / dx;
    const iy = 1 / dy;
    const iz = 1 / dz;
    for (let i = 0; i < this.count; i++) {
      if (forBullets && this.colliders[i]!.bulletsPass) continue;
      const o = i * 6;
      // A zero direction component makes 0 * Infinity = NaN on a face, so those axes are a plain inside test.
      let t0x = -Infinity;
      let t1x = Infinity;
      if (dx !== 0) {
        t0x = (b[o]! - ox) * ix;
        t1x = (b[o + 3]! - ox) * ix;
        if (t0x > t1x) [t0x, t1x] = [t1x, t0x];
      } else if (ox < b[o]! || ox > b[o + 3]!) continue;
      let t0y = -Infinity;
      let t1y = Infinity;
      if (dy !== 0) {
        t0y = (b[o + 1]! - oy) * iy;
        t1y = (b[o + 4]! - oy) * iy;
        if (t0y > t1y) [t0y, t1y] = [t1y, t0y];
      } else if (oy < b[o + 1]! || oy > b[o + 4]!) continue;
      let t0z = -Infinity;
      let t1z = Infinity;
      if (dz !== 0) {
        t0z = (b[o + 2]! - oz) * iz;
        t1z = (b[o + 5]! - oz) * iz;
        if (t0z > t1z) [t0z, t1z] = [t1z, t0z];
      } else if (oz < b[o + 2]! || oz > b[o + 5]!) continue;
      const tNear = Math.max(t0x, t0y, t0z);
      const tFar = Math.min(t1x, t1y, t1z);
      if (tNear > tFar || tFar < 0 || tNear >= bestT) continue;
      if (tNear < 0) continue; // origin inside the box: ignore so shots from cover edges still leave
      bestT = tNear;
      best = i;
      axis = tNear === t0x ? 0 : tNear === t0y ? 1 : 2;
      sign = axis === 0 ? -Math.sign(dx) : axis === 1 ? -Math.sign(dy) : -Math.sign(dz);
    }
    if (best < 0) return null;
    const normal: [number, number, number] = [0, 0, 0];
    normal[axis] = sign || 1;
    return { t: bestT, normal, surface: this.colliders[best]!.surface, index: best };
  }

  /** True when nothing blocks the segment (bullet-blocking boxes only). */
  clearLine(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    return this.raycast(ax, ay, az, bx - ax, by - ay, bz - az, 1, true) === null;
  }

  surfaceBelow(x: number, y: number, z: number): Surface {
    const hit = this.raycast(x, y + 0.05, z, 0, -1, 0, 0.4, false);
    return hit?.surface ?? 'plastic';
  }
}

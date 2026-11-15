// Axis-aligned box world: static colliders, spatial hash, swept body movement with step-up, raycasts.
import * as THREE from 'three';
import type { Breakable } from './level';

const EPS = 1e-4;
const AX = ['x', 'y', 'z'] as const;
type Axis = (typeof AX)[number];
/** Index into {@link AX}: 0 = x, 1 = y, 2 = z. */
type AxisIndex = 0 | 1 | 2;

/** Anything with x/y/z, e.g. a `THREE.Vector3` or a plain `{ x, y, z }`. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Per-collider flags and back-references set by the level builder. */
export interface ColliderData {
  /** Not a walkable surface for the navigation grid. */
  noNav?: boolean;
  /** Bullets pass through it (see {@link SEE_THROUGH}). */
  noShoot?: boolean;
  /** The grappling hook cannot attach to it. */
  noGrapple?: boolean;
  tag?: string;
  /** The breakable prop this collider belongs to. */
  breakable?: Breakable;
}

/** A static axis-aligned box collider. */
export interface Collider {
  min: Vec3Like;
  max: Vec3Like;
  data: ColliderData;
  id: number;
  /** Id of the last query that visited this box (de-duplicates boxes spanning several cells). */
  _q: number;
}
/** Alias of {@link Collider}. */
export type Box = Collider;

/** Result of {@link World.raycast}. */
export interface RayHit {
  dist: number;
  point: THREE.Vector3;
  /** Axis-aligned face normal of the face that was hit. */
  normal: THREE.Vector3;
  box: Collider;
}

/** Predicate deciding which colliders a ray ignores. */
export type RayFilter = (b: Collider) => boolean;

/** A moving capsule-ish box (feet at `pos`, `halfW` wide each way, `height` tall). Create with {@link makeBody}. */
export interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  halfW: number;
  height: number;
  /** How high a ledge the body walks up without jumping. */
  stepHeight: number;
  onGround: boolean;
  /** Set by the last move: whether a wall stopped horizontal movement, and its normal. */
  hitWall: boolean;
  hitCeiling: boolean;
  wallNormal: THREE.Vector3;
  /** Vertical speed at the moment of landing during the last move (0 if it did not land). */
  landVel: number;
  /** Do not snap down onto the ground when walking off a step. */
  noSnap: boolean;
  /** Allow stepping up even while airborne. */
  alwaysStep: boolean;
  /** Sign of the last horizontal push-back on x / z (0 = none). */
  _bx: number;
  _bz: number;
}

const _min = new THREE.Vector3();
const _max = new THREE.Vector3();
const _out: Collider[] = [];

/** The collision world: a list of static boxes indexed by a 2D spatial hash on x/z. */
export class World {
  readonly boxes: Collider[] = [];
  readonly cell: number;
  private readonly grid = new Map<number, Collider[]>();
  private qid = 0;
  readonly bounds = { min: new THREE.Vector3(-60, -20, -60), max: new THREE.Vector3(60, 80, 60) };

  constructor(cell = 8) {
    this.cell = cell;
  }

  // wipe the world so a different map can be built into the same instance
  clear(): void {
    this.boxes.length = 0;
    this.grid.clear();
    this.qid = 0;
  }

  /** Add a box collider. Call {@link finalize} once all boxes are in. */
  addBox(min: Vec3Like, max: Vec3Like, data: ColliderData = {}): Collider {
    const b: Collider = {
      min: { x: min.x, y: min.y, z: min.z },
      max: { x: max.x, y: max.y, z: max.z },
      data,
      id: this.boxes.length,
      _q: -1,
    };
    this.boxes.push(b);
    return b;
  }

  /** Rebuild the spatial hash. */
  finalize(): void {
    this.grid.clear();
    for (const b of this.boxes) this.insert(b);
  }

  removeBox(b: Collider): void {
    const i = this.boxes.indexOf(b);
    if (i < 0) return;
    this.boxes.splice(i, 1);
    this.finalize();
  }

  private key(ix: number, iz: number): number {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  private insert(b: Collider): void {
    const c = this.cell;
    const x0 = Math.floor(b.min.x / c);
    const x1 = Math.floor(b.max.x / c);
    const z0 = Math.floor(b.min.z / c);
    const z1 = Math.floor(b.max.z / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let arr = this.grid.get(k);
        if (!arr) {
          arr = [];
          this.grid.set(k, arr);
        }
        arr.push(b);
      }
    }
  }

  // Boxes overlapping the AABB [min,max]
  query(min: Vec3Like, max: Vec3Like, out: Collider[] = []): Collider[] {
    out.length = 0;
    const c = this.cell;
    const q = ++this.qid;
    const x0 = Math.floor(min.x / c);
    const x1 = Math.floor(max.x / c);
    const z0 = Math.floor(min.z / c);
    const z1 = Math.floor(max.z / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const arr = this.grid.get(this.key(ix, iz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const b = arr[i];
          if (b._q === q) continue;
          b._q = q;
          if (
            b.min.x < max.x && b.max.x > min.x &&
            b.min.y < max.y && b.max.y > min.y &&
            b.min.z < max.z && b.max.z > min.z
          ) {
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  overlapsAABB(min: Vec3Like, max: Vec3Like): boolean {
    return this.query(min, max, _out).length > 0;
  }

  private bodyBox(body: Body, min: THREE.Vector3, max: THREE.Vector3): void {
    const p = body.pos;
    const hw = body.halfW;
    min.set(p.x - hw + EPS, p.y + EPS, p.z - hw + EPS);
    max.set(p.x + hw - EPS, p.y + body.height - EPS, p.z + hw - EPS);
  }

  overlapsBody(body: Body): boolean {
    this.bodyBox(body, _min, _max);
    return this.query(_min, _max, _out).length > 0;
  }

  // Push the body out of any overlapping boxes along one axis. Returns sign of the push (0 = none).
  private resolveAxis(body: Body, axis: AxisIndex, move: number): number {
    const ax: Axis = AX[axis];
    const p = body.pos;
    let pushed = 0;
    const dir = Math.sign(move);
    const lim = Math.abs(move) + 0.03;
    for (let iter = 0; iter < 4; iter++) {
      this.bodyBox(body, _min, _max);
      this.query(_min, _max, _out);
      if (_out.length === 0) break;
      let best = 0;
      for (let i = 0; i < _out.length; i++) {
        const b = _out[i];
        const cNeg = b.min[ax] - _max[ax] - EPS; // move back (negative)
        const cPos = b.max[ax] - _min[ax] + EPS; // move forward (positive)
        let corr: number;
        if (dir > 0 && -cNeg <= lim) corr = cNeg;
        else if (dir < 0 && cPos <= lim) corr = cPos;
        else corr = Math.abs(cNeg) < Math.abs(cPos) ? cNeg : cPos;
        if (Math.abs(corr) > Math.abs(best)) best = corr;
      }
      if (best === 0) break;
      p[ax] += best;
      pushed = Math.sign(best);
    }
    return pushed;
  }

  private moveHoriz(body: Body, dx: number, dz: number, canStep: boolean): void {
    const p = body.pos;
    const ox = p.x;
    const oz = p.z;
    const oy = p.y;
    body._bx = 0;
    body._bz = 0;
    if (dx === 0 && dz === 0) return;
    p.x += dx;
    const rx = this.resolveAxis(body, 0, dx);
    p.z += dz;
    const rz = this.resolveAxis(body, 2, dz);
    if (rx === 0 && rz === 0) return;
    const nx = p.x;
    const nz = p.z;
    let stepped = false;
    if (canStep && body.stepHeight > 0) {
      p.x = ox;
      p.z = oz;
      p.y = oy + body.stepHeight;
      if (!this.overlapsBody(body)) {
        p.x += dx;
        const rx2 = this.resolveAxis(body, 0, dx);
        p.z += dz;
        const rz2 = this.resolveAxis(body, 2, dz);
        p.y -= body.stepHeight;
        this.resolveAxis(body, 1, -body.stepHeight);
        const d1 = (nx - ox) ** 2 + (nz - oz) ** 2;
        const d2 = (p.x - ox) ** 2 + (p.z - oz) ** 2;
        if (d2 > d1 + 1e-6 && p.y >= oy - 1e-3 && !this.overlapsBody(body)) {
          stepped = true;
          body._bx = rx2;
          body._bz = rz2;
          if (rx2 !== 0 || rz2 !== 0) {
            body.hitWall = true;
            body.wallNormal.set(rx2, 0, rz2).normalize();
          }
        }
      }
      if (!stepped) {
        p.x = nx;
        p.z = nz;
        p.y = oy;
      }
    }
    if (!stepped) {
      body._bx = rx;
      body._bz = rz;
      body.hitWall = true;
      body.wallNormal.set(rx, 0, rz).normalize();
    }
  }

  // Integrate movement for a body {pos, vel, halfW, height, stepHeight, onGround, ...}; sub-steps fast bodies so they never tunnel.
  moveBody(body: Body, dt: number): void {
    const sp = body.vel.length();
    const maxStep = Math.max(0.2, body.halfW * 0.8);
    const n = Math.min(10, Math.max(1, Math.ceil((sp * dt) / maxStep)));
    if (n === 1) {
      this.moveBodyStep(body, dt);
      return;
    }
    let landVel = 0;
    let hitWall = false;
    let hitCeiling = false;
    let wx = 0;
    let wz = 0;
    for (let i = 0; i < n; i++) {
      this.moveBodyStep(body, dt / n);
      if (body.hitWall) {
        hitWall = true;
        wx = body.wallNormal.x;
        wz = body.wallNormal.z;
      }
      if (body.hitCeiling) hitCeiling = true;
      if (body.landVel) landVel = body.landVel;
    }
    body.hitWall = hitWall;
    body.wallNormal.set(wx, 0, wz);
    body.hitCeiling = hitCeiling;
    body.landVel = landVel;
  }

  private moveBodyStep(body: Body, dt: number): void {
    const p = body.pos;
    const v = body.vel;
    body.hitWall = false;
    body.hitCeiling = false;
    body.wallNormal.set(0, 0, 0);
    body.landVel = 0;
    const wasGround = body.onGround;
    this.moveHoriz(body, v.x * dt, v.z * dt, wasGround || body.alwaysStep);
    if (body._bx !== 0) v.x = 0;
    if (body._bz !== 0) v.z = 0;
    const dy = v.y * dt;
    p.y += dy;
    const r = this.resolveAxis(body, 1, dy);
    body.onGround = false;
    if (r > 0) {
      body.onGround = true;
      body.landVel = v.y;
      if (v.y < 0) v.y = 0;
    } else if (r < 0) {
      body.hitCeiling = true;
      if (v.y > 0) v.y = 0;
    }
    if (!body.onGround && wasGround && v.y <= 0 && !body.noSnap) {
      const probe = body.stepHeight;
      p.y -= probe;
      const r2 = this.resolveAxis(body, 1, -probe);
      if (r2 > 0) {
        body.onGround = true;
        v.y = 0;
      } else {
        p.y += probe;
      }
    }
  }

  // Ray vs all boxes (slab test). Returns {dist, point, normal, box} or null.
  raycast(o: Vec3Like, d: Vec3Like, maxDist = 1000, ignore: RayFilter | null = null): RayHit | null {
    let best: Collider | null = null;
    let bestT = maxDist;
    let bAxis = -1;
    let bSign = 0;
    const boxes = this.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (ignore && ignore(b)) continue;
      let tmin = 0;
      let tmax = bestT;
      let nAxis = -1;
      let nSign = 0;
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const ax = AX[a];
        const da = d[ax];
        const oa = o[ax];
        if (Math.abs(da) < 1e-9) {
          if (oa < b.min[ax] || oa > b.max[ax]) {
            ok = false;
            break;
          }
          continue;
        }
        const inv = 1 / da;
        let t1 = (b.min[ax] - oa) * inv;
        let t2 = (b.max[ax] - oa) * inv;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          nAxis = a;
          nSign = sign;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) {
          ok = false;
          break;
        }
      }
      if (!ok || nAxis < 0) continue;
      if (tmin < bestT) {
        best = b;
        bestT = tmin;
        bAxis = nAxis;
        bSign = nSign;
      }
    }
    if (!best) return null;
    const point = new THREE.Vector3(o.x + d.x * bestT, o.y + d.y * bestT, o.z + d.z * bestT);
    const normal = new THREE.Vector3();
    normal[AX[bAxis]] = bSign;
    return { dist: bestT, point, normal, box: best };
  }

  // Highest walkable surface below a point
  groundBelow(x: number, y: number, z: number, maxDrop = 100): number {
    const hit = this.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, maxDrop);
    return hit ? hit.point.y : y - maxDrop;
  }

  hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3, ignore: RayFilter | null = null): boolean {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return true;
    d.divideScalar(len);
    return this.raycast(a, d, len, ignore) === null;
  }
}

/** Ray filter that lets shots pass through `noShoot` colliders. */
export const SEE_THROUGH: RayFilter = (b) => b.data.noShoot === true;

/** Create a fresh {@link Body} at a copy of `pos`. */
export function makeBody(pos: THREE.Vector3, halfW: number, height: number, stepHeight = 0.55): Body {
  return {
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    halfW,
    height,
    stepHeight,
    onGround: false,
    hitWall: false,
    hitCeiling: false,
    wallNormal: new THREE.Vector3(),
    landVel: 0,
    noSnap: false,
    alwaysStep: false,
    _bx: 0,
    _bz: 0,
  };
}

// Particles (ink droplets/strokes), decals (blood splats, bullet holes), rigid gibs, tracers.
import * as THREE from 'three';
import { makeInkMaterial, INK } from '../render/ink-renderer';
import { rand, randInt, clamp, lerp, TAU } from '../core/math';
import { SEE_THROUGH } from '../world/physics';
import type { RayHit, World } from '../world/physics';

/** A fixed-size instanced mesh used as a ring buffer of decals or particles. */
interface InstancePool {
  readonly mesh: THREE.InstancedMesh;
  /** Per-instance `[ink, fill, unused]`, read by the ink shader. */
  readonly colors: THREE.InstancedBufferAttribute;
  readonly max: number;
  next: number;
  used: number;
}

/** A blood pool decal that swells to its full size over `dur` seconds. */
interface GrowingDecal {
  pool: InstancePool;
  i: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  size: number;
  t: number;
  dur: number;
  ink: number;
}

/** `drop`: a round blob; `stroke`: a line stretched along its velocity; `emitter`: spawns drops. */
export type ParticleKind = 'drop' | 'stroke' | 'emitter';
/** What a particle does when it hits the world: leave a splat, or nothing (it never collides). */
export type ParticleCollide = 'decal' | null;
export type DecalKind = 'splat' | 'hole';

export interface Particle {
  kind: ParticleKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3 | null;
  life: number;
  maxLife: number;
  size: number;
  ink: number;
  fill: boolean;
  gravity: number;
  drag: number;
  collide: ParticleCollide;
  stretch: number;
  /** Fixed length for strokes drawn along `axis` (tracers); 0 means "stretch along velocity". */
  len: number;
  axis: THREE.Vector3 | null;
  decalSize: number;
  shrink: boolean;
  /** Emitters only: drops spawned per second. */
  rate: number;
  acc: number;
  /** Scale the particle balloons to by the end of its life (0 = no growth). */
  grow: number;
}

export interface ParticleOptions {
  life?: number;
  size?: number;
  ink?: number;
  fill?: boolean;
  gravity?: number;
  drag?: number;
  collide?: ParticleCollide;
  stretch?: number;
  len?: number;
  axis?: THREE.Vector3 | null;
  decalSize?: number;
  shrink?: boolean;
  rate?: number;
  grow?: number;
}

export interface StrokeBurstOptions {
  size?: number;
  life?: number;
  gravity?: number;
  stretch?: number;
  drag?: number;
}

export interface BloodOptions {
  ink?: number;
}

/** A rigid piece of debris (gib, dropped weapon, prop chunk) bouncing around the world. */
export interface Debris {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  life: number;
  radius: number;
  blood: boolean;
  rest: boolean;
  bloodT: number;
  bounces: number;
  baseScale: number;
}

export interface DebrisOptions {
  life?: number;
  radius?: number;
  blood?: boolean;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _prev = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _dt1 = new THREE.Vector3();
const _dt2 = new THREE.Vector3();
const _off = new THREE.Vector3();
const _pc = new THREE.Vector3();
const _ps = new THREE.Vector3();
const _pd = new THREE.Vector3();
const _mtx = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _z = new THREE.Vector3(0, 0, 1);
const _down = new THREE.Vector3(0, -1, 0);

function splatGeometry(seed: number): THREE.ShapeGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 20;
  const r0 = 0.42 + (0.1 * ((seed * 7) % 3)) / 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    // a few long fingers of ink rather than an even blob
    const finger = Math.pow(Math.abs(Math.sin(a * (1.5 + seed * 0.5) + seed * 2.1)), 3) * 0.55;
    const wob = 0.82 + 0.36 * (((i * 13 + seed * 5) % 7) / 7);
    pts.push(new THREE.Vector2(Math.cos(a) * r0 * (1 + finger) * wob, Math.sin(a) * r0 * (1 + finger * 0.7) * wob));
  }
  const shapes = [new THREE.Shape(pts)];
  const sat = 3 + (seed % 3);
  for (let k = 0; k < sat; k++) {
    const a = seed * 2.3 + k * (TAU / sat) + 0.4;
    const d = 0.6 + 0.22 * (((k * 3 + seed) % 4) / 4);
    shapes.push(new THREE.Shape().absarc(Math.cos(a) * d, Math.sin(a) * d, 0.045 + (0.05 * ((k + seed) % 3)) / 3, 0, TAU, false));
  }
  return new THREE.ShapeGeometry(shapes, 5);
}

/** Owns every transient visual: particles, decals, debris and camera shake. */
export class Effects {
  private readonly scene: THREE.Scene;
  private readonly world: World;
  private readonly drops: InstancePool;
  private readonly strokes: InstancePool;
  private readonly splats: InstancePool[];
  private readonly holes: InstancePool;
  readonly particles: Particle[] = [];
  readonly debrisList: Debris[] = [];
  private readonly growing: GrowingDecal[] = [];
  /** Camera shake accumulator; the player's camera reads and decays it. */
  shakeAmt = 0;
  /** Number of blood-trailing gibs still alive. */
  gibsAlive = 0;

  constructor(scene: THREE.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.drops = this._pool(new THREE.IcosahedronGeometry(0.5, 1), 700);
    this.strokes = this._pool(new THREE.BoxGeometry(1, 1, 1), 600);
    this.splats = [0, 1, 2, 3, 4].map((i) => this._pool(splatGeometry(i), 300, true));
    this.holes = this._pool(new THREE.CircleGeometry(0.5, 8), 260, true);
  }

  private _pool(geo: THREE.BufferGeometry, max: number, double = false): InstancePool {
    const mat = makeInkMaterial({ ink: INK.RED, fill: true, side: double ? THREE.DoubleSide : THREE.FrontSide });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    mesh.instanceColor = colors;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    colors.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return { mesh, colors, max, next: 0, used: 0 };
  }

  private _write(
    pool: InstancePool,
    i: number,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    scale: THREE.Vector3,
    ink: number,
    fill: boolean,
  ): void {
    _m.compose(pos, quat, scale);
    pool.mesh.setMatrixAt(i, _m);
    const c = pool.colors.array;
    c[i * 3] = ink;
    c[i * 3 + 1] = fill ? 1 : 0;
    c[i * 3 + 2] = 0;
  }

  private _alloc(pool: InstancePool): number {
    const i = pool.next;
    pool.next = (pool.next + 1) % pool.max;
    pool.used = Math.min(pool.used + 1, pool.max);
    pool.mesh.count = pool.used;
    return i;
  }

  /** Remove every particle, decal and piece of debris. */
  clear(): void {
    this.particles.length = 0;
    this.growing.length = 0;
    for (const d of this.debrisList) this.scene.remove(d.mesh);
    this.debrisList.length = 0;
    for (const p of [this.drops, this.strokes, this.holes, ...this.splats]) {
      p.next = 0;
      p.used = 0;
      p.mesh.count = 0;
    }
  }

  // ---------- decals ----------
  /** Stamp a single decal flat on a surface; with `dir`, it is laid along it as a streak. */
  decal(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    ink: number = INK.RED,
    size = 0.3,
    kind: DecalKind = 'splat',
    dir: THREE.Vector3 | null = null,
    stretch = 1,
  ): { pool: InstancePool; i: number } {
    const pool = kind === 'hole' ? this.holes : this.splats[randInt(0, this.splats.length - 1)];
    const i = this._alloc(pool);
    _v.copy(point).addScaledVector(normal, rand(0.012, 0.03));
    // if the blood had a direction, lay the mark along it so it reads as a streak
    const along = dir && _dt1.copy(dir).addScaledVector(normal, -dir.dot(normal)).lengthSq() > 1e-5;
    if (along) {
      _dt1.normalize();
      _dt2.crossVectors(_dt1, normal).normalize();
      _mtx.makeBasis(_dt2, _dt1, normal);
      _q.setFromRotationMatrix(_mtx);
      _s.set(size * rand(0.6, 0.85), size * stretch * rand(0.9, 1.5), 1);
    } else {
      _q.setFromUnitVectors(_z, normal);
      _q2.setFromAxisAngle(normal, rand(0, TAU));
      _q.premultiply(_q2);
      _s.set(size, size * rand(0.7, 1.3), 1);
    }
    this._write(pool, i, _v, _q, _s, ink, true);
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.colors.needsUpdate = true;
    return { pool, i };
  }

  // Find the surface a mark should actually sit on. Casting back along the normal catches the
  // face we hit and, past an edge, whatever is below it; the second cast catches the side face
  // we just spilled over. This is what stops splats hanging in mid air off the corner of a box.
  private _surfaceAt(point: THREE.Vector3, normal: THREE.Vector3, offset: THREE.Vector3): RayHit | null {
    _pc.copy(point).add(offset);
    _ps.copy(_pc).addScaledVector(normal, 0.35);
    _pd.copy(normal).negate();
    let hit = this.world.raycast(_ps, _pd, 2.2, SEE_THROUGH);
    if (hit) return hit;
    const len = offset.length();
    if (len > 1e-4) {
      _ps.copy(_pc).addScaledVector(normal, 0.05);
      _pd.copy(offset).divideScalar(-len);
      hit = this.world.raycast(_ps, _pd, len + 0.3, SEE_THROUGH);
    }
    return hit;
  }

  // A splat is a cluster of smaller marks, each projected separately, so it wraps over edges.
  splat(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    ink: number = INK.RED,
    size = 0.5,
    dir: THREE.Vector3 | null = null,
    cluster = 3,
  ): void {
    this.decal(point, normal, ink, size * rand(0.55, 0.8), 'splat', dir);
    _t1.set(normal.y, normal.z, normal.x).cross(normal);
    if (_t1.lengthSq() < 1e-6) _t1.set(1, 0, 0);
    _t1.normalize();
    _t2.crossVectors(normal, _t1);
    for (let i = 0; i < cluster; i++) {
      const a = rand(0, TAU);
      const r = size * rand(0.3, 1.15);
      _off.copy(_t1).multiplyScalar(Math.cos(a) * r).addScaledVector(_t2, Math.sin(a) * r);
      if (dir) _off.addScaledVector(dir, size * rand(0, 0.7));
      const h = this._surfaceAt(point, normal, _off);
      if (h) this.decal(h.point, h.normal, ink, size * rand(0.2, 0.5), 'splat', dir);
    }
    // on a wall, let a little of it run downwards
    if (Math.abs(normal.y) < 0.55 && Math.random() < 0.75) {
      _off.set(0, -size * rand(0.5, 1.3), 0);
      const h = this._surfaceAt(point, normal, _off);
      if (h) this.decal(h.point, h.normal, ink, size * rand(0.16, 0.3), 'splat', _down, rand(2.5, 5));
    }
  }

  /** A pool of ink that spreads out on the ground below `pos`. */
  bloodPool(pos: THREE.Vector3, size = 1.3, ink: number = INK.RED): void {
    _v.copy(pos);
    _v.y += 0.5;
    const base = this.world.raycast(_v, _down, 5, SEE_THROUGH);
    if (!base) return;
    const n = 3;
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU);
      const r = k === 0 ? 0 : size * rand(0.15, 0.5);
      _off.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const hit = k === 0 ? base : this._surfaceAt(base.point, base.normal, _off);
      if (!hit) continue;
      const pool = this.splats[randInt(0, this.splats.length - 1)];
      const i = this._alloc(pool);
      const quat = new THREE.Quaternion().setFromUnitVectors(_z, hit.normal);
      _q2.setFromAxisAngle(hit.normal, rand(0, TAU));
      quat.premultiply(_q2);
      const p = hit.point.clone().addScaledVector(hit.normal, rand(0.02, 0.04));
      this.growing.push({
        pool,
        i,
        pos: p,
        quat,
        size: size * (k === 0 ? rand(0.75, 1) : rand(0.3, 0.6)),
        t: 0,
        dur: rand(0.5, 1.1),
        ink,
      });
    }
  }

  bulletImpact(point: THREE.Vector3, normal: THREE.Vector3, ink: number = INK.BLUE): void {
    this.decal(point, normal, ink, rand(0.06, 0.1), 'hole');
    this.sparks(point, normal, ink, 5);
  }

  sparks(point: THREE.Vector3, normal: THREE.Vector3, ink: number = INK.BLUE, n = 6, speed = 7): void {
    for (let i = 0; i < n; i++) {
      _v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      if (_v.dot(normal) < 0) _v.negate();
      _v.addScaledVector(normal, 0.6).normalize().multiplyScalar(rand(speed * 0.4, speed));
      this._spawn('stroke', point, _v, {
        size: rand(0.012, 0.025),
        life: rand(0.15, 0.35),
        ink,
        gravity: 14,
        stretch: 0.035,
        collide: null,
      });
    }
  }

  strokeBurst(pos: THREE.Vector3, ink: number, n = 16, speed = 6, opts: StrokeBurstOptions = {}): void {
    for (let i = 0; i < n; i++) {
      _v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.3, speed));
      this._spawn('stroke', pos, _v, {
        size: opts.size ?? rand(0.02, 0.04),
        life: opts.life ?? rand(0.25, 0.5),
        ink,
        gravity: opts.gravity ?? 0,
        stretch: opts.stretch ?? 0.05,
        drag: opts.drag ?? 3,
        collide: null,
      });
    }
  }

  /** A short-lived straight line from `from` to `to` (bullet tracers, sword arcs). */
  tracer(from: THREE.Vector3, to: THREE.Vector3, ink: number = INK.BLUE, thick = 0.022, life = 0.06): void {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.05) return;
    _d.divideScalar(len);
    _v.copy(from).addScaledVector(_d, len / 2);
    this._spawn('stroke', _v, null, { life, size: thick, ink, axis: _d.clone(), len, gravity: 0, shrink: false });
  }

  // ---------- blood ----------
  blood(pos: THREE.Vector3, dir: THREE.Vector3, amount = 1, opts: BloodOptions = {}): void {
    const ink = opts.ink ?? INK.RED;
    const n = Math.round(14 * amount);
    for (let i = 0; i < n; i++) {
      _v.copy(dir)
        .multiplyScalar(rand(1, 6))
        .add(_v2.set(rand(-1, 1), rand(-0.5, 1.2), rand(-1, 1)).multiplyScalar(rand(1, 4.5)));
      this._spawn('drop', pos, _v, {
        size: rand(0.02, 0.065),
        life: rand(1.2, 2.6),
        ink,
        collide: 'decal',
        gravity: 22,
        decalSize: rand(4, 8),
      });
    }
    const m = Math.round(7 * amount);
    for (let i = 0; i < m; i++) {
      _v.copy(dir)
        .multiplyScalar(rand(6, 15))
        .add(_v2.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).multiplyScalar(rand(1, 4)));
      this._spawn('stroke', pos, _v, {
        size: rand(0.02, 0.04),
        life: rand(0.3, 0.6),
        ink,
        collide: 'decal',
        gravity: 12,
        stretch: 0.05,
        decalSize: 5,
      });
    }
    const k = Math.round(6 * amount);
    for (let i = 0; i < k; i++) {
      _v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1))
        .multiplyScalar(rand(0.5, 2.5))
        .addScaledVector(dir, rand(0, 2));
      this._spawn('drop', pos, _v, {
        size: rand(0.012, 0.03),
        life: rand(0.3, 0.7),
        ink,
        collide: null,
        gravity: 6,
        drag: 2,
      });
    }
  }

  // a fat bead of ink running off a blade
  drip(pos: THREE.Vector3, amount = 1): void {
    this._spawn('drop', pos, _v.set(rand(-0.3, 0.3), rand(-0.4, 0.2), rand(-0.3, 0.3)), {
      size: rand(0.018, 0.03) + 0.02 * amount,
      life: rand(1, 1.8),
      ink: INK.RED,
      collide: 'decal',
      gravity: 20,
      decalSize: 5,
    });
  }

  // Grenade blast: a fat orange fireball of overlapping blobs, a thick ring of strokes thrown
  // outward, black smoke rolling up after it, and a scorched decal on whatever is below.
  boom(pos: THREE.Vector3, radius = 5): void {
    const k = radius / 5;
    // a fat orange fireball: a few huge fills that balloon fast, then a cloud of smaller blobs
    for (let i = 0; i < 4; i++) {
      _v.set(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1.6));
      this._spawn('drop', pos, _v, {
        size: rand(2.2, 3.2) * k,
        life: rand(0.3, 0.45),
        ink: INK.ORANGE,
        fill: true,
        gravity: -2,
        drag: 3,
        collide: null,
        grow: 3.2,
        shrink: false,
      });
    }
    for (let i = 0; i < 26; i++) {
      _v.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 8));
      this._spawn('drop', pos, _v, {
        size: rand(0.9, 1.9) * k,
        life: rand(0.35, 0.6),
        ink: i % 5 === 0 ? INK.BLACK : INK.ORANGE,
        fill: true,
        gravity: -3,
        drag: 4,
        collide: null,
        grow: 2.8,
        shrink: false,
      });
    }
    // thick ink strokes flung outward, a few black ones for weight
    for (let i = 0; i < 64; i++) {
      _v.set(rand(-1, 1), rand(-0.15, 0.9), rand(-1, 1)).normalize().multiplyScalar(rand(14, 34) * k);
      this._spawn('stroke', pos, _v, {
        size: rand(0.09, 0.2) * k,
        life: rand(0.3, 0.55),
        ink: i % 4 === 0 ? INK.BLACK : INK.ORANGE,
        gravity: 8,
        stretch: 0.09,
        drag: 2,
        collide: null,
      });
    }
    // black soot that splatters onto whatever it lands on
    for (let i = 0; i < 30; i++) {
      _v.set(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(3, 10) * k);
      this._spawn('drop', pos, _v, {
        size: rand(0.06, 0.14),
        life: rand(0.8, 1.6),
        ink: INK.BLACK,
        collide: 'decal',
        gravity: 16,
        decalSize: rand(3, 7) * k,
      });
    }
    // a rising column of outlined smoke rings
    for (let i = 0; i < 18; i++) {
      _v.set(rand(-1, 1), rand(0.8, 2.0), rand(-1, 1)).multiplyScalar(rand(1.2, 3.4));
      this._spawn('drop', pos, _v, {
        size: rand(0.35, 0.7) * k,
        life: rand(1.0, 1.8),
        ink: INK.BLACK,
        fill: false,
        gravity: -2,
        drag: 2.2,
        collide: null,
        grow: 3.6,
        shrink: false,
      });
    }
    this.bloodPool(pos, radius * 0.8, INK.BLACK);
    this.shakeAmt += 0.8;
  }

  fountain(pos: THREE.Vector3, dir: THREE.Vector3, dur = 0.8, ink: number = INK.RED): void {
    this._spawn('emitter', pos, dir, { life: dur, ink, rate: 40, size: 0.05 });
  }

  // ejected casing: a small tumbling stroke
  shell(pos: THREE.Vector3, vel: THREE.Vector3, ink: number = INK.ORANGE, size = 0.02): void {
    this._spawn('stroke', pos, vel, {
      size,
      life: rand(0.9, 1.4),
      ink,
      gravity: 22,
      stretch: 0.012,
      collide: null,
      shrink: false,
      len: 0,
      drag: 0.5,
    });
  }

  // doodle smoke: outlined circles that rise and grow
  smoke(pos: THREE.Vector3, dir: THREE.Vector3, n = 3): void {
    for (let i = 0; i < n; i++) {
      _v.copy(dir)
        .multiplyScalar(rand(0.6, 1.8))
        .add(_v2.set(rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5)));
      this._spawn('drop', pos, _v, {
        size: rand(0.04, 0.07),
        life: rand(0.45, 0.8),
        ink: INK.BLUE,
        fill: false,
        gravity: -1.2,
        drag: 3,
        collide: null,
        grow: 3.2,
        shrink: false,
      });
    }
  }

  // ink explosion: burst of drops + strokes, a big decal on the ground and shake
  explosion(pos: THREE.Vector3, radius = 4, ink: number = INK.BLACK): void {
    for (let i = 0; i < 40; i++) {
      _v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 14));
      this._spawn('drop', pos, _v, {
        size: rand(0.03, 0.1),
        life: rand(1, 2),
        ink,
        collide: 'decal',
        gravity: 20,
        decalSize: rand(3, 6),
      });
    }
    for (let i = 0; i < 26; i++) {
      _v.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(10, 22));
      this._spawn('stroke', pos, _v, {
        size: rand(0.03, 0.06),
        life: rand(0.2, 0.45),
        ink: i % 3 === 0 ? INK.ORANGE : ink,
        gravity: 6,
        stretch: 0.05,
        collide: null,
      });
    }
    for (let i = 0; i < 8; i++) {
      _v.set(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)).multiplyScalar(rand(1, 3));
      this._spawn('drop', pos, _v, {
        size: rand(0.12, 0.25),
        life: rand(0.7, 1.2),
        ink: INK.BLUE,
        fill: false,
        gravity: -1.5,
        drag: 2.5,
        collide: null,
        grow: 3,
        shrink: false,
      });
    }
    this.bloodPool(pos, radius * 0.9, ink);
    this.shakeAmt += 0.5;
  }

  /** Spawn one particle. `pos` and `vel` are copied. */
  _spawn(kind: ParticleKind, pos: THREE.Vector3, vel: THREE.Vector3 | null, o: ParticleOptions = {}): Particle {
    const p: Particle = {
      kind,
      pos: pos.clone(),
      vel: vel ? vel.clone() : null,
      life: o.life ?? 1,
      maxLife: o.life ?? 1,
      size: o.size ?? 0.05,
      ink: o.ink ?? INK.RED,
      fill: o.fill ?? true,
      gravity: o.gravity ?? 20,
      drag: o.drag ?? 0,
      collide: o.collide ?? null,
      stretch: o.stretch ?? 0.03,
      len: o.len ?? 0,
      axis: o.axis ?? null,
      decalSize: o.decalSize ?? 3,
      shrink: o.shrink ?? true,
      rate: o.rate ?? 0,
      acc: 0,
      grow: o.grow ?? 0,
    };
    this.particles.push(p);
    return p;
  }

  // ---------- rigid debris (gibs, dropped weapons) ----------
  /** Add `mesh` to the scene as tumbling debris. At most 70 pieces live at once; the oldest goes first. */
  debris(
    mesh: THREE.Object3D,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    angVel: THREE.Vector3,
    o: DebrisOptions = {},
  ): Debris {
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const d: Debris = {
      mesh,
      vel: vel.clone(),
      ang: angVel.clone(),
      life: o.life ?? 10,
      radius: o.radius ?? 0.18,
      blood: o.blood ?? false,
      rest: false,
      bloodT: 0,
      bounces: 0,
      baseScale: mesh.scale.x,
    };
    this.debrisList.push(d);
    if (d.blood) this.gibsAlive++;
    if (this.debrisList.length > 70) {
      const old = this.debrisList.shift();
      if (old) {
        this.scene.remove(old.mesh);
        if (old.blood) this.gibsAlive--;
      }
    }
    return d;
  }

  update(dt: number): void {
    // particles
    const ps = this.particles;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'emitter') {
        p.acc += dt * p.rate;
        const dir = p.vel;
        while (dir && p.acc >= 1) {
          p.acc -= 1;
          _v.copy(dir)
            .multiplyScalar(rand(2, 5))
            .add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(1.2));
          this._spawn('drop', p.pos, _v, {
            size: rand(0.02, 0.05),
            life: rand(1, 2),
            ink: p.ink,
            collide: 'decal',
            gravity: 22,
            decalSize: 6,
          });
        }
        ps[n++] = p;
        continue;
      }
      if (p.vel) {
        _prev.copy(p.pos);
        p.vel.y -= p.gravity * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        if (p.collide) {
          _d.subVectors(p.pos, _prev);
          const len = _d.length();
          if (len > 1e-5) {
            _d.divideScalar(len);
            const hit = this.world.raycast(_prev, _d, len + p.size * 0.5, SEE_THROUGH);
            if (hit) {
              if (p.collide === 'decal') {
                this.splat(hit.point, hit.normal, p.ink, p.size * p.decalSize * 0.75, _d, p.size > 0.035 ? 2 : 1);
              }
              continue;
            }
          }
        }
        if (p.pos.y < -10) continue;
      }
      ps[n++] = p;
    }
    ps.length = n;

    // growing pools
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i];
      g.t += dt;
      const f = Math.min(1, g.t / g.dur);
      const e = 1 - (1 - f) * (1 - f);
      _s.set(g.size * e, g.size * e, 1);
      this._write(g.pool, g.i, g.pos, g.quat, _s, g.ink, true);
      g.pool.mesh.instanceMatrix.needsUpdate = true;
      g.pool.colors.needsUpdate = true;
      if (f >= 1) this.growing.splice(i, 1);
    }

    // debris
    const ds = this.debrisList;
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i];
      const m = d.mesh;
      if (!d.rest) {
        d.vel.y -= 20 * dt;
        _prev.copy(m.position);
        m.position.addScaledVector(d.vel, dt);
        _d.subVectors(m.position, _prev);
        const len = _d.length();
        if (len > 1e-6) {
          _d.divideScalar(len);
          const hit = this.world.raycast(_prev, _d, len + d.radius);
          if (hit) {
            m.position.copy(hit.point).addScaledVector(hit.normal, d.radius);
            const vn = d.vel.dot(hit.normal);
            if (vn < 0) {
              d.vel.addScaledVector(hit.normal, -1.35 * vn);
              d.vel.multiplyScalar(0.55);
              d.ang.multiplyScalar(0.5);
            }
            d.bounces++;
            if (d.blood && d.bounces <= 3) this.splat(hit.point, hit.normal, INK.RED, rand(0.4, 0.85), null, 2);
            if (d.vel.length() < 1.0 && hit.normal.y > 0.5) {
              d.rest = true;
              d.vel.set(0, 0, 0);
            }
          }
        }
        m.rotation.x += d.ang.x * dt;
        m.rotation.y += d.ang.y * dt;
        m.rotation.z += d.ang.z * dt;
        if (d.blood && d.vel.lengthSq() > 3) {
          d.bloodT -= dt;
          if (d.bloodT <= 0) {
            d.bloodT = 0.05;
            _v.copy(d.vel).multiplyScalar(0.3).add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)));
            this._spawn('drop', m.position, _v, {
              size: rand(0.02, 0.045),
              life: 1.5,
              collide: 'decal',
              gravity: 22,
              decalSize: 6,
            });
          }
        }
        if (m.position.y < -8) d.life = 0;
      }
      d.life -= dt;
      if (d.life < 0.6) m.scale.setScalar(Math.max(0.001, d.life / 0.6) * d.baseScale);
      if (d.life <= 0) {
        this.scene.remove(m);
        if (d.blood) this.gibsAlive--;
        ds.splice(i, 1);
      }
    }
    this._flush();
  }

  /** Write every live drop and stroke into its instanced mesh. */
  private _flush(): void {
    let di = 0;
    let si = 0;
    const drops = this.drops;
    const strokes = this.strokes;
    for (const p of this.particles) {
      const frac = p.life / p.maxLife;
      if (p.kind === 'drop') {
        if (di >= drops.max) continue;
        const s = p.size * (p.grow ? lerp(1, p.grow, 1 - frac) : p.shrink ? 0.4 + 0.6 * frac : 1);
        _s.set(s, s, s);
        _q.identity();
        this._write(drops, di++, p.pos, _q, _s, p.ink, p.fill);
      } else if (p.kind === 'stroke') {
        if (si >= strokes.max) continue;
        let len: number;
        if (p.len > 0 && p.axis) {
          // fixed-length stroke along an axis (tracers)
          _d.copy(p.axis);
          len = p.len;
        } else {
          const sp = p.vel ? p.vel.length() : 0;
          if (!p.vel || sp < 1e-4) {
            _d.set(0, 1, 0);
            len = p.size;
          } else {
            _d.copy(p.vel).divideScalar(sp);
            len = clamp(sp * p.stretch, p.size * 2, 1.6);
          }
        }
        _q.setFromUnitVectors(_up, _d);
        const w = p.size * (p.shrink ? 0.5 + 0.5 * frac : 1);
        _s.set(w, len, w);
        this._write(strokes, si++, p.pos, _q, _s, p.ink, p.fill);
      }
    }
    drops.mesh.count = di;
    strokes.mesh.count = si;
    drops.mesh.instanceMatrix.needsUpdate = true;
    drops.colors.needsUpdate = true;
    strokes.mesh.instanceMatrix.needsUpdate = true;
    strokes.colors.needsUpdate = true;
  }
}

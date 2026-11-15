// Small math + helper utilities shared by every module.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

/** Clamps `v` into `[a, b]`. */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Linear interpolation from `a` to `b` by `t`. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential smoothing of `a` toward `b`. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Uniform random float in `[a, b)`. */
export const rand = (a = 0, b = 1): number => a + Math.random() * (b - a);

/** Uniform random integer in `[a, b]` (inclusive). */
export const randInt = (a: number, b: number): number => Math.floor(rand(a, b + 1));

/** Picks a random element of `arr`. */
export const choose = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Moves `cur` toward `target` by at most `maxDelta` without overshooting. */
export const approach = (cur: number, target: number, maxDelta: number): number =>
  cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target);

/** Wraps an angle into `[-PI, PI)`. */
export const wrapAngle = (a: number): number => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** Interpolates between two angles along the shortest arc. */
export const angleLerp = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

/** A random unit vector (not uniformly distributed on the sphere). */
export const randDir = (): THREE.Vector3 => new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();

export const v3 = (x = 0, y = 0, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);

// Damped spring for one scalar (used for camera kicks, weapon recoil, etc.)
export class Spring {
  value = 0;
  vel = 0;
  target = 0;

  constructor(
    public k = 120,
    public d = 14,
  ) {}

  update(dt: number): number {
    // sub-step for stability with stiff springs
    const steps = dt > 0.02 ? 3 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = (this.target - this.value) * this.k - this.vel * this.d;
      this.vel += f * h;
      this.value += this.vel * h;
    }
    return this.value;
  }

  kick(v: number): void {
    this.vel += v;
  }

  set(v: number): void {
    this.value = v;
    this.vel = 0;
  }
}

/** Three independent damped springs packed in a vector. */
export class Spring3 {
  readonly value = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  private readonly _f = new THREE.Vector3();

  constructor(
    public k = 120,
    public d = 14,
  ) {}

  update(dt: number): THREE.Vector3 {
    const steps = dt > 0.02 ? 3 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this._f.copy(this.target).sub(this.value).multiplyScalar(this.k).addScaledVector(this.vel, -this.d);
      this.vel.addScaledVector(this._f, h);
      this.value.addScaledVector(this.vel, h);
    }
    return this.value;
  }

  kick(x: number, y: number, z: number): void {
    this.vel.x += x;
    this.vel.y += y;
    this.vel.z += z;
  }
}

// Simple timer helper
export class Cooldown {
  t = 0;
  dur: number;

  constructor(t = 0) {
    this.dur = t;
  }

  update(dt: number): void {
    if (this.t > 0) this.t -= dt;
  }

  ready(): boolean {
    return this.t <= 0;
  }

  start(d = this.dur): void {
    this.t = d;
  }

  /** Remaining fraction of the cooldown, 1 = just started, 0 = ready. */
  get frac(): number {
    return this.dur > 0 ? clamp(this.t / this.dur, 0, 1) : 0;
  }
}

// Quaternion helper: rotation that maps +Y to dir
const _up = new THREE.Vector3(0, 1, 0);

export function quatFromYTo(dir: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.setFromUnitVectors(_up, dir);
}

/** Stretches `obj` (a unit-height, Y-aligned mesh) into a segment from `from` to `to`. */
export function alignYAxis(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, thickness = 1): void {
  const d = new THREE.Vector3().subVectors(to, from);
  const len = d.length();
  if (len < 1e-5) {
    obj.visible = false;
    return;
  }
  obj.visible = true;
  d.divideScalar(len);
  obj.position.copy(from).addScaledVector(d, len * 0.5);
  obj.quaternion.setFromUnitVectors(_up, d);
  obj.scale.set(thickness, len, thickness);
}

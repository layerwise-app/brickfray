import * as THREE from 'three';

const STEP = 1 / 240;

/**
 * Damped spring on a vector (semi-implicit Euler, fixed sub-steps so stiff
 * recoil springs stay stable at low frame rates).
 */
export class Spring3 {
  readonly value = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(
    public stiffness: number,
    /** 1 = critically damped, < 1 overshoots. */
    public ratio: number
  ) {}

  impulse(x: number, y: number, z: number) {
    this.velocity.x += x;
    this.velocity.y += y;
    this.velocity.z += z;
  }

  step(dt: number) {
    const damping = 2 * this.ratio * Math.sqrt(this.stiffness);
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      left -= h;
      this.tmp.subVectors(this.target, this.value).multiplyScalar(this.stiffness).addScaledVector(this.velocity, -damping);
      this.velocity.addScaledVector(this.tmp, h);
      this.value.addScaledVector(this.velocity, h);
    }
  }

  reset() {
    this.value.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.target.set(0, 0, 0);
  }
}

/** Frame-rate independent exponential approach. */
export function approach(current: number, target: number, rate: number, dt: number) {
  return target + (current - target) * Math.exp(-rate * dt);
}

export function smooth01(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** 0 → 1 over [a, b], smoothstep eased. */
export function seg(u: number, a: number, b: number) {
  return smooth01((u - a) / (b - a));
}

/** Rises over [a, b], holds, falls over [c, d]. */
export function env(u: number, a: number, b: number, c: number, d: number) {
  return seg(u, a, b) * (1 - seg(u, c, d));
}

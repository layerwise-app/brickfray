import { clamp, damp } from './ik';
import type { AnimState } from './types';

/** Stiffness of the landing squash: soft enough that a jump's landing sinks the hips about 10 cm and comes back up in a quarter second. */
const LAND_K = 150;

/** How far into a jump or fall a figure is, and the squash of its hips on landing: a damped spring kicked harder by a harder fall. */
export class Airborne {
  /** 0 on the ground, 1 well into a jump or fall. */
  air = 0;
  airTime = 0;
  /** How far the hips sink on landing (m, negative), springing back to 0. */
  landX = 0;
  private landV = 0;
  private minVy = 0;
  private wasGrounded = true;

  reset() {
    this.air = this.airTime = this.landX = this.landV = this.minVy = 0;
    this.wasGrounded = true;
  }

  update(dt: number, s: AnimState) {
    if (!s.grounded) {
      if (this.wasGrounded) this.airTime = 0;
      this.airTime += dt;
      this.minVy = Math.min(this.minVy, s.verticalVelocity);
      this.air = damp(this.air, this.airTime > 0.06 || s.verticalVelocity > 0.5 ? 1 : 0, 14, dt);
    } else {
      if (!this.wasGrounded && this.airTime > 0.1) {
        const impact = clamp((-this.minVy - 1.5) / 9, 0, 1);
        this.landV = Math.min(this.landV, -0.7 - 2.7 * impact);
      }
      this.minVy = 0;
      this.air = damp(this.air, 0, 22, dt);
    }
    this.wasGrounded = s.grounded;
    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.landV += (-LAND_K * this.landX - 2 * Math.sqrt(LAND_K) * 0.7 * this.landV) * h;
      this.landX = Math.max(-0.32, this.landX + this.landV * h);
    }
  }
}

import { PLAYER } from '../sim/constants';

/** Critically damped spring rate (rad/s): steady speed up the stairs, about one step of lag. */
const OMEGA = 16;
/** Safety bound; normal stairs stay well inside it. */
const MAX_LAG = 1;

interface Foot {
  x: number;
  y: number;
  z: number;
  grounded: boolean;
}

/** A grounded tick that rose or dropped far more than it moved sideways: a stair step, not a ramp. */
export function isStep(from: Foot, to: Foot) {
  const dy = Math.abs(to.y - from.y);
  return from.grounded && to.grounded && dy > Math.hypot(to.x - from.x, to.z - from.z) * 1.2 + 0.01 && dy <= PLAYER.stepHeight + 0.05;
}

/**
 * Visual-only offset that lets the eye glide over stair steps instead of
 * popping up or down a full step. The body (and aim) still moves exactly as
 * simulated; only the camera height lags briefly.
 */
export class StepSmoother {
  offset = 0;
  private velocity = 0;
  /** Summed step heights through the latest tick, and through the tick before it. */
  private total = 0;
  private before = 0;
  private shown = 0;

  /** Once per simulation tick, with the body before and after it. */
  tick(from: Foot, to: Foot) {
    this.before = this.total;
    if (isStep(from, to)) this.total += to.y - from.y;
  }

  /** Once per rendered frame, with the body's interpolation alpha. Returns the eye offset. */
  frame(alpha: number, dt: number) {
    const shown = this.before + (this.total - this.before) * alpha;
    this.offset -= shown - this.shown;
    this.shown = shown;
    this.velocity += (-OMEGA * OMEGA * this.offset - 2 * OMEGA * this.velocity) * dt;
    this.offset = Math.max(-MAX_LAG, Math.min(MAX_LAG, this.offset + this.velocity * dt));
    return this.offset;
  }

  reset() {
    this.offset = this.velocity = this.total = this.before = this.shown = 0;
  }
}

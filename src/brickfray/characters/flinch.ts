import * as THREE from 'three';
import { clamp } from './ik';

/**
 * Spring of the jolt: 2.4 Hz, half damped, so a hit throws the body back in ~80 ms and it is back on aim by ~0.4 s:
 * long enough to read across a room.
 */
const OMEGA = 2 * Math.PI * 2.4;
const ZETA = 0.5;
const DAMPED = OMEGA * Math.sqrt(1 - ZETA * ZETA);
/** Kick per hit (rad/s of lean): a mid-sized hit leans the chest ~0.45 rad at its peak. */
const KICK = 14;
/** A burst stacks its jolts up to this lean, and no further. */
const MOST = 0.7;

/** Lean of a spring kicked at t = 0 with unit speed, t seconds later. */
const response = (t: number) => (t <= 0 ? 0 : (Math.exp(-ZETA * OMEGA * t) * Math.sin(DAMPED * t)) / DAMPED);
const responseRate = (t: number) => (t <= 0 ? 1 : Math.exp(-ZETA * OMEGA * t) * (Math.cos(DAMPED * t) - ((ZETA * OMEGA) / DAMPED) * Math.sin(DAMPED * t)));

/**
 * A hit's jolt, away from the shooter: the latest hit is read straight off the time since it landed, so a still frame
 * shows the jolt at that moment; a jolt still under way when the next hit lands carries on as a free spring and adds
 * in, so a burst of hits stacks up instead of snapping back to rest.
 */
export class Flinch {
  /** Lean away from the shooter in model space (x right, y back), in radians of chest tilt. */
  readonly lean = new THREE.Vector2();
  private readonly kick = new THREE.Vector2();
  private readonly carry = new THREE.Vector2();
  private readonly carrySpeed = new THREE.Vector2();
  private last = Infinity;

  reset() {
    this.lean.set(0, 0);
    this.kick.set(0, 0);
    this.carry.set(0, 0);
    this.carrySpeed.set(0, 0);
    this.last = Infinity;
  }

  /** `toward` is the shooter's direction in local space (x right, z forward); `amount` the hit's damage. */
  update(dt: number, sinceHurt: number, toward: { x: number; z: number }, amount: number) {
    if (sinceHurt < this.last - 1e-4) {
      // The spring as it stands becomes the carried part; the new hit starts its own response.
      const before = this.last;
      if (before < 2) {
        this.carry.addScaledVector(this.kick, response(before));
        this.carrySpeed.addScaledVector(this.kick, responseRate(before));
      }
      const len = Math.hypot(toward.x, toward.z) || 1;
      this.kick.set(-toward.x / len, toward.z / len).multiplyScalar(KICK * clamp(0.45 + amount / 55, 0.55, 1.45));
    }
    this.last = sinceHurt;
    if (dt > 0 && this.carry.lengthSq() + this.carrySpeed.lengthSq() > 1e-8) {
      const steps = Math.max(1, Math.ceil(dt * 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.carrySpeed.x += (-OMEGA * OMEGA * this.carry.x - 2 * ZETA * OMEGA * this.carrySpeed.x) * h;
        this.carrySpeed.y += (-OMEGA * OMEGA * this.carry.y - 2 * ZETA * OMEGA * this.carrySpeed.y) * h;
        this.carry.addScaledVector(this.carrySpeed, h);
      }
    }
    this.lean.copy(this.kick).multiplyScalar(sinceHurt < 2 ? response(sinceHurt) : 0).add(this.carry);
    if (this.lean.lengthSq() > MOST * MOST) this.lean.setLength(MOST);
    return this.lean;
  }
}

import * as THREE from 'three';
import { STANCES } from '../characters';
import type { Pose } from '../characters/pose';
import type { V3 } from '../characters/skeleton';
import type { Stance, StanceLife } from '../characters/stance';
import type { CharacterId } from '../characters/types';
import { GESTURES, NECK, RHYTHM, wrap, type Gesture, type Rhythm } from './hero-gestures';

/** How far the stance's own wandering glance turns the head either way, per unit of its `life.look` (poseStance's). */
const GLANCE = 0.12;

/** The showroom idle on top of each hero's stance: weight shifts from leg to leg, blinks, and gestures of its own, each hero to its own tempo. */
export class HeroLife implements StanceLife {
  readonly pelvis: V3 = [0, 0, 0];
  readonly pelvisRot: V3 = [0, 0, 0];
  readonly chest: V3 = [0, 0, 0];
  readonly head: V3 = [0, 0, 0];
  /** 0 with the eyes open, 1 shut. */
  blink = 0;
  private readonly stance: Stance;
  private readonly rhythm: Rhythm;
  private readonly gestures: readonly Gesture[];
  private gesture: Gesture = { length: 1 };
  private time = 0;
  private nextBlink = 1.6;
  private blinkAt = -1;
  private blinks = 0;
  private gestureAt: number;
  private count = 0;
  /** Where the gesture is (0…1, or -1 between them), and the turn it gives the gun this frame. */
  private u = -1;
  private carry = false;
  private readonly pivot = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  /** The figure's heading toward the lens, in its own frame. */
  private viewer = -0.5;

  constructor(readonly id: CharacterId) {
    this.stance = STANCES[id];
    this.rhythm = RHYTHM[id];
    this.gestures = GESTURES[id];
    this.gesture = this.gestures[0] ?? this.gesture;
    this.gestureAt = this.gestures.length ? this.rhythm.first : Infinity;
  }

  /** `yaw` is the figure's turn on its stand, which says where the lens is. */
  update(dt: number, yaw: number) {
    this.time += dt;
    const t = this.time;
    this.viewer = wrap(yaw - Math.PI);
    // Weight goes over to one leg in about a second, stays a few seconds and comes back: the hips slide and drop on the
    // free side, the shoulders and head level against them.
    const r = this.rhythm;
    const shift = (r.amount * Math.tanh(r.snap * Math.sin((t * Math.PI * 2) / r.period + r.phase))) / Math.tanh(r.snap);
    this.pelvis[0] = 0.032 * shift;
    this.pelvis[1] = -0.012 * (1 - shift * shift);
    this.pelvis[2] = 0;
    this.pelvisRot[0] = 0.03 * shift;
    this.pelvisRot[1] = 0;
    this.pelvisRot[2] = 0.05 * shift;
    this.chest[0] = -0.02 * shift;
    this.chest[1] = 0;
    this.chest[2] = -0.035 * shift;
    this.head[0] = 0;
    this.head[1] = 0;
    this.head[2] = -0.03 * shift;

    if (t >= this.gestureAt + this.gesture.length) {
      this.count++;
      this.gesture = this.gestures[this.count % this.gestures.length]!;
      this.gestureAt = t + r.gap + ((this.count * 0.618) % 1) * r.spread;
    }
    this.u = t >= this.gestureAt ? (t - this.gestureAt) / this.gesture.length : -1;
    if (this.u >= 0) this.gesture.body?.(this.u, this, this.stance, this.viewer);
    this.limitNeck();
    this.updateBlink(t);
  }

  /** Keeps the head within `NECK` of the chest, leaving room for the stance's own glance. */
  private limitNeck() {
    const cap = NECK - GLANCE * (this.stance.life?.look ?? 1);
    const turn = wrap(this.stance.head[0] + this.head[0] - this.stance.chest[0] - this.chest[0]);
    if (Math.abs(turn) > cap) this.head[0] -= turn - Math.sign(turn) * cap;
  }

  hand(side: 'L' | 'R', wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose) {
    if (this.u < 0) return;
    if (side === 'R') this.carry = this.gesture.gun?.(this.u, wrist, rotation, pose, this.pivot, this.turn) ?? false;
    // A melee weapon in the left hand stays put while the gun turns.
    if (this.carry && (side === 'R' || !this.stance.melee)) {
      wrist.sub(this.pivot).applyQuaternion(this.turn).add(this.pivot);
      rotation.premultiply(this.turn);
    }
    if (side === 'L') this.gesture.left?.(this.u, wrist, rotation, pose);
  }

  private updateBlink(t: number) {
    if (this.blinkAt < 0 && t >= this.nextBlink) {
      this.blinkAt = t;
      this.blinks++;
      // Every third blink comes as a quick pair.
      const double = this.blinks % 3 === 0;
      this.nextBlink = t + (double ? 0.32 : 2.4 + ((this.blinks * 0.754) % 1) * 2.8);
    }
    if (this.blinkAt < 0) {
      this.blink = 0;
      return;
    }
    const k = t - this.blinkAt;
    // Shuts in 60 ms, stays shut a frame or two, opens in 110 ms.
    this.blink = k < 0.06 ? k / 0.06 : k < 0.1 ? 1 : Math.max(0, 1 - (k - 0.1) / 0.11);
    if (k >= 0.21) this.blinkAt = -1;
  }
}

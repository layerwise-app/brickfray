import * as THREE from 'three';
import { smooth01 } from './springs';

/** Fastest leftover speed carried across a cut (m/s): a strike cut short does not fling the next pose. */
const MAX_DRIFT = 6;
const ONE = new THREE.Vector3(1, 1, 1);

const weights: [number, number] = [0, 0];
const prev = new THREE.Vector3();
const step = new THREE.Vector3();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const still = new THREE.Quaternion();

/** How much of the gap and of the speed a cut left behind remain `t` seconds into a hand-over of `span` seconds: a critically damped ease, gone by 1.3 spans. */
function leftover(t: number, span: number) {
  const w = 5 / span;
  const k = Math.exp(-w * t) * (1 - smooth01((t - 0.8 * span) / (0.5 * span)));
  weights[0] = (1 + w * t) * k;
  weights[1] = t * k;
  return weights;
}

/**
 * Carries a moving point across a cut from one clip to the next: where it was and how fast it was going both die
 * away on top of the new clip's value, so a cut neither stops the motion dead nor jumps.
 */
export class Glide {
  readonly value = new THREE.Vector3();
  private readonly speed = new THREE.Vector3();
  private readonly gap = new THREE.Vector3();
  private readonly drift = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private span = 0.12;
  private t = Infinity;
  /** 1: a cut is waiting for its first frame; 2: for its second, which tells how fast the new clip itself moves. */
  private stage = 0;
  private live = false;
  private instant = false;

  /** `instant`: the new clip shows from its first frame, without the coast that measures its own speed (a clip that starts from rest). */
  cut(span: number, instant = false) {
    if (!this.live) return;
    this.stage = 1;
    this.span = span;
    this.instant = instant;
  }

  reset() {
    this.live = false;
    this.stage = 0;
    this.t = Infinity;
  }

  apply(target: THREE.Vector3, dt: number): THREE.Vector3 {
    if (!this.live || dt <= 0) {
      if (!this.live) this.value.copy(target);
      this.live = true;
      return this.value;
    }
    prev.copy(this.value);
    if (this.stage === 1 && this.instant) {
      this.gap.subVectors(this.value, target);
      this.drift.copy(this.speed).clampLength(0, MAX_DRIFT);
      this.t = 0;
      this.stage = 0;
    }
    if (this.stage === 1) {
      // Coasts for one frame; the next one shows how much of that speed the new clip does not already have.
      this.value.addScaledVector(this.speed.clampLength(0, MAX_DRIFT), dt);
      this.gap.subVectors(this.value, target);
      this.drift.copy(this.speed);
      this.t = 0;
      this.stage = 2;
    } else {
      if (this.stage === 2) {
        this.drift.addScaledVector(step.subVectors(target, this.target), -1 / dt).clampLength(0, MAX_DRIFT);
        this.stage = 0;
      }
      this.t += dt;
      this.value.copy(target);
      if (this.t < this.span * 1.3) {
        const [gap, drift] = leftover(this.t, this.span);
        this.value.addScaledVector(this.gap, gap).addScaledVector(this.drift, drift);
      }
    }
    this.target.copy(target);
    this.speed.subVectors(this.value, prev).divideScalar(dt);
    return this.value;
  }
}

/**
 * The same for an orientation. The turn left over is measured once, at the cut, and only shrinks from there, so a
 * pose that swings past the opposite of the old one cannot flip the blend the way a slerp between the two would.
 */
export class Turn {
  readonly value = new THREE.Quaternion();
  private readonly gap = new THREE.Quaternion();
  private span = 0.12;
  private t = Infinity;
  private pending = false;
  private live = false;

  cut(span: number) {
    if (!this.live) return;
    this.pending = true;
    this.span = span;
  }

  reset() {
    this.live = false;
    this.pending = false;
    this.t = Infinity;
  }

  apply(target: THREE.Quaternion, dt: number): THREE.Quaternion {
    if (this.pending) {
      this.gap.copy(target).invert().premultiply(this.value);
      if (this.gap.w < 0) this.gap.set(-this.gap.x, -this.gap.y, -this.gap.z, -this.gap.w);
      this.t = 0;
      this.pending = false;
    } else {
      this.t += dt;
    }
    this.live = true;
    if (this.t >= this.span * 1.3) return this.value.copy(target);
    return this.value.copy(still.identity().slerp(this.gap, leftover(this.t, this.span)[0])).multiply(target);
  }
}

/** A hand's pose carried across cuts. */
export class HandOver {
  readonly matrix = new THREE.Matrix4();
  private readonly place = new Glide();
  private readonly turn = new Turn();

  cut(span: number, instant = false) {
    this.place.cut(span, instant);
    this.turn.cut(span);
  }

  reset() {
    this.place.reset();
    this.turn.reset();
  }

  apply(target: THREE.Matrix4, dt: number): THREE.Matrix4 {
    target.decompose(p, q, s);
    return this.matrix.compose(this.place.apply(p, dt), this.turn.apply(q, dt), ONE);
  }
}

/** What both hands and the gun's clip offsets carry over from a clip that was cut short. */
export class Carry {
  readonly left = new HandOver();
  readonly right = new HandOver();
  readonly gunPos = new Glide();
  readonly gunRot = new Glide();

  /** A new clip takes over: the hands within `span` seconds (from its first frame when `instant`), the gun within `gunSpan`. */
  cut(span: number, gunSpan: number, instant = false) {
    this.left.cut(span, instant);
    this.right.cut(span, instant);
    this.gunPos.cut(gunSpan);
    this.gunRot.cut(gunSpan);
  }

  /** A different gun comes up where its draw puts it; only the hands carry over from the old one. */
  resetGun() {
    this.gunPos.reset();
    this.gunRot.reset();
  }

  reset() {
    this.left.reset();
    this.right.reset();
    this.resetGun();
  }
}

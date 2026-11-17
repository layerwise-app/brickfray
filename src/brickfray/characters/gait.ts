import * as THREE from 'three';
import { ANKLE_H, BALL, HEEL } from './skeleton';
import { clamp, damp, dampAngle, lerp, smooth } from './ik';
import type { Style } from './style';

export interface GaitParams {
  /** Meters travelled per full cycle (two steps). */
  stride: number;
  /** Fraction of the cycle a foot is on the ground. */
  duty: number;
  lift: number;
  /** Exponent on swing progress; below 1 the foot peaks early (heel kick of a run). */
  skew: number;
  heel: number;
  toe: number;
  /** Share of the stance span in front of the hip. */
  reach: number;
  width: number;
  bob: number;
  run: number;
  drop: number;
  sway: number;
  yaw: number;
  roll: number;
  heelEnd: number;
  toeStart: number;
}

export interface FootPose {
  pos: THREE.Vector3;
  heading: number;
  pitch: number;
  /** Toe bend that keeps the toe flat while the heel is up. */
  toe: number;
  planted: number;
  /** Stance progress 0…1, or -1 in swing. */
  stance: number;
}

export function gaitParams(v: number, crouch: number, sprint: number, back: number, st: Style): GaitParams {
  const run = smooth(v, 2.2, 4.0) * (1 - crouch * 0.85);
  const walkStride = 0.78 + 0.36 * v;
  const runStride = 1.5 + 0.24 * v + 0.25 * sprint;
  const stride = lerp(walkStride, runStride, run) * st.stride * lerp(1, 0.74, back) * lerp(1, 0.86, crouch);
  return {
    stride,
    duty: lerp(lerp(0.6, 0.36, run) - 0.04 * sprint, 0.6, crouch),
    lift: (lerp(0.075, 0.2, run) + 0.08 * sprint) * st.lift * lerp(1, 0.55, crouch) * lerp(1, 0.6, back),
    skew: lerp(1.15, 0.72, run),
    heel: lerp(0.32, 0.16, run) * lerp(1, 0.5, back),
    toe: lerp(0.5, 0.8, run) * lerp(1, 0.7, crouch),
    reach: lerp(0.44, 0.36, run),
    width: lerp(0.105, 0.085, run) * st.stance + 0.05 * crouch,
    bob: lerp(0.024, 0.042, run) * st.bob * lerp(1, 0.5, crouch),
    run,
    drop: lerp(0.008, 0.055, run) + 0.03 * sprint,
    sway: lerp(0.026, 0.01, run) * st.sway,
    yaw: lerp(0.11, 0.18, run) * lerp(1, 0.6, back),
    roll: lerp(0.06, 0.03, run),
    heelEnd: lerp(0.22, 0.12, run),
    toeStart: lerp(0.55, 0.42, run)
  };
}

function ankleFromPivot(pivot: number, offset: number, pitch: number, out: { along: number; h: number }) {
  const a = -offset;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  out.along = pivot + a * c - ANKLE_H * s;
  out.h = a * s + ANKLE_H * c;
}

const tmp = { along: 0, h: 0 };
const tmp2 = { along: 0, h: 0 };

/** One foot at cycle phase p (0 = heel strike) along the gait axis: forward distance, ankle height, pitch. */
export function footAt(p: number, P: GaitParams, out: { along: number; h: number; pitch: number; toe: number; planted: number; stance: number }) {
  const span = P.duty * P.stride;
  const front = P.reach * span;
  if (p < P.duty) {
    const s = p / P.duty;
    stanceAt(s, span, front, P, out);
    out.planted = 1;
    out.stance = s;
    return out;
  }
  const s = (p - P.duty) / (1 - P.duty);
  stanceAt(1, span, front, P, tmp);
  const p0 = { ...tmp };
  stanceAt(0, span, front, P, tmp2);
  const m = (-span / P.duty) * (1 - P.duty);
  const s2 = s * s;
  const s3 = s2 * s;
  out.along = (2 * s3 - 3 * s2 + 1) * p0.along + (s3 - 2 * s2 + s) * m * 0.55 + (-2 * s3 + 3 * s2) * tmp2.along + (s3 - s2) * m * 0.3;
  out.h = lerp(p0.h, tmp2.h, s) + P.lift * Math.sin(Math.PI * Math.pow(s, P.skew));
  out.pitch = lerp(-P.toe, P.heel, smooth(s, 0.2, 0.92)) - 0.35 * P.run * Math.sin(Math.PI * s);
  out.toe = 0;
  out.planted = 0;
  out.stance = -1;
  return out;
}

function stanceAt(s: number, span: number, front: number, P: GaitParams, out: { along: number; h: number; pitch?: number; toe?: number }) {
  const c = front - s * span;
  if (s < P.heelEnd) {
    const u = 1 - s / P.heelEnd;
    const pitch = P.heel * u * u;
    ankleFromPivot(c + HEEL, HEEL, pitch, out);
    out.pitch = pitch;
    out.toe = 0;
  } else if (s > P.toeStart) {
    const u = (s - P.toeStart) / (1 - P.toeStart);
    const pitch = -P.toe * u * u;
    ankleFromPivot(c + BALL, BALL, pitch, out);
    out.pitch = pitch;
    out.toe = -pitch;
  } else {
    out.along = c;
    out.h = ANKLE_H;
    out.pitch = 0;
    out.toe = 0;
  }
}

const foot = { along: 0, h: 0, pitch: 0, toe: 0, planted: 0, stance: 0 };

/**
 * Cycle state: phase advances by distance over stride so planted feet hold
 * still; heading turns the gait axis toward the move direction (or its
 * reverse when backpedaling, with the cycle run backwards).
 */
export class Gait {
  phase = 0.1;
  heading = 0;
  backward = false;
  params: GaitParams | null = null;
  readonly feet: [FootPose, FootPose] = [0, 1].map(() => ({ pos: new THREE.Vector3(), heading: 0, pitch: 0, toe: 0, planted: 1, stance: 0 })) as [FootPose, FootPose];
  readonly pelvis = new THREE.Vector3();
  yaw = 0;
  roll = 0;

  reset() {
    this.phase = 0.1;
    this.heading = 0;
    this.backward = false;
  }

  /** `dir` = movement angle (0 forward, +π/2 right); returns the pelvis heading to blend in. */
  update(dt: number, speed: number, dir: number, moving: number, crouch: number, sprint: number, st: Style) {
    const a = Math.abs(dir);
    if (moving > 0.05) {
      if (!this.backward && a > 1.95) this.backward = true;
      else if (this.backward && a < 1.6) this.backward = false;
    }
    const target = this.backward ? Math.atan2(Math.sin(dir - Math.PI), Math.cos(dir - Math.PI)) : dir;
    if (moving > 0.05) this.heading = dampAngle(this.heading, target, 9, dt);
    else this.heading = damp(this.heading, 0, 3, dt);
    const P = gaitParams(Math.max(speed, 0.6), crouch, sprint, this.backward ? 1 : 0, st);
    this.params = P;
    const step = (speed * dt) / P.stride;
    this.phase = (((this.phase + (this.backward ? -step : step)) % 1) + 1) % 1;

    const h = this.heading;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      footAt((this.phase + i * 0.5) % 1, P, foot);
      const out = this.feet[i]!;
      const lateral = side * P.width;
      out.pos.set(fx * foot.along + rx * lateral, foot.h, fz * foot.along + rz * lateral);
      out.heading = h + side * st.toeOut;
      out.pitch = foot.pitch;
      out.toe = foot.toe;
      out.planted = foot.planted;
      out.stance = foot.stance;
    }
    const ph = this.phase * Math.PI * 2;
    const walkBob = -Math.cos(2 * (ph - 0.12));
    const runBob = -Math.cos(2 * ph - 2 * Math.PI * P.duty * 0.5);
    const bounce = st.bounce * Math.max(0, Math.sin(2 * ph - 2 * Math.PI * P.duty * 0.85));
    const sway = -P.sway * Math.sin(ph);
    this.pelvis.set(rx * sway, P.bob * lerp(walkBob, runBob, P.run) + bounce * 0.03 - P.drop, rz * sway);
    this.yaw = P.yaw * Math.cos(ph);
    this.roll = -P.roll * Math.sin(ph) * st.sway;
    return clamp(h, -0.8, 0.8) * 0.9;
  }
}

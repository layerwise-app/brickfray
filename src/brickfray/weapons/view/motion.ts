import * as THREE from 'three';
import type { ViewInput } from '../types';
import { approach, Spring3 } from './springs';
import type { Tuning } from './tuning';

const WALK_SPEED = 4.6;

/**
 * Procedural first-person motion: look sway, gait bob, jump and landing,
 * crouch cant, breathing, hurt flinch and per-shot recoil. Produces one
 * position and rotation offset for the gun, in view space.
 */
export class Motion {
  readonly pos = new THREE.Vector3();
  readonly rot = new THREE.Vector3();
  /** Smoothed sprint pose weight and step phase (radians, one cycle per two steps). */
  sprint = 0;
  phase = 0;
  private readonly swayPos = new Spring3(150, 0.7);
  private readonly swayRot = new Spring3(150, 0.68);
  private readonly recoilPos = new Spring3(560, 0.62);
  private readonly recoilRot = new Spring3(560, 0.62);
  private readonly land = new Spring3(170, 0.5);
  private readonly flinch = new Spring3(190, 0.45);
  private bob = 0;
  private freq = 1.9;
  private air = 0;
  private crouch = 0;
  private grounded = true;
  private tuning: Tuning | null = null;

  setTuning(t: Tuning) {
    this.tuning = t;
    this.recoilPos.stiffness = this.recoilRot.stiffness = t.spring[0];
    this.recoilPos.ratio = this.recoilRot.ratio = t.spring[1];
  }

  /** `ads` is the effective aim blend; `busy` (0…1) damps sprint posing during actions. */
  update(dt: number, input: ViewInput, ads: number, busy: number) {
    const w = this.tuning?.weight ?? 1;
    const calm = 1 - 0.78 * ads;

    // Look sway: the gun lags behind the turn, rolls into it.
    if (dt > 1e-4) {
      const yawRate = THREE.MathUtils.clamp(input.look.yaw / dt, -8, 8);
      const pitchRate = THREE.MathUtils.clamp(input.look.pitch / dt, -8, 8);
      const k = w * calm;
      this.swayRot.target.set(-pitchRate * 0.011 * k, -yawRate * 0.016 * k, yawRate * 0.022 * k);
      this.swayPos.target.set(yawRate * 0.0035 * k, -pitchRate * 0.0035 * k, 0);
    }
    this.swayRot.step(dt);
    this.swayPos.step(dt);

    // Gait bob: a figure-eight, one lateral cycle every two steps.
    const sprinting = input.sprint && input.speed > 1 && input.grounded;
    this.sprint = approach(this.sprint, sprinting ? 1 - busy : 0, 9, dt);
    const targetBob = input.grounded ? Math.min(1.5, input.speed / WALK_SPEED) : 0;
    this.bob = approach(this.bob, targetBob, 7, dt);
    this.freq = approach(this.freq, sprinting ? 2.6 : input.crouch > 0.5 ? 1.6 : 1.9, 5, dt);
    this.phase = (this.phase + dt * Math.PI * this.freq) % (Math.PI * 4);
    const amp = this.bob * calm * (1 + this.sprint * 1.3) * (0.85 + 0.15 * w);
    const s1 = Math.sin(this.phase);
    const s2 = Math.sin(this.phase * 2);

    // Jump lift and landing dip.
    if (this.grounded && !input.grounded) this.land.impulse(-0.12, -0.6, 0);
    this.grounded = input.grounded;
    this.air = approach(this.air, input.grounded ? 0 : 1, 6, dt);
    this.land.step(dt);
    this.crouch = approach(this.crouch, input.crouch, 8, dt);
    this.recoilPos.step(dt);
    this.recoilRot.step(dt);
    this.flinch.step(dt);

    const t = input.time;
    const breathe = (0.35 + 0.65 * calm) * (1 - this.sprint);
    this.pos.set(
      s1 * 0.0085 * amp - this.crouch * 0.008,
      s2 * 0.0052 * amp - Math.abs(s1) * 0.002 * amp + this.air * 0.009 + this.land.value.y * 0.06 - this.crouch * 0.01 + Math.sin(t * 1.55) * 0.0013 * breathe,
      this.crouch * 0.008 + this.land.value.x * 0.04
    );
    this.pos.add(this.swayPos.value).add(this.recoilPos.value);
    this.rot.set(
      s2 * 0.007 * amp + this.air * 0.035 + this.land.value.y * 0.28 + this.crouch * 0.02 + Math.sin(t * 1.55 + 0.7) * 0.0045 * breathe,
      s1 * 0.009 * amp * (1 + this.sprint) + Math.sin(t * 0.71) * 0.0025 * breathe,
      -s1 * 0.014 * amp + this.crouch * 0.075
    );
    this.rot.add(this.swayRot.value).add(this.recoilRot.value).add(this.flinch.value);
  }

  kick(ads: number) {
    const r = this.tuning?.recoil;
    if (!r) return;
    const aim = 1 - 0.55 * ads;
    const rnd = () => Math.random() * 2 - 1;
    this.recoilPos.impulse(rnd() * r.side * aim, r.up * aim, r.back * (1 - 0.25 * ads));
    this.recoilRot.impulse(r.rise * aim, rnd() * r.yaw * aim, rnd() * r.roll * aim);
  }

  landImpulse(impact: number) {
    const k = Math.min(1.5, Math.max(0.2, impact));
    this.land.impulse(0.15 * k, -1.6 * k, 0);
  }

  hurt(strength: number) {
    const k = Math.min(2, Math.max(0.2, strength));
    const rnd = () => Math.random() * 2 - 1;
    this.flinch.impulse(rnd() * 2.2 * k, rnd() * 2.6 * k, rnd() * 3.4 * k);
  }

  reset() {
    for (const s of [this.swayPos, this.swayRot, this.recoilPos, this.recoilRot, this.land, this.flinch]) s.reset();
    this.bob = 0;
    this.air = 0;
    this.sprint = 0;
  }
}

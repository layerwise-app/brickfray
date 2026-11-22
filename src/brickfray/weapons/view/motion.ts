import * as THREE from 'three';
import type { ViewInput } from '../types';
import { approach, Spring3 } from './springs';
import type { Tuning } from './tuning';

const WALK_SPEED = 4.6;
/** Share of the hip back-recoil a gun keeps when fully aimed, unless its tuning names its own (`recoil.adsBack`). */
const ADS_BACK = 0.75;
const ADS_RISE = 0.45;
/** Sustained fire: each shot adds HEAT_STEP of heat (cooling over HEAT_COOL s), and a hot gun kicks up to 1 + BURST_GROW times harder. */
const HEAT_STEP = 0.22;
const HEAT_COOL = 0.22;
const BURST_GROW = 0.9;
/** Each shot also walks the gun up by CLIMB × its rise (rad), easing back at CLIMB_RETURN per second once the trigger rests. */
const CLIMB = 0.0024;
const CLIMB_RETURN = 3.5;
/**
 * Slide pose: the body leans back and over, so the gun is canted well over and held out to the right at chest height,
 * not dropped: a gun low under the eye looks like it points straight up the screen; [x, y, z] and [pitch, yaw, roll].
 */
const SLIDE_POS = [0.06, 0.03, -0.02] as const;
const SLIDE_ROT = [0.02, 0.1, 0.62] as const;
/** The scrape of the slide: a fine fast shake on top, (m, rad) at SCRAPE_HZ. */
const SCRAPE = [0.0016, 0.006] as const;
const SCRAPE_HZ = 17;
/** Crouch: the gun tucked in closer and lower and canted over; [x, y, z] and [pitch, yaw, roll]. */
const CROUCH_POS = [-0.02, -0.026, 0.03] as const;
const CROUCH_ROT = [0.045, 0.05, 0.15] as const;
/** Share of the sprint carry the gun takes while an action holds it (a reload on the run is worked lower), so the rest of it comes in over the action's last part. */
const BUSY_CARRY = 0.3;
/** Gait bob at a walk, a figure-eight: sideways sway (m, and rad of yaw carrying the muzzle the same way, and of roll), the rise and fall, and the jolt as each foot plants. */
const WALK = { side: 0.012, yaw: -0.009, roll: 0.018, lift: 0.0056, pitch: 0.0075, plant: 0.0038 };
/** The same at a sprint, already scaled by the sprint's larger stride (SPRINT_AMP). */
const RUN = { side: 0.0085, yaw: 0.018, roll: 0.014, lift: 0.0052, pitch: 0.007, plant: 0.002 };
const SPRINT_AMP = 2.3;
/** Phase of the bob (radians, 2π per two steps) at which a foot lands and the gun bottoms out; footstep sounds fire on it (audio/step-triggers.ts STRIKE_PHASE). */
const PLANT = 0.735 * Math.PI;
/** Least weight a hit's flinch has, and the share of it an aimed gun keeps (the sight picture is barely knocked). */
const HURT_MIN = 0.5;
const AIMED_FLINCH = 0.4;

const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();

/**
 * Procedural first-person motion: look sway, gait bob, jump and landing,
 * crouch cant, breathing, hurt flinch and per-shot recoil. Produces one
 * position and rotation offset for the gun, in view space.
 */
export class Motion {
  readonly pos = new THREE.Vector3();
  readonly rot = new THREE.Vector3();
  /** Sprint pose weight (0…1) and step phase (radians, one cycle per two steps). */
  sprint = 0;
  phase = 0;
  /** Critically damped, so the gun leaves and reaches the sprint carry without a kick at either end, and soft enough that the turn into it is eased over several frames. */
  private readonly carry = new Spring3(150, 1);
  private readonly swayPos = new Spring3(150, 0.7);
  private readonly swayRot = new Spring3(150, 0.68);
  private readonly recoilPos = new Spring3(560, 0.62);
  private readonly recoilRot = new Spring3(560, 0.62);
  private readonly land = new Spring3(150, 0.5);
  private readonly flinch = new Spring3(190, 0.45);
  /** Slide and crouch weights: the slide dives in with a little give, the crouch settles. */
  private readonly stance = new Spring3(90, 0.75);
  private run = 0;
  private bob = 0;
  private freq = 1.9;
  private air = 0;
  private grounded = true;
  private heat = 0;
  private climb = 0;
  private tuning: Tuning | null = null;

  /** The shots' kick alone (rotation, rad), already inside `rot`. */
  get kickRot() {
    return this.recoilRot.value;
  }

  /** Sustained fire's climb (rad of pitch), already inside `rot`. */
  get climbTurn() {
    return this.climb;
  }

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
    const slid = input.sliding;
    const sprinting = input.sprint && input.speed > 1 && input.grounded && !slid;
    this.run = approach(this.run, sprinting ? 1 : 0, 6, dt);
    this.carry.target.x = sprinting ? Math.max(1 - busy, BUSY_CARRY) : 0;
    this.carry.step(dt);
    this.sprint = THREE.MathUtils.clamp(this.carry.value.x, 0, 1);
    this.stance.target.set(slid ? 1 : 0, input.crouch, 0);
    this.stance.step(dt);
    const slide = THREE.MathUtils.clamp(this.stance.value.x, 0, 1.15);
    const crouch = THREE.MathUtils.clamp(this.stance.value.y, 0, 1.1);
    const targetBob = input.grounded ? Math.min(1.5, input.speed / WALK_SPEED) : 0;
    this.bob = approach(this.bob, targetBob, 7, dt);
    this.freq = approach(this.freq, sprinting ? 2.6 : input.crouch > 0.5 ? 1.6 : 1.9, 5, dt);
    this.phase = (this.phase + dt * Math.PI * this.freq) % (Math.PI * 4);
    const amp = this.bob * calm * (1 + this.run * (SPRINT_AMP - 1)) * (0.85 + 0.15 * w) * (1 - Math.min(1, slide));
    const r = this.run;
    const mix = (k: keyof typeof WALK) => (WALK[k] + (RUN[k] - WALK[k]) * r) * amp;
    const s1 = Math.sin(this.phase);
    const s2 = Math.sin(this.phase * 2);
    const plant = (1 - Math.abs(Math.sin(this.phase - PLANT))) ** 4;

    // Jump: the gun is left behind as the legs push off, floats up tucked in and rolled while airborne, and is driven down by the landing.
    if (this.grounded && !input.grounded) this.land.impulse(-0.9, -3.4, 0);
    this.grounded = input.grounded;
    this.air = approach(this.air, input.grounded ? 0 : 1, 6, dt);
    this.land.step(dt);
    this.recoilPos.step(dt);
    this.recoilRot.step(dt);
    this.heat *= Math.exp(-dt / HEAT_COOL);
    this.climb *= Math.exp(-dt * CLIMB_RETURN);
    this.flinch.step(dt);

    // Aiming straightens the crouch cant.
    const cant = crouch * (1 - ads);
    const t = input.time;
    const breathe = (0.35 + 0.65 * calm) * (1 - this.sprint);
    const leap = 0.4 + 0.6 * calm;
    const air = this.air * leap;
    const land = this.land.value.y * leap;
    this.pos.set(
      s1 * mix('side') - air * 0.012,
      s2 * mix('lift') - plant * mix('plant') + this.climb * 0.12 + air * 0.02 + land * 0.34 + Math.sin(t * 1.55) * 0.0013 * breathe,
      this.land.value.x * 0.1 * leap + air * 0.022
    );
    this.rot.set(
      s2 * mix('pitch') - plant * mix('plant') * 1.5 + this.climb + air * 0.065 + land * 0.55 + Math.sin(t * 1.55 + 0.7) * 0.0045 * breathe,
      s1 * mix('yaw') + Math.sin(t * 0.71) * 0.0025 * breathe + air * 0.05,
      -s1 * mix('roll') + air * 0.16
    );
    for (let i = 0; i < 3; i++) {
      this.pos.setComponent(i, this.pos.getComponent(i) + CROUCH_POS[i]! * cant);
      this.rot.setComponent(i, this.rot.getComponent(i) + CROUCH_ROT[i]! * cant);
    }
    const lean = slide * (1 - ads * 0.8);
    const scrape = Math.min(1, slide) * Math.min(1, input.speed / WALK_SPEED) * (1 - ads * 0.8);
    for (let i = 0; i < 3; i++) {
      const shake = Math.sin(t * SCRAPE_HZ * 2 * Math.PI * (1 + i * 0.37) + i * 1.7) * scrape;
      this.pos.setComponent(i, this.pos.getComponent(i) + SLIDE_POS[i]! * lean + (i === 1 ? shake * SCRAPE[0] : 0));
      this.rot.setComponent(i, this.rot.getComponent(i) + SLIDE_ROT[i]! * lean + shake * SCRAPE[1] * (i === 1 ? 0.4 : 1));
    }
    this.pos.add(this.swayPos.value).add(this.recoilPos.value);
    this.rot.add(this.swayRot.value).add(this.recoilRot.value).addScaledVector(this.flinch.value, 1 - (1 - AIMED_FLINCH) * ads);
  }

  /** Where the gun sits before any clip or shake: at the hip, in the sights (its `sight` point on the camera axis), or in the sprint carry. */
  rest(sight: THREE.Vector3, ads: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
    const t = this.tuning!;
    const swing = Math.sin(Math.PI * ads);
    pos.set(...t.hip).lerp(v.set(-sight.x, -sight.y, -sight.z - t.eye), ads);
    pos.x -= 0.012 * swing;
    pos.y -= 0.016 * swing;
    pos.z += 0.02 * swing;
    quat.setFromEuler(e.set(...t.hipRot)).slerp(q.identity(), ads);
    const sprint = this.sprint * (1 - ads);
    if (sprint > 1e-3) {
      pos.lerp(v.set(...t.sprint), sprint);
      quat.slerp(q.setFromEuler(e.set(...t.sprintRot)), sprint);
    }
  }

  kick(ads: number) {
    const r = this.tuning?.recoil;
    if (!r) return;
    const aim = 1 - (1 - (r.adsRise ?? ADS_RISE)) * ads;
    const rnd = () => Math.random() * 2 - 1;
    const grow = 1 + BURST_GROW * this.heat;
    this.heat = Math.min(1, this.heat + HEAT_STEP);
    this.climb += r.rise * CLIMB * aim * grow;
    this.recoilPos.impulse(rnd() * r.side * aim * grow, r.up * aim, r.back * (1 - (1 - (r.adsBack ?? ADS_BACK)) * ads));
    this.recoilRot.impulse(r.rise * aim * grow, rnd() * r.yaw * aim * grow, rnd() * r.roll * aim * grow);
  }

  landImpulse(impact: number) {
    const k = Math.min(1.5, Math.max(0.2, impact));
    this.land.impulse(1.3 * k, -3.6 * k, 0);
  }

  /** A landed melee blow jars the gun in the other hand. */
  knock(weight: number) {
    this.flinch.impulse(-0.6 * weight, -0.5 * weight, 0.7 * weight);
  }

  /** A hit (`strength` 0…1): the gun is knocked down and over to one side and shoved back, never too little to see. */
  hurt(strength: number) {
    const k = HURT_MIN + Math.min(1, Math.max(0, strength));
    const side = Math.random() < 0.5 ? -1 : 1;
    const r = Math.random();
    this.flinch.impulse(-(1.6 + 0.6 * r) * k, side * (0.9 + 0.5 * r) * k, side * (2.2 + 0.8 * r) * k);
    this.land.impulse(0.5 * k, -1.2 * k, 0);
  }

  reset() {
    for (const s of [this.swayPos, this.swayRot, this.recoilPos, this.recoilRot, this.land, this.flinch, this.carry, this.stance]) s.reset();
    this.bob = 0;
    this.air = 0;
    this.heat = 0;
    this.climb = 0;
    this.run = 0;
    this.sprint = 0;
  }
}

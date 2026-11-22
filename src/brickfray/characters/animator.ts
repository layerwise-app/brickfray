import * as THREE from 'three';
import { actionLegs, emptyLegs, RELOAD_FAMILY, reloadBody, type Carried, type MagazineState, type ReloadFamily } from './actions';
import { Dangle } from './dangles';
import { AIR_FALL, AIR_PITCH, AIR_PUSH, AIR_TUCK, ballPivot, crouchFoot, crouchPose, Gait, IDLE, type FootPose } from './gait';
import { clamp, damp, hprQuat, lerp, smooth, twoBoneIK } from './ik';
import { Pose } from './pose';
import { BONE, PELVIS_Y, SHIN, THIGH, type V3 } from './skeleton';
import { emptyFidget, fidgetAt, type Style } from './style';
import type { AnimState } from './types';
import { poseStance, type Stance, type StanceLife } from './stance';
import { carry, poseUpper, type UpperInput } from './upper';
import type { MeleeId } from '../weapons/defs';
import { Flinch } from './flinch';
import { SLIDE, slideFoot, slidePelvis } from './slide';
import type { StowFit } from './stow';
import { Airborne } from './airborne';
import { FootLock } from './foot-lock';

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const qu = new THREE.Quaternion();
const ql = new THREE.Quaternion();
const knee = new THREE.Vector3();
const reached = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0);
const body = [0, 0, 0, 0, 0, 0];
const feet: FootPose[] = [0, 1].map(() => ({ pos: new THREE.Vector3(), heading: 0, pitch: 0, toe: 0, planted: 1, stance: 0, swing: -1 }));
const legs = emptyLegs();
const turn = { heading: 0, pitch: 0, roll: 0 };

/** Procedural animation for one character: gait, jump/land, aim, hands on the gun, actions, fidgets, secondary motion. */
export class Animator {
  readonly pose: Pose;
  readonly gait = new Gait();
  time = 0;
  private vx = 0;
  private vz = 0;
  private speed = 0;
  private crouch = 0;
  private sprint = 0;
  private ads = 0;
  private readonly jump = new Airborne();
  private idleTime = 0;
  private ready = 0;
  /** Throw progress as played: cooking arrives at its held wind-up pose at once, the animation winds up into it. */
  private nade = -1;
  /** Per-player variation (0 = none, deterministic for the lab): clock and gait offsets, breathing rate, aim drift. */
  private seed = 0;
  private fidgetCount = 0;
  private fidgetStart = -1;
  private nextFidget = 4;
  private fidget = emptyFidget();
  private dangles: Dangle[] = [];
  private move = new THREE.Vector3();
  private lean = new THREE.Vector3();
  /** Points on the held gun relative to its grip; the rig sets them when it is given a weapon. */
  support: THREE.Matrix4 | null = null;
  magHold: THREE.Matrix4 | null = null;
  muzzle: THREE.Matrix4 | null = null;
  private reload: { family: ReloadFamily; progress: number; blend: number } = { family: 'rifle', progress: 0, blend: 0 };
  /** What the left hand holds after the last update, for the rig's props. */
  readonly held: { item: Carried; magazine: MagazineState; grenade: number } = { item: 'none', magazine: 'seated', grenade: 0 };
  /** A held showroom pose; replaces the gameplay animation while set. */
  stance: Stance | null = null;
  /** How fast a held stance is being turned about the vertical (radians per second), for its hanging parts: the showroom's turntable. */
  spin = 0;
  /** Gestures and weight shifts laid over a held stance (the showroom's idle). */
  life: StanceLife | undefined;
  /** The figure's melee weapon (its swing) and where its stowed guns ride; the rig sets them. */
  tool: MeleeId = 'mallet';
  fit: StowFit = { back: 0.15, hip: 0.18 };
  private slide = 0;
  private readonly flinch = new Flinch();
  private readonly lock = new FootLock();
  /** The body's scale in the world, for holding the feet on their spots. */
  scale = 1;

  constructor(
    rest: V3[],
    readonly style: Style
  ) {
    this.pose = new Pose(rest);
    if (style.dangleHead) this.dangles.push(new Dangle(BONE.dangleHead, BONE.head, style.dangleHead));
    if (style.dangleBack) this.dangles.push(new Dangle(BONE.dangleBack, BONE.chest, style.dangleBack));
    if (style.dangleHip) this.dangles.push(new Dangle(BONE.dangleHip, BONE.pelvis, style.dangleHip));
    this.reset();
  }

  /** Give this figure its own timing so a group of players never moves in lock-step. */
  vary(seed: number) {
    this.seed = 1 + (Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1) * 6;
    this.reset();
  }

  reset() {
    this.pose.reset();
    this.gait.reset();
    const u = this.seed ? (this.seed - 1) / 6 : 0;
    this.gait.phase = (0.1 + u * 0.618 * 7) % 1;
    this.time = u * 37;
    this.vx = this.vz = this.speed = this.crouch = this.sprint = this.ads = this.slide = 0;
    this.flinch.reset();
    this.lock.reset();
    this.jump.reset();
    this.ready = 1;
    this.nade = -1;
    this.idleTime = 0;
    this.fidgetCount = 0;
    this.fidgetStart = -1;
    this.nextFidget = 4 + u * 6;
    this.reload.blend = 0;
    this.held.item = 'none';
    this.held.magazine = 'seated';
    this.held.grenade = 0;
    for (const d of this.dangles) d.reset();
  }

  update(rawDt: number, s: AnimState) {
    const dt = clamp(rawDt, 0, 0.1);
    this.time += dt * (this.seed ? 0.88 + 0.04 * this.seed : 1);
    if (this.stance) {
      poseStance(this.pose, this.stance, this.time, this.support, this.life);
      this.held.item = 'none';
      this.held.magazine = 'seated';
      this.held.grenade = 0;
      if (dt > 0) for (const d of this.dangles) d.update(dt, this.pose, this.move.set(0, 0, 0), this.spin);
      return;
    }
    const st = this.style;
    const turned = this.lock.turn(dt, s.place, smooth(this.speed, 0.12, 0.8));
    if (turned) {
      // The velocity's smoothing and the stride's direction stay put in the world as the body turns.
      const c = Math.cos(turned);
      const sn = Math.sin(turned);
      [this.vx, this.vz] = [this.vx * c + this.vz * sn, this.vz * c - this.vx * sn];
      this.gait.heading = Math.atan2(Math.sin(this.gait.heading + turned), Math.cos(this.gait.heading + turned));
    }
    this.vx = damp(this.vx, s.localVelocity.x, 10, dt);
    this.vz = damp(this.vz, s.localVelocity.z, 10, dt);
    this.speed = Math.hypot(this.vx, this.vz);
    this.crouch = damp(this.crouch, clamp(s.crouch, 0, 1), 9, dt);
    this.sprint = damp(this.sprint, s.sprint && this.speed > 3 ? 1 : 0, 6, dt);
    this.ads = damp(this.ads, s.ads, 18, dt);
    // The gun comes up at once to fire (ahead of a shot seen coming) and settles back to low ready a moment after the last one.
    const calm = !s.alert && s.sinceShot > 0.9 && s.ads < 0.1 ? 1 : 0;
    this.ready = damp(this.ready, calm, calm > this.ready ? 2.6 : 30, dt);
    // Without the flag (labs, older states) a crouch at sliding speed is a slide.
    const sliding = s.slide ?? (s.grounded && s.crouch > 0.5 && s.speed > 5);
    this.slide = damp(this.slide, sliding ? 1 : 0, sliding ? 16 : 7, dt);
    const jolt = this.flinch.update(dt, s.sinceHurt, s.hurtDirection, s.hurtAmount ?? 30);
    if (s.reload >= 0) {
      this.reload.family = RELOAD_FAMILY[s.weapon];
      this.reload.progress = s.reload;
    }
    this.reload.blend = damp(this.reload.blend, s.reload >= 0 ? 1 : 0, 13, dt);
    if (s.grenade < 0) this.nade = -1;
    else this.nade = Math.min(s.grenade, Math.max(0, this.nade) + dt * (s.grenade > 0.25 ? 3 : 1.4));
    const moving = smooth(this.speed, 0.12, 0.8);
    const dir = Math.atan2(this.vx, this.vz);
    this.move.set(this.vx, 0, -this.vz);

    this.jump.update(dt, s);
    const { air, airTime, landX } = this.jump;
    this.updateFidget(dt, s, moving);
    const F = this.fidget;

    const pelvisHeading = this.gait.update(dt, this.speed, dir, moving, this.crouch, this.sprint, st);
    const P = this.gait.params!;
    const crouch = this.crouch;

    // Feet: idle stance blended with the gait, then with air poses.
    const rising = smooth(s.verticalVelocity, -3, 1);
    const planted = (1 - moving) * (1 - crouch);
    actionLegs(this.nade, this.nade < 0 ? s.melee : -1, this.tool, legs);
    const sl = this.slide;
    const push = smooth(s.verticalVelocity, 0.5, 2.5) * (1 - smooth(airTime, 0.04, 0.18));
    for (let i = 0; i < 2; i++) {
      const f = feet[i]!;
      const g = this.gait.feet[i]!;
      const idle = IDLE[i]!;
      const cr = crouchFoot(i, st, crouchPose);
      const side = i === 0 ? -1 : 1;
      f.heading = lerp(idle.heading, cr.heading, crouch) + side * st.toeOut * 0.5 + legs.turn[i]! * planted;
      const heelUp = cr.pitch * crouch - 0.45 * F.heel * (1 - moving) - legs.heel[i]! * planted;
      ballPivot(heelUp, f.heading, f.pos.set(lerp(idle.pos[0] * st.stance, cr.pos[0], crouch) + legs.side[i]! * planted, 0, lerp(idle.pos[2], cr.pos[2], crouch) - legs.reach[i]! * planted));
      f.pos.y += legs.lift[i]! * planted;
      f.pitch = heelUp;
      f.toe = -heelUp;
      f.pos.lerp(g.pos, moving);
      f.heading = lerp(f.heading, g.heading, moving);
      f.pitch = lerp(f.pitch, g.pitch, moving);
      f.toe = lerp(f.toe, g.toe, moving);
      f.planted = lerp(1, g.planted, moving);
      f.stance = moving > 0.5 ? g.stance : 0.5;
      f.swing = moving > 0.5 && air < 0.5 ? g.swing : -1;
      if (air > 0) {
        const tuck = AIR_TUCK[i]!;
        const fall = AIR_FALL[i]!;
        const pushed = AIR_PUSH[i]!;
        v1.set(lerp(fall[0], tuck[0], rising), lerp(fall[1], tuck[1], rising), lerp(fall[2], tuck[2], rising));
        v1.lerp(v2.set(...pushed), push);
        f.pos.lerp(v1, air);
        f.pitch = lerp(f.pitch, lerp(lerp(AIR_PITCH.fall[i]!, AIR_PITCH.tuck[i]!, rising), AIR_PITCH.push[i]!, push), air);
        f.heading = lerp(f.heading, side * 0.12, air);
        f.toe = lerp(f.toe, 0, air);
        f.planted = lerp(f.planted, 0, air);
      }
      slideFoot(f, i, sl);
    }
    this.lock.hold(dt, feet, this.scale, s.grounded ? (1 - air) * (1 - sl) : 0, moving);

    // Pelvis: height, bob/sway, heading toward the move direction, lean.
    const pose = this.pose;
    const breath = Math.sin((this.time * Math.PI * 2) / 3.6);
    const shift = Math.sin(this.time * 0.55) * 0.016 * (1 - moving);
    const standY = PELVIS_Y - 0.008 - st.knees - P.drop * moving;
    const kneelY = lerp(0.47 + 0.05 * clamp(st.bounce, 0, 1), 0.6, moving);
    const baseY = lerp(standY, kneelY, crouch);
    const pp = pose.p[BONE.pelvis]!;
    pp.set(0.02 * (1 - moving) * (1 - crouch) + shift, baseY + this.gait.pelvis.y * moving + landX + F.pelvisY * (1 - moving) + 0.004 * breath * (1 - moving), 0);
    pp.x += this.gait.pelvis.x * moving;
    const hip = legs.hip;
    pp.z += this.gait.pelvis.z * moving + lerp(0.02, 0.06, moving) * crouch + hip[2]! * planted;
    pp.x += hip[0]! * planted;
    pp.y += hip[1]! * planted;
    // Reloading on the spot, the knees give and the weight rocks onto the side the hands work on.
    const reloadW = this.reload.blend * (1 - moving) * (1 - crouch);
    if (reloadW > 0.004) {
      reloadBody(this.reload.family, this.reload.progress, body);
      pp.y -= body[4]! * reloadW;
      pp.x += body[5]! * reloadW;
    } else body.fill(0);
    const idleHeading = -0.22 - 0.06 * crouch + 0.3 * body[0]! * reloadW + hip[3]! * planted;
    turn.heading = lerp(idleHeading + this.lock.twist, pelvisHeading, moving) + this.gait.yaw * moving;
    turn.roll = this.gait.roll * moving + shift * 1.5;
    const airPitch = air * lerp(0.06, -0.1, rising);
    turn.pitch = -lerp(0.14, 0.3, moving) * crouch - (0.04 + 0.08 * P.run) * moving * (this.gait.backward ? -0.5 : 1) - 0.5 * landX + airPitch + hip[4]! * planted;
    slidePelvis(pp, turn, sl);
    // A hit shoves the hips away from the shooter and the knees give.
    pp.x += 0.12 * jolt.x;
    pp.z += 0.12 * jolt.y;
    pp.y -= 0.12 * jolt.length();
    hprQuat(turn.heading, turn.pitch, turn.roll, pose.q[BONE.pelvis]!);
    pose.solve(BONE.pelvis);

    // Lower the hips if a planted foot is out of reach (long strides, deep crouch).
    let deficit = 0;
    for (let i = 0; i < 2; i++) {
      const f = feet[i]!;
      if (f.planted < 0.5 || (f.stance > (P.toeStart ?? 0.5) && moving > 0.5)) continue;
      pose.solve(i === 0 ? BONE.thighL : BONE.thighR);
      const d = pose.mp[i === 0 ? BONE.thighL : BONE.thighR]!.distanceTo(f.pos) - (THIGH + SHIN) * 0.985;
      deficit = Math.max(deficit, d);
    }
    if (deficit > 0) {
      pp.y -= deficit * 1.05;
      pose.solve(BONE.pelvis);
    }

    // Legs: two-bone IK with knees following the feet; kneeling, the lead knee points up and the rear one down.
    const kneel = crouch * (1 - moving);
    for (let i = 0; i < 2; i++) {
      const f = feet[i]!;
      const side = i === 0 ? -1 : 1;
      const thigh = i === 0 ? BONE.thighL : BONE.thighR;
      pose.solve(thigh);
      v1.set(Math.sin(f.heading) + side * (0.16 + 0.14 * crouch * moving), 0.35 * air + (i === 0 ? 0.35 : -0.5) * kneel, -Math.cos(f.heading));
      if (sl > 0.001) v1.lerp(SLIDE.poles[i]!, sl);
      twoBoneIK(pose.mp[thigh]!, f.pos, THIGH, SHIN, v1, true, qu, ql, knee, reached);
      pose.setModelRotation(thigh, qu);
      pose.setModelRotation(thigh + 1, ql);
      pose.setModelRotation(thigh + 2, hprQuat(f.heading, f.pitch, 0, q1));
      pose.q[thigh + 3]!.setFromAxisAngle(X, Math.max(0, f.toe));
      pose.solve(thigh + 3);
    }

    // Upper body.
    const leanAmt = (0.05 + 0.15 * P.run + 0.2 * this.sprint) * moving * (1 - crouch * 0.5);
    this.lean.copy(this.move).normalize().multiplyScalar(this.speed > 0.05 ? leanAmt * (1 - sl) : 0);
    if (this.gait.backward) this.lean.multiplyScalar(0.4);
    const input: UpperInput = {
      state: s,
      time: this.time,
      ads: this.ads,
      sprint: this.sprint,
      crouch,
      moving,
      run: P.run,
      air,
      phase: this.gait.phase,
      gaitYaw: this.gait.yaw * moving,
      gaitRoll: this.gait.roll * moving,
      lean: this.lean,
      landing: clamp(-landX * 3, 0, 1),
      style: st,
      fidget: F,
      support: this.support,
      magHold: this.magHold,
      muzzle: this.muzzle,
      reload: this.reload,
      grenade: this.nade,
      ready: this.ready,
      seed: this.seed,
      slide: sl,
      flinch: jolt,
      tool: this.tool,
      fit: this.fit
    };
    poseUpper(pose, input);
    this.held.item = carry.item;
    this.held.magazine = carry.magazine;
    this.held.grenade = carry.grenade;
    if (dt > 0) for (const d of this.dangles) d.update(dt, pose, this.move);
  }

  private updateFidget(dt: number, s: AnimState, moving: number) {
    const calm = moving < 0.05 && s.ads < 0.1 && s.reload < 0 && s.melee < 0 && s.grenade < 0 && s.sinceShot > 1.5 && s.grounded && s.sinceHurt > 1;
    this.idleTime = calm ? this.idleTime + dt : 0;
    if (this.fidgetStart < 0 && this.idleTime > this.nextFidget) {
      this.fidgetStart = this.time;
      this.fidgetCount++;
      this.nextFidget = this.idleTime + this.style.fidgetLength + 5 + ((this.fidgetCount * 7919) % 50) / 10;
    }
    if (this.fidgetStart >= 0) {
      const t = (this.time - this.fidgetStart) / this.style.fidgetLength;
      if (t >= 1 || !calm) {
        this.fidgetStart = -1;
        fidgetAt(this.style.fidget, 1, this.fidget);
        return;
      }
      fidgetAt(this.style.fidget, t, this.fidget);
    } else fidgetAt(this.style.fidget, 1, this.fidget);
  }

  /** Force a fidget now (lab). */
  playFidget() {
    this.idleTime = Math.max(this.idleTime, this.nextFidget);
  }

  headCenter(out: THREE.Vector3) {
    return this.pose.toModel(BONE.head, v2.set(0, 0.075, -0.01), out);
  }
}


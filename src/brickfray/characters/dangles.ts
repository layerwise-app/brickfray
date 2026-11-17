import * as THREE from 'three';
import { clamp } from './ik';
import type { Pose } from './pose';
import type { DangleSpec } from './style';

const down = new THREE.Vector3();
const vel = new THREE.Vector3();
const acc = new THREE.Vector3();
const inv = new THREE.Quaternion();
const e = new THREE.Euler();

/**
 * Secondary motion for a hanging or springy part (ponytail, scarf, plume,
 * antenna): a damped spring on pitch/roll pulled by gravity, the anchor's
 * acceleration and movement drag. Runs in the body frame.
 */
export class Dangle {
  private pitch = 0;
  private roll = 0;
  private vp = 0;
  private vr = 0;
  private last = new THREE.Vector3();
  private lastVel = new THREE.Vector3();
  private primed = false;

  constructor(
    readonly bone: number,
    readonly parent: number,
    readonly spec: DangleSpec
  ) {}

  reset() {
    this.pitch = this.spec.rest[0];
    this.roll = this.spec.rest[1];
    this.vp = this.vr = 0;
    this.primed = false;
  }

  update(dt: number, pose: Pose, move: THREE.Vector3) {
    const S = this.spec;
    pose.solve(this.bone);
    const anchor = pose.mp[this.bone]!;
    if (!this.primed || dt <= 0) {
      this.last.copy(anchor);
      this.lastVel.copy(move);
      this.primed = true;
    }
    const h = Math.max(dt, 1e-4);
    vel.subVectors(anchor, this.last).divideScalar(h).add(move);
    acc.subVectors(vel, this.lastVel).divideScalar(h).clampLength(0, 40);
    this.last.copy(anchor);
    this.lastVel.copy(vel);

    inv.copy(pose.mq[this.parent]!).invert();
    down.set(0, S.up ? 1 : -1, 0).applyQuaternion(inv);
    vel.applyQuaternion(inv);
    acc.applyQuaternion(inv);
    const sign = S.up ? -1 : 1;
    const gp = S.up ? Math.atan2(down.z, down.y) : Math.atan2(-down.z, -down.y);
    const gr = S.up ? Math.atan2(-down.x, down.y) : Math.atan2(down.x, -down.y);
    const tp = S.rest[0] + (gp - S.rest[0]) * S.hang + sign * (S.drag * vel.z + S.inertia * acc.z);
    const tr = S.rest[1] + (gr - S.rest[1]) * S.hang - sign * (S.drag * vel.x + S.inertia * acc.x);
    const steps = Math.ceil(h / (1 / 120));
    const sd = h / steps;
    for (let i = 0; i < steps; i++) {
      this.vp += (S.k * (tp - this.pitch) - S.damping * this.vp) * sd;
      this.vr += (S.k * (tr - this.roll) - S.damping * this.vr) * sd;
      this.pitch += this.vp * sd;
      this.roll += this.vr * sd;
    }
    this.pitch = clamp(this.pitch, -S.limit, S.limit);
    this.roll = clamp(this.roll, -S.limit, S.limit);
    pose.q[this.bone]!.setFromEuler(e.set(this.pitch, 0, this.roll, 'XYZ'));
    pose.solve(this.bone);
  }
}

import * as THREE from 'three';
import { SIDEARMS } from '../weapons/defs';
import { AT } from './actions';
import { hprQuat, twoBoneIK, UP } from './ik';
import type { Pose } from './pose';
import { BONE, FOREARM, UPPER_ARM } from './skeleton';
import type { UpperInput } from './upper';

/** A gun grip's model-space place and turn. */
export interface GunFrame {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
}

const v3 = new THREE.Vector3();
const qy = new THREE.Quaternion();

function yawOf(q: THREE.Quaternion) {
  v3.set(0, 0, -1).applyQuaternion(q);
  return qy.setFromAxisAngle(UP, Math.atan2(-v3.x, -v3.z));
}

const mid = new THREE.Vector3();
const end = new THREE.Vector3();
const off = new THREE.Vector3();
const reach = new THREE.Vector3();
const qu = new THREE.Quaternion();
const ql = new THREE.Quaternion();

export function limb(pose: Pose, side: 'L' | 'R', wrist: THREE.Vector3, poleDir: THREE.Vector3, hand: THREE.Quaternion) {
  const ua = BONE[`upperArm${side}`];
  const fa = BONE[`forearm${side}`];
  const h = BONE[`hand${side}`];
  pose.solve(ua);
  // `wrist` is where the hand bone goes; the forearm reaches for the hand's own wrist, which can sit off the bone.
  off.copy(pose.wrist[side]).applyQuaternion(hand);
  twoBoneIK(pose.mp[ua]!, reach.copy(wrist).add(off), UPPER_ARM, FOREARM, poleDir, false, qu, ql, mid, end);
  pose.setModelRotation(ua, qu);
  pose.setModelRotation(fa, ql);
  const rest = pose.rest[h]!;
  pose.p[h]!.copy(off).negate().applyQuaternion(qu.copy(ql).invert()).add(reach.set(rest[0], rest[1], rest[2]));
  pose.setModelRotation(h, hand);
}

const MAG_FALLBACK = { rifle: new THREE.Vector3(0, -0.1, -0.11), sidearm: new THREE.Vector3(0, -0.09, 0.028) };
const PORT = new THREE.Vector3(0.0, -0.012, -0.13);
const CYLINDER = new THREE.Vector3(-0.05, 0.035, -0.043);
const MUZZLE_FALLBACK = new THREE.Vector3(0, 0.065, -0.5);
const BESIDE_MUZZLE = new THREE.Vector3(-0.012, -0.04, 0.03);
const POUCH = new THREE.Vector3(-0.24, 0.0, -0.05);
const QUIVER = new THREE.Vector3(-0.13, 0.2, 0.15);
/** Over the top of the receiver: a rifle's charging handle, a pistol's slide. */
const HANDLE = new THREE.Vector3(0.0, 0.07, -0.02);

/** Where the left hand's palm goes at a reload place, and how the hand is turned there. */
export function reloadPlace(pose: Pose, I: UpperInput, gun: GunFrame, place: number, support: THREE.Vector3, supportQ: THREE.Quaternion, out: THREE.Vector3, q: THREE.Quaternion) {
  q.copy(gun.q);
  switch (place) {
    case AT.magazine:
      if (I.magHold) return out.setFromMatrixPosition(I.magHold).applyQuaternion(gun.q).add(gun.pos);
      return out.copy(SIDEARMS.has(I.state.weapon) ? MAG_FALLBACK.sidearm : MAG_FALLBACK.rifle).applyQuaternion(gun.q).add(gun.pos);
    case AT.pouch:
      hprQuat(-0.4, -1.2, 0.3, q).premultiply(yawOf(pose.mq[BONE.pelvis]!));
      return pose.toModel(BONE.pelvis, out.copy(POUCH), out);
    case AT.port:
      return out.copy(PORT).applyQuaternion(gun.q).add(gun.pos);
    case AT.handle:
      return out.copy(HANDLE).applyQuaternion(gun.q).add(gun.pos);
    case AT.cylinder:
      return out.copy(CYLINDER).applyQuaternion(gun.q).add(gun.pos);
    case AT.quiver:
      hprQuat(2.7, 0.9, -0.5, q).premultiply(yawOf(pose.mq[BONE.chest]!));
      return pose.toModel(BONE.chest, out.copy(QUIVER), out);
    case AT.muzzle:
      if (I.muzzle) out.setFromMatrixPosition(I.muzzle);
      else out.copy(MUZZLE_FALLBACK);
      return out.add(BESIDE_MUZZLE).applyQuaternion(gun.q).add(gun.pos);
    default:
      q.copy(supportQ);
      return out.copy(support);
  }
}

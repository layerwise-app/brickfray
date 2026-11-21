import * as THREE from 'three';
import type { FingerPose } from './fingers';
import { fingerJoint, HAND_JOINTS, THUMB_JOINT } from './hand';

/** Bones of one hand in HAND_JOINTS order; [0] is the hand, the rest hang off it. */
export function createHandBones(mirror: boolean): THREE.Bone[] {
  const bones = HAND_JOINTS.map(() => new THREE.Bone());
  HAND_JOINTS.forEach((joint, i) => {
    if (joint.parent < 0) return;
    bones[i]!.position.copy(joint.pos);
    if (mirror) bones[i]!.position.x *= -1;
    bones[joint.parent]!.add(bones[i]!);
  });
  return bones;
}

/**
 * Turn a finger shape into joint rotations. A curl of 1 is a closed fist, 0 a straight finger.
 * `trigger` (0…1) reshapes the index for a hand on a pistol grip: it reaches up and forward
 * from the knuckle and bends at the middle joint, hooking around the trigger; `spread` raises it.
 */
export function poseFingers(bones: readonly THREE.Bone[], pose: FingerPose, mirror: boolean, trigger = 0) {
  for (let i = 0; i < 4; i++) {
    const curl = i === 0 ? pose.index : i === 1 ? pose.middle : i === 2 ? pose.ring : pose.pinky;
    const open = FAN[i]! + SPREAD[i]! * pose.spread;
    let fan = open + (CONVERGE[i]! - open) * Math.min(1, curl * 1.4) * (1 - (pose.splay ?? 0));
    let knuckle = KNUCKLE * curl ** 0.6;
    let middle = MIDDLE * curl ** 1.25;
    let tip = TIP * curl ** 1.6;
    if (i === 0 && trigger > 0) {
      fan += (HOOK_LIFT + HOOK_SPREAD * pose.spread - fan) * trigger;
      knuckle += (Math.min(KNUCKLE, HOOK[0] * curl) - knuckle) * trigger;
      middle += (Math.min(MIDDLE, HOOK[1] * curl) - middle) * trigger;
      tip += (Math.min(TIP, HOOK[2] * curl) - tip) * trigger;
    }
    set(bones[fingerJoint(i, 0)]!, bend(knuckle).multiply(tmp.set(Math.sin(fan / 2), 0, 0, Math.cos(fan / 2))), mirror);
    set(bones[fingerJoint(i, 1)]!, bend(middle), mirror);
    set(bones[fingerJoint(i, 2)]!, bend(tip), mirror);
  }
  const curl = pose.thumb;
  if (pose.oppose < 0) q.copy(THUMB_OUT).slerp(THUMB_ALONG, -pose.oppose);
  else q.copy(THUMB_OUT).slerp(THUMB_ACROSS, pose.oppose);
  set(bones[THUMB_JOINT]!, q.multiply(tmp.set(0, Math.sin(curl * THUMB_BASE * 0.5), 0, Math.cos(curl * THUMB_BASE * 0.5))), mirror);
  const hook = pose.hook ?? 0;
  set(bones[THUMB_JOINT + 1]!, bend(0.05 + curl * THUMB_KNUCKLE + hook * HOOK_KNUCKLE), mirror);
  set(bones[THUMB_JOINT + 2]!, bend(curl * THUMB_TIP + hook * HOOK_TIP), mirror);
}

/**
 * Bend (radians) of a fully curled finger at the knuckle, the middle joint and the tip joint.
 * The knuckle leads and the tip trails, so a half curl hooks around something wide and a
 * nearly full one closes around a handle.
 */
const KNUCKLE = 1.5;
const MIDDLE = 1.85;
const TIP = 1.25;
/** Sideways lean of each finger (index … pinky): at rest, the extra at full spread, and in a fist. */
const FAN = [0.07, 0, -0.06, -0.14];
const SPREAD = [0.17, 0.03, -0.12, -0.28];
const CONVERGE = [-0.05, 0, 0.04, 0.1];
/** Trigger finger: bend per unit of curl at the knuckle, middle and tip joints, and its lift toward the trigger. */
const HOOK = [0.58, 3.67, 2.9];
const HOOK_LIFT = 0.38;
const HOOK_SPREAD = 0.4;
const THUMB_BASE = 1.1;
const THUMB_KNUCKLE = 0.6;
const THUMB_TIP = 1.06;
/** A hooked thumb: extra bend at its knuckle and tip joints. */
const HOOK_KNUCKLE = 0.55;
const HOOK_TIP = 1.0;

const q = new THREE.Quaternion();
const tmp = new THREE.Quaternion();

/** Joint frame whose segment points along `dir` with its pad facing `pad`. */
function frame(dir: readonly [number, number, number], pad: readonly [number, number, number]) {
  const z = new THREE.Vector3(...dir).normalize().negate();
  const x = new THREE.Vector3(...pad).negate();
  x.addScaledVector(z, -x.dot(z)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
}

/** Thumb base with the thumb out beside the palm, swung across it to face the fingers, and laid forward along the index finger. */
const THUMB_OUT = frame([0.1, 0.72, -0.68], [-0.8, -0.4, -0.45]);
const THUMB_ACROSS = frame([-0.91, 0.24, 0.35], [-0.3, 0.22, -0.93]);
const THUMB_ALONG = frame([0.02, 0.2, -0.98], [-0.9, -0.4, -0.1]);

function bend(angle: number) {
  return q.set(0, Math.sin(angle / 2), 0, Math.cos(angle / 2));
}

function set(bone: THREE.Bone, rotation: THREE.Quaternion, mirror: boolean) {
  if (mirror) bone.quaternion.set(rotation.x, -rotation.y, -rotation.z, rotation.w);
  else bone.quaternion.copy(rotation);
}

import * as THREE from 'three';
import { hprQuat, twoBoneIK } from './ik';
import type { HandShape } from './parts';
import type { Pose } from './pose';
import { ANKLE_H, BALL, BONE, PELVIS_Y, SHIN, THIGH, type V3 } from './skeleton';
import { limb, SOCKET_L } from './upper';

/** Rotations are [heading, pitch, roll] in radians: heading turns right, pitch tips up, roll leans right. */
export interface Stance {
  /** Offset of the hips from standing at rest, and their rotation. */
  pelvis: { at: V3; rot: V3 };
  /** Model-space rotation of the chest (the waist takes part of it) and of the head (the neck takes part). */
  chest: V3;
  head: V3;
  feet: { L: StanceFoot; R: StanceFoot };
  arms: { L: StanceArm; R: StanceArm };
  /** The left hand holds the gun's support grip instead of going to `arms.L`. */
  support?: boolean;
  /** The melee weapon shows in the left hand (give that hand the `fist` shape). */
  melee?: boolean;
  /** Idle life, each 0…1+: breathing, weight shifting, looking around. */
  life?: { breath?: number; sway?: number; look?: number };
}

export interface StanceFoot {
  /** Where the foot stands: x, height off the ground, z. */
  at: V3;
  heading: number;
  /** Negative lifts the heel onto the ball of the foot. */
  pitch?: number;
  /** Extra outward turn of the knee. */
  knee?: number;
}

export interface StanceArm {
  /** Wrist position and hand rotation in `space` (model space by default). A hand's fingers run along its -Z, thumb up. */
  wrist: V3;
  hand: V3;
  /** Direction the elbow points, in model space. */
  elbow: V3;
  space?: 'chest' | 'pelvis' | 'head';
  shape: HandShape;
}

const SPACE = { chest: BONE.chest, pelvis: BONE.pelvis, head: BONE.head };
const ID = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const qu = new THREE.Quaternion();
const ql = new THREE.Quaternion();
const m1 = new THREE.Matrix4();
const eul = new THREE.Euler();
const feet = [new THREE.Vector3(), new THREE.Vector3()];

/** Poses the whole body in a held stance, alive with breathing, a slow weight shift and a wandering gaze. */
export function poseStance(pose: Pose, s: Stance, time: number, support: THREE.Matrix4 | null) {
  const breath = Math.sin((time * Math.PI * 2) / 3.8) * (s.life?.breath ?? 1);
  const sway = Math.sin(time * 0.5) * (s.life?.sway ?? 1);
  const look = s.life?.look ?? 1;

  const pp = pose.p[BONE.pelvis]!;
  pp.set(s.pelvis.at[0] + 0.012 * sway, PELVIS_Y + s.pelvis.at[1] + 0.003 * breath, s.pelvis.at[2]);
  hprQuat(s.pelvis.rot[0], s.pelvis.rot[1], s.pelvis.rot[2] + 0.02 * sway, pose.q[BONE.pelvis]!);
  pose.solve(BONE.pelvis);

  // Ankles; the hips sink if a planted foot would be out of reach.
  let deficit = 0;
  (['L', 'R'] as const).forEach((side, i) => {
    const f = s.feet[side];
    const pitch = Math.min(0, f.pitch ?? 0);
    const along = -BALL * Math.cos(pitch) - ANKLE_H * Math.sin(pitch) + BALL;
    feet[i]!.set(f.at[0] + Math.sin(f.heading) * along, f.at[1] - BALL * Math.sin(pitch) + ANKLE_H * Math.cos(pitch), f.at[2] - Math.cos(f.heading) * along);
    const thigh = BONE[`thigh${side}`];
    pose.solve(thigh);
    deficit = Math.max(deficit, pose.mp[thigh]!.distanceTo(feet[i]!) - (THIGH + SHIN) * 0.985);
  });
  if (deficit > 0) {
    pp.y -= deficit * 1.05;
    pose.solve(BONE.pelvis);
  }
  (['L', 'R'] as const).forEach((side, i) => {
    const f = s.feet[side];
    const sign = i === 0 ? -1 : 1;
    const thigh = BONE[`thigh${side}`];
    pose.solve(thigh);
    v1.set(Math.sin(f.heading) + sign * (0.16 + (f.knee ?? 0)), 0, -Math.cos(f.heading));
    twoBoneIK(pose.mp[thigh]!, feet[i]!, THIGH, SHIN, v1, true, qu, ql, v2, v3);
    pose.setModelRotation(thigh, qu);
    pose.setModelRotation(thigh + 1, ql);
    pose.setModelRotation(thigh + 2, hprQuat(f.heading, f.pitch ?? 0, 0, q1));
    pose.q[thigh + 3]!.setFromAxisAngle(X, Math.max(0, -(f.pitch ?? 0)));
    pose.solve(thigh + 3);
  });

  // Torso and head.
  hprQuat(s.chest[0], s.chest[1] + 0.014 * breath, s.chest[2] - 0.015 * sway, q1);
  q2.copy(pose.mq[BONE.pelvis]!).invert().multiply(q1);
  pose.q[BONE.spine]!.slerpQuaternions(ID, q2, 0.45);
  pose.solve(BONE.spine);
  pose.setModelRotation(BONE.chest, q1);
  hprQuat(s.head[0] + 0.12 * look * Math.sin(time * 0.31 + 1), s.head[1] + 0.035 * look * Math.sin(time * 0.23), s.head[2], q1);
  q2.copy(pose.mq[BONE.chest]!).invert().multiply(q1);
  pose.q[BONE.neck]!.slerpQuaternions(ID, q2, 0.4);
  pose.solve(BONE.neck);
  pose.setModelRotation(BONE.head, q1);
  pose.p[BONE.hat]!.y = pose.rest[BONE.hat]![1];
  pose.q[BONE.hat]!.identity();
  pose.solve(BONE.hat);
  const shrug = 0.02 * breath;
  pose.q[BONE.clavL]!.setFromEuler(eul.set(0, 0, -shrug, 'YXZ'));
  pose.q[BONE.clavR]!.setFromEuler(eul.set(0, 0, shrug, 'YXZ'));
  pose.solveChain('clavL', 'clavR', 'upperArmL', 'upperArmR');

  arm(pose, 'R', s.arms.R);
  if (s.support && support) {
    // The gun hangs off the right hand; the left wrist goes where its support grip is.
    m1.compose(pose.mp[BONE.handR]!, pose.mq[BONE.handR]!, v3.set(1, 1, 1)).multiply(support);
    m1.decompose(v1, q1, v3);
    v1.sub(v2.copy(SOCKET_L).applyQuaternion(q1));
    limb(pose, 'L', v1, v2.set(...s.arms.L.elbow), q1);
  } else arm(pose, 'L', s.arms.L);

  pose.s[BONE.mallet] = s.melee ? 1 : 0;
  pose.s[BONE.grenade] = 0;
  pose.solveChain('mallet', 'grenade');
}

function arm(pose: Pose, side: 'L' | 'R', a: StanceArm) {
  hprQuat(a.hand[0], a.hand[1], a.hand[2], q1);
  v1.set(...a.wrist);
  if (a.space) {
    const bone = SPACE[a.space];
    pose.toModel(bone, v1, v1);
    q1.premultiply(pose.mq[bone]!);
  }
  limb(pose, side, v1, v2.set(...a.elbow), q1);
}

/** Gun low across the body, weight on the back leg, chin up: the stance a character starts from. */
export const READY: Stance = {
  pelvis: { at: [0.03, -0.02, 0], rot: [-0.35, 0, 0.04] },
  chest: [-0.15, 0.03, -0.03],
  head: [0.2, 0.04, 0],
  feet: {
    L: { at: [-0.13, 0, -0.1], heading: -0.3 },
    R: { at: [0.14, 0, 0.12], heading: 0.5 }
  },
  arms: {
    R: { wrist: [0.2, -0.16, -0.16], hand: [-0.75, -0.5, 0.15], elbow: [0.8, -0.6, 0.5], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.2, -0.3, -0.1], hand: [0, -1.4, 0], elbow: [-0.6, -0.6, 0.6], space: 'chest', shape: 'cup' }
  },
  support: true
};

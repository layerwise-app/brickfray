import * as THREE from 'three';
import { HANDLE } from './body-hands';
import { hprQuat, twoBoneIK, UP } from './ik';
import type { HandShape } from './parts';
import type { Pose } from './pose';
import { ANKLE_H, BALL, BONE, FOREARM, PELVIS_Y, SHIN, THIGH, type V3 } from './skeleton';
import { limb } from './reach';
import { SOCKET_L, SOCKET_R } from './upper';

/** Rotations are [heading, pitch, roll] in radians: heading turns right, pitch tips up, roll raises the right side. */
export interface Stance {
  /** Offset of the hips from standing at rest, and their rotation. */
  pelvis: { at: V3; rot: V3 };
  /** Model-space rotation of the chest (the waist takes part of it) and of the head (the neck takes part). */
  chest: V3;
  /** Share of the chest's turn the waist takes, 0…1 (0.45 by default); a stiff garment over both, like a vest, wants all of it. */
  waist?: number;
  head: V3;
  feet: { L: StanceFoot; R: StanceFoot };
  arms: { L: StanceArm; R: StanceArm };
  /** The left hand holds the gun's support grip instead of going to `arms.L`. */
  support?: boolean;
  /** Moves that hand off the gun's own support point, in the gun's axes (barrel -Z, top +Y), then turns it by [heading, pitch, roll]. */
  supportAt?: V3;
  supportTurn?: V3;
  /** The melee weapon shows in the left hand (give that hand the `hold` shape). */
  melee?: StanceMelee;
  /** Idle life, each 0…1+: breathing, weight shifting, looking around. */
  life?: { breath?: number; sway?: number; look?: number };
}

/** Moves laid over a held stance from outside it (the showroom's weight shifts and gestures); angles add to the stance's. */
export interface StanceLife {
  pelvis: V3;
  pelvisRot: V3;
  chest: V3;
  head: V3;
  /** Adjusts a hand's model-space wrist target and rotation before the arm reaches for it; the right hand comes first. */
  hand?(side: 'L' | 'R', wrist: THREE.Vector3, rotation: THREE.Quaternion, pose: Pose): void;
}

const STILL: StanceLife = { pelvis: [0, 0, 0], pelvisRot: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0] };

/** How the melee weapon sits in the fist; its handle runs across the palm. */
export interface StanceMelee {
  /** The end the head points out of: past the thumb or past the little finger. */
  head: 'thumb' | 'pinky';
  /** Turn about the handle in radians; at 0 the striking side faces the way the knuckles do. */
  twist?: number;
  /** How far up the handle from its grip point the hand holds it, in meters. */
  slide?: number;
  /** Tilt of the handle in the fist in radians: positive swings the head toward the fingertips. */
  cant?: number;
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
  /** A raised hand waves now and then: how far the forearm swings to each side, in radians. */
  wave?: number;
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
/** The gun's origin in the right hand; its support point is measured from there. */
const GRIP = new THREE.Matrix4().makeTranslation(SOCKET_R);
const feet = [new THREE.Vector3(), new THREE.Vector3()];

/** Poses the whole body in a held stance, alive with breathing, a slow weight shift and a wandering gaze. */
export function poseStance(pose: Pose, s: Stance, time: number, support: THREE.Matrix4 | null, life: StanceLife = STILL) {
  const breath = Math.sin((time * Math.PI * 2) / 3.8) * (s.life?.breath ?? 1);
  const sway = Math.sin(time * 0.5) * (s.life?.sway ?? 1);
  const look = s.life?.look ?? 1;

  const pp = pose.p[BONE.pelvis]!;
  const [lp, lr, lc, lh] = [life.pelvis, life.pelvisRot, life.chest, life.head];
  pp.set(s.pelvis.at[0] + 0.012 * sway + lp[0], PELVIS_Y + s.pelvis.at[1] + 0.003 * breath + lp[1], s.pelvis.at[2] + lp[2]);
  hprQuat(s.pelvis.rot[0] + lr[0], s.pelvis.rot[1] + lr[1], s.pelvis.rot[2] + 0.02 * sway + lr[2], pose.q[BONE.pelvis]!);
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
  hprQuat(s.chest[0] + lc[0], s.chest[1] + 0.014 * breath + lc[1], s.chest[2] - 0.015 * sway + lc[2], q1);
  q2.copy(pose.mq[BONE.pelvis]!).invert().multiply(q1);
  pose.q[BONE.spine]!.slerpQuaternions(ID, q2, s.waist ?? 0.45);
  pose.solve(BONE.spine);
  pose.setModelRotation(BONE.chest, q1);
  hprQuat(s.head[0] + 0.12 * look * Math.sin(time * 0.31 + 1) + lh[0], s.head[1] + 0.035 * look * Math.sin(time * 0.23) + lh[1], s.head[2] + lh[2], q1);
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

  arm(pose, 'R', s.arms.R, time, life);
  if (s.support && support) {
    // The gun hangs off the right hand; the left wrist goes where its support grip is.
    m1.compose(pose.mp[BONE.handR]!, pose.mq[BONE.handR]!, v3.set(1, 1, 1)).multiply(GRIP).multiply(support);
    m1.decompose(v1, q1, v3);
    if (s.supportAt) v1.add(v2.set(...s.supportAt).applyQuaternion(q1));
    if (s.supportTurn) q1.multiply(hprQuat(s.supportTurn[0], s.supportTurn[1], s.supportTurn[2], q2));
    v1.sub(v2.copy(SOCKET_L).applyQuaternion(q1));
    limb(pose, 'L', v1, v2.set(...s.arms.L.elbow), q1);
  } else arm(pose, 'L', s.arms.L, time, life);

  pose.s[BONE.mallet] = 0;
  pose.s[BONE.grenade] = 0;
  pose.solveChain('mallet', 'grenade');
}

function arm(pose: Pose, side: 'L' | 'R', a: StanceArm, time: number, life: StanceLife) {
  hprQuat(a.hand[0], a.hand[1], a.hand[2], q1);
  v1.set(...a.wrist);
  if (a.space) {
    const bone = SPACE[a.space];
    pose.toModel(bone, v1, v1);
    q1.premultiply(pose.mq[bone]!);
  }
  life.hand?.(side, v1, q1, pose);
  if (a.wave) {
    // The forearm swings about the palm's normal; the hand trails it a beat late and swings further, so the wrist
    // flaps, and it flexes back at each end of the swing.
    const swing = (t: number) => a.wave! * Math.max(0, Math.sin(t * 0.7)) * Math.sin(t * 5.5);
    const arm = swing(time);
    const hand = 1.7 * swing(time - 0.13);
    v3.set(1, 0, 0).applyQuaternion(q1);
    v2.set(0, 0, -1).applyQuaternion(q1);
    v1.addScaledVector(v2.crossVectors(v3, v2), arm * FOREARM);
    q1.premultiply(q2.setFromAxisAngle(v3, hand));
    q1.multiply(q2.setFromAxisAngle(v2.set(0, 1, 0), (0.35 * hand * hand) / a.wave!));
  }
  limb(pose, side, v1, v2.set(...a.elbow), q1);
}

/** Seats a melee model (origin at its grip, head up +Y, striking side -Z) in the left hand's `hold` socket. */
export function seatMelee(socket: THREE.Object3D, m: StanceMelee) {
  const up = m.head === 'thumb' ? 1 : -1;
  // Head past the little finger: half a turn about the fingers' direction, so the striking side still leads.
  socket.quaternion.setFromEuler(eul.set(-up * (m.cant ?? 0), 0, up > 0 ? 0 : Math.PI, 'XYZ')).multiply(q1.setFromAxisAngle(UP, m.twist ?? 0));
  socket.position.set(-HANDLE.at[0], HANDLE.at[1], HANDLE.at[2]).addScaledVector(v1.copy(UP).applyQuaternion(socket.quaternion), -(m.slide ?? 0));
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

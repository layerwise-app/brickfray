import * as THREE from 'three';
import { SIDEARMS, type WeaponId } from '../weapons/defs';
import { emptyAction, meleeAction, reloadAt, throwAction, type HandAction, type ReloadFrame } from './actions';
import { clamp, hprQuat, lookRotation, smooth, twoBoneIK, UP } from './ik';
import type { Pose } from './pose';
import { BONE, FOREARM, UPPER_ARM } from './skeleton';
import type { FidgetFrame, Style } from './style';
import type { AnimState } from './types';

/** Grip point in right-hand space and handguard point in left-hand space (both hands use weapon axes). */
export const SOCKET_R = new THREE.Vector3(-0.02, 0.03, -0.07);
export const SOCKET_L = new THREE.Vector3(0.035, 0.045, -0.07);
const DEFAULT_SUPPORT = new THREE.Matrix4().makeTranslation(0, 0.025, -0.22);
/** Without a support node the off hand cups the pistol grip from below-left. */
const PISTOL_SUPPORT = new THREE.Matrix4().makeTranslation(-0.035, -0.035, -0.015);

export interface UpperInput {
  state: AnimState;
  time: number;
  ads: number;
  sprint: number;
  crouch: number;
  moving: number;
  run: number;
  air: number;
  phase: number;
  gaitYaw: number;
  gaitRoll: number;
  /** Unit movement direction in model space, scaled by lean strength. */
  lean: THREE.Vector3;
  landing: number;
  style: Style;
  fidget: FidgetFrame;
  support: THREE.Matrix4 | null;
}

interface GunPose {
  pos: [number, number, number];
  rot: [number, number, number];
}
const RIFLE = {
  hip: { pos: [0.12, -0.085, -0.31], rot: [0, -0.03, 0] },
  ads: { pos: [0.045, 0.112, -0.28], rot: [0, 0, 0] },
  sprint: { pos: [0.05, -0.2, -0.26], rot: [-0.85, -0.42, -0.55] },
  lowered: { pos: [0.2, -0.3, -0.14], rot: [0.15, -1.0, 0.25] }
} satisfies Record<string, GunPose>;
const PISTOL = {
  hip: { pos: [0.06, -0.06, -0.4], rot: [0, -0.02, 0] },
  ads: { pos: [0.035, 0.125, -0.44], rot: [0, 0, 0] },
  sprint: { pos: [0.14, -0.24, -0.2], rot: [-0.2, -0.9, 0] },
  lowered: { pos: [0.2, -0.28, -0.16], rot: [0.1, -1.1, 0.1] }
} satisfies Record<string, GunPose>;
const KICK: Record<WeaponId, number> = { ar: 0.4, pistol: 0.45, shotgun: 1, sniper: 1.1, nailer: 0.3, pulse: 0.45, harpoon: 0.9, cannon: 0.9, buzzer: 0.35 };

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const m1 = new THREE.Matrix4();
const eul = new THREE.Euler();
const qy = new THREE.Quaternion();
const ID = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);

/** Model-space transform of the gun grip, written each frame for the support hand and sockets. */
export const gun = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
const aim = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
const action = emptyAction();
const fx = emptyAction();
const reload: ReloadFrame = { tilt: 0, a: 0, b: 0, mix: 0, drop: 0, weight: 0 };

/** Rotation that tilts +Y toward horizontal direction `dir` by |dir| radians. */
function tilt(dir: THREE.Vector3, out: THREE.Quaternion) {
  const a = Math.hypot(dir.x, dir.z);
  if (a < 1e-5) return out.identity();
  v3.set(dir.z, 0, -dir.x).divideScalar(a);
  return out.setFromAxisAngle(v3, a);
}

function blendPose(a: GunPose, b: GunPose, t: number, pos: THREE.Vector3, rot: [number, number, number]) {
  pos.set(a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t);
  for (let i = 0; i < 3; i++) rot[i] = a.rot[i]! + (b.rot[i]! - a.rot[i]!) * t;
}

function blendToward(pos: THREE.Vector3, rot: [number, number, number], b: GunPose, t: number) {
  if (t <= 0) return;
  pos.set(pos.x + (b.pos[0] - pos.x) * t, pos.y + (b.pos[1] - pos.y) * t, pos.z + (b.pos[2] - pos.z) * t);
  for (let i = 0; i < 3; i++) rot[i] = rot[i]! + (b.rot[i]! - rot[i]!) * t;
}

/** Torso aim, head stabilization, gun placement, two-hand IK and actions. */
export function poseUpper(pose: Pose, I: UpperInput) {
  const s = I.state;
  const st = I.style;
  const f = I.fidget;
  const t = I.time;
  const pitch = clamp(s.aimPitch, -1.05, 1.05);
  const kickT = s.sinceShot < 0.5 ? Math.exp(-s.sinceShot / 0.07) * smooth(s.sinceShot, 0, 0.015) * KICK[s.weapon] : 0;
  const hurtW = s.sinceHurt < 0.7 ? Math.exp(-s.sinceHurt / 0.14) * smooth(s.sinceHurt, 0, 0.03) : 0;
  const breath = Math.sin((t * Math.PI * 2) / 3.6);

  if (s.melee >= 0) meleeAction(s.melee, action);
  else if (s.grenade >= 0) throwAction(s.grenade, action);
  else action.weight = action.lower = action.twist = action.bend = action.mallet = action.grenade = 0;
  if (s.reload >= 0) reloadAt(s.reload, reload);
  else reload.tilt = reload.weight = 0;
  const busy = Math.max(action.weight, reload.weight);
  const fid = f.handW * (1 - busy);

  // Chest: bladed toward the gun side, counter-rotating the hips, leaning with motion.
  const blade = -0.3 - 0.06 * I.ads + 0.16 * I.sprint;
  const heading = blade - I.gaitYaw * 0.8 + action.twist + f.chest[1];
  const swagger = Math.sin(I.phase * Math.PI * 2) * 0.035 * st.shoulderRoll * I.moving * (1 - I.run * 0.5);
  const chestPitch = pitch * 0.42 + st.posture - st.lean - 0.5 * I.crouch - 0.1 * I.sprint + 0.012 * breath * (1 - I.moving) + 0.12 * kickT + action.bend + f.chest[0] - I.landing * 0.6;
  const chestRoll = -I.gaitRoll * 0.6 + swagger + f.chest[2];
  v1.copy(I.lean);
  if (hurtW > 0) v1.add(v2.set(-s.hurtDirection.x, 0, s.hurtDirection.z).normalize().multiplyScalar(0.32 * hurtW));
  tilt(v1, q1).multiply(hprQuat(heading, chestPitch, chestRoll, q2));
  pose.solve(BONE.pelvis);
  const pelvisQ = pose.mq[BONE.pelvis]!;
  qa.copy(pelvisQ).invert().multiply(q1);
  pose.q[BONE.spine]!.slerpQuaternions(ID, qa, 0.45);
  pose.solve(BONE.spine);
  pose.setModelRotation(BONE.chest, q1);

  // Head: aims, stays level, tilts onto the stock when aiming down sights.
  const headPitch = pitch * 0.92 - st.hunch * 0.5 + f.head[0] - 0.12 * I.ads;
  hprQuat(f.head[1] + 0.05 * I.ads, headPitch, 0.14 * I.ads + f.head[2], q2);
  if (hurtW > 0) q2.premultiply(tilt(v2.set(-s.hurtDirection.x, 0, s.hurtDirection.z).normalize().multiplyScalar(0.35 * hurtW), q3));
  qa.copy(pose.mq[BONE.chest]!).invert().multiply(q2);
  pose.q[BONE.neck]!.slerpQuaternions(ID, qa, 0.4).multiply(q3.setFromAxisAngle(X, -st.hunch));
  pose.solve(BONE.neck);
  pose.setModelRotation(BONE.head, q2);
  pose.solve(BONE.hat);
  pose.p[BONE.hat]!.y = 0.2 + f.hat[0];
  pose.q[BONE.hat]!.setFromAxisAngle(X, f.hat[1]);
  pose.solve(BONE.hat);

  // Clavicles: breathing shrug, support shoulder forward.
  const shrug = 0.025 * breath * (1 - I.moving) + 0.06 * I.ads;
  pose.q[BONE.clavL]!.setFromEuler(eul.set(0, -0.22 - 0.08 * I.ads, -shrug, 'YXZ'));
  pose.q[BONE.clavR]!.setFromEuler(eul.set(0, 0.06, shrug, 'YXZ'));
  pose.solveChain('clavL', 'clavR', 'upperArmL', 'upperArmR');

  // Gun: an aim frame at the shoulder center, pitched with the look.
  const P = SIDEARMS.has(s.weapon) ? PISTOL : RIFLE;
  const rot: [number, number, number] = [0, 0, 0];
  const pos = v1;
  blendPose(P.hip, P.ads, I.ads, pos, rot);
  const lower = Math.max(action.lower, f.gunDrop * (1 - busy));
  blendToward(pos, rot, P.sprint, I.sprint * (1 - I.ads));
  blendToward(pos, rot, P.lowered, lower * 0.85);
  const sway = 1 - I.ads * 0.85;
  const bobY = Math.sin(I.phase * Math.PI * 4 - 0.6) * 0.012 * I.moving * (1 + I.run);
  pos.y += bobY * sway + 0.004 * breath * (1 - I.moving) + 0.03 * I.air - 0.04 * I.landing;
  pos.x += Math.sin(I.phase * Math.PI * 2) * 0.008 * I.moving * sway;
  pos.z += 0.06 * kickT;
  pos.y += 0.015 * kickT;
  rot[1] += 0.17 * kickT + 0.006 * Math.sin(t * 1.3) * sway;
  rot[0] += 0.03 * Math.sin(I.phase * Math.PI * 2) * I.moving * sway + 0.008 * Math.sin(t * 0.9) * sway;
  if (reload.tilt > 0) {
    pos.add(v2.set(-0.05, -0.06, 0.07).multiplyScalar(reload.tilt));
    rot[0] += 0.18 * reload.tilt;
    rot[1] += 0.32 * reload.tilt;
    rot[2] -= 0.7 * reload.tilt;
  }
  const chestM = pose.mq[BONE.chest]!;
  pose.toModel(BONE.chest, v2.set(0, 0.19, 0), aim.pos);
  aim.q.copy(hprQuat(0, pitch * (1 - 0.75 * I.sprint) * (1 - lower * 0.7), 0, q1));
  gun.pos.copy(pos).applyQuaternion(aim.q).add(aim.pos);
  gun.q.copy(aim.q).multiply(hprQuat(rot[0], rot[1], rot[2], q2));

  // Right arm carries the gun: wrist = grip minus the socket offset.
  const elbows = st.elbows;
  v2.copy(SOCKET_R).applyQuaternion(gun.q);
  v1.copy(gun.pos).sub(v2);
  v2.set(0.55 * elbows, -1, 0.3).applyQuaternion(chestM);
  limb(pose, 'R', v1, v2, gun.q);
  // Actual gun after a possibly clamped reach, so the support hand meets the real model.
  gun.q.copy(pose.mq[BONE.handR]!);
  gun.pos.copy(SOCKET_R).applyQuaternion(gun.q).add(pose.mp[BONE.handR]!);

  // Left hand: support grip, blended toward an action or fidget target.
  m1.compose(gun.pos, gun.q, v3.set(1, 1, 1)).multiply(I.support ?? (SIDEARMS.has(s.weapon) ? PISTOL_SUPPORT : DEFAULT_SUPPORT));
  m1.decompose(v1, qa, v3);
  const supportPos = v1;
  const supportQ = qa;
  const wristL = v2.copy(SOCKET_L).applyQuaternion(supportQ).multiplyScalar(-1).add(supportPos);
  const handQ = qb.copy(supportQ);
  if (reload.weight > 0) {
    const pa = reloadPoint(pose, reload.a, supportPos, v3);
    const ax = pa.x, ay = pa.y, az = pa.z;
    const pb = reloadPoint(pose, reload.b, supportPos, v3);
    pb.set(ax + (pb.x - ax) * reload.mix, ay + (pb.y - ay) * reload.mix, az + (pb.z - az) * reload.mix);
    pb.y += reload.drop;
    const atPouch = Math.max(reload.a === 2 ? 1 - reload.mix : 0, reload.b === 2 ? reload.mix : 0);
    q3.copy(supportQ).slerp(hprQuat(-0.4, -1.2, 0.3, q2).premultiply(yawOf(pose.mq[BONE.pelvis]!)), atPouch);
    pb.sub(v1.copy(SOCKET_L).applyQuaternion(q3));
    wristL.lerp(pb, reload.weight);
    handQ.slerp(q3, reload.weight);
  }
  if (action.weight > 0) {
    fx.pos.copy(action.pos).add(aim.pos);
    lookRotation(action.forward, action.up, q3);
    wristL.lerp(fx.pos.sub(v1.copy(SOCKET_L).applyQuaternion(q3)), action.weight);
    handQ.slerp(q3, action.weight);
  }
  if (fid > 0) {
    const space = f.handSpace === 'head' ? BONE.head : BONE.chest;
    pose.toModel(space, v3.set(...f.hand), fx.pos);
    lookRotation(v1.set(0.3, 0.7, -0.6), UP, q3);
    wristL.lerp(fx.pos.sub(v1.copy(SOCKET_L).applyQuaternion(q3)), fid);
    handQ.slerp(q3, fid);
  }
  v1.set(-0.35 * elbows, -1, 0.15 + 0.6 * action.weight).applyQuaternion(chestM);
  limb(pose, 'L', wristL, v1, handQ);

  pose.s[BONE.mallet] = action.mallet;
  pose.s[BONE.grenade] = action.grenade;
  pose.solveChain('mallet', 'grenade');
}

function yawOf(q: THREE.Quaternion) {
  v3.set(0, 0, -1).applyQuaternion(q);
  return qy.setFromAxisAngle(UP, Math.atan2(-v3.x, -v3.z));
}

const mid = new THREE.Vector3();
const end = new THREE.Vector3();
const qu = new THREE.Quaternion();
const ql = new THREE.Quaternion();

function limb(pose: Pose, side: 'L' | 'R', wrist: THREE.Vector3, poleDir: THREE.Vector3, hand: THREE.Quaternion) {
  const ua = BONE[`upperArm${side}`];
  const fa = BONE[`forearm${side}`];
  const h = BONE[`hand${side}`];
  pose.solve(ua);
  twoBoneIK(pose.mp[ua]!, wrist, UPPER_ARM, FOREARM, poleDir, false, qu, ql, mid, end);
  pose.setModelRotation(ua, qu);
  pose.setModelRotation(fa, ql);
  pose.setModelRotation(h, hand);
}

/** Reload waypoints: 0 support grip, 1 magazine well under the receiver, 2 the left hip pouch. */
function reloadPoint(pose: Pose, which: number, support: THREE.Vector3, out: THREE.Vector3) {
  if (which === 0) return out.copy(support);
  if (which === 1) return out.set(0.0, -0.1, -0.11).applyQuaternion(gun.q).add(gun.pos);
  return pose.toModel(BONE.pelvis, out.set(-0.2, 0.02, -0.07), out);
}

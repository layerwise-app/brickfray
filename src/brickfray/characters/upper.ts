import * as THREE from 'three';
import { SIDEARMS, type WeaponId } from '../weapons/defs';
import { AT, emptyAction, emptyReload, meleeAction, reloadAt, throwAction, type Carried, type MagazineState, type ReloadFamily } from './actions';
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
  /** The gun's support grip, magazine hold and muzzle relative to its grip, when the model has them. */
  support: THREE.Matrix4 | null;
  magHold: THREE.Matrix4 | null;
  muzzle: THREE.Matrix4 | null;
  /** The reload being played or blended out of: its family, progress 0…1 and weight. */
  reload: { family: ReloadFamily; progress: number; blend: number };
  /** Throw progress as played (-1 none): the wind-up plays out even when cooking starts at its held pose. */
  grenade: number;
  /** 0 just fired … 1 settled at low ready between fights. */
  ready: number;
  /** Per-player phase for small idle differences (0 = none). */
  seed: number;
}

interface GunPose {
  pos: [number, number, number];
  rot: [number, number, number];
}
const RIFLE = {
  hip: { pos: [0.12, -0.085, -0.31], rot: [0, -0.03, 0] },
  ads: { pos: [0.045, 0.09, -0.34], rot: [0, 0, 0] },
  ready: { pos: [0.09, -0.2, -0.26], rot: [-0.42, -0.8, 0.12] },
  sprint: { pos: [0.13, -0.33, -0.12], rot: [-0.62, -0.95, -0.35] },
  lowered: { pos: [0.2, -0.3, -0.14], rot: [0.15, -1.0, 0.25] }
} satisfies Record<string, GunPose>;
const PISTOL = {
  hip: { pos: [0.06, -0.06, -0.4], rot: [0, -0.02, 0] },
  ads: { pos: [0.035, 0.125, -0.44], rot: [0, 0, 0] },
  ready: { pos: [0.03, -0.27, -0.28], rot: [-0.12, -0.78, 0] },
  sprint: { pos: [0.16, -0.36, -0.12], rot: [-0.2, -1.15, 0] },
  lowered: { pos: [0.2, -0.28, -0.16], rot: [0.1, -1.1, 0.1] }
} satisfies Record<string, GunPose>;
/** The Nailer has no stock and is a hand's length long: shouldered at the eye its nose sits at the face, so it is held out at arm's length. */
const HELD_OUT = new Set<WeaponId>(['nailer']);
const NAILER_ADS: GunPose = { pos: [0.05, -0.08, -0.48], rot: [0, 0, 0] };
/** Shouldered long guns sit right of and under the eye line by the stock's drop and the wearer's helmet, so no stock sinks into a cheek or visor. */
const ADS_OFFSET: Partial<Record<WeaponId, [number, number]>> = { ar: [0.03, -0.02], shotgun: [0.055, -0.06], harpoon: [0.035, -0.04], sniper: [0.03, -0.025], pulse: [0.075, -0.09] };
const KICK: Record<WeaponId, number> = { ar: 0.4, pistol: 0.45, shotgun: 1, sniper: 1.1, nailer: 0.3, pulse: 0.45, harpoon: 0.9, cannon: 0.9, buzzer: 0.35 };

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const v5 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const qc = new THREE.Quaternion();
const qd = new THREE.Quaternion();
const m1 = new THREE.Matrix4();
const eul = new THREE.Euler();
const qy = new THREE.Quaternion();
const ID = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);

/** Model-space transform of the gun grip, written each frame for the support hand and sockets. */
export const gun = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
const aim = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
/** What the left hand holds this frame, for the rig's props: a reload item, the gun's own magazine, a grenade (0…1). */
export const carry: { item: Carried; magazine: MagazineState; grenade: number } = { item: 'none', magazine: 'seated', grenade: 0 };
const action = emptyAction();
const fx = emptyAction();
const reload = emptyReload();

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
  else if (I.grenade >= 0) throwAction(I.grenade, action);
  else action.weight = action.lower = action.twist = action.bend = action.mallet = action.grenade = 0;
  const reloading = I.reload.blend > 0.004;
  if (reloading) {
    reloadAt(I.reload.family, I.reload.progress, reload);
    reload.weight *= I.reload.blend;
  } else {
    reload.weight = 0;
    reload.body.fill(0);
  }
  const held = reloading && I.reload.blend > 0.5;
  carry.item = held ? reload.carried : 'none';
  carry.magazine = held ? reload.magazine : 'seated';
  carry.grenade = action.grenade;
  const busy = Math.max(action.weight, reload.weight);
  const fid = f.handW * (1 - busy);
  // Reloading, the head drops to watch the hands and the chest hunches over the gun: the pose reads from across a room.
  const watch = reload.weight * (1 - I.ads);
  const rb = reload.body;

  // Chest: bladed toward the gun side, counter-rotating the hips, leaning with motion.
  // Shouldering a long gun turns the gun shoulder back and the support shoulder forward, so neither arm folds up.
  const shoulder = SIDEARMS.has(s.weapon) || HELD_OUT.has(s.weapon) ? 0 : I.ads;
  const blade = -0.3 - 0.06 * I.ads + 0.55 * shoulder + 0.16 * I.sprint;
  const heading = blade - I.gaitYaw * 0.8 + action.twist + f.chest[1] + rb[0]! * watch;
  const swagger = Math.sin(I.phase * Math.PI * 2) * 0.035 * st.shoulderRoll * I.moving * (1 - I.run * 0.5);
  const chestPitch = pitch * 0.42 + st.posture - st.lean - 0.5 * I.crouch - 0.1 * I.sprint + 0.012 * breath * (1 - I.moving) + 0.12 * kickT + action.bend + f.chest[0] - I.landing * 0.6 - (0.05 + rb[1]!) * watch;
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
  const headPitch = pitch * 0.92 * (1 - 0.5 * watch) - st.hunch * 0.5 + f.head[0] - 0.12 * I.ads - 0.08 * shoulder - (0.2 + rb[3]!) * watch;
  const look = I.seed ? 0.1 * Math.sin(t * 0.31 + I.seed * 2.3) * I.ready * (1 - busy) : 0;
  hprQuat(f.head[1] + 0.05 * I.ads + (rb[2]! - 0.08) * watch + look, headPitch, 0.14 * I.ads + f.head[2] + 0.1 * watch, q2);
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
  pose.q[BONE.clavL]!.setFromEuler(eul.set(0, -0.22 - 0.08 * I.ads - 0.1 * shoulder, -shrug, 'YXZ'));
  pose.q[BONE.clavR]!.setFromEuler(eul.set(0, 0.06 - 0.24 * shoulder, shrug, 'YXZ'));
  pose.solveChain('clavL', 'clavR', 'upperArmL', 'upperArmR');

  // Gun: an aim frame at the shoulder center, pitched with the look.
  const P = SIDEARMS.has(s.weapon) ? PISTOL : RIFLE;
  const rot: [number, number, number] = [0, 0, 0];
  const pos = v1;
  blendPose(P.hip, HELD_OUT.has(s.weapon) ? NAILER_ADS : P.ads, I.ads, pos, rot);
  const adsOffset = ADS_OFFSET[s.weapon];
  if (adsOffset) pos.set(pos.x + adsOffset[0] * I.ads, pos.y + adsOffset[1] * I.ads, pos.z);
  const lower = Math.max(action.lower, f.gunDrop * (1 - busy));
  blendToward(pos, rot, P.sprint, I.sprint * (1 - I.ads));
  blendToward(pos, rot, P.lowered, lower * 0.85);
  // Between fights the gun rests at low ready: muzzle down in front of the feet and turned in across the body, elbows
  // in. Seen from the front it reads as a gun at rest instead of a barrel pointed at the viewer or past him.
  const ready = I.ready * (1 - I.ads) * (1 - I.sprint) * (1 - busy);
  blendToward(pos, rot, P.ready, ready);
  const sway = 1 - I.ads * 0.85;
  if (I.seed) {
    rot[0] += (0.035 * Math.sin(t * 0.41 + I.seed * 7) + 0.015 * Math.sin(t * 1.07 + I.seed * 3)) * sway;
    rot[1] += 0.025 * Math.sin(t * 0.53 + I.seed * 5) * sway;
  }
  const bobY = Math.sin(I.phase * Math.PI * 4 - 0.6) * 0.012 * I.moving * (1 + I.run);
  pos.y += bobY * sway + 0.004 * breath * (1 - I.moving) + 0.03 * I.air - 0.04 * I.landing;
  pos.x += Math.sin(I.phase * Math.PI * 2) * 0.008 * I.moving * sway;
  pos.z += 0.06 * kickT;
  pos.y += 0.015 * kickT;
  rot[1] += 0.17 * kickT + 0.006 * Math.sin(t * 1.3) * sway;
  rot[0] += 0.03 * Math.sin(I.phase * Math.PI * 2) * I.moving * sway + 0.008 * Math.sin(t * 0.9) * sway;
  if (reloading) {
    const g = reload.gun;
    const w = I.reload.blend;
    pos.x += g[0]! * w;
    pos.y += g[1]! * w;
    pos.z += g[2]! * w;
    for (let i = 0; i < 3; i++) rot[i]! += g[3 + i]! * w;
  }
  const chestM = pose.mq[BONE.chest]!;
  pose.toModel(BONE.chest, v2.set(0, 0.19, 0), aim.pos);
  aim.q.copy(hprQuat(0, pitch * (1 - 0.75 * I.sprint) * (1 - lower * 0.7) * (1 - 0.5 * ready), 0, q1));
  gun.pos.copy(pos).applyQuaternion(aim.q).add(aim.pos);
  gun.q.copy(aim.q).multiply(hprQuat(rot[0], rot[1], rot[2], q2));

  // Right arm carries the gun: wrist = grip minus the socket offset.
  const elbows = st.elbows;
  v2.copy(SOCKET_R).applyQuaternion(gun.q);
  v1.copy(gun.pos).sub(v2);
  const tuck = Math.max(ready, I.sprint);
  v2.set((0.55 + 0.4 * shoulder) * elbows * (1 - 0.5 * tuck), -1 + 0.45 * shoulder, 0.3 + 0.15 * shoulder + 0.25 * tuck).applyQuaternion(chestM);
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
    const target = reloadPlace(pose, I, reload.a, supportPos, supportQ, v4, qc);
    target.lerp(reloadPlace(pose, I, reload.b, supportPos, supportQ, v5, qd), reload.mix);
    target.add(v3.set(0, reload.drop, reload.slide).applyQuaternion(gun.q));
    q3.copy(qc).slerp(qd, reload.mix);
    target.sub(v3.copy(SOCKET_L).applyQuaternion(q3));
    wristL.lerp(target, reload.weight);
    handQ.slerp(q3, reload.weight);
  }
  if (action.weight > 0) {
    fx.pos.copy(action.pos).add(aim.pos);
    wristL.lerp(fx.pos.sub(v1.copy(SOCKET_L).applyQuaternion(action.q)), action.weight);
    handQ.slerp(action.q, action.weight);
  }
  if (fid > 0) {
    const space = f.handSpace === 'head' ? BONE.head : BONE.chest;
    pose.toModel(space, v3.set(...f.hand), fx.pos);
    lookRotation(v1.set(0.3, 0.7, -0.6), UP, q3);
    wristL.lerp(fx.pos.sub(v1.copy(SOCKET_L).applyQuaternion(q3)), fid);
    handQ.slerp(q3, fid);
  }
  v1.set(-0.35 * elbows * (1 - 0.5 * tuck), -1, 0.15 + 0.2 * tuck).applyQuaternion(chestM).normalize();
  if (action.weight > 0) v1.lerp(v3.copy(action.pole).normalize(), action.weight);
  limb(pose, 'L', wristL, v1, handQ);

  pose.s[BONE.mallet] = action.mallet;
  pose.s[BONE.grenade] = 0;
  pose.solveChain('mallet', 'grenade');
}

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
function reloadPlace(pose: Pose, I: UpperInput, place: number, support: THREE.Vector3, supportQ: THREE.Quaternion, out: THREE.Vector3, q: THREE.Quaternion) {
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

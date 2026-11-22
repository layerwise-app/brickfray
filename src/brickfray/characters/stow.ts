import * as THREE from 'three';
import { SIDEARMS, type WeaponId } from '../weapons/defs';
import { lookRotation, smooth } from './ik';
import type { BakedCharacter } from './parts';
import type { Pose } from './pose';
import { BONE } from './skeleton';

/** Where a gun not in hand is carried: a long gun slung across the back, a sidearm in a holster on the right hip. */
export type StowPlace = 'back' | 'hip';

export const stowPlaceOf = (weapon: WeaponId): StowPlace => (SIDEARMS.has(weapon) ? 'hip' : 'back');

/** The bone a stowed gun rides on. */
export const STOW_BONE: Record<StowPlace, number> = { back: BONE.chest, hip: BONE.pelvis };

/** How far out from the bone each place sits on this figure, so the gun clears its back kit and its hip. */
export interface StowFit {
  back: number;
  hip: number;
}

/** Barrel down to the left across the back: the stock stands above the right shoulder, the muzzle hangs by the left hip. */
const SLING_DIR = new THREE.Vector3(-0.42, -0.9, 0).normalize();
const SLING_GRIP = new THREE.Vector2(0.11, 0.17);
/** Holster: grip at the right hip, barrel down and a little forward, the gun's top to the front. */
const HOLSTER_GRIP = new THREE.Vector2(-0.03, 0.035);
const AXIS_X = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3();
const AXIS_Z = new THREE.Vector3();
const basis = new THREE.Matrix4();

const fits = new WeakMap<THREE.BufferGeometry, StowFit>();

/**
 * Measures the figure's back along the sling line and its right hip beside the holster in the rest pose (chest and
 * pelvis are unrotated there), so a slung gun lies on the tank, shield or cape instead of sinking into it.
 */
export function fitStow(baked: BakedCharacter, restModel: THREE.Vector3[]): StowFit {
  const cached = fits.get(baked.main);
  if (cached) return cached;
  const chest = restModel[BONE.chest]!;
  const pelvis = restModel[BONE.pelvis]!;
  const backBones = new Set([BONE.chest, BONE.spine, BONE.pelvis, BONE.neck, BONE.dangleBack, BONE.clavL, BONE.clavR]);
  const hipBones = new Set([BONE.pelvis, BONE.spine, BONE.thighR, BONE.dangleHip]);
  let back = 0.12;
  let hip = 0.17;
  const v = new THREE.Vector3();
  for (const piece of baked.pieces) {
    const onBack = backBones.has(piece.bone);
    const onHip = hipBones.has(piece.bone);
    if (!onBack && !onHip) continue;
    const position = piece.geometry.getAttribute('position');
    const origin = restModel[piece.bone]!;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).add(piece.center).add(origin);
      if (onBack) {
        const x = v.x - chest.x - SLING_GRIP.x;
        const y = v.y - chest.y - SLING_GRIP.y;
        const t = THREE.MathUtils.clamp(x * SLING_DIR.x + y * SLING_DIR.y, -0.3, 0.75);
        if (Math.hypot(x - SLING_DIR.x * t, y - SLING_DIR.y * t) < 0.07) back = Math.max(back, v.z - chest.z);
      }
      if (onHip) {
        const y = v.y - pelvis.y;
        const z = v.z - pelvis.z;
        if (y > -0.3 && y < 0.03 && z > -0.1 && z < 0.12 && v.x > 0) hip = Math.max(hip, v.x - pelvis.x);
      }
    }
  }
  const fit = { back: back + 0.032, hip: hip + 0.022 };
  fits.set(baked.main, fit);
  return fit;
}

/** A stowed gun's grip (the model's origin) and turn in its bone's space. */
export function stowTransform(place: StowPlace, fit: StowFit, pos: THREE.Vector3, q: THREE.Quaternion) {
  if (place === 'back') {
    pos.set(SLING_GRIP.x, SLING_GRIP.y, fit.back);
    AXIS_Z.copy(SLING_DIR).negate();
    AXIS_X.set(0, 0, 1);
  } else {
    pos.set(fit.hip, HOLSTER_GRIP.x, HOLSTER_GRIP.y);
    AXIS_Z.set(0, 1, 0.12).normalize();
    AXIS_X.set(1, 0, 0);
  }
  AXIS_Y.crossVectors(AXIS_Z, AXIS_X);
  return q.setFromRotationMatrix(basis.makeBasis(AXIS_X, AXIS_Y, AXIS_Z));
}

/** Share of a switch (0.5…1 is the draw) at which the hand closes on the new gun: later when it first has to travel from the old gun's place. */
export function swapGrab(from: StowPlace | null, to: StowPlace) {
  return from && from !== to ? 0.66 : 0.5;
}

/** The swap's effect on the rest of the upper body. */
export interface SwapFrame {
  /** 0…1: the gun hand is away from the aim pose. */
  weight: number;
  /** 0…1: how much of that is the reach over the shoulder to the back. */
  back: number;
  /** 0…1: the support hand is off the gun. */
  free: number;
}

const p0 = new THREE.Vector3();
const p1 = new THREE.Vector3();
const c = new THREE.Vector3();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const qm = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const tmp = new THREE.Vector3();
/**
 * Halfway points of each place's arc in chest space. To the back the muzzle dips and the gun is lifted hanging down
 * the right side to the front of the shoulder, then carried up over it so it swings in behind; to the hip the gun
 * comes down and out by the right thigh.
 */
const VIA: Record<StowPlace, { at: THREE.Vector3; barrel: THREE.Vector3; up: THREE.Vector3 }> = {
  back: { at: new THREE.Vector3(0.24, 0.08, -0.16), barrel: new THREE.Vector3(0.1, -1, 0.25), up: new THREE.Vector3(1, 0, 0) },
  hip: { at: new THREE.Vector3(0.3, -0.28, -0.16), barrel: new THREE.Vector3(0.1, -0.75, -0.65), up: new THREE.Vector3(0, 0.65, -0.75) }
};

/** Model-space grip and turn of a gun stowed at `place` in the current pose. */
function stowed(pose: Pose, place: StowPlace, fit: StowFit, pos: THREE.Vector3, q: THREE.Quaternion) {
  const bone = STOW_BONE[place];
  stowTransform(place, fit, pos, q);
  pose.toModel(bone, pos, pos);
  q.premultiply(pose.mq[bone]!);
}

/** The arc's halfway point in model space. */
function via(pose: Pose, place: StowPlace, pos: THREE.Vector3, q: THREE.Quaternion) {
  const v = VIA[place];
  pose.toModel(BONE.chest, pos.copy(v.at), pos);
  lookRotation(tmp.copy(v.barrel), v.up, q);
  return q.premultiply(pose.mq[BONE.chest]!);
}

/** Carries the gun between the aim pose (`pos`, `q`) and a place along an arc, `w` = 0 at the aim pose. */
function arc(pose: Pose, place: StowPlace, fit: StowFit, w: number, pos: THREE.Vector3, q: THREE.Quaternion) {
  stowed(pose, place, fit, p1, q1);
  via(pose, place, c, qm);
  p0.copy(pos);
  q0.copy(q);
  const a = (1 - w) * (1 - w);
  const b = 2 * (1 - w) * w;
  pos.copy(p0).multiplyScalar(a).addScaledVector(c, b).addScaledVector(p1, w * w);
  if (w < 0.5) q.copy(q0).slerp(qm, w * 2);
  else q.copy(qm).slerp(q1, w * 2 - 1);
}

/**
 * The shape of a weapon switch, from `swap` alone. 0…0.5: the gun in hand goes to its place (`place`); 0.5…1: the
 * empty hand travels there from the place of the gun just put away (`from`) if that is elsewhere, takes the gun and
 * brings it up into the aim pose.
 */
export function swapShape(swap: number, place: StowPlace, from: StowPlace | null, out: SwapFrame) {
  out.weight = out.back = out.free = 0;
  if (swap < 0) return out;
  out.free = smooth(swap, 0, 0.14) * (1 - smooth(swap, 0.86, 1));
  const grab = swap < 0.5 ? 0.5 : swapGrab(from, place);
  if (swap >= 0.5 && swap < grab && from) {
    const u = smooth(swap, 0.5, grab);
    out.weight = 1;
    out.back = (from === 'back' ? 1 - u : 0) + (place === 'back' ? u : 0);
    return out;
  }
  out.weight = swap < 0.5 ? smooth(swap, 0, 0.5) : 1 - smooth(swap, grab, 1);
  out.back = place === 'back' ? out.weight : 0;
  return out;
}

/** Moves the gun hand's grip (`pos`, `q`, the aim pose on entry) along the switch described by `swapShape`. */
export function swapGun(pose: Pose, swap: number, place: StowPlace, from: StowPlace | null, fit: StowFit, pos: THREE.Vector3, q: THREE.Quaternion) {
  if (swap < 0) return;
  const grab = swap < 0.5 ? 0.5 : swapGrab(from, place);
  if (swap >= 0.5 && swap < grab && from) {
    const u = smooth(swap, 0.5, grab);
    stowed(pose, from, fit, p0, q0);
    stowed(pose, place, fit, p1, qb);
    pos.lerpVectors(p0, p1, u);
    // Between the shoulder and the hip the hand swings out to the side, clear of the arm and the belt.
    pose.toModel(BONE.chest, tmp.set(0.12, 0, -0.12), c).sub(pose.mp[BONE.chest]!);
    pos.addScaledVector(c, Math.sin(Math.PI * u));
    q.copy(q0).slerp(qb, u);
    return;
  }
  arc(pose, place, fit, swap < 0.5 ? smooth(swap, 0, 0.5) : 1 - smooth(swap, grab, 1), pos, q);
}

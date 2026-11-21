import * as THREE from 'three';
import { TORSO_DEPTH } from './parts';

export const BONES = [
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'hat',
  'clavL',
  'upperArmL',
  'forearmL',
  'handL',
  'clavR',
  'upperArmR',
  'forearmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'toeL',
  'thighR',
  'shinR',
  'footR',
  'toeR',
  'mallet',
  'grenade',
  'dangleHead',
  'dangleBack',
  'dangleHip'
] as const;

export type BoneName = (typeof BONES)[number];
export type V3 = [number, number, number];

export const BONE = Object.fromEntries(BONES.map((name, i) => [name, i])) as Record<BoneName, number>;

export const PARENT: Record<BoneName, BoneName | null> = {
  pelvis: null,
  spine: 'pelvis',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  hat: 'head',
  clavL: 'chest',
  upperArmL: 'clavL',
  forearmL: 'upperArmL',
  handL: 'forearmL',
  clavR: 'chest',
  upperArmR: 'clavR',
  forearmR: 'upperArmR',
  handR: 'forearmR',
  thighL: 'pelvis',
  shinL: 'thighL',
  footL: 'shinL',
  toeL: 'footL',
  thighR: 'pelvis',
  shinR: 'thighR',
  footR: 'shinR',
  toeR: 'footR',
  mallet: 'handL',
  grenade: 'handL',
  dangleHead: 'head',
  dangleBack: 'chest',
  dangleHip: 'pelvis'
};

/** Limb lengths in meters; the animator's IK uses the same numbers. */
export const UPPER_ARM = 0.28;
export const FOREARM = 0.265;
export const THIGH = 0.43;
export const SHIN = 0.415;
/** Ankle height above the sole, and heel / ball contact points along the foot (forward = +). */
export const ANKLE_H = 0.085;
export const HEEL = -0.065;
export const BALL = 0.115;
export const SHOULDER_X = 0.18;
export const HIP_X = 0.095;
export const PELVIS_Y = 0.98;

/** Offsets from each bone's parent in the rest pose (feet at y=0, facing -Z, every rotation identity). */
const REST: Record<Exclude<BoneName, 'dangleBack'>, V3> = {
  pelvis: [0, PELVIS_Y, 0],
  spine: [0, 0.1, 0],
  chest: [0, 0.16, 0],
  neck: [0, 0.255, 0],
  head: [0, 0.07, 0],
  hat: [0, 0.2, 0],
  clavL: [-0.04, 0.19, 0],
  upperArmL: [-(SHOULDER_X - 0.04), 0, 0],
  forearmL: [0, -UPPER_ARM, 0],
  handL: [0, -FOREARM, 0],
  clavR: [0.04, 0.19, 0],
  upperArmR: [SHOULDER_X - 0.04, 0, 0],
  forearmR: [0, -UPPER_ARM, 0],
  handR: [0, -FOREARM, 0],
  thighL: [-HIP_X, -0.05, 0],
  shinL: [0, -THIGH, 0],
  footL: [0, -SHIN, 0],
  toeL: [0, -0.055, -BALL],
  thighR: [HIP_X, -0.05, 0],
  shinR: [0, -THIGH, 0],
  footR: [0, -SHIN, 0],
  toeR: [0, -0.055, -BALL],
  mallet: [0.035, 0.045, -0.07],
  grenade: [0.035, 0.05, -0.07],
  dangleHead: [0, 0.2, 0.1],
  dangleHip: [0, 0, 0]
};
/** Hangs off the back of the deepened torso. Read when a rig is built, not on load: parts.ts imports this module. */
const backRest = (): V3 => [0, 0.18, 0.12 * TORSO_DEPTH];

export type RestOverrides = Partial<Record<BoneName, V3>>;

export function restOffsets(overrides: RestOverrides = {}): V3[] {
  return BONES.map((name) => overrides[name] ?? (name === 'dangleBack' ? backRest() : REST[name]));
}

/** Rest positions in model space, used to bake bone-local parts into the bind pose. */
export function restModelPositions(offsets: V3[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  BONES.forEach((name, i) => {
    const parent = PARENT[name];
    const o = offsets[i]!;
    const p = new THREE.Vector3(o[0], o[1], o[2]);
    if (parent) p.add(out[BONE[parent]]!);
    out.push(p);
  });
  return out;
}

export function createBones(offsets: V3[]): THREE.Bone[] {
  const bones = BONES.map((name, i) => {
    const bone = new THREE.Bone();
    bone.name = name;
    const o = offsets[i]!;
    bone.position.set(o[0], o[1], o[2]);
    return bone;
  });
  BONES.forEach((name, i) => {
    const parent = PARENT[name];
    if (parent) bones[BONE[parent]]!.add(bones[i]!);
  });
  return bones;
}

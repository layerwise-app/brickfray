import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterInfo } from '../../characters/types';
import type { Kit } from '../../engine/kit';
import { useLod } from '../shapes';
import { paint, surfaceMaterial } from '../surface';
import { FINGERS, mixFingers, type FingerPose } from './fingers';
import { createHandBones, poseFingers } from './fingers-rig';
import { padColor } from './glove';
import { forearmPieces, handPieces, upperArmPieces, WRIST, type ArmPiece, type Slot } from './hand';

export const UPPER = 0.34;
export const FOREARM = 0.31;

const SLOTS: Slot[] = ['sleeve', 'trim', 'glove', 'pad', 'seam', 'cuff'];
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);
/** Seconds for a finger shape to settle, so grips never pop when a clip starts or ends. */
const FINGER_LAG = 0.07;

/** Right/left: shoulder, elbow-pole hint, wrist offset in the hand frame. */
interface Side {
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  /** The hand and its finger joints, in HAND_JOINTS order. */
  joints: THREE.Bone[];
  fingers: FingerPose;
  /** Shoulder, at its furthest forward. */
  shoulder: THREE.Vector3;
  /** The shoulder stays this far behind the wrist in depth, so the forearm arrives from behind the hand, not from under it… */
  trail: number;
  /** …but never further back than this (`aimBack` once aimed: a shouldered gun puts the shoulder well behind the eye, so the forearm runs forward to the grip instead of standing up under it). */
  back: number;
  aimBack: number;
  pole: THREE.Vector3;
  /** Elbow hint and shoulder trail once the hand is up on the sight line: the elbow drops under the wrist instead of flaring out. */
  aimPole: THREE.Vector3;
  aimTrail: number;
  wrist: THREE.Vector3;
}

/** A wrist this close to the view axis (m, sideways) and this high (m, below the eye) counts as aimed; the arm eases over between the pairs. */
const AIM_SIDE = [0.13, 0.05] as const;
const AIM_HEIGHT = [-0.25, -0.16] as const;

/**
 * Both first-person arms as one rigidly skinned mesh (one draw call): upper
 * arm, forearm, hand and fifteen finger joints a side. Hands are placed
 * directly; elbows come from two-bone IK toward shoulders below and
 * behind the camera. Built at full detail on every quality tier: they sit
 * right at the camera.
 */
export class Arms {
  readonly root = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly right: Side;
  readonly left: Side;
  private readonly slots: Uint8Array;
  private settled = false;
  private trigger = 0;

  constructor(kit: Kit) {
    useLod(null);
    const geos: THREE.BufferGeometry[] = [];
    const slotIds: number[] = [];
    const bones: THREE.Bone[] = [];
    const add = (pieces: ArmPiece[], boneIndex: number, mirror: boolean) => {
      for (const p of pieces) {
        const g = p.geometry.clone();
        g.applyMatrix4(mirror ? MIRROR.clone().multiply(p.matrix) : p.matrix);
        if (mirror) flipWinding(g);
        paint(g, '#ffffff', p.surface);
        const n = g.getAttribute('position').count;
        const skinIndex = new Uint16Array(n * 4).fill(0);
        const skinWeight = new Float32Array(n * 4).fill(0);
        for (let i = 0; i < n; i++) {
          skinIndex[i * 4] = boneIndex + (p.joint ?? 0);
          skinWeight[i * 4] = 1;
          slotIds.push(SLOTS.indexOf(p.slot));
        }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
        geos.push(g);
      }
    };
    const side = (mirror: boolean, shoulder: THREE.Vector3, trail: number, back: number, pole: THREE.Vector3, aimPole: THREE.Vector3, aimTrail: number, aimBack = back): Side => {
      const upper = new THREE.Bone();
      const fore = new THREE.Bone();
      const joints = createHandBones(mirror);
      const first = bones.length;
      bones.push(upper, fore, ...joints);
      add(upperArmPieces(UPPER), first, mirror);
      add(forearmPieces(FOREARM), first + 1, mirror);
      add(handPieces(), first + 2, mirror);
      this.root.add(upper, fore, joints[0]!);
      joints[0]!.name = mirror ? 'hand:left' : 'hand:right';
      fore.name = mirror ? 'forearm:left' : 'forearm:right';
      const fingers = { ...FINGERS.relaxed };
      poseFingers(joints, fingers, mirror);
      return { upper, fore, hand: joints[0]!, joints, fingers, shoulder, trail, back, aimBack, pole, aimPole, aimTrail, wrist: WRIST.clone().setX(mirror ? -WRIST.x : WRIST.x) };
    };
    this.right = side(false, new THREE.Vector3(0.2, -0.2, -0.05), 0.535, 0.24, new THREE.Vector3(0.9, -1, 0.15), new THREE.Vector3(0.7, -1, 0.1), 0.62, 0.52);
    this.left = side(true, new THREE.Vector3(-0.16, -0.33, -0.2), 0.46, 0.15, new THREE.Vector3(-0.95, -1.3, 0.1), new THREE.Vector3(-0.7, -1.3, 0.1), 0.44);
    const geometry = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    this.slots = Uint8Array.from(slotIds);
    this.mesh = new THREE.SkinnedMesh(geometry, surfaceMaterial(kit.materials));
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
    this.mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
  }

  setColors(info: CharacterInfo) {
    const glove = new THREE.Color(info.glove);
    const sleeve = info.sleeve ?? info.primary;
    const trim = info.sleeve ? info.primary : info.secondary;
    // A character with its own sleeve colour wears it down to the wrist, so a bright glove (Rivet's yellow) is only the hand, not the whole forearm against a gun of the same paint.
    const cuff = info.sleeve ? new THREE.Color(sleeve).multiplyScalar(0.85) : glove;
    const palette = [new THREE.Color(sleeve), new THREE.Color(trim), glove, padColor(info), new THREE.Color(sleeve).multiplyScalar(0.55), cuff];
    const color = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < this.slots.length; i++) {
      const c = palette[this.slots[i]!]!;
      color.setXYZ(i, c.r, c.g, c.b);
    }
    color.needsUpdate = true;
  }

  /**
   * Ease each hand's fingers toward a shape; `dt` 0 snaps. `onTrigger` says the right
   * hand is on a pistol grip, so its index hooks around the trigger; `squeeze` is the extra curl of a trigger pull.
   */
  setFingers(right: FingerPose, left: FingerPose, dt: number, onTrigger = false, squeeze = 0) {
    const k = this.settled && dt > 0 ? 1 - Math.exp(-dt / FINGER_LAG) : 1;
    this.settled = true;
    this.trigger += ((onTrigger ? 1 : 0) - this.trigger) * k;
    mixFingers(this.right.fingers, right, k, this.right.fingers);
    mixFingers(this.left.fingers, left, k, this.left.fingers);
    // The pull is laid over the settled grip unsmoothed, so it lands with the shot.
    this.right.fingers.index += squeeze;
    poseFingers(this.right.joints, this.right.fingers, false, this.trigger);
    this.right.fingers.index -= squeeze;
    poseFingers(this.left.joints, this.left.fingers, true);
  }

  /** Place each hand (pose in the arms' space) and bend the arms to reach it. */
  pose(rightHand: THREE.Matrix4, leftHand: THREE.Matrix4, shoulderShift: THREE.Vector3) {
    solve(this.right, rightHand, shoulderShift);
    solve(this.left, leftHand, shoulderShift);
  }
}

const wrist = new THREE.Vector3();
const shoulder = new THREE.Vector3();
const elbow = new THREE.Vector3();
const dir = new THREE.Vector3();
const normal = new THREE.Vector3();
const pole = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const basis = new THREE.Matrix4();

function solve(side: Side, hand: THREE.Matrix4, shift: THREE.Vector3) {
  hand.decompose(side.hand.position, side.hand.quaternion, side.hand.scale);
  wrist.copy(side.wrist).applyMatrix4(hand);
  const aim = ramp(Math.abs(wrist.x), AIM_SIDE) * ramp(wrist.y, AIM_HEIGHT);
  const trail = side.trail + (side.aimTrail - side.trail) * aim;
  pole.copy(side.pole).lerp(side.aimPole, aim);
  shoulder.copy(side.shoulder).setZ(Math.min(side.back + (side.aimBack - side.back) * aim, Math.max(side.shoulder.z, wrist.z + trail))).add(shift);
  dir.subVectors(wrist, shoulder);
  let dist = dir.length();
  dir.divideScalar(dist);
  const reach = (UPPER + FOREARM) * 0.999;
  const stretch = Math.max(1, dist / reach);
  const a = UPPER * stretch;
  const b = FOREARM * stretch;
  dist = Math.min(Math.max(dist, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  normal.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  elbow.copy(shoulder).addScaledVector(dir, a * cosA).addScaledVector(normal, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
  place(side.upper, shoulder, elbow, UPPER);
  place(side.fore, elbow, wrist, FOREARM);
}

/** 0 at `range[0]`, 1 at `range[1]`, smoothstep between. */
function ramp(v: number, range: readonly [number, number]) {
  const t = Math.min(1, Math.max(0, (v - range[0]) / (range[1] - range[0])));
  return t * t * (3 - 2 * t);
}

/** Bone at `from`, +Y toward `to`, its -Z side facing up so pads stay on top. */
function place(boneObj: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3, length: number) {
  by.subVectors(to, from);
  const len = by.length();
  by.divideScalar(len);
  bz.copy(UP).addScaledVector(by, -UP.dot(by));
  if (bz.lengthSq() < 1e-6) bz.set(0, 0, 1);
  bz.normalize().negate();
  bx.crossVectors(by, bz).normalize();
  basis.makeBasis(bx, by, bz);
  boneObj.position.copy(from);
  boneObj.quaternion.setFromRotationMatrix(basis);
  boneObj.scale.set(1, len / length, 1);
}

function flipWinding(g: THREE.BufferGeometry) {
  for (const name of ['position', 'normal']) {
    const attr = g.getAttribute(name);
    const arr = attr.array as Float32Array;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const t = arr[(i + 1) * 3 + k]!;
        arr[(i + 1) * 3 + k] = arr[(i + 2) * 3 + k]!;
        arr[(i + 2) * 3 + k] = t;
      }
    }
    attr.needsUpdate = true;
  }
}

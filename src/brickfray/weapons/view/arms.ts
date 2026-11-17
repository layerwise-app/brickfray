import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CharacterInfo } from '../../characters/types';
import type { Kit } from '../../engine/kit';
import { paint, surfaceMaterial } from '../surface';
import { forearmPieces, handPieces, upperArmPieces, WRIST, type ArmPiece, type Slot } from './hand';

export const UPPER = 0.34;
export const FOREARM = 0.31;

const SLOTS: Slot[] = ['sleeve', 'trim', 'glove', 'pad', 'seam'];
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);

/** Right/left: shoulder, elbow-pole hint, wrist offset in the hand frame. */
interface Side {
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  shoulder: THREE.Vector3;
  pole: THREE.Vector3;
  wrist: THREE.Vector3;
}

/**
 * Both first-person arms as one rigidly skinned mesh (six bones, one draw
 * call). Hands are placed directly; elbows come from two-bone IK toward
 * fixed shoulders below and behind the camera.
 */
export class Arms {
  readonly root = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly right: Side;
  readonly left: Side;
  private readonly slots: Uint8Array;

  constructor(kit: Kit) {
    const detail = kit.profile.detail;
    const bones = Array.from({ length: 6 }, () => new THREE.Bone());
    const geos: THREE.BufferGeometry[] = [];
    const slotIds: number[] = [];
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
          skinIndex[i * 4] = boneIndex;
          skinWeight[i * 4] = 1;
          slotIds.push(SLOTS.indexOf(p.slot));
        }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
        geos.push(g);
      }
    };
    for (const [offset, mirror] of [[0, false], [3, true]] as const) {
      add(upperArmPieces(detail, UPPER), offset, mirror);
      add(forearmPieces(detail, FOREARM), offset + 1, mirror);
      add(handPieces(detail, !mirror), offset + 2, mirror);
    }
    const geometry = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    this.slots = Uint8Array.from(slotIds);
    this.mesh = new THREE.SkinnedMesh(geometry, surfaceMaterial(kit.materials));
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh, ...bones);
    const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
    this.mesh.bind(skeleton, new THREE.Matrix4());
    this.right = { upper: bones[0]!, fore: bones[1]!, hand: bones[2]!, shoulder: new THREE.Vector3(0.17, -0.33, -0.02), pole: new THREE.Vector3(0.9, -1, 0.15), wrist: WRIST.clone() };
    this.left = { upper: bones[3]!, fore: bones[4]!, hand: bones[5]!, shoulder: new THREE.Vector3(-0.25, -0.34, -0.06), pole: new THREE.Vector3(-1.1, -1.6, 0.1), wrist: WRIST.clone().setX(-WRIST.x) };
  }

  setColors(info: CharacterInfo) {
    const glove = new THREE.Color(info.glove);
    const sleeve = info.sleeve ?? info.primary;
    const trim = info.sleeve ? info.primary : info.secondary;
    const palette = [new THREE.Color(sleeve), new THREE.Color(trim), glove, glove.clone().multiplyScalar(0.62), new THREE.Color(sleeve).multiplyScalar(0.55)];
    const color = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < this.slots.length; i++) {
      const c = palette[this.slots[i]!]!;
      color.setXYZ(i, c.r, c.g, c.b);
    }
    color.needsUpdate = true;
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
const UP = new THREE.Vector3(0, 1, 0);
const bx = new THREE.Vector3();
const by = new THREE.Vector3();
const bz = new THREE.Vector3();
const basis = new THREE.Matrix4();

function solve(side: Side, hand: THREE.Matrix4, shift: THREE.Vector3) {
  hand.decompose(side.hand.position, side.hand.quaternion, side.hand.scale);
  wrist.copy(side.wrist).applyMatrix4(hand);
  shoulder.copy(side.shoulder).add(shift);
  dir.subVectors(wrist, shoulder);
  let dist = dir.length();
  dir.divideScalar(dist);
  const reach = (UPPER + FOREARM) * 0.999;
  const stretch = Math.max(1, dist / reach);
  const a = UPPER * stretch;
  const b = FOREARM * stretch;
  dist = Math.min(Math.max(dist, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  normal.copy(side.pole).addScaledVector(dir, -side.pole.dot(dir)).normalize();
  elbow.copy(shoulder).addScaledVector(dir, a * cosA).addScaledVector(normal, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
  place(side.upper, shoulder, elbow, UPPER);
  place(side.fore, elbow, wrist, FOREARM);
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

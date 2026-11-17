import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { Animator } from './animator';
import { patchCharacterMaterial, pieceMaterial, type CharacterMaterial } from './material';
import type { BakedCharacter } from './parts';
import { BONE, createBones, type V3 } from './skeleton';
import type { Style } from './style';
import type { AnimState, BotKind, CharacterId, CharacterRig, ShatterPiece } from './types';
import { SOCKET_R } from './upper';

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

export interface RigSource {
  id: CharacterId | BotKind;
  baked: BakedCharacter;
  rest: V3[];
  style: Style;
  scale: number;
}

/** One rigidly skinned character: a SkinnedMesh (+ glass mesh) on a procedural skeleton. */
export class Rig implements CharacterRig {
  readonly root = new THREE.Group();
  readonly id: CharacterId | BotKind;
  readonly rightHand = new THREE.Object3D();
  readonly animator: Animator;
  readonly body = new THREE.Group();
  readonly bones: THREE.Bone[];
  readonly mesh: THREE.SkinnedMesh;
  readonly glass: THREE.SkinnedMesh | null;
  private mat: CharacterMaterial;
  private weapon: THREE.Object3D | null = null;
  private supportGrip: THREE.Object3D | null = null;
  private supportMatrix = new THREE.Matrix4();
  private flashT = 0;
  private seed = 1;

  constructor(
    private src: RigSource,
    private kit: Kit
  ) {
    this.id = src.id;
    this.root.name = `character:${src.id}`;
    this.body.scale.setScalar(src.scale);
    this.root.add(this.body);
    this.bones = createBones(src.rest);
    this.body.add(this.bones[BONE.pelvis]!);
    this.body.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    this.mat = patchCharacterMaterial(kit.materials.vertexColored('plastic', true));
    this.mesh = new THREE.SkinnedMesh(src.baked.main, this.mat.material);
    this.glass = src.baked.glass ? new THREE.SkinnedMesh(src.baked.glass, kit.materials.vertexColored('glass')) : null;
    for (const m of [this.mesh, this.glass]) {
      if (!m) continue;
      this.body.add(m);
      m.updateMatrixWorld(true);
      m.bind(skeleton, m.matrixWorld.clone());
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.45);
      m.boundingBox = new THREE.Box3(new THREE.Vector3(-0.9, -0.1, -0.9), new THREE.Vector3(0.9, 2.2, 0.9));
      m.castShadow = kit.profile.shadows && m === this.mesh;
      m.receiveShadow = kit.profile.shadows;
    }
    this.rightHand.name = 'rightHand';
    this.rightHand.position.copy(SOCKET_R);
    this.bones[BONE.handR]!.add(this.rightHand);
    this.animator = new Animator(src.rest, src.style);
    this.animator.pose.apply(this.bones);
  }

  update(dt: number, state: AnimState) {
    this.animator.support = this.supportGrip && relativeMatrix(this.supportGrip, this.rightHand, this.supportMatrix) ? this.supportMatrix : null;
    this.animator.update(dt, state);
    this.animator.pose.apply(this.bones);
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      this.mat.material.emissive.setScalar(Math.pow(this.flashT / 0.12, 2) * 0.9);
    }
    this.root.updateMatrixWorld();
  }

  setWeapon(model: THREE.Object3D | null, supportGrip: THREE.Object3D | null) {
    if (this.weapon) this.rightHand.remove(this.weapon);
    this.weapon = model;
    this.supportGrip = model ? supportGrip : null;
    if (model) this.rightHand.add(model);
  }

  setTint(color: THREE.ColorRepresentation | null) {
    this.mat.tintOn.value = color === null ? 0 : 1;
    if (color !== null) this.mat.tint.value.set(color);
  }

  flash() {
    this.flashT = 0.12;
    this.mat.material.emissive.setScalar(0.9);
  }

  shatter(impulse: THREE.Vector3): ShatterPiece[] {
    this.root.updateMatrixWorld(true);
    const pieces: ShatterPiece[] = [];
    const center = this.body.localToWorld(tmpV2.set(0, 1, 0));
    const strength = impulse.length();
    const solid = pieceMaterial(this.kit.materials);
    const glass = this.kit.materials.vertexColored('glass');
    for (const p of this.src.baked.pieces) {
      const mesh = new THREE.Mesh(p.geometry, p.glass ? glass : solid);
      mesh.name = `shard:${this.id}`;
      tmpM.copy(this.bones[p.bone]!.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(p.center));
      tmpM.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.castShadow = this.kit.profile.shadows && !p.glass;
      const out = tmpV.subVectors(mesh.position, center).setY(0).normalize();
      const velocity = new THREE.Vector3()
        .copy(impulse)
        .multiplyScalar(0.55 + this.rand() * 0.6)
        .addScaledVector(out, 1.2 + this.rand() * 1.6 + strength * 0.08)
        .add(new THREE.Vector3((this.rand() - 0.5) * 1.2, 1.8 + this.rand() * 2.4, (this.rand() - 0.5) * 1.2));
      const angularVelocity = new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).multiplyScalar(14 + strength);
      pieces.push({ mesh, velocity, angularVelocity });
    }
    this.body.visible = false;
    return pieces;
  }

  reset() {
    this.body.visible = true;
    this.flashT = 0;
    this.mat.material.emissive.setScalar(0);
    this.animator.reset();
    this.animator.pose.apply(this.bones);
  }

  headPosition(out: THREE.Vector3) {
    this.animator.headCenter(out);
    return this.body.localToWorld(out);
  }

  dispose() {
    this.root.removeFromParent();
    if (this.weapon) this.rightHand.remove(this.weapon);
    this.mat.material.dispose();
    this.mesh.skeleton.dispose();
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

/** Transform of `node` relative to `ancestor` from local matrices; false when it is not a descendant. */
function relativeMatrix(node: THREE.Object3D, ancestor: THREE.Object3D, out: THREE.Matrix4) {
  out.identity();
  let o: THREE.Object3D | null = node;
  while (o && o !== ancestor) {
    o.updateMatrix();
    out.premultiply(o.matrix);
    o = o.parent;
  }
  return o === ancestor;
}


import * as THREE from 'three';
import { chamferBox } from '../engine/geometry';
import type { Kit } from '../engine/kit';
import { Animator } from './animator';
import { HandProps } from './carried';
import { patchCharacterMaterial, pieceMaterial, type CharacterMaterial } from './material';
import { capeLength, farRim, type CapeUniforms } from './rig-shading';
import { wristOffset } from './body-hands';
import type { BakedCharacter, Hands } from './parts';
import { BONE, createBones, restModelPositions, type V3 } from './skeleton';
import { seatMelee, type Stance } from './stance';
import { fitStow, STOW_BONE, stowTransform, type StowPlace } from './stow';
import type { MeleeId } from '../weapons/defs';
import type { Style } from './style';
import type { AnimState, BotKind, CharacterId, CharacterRig, ShatterPiece } from './types';
import { SOCKET_R } from './upper';

const HEAD_BONES = new Set([BONE.head, BONE.hat, BONE.dangleHead]);
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpE = new THREE.Euler();

export interface RigSource {
  id: CharacterId | BotKind;
  baked: BakedCharacter;
  /** The hand shapes baked into the geometry, when they are the jointed hands. */
  hands: Hands | null;
  rest: V3[];
  style: Style;
  scale: number;
  /** The melee weapon on its 'mallet' bone, whose swing the animator plays. */
  tool: MeleeId;
}

/** One rigidly skinned character: a SkinnedMesh (+ glass mesh) on a procedural skeleton. */
export class Rig implements CharacterRig {
  readonly root = new THREE.Group();
  readonly id: CharacterId | BotKind;
  readonly rightHand = new THREE.Object3D();
  /** The handle a `hold` left hand is closed around. */
  private readonly leftHold = new THREE.Object3D();
  readonly animator: Animator;
  readonly body = new THREE.Group();
  readonly bones: THREE.Bone[];
  readonly mesh: THREE.SkinnedMesh;
  readonly glass: THREE.SkinnedMesh | null;
  private mat: CharacterMaterial;
  private weapon: THREE.Object3D | null = null;
  private supportGrip: THREE.Object3D | null = null;
  private melee: THREE.Object3D | null = null;
  private supportMatrix = new THREE.Matrix4();
  private magHoldMatrix = new THREE.Matrix4();
  private muzzleMatrix = new THREE.Matrix4();
  private readonly props: HandProps;
  /** Guns carried on the figure (slung or holstered), with where. */
  private readonly stowed = new Map<THREE.Object3D, StowPlace>();
  private holster: THREE.Mesh | null = null;
  private flashT = 0;
  private seed = 1;
  private readonly cape: CapeUniforms = { into: { value: new THREE.Matrix4() }, out: { value: new THREE.Matrix4() }, bend: { value: new THREE.Vector3() } };
  private readonly capeLength: number;

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
    this.mat = farRim(patchCharacterMaterial(kit.materials.vertexColored('plastic', true)), !kit.profile.pbr, this.cape);
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
    this.cape.into.value.multiplyMatrices(skeleton.boneInverses[BONE.dangleBack]!, this.mesh.bindMatrix);
    this.cape.out.value.copy(this.cape.into.value).invert();
    this.capeLength = capeLength(src.baked.main, this.cape.into.value);
    this.rightHand.name = 'rightHand';
    this.rightHand.position.copy(SOCKET_R);
    this.bones[BONE.handR]!.add(this.rightHand);
    this.leftHold.visible = false;
    this.bones[BONE.handL]!.add(this.leftHold);
    this.animator = new Animator(src.rest, src.style);
    this.animator.tool = src.tool;
    this.animator.fit = fitStow(src.baked, restModelPositions(src.rest));
    if (src.hands) {
      this.animator.pose.wrist.L.set(...wristOffset(src.hands.L, 'L'));
      this.animator.pose.wrist.R.set(...wristOffset(src.hands.R, 'R'));
    }
    this.animator.pose.apply(this.bones);
    this.props = new HandProps(kit, this.bones[BONE.handL]!);
  }

  update(dt: number, state: AnimState) {
    this.animator.support = this.supportGrip && relativeMatrix(this.supportGrip, this.rightHand, this.supportMatrix) ? this.supportMatrix : null;
    this.animator.update(dt, state);
    this.animator.pose.apply(this.bones);
    if (this.capeLength > 0) this.cape.bend.value.set(Math.min(0, tmpE.setFromQuaternion(this.animator.pose.q[BONE.dangleBack]!, 'XYZ').x), this.capeLength, this.cape.bend.value.z + dt);
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      this.mat.material.emissive.setScalar(Math.pow(this.flashT / 0.12, 2) * 0.9);
    }
    this.root.updateMatrixWorld();
    const held = this.animator.held;
    this.props.update(held.item, held.magazine, held.grenade);
  }

  setWeapon(model: THREE.Object3D | null, supportGrip: THREE.Object3D | null) {
    if (this.weapon) this.rightHand.remove(this.weapon);
    this.weapon = model;
    this.supportGrip = model ? supportGrip : null;
    if (model) {
      this.stowed.delete(model);
      model.position.set(0, 0, 0);
      model.quaternion.identity();
      this.rightHand.add(model);
      this.showHolster();
    }
    this.props.setWeapon(model);
    const magHold = model?.getObjectByName('magHold');
    const muzzle = model?.getObjectByName('muzzle');
    this.animator.magHold = magHold && relativeMatrix(magHold, this.rightHand, this.magHoldMatrix) ? this.magHoldMatrix : null;
    this.animator.muzzle = muzzle && relativeMatrix(muzzle, this.rightHand, this.muzzleMatrix) ? this.muzzleMatrix : null;
  }

  stow(model: THREE.Object3D, place: StowPlace | null) {
    if (place === null) {
      this.stowed.delete(model);
      this.root.add(model);
      model.visible = false;
    } else if (this.stowed.get(model) !== place || !model.visible) {
      this.stowed.set(model, place);
      this.bones[STOW_BONE[place]]!.add(model);
      stowTransform(place, this.animator.fit, model.position, model.quaternion);
      model.visible = true;
    }
    this.showHolster();
  }

  /** A holstered sidearm sits in a leather holster; a drawn one leaves it empty, so it goes with the gun. */
  private showHolster() {
    const holstered = [...this.stowed].find(([, at]) => at === 'hip')?.[0];
    if (holstered) {
      this.holster ??= holsterFor(holstered, this.kit);
      this.bones[BONE.pelvis]!.add(this.holster);
      this.holster.position.copy(holstered.position);
      this.holster.quaternion.copy(holstered.quaternion);
    }
    if (this.holster) this.holster.visible = !!holstered;
  }

  setStance(stance: Stance | null) {
    this.animator.stance = stance;
    this.leftHold.visible = !!stance?.melee;
    if (stance?.melee) seatMelee(this.leftHold, stance.melee);
  }

  setMelee(model: THREE.Object3D | null) {
    if (this.melee) this.leftHold.remove(this.melee);
    this.melee = model;
    if (model) this.leftHold.add(model);
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
      pieces.push({ mesh, velocity, angularVelocity, head: HEAD_BONES.has(p.bone) });
    }
    // The guns leave the hand and the back as their own pieces and drop where the character stood.
    this.props.update('none', 'seated', 0);
    const guns = [...this.stowed.keys()];
    if (this.weapon) guns.push(this.weapon);
    for (const gun of guns) gun.traverse((o) => {
      const part = o as THREE.Mesh;
      if (!part.isMesh || !part.visible) return;
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.name = `shard:${this.id}:gun`;
      part.updateWorldMatrix(true, false);
      part.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.castShadow = this.kit.profile.shadows;
      const velocity = new THREE.Vector3().copy(impulse).multiplyScalar(0.35).add(new THREE.Vector3((this.rand() - 0.5) * 1.4, 2.4 + this.rand() * 1.2, (this.rand() - 0.5) * 1.4));
      const angularVelocity = new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).multiplyScalar(9);
      pieces.push({ mesh, velocity, angularVelocity, head: false });
    });
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
    if (this.melee) this.leftHold.remove(this.melee);
    this.props.dispose();
    this.mat.material.dispose();
    this.mesh.skeleton.dispose();
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

const holsters = new Map<string, THREE.BufferGeometry>();
const holsterBox = new THREE.Box3();
const partBox = new THREE.Box3();
const relative = new THREE.Matrix4();

/** A leather holster round the slide and barrel of a sidearm (in the gun's own space), the grip left out to draw by. */
function holsterFor(gun: THREE.Object3D, kit: Kit) {
  const key = `${gun.name}:${kit.profile.level}`;
  let geometry = holsters.get(key);
  if (!geometry) {
    holsterBox.makeEmpty();
    gun.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !relativeMatrix(mesh, gun, relative)) return;
      mesh.geometry.computeBoundingBox();
      holsterBox.union(partBox.copy(mesh.geometry.boundingBox!).applyMatrix4(relative));
    });
    const x = Math.max(0.02, Math.max(-holsterBox.min.x, holsterBox.max.x)) + 0.008;
    const top = holsterBox.max.y + 0.006;
    const bottom = top - 0.095;
    const front = holsterBox.min.z - 0.014;
    const back = -0.025;
    geometry = chamferBox(x * 2, top - bottom, back - front, 0.008).translate(0, (top + bottom) / 2, (front + back) / 2);
    holsters.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, kit.materials.get('#3a2a20', 'plastic'));
  mesh.name = 'holster';
  mesh.castShadow = kit.profile.shadows;
  return mesh;
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


import * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { Animator } from './animator';
import { HandProps } from './carried';
import { patchCharacterMaterial, pieceMaterial, type CharacterMaterial } from './material';
import { wristOffset } from './body-hands';
import type { BakedCharacter, Hands } from './parts';
import { BONE, createBones, type V3 } from './skeleton';
import { seatMelee, type Stance } from './stance';
import type { Style } from './style';
import type { AnimState, BotKind, CharacterId, CharacterRig, ShatterPiece } from './types';
import { SOCKET_R } from './upper';

const HEAD_BONES = new Set([BONE.head, BONE.hat, BONE.dangleHead]);
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpE = new THREE.Euler();
const capeLengths = new WeakMap<THREE.BufferGeometry, number>();

export interface RigSource {
  id: CharacterId | BotKind;
  baked: BakedCharacter;
  /** The hand shapes baked into the geometry, when they are the jointed hands. */
  hands: Hands | null;
  rest: V3[];
  style: Style;
  scale: number;
}

/** The low tier's Phong has no roughness or metalness: the per-vertex surface sets its highlight instead. */
const PHONG_SURFACE = `
material.specularShininess = mix(90.0, 4.0, vSurface.x) * (1.0 - 0.75 * smoothstep(12.0, 30.0, length(vViewPosition)));
material.specularColor = mix(vec3(0.24), diffuseColor.rgb, vSurface.y) * (1.2 - vSurface.x);`;
/**
 * Sky light from above and dark bounce from below model the form instead of one flat fill; metal loses most of its
 * diffuse and reflects a sky-to-ground gradient, so armour keeps its shine without an environment map.
 */
const PHONG_SKY = `
vec3 skyN = inverseTransformDirection(normal, viewMatrix);
float metal = vSurface.y;
reflectedLight.directDiffuse *= 1.0 - 0.45 * metal;
reflectedLight.indirectDiffuse *= mix(0.55, 1.25, skyN.y * 0.5 + 0.5) * (1.0 - 0.45 * metal);
vec3 skyR = inverseTransformDirection(reflect(-normalize(vViewPosition), normal), viewMatrix);
reflectedLight.indirectSpecular += mix(vec3(0.16, 0.15, 0.14), vec3(0.78, 0.84, 0.94), smoothstep(-0.25, 0.35, skyR.y)) * diffuseColor.rgb * metal * 0.65;`;

/**
 * Far away a trim, rivet or stud is smaller than a pixel: a sharp highlight on it lights single pixels that sparkle as
 * the figure moves. Past ~12 m every surface turns rougher, so highlights spread instead of pinpointing.
 */
const FAR_ROUGH = `
material.roughness = max(material.roughness, 0.6 * smoothstep(12.0, 30.0, length(vViewPosition)));`;

interface CapeUniforms {
  /** Bind space to the back bone's space and back. */
  into: { value: THREE.Matrix4 };
  out: { value: THREE.Matrix4 };
  /** The bone's swing away from the back (rad, <= 0), the cloth's length below it (m) and a clock (s). */
  bend: { value: THREE.Vector3 };
}

/**
 * The back cloth rides one rigid bone: swung out it would stand off the back as a flat board. Instead it curves along
 * its length (an arc of the same length): the top stays near the back at 30% of the swing, the hem goes to 140%. The
 * swing also cups it (the sides trail the middle) and runs a ripple down to the hem; hanging still it is untouched.
 */
const CAPE_PARS = `
uniform mat4 uCapeIn;
uniform mat4 uCapeOut;
uniform vec3 uCapeBend;
vec2 capeTurn(vec2 v, float a) { return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a)); }`;
const CAPE_NORMAL = `
bool capeOn = false;
vec3 capeP = vec3(0.0);
#ifdef USE_SKINNING
capeOn = uCapeBend.x < 0.0 && abs(skinIndex.x - ${BONE.dangleBack}.0) < 0.5;
if (capeOn) {
  capeP = (uCapeIn * vec4(position, 1.0)).xyz;
  float capeL = uCapeBend.y;
  float capeS = clamp(-capeP.y, 0.0, capeL);
  float capeU = capeS / capeL;
  float capeK = 1.1 * uCapeBend.x / capeL;
  float capeTop = -0.7 * uCapeBend.x;
  float capeAngle = capeTop + capeK * capeS;
  float capeH = 0.5 * capeK * capeS;
  float capeSinc = abs(capeH) < 1e-4 ? 1.0 : sin(capeH) / capeH;
  float capeX = clamp(capeP.x / 0.3, -1.0, 1.0);
  float capeWave = 13.0 * uCapeBend.z - 9.0 * capeS;
  float capeD = -uCapeBend.x * (0.1 * capeX * capeX * capeU + 0.035 * pow(capeU, 1.5) * sin(capeWave));
  float capeDs = -uCapeBend.x * (0.1 * capeX * capeX / capeL + 0.035 * (1.5 * sqrt(capeU) / capeL * sin(capeWave) - 9.0 * pow(capeU, 1.5) * cos(capeWave)));
  float capeDx = -uCapeBend.x * 0.1 * 2.0 * capeX / 0.3 * capeU;
  capeP.yz = -capeS * capeSinc * vec2(cos(capeTop + capeH), sin(capeTop + capeH)) + capeTurn(vec2(max(capeP.y, 0.0), capeP.z + capeD), capeAngle);
  vec3 capeN = mat3(uCapeIn) * objectNormal;
  capeN.xz = capeTurn(capeN.xz, atan(capeDx));
  capeN.yz = capeTurn(capeN.yz, capeAngle - atan(capeDs));
  objectNormal = mat3(uCapeOut) * capeN;
}
#endif`;

/**
 * A soft warm rim on figures past ~10 m lifts their silhouette off foliage and shade at fighting range; close-ups and
 * the menu keep their lighting. Every figure gets it, so it favours no one, and walls still hide it. It fades where
 * the surface turns faster than a pixel (the very edge, small curved parts), which would light single pixels.
 */
function farRim(mat: CharacterMaterial, phong: boolean, cape: CapeUniforms): CharacterMaterial {
  const patch = mat.material.onBeforeCompile;
  mat.material.onBeforeCompile = (shader, renderer) => {
    patch.call(mat.material, shader, renderer);
    Object.assign(shader.uniforms, { uCapeIn: cape.into, uCapeOut: cape.out, uCapeBend: cape.bend });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${CAPE_PARS}`)
      .replace('#include <skinnormal_vertex>', `${CAPE_NORMAL}\n#include <skinnormal_vertex>`)
      .replace('#include <skinning_vertex>', 'if (capeOn) transformed = (uCapeOut * vec4(capeP, 1.0)).xyz;\n#include <skinning_vertex>');
    let fragment = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 1.8) * smoothstep(9.0, 22.0, length(vViewPosition)) * 0.45 * (1.0 - smoothstep(0.2, 0.7, length(fwidth(normal))));`
    );
    if (!phong) fragment = fragment.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>${FAR_ROUGH}`);
    if (phong) fragment = fragment.replace('#include <lights_phong_fragment>', `#include <lights_phong_fragment>${PHONG_SURFACE}`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${PHONG_SKY}`);
    shader.fragmentShader = fragment;
  };
  mat.material.customProgramCacheKey = () => (phong ? 'bf-character-rim-phong' : 'bf-character-rim');
  return mat;
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
    if (model) this.rightHand.add(model);
    this.props.setWeapon(model);
    const magHold = model?.getObjectByName('magHold');
    const muzzle = model?.getObjectByName('muzzle');
    this.animator.magHold = magHold && relativeMatrix(magHold, this.rightHand, this.magHoldMatrix) ? this.magHoldMatrix : null;
    this.animator.muzzle = muzzle && relativeMatrix(muzzle, this.rightHand, this.muzzleMatrix) ? this.muzzleMatrix : null;
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
    // The gun leaves the hand as its own pieces and drops where the character stood.
    this.props.update('none', 'seated', 0);
    this.weapon?.traverse((o) => {
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

/** How far the back cloth hangs below its bone (m, bone space); 0 when the figure has none. */
function capeLength(geometry: THREE.BufferGeometry, into: THREE.Matrix4) {
  let length = capeLengths.get(geometry);
  if (length !== undefined) return length;
  length = 0;
  const bone = geometry.getAttribute('skinIndex');
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    if (bone.getX(i) === BONE.dangleBack) length = Math.max(length, -tmpV.fromBufferAttribute(position, i).applyMatrix4(into).y);
  }
  capeLengths.set(geometry, length);
  return length;
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


import * as THREE from 'three';
import type { Materials } from '../engine/materials';
import { BONE } from './skeleton';

export interface CharacterMaterial {
  material: THREE.Material & { emissive: THREE.Color };
  tint: { value: THREE.Color };
  tintOn: { value: number };
}

/**
 * Bends the cloth on the back and hip bones along its length (the showroom's turntable; off everywhere else). Per
 * bone: `anchor` is the bone's bind position (xyz) and 1 / the cloth's length below it (w, 0 = none); `sway` is how far
 * the hem swings sideways (x, rad, cloth behind the bone; cloth in front of it swings the other way) and out from the
 * body (y, rad).
 */
export interface ClothSway {
  on: { value: number };
  anchor: { value: [THREE.Vector4, THREE.Vector4] };
  sway: { value: [THREE.Vector4, THREE.Vector4] };
}

const clothSways = new WeakMap<THREE.Material, ClothSway>();
export const clothSway = (material: THREE.Material) => clothSways.get(material);

/**
 * Each cloth vertex turns about a line at the bone's height straight above it, by an angle that grows down the cloth:
 * the top stays put and the hem swings furthest, so a panel or scarf tail curves instead of swinging as a board. It
 * changes the bone's matrix for the vertex, so the cape's own bend (rig-shading.ts) and the normals go along.
 */
const CLOTH_SWAY = `
#ifdef USE_SKINNING
if (uClothOn > 0.5) {
  float clothBone = floor(skinIndex.x + 0.5);
  int clothK = clothBone == ${BONE.dangleBack}.0 ? 0 : clothBone == ${BONE.dangleHip}.0 ? 1 : -1;
  if (clothK >= 0 && uClothAnchor[clothK].w > 0.0) {
    vec4 clothA = uClothAnchor[clothK];
    vec3 clothP = (bindMatrix * vec4(position, 1.0)).xyz;
    float clothS = clamp((clothA.y - clothP.y) * clothA.w, 0.0, 1.0);
    float clothSide = clothP.z < clothA.z ? -1.0 : 1.0;
    float clothPhi = uClothSway[clothK].x * clothSide * clothS;
    float clothPsi = -clothSide * (uClothSway[clothK].y + 0.4 * abs(clothPhi)) * (0.35 + 0.65 * clothS);
    float cz = cos(clothPhi), sz = sin(clothPhi), cx = cos(clothPsi), sx = sin(clothPsi);
    mat3 clothR = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx) * mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
    vec3 clothC = vec3(clothP.x, clothA.y, clothP.z);
    boneMatX = boneMatX * mat4(vec4(clothR[0], 0.0), vec4(clothR[1], 0.0), vec4(clothR[2], 0.0), vec4(clothC - clothR * clothC, 1.0));
  }
}
#endif`;

const FABRIC_PARS = `
float fabricHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fabricNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fabricHash(i), fabricHash(i + vec3(1, 0, 0)), f.x), mix(fabricHash(i + vec3(0, 1, 0)), fabricHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(fabricHash(i + vec3(0, 0, 1)), fabricHash(i + vec3(1, 0, 1)), f.x), mix(fabricHash(i + vec3(0, 1, 1)), fabricHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

/**
 * Cloth (surface.w 0.25) gets a bumped weave and soft crumples in its own bind-space position, so a cloak or glove
 * breaks up its highlight instead of shining like a smooth moulding. Each scale fades out before its period drops
 * under a few pixels, where it would shimmer.
 */
const FABRIC_NORMAL = `
if (vSurface.w > 0.1 && vSurface.w < 0.5) {
  float foot = length(fwidth(vFabric));
  vec3 t = vFabric * 2100.0;
  float weave = (sin(t.x) * sin(t.y) + sin(t.y) * sin(t.z) + sin(t.z) * sin(t.x)) * 0.00011 * (1.0 - smoothstep(0.12, 0.3, foot * 334.0));
  float crumple = (fabricNoise(vFabric * 34.0) * (1.0 - smoothstep(0.15, 0.4, foot * 34.0)) + 0.5 * fabricNoise(vFabric * 71.0) * (1.0 - smoothstep(0.15, 0.4, foot * 71.0))) * 0.0028;
  float fabricH = weave + crumple;
  vec3 fabricX = dFdx(-vViewPosition);
  vec3 fabricY = dFdy(-vViewPosition);
  vec3 fabricR1 = cross(fabricY, normal);
  vec3 fabricR2 = cross(normal, fabricX);
  float fabricDet = dot(fabricX, fabricR1) * faceDirection;
  vec3 fabricGrad = sign(fabricDet) * (dFdx(fabricH) * fabricR1 + dFdy(fabricH) * fabricR2);
  normal = normalize(abs(fabricDet) * normal - fabricGrad);
}`;

/**
 * Adds the `surface` vertex attribute (roughness, metalness, glow, tint flag)
 * to a vertex-colored material, so metal armor, rubber soles, glowing eyes and
 * the team armband all render in the same draw call. Tint parts collapse to a
 * point while no tint is set.
 */
export function patchCharacterMaterial(material: THREE.Material): CharacterMaterial {
  const tint = { value: new THREE.Color('#ffffff') };
  const tintOn = { value: 0 };
  const cloth: ClothSway = { on: { value: 0 }, anchor: { value: [new THREE.Vector4(), new THREE.Vector4()] }, sway: { value: [new THREE.Vector4(), new THREE.Vector4()] } };
  clothSways.set(material, cloth);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = tint;
    shader.uniforms.uTintOn = tintOn;
    Object.assign(shader.uniforms, { uClothOn: cloth.on, uClothAnchor: cloth.anchor, uClothSway: cloth.sway });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;\nvarying vec3 vFabric;\nuniform float uTintOn;\nuniform float uClothOn;\nuniform vec4 uClothAnchor[2];\nuniform vec4 uClothSway[2];')
      .replace('#include <skinbase_vertex>', `#include <skinbase_vertex>${CLOTH_SWAY}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;\nvFabric = position;\nif (surface.w > 0.5 && uTintOn < 0.5) transformed = vec3(0.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vSurface;\nvarying vec3 vFabric;\nuniform vec3 uTint;${FABRIC_PARS}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vSurface.w > 0.5) diffuseColor.rgb = uTint;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${FABRIC_NORMAL}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vSurface.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vSurface.y;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - smoothstep( 0.4, 0.7, vSurface.x );\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;');
  };
  material.customProgramCacheKey = () => 'bf-character';
  return { material: material as CharacterMaterial['material'], tint, tintOn };
}

const pieceMaterials = new Map<Materials, THREE.Material>();

/** Shared material for shatter pieces (no tint, keeps metal and glow). */
export function pieceMaterial(materials: Materials) {
  let m = pieceMaterials.get(materials);
  if (!m) {
    m = patchCharacterMaterial(materials.vertexColored('plastic', true)).material;
    pieceMaterials.set(materials, m);
  }
  return m;
}

export function disposePieceMaterials() {
  for (const m of pieceMaterials.values()) m.dispose();
  pieceMaterials.clear();
}

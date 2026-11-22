import * as THREE from 'three';
import type { Materials } from '../engine/materials';

export interface CharacterMaterial {
  material: THREE.Material & { emissive: THREE.Color };
  tint: { value: THREE.Color };
  tintOn: { value: number };
}

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
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = tint;
    shader.uniforms.uTintOn = tintOn;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;\nvarying vec3 vFabric;\nuniform float uTintOn;')
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

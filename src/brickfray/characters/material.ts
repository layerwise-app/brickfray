import * as THREE from 'three';
import type { Materials } from '../engine/materials';

export interface CharacterMaterial {
  material: THREE.Material & { emissive: THREE.Color };
  tint: { value: THREE.Color };
  tintOn: { value: number };
}

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
      .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;\nuniform float uTintOn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;\nif (surface.w > 0.5 && uTintOn < 0.5) transformed = vec3(0.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSurface;\nuniform vec3 uTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vSurface.w > 0.5) diffuseColor.rgb = uTint;')
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

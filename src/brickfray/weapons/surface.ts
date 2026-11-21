import * as THREE from 'three';
import type { Materials } from '../engine/materials';

/**
 * Finishes baked per vertex: [roughness, metalness, emissive, clearcoat]. One
 * material then draws a whole multi-colored, multi-finish model in one call.
 */
export type Surface = 'plastic' | 'satin' | 'rubber' | 'metal' | 'chrome' | 'glow' | 'dark';

export const SURFACES: Record<Surface, readonly [number, number, number, number]> = {
  plastic: [0.36, 0, 0, 1],
  /** Large flat plates: a thin coat, so a studio's bright surround cannot wash a whole side out at a glancing angle. */
  satin: [0.55, 0, 0, 0.2],
  rubber: [0.86, 0, 0, 0],
  metal: [0.36, 0.85, 0, 0.1],
  chrome: [0.14, 1, 0, 0],
  glow: [0.9, 0, 2.4, 0],
  /** Recesses and bores: dull, no coat, so they read as depth. */
  dark: [0.75, 0, 0, 0]
};

const cache = new WeakMap<Materials, THREE.Material>();

/** The shared vertex-colored material for weapon and arm geometry on this tier. */
export function surfaceMaterial(materials: Materials): THREE.Material {
  let material = cache.get(materials);
  if (material) return material;
  const p = materials.profile;
  if (!p.pbr) {
    const phong = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x3a3a3a, shininess: 40 });
    phong.onBeforeCompile = (shader) => {
      injectVertex(shader);
      shader.fragmentShader = prelude(shader.fragmentShader)
        .replace(
          '#include <specularmap_fragment>',
          'float specularStrength = mix((1.0 - vSurface.x) * 1.3, 2.6, vSurface.y);'
        )
        .replace(
          '#include <lights_phong_fragment>',
          '#include <lights_phong_fragment>\nmaterial.specularShininess = mix(6.0, 96.0, 1.0 - vSurface.x);'
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;');
    };
    phong.customProgramCacheKey = () => 'bf-surface-phong';
    material = phong;
  } else {
    const params = { vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 0.95 };
    const standard = p.clearcoat
      ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: 0.6, clearcoatRoughness: 0.16 })
      : new THREE.MeshStandardMaterial(params);
    standard.onBeforeCompile = (shader) => {
      injectVertex(shader);
      shader.fragmentShader = prelude(shader.fragmentShader)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurface.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurface.y;')
        .replace(
          '#include <lights_physical_fragment>',
          '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vSurface.w;\n#endif'
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;');
    };
    standard.customProgramCacheKey = () => `bf-surface-${p.clearcoat ? 'physical' : 'standard'}`;
    material = standard;
  }
  cache.set(materials, material);
  return material;
}

function injectVertex(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;');
}

function prelude(fragment: string) {
  return fragment.replace('#include <common>', '#include <common>\nvarying vec4 vSurface;');
}

const tmpColor = new THREE.Color();

/** Adds `color` (linear) and `surface` attributes so a piece can merge with others. */
export function paint(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, surface: Surface) {
  const count = geometry.getAttribute('position').count;
  tmpColor.set(color);
  const s = SURFACES[surface];
  const colors = new Float32Array(count * 3);
  const surf = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
    surf[i * 4] = s[0];
    surf[i * 4 + 1] = s[1];
    surf[i * 4 + 2] = s[2];
    surf[i * 4 + 3] = s[3];
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('surface', new THREE.BufferAttribute(surf, 4));
  return geometry;
}

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
  /** Recesses and bores: dull, no coat, so they read as depth. Also painted polymer, which then keeps its colour under a raking light or a bright surround. */
  dark: [0.75, 0, 0, 0]
};

const cache = new WeakMap<Materials, THREE.Material>();
const wornCache = new WeakMap<Materials, THREE.Material>();

/**
 * The shared vertex-colored material for weapon and arm geometry on this tier. `worn` (first-person guns, lit tiers):
 * chipped edges, rubbed patches and a firmer split between toy plastic, metal and rubber (see WEAR).
 */
export function surfaceMaterial(materials: Materials, worn = false): THREE.Material {
  const p = materials.profile;
  worn &&= p.pbr;
  let material = (worn ? wornCache : cache).get(materials);
  if (material) return material;
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
      injectVertex(shader, worn);
      shader.fragmentShader = prelude(shader.fragmentShader, worn)
        .replace('#include <color_fragment>', worn ? WEAR.color : '#include <color_fragment>')
        .replace('#include <roughnessmap_fragment>', worn ? WEAR.roughness : 'float roughnessFactor = vSurface.x;')
        .replace('#include <metalnessmap_fragment>', worn ? WEAR.metalness : 'float metalnessFactor = vSurface.y;')
        .replace(
          '#include <lights_physical_fragment>',
          '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vSurface.w;\n#endif'
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vSurface.z;');
    };
    standard.customProgramCacheKey = () => `bf-surface-${p.clearcoat ? 'physical' : 'standard'}${worn ? '-worn' : ''}`;
    material = standard;
  }
  (worn ? wornCache : cache).set(materials, material);
  return material;
}

/**
 * First-person wear, in the part's own space so it rides the gun and its moving parts. Finishes are told apart by
 * their baked [roughness, metalness, emissive, clearcoat]: metal (metalness), satin paint (0.55), toy plastic
 * (clearcoat), rubber (roughest); glow and the dull recess finish keep their look. Chamfered edges (the `wear`
 * attribute) are a little lighter all along and chip in patches: dark paint down to bare steel, lighter paint, plastic
 * and metal lighter where rubbed.
 * Broad rubbed patches vary every finish a little; rubber gets a fine stipple and polish on metal stays crisp.
 */
const WEAR = {
  head: /* glsl */ `
varying vec3 vWearPos;
varying float vWear;
float wearHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float wearNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(wearHash(i), wearHash(i + vec3(1, 0, 0)), f.x), mix(wearHash(i + vec3(0, 1, 0)), wearHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(wearHash(i + vec3(0, 0, 1)), wearHash(i + vec3(1, 0, 1)), f.x), mix(wearHash(i + vec3(0, 1, 1)), wearHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`,
  color: /* glsl */ `#include <color_fragment>
float wearLive = 1.0 - step(0.01, vSurface.z);
float wearMetal = step(0.5, vSurface.y) * step(0.2, vSurface.x);
float wearPaint = step(0.5, vSurface.x) * (1.0 - step(0.6, vSurface.x)) * (1.0 - step(0.5, vSurface.y));
float wearPlastic = step(0.5, vSurface.w) * (1.0 - step(0.5, vSurface.y));
float wearRubber = step(0.8, vSurface.x) * wearLive;
float wearPatch = wearNoise(vWearPos * 70.0);
float wearGrain = wearNoise(vWearPos * 1100.0);
float wearChip = vWear * (0.3 + 0.7 * smoothstep(0.32, 0.56, wearNoise(vWearPos * 180.0 + 7.0)));
float wearBare = wearPaint * (1.0 - smoothstep(0.03, 0.1, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))));
diffuseColor.rgb *= 1.0 + wearLive * (wearPatch - 0.5) * 0.13 - wearRubber * (wearGrain - 0.5) * 0.22;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.52, 0.55), wearChip * wearBare * 0.8);
diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.45 + 0.025, vec3(1.0)), wearChip * (wearPlastic * 0.55 + wearMetal * 0.7 + (wearPaint - wearBare) * 0.5));`,
  roughness: /* glsl */ `float roughnessFactor = vSurface.x * (1.0 - 0.18 * wearMetal - 0.12 * wearPlastic) + 0.08 * wearRubber;
roughnessFactor += wearLive * (1.0 - wearMetal) * (wearPatch - 0.5) * 0.24 - wearChip * (0.25 * wearBare + 0.12 * wearMetal);
roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);`,
  metalness: /* glsl */ `float metalnessFactor = max(vSurface.y, 0.95 * wearMetal) + wearChip * wearBare * 0.8;`
};

/** Lens opacity at the hip (a mild tinted sheen) and once aimed (clear: reflections fade with it). */
const LENS_HIP = { pbr: 0.3, phong: 0.38 };
const LENS_AIMED = 0.035;
const lensCache = new WeakMap<Materials, Map<string, THREE.MeshStandardMaterial | THREE.MeshPhongMaterial>>();

/** First-person lens glass of one tint on this tier; `aimLenses` clears every lens as the sight comes up. */
export function lensMaterial(materials: Materials, color: string): THREE.Material {
  let lenses = lensCache.get(materials);
  if (!lenses) lensCache.set(materials, (lenses = new Map()));
  let material = lenses.get(color);
  if (!material) {
    const base = { color, transparent: true, depthWrite: false };
    material = materials.profile.pbr
      ? new THREE.MeshStandardMaterial({ ...base, roughness: 0.08, metalness: 0, opacity: LENS_HIP.pbr, envMapIntensity: 1 })
      : new THREE.MeshPhongMaterial({ ...base, specular: 0x555555, shininess: 90, opacity: LENS_HIP.phong });
    lenses.set(color, material);
  }
  return material;
}

/** Fade every lens of this tier from its hip sheen (`aim` 0) to clear glass (1). */
export function aimLenses(materials: Materials, aim: number) {
  const hip = materials.profile.pbr ? LENS_HIP.pbr : LENS_HIP.phong;
  for (const material of lensCache.get(materials)?.values() ?? []) material.opacity = hip + (LENS_AIMED - hip) * aim;
}

function injectVertex(shader: THREE.WebGLProgramParametersWithUniforms, worn = false) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec4 surface;\nvarying vec4 vSurface;${worn ? '\nattribute float wear;\nvarying vec3 vWearPos;\nvarying float vWear;' : ''}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSurface = surface;${worn ? '\nvWearPos = position;\nvWear = wear;' : ''}`);
}

function prelude(fragment: string, worn = false) {
  return fragment.replace('#include <common>', `#include <common>\nvarying vec4 vSurface;${worn ? WEAR.head : ''}`);
}

const tmpColor = new THREE.Color();

/** How a shape's chamfers lie: the cut edges of a box, or the bevel ring of an outline extruded along x or z. */
export type Edges = 'box' | 'x' | 'z';

/** Whether a face with this normal is one of the shape's chamfers. */
function chamfer(edges: Edges, x: number, y: number, z: number) {
  if (edges === 'box') return (Math.abs(x) > 0.3 ? 1 : 0) + (Math.abs(y) > 0.3 ? 1 : 0) + (Math.abs(z) > 0.3 ? 1 : 0) >= 2;
  const along = Math.abs(edges === 'x' ? x : z);
  return along > 0.3 && along < 0.92;
}

/**
 * Adds `color` (linear) and `surface` attributes so a piece can merge with others. `edges` (first-person pieces) adds
 * the `wear` attribute, 1 on the shape's chamfers; null adds it empty.
 */
export function paint(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, surface: Surface, edges?: Edges | null) {
  const count = geometry.getAttribute('position').count;
  if (edges !== undefined) {
    const wear = new Float32Array(count);
    const n = geometry.getAttribute('normal');
    if (edges && n) for (let i = 0; i < count; i++) wear[i] = chamfer(edges, n.getX(i), n.getY(i), n.getZ(i)) ? 1 : 0;
    geometry.setAttribute('wear', new THREE.BufferAttribute(wear, 1));
  }
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

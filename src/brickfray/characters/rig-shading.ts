import * as THREE from 'three';
import type { CharacterMaterial } from './material';
import { BONE } from './skeleton';

const capeLengths = new WeakMap<THREE.BufferGeometry, number>();
const point = new THREE.Vector3();

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

/** Where the last hit landed (world xyz) and how strongly it still shows (w, 0…1). */
export interface HitUniform {
  value: THREE.Vector4;
}

/**
 * A hit shows where it landed: a hot spot a hand wide that fades to a warm tint over a body part, never the whole
 * figure (a full-body flash reads as a power-up).
 */
const HIT_TINT = `
float hitD = distance(vHitPos, uHit.xyz);
float hitCore = uHit.w * (1.0 - smoothstep(0.02, 0.11, hitD));
float hitSpread = uHit.w * (1.0 - smoothstep(0.06, 0.26, hitD));
totalEmissiveRadiance += vec3(1.0, 0.36, 0.16) * hitSpread * 0.9 + vec3(1.0, 0.9, 0.7) * hitCore * hitCore * 1.4;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.2, 0.1), 0.45 * hitSpread);`;

export interface CapeUniforms {
  /** Bind space to the back bone's space and back. */
  into: { value: THREE.Matrix4 };
  out: { value: THREE.Matrix4 };
  /** The bone's swing away from the back (rad, <= 0), the cloth's length below it (m), a clock (s) and the wind of running (rad the hem streams back). */
  bend: { value: THREE.Vector4 };
}

/**
 * The back cloth rides one rigid bone: swung out it would stand off the back as a flat board. Instead it curves along
 * its length (an arc of the same length): the top stays near the back at 30% of the swing, the hem goes to 140%, and
 * running streams the hem further back with the top still on the shoulders. Swing and wind also cup it (the sides
 * trail the middle), fold it across its width and run a ripple down to the hem; hanging still it is untouched.
 */
const CAPE_PARS = `
uniform mat4 uCapeIn;
uniform mat4 uCapeOut;
uniform vec4 uCapeBend;
vec2 capeTurn(vec2 v, float a) { return vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a)); }`;
const CAPE_NORMAL = `
bool capeOn = false;
vec3 capeP = vec3(0.0);
#ifdef USE_SKINNING
capeOn = (uCapeBend.x < 0.0 || uCapeBend.w > 0.0) && abs(skinIndex.x - ${BONE.dangleBack}.0) < 0.5;
if (capeOn) {
  capeP = (uCapeIn * vec4(position, 1.0)).xyz;
  float capeL = uCapeBend.y;
  float capeS = clamp(-capeP.y, 0.0, capeL);
  float capeU = capeS / capeL;
  float capeK = (1.1 * uCapeBend.x - uCapeBend.w) / capeL;
  float capeAmp = uCapeBend.w - uCapeBend.x;
  float capeTop = -0.7 * uCapeBend.x;
  float capeAngle = capeTop + capeK * capeS;
  float capeH = 0.5 * capeK * capeS;
  float capeSinc = abs(capeH) < 1e-4 ? 1.0 : sin(capeH) / capeH;
  float capeX = clamp(capeP.x / 0.3, -1.0, 1.0);
  float capeWave = 13.0 * uCapeBend.z - 9.0 * capeS;
  float capeFold = 5.0 * capeX + 0.6 * capeWave;
  float capeD = capeAmp * (0.1 * capeX * capeX * capeU + 0.035 * pow(capeU, 1.5) * sin(capeWave) + 0.045 * capeU * sin(capeFold));
  float capeDs = capeAmp * (0.1 * capeX * capeX / capeL + 0.035 * (1.5 * sqrt(capeU) / capeL * sin(capeWave) - 9.0 * pow(capeU, 1.5) * cos(capeWave)) + 0.045 * sin(capeFold) / capeL);
  float capeDx = capeAmp * (0.1 * 2.0 * capeX / 0.3 * capeU + 0.045 * capeU * cos(capeFold) * 5.0 / 0.3);
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
export function farRim(mat: CharacterMaterial, phong: boolean, cape: CapeUniforms, hit: HitUniform): CharacterMaterial {
  const patch = mat.material.onBeforeCompile;
  mat.material.onBeforeCompile = (shader, renderer) => {
    patch.call(mat.material, shader, renderer);
    Object.assign(shader.uniforms, { uCapeIn: cape.into, uCapeOut: cape.out, uCapeBend: cape.bend, uHit: hit });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${CAPE_PARS}\nvarying vec3 vHitPos;`)
      .replace('#include <skinnormal_vertex>', `${CAPE_NORMAL}\n#include <skinnormal_vertex>`)
      .replace('#include <skinning_vertex>', 'if (capeOn) transformed = (uCapeOut * vec4(capeP, 1.0)).xyz;\n#include <skinning_vertex>')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHitPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let fragment = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHitPos;\nuniform vec4 uHit;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 1.8) * smoothstep(9.0, 22.0, length(vViewPosition)) * 0.45 * (1.0 - smoothstep(0.2, 0.7, length(fwidth(normal))));
      ${HIT_TINT}`
      );
    if (!phong) fragment = fragment.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>${FAR_ROUGH}`);
    if (phong) fragment = fragment.replace('#include <lights_phong_fragment>', `#include <lights_phong_fragment>${PHONG_SURFACE}`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${PHONG_SKY}`);
    shader.fragmentShader = fragment;
  };
  mat.material.customProgramCacheKey = () => (phong ? 'bf-character-rim-phong' : 'bf-character-rim');
  return mat;
}

/** How far the back cloth hangs below its bone (m, bone space); 0 when the figure has none. */
export function capeLength(geometry: THREE.BufferGeometry, into: THREE.Matrix4) {
  let length = capeLengths.get(geometry);
  if (length !== undefined) return length;
  length = 0;
  const bone = geometry.getAttribute('skinIndex');
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    if (bone.getX(i) === BONE.dangleBack) length = Math.max(length, -point.fromBufferAttribute(position, i).applyMatrix4(into).y);
  }
  capeLengths.set(geometry, length);
  return length;
}

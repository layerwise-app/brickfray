import * as THREE from 'three';
import { PITCH } from './geometry';
import type { QualityProfile } from './quality';

export interface GroundTile {
  /** Rectangle in meters on the XZ plane; snap to PITCH for clean stud rows. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Top surface height in meters. */
  y: number;
  color: THREE.ColorRepresentation;
  /** Smooth tiles (roads, floors) skip the stud pattern. */
  smooth?: boolean;
  /** Where a raised tile's side walls stop (default 0); a deck top passes its own height for none. */
  base?: number;
  /** Smooth tiles only: a rough finish (asphalt) instead of glossy plastic, so it does not mirror the sky. */
  matte?: boolean;
}

const textureCache = new Map<string, { map: THREE.Texture; normal: THREE.Texture; mean: number }>();

/** Metres from the camera over which the stud pattern gives way to a plain plate (it shimmers once a cell is a few pixels). */
const STUD_FADE_FROM = 5;
const STUD_FADE_TO = 14;

/** Stud radius and height in stud cells, matching the brick studs (STUD_RADIUS and STUD_HEIGHT over PITCH). */
const STUD_GLSL = /* glsl */ `
varying float vStud;
const float STUD_R = 0.3;
const float STUD_H = 0.2125;
// First stud met walking from p + d (height STUD_H) down to p (height 0): returns the fraction s of that walk, 1 for
// the top cap, or -1. Five probes along the walk, at most 0.63 cells apart, visit every cell whose stud it can touch.
float studHit(vec2 p, vec2 d, out vec2 center) {
  float best = -1.0;
  float a = max(dot(d, d), 1e-6);
  for (int k = 0; k < 5; k++) {
    vec2 c = floor(p + d * (float(k) * 0.25)) + 0.5;
    vec2 o = p - c;
    float b = dot(o, d);
    float disc = b * b - a * (dot(o, o) - STUD_R * STUD_R);
    if (disc < 0.0) continue;
    float q = sqrt(disc);
    float s = min((q - b) / a, 1.0);
    if ((-q - b) / a > 1.0 || s < 0.0 || s <= best) continue;
    best = s;
    center = c;
  }
  return best;
}
vec2 studWalk(vec3 dir) {
  vec2 d = dir.xz / max(dir.y, 0.02) * STUD_H;
  return d * min(1.0, 2.5 / max(length(d), 1e-4));
}
`;

/**
 * Near the camera every stud is ray traced against the flat plate, so it stands up with a lit cap, a shaded wall and
 * a shadow toward the sun; studs too small on screen fade back to the normal-mapped texture.
 */
const STUD_TRACE = /* glsl */ `
vec3 studN = vec3(0.0, 1.0, 0.0);
float studShade = 1.0;
// Sun reaching this point past the plate's own studs, and where the stud surface really is (world offset from the
// plate point), so the shadow map is read on the stud instead of on the plate under it.
float studSun = 1.0;
vec3 studLift = vec3(0.0);
vec3 studBase = diffuseColor.rgb;
vec2 studFw = fwidth(vMapUv);
float studK = step(0.5, vStud) * (1.0 - smoothstep(0.07, 0.15, max(studFw.x, studFw.y)));
if (studK > 0.0) {
  vec3 toEye = normalize((vec4(vViewPosition, 0.0) * viewMatrix).xyz);
  vec2 d = studWalk(toEye);
  studK *= smoothstep(0.04, 0.08, toEye.y);
  vec2 c;
  float s = studHit(vMapUv, d, c);
  if (s < 0.0) {
    float r = length(fract(vMapUv) - 0.5);
    studShade = 1.0 - 0.14 * exp(-pow((r - STUD_R) / 0.05, 2.0));
    #if NUM_DIR_LIGHTS > 0 && defined(STUD_SHADOWS)
    vec3 toSun = normalize((vec4(directionalLights[0].direction, 0.0) * viewMatrix).xyz);
    vec2 c2;
    // Partial: the sunlit side of the stud bounces warm light into its own shadow; without it low suns turn the floor sky-blue.
    if (toSun.y > 0.05 && studHit(vMapUv, studWalk(toSun), c2) >= 0.0) studSun = 1.0 - 0.55 * studK;
    #endif
  } else {
    studLift = vec3(d.x, STUD_H, d.y) * (s * 0.4 * studK);
    vec2 radial = (vMapUv + d * s - c) / STUD_R;
    if (s >= 1.0) {
      float rim = smoothstep(0.8, 1.0, length(radial)) * 0.9;
      studN = normalize(vec3(radial.x * rim, 1.0, radial.y * rim));
      studShade = 1.05;
    } else {
      radial = normalize(radial);
      studN = normalize(vec3(radial.x, smoothstep(0.85, 1.0, s) * 0.9, radial.y));
      studShade = 0.72 + 0.3 * s;
    }
  }
}
`;

/** Past a few metres the plate turns plain: its colour the stud texture's mean, its normal flat. */
const STUD_FAR = /* glsl */ `
float studFar = step(0.5, vStud) * smoothstep(float(STUD_FADE_FROM), float(STUD_FADE_TO), length(vViewPosition));
diffuseColor.rgb = mix(diffuseColor.rgb, studBase * float(STUD_MEAN), studFar);
`;

const SUN_SHADOW =
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const STUD_SUN_SHADOW = /* glsl */ `
studLit = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] + directionalShadowMatrix[ i ] * vec4( studLift, 0.0 ) ) : 1.0;
directLight.color *= studLit * studSun;`;

/** Asphalt is rough and grey: half the sky reflection, and its sky light mostly desaturated so shade reads dark grey, not navy. */
const MATTE_LIGHT = /* glsl */ `
#if defined( RE_IndirectDiffuse )
irradiance = mix(irradiance, vec3(dot(irradiance, vec3(0.2126, 0.7152, 0.0722))), 0.6 * studMatte);
iblIrradiance = mix(iblIrradiance, vec3(dot(iblIrradiance, vec3(0.2126, 0.7152, 0.0722))), 0.6 * studMatte);
#endif
#if defined( RE_IndirectSpecular )
radiance *= 1.0 - 0.3 * studMatte;
#endif`;

/**
 * The sun's shadow is read at the traced stud point and the plate's stud shadows dim the sun only, so a shadow
 * falls on studs the way it falls on bricks. In shade, sky light takes a normal pulled up on stud walls: walls and
 * caps darken together instead of the caps turning sky-blue while the walls keep the warm horizon light.
 */
function studLighting() {
  const begin = THREE.ShaderChunk.lights_fragment_begin
    .replace('vec3 geometryNormal = normal;', 'vec3 geometryNormal = normal;\nfloat studLit = 1.0;')
    .replace(SUN_SHADOW, STUD_SUN_SHADOW)
    .replace(
      'vec3 iblIrradiance = vec3( 0.0 );',
      'vec3 iblIrradiance = vec3( 0.0 );\nvec3 studSkyN = normalize(mix(geometryNormal, (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz, 0.75 * studK * (1.0 - studLit)));'
    )
    .replace('getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal )', 'getHemisphereLightIrradiance( hemisphereLights[ i ], studSkyN )');
  const maps = THREE.ShaderChunk.lights_fragment_maps.replace('getIBLIrradiance( geometryNormal )', 'getIBLIrradiance( studSkyN )');
  if (!begin.includes('studLit * studSun') || !begin.includes('vec3 studSkyN') || !begin.includes('studSkyN );') || maps === THREE.ShaderChunk.lights_fragment_maps) {
    throw new Error('three light chunks changed: stud lighting not patched');
  }
  return `${begin}\n${maps}\n${MATTE_LIGHT}`;
}

function traceStuds(material: THREE.Material, shadows: boolean, mean: number) {
  material.defines = { ...material.defines, STUD_MEAN: mean.toFixed(4), STUD_FADE_FROM: STUD_FADE_FROM.toFixed(1), STUD_FADE_TO: STUD_FADE_TO.toFixed(1) };
  if (shadows) material.defines.STUD_SHADOWS = '';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float stud;\nvarying float vStud;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvStud = stud;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${STUD_GLSL}`)
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\nuniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n#endif')
      .replace('#include <map_fragment>', `float studMatte = step(vStud, -0.5);\n${STUD_TRACE}\n#include <map_fragment>\n${STUD_FAR}\ndiffuseColor.rgb = mix(diffuseColor.rgb, studBase * studShade, studK);`)
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, studFar));\nnormal = normalize(mix(normal, (viewMatrix * vec4(studN, 0.0)).xyz, studK));'
      )
      .replace('#include <specularmap_fragment>', '#include <specularmap_fragment>\nspecularStrength *= 1.0 - 0.8 * studMatte;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, studMatte);')
      .replace('#include <lights_fragment_begin>', studLighting())
      .replace('#include <lights_fragment_maps>', '');
  };
}

/**
 * One stud cell as a height field: a raised disc with a soft shoulder. The
 * normal map gives every baseplate real-looking studs at no geometry cost.
 */
function studTextures(size: number) {
  const key = String(size);
  const hit = textureCache.get(key);
  if (hit) return hit;
  const height = new Float32Array(size * size);
  const r = size * 0.3;
  const edge = size * 0.035;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const d = Math.hypot(dx, dy);
      const t = THREE.MathUtils.smoothstep(r + edge, r - edge, d);
      const seam = Math.max(Math.abs(dx), Math.abs(dy)) > size / 2 - 1.2 ? -0.08 : 0;
      height[y * size + x] = t + seam;
    }
  }
  const normalData = new Uint8Array(size * size * 4);
  const colorData = new Uint8Array(size * size * 4);
  const strength = size * 0.05;
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
      const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      normalData[i] = ((nx / len) * 0.5 + 0.5) * 255;
      normalData[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalData[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normalData[i + 3] = 255;
      // Contact shadow around the stud base and a faint lighter cap.
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const d = Math.hypot(dx, dy);
      const ring = Math.exp(-(((d - r - edge * 1.6) / (size * 0.06)) ** 2));
      const cap = THREE.MathUtils.smoothstep(r - edge, r * 0.4, d);
      const shade = 1 - ring * 0.16 + cap * 0.04 - (at(x, y) < 0 ? 0.12 : 0);
      const v = Math.round(THREE.MathUtils.clamp(shade, 0, 1) * 255);
      colorData[i] = v;
      colorData[i + 1] = v;
      colorData[i + 2] = v;
      colorData[i + 3] = 255;
    }
  }
  const make = (data: Uint8Array<ArrayBuffer>, srgb: boolean) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };
  let sum = 0;
  const linear = new THREE.Color();
  for (let i = 0; i < colorData.length; i += 4) sum += linear.setRGB(colorData[i]! / 255, 0, 0, THREE.SRGBColorSpace).r;
  const result = { map: make(colorData, true), normal: make(normalData, false), mean: sum / (size * size) };
  textureCache.set(key, result);
  return result;
}

/**
 * Baseplate ground: every tile becomes a quad (plus side walls when raised)
 * with stud UVs in world space, so all tiles share one draw call.
 */
export function buildGround(tiles: GroundTile[], profile: QualityProfile): THREE.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const stud: number[] = [];
  const color = new THREE.Color();
  // stud: 1 studded, 0 smooth, -1 smooth and matte.
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], studs: boolean, matte = false) => {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      normals.push(n[0]!, n[1]!, n[2]!);
      // Smooth tiles sample the flat corner of the stud cell.
      if (studs) uvs.push(p[0]! / PITCH, p[2]! / PITCH);
      else uvs.push(0.02, 0.02);
      colors.push(color.r, color.g, color.b);
      stud.push(studs ? 1 : matte ? -1 : 0);
    }
  };
  for (const t of tiles) {
    color.set(t.color);
    const studs = !t.smooth;
    quad([t.x0, t.y, t.z0], [t.x0, t.y, t.z1], [t.x1, t.y, t.z1], [t.x1, t.y, t.z0], [0, 1, 0], studs, !studs && !!t.matte);
    const y0 = t.base ?? 0;
    if (t.y - y0 > 0.001) {
      color.multiplyScalar(0.92);
      quad([t.x0, y0, t.z1], [t.x1, y0, t.z1], [t.x1, t.y, t.z1], [t.x0, t.y, t.z1], [0, 0, 1], false);
      quad([t.x1, y0, t.z0], [t.x0, y0, t.z0], [t.x0, t.y, t.z0], [t.x1, t.y, t.z0], [0, 0, -1], false);
      quad([t.x1, y0, t.z1], [t.x1, y0, t.z0], [t.x1, t.y, t.z0], [t.x1, t.y, t.z1], [1, 0, 0], false);
      quad([t.x0, y0, t.z0], [t.x0, y0, t.z1], [t.x0, t.y, t.z1], [t.x0, t.y, t.z0], [-1, 0, 0], false);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('stud', new THREE.Float32BufferAttribute(stud, 1));
  geometry.computeBoundingSphere();
  const tex = studTextures(profile.level === 'low' ? 64 : 128);
  const material = profile.pbr
    ? new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: tex.map,
        normalMap: tex.normal,
        normalScale: new THREE.Vector2(1, -1),
        roughness: 0.42,
        envMapIntensity: 0.7
      })
    : new THREE.MeshPhongMaterial({
        vertexColors: true,
        map: tex.map,
        normalMap: tex.normal,
        normalScale: new THREE.Vector2(0.8, -0.8),
        shininess: 22,
        specular: 0x1a1a1a
      });
  traceStuds(material, profile.level !== 'low', tex.mean);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ground';
  mesh.receiveShadow = profile.shadows;
  return mesh;
}

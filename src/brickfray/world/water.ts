import * as THREE from 'three';
import type { Kit } from '../engine/kit';

export interface WaterRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  color: string;
}

export interface Sky {
  zenith: string;
  horizon: string;
}

let ripples: THREE.DataTexture | null = null;

/**
 * Tileable ripple slopes (rg) and height (b) from twenty waves of random direction on the integer lattice, so the
 * pattern has no dominant diagonal and two layers at unrelated scales never line up into a visible repeat.
 */
function rippleTexture() {
  if (ripples) return ripples;
  const size = 128;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const waves: { kx: number; ky: number; a: number; p: number }[] = [];
  while (waves.length < 20) {
    const kx = Math.round((rand() - 0.5) * 22);
    const ky = Math.round((rand() - 0.5) * 22);
    const k = Math.hypot(kx, ky);
    if (k < 3 || k > 11) continue;
    waves.push({ kx, ky, a: 1 / k, p: rand() * Math.PI * 2 });
  }
  const data = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  const slopes = new Float32Array(size * size * 3);
  let max = 1e-6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const ph = tau * (w.kx * x + w.ky * y) / size + w.p;
        h += w.a * Math.sin(ph);
        dx += w.a * w.kx * Math.cos(ph);
        dy += w.a * w.ky * Math.cos(ph);
      }
      const i = (y * size + x) * 3;
      slopes[i] = dx;
      slopes[i + 1] = dy;
      slopes[i + 2] = h;
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
  }
  let hmax = 1e-6;
  for (let i = 2; i < slopes.length; i += 3) hmax = Math.max(hmax, Math.abs(slopes[i]!));
  for (let p = 0; p < size * size; p++) {
    data[p * 4] = Math.round((slopes[p * 3]! / max) * 127.5 + 127.5);
    data[p * 4 + 1] = Math.round((slopes[p * 3 + 1]! / max) * 127.5 + 127.5);
    data[p * 4 + 2] = Math.round((slopes[p * 3 + 2]! / hmax) * 127.5 + 127.5);
    data[p * 4 + 3] = 255;
  }
  ripples = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  ripples.magFilter = THREE.LinearFilter;
  ripples.minFilter = THREE.LinearMipmapLinearFilter;
  ripples.generateMipmaps = true;
  ripples.anisotropy = 4;
  ripples.needsUpdate = true;
  return ripples;
}

const VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
vWaterW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vWaterW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`;

/**
 * Three ripple layers at unrelated scales, scrolling apart, under slow calm/choppy patches; each layer flattens once
 * its ripples get smaller than a few pixels, so far water turns into a smooth mirror of the sky instead of a
 * repeating pattern. Seen from above, reflection is too weak to show the ripples (and shaded water gets no sun
 * glints), so crests and troughs also lighten and darken the water itself, more the steeper the view.
 */
const NORMAL = /* glsl */ `
vec2 wp = vWaterW.xz;
vec2 uv1 = mat2(0.866, -0.5, 0.5, 0.866) * wp / 6.5 + vec2(0.013, 0.008) * uTime;
vec2 uv2 = mat2(0.423, 0.906, -0.906, 0.423) * wp / 17.0 + vec2(-0.006, 0.01) * uTime;
vec2 uv3 = mat2(-0.259, 0.966, -0.966, -0.259) * wp / 2.3 + vec2(0.02, -0.031) * uTime;
vec4 r1 = texture2D(uRipple, uv1);
vec4 r2 = texture2D(uRipple, uv2);
vec4 r3 = texture2D(uRipple, uv3);
float k1 = 1.0 - smoothstep(0.012, 0.05, max(fwidth(uv1.x), fwidth(uv1.y)));
float k2 = 1.0 - smoothstep(0.012, 0.05, max(fwidth(uv2.x), fwidth(uv2.y)));
float k3 = 1.0 - smoothstep(0.012, 0.05, max(fwidth(uv3.x), fwidth(uv3.y)));
float calm = 0.5 + 0.5 * sin(wp.x * 0.047 + 2.0 * sin(wp.y * 0.031 + uTime * 0.05)) * sin(wp.y * 0.039 - uTime * 0.035);
float chop = mix(0.35, 1.0, calm);
vec2 slope = ((r1.rg - 0.5) * k1 * 0.2 + (r2.rg - 0.5) * k2 * 0.28 + (r3.rg - 0.5) * k3 * 0.14) * chop;
vec3 waterN = normalize(vec3(-slope.x, 1.0, -slope.y));
normal = normalize((viewMatrix * vec4(waterN, 0.0)).xyz);
float crest = ((r1.b - 0.5) * k1 + (r2.b - 0.5) * k2 + (r3.b - 0.5) * k3 * 0.8) * chop;
float facing = clamp(dot(normalize(vViewPosition), (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.0, 1.0);
diffuseColor.rgb *= 1.0 + (0.12 + 0.3 * facing) * crest;
float crestW = fwidth(crest) + 0.015;
float glint = smoothstep(0.3 - crestW, 0.3 + crestW, crest);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(uHorizon, vec3(1.0), 0.4), glint * (0.2 + 0.3 * facing));`;

/** Without an environment map (low tier) the sky's reflection is added by hand, with the same Fresnel falloff. */
const FAKE_SKY = /* glsl */ `
vec3 toEyeW = normalize(cameraPosition - vWaterW);
float fres = 0.04 + 0.96 * pow(1.0 - max(dot(waterN, toEyeW), 0.0), 5.0);
vec3 skyDir = reflect(-toEyeW, waterN);
outgoingLight = mix(outgoingLight, mix(uHorizon, uZenith, smoothstep(0.0, 0.5, skyDir.y)), fres * 0.85);`;

/** All water rectangles of a map as one mesh with the ripple shader; returns the mesh and its clock. */
export function buildWater(rects: WaterRect[], kit: Kit, sky: Sky) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const w of rects) {
    c.set(w.color);
    for (const [x, z] of [[w.x0, w.z0], [w.x0, w.z1], [w.x1, w.z1], [w.x0, w.z0], [w.x1, w.z1], [w.x1, w.z0]] as const) {
      pos.push(x, w.y, z);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const p = kit.profile;
  const uniforms = {
    uRipple: { value: rippleTexture() },
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color(sky.zenith) },
    uHorizon: { value: new THREE.Color(sky.horizon) }
  };
  const material = p.pbr
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0, envMapIntensity: 1.1 })
    : new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x3a4a50 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterW;')
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterW;\nuniform sampler2D uRipple;\nuniform float uTime;\nuniform vec3 uZenith;\nuniform vec3 uHorizon;')
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <opaque_fragment>', `${p.pbr ? '' : FAKE_SKY}\n#include <opaque_fragment>`);
  };
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'water';
  mesh.receiveShadow = p.shadows;
  return {
    mesh,
    update: (t: number) => (uniforms.uTime.value = t),
    dispose() {
      g.dispose();
      material.dispose();
    }
  };
}

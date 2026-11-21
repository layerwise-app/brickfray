import * as THREE from 'three';
import type { QualityProfile } from '../engine/quality';
import type { Vec3 } from './util';

/** bands: horizontal stripes; chevron: field, chevron, optional hem; border: field, border and center lozenge. */
export type FlagPattern = 'bands' | 'chevron' | 'border';

export interface Flag {
  origin: Vec3;
  yaw: number;
  width: number;
  height: number;
  colors: string[];
  /** Pole flags flutter from their side; banners hang from their top edge. */
  hang: boolean;
  pattern: FlagPattern;
}

const PATTERN: Record<FlagPattern, number> = { bands: 0, chevron: 1, border: 2 };

const VERTEX_PARS = /* glsl */ `
attribute vec4 flagCloth;
attribute vec3 flagA;
attribute vec3 flagB;
attribute vec3 flagC;
varying vec4 vFlagCloth;
varying vec3 vFlagA;
varying vec3 vFlagB;
varying vec3 vFlagC;`;

const VERTEX = /* glsl */ `
vFlagCloth = flagCloth;
vFlagA = flagA;
vFlagB = flagB;
vFlagC = flagC;`;

/** The pattern is drawn per pixel, so a coarse cloth grid (low tier) keeps its crest and border. */
const FRAGMENT_PARS = /* glsl */ `
varying vec4 vFlagCloth;
varying vec3 vFlagA;
varying vec3 vFlagB;
varying vec3 vFlagC;
float flagEdge(float x, float w) { return smoothstep(-w, w, x); }
vec3 flagRGB() {
  float u = vFlagCloth.x;
  float v = vFlagCloth.y;
  float kind = floor(vFlagCloth.z / 10.0 + 0.01);
  float n = vFlagCloth.z - kind * 10.0;
  float aspect = vFlagCloth.w;
  vec2 px = max(fwidth(vFlagCloth.xy), vec2(1e-4)) * 0.7;
  if (kind < 0.5) {
    float idx = v * n;
    vec3 c = mix(vFlagA, vFlagB, flagEdge(idx - 1.0, px.y * n) * step(1.5, n));
    return mix(c, vFlagC, flagEdge(idx - 2.0, px.y * n) * step(2.5, n));
  }
  if (kind < 1.5) {
    float d = v - (0.3 + abs(u - 0.5) * 0.9);
    float w = px.y + 0.9 * px.x;
    vec3 c = mix(vFlagA, vFlagB, flagEdge(d, w) * flagEdge(0.16 - d, w));
    return mix(c, vFlagC, flagEdge(v - 0.88, px.y) * step(2.5, n));
  }
  float edge = min(min(u, 1.0 - u), min(v, 1.0 - v) * aspect);
  float lozenge = 0.24 - (abs(u - 0.5) * 1.6 + abs(v - 0.5));
  return mix(vFlagA, vFlagB, max(flagEdge(0.1 - edge, max(px.x, px.y * aspect)), flagEdge(lozenge, 1.6 * px.x + px.y)));
}`;

/** Every flag and banner of a map as one cloth mesh, waved on the CPU. */
export function buildFlags(flags: Flag[], p: QualityProfile) {
  const base: number[] = [];
  const cloth: number[] = [];
  const colors: [number[], number[], number[]] = [[], [], []];
  const info: number[] = [];
  const c = new THREE.Color();
  flags.forEach((f, fi) => {
    const cols = p.detail >= 1 ? 12 : 4;
    const rows = p.detail >= 1 ? (f.hang ? 14 : 8) : f.hang ? 4 : 2;
    const ca = Math.cos(f.yaw);
    const sa = Math.sin(f.yaw);
    const fill = [f.colors[0]!, f.colors[1] ?? f.colors[0]!, f.colors[2] ?? f.colors[1] ?? f.colors[0]!];
    const vert = (k: number, r: number) => {
      const u = k / cols;
      const v = r / rows;
      base.push(f.origin[0] + ca * u * f.width, f.origin[1] - v * f.height, f.origin[2] - sa * u * f.width);
      cloth.push(u, v, PATTERN[f.pattern] * 10 + Math.min(9, f.colors.length), f.height / f.width);
      fill.forEach((hex, i) => colors[i]!.push(...c.set(hex).toArray()));
      info.push(f.hang ? v : u, fi * 1.7, sa, ca, u);
    };
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        for (const [dk, dr] of [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]] as const) vert(k + dk, r + dr);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(base);
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('flagCloth', new THREE.Float32BufferAttribute(cloth, 4));
  g.setAttribute('flagA', new THREE.Float32BufferAttribute(colors[0], 3));
  g.setAttribute('flagB', new THREE.Float32BufferAttribute(colors[1], 3));
  g.setAttribute('flagC', new THREE.Float32BufferAttribute(colors[2], 3));
  g.computeVertexNormals();
  const m = p.pbr
    ? new THREE.MeshStandardMaterial({ roughness: 0.62, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= flagRGB();');
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'flags';
  mesh.castShadow = p.shadows;
  return {
    mesh,
    update(t: number) {
      for (let i = 0; i < positions.length / 3; i++) {
        const w = info[i * 5]!;
        const phase = info[i * 5 + 1]!;
        const along = info[i * 5 + 4]!;
        const amp = w * 0.16;
        const off = Math.sin(t * 3.1 + phase - along * 5.5) * amp + Math.sin(t * 1.7 + phase * 2 - along * 3) * amp * 0.5;
        positions[i * 3] = base[i * 3]! + info[i * 5 + 2]! * off;
        positions[i * 3 + 2] = base[i * 3 + 2]! + info[i * 5 + 3]! * off;
      }
      g.getAttribute('position').needsUpdate = true;
      if (p.detail >= 1) g.computeVertexNormals();
    },
    dispose() {
      g.dispose();
      m.dispose();
    }
  };
}

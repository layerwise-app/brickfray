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
}

const textureCache = new Map<string, { map: THREE.Texture; normal: THREE.Texture }>();

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
      const shade = 1 - ring * 0.28 + cap * 0.04 + at(x, y) * 0 - (at(x, y) < 0 ? 0.12 : 0);
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
  const result = { map: make(colorData, true), normal: make(normalData, false) };
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
  const color = new THREE.Color();
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], studs: boolean) => {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(p[0]!, p[1]!, p[2]!);
      normals.push(n[0]!, n[1]!, n[2]!);
      // Smooth tiles sample the flat corner of the stud cell.
      if (studs) uvs.push(p[0]! / PITCH, p[2]! / PITCH);
      else uvs.push(0.02, 0.02);
      colors.push(color.r, color.g, color.b);
    }
  };
  for (const t of tiles) {
    color.set(t.color);
    const studs = !t.smooth;
    quad([t.x0, t.y, t.z0], [t.x0, t.y, t.z1], [t.x1, t.y, t.z1], [t.x1, t.y, t.z0], [0, 1, 0], studs);
    if (t.y > 0.001) {
      color.multiplyScalar(0.92);
      const y0 = 0;
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
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ground';
  mesh.receiveShadow = profile.shadows;
  return mesh;
}

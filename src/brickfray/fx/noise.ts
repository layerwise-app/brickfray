import * as THREE from 'three';

const SIZE = 128;

/** Tileable value-noise fbm in [0, 1]: `period` lattice cells across the tile for the first octave. */
function fbm(seed: number, period: number, octaves: number): Float32Array {
  const out = new Float32Array(SIZE * SIZE);
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = period << o;
    const lattice = new Float32Array(cells * cells);
    let s = (seed * 9301 + o * 49297 + 233280) >>> 0;
    for (let i = 0; i < lattice.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      lattice[i] = s / 4294967296;
    }
    const step = SIZE / cells;
    for (let y = 0; y < SIZE; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy);
      const ty = gy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < SIZE; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx);
        const tx = gx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const at = (cx: number, cy: number) => lattice[(cy % cells) * cells + (cx % cells)]!;
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * SIZE + x]! += (top + (bottom - top) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
}

let shared: THREE.DataTexture | null = null;

/** Four independent tileable cloud noises (one per channel) for shading fire and smoke; built once. */
export function noiseTexture(): THREE.DataTexture {
  if (shared) return shared;
  const channels = [fbm(1, 4, 4), fbm(2, 6, 3), fbm(3, 3, 4), fbm(4, 8, 2)];
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 4; c++) {
      // fbm piles up around 0.5; stretch it back toward the full range.
      const n = (channels[c]![i]! - 0.5) * 1.9 + 0.5;
      data[i * 4 + c] = Math.round(THREE.MathUtils.clamp(n, 0, 1) * 255);
    }
  }
  shared = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.magFilter = THREE.LinearFilter;
  shared.minFilter = THREE.LinearMipmapLinearFilter;
  shared.generateMipmaps = true;
  shared.needsUpdate = true;
  return shared;
}

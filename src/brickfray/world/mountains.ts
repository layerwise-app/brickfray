import type * as THREE from 'three';
import { Mesher, V } from './geo';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng } from './util';

export interface RangeOptions {
  count: number;
  dist: [number, number];
  radius: [number, number];
  height: [number, number];
  haze: string;
  seed: number;
  rock: string[];
  /** Meadow at the foot of each mountain. */
  slope: string;
  /** Conifer band between the meadow and the bare rock. */
  forest?: string;
  /** Green hills: wooded lower layers under a meadow top, no rock or snow. */
  green?: boolean;
}

type Zone = 'meadow' | 'forest' | 'rock' | 'snow';
const ZONES: Zone[] = ['meadow', 'forest', 'rock', 'snow'];

/**
 * Far mountains built like stacked plates: each massif is a pile of flat-topped layers whose outlines follow a
 * few random spurs, so the silhouette steps like a brick model. Layers are coloured by height into meadow, a
 * conifer band with small trees on its terraces, bare rock and snow caps, all tinted toward the haze.
 */
export function mountainRange(d: Drawer, o: RangeOptions) {
  const rng = new Rng(o.seed);
  const f = new Frame(0, 0, 0);
  const t = new Pen(d, f);
  const segs = [10, 13, 16][d.detail]!;
  const step = d.detail === 0 ? 4.8 : 3.2;
  for (let i = 0; i < o.count; i++) {
    const a = ((i + rng.range(-0.3, 0.3)) / o.count) * Math.PI * 2;
    const dist = rng.range(...o.dist);
    const r = rng.range(...o.radius);
    const h = rng.range(...o.height);
    const near = o.green ? 0.6 : 1;
    const colors: Record<Zone, string> = {
      meadow: mix(o.slope, o.haze, 0.42 * near),
      forest: mix(o.forest ?? '#3b6a3a', o.haze, 0.38 * near),
      rock: mix(rng.pick(o.rock), o.haze, 0.36),
      snow: mix('#f8f8f6', o.haze, 0.16)
    };
    const shoulders = rng.int(1, 2);
    for (let k = 0; k <= shoulders; k++) {
      const side = k === 0 ? 0 : (k % 2 ? 1 : -1) * rng.range(0.5, 0.85) * r;
      const x = Math.cos(a) * dist - Math.sin(a) * side;
      const z = Math.sin(a) * dist + Math.cos(a) * side;
      const m = terraces(rng, k === 0 ? r : r * rng.range(0.6, 0.8), k === 0 ? h : h * rng.range(0.5, 0.72), segs, step, o.green ?? false);
      for (const zone of ZONES) {
        const g = m.parts[zone];
        if (g) d.put(f, d.uid('mtn'), () => g, x, -2, z, { color: zone === 'snow' ? colors.snow : colors[zone], finish: 'rubber' });
      }
      if (d.detail === 0) continue;
      const tree = mix('#24452a', o.haze, 0.36);
      for (const p of m.trees) t.cone(x + p.x, p.y - 2, z + p.z, p.s * 0.45, 0, p.s, tree, 'rubber', 5);
    }
  }
}

function terraces(rng: Rng, r: number, h: number, segs: number, step: number, green: boolean) {
  const waves = [1, 2, 3].map((n) => ({ n: n + rng.int(0, 2), amp: rng.range(0.1, 0.24) / n, phase: rng.range(0, Math.PI * 2) }));
  const ridge = (th: number) => waves.reduce((s, w) => s + w.amp * Math.sin(w.n * th + w.phase), 0);
  const px = rng.range(-0.12, 0.12) * r;
  const pz = rng.range(-0.12, 0.12) * r;
  const angles = Array.from({ length: segs }, (_, j) => ((j + rng.range(-0.25, 0.25)) / segs) * Math.PI * 2);
  const spurs = angles.map(ridge);
  const layers = Math.max(3, Math.round(h / step));
  const dy = h / layers;
  /** Outline of the smooth massif at height y (same profile as the old faceted peaks). */
  const ring = (y: number) =>
    angles.map((th, j) => {
      const spur = spurs[j]!;
      const tt = Math.min(1, Math.max(0.05, 1 - Math.pow(Math.min(1, y / (h * (1 + 0.8 * spur))), 1 / 1.1)));
      const rr = r * tt * (1 + spur);
      return V(Math.cos(th) * rr + px * (1 - tt), y, Math.sin(th) * rr + pz * (1 - tt));
    });
  const meshes: Record<Zone, Mesher> = { meadow: new Mesher(), forest: new Mesher(), rock: new Mesher(), snow: new Mesher() };
  const trees: { x: number; y: number; z: number; s: number }[] = [];
  const snowLine = rng.range(0.6, 0.72);
  const treeLine = green ? rng.range(0.45, 0.6) : rng.range(0.38, 0.48);
  const outlines = Array.from({ length: layers }, (_, k) => ring((k + 0.5) * dy));
  for (let k = 0; k < layers; k++) {
    const frac = (k + 0.5) / layers + rng.range(-0.04, 0.04);
    const zone: Zone = k === 0 ? 'meadow' : frac < treeLine ? 'forest' : green ? 'meadow' : frac < snowLine ? 'rock' : 'snow';
    const m = meshes[zone];
    const y0 = k * dy;
    const y1 = (k + 1) * dy;
    const out = outlines[k]!;
    const inner = outlines[k + 1];
    const axis = (y: number) => V(px, y, pz);
    for (let j = 0; j < segs; j++) {
      const a = out[j]!;
      const b = out[(j + 1) % segs]!;
      m.poly([V(a.x, y0, a.z), V(b.x, y0, b.z), V(b.x, y1, b.z), V(a.x, y1, a.z)], axis((y0 + y1) / 2));
      if (inner) {
        const c = inner[j]!;
        const e = inner[(j + 1) % segs]!;
        m.poly([V(a.x, y1, a.z), V(b.x, y1, b.z), V(e.x, y1, e.z), V(c.x, y1, c.z)], axis(y1 - 1));
        if (zone === 'forest' && rng.chance(0.12)) {
          const u = rng.range(0.3, 0.7);
          trees.push({ x: a.x * (1 - u) + c.x * u, y: y1, z: a.z * (1 - u) + c.z * u, s: rng.range(3, 5) });
        }
      } else {
        m.poly([V(a.x, y1, a.z), V(b.x, y1, b.z), axis(y1)], axis(y1 - 1));
      }
    }
  }
  const parts = {} as Record<Zone, THREE.BufferGeometry | null>;
  for (const z of ZONES) parts[z] = meshes[z].pos.length ? meshes[z].build() : null;
  return { parts, trees };
}

import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng } from './util';

/** Far scenery: big cheap shapes without colliders, tinted toward the haze. */
const origin = (d: Drawer) => new Pen(d, new Frame(0, 0, 0));

function hazed(color: string, haze: string, t: number) {
  return mix(color, haze, t);
}

/** Ring of distant blocks around a rectangle, skipping a side if asked. */
export function skyline(d: Drawer, opts: { inner: [number, number]; outer: number; haze: string; colors: string[]; seed: number; minH: number; maxH: number; skip?: ('n' | 's' | 'e' | 'w')[] }) {
  const t = origin(d);
  const rng = new Rng(opts.seed);
  const [ix, iz] = opts.inner;
  for (let i = 0; i < (d.detail === 0 ? 70 : 120); i++) {
    const side = rng.int(0, 3);
    const name = (['n', 's', 'e', 'w'] as const)[side]!;
    if (opts.skip?.includes(name)) continue;
    const along = rng.range(-opts.outer, opts.outer);
    const depth = rng.range(0, opts.outer - (side < 2 ? iz : ix));
    const x = side < 2 ? along : (side === 2 ? 1 : -1) * (ix + depth);
    const z = side < 2 ? (side === 0 ? -1 : 1) * (iz + depth) : along;
    if (Math.abs(x) < ix && Math.abs(z) < iz) continue;
    const dist = Math.hypot(x, z);
    const w = rng.range(6, 14);
    const dd = rng.range(6, 14);
    const h = rng.range(opts.minH, opts.maxH) * (0.7 + (dist / opts.outer) * 0.5);
    const fade = Math.min(0.75, Math.max(0.2, (dist - 30) / 120));
    const c = hazed(rng.pick(opts.colors), opts.haze, fade);
    t.box(x, 0, z, w, h, dd, c, undefined, 0);
    if (d.detail > 0) {
      const glass = hazed('#6f8fa8', opts.haze, fade);
      const rows = Math.floor(h / 3.4);
      const nx = -Math.sign(x) * (Math.abs(x) > Math.abs(z) ? 1 : 0);
      const nz = -Math.sign(z) * (Math.abs(z) >= Math.abs(x) ? 1 : 0);
      for (let r = 1; r < rows; r += d.detail === 2 ? 1 : 2) {
        if (nz !== 0) t.box(x, r * 3.4, z + nz * (dd / 2 + 0.02), w * 0.8, 1.2, 0.1, glass, undefined, 0);
        else t.box(x + nx * (w / 2 + 0.02), r * 3.4, z, 0.1, 1.2, dd * 0.8, glass, undefined, 0);
      }
      if (rng.chance(0.3)) t.box(x, h, z, w * 0.4, rng.range(1.5, 4), dd * 0.4, hazed('#b7bcc2', opts.haze, fade), undefined, 0);
    }
  }
}

/** Soft rolling hills: squashed faceted balls far out. */
export function hills(d: Drawer, opts: { count: number; radius: [number, number]; dist: [number, number]; colors: string[]; haze: string; seed: number; arc?: [number, number]; height?: number }) {
  const t = origin(d);
  const rng = new Rng(opts.seed);
  const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
  for (let i = 0; i < opts.count; i++) {
    const a = rng.range(a0, a1);
    const dist = rng.range(...opts.dist);
    const r = rng.range(...opts.radius);
    const fade = Math.min(0.8, (dist - 40) / 160);
    t.ball(Math.cos(a) * dist, -r * 0.25, Math.sin(a) * dist, r, hazed(rng.pick(opts.colors), opts.haze, fade), [1.3, (opts.height ?? 0.45) * rng.range(0.7, 1.3), 1], 0.12, (i % 5) + 1);
  }
}

/** Clumps of cone trees in a band. */
export function forest(d: Drawer, opts: { count: number; dist: [number, number]; haze: string; seed: number; arc?: [number, number]; colors?: string[] }) {
  const t = origin(d);
  const rng = new Rng(opts.seed);
  const colors = opts.colors ?? ['#2f6a3a', '#1f5a32', '#3f7f3a'];
  const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
  const n = d.detail === 0 ? Math.round(opts.count * 0.5) : opts.count;
  for (let i = 0; i < n; i++) {
    const a = rng.range(a0, a1);
    const dist = rng.range(...opts.dist);
    const s = rng.range(0.8, 1.6) * (dist / 60);
    const fade = Math.min(0.75, (dist - 35) / 150);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (rng.chance(0.55)) t.cone(x, 0, z, 2.2 * s, 0, 7 * s, hazed(rng.pick(colors), opts.haze, fade), undefined, 6);
    else t.ball(x, 3.5 * s, z, 2.6 * s, hazed(rng.pick(colors), opts.haze, fade), [1, 1.2, 1], 0.15, (i % 4) + 1);
  }
}

export function cityBackdrop(d: Drawer) {
  const haze = '#cfe2f1';
  skyline(d, { inner: [58, 56], outer: 150, haze, colors: ['#e7e1d2', '#d9d2c1', '#c9b48a', '#a6abaf', '#d98c5f', '#8fb3c9', '#e8c547'], seed: 5, minH: 14, maxH: 34 });
  hills(d, { count: 9, radius: [40, 70], dist: [120, 170], colors: ['#7fae8a', '#8fb8a0', '#9cbfb2'], haze, seed: 9, height: 0.35 });
  forest(d, { count: 26, dist: [44, 60], haze, seed: 4 });
}

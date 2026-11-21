import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { skyline } from './skyline';
import { Frame, mix, Rng } from './util';

export { skyline };

/** Far scenery: big cheap shapes without colliders, tinted toward the haze. */
const origin = (d: Drawer) => new Pen(d, new Frame(0, 0, 0));

function hazed(color: string, haze: string, t: number) {
  return mix(color, haze, t);
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
    else {
      const c = hazed(rng.pick(colors), opts.haze, fade);
      t.cyl(x, 0, z, 0.35 * s, 2.0 * s, hazed('#6e4a2f', opts.haze, fade));
      for (const [r, y] of [[1.9, 1.6], [2.5, 2.6], [2.2, 3.6], [1.4, 4.6]] as const) t.cyl(x, y * s, z, r * s, 1.0 * s, c, undefined, 0, 8);
    }
  }
}

export function cityBackdrop(d: Drawer) {
  const haze = '#cfe2f1';
  skyline(d, { inner: [58, 56], outer: 150, haze, colors: ['#e7e1d2', '#d9d2c1', '#c9b48a', '#a6abaf', '#d98c5f', '#8fb3c9', '#e8c547'], seed: 5, minH: 14, maxH: 34 });
  hills(d, { count: 9, radius: [40, 70], dist: [120, 170], colors: ['#7fae8a', '#8fb8a0', '#9cbfb2'], haze, seed: 9, height: 0.35 });
  forest(d, { count: 26, dist: [44, 60], haze, seed: 4 });
}

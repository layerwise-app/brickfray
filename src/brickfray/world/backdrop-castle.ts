import type { Drawer } from './plan';
import { forest, hills } from './backdrop';
import { Pen } from './props-kit';
import { Frame, mix, Rng } from './util';

/** Countryside around the fortress: forest band, hills, a hill village and far mountains. */
export function castleBackdrop(d: Drawer) {
  const haze = '#efd9bd';
  forest(d, { count: 70, dist: [42, 70], haze, seed: 7, colors: ['#2f6a3a', '#3f7f3a', '#4f8a3a', '#1f5a32'] });
  hills(d, { count: 14, radius: [26, 48], dist: [85, 130], colors: ['#6f9a4a', '#7fa65a', '#5f8a42'], haze, seed: 3, height: 0.5 });
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(17);
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2);
    const dist = rng.range(125, 150);
    const r = rng.range(28, 44);
    const h = rng.range(34, 56);
    const fade = 0.55;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    t.cone(x, -2, z, r, 0, h, mix(rng.pick(['#7d8a9a', '#8a93a3', '#717f90']), haze, fade), undefined, 7);
    t.cone(x, -2 + h * 0.62, z, r * 0.38, 0, h * 0.38 + 0.4, mix('#f4f1ea', haze, 0.3), undefined, 7);
  }
  for (let i = 0; i < 10; i++) {
    const a = 2.2 + rng.range(-0.25, 0.25);
    const dist = rng.range(62, 78);
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const w = rng.range(4, 6);
    const dd = rng.range(4, 6);
    const h = rng.range(3, 5);
    t.box(x, 0, z, w, h, dd, mix(rng.pick(['#e7e1d2', '#f3e6b8', '#d9c9a8']), haze, 0.3), undefined, 0);
    t.prism('house-roof', [[-0.55, 0], [0.55, 0], [0, 0.5]], 1, x, h, z, mix('#a8452e', haze, 0.3), undefined, 0);
  }
}

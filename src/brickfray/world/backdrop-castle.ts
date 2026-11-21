import type { Drawer } from './plan';
import { forest } from './backdrop';
import { mountainRange } from './mountains';
import { Pen } from './props-kit';
import { Frame, mix, Rng } from './util';

/** Countryside around the fortress: forest band, hills, a hill village and far mountains. */
export function castleBackdrop(d: Drawer) {
  const haze = '#efd9bd';
  forest(d, { count: 70, dist: [42, 70], haze, seed: 7, colors: ['#2f6a3a', '#3f7f3a', '#4f8a3a', '#1f5a32'] });
  mountainRange(d, { count: 14, dist: [85, 130], radius: [26, 44], height: [9, 18], haze, seed: 3, rock: ['#6f9a4a'], slope: '#7fa65a', forest: '#3f7f3a', green: true });
  mountainRange(d, { count: 11, dist: [125, 150], radius: [30, 46], height: [34, 58], haze, seed: 17, rock: ['#5f6b7a', '#6c7480', '#565f6c'], slope: '#4f6a40' });
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(17);
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

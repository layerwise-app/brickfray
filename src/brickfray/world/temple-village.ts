import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { HAZE, palm } from './temple-scenery';
import { Frame, mix, Rng } from './util';

const WALLS = ['#ece4d2', '#e8c89a', '#d9a89a', '#cfe0d0', '#e3d9c4', '#f0dcb8'];
const ROOFS = ['#8a3f22', '#5f6a70', '#b5562e', '#6a4a3a'];

const fade = (x: number, z: number) => Math.min(0.55, Math.max(0, (Math.hypot(x, z) - 50) / 120));

/** A plain stilt house on the far bank: plastered walls on timber legs, a dark window band, a gable roof along x. */
function house(t: Pen, d: Drawer, rng: Rng, x: number, z: number, w: number, dd: number, h: number, y: number) {
  const f = fade(x, z);
  t.box(x, y, z, w, h, dd, mix(rng.pick(WALLS), HAZE, f), undefined, 0);
  if (d.detail > 0) t.box(x, y + h * 0.55, z - dd / 2 - 0.02, w * 0.7, 0.9, 0.04, mix('#4a3a30', HAZE, f), undefined, 0);
  const rise = Math.min(2.8, dd * 0.35);
  t.prism(`vroof:${dd.toFixed(1)}:${rise.toFixed(1)}`, [[-dd / 2 - 0.4, 0], [dd / 2 + 0.4, 0], [0, rise]], w + 0.6, x, y + h, z, mix(rng.pick(ROOFS), HAZE, f));
}

/** The far bank's village: two rows of houses along the river with palms between them, out of reach. */
export function village(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(61);
  const step = d.detail === 0 ? 13 : 8.5;
  for (const [row, y] of [[114, 1.2], [124, 2.4]] as const) {
    for (let x = -110; x < 110; x += step + rng.range(0, 3)) {
      if (rng.chance(0.2)) continue;
      house(t, d, rng, x, row + rng.range(-1, 1), rng.range(5.6, 8.0), rng.range(5.6, 7.2), rng.range(3.6, 5.6), y);
    }
  }
  for (let k = 0; k < (d.detail === 0 ? 4 : 9); k++) palm(t, d, rng, rng.range(-100, 100), 1.2, 119 + rng.range(-1, 1), rng.range(0.9, 1.2));
}

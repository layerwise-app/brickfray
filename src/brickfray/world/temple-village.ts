import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { T } from './temple-layout';
import { HAZE, palm, stupa } from './temple-scenery';
import { Frame, mix, Rng } from './util';

const WALLS = ['#ece4d2', '#e8c89a', '#d9a89a', '#cfe0d0', '#e3d9c4', '#f0dcb8'];
const ROOFS = ['#8a3f22', '#5f6a70', '#b5562e', '#6a4a3a'];
/** The village's blocks along z, matching the front houses (temple-lanes.ts); the lanes between them run east. */
const BLOCKS: [number, number][] = [[-35.2, -28.0], [-25.6, -18.4], [-16.0, -8.8], [-6.4, 1.6], [4.0, 11.2], [13.6, 20.8], [23.2, 35.2]];

const fade = (x: number, z: number) => Math.min(0.55, Math.max(0, (Math.hypot(x, z) - 50) / 120));

/** A plain village house: plastered walls, a dark door and window band, a gable roof along x. */
function house(t: Pen, d: Drawer, rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number) {
  const x = (x0 + x1) / 2;
  const z = (z0 + z1) / 2;
  const w = x1 - x0;
  const dd = z1 - z0;
  const f = fade(x, z);
  const wall = mix(rng.pick(WALLS), HAZE, f);
  t.box(x, 0, z, w, h, dd, wall, undefined, 0);
  if (d.detail > 0) {
    t.box(x0 - 0.02, h * 0.55, z, 0.04, 0.9, dd * 0.7, mix('#4a3a30', HAZE, f), undefined, 0);
    t.box(x0 - 0.02, 0, z + dd * 0.2, 0.04, 2.0, 1.0, mix('#5a3424', HAZE, f), undefined, 0);
  }
  const rise = Math.min(2.8, dd * 0.35);
  const roof = mix(rng.pick(ROOFS), HAZE, f);
  t.prism(`vroof:${dd.toFixed(1)}:${rise.toFixed(1)}`, [[-dd / 2 - 0.4, 0], [dd / 2 + 0.4, 0], [0, rise]], w + 0.6, x, h, z, roof);
}

/**
 * East: the village behind the front houses. Blocks of houses between lanes that line up with the fence gaps, palms in
 * the lanes, and a terraced hill with a stupa closing the view; the cliff stream bounds it to the north and the
 * river to the south.
 */
export function village(d: Drawer) {
  const X = T.edgeX;
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(61);
  slab(d, [X, -0.4, -T.edge - 2.4], [140, -0.02, T.edge + 3.2], '#b9a57e');
  const cols = d.detail === 0 ? 3 : 5;
  for (let c = 0; c < cols; c++) {
    const x0 = X + 9.6 + c * 10.4;
    for (const [z0, z1] of BLOCKS) {
      for (let z = z0; z < z1 - 2.4; ) {
        const len = Math.min(z1 - z, rng.range(4.8, 8.0));
        if (rng.chance(0.85)) house(t, d, rng, x0 + rng.range(0, 1.2), z + 0.2, x0 + rng.range(6.4, 8.0), z + len - 0.2, rng.range(4.0, 7.2) + (c === 0 ? 1.6 : 0));
        z += len;
      }
    }
  }
  for (const [z0] of BLOCKS.slice(1)) {
    for (let k = 0; k < (d.detail === 0 ? 1 : 2); k++) palm(t, d, rng, X + 14 + rng.range(0, 36), 0, z0 - 1.2 + rng.range(-0.4, 0.4), rng.range(0.9, 1.2));
  }
  terraces(t, d);
}

/** Rice terraces climbing a hill east of the village, water glinting on each step, and a stupa on top. */
function terraces(t: Pen, d: Drawer) {
  const x0 = 100;
  const steps = d.detail === 0 ? 5 : 8;
  for (let k = 0; k < steps; k++) {
    const x = x0 + k * 5.6;
    const y = k * 2.0;
    const f = fade(x, 0);
    t.box(x + 30, y - 2, 0, 60, 2.0 + 0.02, 120 - k * 8, mix(k % 2 ? '#6f9a4a' : '#5f8a3a', HAZE, f), undefined, 0);
    if (d.detail > 0) t.box(x + 1.6, y + 0.01, 0, 2.4, 0.02, 112 - k * 8, mix('#9fc8c0', HAZE, f + 0.1), 'glass', 0);
  }
  stupa(t, x0 + steps * 5.6 + 8, steps * 2.0 - 0.1, -6, 1.1);
}

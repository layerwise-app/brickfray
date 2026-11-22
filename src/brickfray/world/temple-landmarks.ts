import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { pavilionRoof, type RoofStyle, ROOF_CLAY } from './temple-ornament';
import type { Piece } from './temple-layout';
import { Frame, Rng, shade } from './util';

/**
 * What tells one side of the temple from the other: the bell towers on the village (east) side against the drum towers
 * on the gorge side, the river shrine on the south terrace against the cliff grotto, and the village's own things in
 * the east strip (a storehouse, a market shed, carts and sacks) where the gorge strip has fallen masonry. Each is drawn
 * over the same collider as its counterpart, so the halves still play the same.
 */
const GOLD = '#e0b040';
const BRONZE = '#7a5a2a';
const TIMBER = '#5a3424';
const PLASTER = '#efe8d8';
export const ROOF_BLUE: RoofStyle = { tile: '#3f6f9a', ridge: '#2f4f6a', end: '#dfe6ea' };

const centre = (q: Piece) => [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2] as const;
const size = (q: Piece) => [q.max[0] - q.min[0], q.max[1] - q.min[1], q.max[2] - q.min[2]] as const;

/** Bell tower: a whitewashed shaft, a red belfry above reach with a bronze bell behind lattice rails, a clay roof. */
export function bellTower(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const [x0, , z0] = q.min;
  const [x1, , z1] = q.max;
  const belfry = h - 2.2;
  slab(d, [x0, 0, z0], [x1, 0.8, z1], '#b9ad92');
  slab(d, [x0 + 0.08, 0.8, z0 + 0.08], [x1 - 0.08, belfry, z1 - 0.08], PLASTER);
  slab(d, [x0 - 0.06, belfry - 0.2, z0 - 0.06], [x1 + 0.06, belfry, z1 + 0.06], '#b5562e');
  slab(d, [x0 + 0.3, belfry, z0 + 0.3], [x1 - 0.3, h - 0.3, z1 - 0.3], '#3a2a22');
  slab(d, [x0, h - 0.3, z0], [x1, h, z1], '#a83a2c');
  const t = new Pen(d, new Frame(cx, 0, cz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.16), belfry, sz * (dd / 2 - 0.16), 0.32, h - belfry - 0.3, 0.32, '#a83a2c', undefined, 0.02);
  t.cone(0, h - 1.75, 0, 0.62, 0.22, 1.1, BRONZE, 'metal', 12);
  t.ring(0, h - 1.75, 0, 0.6, 0.06, shade(BRONZE, 0.15), 'metal');
  if (d.detail > 0) {
    t.cyl(0, h - 0.65, 0, 0.06, 0.4, TIMBER, undefined, 0, 5);
    for (const sx of [-1, 1]) t.box(sx * (w / 2 - 0.1), belfry + 0.3, 0, 0.06, 0.08, dd - 0.6, GOLD, 'metal', 0);
    for (const sz of [-1, 1]) t.box(0, belfry + 0.3, sz * (dd / 2 - 0.1), w - 0.6, 0.08, 0.06, GOLD, 'metal', 0);
    t.box(0, 1.6, dd / 2 + 0.02, 0.9, 1.4, 0.04, '#2f5f9a', undefined, 0);
    t.box(0, 1.6, -dd / 2 - 0.02, 0.9, 1.4, 0.04, '#2f5f9a', undefined, 0);
  }
  pavilionRoof(d, cx, h, cz, w, dd, ROOF_CLAY, 2);
}

/** River shrine on the south terrace: sandstone steps up to a lamp-lit niche with a lotus, under a blue-tiled roof. */
export function riverShrine(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const [x0, , z0] = q.min;
  const [x1, , z1] = q.max;
  slab(d, [x0, 0, z0], [x1, 0.5, z1], '#c9b48a');
  slab(d, [x0 + 0.2, 0.5, z0 + 0.2], [x1 - 0.2, h - 0.6, z1 - 0.2], '#e8dcc0');
  slab(d, [x0 + 0.6, 0.5, z0 - 0.02], [x1 - 0.6, h - 1.4, z0 + 0.3], '#2a3a48');
  slab(d, [x0 - 0.1, h - 0.6, z0 - 0.1], [x1 + 0.1, h - 0.4, z1 + 0.1], '#2f5f9a');
  const t = new Pen(d, new Frame(cx, 0, z0 + 0.5));
  t.box(0, 0.5, 0, 1.2, 0.4, 0.5, '#c9b48a', undefined, 0.03);
  t.cone(0, 0.9, 0, 0.18, 0.42, 0.36, '#f4a6c4', undefined, 8);
  t.ball(0, 1.32, 0, 0.16, GOLD, [1, 1.3, 1], 0, 1, 'metal');
  t.box(0, 0.9, -0.3, 0.8, 0.08, 0.16, '#ffb54a', 'glow', 0);
  if (d.detail > 0) for (const sx of [-1, 1]) t.cyl(sx * (w / 2 - 0.4), 0.5, -0.2, 0.12, h - 1.1, '#2f5f9a', undefined, 0.02, 8);
  pavilionRoof(d, cx, h - 0.4, cz, w, dd, ROOF_BLUE, 1);
}

/** The village storehouse jutting from the house row into the east strip's waist: plastered, timber-framed, tile-roofed. */
export function storehouse(d: Drawer, q: Piece) {
  const [x0, , z0] = q.min;
  const [x1, h, z1] = q.max;
  const t = new Pen(d, new Frame(0, 0, 0));
  slab(d, [x0, 0, z0], [x1, 0.6, z1], '#9a8f78');
  slab(d, [x0 + 0.05, 0.6, z0 + 0.05], [x1 - 0.05, h, z1 - 0.05], '#e8c89a');
  for (const x of [x0 + 0.1, (x0 + x1) / 2, x1 - 0.3]) for (const z of [z0 - 0.04, z1]) t.box(x + 0.1, 0.6, z + 0.02, 0.2, h - 0.6, 0.06, TIMBER, undefined, 0);
  for (const z of [z0 - 0.04, z1]) t.box((x0 + x1) / 2, h * 0.55, z + 0.02, x1 - x0, 0.16, 0.06, TIMBER, undefined, 0);
  t.box(x0 - 0.03, 0.6, (z0 + z1) / 2, 0.06, h - 0.6, 0.2, TIMBER, undefined, 0);
  if (d.detail > 0) {
    t.box(x0 - 0.04, 0.6, (z0 + z1) / 2, 0.06, 2.2, 1.6, '#6a4a2e', undefined, 0);
    for (const z of [z0 - 0.05, z1 + 0.01]) t.box(x0 + 1.6, h * 0.6, z + 0.02, 1.2, 0.8, 0.04, '#3a2a22', undefined, 0);
    for (const z of [z0 - 0.05, z1 + 0.01]) for (let i = 0; i < 4; i++) t.box(x0 + 1.15 + i * 0.3, h * 0.6, z + 0.02, 0.05, 0.8, 0.06, TIMBER, undefined, 0);
  }
  t.prism(`shed:${(z1 - z0).toFixed(1)}`, [[-(z1 - z0) / 2 - 0.5, 0], [(z1 - z0) / 2 + 0.5, 0], [0, 1.8]], x1 - x0 + 0.6, (x0 + x1) / 2, h, (z0 + z1) / 2, '#5f6a70');
}

/** A shuttered market shed with a striped awning over its counter (the strip side), sacks and baskets in front. */
export function marketShed(d: Drawer, q: Piece) {
  const [x0, , z0] = q.min;
  const [x1, h, z1] = q.max;
  const t = new Pen(d, new Frame(0, 0, 0));
  slab(d, [x0, 0, z0], [x1, h - 0.2, z1], '#8a5a34');
  slab(d, [x0 - 0.05, h - 0.2, z0 - 0.05], [x1 + 0.05, h, z1 + 0.05], TIMBER);
  const front = z0;
  for (let i = 0; i < Math.floor((x1 - x0) / 0.6); i++) t.box(x0 + 0.3 + i * 0.6, 1.0, front - 0.02, 0.52, h - 1.4, 0.04, i % 2 ? '#a8743e' : '#9a6634', undefined, 0);
  t.box((x0 + x1) / 2, 0.9, front - 0.25, x1 - x0, 0.1, 0.5, '#6a4a2e', undefined, 0);
  if (d.detail > 0) {
    const n = Math.floor((x1 - x0) / 0.5);
    for (let i = 0; i < n; i++) t.prism('awn', [[0, 0], [-1.0, -0.42], [-1.0, -0.36], [0, 0.06]], 0.5, x0 + 0.25 + i * 0.5, h, front, i % 2 ? '#c8231b' : '#f2e6c8');
    const rng = new Rng(Math.round(x0 * 7 + z0));
    for (let i = 0; i < 3; i++) t.ball(x0 + 0.6 + i * 1.2, 1.12, front - 0.25, 0.22, rng.pick(['#e0742c', '#6fa03a', '#d8b050']), [1.2, 0.7, 1], 0.2, i + 1);
  }
}

/** A village handcart loaded with sacks, or a stack of rice sacks under a tarp, over low cover in the east strip. */
export function villageLoad(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const t = new Pen(d, new Frame(cx, 0, cz, w >= dd ? 0 : 1));
  const L = Math.max(w, dd);
  const D = Math.min(w, dd);
  const rng = new Rng(Math.round(cx * 5 + cz * 3));
  if (h > 2) {
    // A woodpile against a lean-to frame.
    for (const s of [-1, 1]) t.box(s * (L / 2 - 0.1), 0, 0, 0.16, h, D, TIMBER, undefined, 0);
    for (let y = 0.2, k = 0; y < h - 0.3; y += 0.36, k++) for (let x = -L / 2 + 0.4 + (k % 2) * 0.18; x < L / 2 - 0.3; x += 0.36) t.cylZ(x, y, 0, 0.17, D - 0.04, shade('#8a6a44', rng.range(-0.15, 0.1)), undefined, 0, 6);
    t.box(0, h - 0.1, 0, L + 0.3, 0.12, D + 0.4, '#5f6a70', undefined, 0.02);
    return;
  }
  if (L > 2.2) {
    t.box(0, 0.5, 0, L, 0.14, D, '#8a5a34', undefined, 0.02);
    for (const s of [-1, 1]) t.box(0, 0.64, s * (D / 2 - 0.04), L, 0.3, 0.08, '#7a4a2a', undefined, 0);
    for (const sx of [-1, 1]) for (const s of [-1, 1]) t.cylZ(sx * (L / 2 - 0.5), 0.45, s * (D / 2 + 0.06), 0.42, 0.1, TIMBER, undefined, 0.02, 10);
    t.box(0, 0, 0, L - 0.6, 0.5, D * 0.6, '#5a3a24', undefined, 0);
    for (let i = 0; i < Math.floor(L / 0.7); i++) t.box(-L / 2 + 0.4 + i * 0.7, 0.64, 0, 0.6, h - 0.64, D - 0.2, shade('#d8c49a', rng.range(-0.1, 0.05)), undefined, 0.08);
    return;
  }
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) t.box((i - 0.5) * (L / 2), 0, (j - 0.5) * (D / 2), L / 2 - 0.06, h * 0.5, D / 2 - 0.06, shade('#d8c49a', rng.range(-0.12, 0.05)), undefined, 0.1);
  t.box(0, h * 0.5, 0, L - 0.3, h * 0.5, D - 0.3, shade('#d8c49a', -0.06), undefined, 0.1);
  t.box(0, h - 0.12, 0, L * 0.8, 0.12, D + 0.06, '#2f6f8a', undefined, 0.02);
}

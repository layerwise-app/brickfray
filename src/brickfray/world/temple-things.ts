import type { Drawer } from './plan';
import { Pen } from './props-kit';
import type { Piece } from './temple-layout';
import { pavilionRoof, ROOF_CLAY, ROOF_JADE } from './temple-ornament';
import { Frame, Rng, shade } from './util';

/**
 * The temple's cover props, each drawn inside its collider box: bell frames, handcarts, firewood stacks, offering
 * tables, stone lanterns, the village well, market stalls, the ferry post, boulders and planters. The east half's
 * things take blue and white where the west's take red and ochre.
 */
const GOLD = '#e0b040';
const BRONZE = '#7a5a2a';
const TIMBER = '#5a3424';
const WOOD = '#8a6040';
const STONE = '#b8b49a';
const RED = '#a83a2c';
const BLUE = '#2f5f9a';
const ROCK = ['#7d8276', '#6f7469', '#878c80', '#73806a'];

const centre = (q: Piece) => [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2] as const;
const size = (q: Piece) => [q.max[0] - q.min[0], q.max[1] - q.min[1], q.max[2] - q.min[2]] as const;
/** A pen at the box's foot, turned so its local x runs along the box's longer side. */
function pen(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const along = w >= dd;
  return { t: new Pen(d, new Frame(cx, q.min[1], cz, along ? 0 : 1)), L: Math.max(w, dd), D: Math.min(w, dd), h, east: cx > 0 };
}

/** A bronze bell hung from a timber frame on a stone base; the bell and its base are the solid part. */
function bell(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, 0.4, D, STONE, undefined, 0.04);
  for (const s of [-1, 1]) t.box(s * (L / 2 - 0.2), 0.4, 0, 0.32, h - 0.7, 0.32, TIMBER, undefined, 0.02);
  t.box(0, h - 0.5, 0, L, 0.3, 0.42, east ? BLUE : RED, undefined, 0.02);
  pavilionRoof(d, centre(q)[0], h - 0.2, centre(q)[1], q.max[0] - q.min[0] + 0.3, q.max[2] - q.min[2] + 0.3, east ? ROOF_JADE : ROOF_CLAY, 1);
  t.cone(0, 0.5, 0, D * 0.45, D * 0.3, h - 1.2, BRONZE, 'metal', 12);
  if (d.detail > 0) for (const y of [0.9, 1.6]) t.cyl(0, y, 0, D * 0.44, 0.06, shade(BRONZE, 0.2), 'metal', 0, 12);
}

/** A two-wheeled handcart loaded with sacks and a roped bundle. */
function cart(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  t.box(0, 0.5, 0, L - 0.4, 0.16, D, WOOD, undefined, 0.02);
  for (const s of [-1, 1]) t.box(0, 0.66, s * (D / 2 - 0.05), L - 0.4, 0.4, 0.1, TIMBER, undefined, 0.01);
  for (const s of [-1, 1]) t.cylZ(-L * 0.1, 0.5, s * (D / 2 + 0.02), 0.5, 0.12, TIMBER, undefined, 0.02);
  for (const s of [-1, 1]) t.beam(L / 2 - 0.4, 0.6, s * 0.4, L / 2, 0.3, s * 0.4, 0.08, TIMBER);
  const rng = new Rng(Math.round(q.min[0] * 7 + q.min[2] * 3));
  for (let i = 0; i < 4; i++) t.box(-L / 2 + 0.5 + i * ((L - 1) / 3.5), 0.66, rng.range(-0.15, 0.15), 0.62, h - 0.76 - rng.range(0, 0.3), D - 0.3, shade('#d8c49a', rng.range(-0.1, 0.06)), undefined, 0.12);
}

/** Split firewood stacked between posts under a plank lid. */
function firewood(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  for (const s of [-1, 1]) t.box(s * (L / 2 - 0.08), 0, 0, 0.14, h, D, TIMBER, undefined, 0.01);
  const rows = Math.max(2, Math.round((h - 0.12) / 0.2));
  for (let r = 0; r < rows; r++) for (let k = 0; k < (d.detail === 0 ? 2 : 5); k++) {
    const z = -D / 2 + (k + 0.5) * (D / (d.detail === 0 ? 2 : 5));
    t.cylX(0, 0.1 + r * ((h - 0.2) / rows) + 0.1, z, Math.min(0.1, D / 10), L - 0.3, shade('#a87a4a', ((r + k) % 3) * 0.06 - 0.06));
  }
  t.box(0, h - 0.06, 0, L, 0.06, D + 0.06, WOOD, undefined, 0);
}

/** A lacquered offering table with bowls of fruit, a candle pair and an incense pot. */
function table(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, h - 0.1, D, east ? BLUE : RED, undefined, 0.03);
  t.box(0, h - 0.1, 0, L + 0.08, 0.1, D + 0.08, GOLD, 'metal', 0.01);
  if (d.detail === 0) return;
  for (const x of [-L / 3, 0, L / 3]) {
    t.cyl(x, h, 0, 0.22, 0.08, '#e8e0cc', undefined, 0, 10);
    t.ball(x, h + 0.14, 0, 0.12, x === 0 ? '#f6a623' : '#c8231b', undefined, 0, 1);
  }
  for (const s of [-1, 1]) t.cyl(s * (L / 2 - 0.15), h, D / 4, 0.04, 0.3, '#f2ead6', undefined, 0, 6);
}

/** A stone lantern: plinth, shaft, the lit firebox, a curved cap with a finial. */
function lantern(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  const w = Math.min(L, D);
  t.box(0, 0, 0, w, 0.3, w, shade(STONE, -0.1), undefined, 0.04);
  t.box(0, 0.3, 0, w * 0.45, h - 1.6, w * 0.45, STONE, undefined, 0.03);
  t.box(0, h - 1.3, 0, w * 0.8, 0.12, w * 0.8, STONE, undefined, 0.02);
  t.box(0, h - 1.18, 0, w * 0.62, 0.56, w * 0.62, '#ffcf7a', 'glow', 0);
  t.cone(0, h - 0.62, 0, w * 0.62, 0.06, 0.5, shade(STONE, -0.06), undefined, 4, Math.PI / 4);
  t.ball(0, h - 0.12, 0, 0.12, STONE, undefined, 0, 1);
  d.anim.pools.add(centre(q)[0], centre(q)[1], 0.006, 3.0, '#ffb060', 0.3);
}

/** The village well: a stone ring, two posts, a winch and a small tiled roof. */
function well(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const { t, L, h } = pen(d, q);
  t.cyl(0, 0, 0, L / 2 - 0.1, 0.9, STONE, undefined, 0.03, d.detail === 0 ? 8 : 14);
  t.cyl(0, 0.86, 0, L / 2 - 0.5, 0.05, '#3a6a7a', 'glass', 0, d.detail === 0 ? 8 : 14);
  for (const s of [-1, 1]) t.box(s * (L / 2 - 0.25), 0.9, 0, 0.2, h - 1.5, 0.2, TIMBER, undefined, 0.01);
  t.cylX(0, h - 1.0, 0, 0.1, L - 0.4, WOOD);
  pavilionRoof(d, cx, h - 0.6, cz, L + 0.2, L * 0.7, ROOF_CLAY, 1);
}

/** A market stall: a counter of baskets under a striped awning on four poles. */
function stall(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, 1.0, D, WOOD, undefined, 0.02);
  const rng = new Rng(Math.round(q.min[0] * 5 + q.min[2]));
  for (let i = 0; i < 4; i++) t.cyl(-L / 2 + 0.45 + i * ((L - 0.9) / 3), 1.0, 0, 0.3, 0.22, ['#e0a030', '#c8231b', '#7aa04a', '#f2e6c8'][rng.int(0, 3)], undefined, 0, 8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (L / 2 - 0.08), 1.0, sz * (D / 2 - 0.08), 0.1, h - 1.2, 0.1, TIMBER, undefined, 0);
  const stripes = d.detail === 0 ? 2 : 6;
  for (let i = 0; i < stripes; i++) t.box(-L / 2 + (i + 0.5) * (L / stripes), h - 0.2, 0, L / stripes, 0.2, D + 0.3, i % 2 ? '#f2e6c8' : east ? BLUE : RED, undefined, 0);
}

/** The ferry post: a stout timber post with a bronze bell, oars leaning on it and a coil of rope at its foot. */
function ferry(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  t.box(0, 0, 0, L, 0.3, D, STONE, undefined, 0.03);
  t.box(0, 0.3, 0, Math.min(L, D) * 0.7, h - 0.6, Math.min(L, D) * 0.7, TIMBER, undefined, 0.03);
  t.box(0, h - 0.3, 0, L, 0.3, D, ROOF_CLAY.tile, undefined, 0.04);
  t.cone(L * 0.3, h - 1.4, 0, 0.25, 0.14, 0.5, BRONZE, 'metal', 10);
  for (const s of [-1, 1]) t.beam(-L / 2 + 0.2, 0.3, s * 0.2, -L / 2 + 0.5, h - 0.6, s * 0.25, 0.08, WOOD);
  if (d.detail > 0) t.ringUp(L * 0.3, 0.34, D / 2 - 0.2, 0.22, 0.06, '#c9b48a');
}

/** A heap of weathered boulders filling the box, moss on the tops. */
function boulder(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  const rng = new Rng(Math.round(q.min[0] * 11 + q.min[2] * 5));
  const n = d.detail === 0 ? 2 : 4;
  t.box(0, 0, 0, L * 0.9, h * 0.6, D * 0.9, rng.pick(ROCK), undefined, 0.2);
  for (let i = 0; i < n; i++) {
    const x = (i / Math.max(1, n - 1) - 0.5) * L * 0.5;
    t.box(x, h * 0.5, rng.range(-0.15, 0.15) * D, L * rng.range(0.35, 0.5), h * 0.5, D * rng.range(0.6, 0.85), rng.pick(ROCK), undefined, 0.2, rng.range(-0.3, 0.3));
  }
  if (d.detail > 0) t.box(0, h - 0.04, 0, L * 0.4, 0.08, D * 0.5, '#4f8a3a', undefined, 0.02);
}

/** A long raised bed of sandstone kerbs filled with shrubs and lotus-pink peonies. */
function bed(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, h - 0.1, D, '#d2bc8e', undefined, 0.03);
  t.box(0, h - 0.1, 0, L - 0.2, 0.06, D - 0.2, '#5a4030', undefined, 0);
  const n = Math.max(2, Math.round(L / (d.detail === 0 ? 4 : 1.6)));
  const rng = new Rng(Math.round(q.min[0] * 3 + q.min[2] * 7));
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + 0.5) * (L / n);
    t.ball(x, h - 0.1, rng.range(-0.3, 0.3), rng.range(0.6, 0.9), east ? '#2f6a3a' : '#4f8a3e', [1.2, 0.8, 1], 0.2, i + 1);
    if (d.detail > 0 && i % 2) t.ball(x + 0.3, h + 0.3, rng.range(-0.4, 0.4), 0.22, east ? '#f2ead6' : '#e07a9a', undefined, 0.1, i);
  }
}

/** A sandstone planter with a clipped shrub (or a dwarf pine on the east side). */
function planter(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, h - 0.3, D, '#d8c49a', undefined, 0.04);
  t.box(0, h - 0.3, 0, L - 0.1, 0.06, D - 0.1, '#5a4030', undefined, 0);
  t.ball(0, h - 0.2, 0, Math.min(L, D) * 0.42, east ? '#2f6a3a' : '#4f9a3e', [L / Math.min(L, D), 0.7, 1], 0.15, 3);
}

/** The great bronze incense cauldron: a round belly on three feet, the lid's lion knob, smoke and embers. */
function cauldron(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const { t, L, h } = pen(d, q);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    t.box(Math.cos(a) * L * 0.32, 0, Math.sin(a) * L * 0.32, 0.3, 0.4, 0.3, BRONZE, 'metal', 0.05);
  }
  t.cyl(0, 0.35, 0, L / 2 - 0.05, h - 0.5, BRONZE, 'metal', 0.1, d.detail === 0 ? 8 : 16);
  t.cyl(0, h - 0.15, 0, L / 2, 0.15, shade(BRONZE, 0.15), 'metal', 0.02, d.detail === 0 ? 8 : 16);
  t.cyl(0, h - 0.1, 0, L / 2 - 0.3, 0.06, '#ffb54a', 'glow', 0, 12);
  d.anim.flame([cx, h, cz]);
  d.anim.pools.add(cx, cz, 0.006, 4.0, '#ffb060', 0.4);
}

/** The pavilion's altar: a stone table with a seated figure's lotus base, offerings and candles. */
function altar(d: Drawer, q: Piece) {
  const { t, L, D, h, east } = pen(d, q);
  t.box(0, 0, 0, L, h - 0.12, D, '#d8c49a', undefined, 0.04);
  t.box(0, h - 0.12, 0, L + 0.06, 0.12, D + 0.06, east ? BLUE : RED, undefined, 0.01);
  if (d.detail === 0) return;
  t.cyl(0, h, 0, 0.3, 0.16, GOLD, 'metal', 0, 10);
  for (const s of [-1, 1]) t.cyl(s * (L / 2 - 0.2), h, 0, 0.05, 0.28, '#f2ead6', undefined, 0, 6);
}

/** A river boat turned keel-up on trestles for caulking. */
function boat(d: Drawer, q: Piece) {
  const { t, L, D, h } = pen(d, q);
  for (const s of [-1, 1]) t.box(s * (L / 2 - 0.5), 0, 0, 0.2, 0.4, D, TIMBER, undefined, 0.01);
  t.box(0, 0.4, 0, L, h - 0.6, D, '#6a4a2e', undefined, 0.12);
  t.box(0, h - 0.2, 0, L - 0.4, 0.2, 0.2, shade('#6a4a2e', -0.2), undefined, 0.02);
}

const DRAW: Record<string, (d: Drawer, q: Piece) => void> = { bell, cart, firewood, table, lantern, well, stall, ferry, boulder, planter, boat, cauldron, altar, bed };

/** Draws a 'prop' piece by its tag. */
export function prop(d: Drawer, q: Piece) {
  (DRAW[q.tag ?? 'boulder'] ?? boulder)(d, q);
}

import { drawBlock, type Masonry } from './blocks';
import { CASTLE_STONE } from './castle-parts';
import { F, type Piece } from './fortress-plan';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng, shade } from './util';

/** Pieces of these kinds let shots and sight through their gaps. */
export const SEE_THROUGH = new Set<Piece['kind']>(['stakes', 'paling', 'grille', 'gate']);

const OAK = '#6e4a2f';
const PALE = ['#9a6a3f', '#8a5f3a', '#a67c52'];
const IRON = '#3a3f45';
const LEAF: Masonry = { colors: ['#3f7a34', '#4a8a3a', '#356c2e', '#5a9440'], variance: 0.35, lens: [2, 3, 4] };
const CRAG: Masonry = { colors: ['#8a8578', '#7d786c', '#969083', '#706b60'], variance: 0.45, lens: [2, 3, 5] };

/** Drawn edge pieces; false when the piece is an ordinary block for drawPiece. */
export function drawEdge(d: Drawer, q: Piece): boolean {
  if (q.kind === 'stakes') stakes(d, q);
  else if (q.kind === 'paling') paling(d, q);
  else if (q.kind === 'gate') gate(d, q);
  else if (q.kind === 'grille') grille(d, q);
  else if (q.kind === 'hedge') hedge(d, q);
  else if (q.kind === 'rock') crag(d, q);
  else if (q.kind === 'breast') breastwork(d, q);
  else return false;
  return true;
}

/** Long axis of a thin piece: [along x?, a0, a1, cross centre]. */
function axis(q: Piece): [boolean, number, number, number] {
  const alongX = q.max[0] - q.min[0] >= q.max[2] - q.min[2];
  return alongX ? [true, q.min[0], q.max[0], (q.min[2] + q.max[2]) / 2] : [false, q.min[2], q.max[2], (q.min[0] + q.max[0]) / 2];
}

const at = (alongX: boolean, a: number, c: number): [number, number] => (alongX ? [a, c] : [c, a]);

/** Sharpened oak stakes leaning a little outward, two wales lashed across them, foam where they stand in the water. */
function stakes(d: Drawer, q: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const rng = new Rng(Math.round(a0 * 13 + c * 7));
  // Stakes a hand apart: they stop nobody's bullets, so the river shows between them.
  const gap = 0.72;
  for (let a = a0 + gap / 2; a < a1; a += gap) {
    const h = 2.3 + rng.range(-0.25, 0.2);
    const [x, z] = at(alongX, a + rng.range(-0.04, 0.04), c);
    const shade0 = rng.pick(['#6e4a2f', '#5e3f27', '#7a5434']);
    t.box(x, F.ford, z, 0.18, h - F.ford, 0.18, shade0, undefined, 0.02);
    t.cone(x, h, z, 0.13, 0.01, 0.34, shade(shade0, 0.06), undefined, 4, Math.PI / 4);
  }
  for (const y of [0.55, 1.75]) {
    const [x, z] = at(alongX, (a0 + a1) / 2, c + 0.16);
    if (alongX) t.box(x, y, z, a1 - a0, 0.14, 0.1, OAK, undefined, 0.02);
    else t.box(x, y, z, 0.1, 0.14, a1 - a0, OAK, undefined, 0.02);
  }
  const [x0, z0] = at(alongX, a0, c);
  const [x1, z1] = at(alongX, a1, c);
  d.anim.foam.edge(x0, z0, x1, z1, F.water, alongX ? 0 : -1, alongX ? -1 : 0, 0.5);
}

/** A paling: posts every 2.4 m with two rails, pales with pointed tops and a wide gap between them, so it reads as see-through. */
function paling(d: Drawer, q: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const h = q.max[1];
  const posts = Math.max(2, Math.round((a1 - a0) / 2.4) + 1);
  for (let i = 0; i < posts; i++) {
    const [x, z] = at(alongX, a0 + ((a1 - a0) * i) / (posts - 1), c);
    t.box(x, 0, z, 0.2, h + 0.12, 0.2, OAK, undefined, 0.02);
  }
  for (const y of [0.4, h - 0.5]) {
    const [x, z] = at(alongX, (a0 + a1) / 2, c);
    if (alongX) t.box(x, y, z + 0.12, a1 - a0, 0.12, 0.08, OAK, undefined, 0.01);
    else t.box(x + 0.12, y, z, 0.08, 0.12, a1 - a0, OAK, undefined, 0.01);
  }
  const step = 0.4;
  const rng = new Rng(Math.round(a0 * 7 + c * 3));
  for (let a = a0 + step / 2; a < a1; a += step) {
    const [x, z] = at(alongX, a, c);
    const ph = h - 0.18 + rng.range(-0.08, 0.06);
    const col = rng.pick(PALE);
    t.box(x, 0.04, z, alongX ? 0.12 : 0.05, ph, alongX ? 0.05 : 0.12, col, undefined, 0.01);
    if (d.detail > 0) t.cone(x, 0.04 + ph, z, 0.07, 0.005, 0.16, col, undefined, 4, Math.PI / 4);
  }
}

/** Yard gate: two leaves of boards under a beam on tall posts, bars from the leaves to the beam. */
function gate(d: Drawer, q: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const h = q.max[1];
  for (const a of [a0 + 0.2, a1 - 0.2]) {
    const [x, z] = at(alongX, a, c);
    t.box(x, 0, z, 0.4, h, 0.4, OAK, undefined, 0.03);
  }
  const [mx, mz] = at(alongX, (a0 + a1) / 2, c);
  t.box(mx, h - 0.4, mz, alongX ? a1 - a0 + 0.6 : 0.36, 0.4, alongX ? 0.36 : a1 - a0 + 0.6, OAK, undefined, 0.03);
  const leaf = 2.4;
  const step = d.detail === 0 ? 0.5 : 0.26;
  for (let a = a0 + 0.45; a < a1 - 0.35; a += step) {
    const [x, z] = at(alongX, a, c);
    t.box(x, 0.06, z, alongX ? step - 0.04 : 0.1, leaf, alongX ? 0.1 : step - 0.04, (Math.round(a / step) % 2 ? PALE[0] : PALE[1])!, undefined, 0.01);
    if (Math.round(a / step) % 2 === 0) t.box(x, leaf, z, 0.05, h - leaf - 0.4, 0.05, IRON, 'metal', 0);
  }
  for (const y of [0.5, leaf - 0.5]) {
    if (alongX) t.box(mx, y, mz + 0.08, a1 - a0 - 0.6, 0.16, 0.06, '#5e3f27', undefined, 0.01);
    else t.box(mx + 0.08, y, mz, 0.06, 0.16, a1 - a0 - 0.6, '#5e3f27', undefined, 0.01);
  }
}

/** Portcullis let down in the outer gate: an iron lattice with spiked feet. */
function grille(d: Drawer, q: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const h = q.max[1];
  const step = d.detail === 0 ? 0.6 : 0.4;
  for (let a = a0 + step / 2; a < a1; a += step) {
    const [x, z] = at(alongX, a, c);
    t.box(x, 0.2, z, 0.08, h - 0.2, 0.08, IRON, 'metal', 0);
    t.cone(x, 0, z, 0.01, 0.05, 0.22, IRON, 'metal', 4);
  }
  for (let y = 0.6; y < h; y += d.detail === 0 ? 1.2 : 0.6) {
    const [x, z] = at(alongX, (a0 + a1) / 2, c);
    if (alongX) t.box(x, y, z, a1 - a0, 0.07, 0.1, IRON, 'metal', 0);
    else t.box(x, y, z, 0.1, 0.07, a1 - a0, IRON, 'metal', 0);
  }
}

/** Clipped hedge: a leafy block with a lumpy top. */
function hedge(d: Drawer, q: Piece) {
  drawBlock(d, { min: q.min, max: q.max, surface: 'foliage', style: LEAF, top: 'none' });
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const rng = new Rng(Math.round(a0 * 5));
  for (let a = a0 + 0.5; a < a1 - 0.3; a += d.detail === 0 ? 1.6 : 0.9) {
    const [x, z] = at(alongX, a + rng.range(-0.2, 0.2), c);
    t.ball(x, q.max[1] - 0.15, z, 0.55 + rng.range(-0.1, 0.12), rng.pick(LEAF.colors), [1.1, 0.6, 1], 0.15, rng.int(1, 9));
  }
}

/**
 * The crag's shoulder: rough courses of rock, stepped outcrops breaking its top and its outer (north and river) faces,
 * boulders, shrubs and a few pines. Outcrops stay inside the block's footprint on the sides players stand by.
 */
function crag(d: Drawer, q: Piece) {
  drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: CRAG, top: 'tiles', topColor: '#7f9a5a' });
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const rng = new Rng(31);
  const [x0, , z0] = q.min;
  const [x1, top, z1] = q.max;
  for (const [ax, az, bx, bz, h] of [
    [x0 + 1.6, z0 + 0.8, x0 + 8.8, z0 + 7.2, 2.4],
    [x0 + 7.2, z0 + 1.6, x1 - 2.4, z0 + 5.6, 3.6],
    [x1 - 6.4, z0 + 4.0, x1 - 0.8, z0 + 12.0, 1.6],
    [x0 + 3.2, z0 + 9.6, x0 + 7.2, z0 + 14.4, 1.2],
    [x1 - 4.8, z1 - 9.6, x1 - 1.6, z1 - 4.0, 2.0],
    [x0 + 9.6, z0 + 3.2, x0 + 12.8, z0 + 4.8, 5.2]
  ] as const) t.span(ax, top, az, bx, top + h, bz, shade(rng.pick(CRAG.colors), rng.range(-0.06, 0.04)), undefined, 0);
  for (const [ax, az, bx, bz, h] of [
    [x0 - 1.2, z0 - 1.6, x0 + 6.4, z0, 4.0],
    [x0 + 9.6, z0 - 2.0, x0 + 13.6, z0, 5.6],
    [x1 - 0.4, z0 + 4.8, x1 + 1.6, z0 + 11.2, 4.8],
    [x1 - 0.4, z1 - 8.0, x1 + 1.2, z1 - 2.4, 3.2]
  ] as const) t.span(ax, -2.0, az, bx, h, bz, shade(rng.pick(CRAG.colors), -0.04), undefined, 0);
  for (const [x, z, s] of [[x0 + 4.0, z0 + 10.4, 1.1], [x1 - 3.2, z1 - 3.2, 0.9], [x0 + 12.0, z1 - 6.4, 1.0]] as const) {
    t.cyl(x, top, z, 0.26 * s, 1.2 * s, '#5e3f27', undefined, 0, 5);
    for (const [r, h, y] of [[1.8, 2.6, 1.0], [1.3, 2.2, 2.5], [0.8, 1.8, 3.8]] as const) t.cone(x, top + y * s, z, r * s, 0.05, h * s, '#2f6a3a', undefined, 6);
  }
  const n = d.detail === 0 ? 6 : 16;
  for (let i = 0; i < n; i++) {
    const x = rng.range(q.min[0] + 1, q.max[0] - 1);
    const z = rng.range(q.min[2] + 1, q.max[2] - 1);
    if (rng.chance(0.5)) t.ball(x, q.max[1], z, rng.range(0.8, 1.6), rng.pick(CRAG.colors), [1.2, 0.7, 1], 0.2, i + 1);
    else t.ball(x, q.max[1] + 0.3, z, rng.range(0.6, 1.0), rng.pick(['#3f7a34', '#4f8a3a', '#5f6a3a']), [1, 0.8, 1], 0.2, i + 1);
  }
}

/** Breastwork on the crag: coursed stone, a dressed coping, and a deep drop beyond it. */
function breastwork(d: Drawer, q: Piece) {
  drawBlock(d, { min: q.min, max: [q.max[0], q.max[1] - 0.16, q.max[2]], surface: 'stone', style: CASTLE_STONE });
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [alongX, a0, a1, c] = axis(q);
  const [x, z] = at(alongX, (a0 + a1) / 2, c);
  const thick = alongX ? q.max[2] - q.min[2] : q.max[0] - q.min[0];
  if (alongX) t.box(x, q.max[1] - 0.16, z, a1 - a0 + 0.1, 0.16, thick + 0.16, mix('#d8cfba', '#b8b1a3', 0.3), undefined, 0.02);
  else t.box(x, q.max[1] - 0.16, z, thick + 0.16, 0.16, a1 - a0 + 0.1, mix('#d8cfba', '#b8b1a3', 0.3), undefined, 0.02);
}

import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { T } from './temple-layout';
import { Frame, mix, Rng } from './util';

/**
 * The world beyond the temple's four edges, no colliders: the cliff over the waterfall stream (north), the gorge
 * (west), the river below the ghats (south). The village is temple-village.ts. Strata step back as they rise and
 * are broken along their length, so a rock face reads as rock from the edge on every tier.
 */
export const HAZE = '#efe0bc';
const ROCK = ['#7d8276', '#6f7469', '#878c80', '#666b61', '#73806a', '#8a8470'];
const MOSS = '#4f8a3a';
const CANOPY = ['#2f7a34', '#3f8f3a', '#246b35', '#4f9a3e', '#1f5a32'];
export const STREAM_Y = -1.6;
export const GORGE_Y = -6.4;
export const RIVER_Y = -2.2;
const STREAM = '#2f7f86';
const RIVER = '#3a7f7a';

const fade = (x: number, z: number) => Math.min(0.6, Math.max(0, (Math.hypot(x, z) - 50) / 140));

/**
 * A stratified rock face along x (`alongX`) or z, its foot at `face` (the side facing the temple is `sign` toward the
 * map), from y0 up to about y1, between a0 and a1. Each band of 1.6-3.2 m steps back a little and is cut into blocks of
 * different set-back, with moss on the ledges and vines hanging from the top.
 */
export function rockFace(d: Drawer, alongX: boolean, face: number, sign: 1 | -1, a0: number, a1: number, y0: number, y1: number, seed: number, rough = 1) {
  const rng = new Rng(seed);
  const bands = d.detail === 0 ? 3 : 5;
  const put = (a: number, w: number, ya: number, yb: number, front: number, depth: number, color: string) => {
    const [m0, m1] = [face - sign * front, face - sign * (front + depth)].sort((p, q) => p - q) as [number, number];
    if (alongX) slab(d, [a, ya, m0], [a + w, yb, m1], color);
    else slab(d, [m0, ya, a], [m1, yb, a + w], color);
  };
  for (let a = a0; a < a1 - 0.01; ) {
    const w = Math.min(rng.range(2.4, d.detail === 0 ? 7.2 : 4.8), a1 - a);
    const top = y1 + rng.range(-2.4, 1.6) * rough;
    let y = y0;
    let back = rng.range(0, 0.8);
    for (let k = 0; k < bands && y < top - 0.1; k++) {
      const h = k === bands - 1 ? top - y : Math.min(top - y, ((top - y0) / bands) * rng.range(0.7, 1.3));
      const c = fade(alongX ? a : face, alongX ? face : a);
      put(a, w, y, y + h, back, 6 + k * 1.6, mix(rng.pick(ROCK), HAZE, c));
      const step = rng.range(0.3, 1.4);
      if (d.detail > 0 && k + 1 < bands) put(a + 0.1, w - 0.2, y + h - 0.02, y + h + 0.24, back + 0.1, step + 0.1, mix(MOSS, HAZE, c));
      back += step;
      y += h;
    }
    if (d.detail > 0 && rough > 0 && rng.chance(0.4)) put(a + rng.range(0.2, w - 0.8), 0.5, top - rng.range(2.4, 6.4), top, back - 0.15, 0.2, mix('#3f8a3a', HAZE, 0.2));
    a += w;
  }
}

/** Broad-leaf canopy tree on ground at y. */
export function jungleTree(t: Pen, d: Drawer, rng: Rng, x: number, y: number, z: number, s: number) {
  const f = fade(x, z);
  t.cyl(x, y, z, 0.35 * s, 3.4 * s, mix('#6e4a2f', HAZE, f), undefined, 0, 6);
  t.ball(x, y + 3.6 * s, z, 2.2 * s, mix(rng.pick(CANOPY), HAZE, f), [1.25, 0.55, 1.25], 0.2, rng.int(1, 5));
  if (d.detail > 0) t.ball(x + rng.range(-1, 1) * s, y + 4.6 * s, z + rng.range(-1, 1) * s, 1.4 * s, mix(rng.pick(CANOPY), HAZE, f), [1.2, 0.6, 1.2], 0.2, rng.int(1, 5));
}

/** Fan palm: a leaning trunk and a crown of drooping fronds. */
export function palm(t: Pen, d: Drawer, rng: Rng, x: number, y: number, z: number, s: number) {
  const f = fade(x, z);
  const h = 6.4 * s;
  const lean = rng.range(-0.6, 0.6);
  t.beam(x, y, z, x + lean, y + h, z + lean * 0.5, 0.22 * s, mix('#8a6a44', HAZE, f));
  const fronds = d.detail === 0 ? 5 : 8;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2;
    t.beam(x + lean, y + h, z + lean * 0.5, x + lean + Math.cos(a) * 2.2 * s, y + h - 0.9 * s, z + lean * 0.5 + Math.sin(a) * 2.2 * s, 0.32 * s, mix(i % 2 ? '#3f8f3a' : '#2f7a34', HAZE, f));
  }
}

/** Trees scattered over a rectangle of ground at y. */
function grove(d: Drawer, x0: number, z0: number, x1: number, z1: number, y: number, n: number, seed: number) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(seed);
  const count = d.detail === 0 ? Math.round(n * 0.5) : n;
  for (let i = 0; i < count; i++) jungleTree(t, d, rng, rng.range(x0, x1), y, rng.range(z0, z1), rng.range(1.1, 2.0));
}

/** Water falling down a face from y1 to y0 at (x, z), facing the map along +z (north cliff) or +x (gorge). */
function waterfall(d: Drawer, x: number, z: number, y0: number, y1: number, w: number, alongX: boolean) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const box = (a: number, b: number, ya: number, yb: number, c: number, e: number, color: string, glass = true) =>
    alongX ? slab(d, [x + a, ya, z + c], [x + b, yb, z + e], color, glass ? 'glass' : 'plastic') : slab(d, [x + c, ya, z + a], [x + e, yb, z + b], color, glass ? 'glass' : 'plastic');
  box(-w / 2, w / 2, y0, y1, -0.3, 0.3, '#bfe8f0');
  box(-w / 2 - 0.3, w / 2 + 0.3, y1 - 0.4, y1 + 0.1, -1.2, 0.4, '#d8f2f6');
  if (d.detail > 0) for (let i = 0; i < 5; i++) {
    const o = -w / 2 + (i + 0.5) * (w / 5);
    box(o - 0.08, o + 0.08, y0 + 0.4, y1 - 0.6, 0.3, 0.42, '#f4fbfc', false);
  }
  for (let i = 0; i < (d.detail === 0 ? 2 : 5); i++) t.ball(x + (alongX ? (i - 2) * w * 0.25 : 0.8), y0 + 0.5, z + (alongX ? 0.8 : (i - 2) * w * 0.25), 0.9, '#eef8f8', [1.4, 0.7, 1.2], 0.2, i + 1);
  d.anim.foam.ring(alongX ? x : x + 1.0, alongX ? z + 1.0 : z, y0, w * 0.6, 1.2, d.detail === 0 ? 8 : 14);
}

/**
 * North: the stream along the cliff foot, a wooded bank beyond it, then the cliff with two waterfalls dropping into
 * pools that spill into the stream, and jungle on top: four depths of scenery from the camp's balustrade.
 */
export function northCliff(d: Drawer) {
  const Z = T.edge;
  const W = -T.edgeX - 0.4;
  const top = 20.8;
  const bank = 0.8;
  const [s0, s1, c] = [-Z - 2.4, -Z - 10.4, -Z - 19.2];
  slab(d, [W, STREAM_Y - 0.3, s0], [130, -0.02, -Z], '#6f7469');
  d.anim.water(W, s1, 130, s0, STREAM_Y, STREAM);
  d.anim.foam.edge(W, s0, 130, s0, STREAM_Y, 0, -1, 0.6);
  // The stream spills into the gorge at the north-west corner.
  waterfall(d, W - 0.2, (s0 + s1) / 2, GORGE_Y, STREAM_Y, 7.2, false);
  const falls: [number, number][] = [[-14.4, 3.2], [20.8, 2.4]];
  let x = W;
  for (const [fx, w] of [...falls, [131, 0] as [number, number]]) {
    const a = fx - w / 2 - 0.8;
    if (a > x) {
      slab(d, [x, STREAM_Y - 0.3, c], [a, bank, s1], '#7d8276');
      grove(d, x + 1, c + 1.6, a - 1, s1 - 1.6, bank, Math.max(1, Math.round((a - x) / 9)), Math.round(a * 7));
    }
    if (w > 0) {
      d.anim.water(fx - w / 2 - 0.8, c, fx + w / 2 + 0.8, s1, bank - 0.3, STREAM);
      waterfall(d, fx, s1 - 0.2, STREAM_Y, bank - 0.3, w + 1.6, true);
      waterfall(d, fx, c - 0.4, bank - 0.3, top - 1.2, w, true);
    }
    x = fx + w / 2 + 0.8;
  }
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(83);
  for (let bx = -36; bx < 40; bx += d.detail === 0 ? 9.6 : 5.6) t.ball(bx + rng.range(-1.6, 1.6), bank, s1 - rng.range(0.8, 2.4), rng.range(0.8, 1.6), rng.pick(ROCK), [1.3, 0.7, 1.1], 0.25, rng.int(1, 5));
  rockFace(d, true, c, 1, -130, 130, bank - 0.4, top, 17);
  slab(d, [-320, top - 1.2, -320], [320, top - 0.2, c - 9.6], mix('#4f8a3a', HAZE, 0.15));
  grove(d, -110, c - 40, 110, c - 11, top - 0.2, 70, 41);
}

/** West: the gorge below the rim balustrade, the river at its bottom, the far wall with a waterfall and jungle. */
export function gorge(d: Drawer) {
  const X = T.edgeX;
  const far = X + 20;
  const top = 12.8;
  rockFace(d, false, -X - 0.4, -1, -T.edge - 2.4, T.edge + 6.4, GORGE_Y, -0.1, 23, 0);
  d.anim.water(-far, -T.edge - 12.8, -X - 0.4, T.edge + 3.2, GORGE_Y, STREAM);
  slab(d, [-far - 2, GORGE_Y - 0.4, T.edge + 3.2], [-X - 0.4, RIVER_Y + 0.6, T.edge + 6.4], '#73806a');
  d.anim.foam.edge(-X - 0.4, -T.edge - 2.4, -X - 0.4, T.edge + 6.4, GORGE_Y, -1, 0, 0.6);
  rockFace(d, false, -far, 1, -T.edge - 12.8, T.edge + 6.4, GORGE_Y, top, 29);
  waterfall(d, -far - 0.4, -6.4, GORGE_Y, top - 1.2, 2.8, false);
  slab(d, [-320, top - 1.2, -160], [-far - 6, top - 0.2, T.edge + 6.4], mix('#4f8a3a', HAZE, 0.2));
  grove(d, -140, -60, -far - 8, T.edge, top - 0.2, 45, 43);
}

/** South: ghat steps down from the terrace balustrade to the river, the far bank's jungle and stupa, two boats. */
export function river(d: Drawer) {
  const Z = T.edge;
  const steps = 4;
  for (let k = 1; k <= steps; k++) slab(d, [-31.2, -0.48 * k - 0.48, Z + (k - 1) * 1.2], [31.2, -0.48 * k, Z + k * 1.2], k % 2 ? '#d8c49a' : '#cdb98e');
  slab(d, [-31.2, RIVER_Y - 0.6, Z + steps * 1.2], [31.2, -0.48 * steps - 0.48, Z + steps * 1.2 + 0.6], '#bfae86');
  const z0 = Z + steps * 1.2;
  d.anim.water(-160, z0, 160, 150, RIVER_Y, RIVER);
  d.anim.foam.edge(-31.2, z0, 31.2, z0, RIVER_Y, 0, 1, 0.5);
  for (const s of [-1, 1]) slab(d, [s > 0 ? T.edgeX - 7.2 : -T.edgeX - 2.4, RIVER_Y - 0.4, Z], [s > 0 ? T.edgeX + 60 : -T.edgeX + 7.2, 0.4, Z + 3.2], '#7d8276');
  const bank = 118;
  slab(d, [-320, RIVER_Y - 0.4, bank], [320, 1.2, 320], mix('#6f9a4a', HAZE, 0.3));
  grove(d, -150, bank + 4, 150, bank + 40, 1.2, 60, 47);
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(53);
  for (let i = 0; i < (d.detail === 0 ? 6 : 12); i++) palm(t, d, rng, rng.range(-120, 120), 1.2, bank + rng.range(1, 4), rng.range(0.9, 1.3));
  stupa(t, -36, 1.2, bank + 16, 1.0);
  for (const [x, z, yaw] of [[-18, 74, 0.3], [27, 92, -0.2]] as const) boat(t, x, z, yaw);
}

/** Corncob temple tower: stepped storeys, a lotus bud and a gold finial, tinted toward the haze by distance. */
export function stupa(t: Pen, x: number, y: number, z: number, s: number) {
  const f = fade(x, z) * 0.8;
  const stone = mix('#b8b49a', HAZE, f);
  let w = 12 * s;
  let h = y;
  for (let k = 0; k < 5; k++) {
    const kh = w * 0.3;
    t.box(x, h, z, w, kh, w, k % 2 ? stone : mix('#a8a48a', HAZE, f), undefined, 0);
    h += kh;
    w *= 0.74;
  }
  t.cone(x, h, z, w * 0.6, 0.2, w * 2.4, stone, undefined, 8);
  t.cone(x, h + w * 2.4, z, 0.3 * s, 0.02, w * 0.9, mix('#e0b040', HAZE, f), 'metal', 6);
}

/** A long-tailed river boat with a woven canopy. */
function boat(t: Pen, x: number, z: number, yaw: number) {
  t.box(x, RIVER_Y - 0.2, z, 8, 0.6, 1.6, '#6a4a2e', undefined, 0.1, yaw);
  t.box(x + Math.cos(yaw) * 0.8, RIVER_Y + 0.4, z - Math.sin(yaw) * 0.8, 3.2, 1.0, 1.4, '#c9a86a', undefined, 0.2, yaw);
}

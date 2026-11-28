import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { BAND, RAVINE, T } from './temple-layout';
import { Frame, mix, Rng } from './util';

/**
 * The world beyond the temple's four edges, no colliders: the gorge and the ravine (north), the river below the ghats
 * (south), the cliffs behind the camps (west and east). The far bank's village is temple-village.ts. Strata step back as they rise and
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
 * North: the gorge below the rim balustrade, the stream at its bottom, the far wall with two waterfalls and jungle on
 * top; the ravine under the stone bridge with the waterfall from the rock behind it, its stream running out into the gorge.
 */
export function gorge(d: Drawer) {
  const Z = T.edge;
  const X = T.edgeX + 3.2;
  const far = Z + 26;
  const top = 12.8;
  for (const [a0, a1] of [[-X, -RAVINE], [RAVINE, X]] as const) rockFace(d, true, -Z - 0.4, -1, a0, a1, GORGE_Y, -0.1, 23 + Math.round(a0), 0);
  d.anim.water(-130, -far, 130, -Z - 0.4, GORGE_Y, STREAM);
  d.anim.foam.edge(-X, -Z - 0.4, X, -Z - 0.4, GORGE_Y, 0, -1, 0.6);
  rockFace(d, true, -far, 1, -130, 130, GORGE_Y, top, 29);
  for (const x of [-38, 26]) waterfall(d, x, -far + 0.4, GORGE_Y, top - 1.2, 2.8, true);
  slab(d, [-320, top - 1.2, -320], [320, top - 0.2, -far - 6], mix('#4f8a3a', HAZE, 0.2));
  grove(d, -130, -far - 40, 130, -far - 8, top - 0.2, 60, 43);
  // The ravine: rock walls under its rails, the stream, the waterfall off the ravine head.
  const head = BAND.north;
  rockFace(d, false, -RAVINE, 1, -Z - 0.4, head, GORGE_Y, -0.1, 31, 0);
  rockFace(d, false, RAVINE, -1, -Z - 0.4, head, GORGE_Y, -0.1, 37, 0);
  d.anim.water(-RAVINE, -Z - 0.4, RAVINE, head, GORGE_Y + 0.2, STREAM);
  waterfall(d, 0, head - 0.4, GORGE_Y + 0.2, 7.6, 2.4, true);
}

/** South: ghat steps down from the terrace balustrade to the river, the far bank's village and jungle, boats. */
export function river(d: Drawer) {
  const Z = T.edge;
  const X = T.edgeX + 3.2;
  const steps = 4;
  for (let k = 1; k <= steps; k++) slab(d, [-X, -0.48 * k - 0.48, Z + (k - 1) * 1.2], [X, -0.48 * k, Z + k * 1.2], k % 2 ? '#d8c49a' : '#cdb98e');
  slab(d, [-X, RIVER_Y - 0.6, Z + steps * 1.2], [X, -0.48 * steps - 0.48, Z + steps * 1.2 + 0.6], '#bfae86');
  const z0 = Z + steps * 1.2;
  d.anim.water(-200, z0, 200, 160, RIVER_Y, RIVER);
  d.anim.foam.edge(-X, z0, X, z0, RIVER_Y, 0, 1, 0.5);
  const bank = 112;
  slab(d, [-320, RIVER_Y - 0.4, bank], [320, 1.2, 320], mix('#6f9a4a', HAZE, 0.3));
  grove(d, -150, bank + 14, 150, bank + 50, 1.2, 60, 47);
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(53);
  for (let i = 0; i < (d.detail === 0 ? 6 : 12); i++) palm(t, d, rng, rng.range(-140, 140), 1.2, bank + rng.range(1, 4), rng.range(0.9, 1.3));
  stupa(t, 44, 1.2, bank + 26, 1.0);
  for (const [x, z, yaw] of [[-18, 70, 0.3], [27, 88, -0.2], [-52, 96, 0.1]] as const) boat(t, x, z, yaw);
}

/**
 * Behind the camps: the cliff tops above the camp cliffs with jungle, the west cliff's waterfall into the pool in its
 * recess, and the east's terraced slopes climbing to a stupa.
 */
export function campCliffs(d: Drawer) {
  const X = T.edgeX;
  const back = X + 30;
  const top = 18;
  for (const s of [-1, 1]) {
    // The terrace wall under the rail, the pool or paddies at its foot, the cliff behind with jungle on top.
    rockFace(d, false, s * (X + 0.4), s < 0 ? -1 : 1, -T.edge - 4, T.edge + 4, -2.4, -0.1, 71 + s, 0);
    d.anim.water(s < 0 ? -back : X + 0.4, -T.edge - 4, s < 0 ? -X - 0.4 : back, T.edge + 4, -2.0, STREAM);
    rockFace(d, false, s * back, s < 0 ? 1 : -1, -T.edge - 40, T.edge + 40, -2.4, top, 73 + s);
    slab(d, [s < 0 ? -320 : back, top - 1.2, -T.edge - 60], [s < 0 ? -back : 320, top - 0.2, T.edge + 60], mix('#4f8a3a', HAZE, 0.15));
  }
  for (const z of [-14, 18]) waterfall(d, -back - 0.4, z, -2.0, top - 0.8, z < 0 ? 3.6 : 2.4, false);
  grove(d, -160, -70, -back - 8, 70, top - 0.2, 40, 53);
  const t = new Pen(d, new Frame(0, 0, 0));
  const steps = d.detail === 0 ? 5 : 8;
  for (let k = 0; k < steps; k++) {
    const x = back + 4 + k * 5.6;
    const y = top + k * 1.6;
    const f = fade(x, 0);
    t.box(x + 30, y - 2, -8, 60, 2.0 + 0.02, 110 - k * 8, mix(k % 2 ? '#6f9a4a' : '#5f8a3a', HAZE, f), undefined, 0);
    if (d.detail > 0) t.box(x + 1.6, y + 0.01, -8, 2.4, 0.02, 102 - k * 8, mix('#9fc8c0', HAZE, f + 0.1), 'glass', 0);
  }
  for (let k = 0; k < 6; k++) t.box(X + 8 + k * 3.2, -2.0 + 0.01, (k - 2.5) * 14, 2.8, 0.3, 12, mix('#8fb86a', HAZE, 0.2), undefined, 0);
  stupa(t, back + 4 + steps * 5.6 + 8, top + steps * 1.6 - 0.1, -10, 1.1);
}

/**
 * Rock knolls and spits outside the rails, so the terrace's outline reads as a ridge in the valley rather than a
 * rectangle: big ones round each corner, smaller ones at uneven steps along the gorge and the camp edges, each a few
 * stepped blocks with moss and a shrub or two on top. Out of reach beyond the rails; no colliders.
 */
export function outcrops(d: Drawer) {
  const X = T.edgeX + 0.4;
  const Z = T.edge + 0.4;
  const rng = new Rng(83);
  const t = new Pen(d, new Frame(0, 0, 0));
  const knoll = (x0: number, z0: number, x1: number, z1: number, top: number, foot: number) => {
    const tiers = d.detail === 0 ? 2 : 3;
    for (let k = 0; k < tiers; k++) {
      const i = k * 0.9;
      const ya = foot + ((top - foot) * k) / tiers;
      const yb = foot + ((top - foot) * (k + 1)) / tiers;
      slab(d, [x0 + i + rng.range(0, 0.4), ya, z0 + i + rng.range(0, 0.4)], [x1 - i - rng.range(0, 0.4), yb, z1 - i - rng.range(0, 0.4)], rng.pick(ROCK));
    }
    const i = tiers * 0.9 - 0.9;
    slab(d, [x0 + i + 0.2, top - 0.02, z0 + i + 0.2], [x1 - i - 0.2, top + 0.22, z1 - i - 0.2], MOSS);
    if (d.detail > 0 && x1 - x0 > 4 && z1 - z0 > 4) jungleTree(t, d, rng, (x0 + x1) / 2 + rng.range(-1, 1), top + 0.2, (z0 + z1) / 2 + rng.range(-1, 1), rng.range(0.6, 0.9));
  };
  for (const s of [-1, 1]) {
    // Corners: the gorge corner drops toward the gorge water, the river corner to the river.
    knoll(s < 0 ? -X - 14 : X, -Z - 12, s < 0 ? -X : X + 14, -Z + 6, 1.6, GORGE_Y);
    knoll(s < 0 ? -X - 10 : X, Z - 8, s < 0 ? -X : X + 10, Z + 9, 1.2, RIVER_Y - 0.4);
    // Along the camp edge, between the corners.
    for (let z = -Z + 10; z < Z - 12; ) {
      const w = rng.range(4, 9);
      const out = rng.range(2.4, 7.2);
      knoll(s < 0 ? -X - out : X, z, s < 0 ? -X : X + out, z + w, rng.range(-1.2, 0.8), -2.4);
      z += w + rng.range(4, 14);
    }
    // Along the gorge rim, west of the ravine.
    for (let a = 16; a < X - 16; ) {
      const w = rng.range(5, 10);
      const out = rng.range(2.4, 8);
      const x0 = s * a;
      knoll(Math.min(x0, x0 + s * w), -Z - out, Math.max(x0, x0 + s * w), -Z, rng.range(-2.4, 0.4), GORGE_Y);
      a += w + rng.range(6, 16);
    }
  }
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

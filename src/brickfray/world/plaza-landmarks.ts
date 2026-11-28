import { masonryFaces, slab, type Opening } from './blocks';
import { facadeHole } from './facade';
import type { Drawer } from './plan';
import type { Piece } from './plaza-layout';
import { PORTICO, TOWER } from './plaza-middle';
import { IRON, QUAY, STONE, WOOD } from './plaza-style';
import { pieceFrame } from './plaza-things';
import { Pen } from './props-kit';
import { faceFrame, Frame, Rng, shade, type Face } from './util';

const WORLD = new Frame(0, 0, 0, 0);

/**
 * Town hall above its council hall (walls and the facade over the ceiling are pieces): a roof balustrade, door frames,
 * a pediment over the portico, and the clock tower over the north half with a clock on every face, an open belfry and
 * a copper spire: the landmark every street points at.
 */
export function townHall(d: Drawer) {
  const { x0: hx0, x1: hx1, z0, z1, top, door, doorTop, shaft, belfryTop } = TOWER;
  const style = { ...STONE, colors: ['#efe5cf', '#e3d6bc', '#f5eedc'] };
  const W = new Pen(d, WORLD);
  for (const [a, b, c, e] of [[hx0, z0, hx1, z0 + 0.3], [hx0, z1 - 0.3, hx1, z1], [hx0, z0, hx0 + 0.3, z1], [hx1 - 0.3, z0, hx1, z1]] as const) W.span(a, top, b, c, top + 0.9, e, '#e3d6bc', undefined, 0.03);
  W.span(hx0 + 0.3, top, z0 + 0.3, hx1 - 0.3, top + 0.08, z1 - 0.3, '#8a8f94');
  const north = new Pen(d, faceFrame('n', hx0, z0, hx1, z1).f);
  north.frame((hx1 - hx0) / 2, 0, 0.02, 2 * door + 0.4, doorTop + 0.3, 0.3, 0.16, '#c9b48a');
  north.box((hx1 - hx0) / 2, doorTop + 0.3, 0.06, 0.6, 0.6, 0.12, '#c9b48a', undefined, 0.02);
  // Pediment over the portico roof, its tympanum in town red.
  const pz = PORTICO.z1;
  const py = PORTICO.deck + 3.52;
  W.prism('pediment', [[-hx1, 0], [hx1, 0], [0, 2.2]], 0.5, 0, py, pz - 0.25, '#efe5cf', undefined, Math.PI / 2);
  W.prism('tympanum', [[-hx1 + 1.2, 0.2], [hx1 - 1.2, 0.2], [0, 1.7]], 0.1, 0, py, pz + 0.02, '#c4553a', undefined, Math.PI / 2);
  const tx = (shaft.x0 + shaft.x1) / 2;
  const tz = (shaft.z0 + shaft.z1) / 2;
  const hw = (shaft.x1 - shaft.x0) / 2;
  const hd = (shaft.z1 - shaft.z0) / 2;
  const bell = belfryTop - 2.4;
  masonryFaces(d, [shaft.x0, top, shaft.z0], [shaft.x1, bell, shaft.z1], style, ['n', 's', 'e', 'w']);
  slab(d, [shaft.x0 + 0.05, top, shaft.z0 + 0.05], [shaft.x1 - 0.05, bell, shaft.z1 - 0.05], shade(style.colors[0]!, -0.3));
  for (const [rot, out] of [[2, hd], [0, hd], [1, hw], [3, hw]] as const) {
    const t = new Pen(d, new Frame(tx, 0, tz, rot).child(0, 0, out));
    const cy = bell - 1.6;
    t.cylZ(0, cy, 0.08, 1.35, 0.16, '#c9b48a', undefined, 0.04);
    t.cylZ(0, cy, 0.18, 1.2, 0.04, '#f5eedc', undefined, 0);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      t.box(Math.sin(a) * 1.02, cy + Math.cos(a) * 1.02 - 0.06, 0.2, 0.07, 0.14, 0.03, IRON, undefined, 0);
    }
    t.box(0, cy, 0.22, 0.08, 0.9, 0.03, IRON, 'metal', 0);
    t.box(0.24, cy - 0.04, 0.24, 0.6, 0.08, 0.03, IRON, 'metal', 0);
    t.box(0, bell, 0, 2 * (rot % 2 ? hd : hw) + 0.2, 0.24, 0.3, '#c9b48a', undefined, 0.02);
  }
  for (const sx of [shaft.x0 + 0.35, shaft.x1 - 0.35]) for (const sz of [shaft.z0 + 0.35, shaft.z1 - 0.35]) W.span(sx - 0.35, bell, sz - 0.35, sx + 0.35, belfryTop, sz + 0.35, '#e3d6bc', undefined, 0.03);
  W.span(shaft.x0 - 0.15, belfryTop, shaft.z0 - 0.15, shaft.x1 + 0.15, belfryTop + 0.3, shaft.z1 + 0.15, '#c9b48a', undefined, 0.03);
  W.box(tx, bell + 0.1, tz, 1.1, 1.1, 1.1, '#c99a3e', 'chrome', 0.1);
  W.cone(tx, belfryTop + 0.3, tz, Math.min(hw, hd) * 1.25, 0.08, 4.6, '#4f9a8a', undefined, 4, Math.PI / 4);
  W.ball(tx, belfryTop + 5.0, tz, 0.24, '#c99a3e', undefined, 0, 1, 'chrome');
  d.anim.flag([hx1 - 0.8, top + 0.9, z1 - 1.2], 0, 1.6, 1.0, ['#c8231b', '#f2f2ee', '#c8231b'], false, 'bands');
  W.cyl(hx1 - 0.8, top, z1 - 1.2, 0.05, 2.9, IRON, 'metal');
}

/** Glass station roof: a ribbed glazed barrel stepped over iron arches, a clerestory along the ridge. */
export function stationRoof(d: Drawer, p: Piece) {
  const [x0, y0, z0] = p.min;
  const [x1, , z1] = p.max;
  const W = new Pen(d, WORLD);
  W.span(x0 - 0.3, y0, z0 - 0.3, x1 + 0.3, y0 + 0.4, z1 + 0.3, '#dfe9ef', undefined, 0.03);
  const steps = 4;
  for (let k = 0; k < steps; k++) {
    const inset = (k * (z1 - z0)) / (2 * steps + 2);
    W.span(x0 + 0.1, y0 + 0.4 + k * 0.6, z0 + inset, x1 - 0.1, y0 + 1.0 + k * 0.6, z1 - inset, '#8fb9cf', 'glass');
  }
  for (let x = x0 + 0.8; x <= x1 - 0.79; x += 2.4) for (let k = 0; k < steps; k++) {
    const inset = (k * (z1 - z0)) / (2 * steps + 2);
    W.span(x - 0.06, y0 + 0.4 + k * 0.6, z0 + inset - 0.02, x + 0.06, y0 + 1.02 + k * 0.6, z1 - inset + 0.02, '#2f363d', 'metal');
  }
  W.span(x0, y0 + 0.4 + steps * 0.6, (z0 + z1) / 2 - 0.4, x1, y0 + 0.6 + steps * 0.6, (z0 + z1) / 2 + 0.4, '#3f5a6e', undefined, 0.02);
}

/** Yard well (west) or pump house (east): a stone drum, posts, a little tiled roof and a bucket on its rope. */
export function well(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const r = Math.min(len, wid) / 2;
  t.cyl(0, 0, 0, r, 1.0, p.tag === 'well' ? '#b9ae98' : '#8a8f94', undefined, 0.05);
  t.cyl(0, 1.0, 0, r + 0.05, 0.1, '#e3d6bc', undefined, 0.03);
  for (const s of [-1, 1]) t.box(s * (r - 0.12), 1.1, 0, 0.16, h - 1.5, 0.16, WOOD, undefined, 0.01);
  t.box(0, h - 0.5, 0, len + 0.2, 0.12, wid * 0.4, WOOD, undefined, 0.01);
  t.prism('well-roof', [[-wid / 2 - 0.2, 0], [wid / 2 + 0.2, 0], [0, 0.42]], len + 0.3, 0, h - 0.42, 0, '#a8321f', undefined, 0);
  t.box(0, 1.4, 0, 0.02, h - 1.9, 0.02, '#e3d6bc', undefined, 0);
  t.cyl(0, 1.25, 0, 0.16, 0.24, IRON, 'metal');
}

/** Tram on its rails: red skirts, cream body, a band of windows, doors toward the gate, a pantograph on the roof. */
export function tram(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p, true);
  const t = new Pen(d, f);
  const red = '#c8231b';
  const cream = '#f3e6b8';
  t.box(0, 0.06, 0, len - 1.0, 0.34, wid - 0.5, '#2f363d', undefined, 0.02);
  for (const x of [-len / 2 + 2.2, len / 2 - 2.2]) for (const s of [-1, 1]) t.cylZ(x, 0.32, s * (wid / 2 - 0.3), 0.32, 0.16, '#1f2328', 'metal', 0.03);
  t.box(0, 0.4, 0, len - 0.2, 0.9, wid, red, undefined, 0.06);
  t.box(0, 1.3, 0, len - 0.2, 1.4, wid - 0.04, cream, undefined, 0.06);
  t.box(0, 2.7, 0, len - 0.4, h - 2.7, wid - 0.2, shade(cream, -0.08), undefined, 0.12);
  for (const s of [-1, 1]) {
    t.box(0, 1.42, s * (wid / 2 - 0.01), len - 1.2, 0.95, 0.04, '#2c3c4a', undefined, 0);
    if (d.detail > 0) for (let k = 0; k <= 8; k++) t.box(-len / 2 + 0.6 + (k * (len - 1.2)) / 8, 1.42, s * (wid / 2 + 0.01), 0.1, 0.95, 0.04, cream, undefined, 0);
    t.box(0, 0.86, s * (wid / 2 + 0.01), len - 0.3, 0.1, 0.04, '#f6c624', undefined, 0);
  }
  for (const x of [-len / 4, len / 4]) {
    t.box(x, 0.42, wid / 2 + 0.01, 1.3, 2.2, 0.04, shade(red, -0.15), undefined, 0.01);
    t.box(x, 1.4, wid / 2 + 0.03, 0.05, 1.1, 0.02, '#f2f2ee', undefined, 0);
  }
  for (const s of [-1, 1]) {
    const x = s * (len / 2 - 0.1);
    t.box(x, 1.4, 0, 0.12, 0.95, wid - 0.5, '#2c3c4a', undefined, 0);
    t.box(x, 2.45, 0, 0.12, 0.26, wid - 0.8, '#23303b', undefined, 0);
    for (const z of [-0.7, 0.7]) t.box(x, 0.7, z, 0.1, 0.18, 0.3, '#fff6d6', 'chrome', 0.02);
  }
  if (d.detail === 0) return;
  t.box(0, h, 0, 1.6, 0.12, 0.9, IRON, 'metal', 0);
  t.beam(-0.6, h + 0.1, 0, 0.3, h + 0.9, 0, 0.05, IRON, 'metal');
  t.beam(0.3, h + 0.9, 0, -0.4, h + 1.5, 0, 0.05, IRON, 'metal');
  t.box(-0.4, h + 1.5, 0, 0.1, 0.05, 1.4, IRON, 'metal', 0);
}

/** Bandstand or pavilion: a deck on a stone base and a striped canopy with a finial (the posts are pillars). */
export function stage(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const park = p.tag === 'park';
  t.box(0, 0, 0, len, h - 0.12, wid, park ? '#e3d6bc' : '#efe5cf', undefined, 0.03);
  t.box(0, h - 0.12, 0, len + 0.1, 0.12, wid + 0.1, '#b98a5a', undefined, 0.01);
  if (d.detail > 0) for (const s of [-1, 1]) for (let u = -len / 2 + 0.8; u < len / 2 - 0.4; u += 1.6) t.box(u, 0.12, s * (wid / 2 + 0.01), 0.8, h - 0.4, 0.03, park ? '#2f8a3e' : '#c8231b', undefined, 0.01);
}

export function canopy(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const park = p.tag === 'park';
  const [a, b] = park ? ['#2f8a3e', '#f2f2ee'] : ['#c8231b', '#f2f2ee'];
  t.box(0, 0, 0, len, h, wid, '#f2f2ee', undefined, 0.03);
  const n = 8;
  for (let i = 0; i < n; i++) t.box(-len / 2 + (len / n) * (i + 0.5), 0.05, 0, len / n, h - 0.1, wid + 0.04, i % 2 ? a : b, undefined, 0.01);
  t.cone(0, h, 0, Math.min(len, wid) * 0.62, 0.1, park ? 1.2 : 1.8, a, undefined, 4, Math.PI / 4);
  t.ball(0, h + (park ? 1.3 : 1.9), 0, 0.18, '#c99a3e', undefined, 0, 1, 'chrome');
  if (d.detail > 0) for (let i = 0; i < 12; i++) t.box(-len / 2 + (len / 12) * (i + 0.5), -0.2, wid / 2, 0.24, 0.2, 0.04, i % 2 ? a : b, undefined, 0.01);
}

/** Fountain basin (square) or lily pond (park): a stone rim round animated water, a column with bowls in the fountain. */
export function basin(d: Drawer, p: Piece) {
  const [x0, , z0] = p.min;
  const [x1, h, z1] = p.max;
  const W = new Pen(d, WORLD);
  const r = 0.4;
  for (const [a, b, c, e] of [[x0, z0, x1, z0 + r], [x0, z1 - r, x1, z1], [x0, z0 + r, x0 + r, z1 - r], [x1 - r, z0 + r, x1, z1 - r]] as const) W.span(a, 0, b, c, h, e, '#e3d6bc', undefined, 0.04);
  W.span(x0 + r, 0, z0 + r, x1 - r, h - 0.12, z1 - r, '#3b6f8a');
  d.anim.water(x0 + r, z0 + r, x1 - r, z1 - r, h - 0.1, p.tag === 'park' ? '#3f8f8a' : '#4fb3d9');
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (p.tag === 'park') {
    if (d.detail === 0) return;
    const rng = new Rng(5);
    for (let i = 0; i < 9; i++) W.cyl(cx + rng.range(-2.6, 2.6), h - 0.08, cz + rng.range(-1.4, 1.4), rng.range(0.22, 0.36), 0.03, '#5aa83f');
    for (const [dx, dz] of [[-1.2, 0.4], [1.6, -0.6]] as const) {
      W.box(cx + dx, h - 0.1, cz + dz, 0.36, 0.2, 0.24, '#f2f2ee', undefined, 0.06);
      W.box(cx + dx + 0.16, h + 0.1, cz + dz, 0.14, 0.18, 0.14, '#2f7a34', undefined, 0.04);
      W.box(cx + dx + 0.26, h + 0.16, cz + dz, 0.1, 0.05, 0.08, '#f58a1f', undefined, 0);
    }
  }
}

/** The fountain's central column with three bowls (its collider is a pillar piece). */
export function fountainColumn(d: Drawer, p: Piece) {
  const cx = (p.min[0] + p.max[0]) / 2;
  const cz = (p.min[2] + p.max[2]) / 2;
  const W = new Pen(d, WORLD);
  const half = Math.min(p.max[0] - p.min[0], p.max[2] - p.min[2]) / 2;
  W.cyl(cx, p.min[1], cz, 0.36, p.max[1] - p.min[1], '#e3d6bc', undefined, 0.04);
  // A stone drum and the lowest bowl fill the collider's width, so a player wading in stops at the stone.
  W.cyl(cx, p.min[1], cz, half - 0.05, 0.9, '#e3d6bc', undefined, 0.05);
  for (const [y, r] of [[1.1, half], [1.9, 0.7], [2.5, 0.42]] as const) {
    W.cyl(cx, y, cz, r, 0.16, '#efe5cf', undefined, 0.05);
    W.cyl(cx, y + 0.12, cz, r - 0.08, 0.05, '#7fc8e8', 'glass');
  }
  W.cyl(cx, p.max[1], cz, 0.2, 0.1, '#efe5cf', undefined, 0.03);
  W.cyl(cx, p.max[1] + 0.1, cz, 0.05, 0.16, '#c99a3e', 'chrome');
  W.ball(cx, p.max[1] + 0.36, cz, 0.16, '#c99a3e', undefined, 0, 1, 'chrome');
}

/** Statue plinth with a bronze obelisk and a gilded ball (the needle has its own collider piece). */
export function plinth(d: Drawer, p: Piece) {
  const W = new Pen(d, WORLD);
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (y0 > 0.1) {
    const w = x1 - x0;
    W.box(cx, y0, cz, w, (y1 - y0) * 0.86, z1 - z0, '#8a6a3a', 'chrome', 0.06);
    W.cone(cx, y0 + (y1 - y0) * 0.86, cz, w * 0.72, 0.02, (y1 - y0) * 0.14, '#8a6a3a', 'chrome', 4, Math.PI / 4);
    W.ball(cx, y1 + 0.2, cz, 0.24, '#e0b84a', undefined, 0, 1, 'chrome');
    return;
  }
  W.span(x0, 0, z0, x1, 0.32, z1, '#b9a888', undefined, 0.03);
  W.span(x0 + 0.16, 0.32, z0 + 0.16, x1 - 0.16, y1 - 0.24, z1 - 0.16, '#e3d6bc', undefined, 0.03);
  W.span(x0 + 0.06, y1 - 0.24, z0 + 0.06, x1 - 0.06, y1, z1 - 0.06, '#c9b48a', undefined, 0.03);
  if (d.detail > 0) for (const [fx, fz] of [[cx, z0 + 0.15], [cx, z1 - 0.15], [x0 + 0.15, cz], [x1 - 0.15, cz]] as const) W.box(fx, 0.42, fz, 0.9, Math.min(0.6, y1 - 0.8), 0.9, '#c99a3e', 'chrome', 0.02);
}

/** Canal water, quay walls down to the bed, a mooring ring now and then. */
export function canalBed(d: Drawer, p: Piece) {
  const [x0, , z0] = p.min;
  const [x1, , z1] = p.max;
  const top = 0;
  const water = -0.9;
  d.anim.water(x0, z0, x1, z1, water, '#2f8fb3');
  slab(d, [x0, p.min[1], z0], [x1, water - 0.05, z1], '#24546a');
  masonryFaces(d, [x0, p.max[1], z0 - 0.4], [x1, top, z0], QUAY, ['s']);
  masonryFaces(d, [x0, p.max[1], z1], [x1, top, z1 + 0.4], QUAY, ['n']);
  const W = new Pen(d, WORLD);
  for (const z of [z0, z1]) W.span(x0, top - 0.02, z - 0.2, x1, top + 0.02, z + 0.2, '#c9c6bd');
  if (d.detail === 0) return;
  for (let x = x0 + 3.2; x < x1 - 1; x += 6.4) for (const z of [z0 + 0.05, z1 - 0.05]) W.ringUp(x, -0.4, z, 0.14, 0.03, IRON, 'metal');
}

/** Lock gates under the footbridge (its deck runs down to the bed) and a stone road bridge. */
export function bridge(d: Drawer, p: Piece) {
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  const W = new Pen(d, WORLD);
  if (y0 < -1) {
    W.span(x0, y0, z0, x1, -0.9, z1, '#6e4a2f');
    for (const x of [x0, x1 - 0.3]) W.span(x, -0.9, z0, x + 0.3, y1 - 0.4, z1, '#8a5f3a', undefined, 0.02);
    W.span(x0 + 0.3, -0.9, z0, x1 - 0.3, y1 - 0.4, z1, '#7a5233', undefined, 0.02);
    if (d.detail > 0) for (let z = z0 + 0.6; z < z1; z += 1.2) W.span(x0 - 0.02, -0.6, z, x1 + 0.02, -0.5, z + 0.1, IRON, 'metal');
    W.span(x0, y1 - 0.4, z0, x1, y1, z1, '#c9c6bd', undefined, 0.02);
    return;
  }
  masonryFaces(d, [x0, -1.6, z0], [x1, y1, z1], { ...STONE, colors: ['#c9c6bd', '#bdb9ae', '#d4d1c6'] }, ['e', 'w']);
  W.span(x0, y1 - 0.02, z0, x1, y1, z1, '#67686a');
}

/** Market-hall roof: red tiles in steps and a glazed lantern along the ridge (all above the collider). */
export function hallRoof(d: Drawer, p: Piece) {
  const [x0, y0, z0] = p.min;
  const [x1, , z1] = p.max;
  const W = new Pen(d, WORLD);
  W.span(x0 - 0.3, y0, z0 - 0.3, x1 + 0.3, y0 + 0.4, z1 + 0.3, '#c9b48a', undefined, 0.03);
  const steps = 5;
  const cx = (x0 + x1) / 2;
  for (let k = 0; k < steps; k++) {
    const inset = (k * (x1 - x0)) / (2 * steps + 2);
    W.span(x0 + inset, y0 + 0.4 + k * 0.5, z0 + 0.1, x1 - inset, y0 + 0.9 + k * 0.5, z1 - 0.1, k % 2 ? '#a8321f' : '#b83a24', undefined, 0.02);
  }
  const ly = y0 + 0.4 + steps * 0.5;
  W.span(cx - 1.6, ly, z0 + 1.2, cx + 1.6, ly + 1.2, z1 - 1.2, '#8fb9cf', 'glass');
  for (let z = z0 + 1.2; z <= z1 - 1.2 + 0.01; z += 1.6) W.span(cx - 1.65, ly, z - 0.06, cx + 1.65, ly + 1.2, z + 0.06, '#f2f2ee');
  W.span(cx - 2.0, ly + 1.2, z0 + 0.9, cx + 2.0, ly + 1.45, z1 - 0.9, '#a8321f', undefined, 0.03);
}

/** Brick dressing of the hall's long walls is plain masonry; its gable ends get a round window and a date stone. */
export function hallGables(d: Drawer, x0: number, x1: number, z: number, out: 1 | -1, top: number) {
  const f = new Frame((x0 + x1) / 2, 0, z, out > 0 ? 0 : 2);
  const t = new Pen(d, f);
  t.ringUp(0, top - 2.2, 0.06, 1.0, 0.16, '#e3d6bc');
  t.cylZ(0, top - 2.2, 0.03, 0.95, 0.04, '#2c3c4a', 'glass');
  t.box(0, top - 0.6, 0.06, 2.6, 0.5, 0.1, '#e3d6bc', undefined, 0.02);
}

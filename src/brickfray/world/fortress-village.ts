import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, type Rng, shade } from './util';

/** Building blocks for the country round the fortress: cottages, a church, a windmill, trees, tents and ricks. */

export const HAZE = '#efd9bd';

/** Tints a colour toward the haze with its distance from the keep. */
export function hz(color: string, x: number, z: number) {
  return mix(color, HAZE, Math.min(0.5, Math.max(0, (Math.hypot(x, z) - 50) / 230)));
}

const PLASTER = ['#efe6cf', '#e8d9b0', '#ead2c0', '#dfe3d6', '#f0e2b8', '#e3cfa6'];
const ROOFS = ['#9a4a2a', '#a85a32', '#7d5a46', '#8a3f2a', '#6f6a62', '#b0623a'];
const TIMBER = '#5e3f27';
const GLASS = '#2e3a44';
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Which way a front faces: turns for a Frame whose local +z points out of the front. */
export type Facing = 's' | 'e' | 'n' | 'w';
const TURNS: Record<Facing, number> = { s: 0, e: 1, n: 2, w: 3 };

/**
 * Timber-framed cottage: plaster ground floor, a jettied upper floor with posts, studs and braces on the front, windows,
 * a door, a gable roof (ridge along the street, or the gable turned to it) and a chimney. (x, z) is the plan centre at
 * ground height y; `w` runs along the front, `dd` back from it.
 */
export function house(d: Drawer, x: number, y: number, z: number, facing: Facing, w: number, dd: number, rng: Rng, gable = rng.chance(0.4)) {
  const t = new Pen(d, new Frame(x, y, z, TURNS[facing]));
  const c = (k: string) => hz(k, x, z);
  const wall = c(rng.pick(PLASTER));
  const timber = c(TIMBER);
  const roof = c(rng.pick(ROOFS));
  const g = 2.88;
  const h = g + rng.pick([2.4, 2.72, 3.04]);
  const jet = 0.4;
  t.box(0, 0, 0, w, g, dd, wall, undefined, 0);
  t.box(0, g, jet / 2, w + 0.1, h - g, dd + jet, shade(wall, 0.03), undefined, 0);
  const front = dd / 2;
  const upper = front + jet;
  t.box(0, g - 0.2, upper - 0.02, w + 0.2, 0.28, 0.3, timber, undefined, 0);
  t.box(0, h - 0.2, upper, w + 0.2, 0.24, 0.24, timber, undefined, 0);
  for (const s of [-1, 1]) {
    t.box(s * (w / 2 - 0.1), 0, front, 0.24, g, 0.16, timber, undefined, 0);
    t.box(s * (w / 2 - 0.05), g, upper, 0.22, h - g, 0.14, timber, undefined, 0);
  }
  const bays = Math.max(2, Math.round(w / 2.4));
  const bay = w / bays;
  for (let i = 0; i < bays; i++) {
    const u = -w / 2 + bay * (i + 0.5);
    if (d.detail > 0 && i > 0) t.box(u - bay / 2, g, upper + 0.02, 0.16, h - g, 0.1, timber, undefined, 0);
    const win = i % 2 === 0 || bays < 3;
    if (win) window(t, u, g + 0.62, upper, 0.86, 1.1, timber, d);
    else if (d.detail > 0) {
      t.beam(u - bay / 2 + 0.2, g + 0.1, upper + 0.04, u + bay / 2 - 0.2, h - 0.3, upper + 0.04, 0.13, timber);
      t.beam(u + bay / 2 - 0.2, g + 0.1, upper + 0.04, u - bay / 2 + 0.2, h - 0.3, upper + 0.04, 0.13, timber);
    }
  }
  const door = rng.int(0, bays - 1);
  for (let i = 0; i < bays; i++) {
    const u = -w / 2 + bay * (i + 0.5);
    if (i === door) {
      t.box(u, 0, front + 0.02, 1.04, 2.2, 0.08, c('#6e4a2f'), undefined, 0);
      t.box(u, 2.2, front + 0.02, 1.24, 0.16, 0.12, timber, undefined, 0);
    } else window(t, u, 0.9, front, 0.9, 1.1, timber, d);
  }
  const deep = dd + jet + 0.8;
  if (gable) {
    const half = w / 2 + 0.35;
    const rise = half * 1.05;
    t.prism(`hgable:${r3(half)}:${r3(rise)}`, [[-half, 0], [half, 0], [0, rise]], deep, 0, h, jet / 2, roof, undefined, Math.PI / 2);
    if (d.detail > 0) t.prism(`hgend:${r3(half - 0.45)}:${r3(rise - 0.5)}`, [[-(half - 0.45), 0], [half - 0.45, 0], [0, rise - 0.5]], 0.06, 0, h, upper + 0.44, wall, undefined, Math.PI / 2);
    t.box(w / 4, h + rise * 0.3, -dd / 4, 0.64, rise * 0.9, 0.64, c('#8a4a3a'), undefined, 0);
  } else {
    const half = deep / 2;
    const rise = half * 0.95;
    t.prism(`hroof:${r3(half)}:${r3(rise)}`, [[-half, 0], [half, 0], [0, rise]], w + 0.5, 0, h, jet / 2, roof);
    t.box(-w / 2 + 0.9, h + rise * 0.4, -0.4, 0.64, rise * 0.9, 0.64, c('#8a4a3a'), undefined, 0);
  }
}

function window(t: Pen, u: number, y: number, face: number, w: number, h: number, timber: string, d: Drawer) {
  t.box(u, y, face + 0.01, w + 0.2, h + 0.2, 0.08, timber, undefined, 0);
  t.box(u, y + 0.1, face + 0.04, w, h, 0.08, GLASS, 'glass', 0);
  if (d.detail > 0) t.box(u, y + 0.1 + h / 2 - 0.04, face + 0.09, w, 0.08, 0.04, timber, undefined, 0);
}

/** Parish church: a nave with tall windows, a west tower with a belfry and a slate spire; the tower faces `facing`. */
export function church(d: Drawer, x: number, y: number, z: number, facing: Facing) {
  const t = new Pen(d, new Frame(x, y, z, TURNS[facing]));
  const c = (k: string) => hz(k, x, z);
  const stone = c('#cfc6b0');
  const nave = { w: 7.2, dd: 14.4, h: 6.4 };
  t.box(0, 0, -nave.dd / 2, nave.w, nave.h, nave.dd, stone, undefined, 0);
  const half = nave.w / 2 + 0.4;
  t.prism(`chroof:${r3(half)}`, [[-half, 0], [half, 0], [0, half * 1.1]], nave.dd + 0.4, 0, nave.h, -nave.dd / 2, c('#6f6a62'), undefined, Math.PI / 2);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) t.box(s * (nave.w / 2 + 0.02), 1.6, -2.4 - i * 3.2, 0.08, 3.2, 1.0, c(GLASS), 'glass', 0);
  const tw = 4.4;
  const th = 14.4;
  t.box(0, 0, tw / 2 - 0.4, tw, th, tw, shade(stone, -0.04), undefined, 0);
  t.box(0, th - 0.4, tw / 2 - 0.4, tw + 0.4, 0.4, tw + 0.4, shade(stone, 0.06), undefined, 0);
  for (const [sx, sz] of [[0, 1], [1, 0], [-1, 0]] as const) t.box(sx * (tw / 2 + 0.02), th - 3.6, tw / 2 - 0.4 + sz * (tw / 2 + 0.02), sz ? 1.2 : 0.08, 2.0, sx ? 1.2 : 0.08, c('#2a2a2e'), undefined, 0);
  t.box(0, 0, tw - 0.38, 1.6, 3.0, 0.08, c('#5e3f27'), undefined, 0);
  t.cone(0, th, tw / 2 - 0.4, tw * 0.72, 0.05, 8.0, c('#5f6670'), undefined, 4, Math.PI / 4);
  t.box(0, th + 7.6, tw / 2 - 0.4, 0.12, 1.4, 0.12, c('#c9a43a'), 'metal', 0);
}

/** Post-free tower mill: a stone base, a white tapering tower, a cap and four sails turned toward `facing`. */
export function windmill(d: Drawer, x: number, y: number, z: number, facing: Facing) {
  const t = new Pen(d, new Frame(x, y, z, TURNS[facing]));
  const c = (k: string) => hz(k, x, z);
  t.cyl(0, 0, 0, 3.4, 2.4, c('#a39a86'), undefined, 0, 12);
  t.cone(0, 2.4, 0, 3.0, 2.1, 8.0, c('#ece6d6'), undefined, 12);
  t.cone(0, 10.4, 0, 2.5, 0.3, 2.4, c('#7d5a46'), undefined, 8);
  t.box(0, 0, 3.02, 1.1, 2.1, 0.1, c('#6e4a2f'), undefined, 0);
  t.box(0, 6.4, 2.62, 0.7, 0.9, 0.1, c(GLASS), 'glass', 0);
  const hub = { y: 10.6, z: 2.9 };
  t.cylZ(0, hub.y, hub.z, 0.32, 0.8, c('#5e3f27'));
  const spar = c('#6e4a2f');
  const cloth = c('#efe6d6');
  t.box(0, hub.y - 7.2, hub.z + 0.3, 0.26, 14.4, 0.2, spar, undefined, 0);
  t.box(0, hub.y - 0.13, hub.z + 0.3, 14.4, 0.26, 0.2, spar, undefined, 0);
  for (const s of [-1, 1]) {
    t.box(0.85, hub.y + s * 4.2 - 2.6, hub.z + 0.42, 1.4, 5.2, 0.06, cloth, undefined, 0);
    t.box(s * 4.2, hub.y + 0.18, hub.z + 0.42, 5.2, 1.4, 0.06, cloth, undefined, 0);
  }
}

/** A tree: broadleaf (trunk and a few leafy lumps), willow (wide, pale, low), pine (stacked cones) or poplar (a tall spire). */
export function tree(t: Pen, x: number, y: number, z: number, s: number, kind: 'oak' | 'willow' | 'pine' | 'poplar', rng: Rng) {
  const c = (k: string) => hz(k, x, z);
  if (kind === 'poplar') {
    t.cyl(x, y, z, 0.3 * s, 3.4 * s, c('#6e4a2f'), undefined, 0, 6);
    t.ball(x, y + 7.4 * s, z, 1.6 * s, c(rng.pick(['#4f8a3a', '#5a9440', '#3f7f3a'])), [0.6, 2.6, 0.6], 0.15, rng.int(1, 9));
    return;
  }
  if (kind === 'pine') {
    t.cyl(x, y, z, 0.3 * s, 1.4 * s, c('#5e3f27'), undefined, 0, 5);
    const green = c(rng.pick(['#2f6a3a', '#1f5a32', '#356c2e']));
    for (const [r, h, yy] of [[2.2, 3.2, 1.2], [1.7, 2.8, 3.0], [1.1, 2.4, 4.6]] as const) t.cone(x, y + yy * s, z, r * s, 0.05, h * s, green, undefined, 6);
    return;
  }
  const willow = kind === 'willow';
  t.cyl(x, y, z, 0.32 * s, (willow ? 1.8 : 2.4) * s, c('#6e4a2f'), undefined, 0, 6);
  const greens = willow ? ['#9ab65a', '#8aaa4a', '#a8c06a'] : ['#3f7f3a', '#4f8a3a', '#5a9440', '#356c2e'];
  const lumps = t.d.detail === 0 ? 1 : 3;
  for (let i = 0; i < lumps; i++) {
    const a = rng.range(0, Math.PI * 2);
    const off = i === 0 ? 0 : 0.9 * s;
    const r = (i === 0 ? 2.1 : 1.5) * s * rng.range(0.85, 1.1);
    const sq: [number, number, number] = willow ? [1.25, 0.8, 1.25] : [1, 0.85, 1];
    t.ball(x + Math.cos(a) * off, y + (willow ? 2.6 : 3.4) * s + (i === 0 ? 0 : 0.5 * s), z + Math.sin(a) * off, r, c(rng.pick(greens)), sq, 0.18, rng.int(1, 9));
  }
}

/** Pavilion tent by the lists: striped round wall, coloured cone roof, a pennant on the pole. */
export function tent(t: Pen, x: number, y: number, z: number, color: string) {
  const c = (k: string) => hz(k, x, z);
  t.cyl(x, y, z, 1.9, 2.0, c('#efe6d6'), undefined, 0, 10);
  if (t.d.detail > 0) t.cyl(x, y + 1.6, z, 1.94, 0.4, c(color), undefined, 0, 10);
  t.cone(x, y + 2.0, z, 2.2, 0.06, 1.8, c(color), undefined, 10);
  t.box(x, y + 3.8, z, 0.06, 1.0, 0.06, c('#5e3f27'), undefined, 0);
  t.box(x + 0.35, y + 4.4, z, 0.7, 0.36, 0.03, c('#e8c547'), undefined, 0);
}

/** Round hay rick with a thatched cone top. */
export function rick(t: Pen, x: number, y: number, z: number) {
  const c = (k: string) => hz(k, x, z);
  t.cyl(x, y, z, 1.3, 1.6, c('#d9c27a'), undefined, 0, 8);
  t.cone(x, y + 1.6, z, 1.45, 0.1, 1.5, c('#c9b06a'), undefined, 8);
}

/** A grazing sheep: a woolly block with a dark head. */
export function sheep(t: Pen, x: number, y: number, z: number, yaw: number) {
  t.box(x, y + 0.3, z, 0.9, 0.55, 0.55, hz('#f2efe6', x, z), undefined, 0, yaw);
  t.box(x + Math.cos(yaw) * 0.5, y + 0.45, z - Math.sin(yaw) * 0.5, 0.3, 0.3, 0.28, '#2f2a26', undefined, 0, yaw);
  t.box(x, y, z, 0.6, 0.32, 0.3, '#2f2a26', undefined, 0, yaw);
}

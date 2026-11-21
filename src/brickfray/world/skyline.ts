import type { Finish } from '../engine/materials';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, mix, Rng, shade } from './util';

export interface SkylineOptions {
  inner: [number, number];
  outer: number;
  haze: string;
  colors: string[];
  seed: number;
  minH: number;
  maxH: number;
  skip?: ('n' | 's' | 'e' | 'w')[];
  /** Dusk: this share of the window bays glows warm instead of whole lit floors. */
  dusk?: number;
}

const GLASS = '#3f5f78';
const SHOP = '#2b3a45';
const LIT = '#f1d29a';
const LAMP = '#ffc978';
const ROOFS = ['#9b4a3a', '#5f6b78', '#7a5a46', '#4f6f5a'];
const AWNINGS = ['#c0392b', '#2f7fbf', '#2e8b57', '#d9b93a', '#8e5a9a', '#e67e22'];
const STOREY = 3.2;

interface Building {
  x: number;
  z: number;
  w: number;
  dd: number;
  h: number;
  color: string;
}

/**
 * Ring of distant buildings around a rectangle, skipping a side if asked: shopfronts with awnings, window grids on
 * the faces toward the map, cornices and varied roofs (gables, setbacks, tanks, plant rooms).
 */
export function skyline(d: Drawer, o: SkylineOptions) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(o.seed);
  const [ix, iz] = o.inner;
  for (let i = 0; i < (d.detail === 0 ? 70 : 120); i++) {
    const side = rng.int(0, 3);
    const name = (['n', 's', 'e', 'w'] as const)[side]!;
    if (o.skip?.includes(name)) continue;
    const along = rng.range(-o.outer, o.outer);
    const depth = rng.range(0, o.outer - (side < 2 ? iz : ix));
    const x = side < 2 ? along : (side === 2 ? 1 : -1) * (ix + depth);
    const z = side < 2 ? (side === 0 ? -1 : 1) * (iz + depth) : along;
    if (Math.abs(x) < ix && Math.abs(z) < iz) continue;
    const dist = Math.hypot(x, z);
    const h = rng.range(o.minH, o.maxH) * (0.7 + (dist / o.outer) * 0.5);
    const b = { x, z, w: rng.range(6, 14), dd: rng.range(6, 14), h, color: rng.pick(o.colors) };
    const fade = Math.min(0.6, Math.max(0.12, (dist - 40) / 190));
    building(t, rng, d.detail, b, (c, k = 1) => mix(c, o.haze, fade * k), o.dusk);
  }
}

function building(t: Pen, rng: Rng, detail: number, b: Building, haze: (c: string, k?: number) => string, dusk?: number) {
  const { x, z, w, dd, h } = b;
  const wall = haze(b.color);
  const trim = haze(shade(b.color, -0.25), 0.8);
  const gable = h < 16 && rng.chance(0.5);
  const top = Math.floor((h - 1.2) / STOREY) * STOREY;
  t.box(x, 0, z, w, h, dd, wall, undefined, 0);

  const primary: [number, number] = Math.abs(x) > Math.abs(z) ? [-Math.sign(x), 0] : [0, -Math.sign(z)];
  const secondary: [number, number] = primary[0] ? [0, -Math.sign(z)] : [-Math.sign(x), 0];
  const faces = detail === 0 || !(secondary[0] || secondary[1]) ? [primary] : [primary, secondary];
  const awning = haze(rng.pick(AWNINGS), 0.8);
  for (const [nx, nz] of faces) {
    const len = nz ? w : dd;
    const slab = (u: number, y: number, l: number, hh: number, out: number, color: string, finish?: Finish) => {
      if (nz) t.box(x + u, y, z + nz * (dd / 2 + out / 2), l, hh, out, color, finish, 0);
      else t.box(x + nx * (w / 2 + out / 2), y, z + u, out, hh, l, color, finish, 0);
    };
    slab(0, 0.3, len * 0.9, 2.3, 0.08, haze(SHOP, 0.8));
    slab(0, 2.6, len * 0.94, 0.45, 0.4, awning);
    const step = detail === 0 ? 2 : 1;
    const bays = Math.max(2, Math.round(len / (detail === 0 ? 4 : 2.6)));
    for (let y = 4.0, r = 0; y + 1.5 < top; y += STOREY, r++) {
      if (r % step) continue;
      slab(0, y, len * 0.84, 1.5, 0.05, !dusk && rng.chance(0.2) ? haze(LIT, 0.6) : haze(GLASS, 0.8));
      if (!dusk) continue;
      const bay = (len * 0.84) / bays;
      for (let k = 0; k < bays; k++) {
        if (rng.chance(dusk)) slab(-len * 0.42 + (k + 0.5) * bay, y + 0.15, bay * 0.62, 1.2, 0.07, haze(LAMP, 0.3), 'glow');
      }
    }
    for (let k = 1; k < bays; k++) slab(-len * 0.42 + (k * len * 0.84) / bays, 3.6, 0.4, Math.max(0.1, top - 3.6), 0.09, wall);
  }

  if (gable) {
    const span = Math.round(dd);
    const rise = span * 0.32;
    t.box(x, h - 0.3, z, w + 0.3, 0.3, dd + 0.3, trim, undefined, 0);
    t.prism(`sky-gable:${span}`, [[-span / 2 - 0.4, 0], [span / 2 + 0.4, 0], [0, rise]], w + 0.6, x, h, z, haze(rng.pick(ROOFS), 0.8));
    return;
  }
  t.box(x, h - 0.6, z, w + 0.5, 0.6, dd + 0.5, trim, undefined, 0);
  const roof = rng.next();
  if (roof < 0.3) {
    const sh = h * rng.range(0.12, 0.22);
    t.box(x, h, z, w * 0.66, sh, dd * 0.66, wall, undefined, 0);
    t.box(x, h + sh - 0.4, z, w * 0.66 + 0.3, 0.4, dd * 0.66 + 0.3, trim, undefined, 0);
  } else if (roof < 0.65) {
    t.box(x + w * rng.range(-0.2, 0.2), h, z + dd * rng.range(-0.2, 0.2), w * 0.36, rng.range(1.5, 3.5), dd * 0.36, haze('#b7bcc2'), undefined, 0);
  } else if (detail > 0) {
    const tx = x + w * rng.range(-0.25, 0.25);
    const tz = z + dd * rng.range(-0.25, 0.25);
    t.box(tx, h, tz, 1.6, 1.2, 1.6, haze('#545c63'), undefined, 0);
    t.cyl(tx, h + 1.2, tz, 1.1, 2.2, haze('#8a6a4a'), undefined, 0, 8);
    t.cone(tx, h + 3.4, tz, 1.15, 0.2, 0.7, haze('#5a4634'), undefined, 8);
  }
}

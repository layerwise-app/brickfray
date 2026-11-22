import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, shade } from './util';

const GOLD = '#e0b040';
const TIMBER = '#5a3424';

export interface RoofStyle {
  tile: string;
  ridge: string;
  /** Gable infill and eave boards. */
  end: string;
}

/** Glazed green tiles of the great hall, terracotta of the ranges and towers, grey of the village. */
export const ROOF_JADE: RoofStyle = { tile: '#3f7a5c', ridge: '#2f5f48', end: '#9c3326' };
export const ROOF_CLAY: RoofStyle = { tile: '#b5562e', ridge: '#8a3f22', end: '#7a4a2a' };

/**
 * A tiled roof over the box x0..x1, z0..z1 from height y: courses of tiles stepping down each slope with tile rolls
 * over them, a ridge with upturned ends and a gable at each end. `lean` gives a single slope falling toward `low`
 * (+1: toward x1 / z1). The ridge runs along the longer side. Everything is out of reach, so nothing collides.
 */
export function tiledRoof(d: Drawer, x0: number, z0: number, x1: number, z1: number, y: number, s: RoofStyle, lean = 0) {
  const alongX = x1 - x0 >= z1 - z0;
  const span = alongX ? z1 - z0 : x1 - x0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const t = new Pen(d, new Frame((x0 + x1) / 2, y, (z0 + z1) / 2, alongX ? 0 : 1));
  const flip = alongX ? 1 : -1;
  const rise = lean ? Math.min(2.0, span * 0.28) : Math.min(4.0, span * 0.3);
  const w = span / 2;
  t.box(0, -0.24, 0, len, 0.24, span, TIMBER, undefined, 0);
  // Courses: [eave z, ridge z] across the span and the rise each covers, per slope.
  const slopes: [number, number, number, number][] = lean
    ? [[lean * flip * w, -lean * flip * w, 0, rise]]
    : [[-w, 0, 0, rise], [w, 0, 0, rise]];
  const K = d.detail === 0 ? 3 : Math.max(4, Math.round(span / (lean ? 1.0 : 1.4)));
  for (const [ze, zr, ye, yr] of slopes) {
    const over = Math.sign(ze) * 0.4;
    for (let i = 0; i < K; i++) {
      const u0 = i / K;
      const u1 = (i + 1) / K;
      const za = ze + over * (1 - u0) + (zr - ze) * u0;
      const zb = ze + over * (1 - u1) + (zr - ze) * u1 + Math.sign(zr - ze) * 0.08;
      const ya = ye + (yr - ye) * u0 * u0 * 0.35 + (yr - ye) * u0 * 0.65 + (i === 0 ? 0.12 : 0);
      const yb = ye + (yr - ye) * u1 * u1 * 0.35 + (yr - ye) * u1 * 0.65;
      const c = i % 2 ? s.tile : shade(s.tile, -0.06);
      t.prism(`course:${za.toFixed(2)}:${zb.toFixed(2)}:${ya.toFixed(2)}:${yb.toFixed(2)}`, [[za, ya - 0.14], [zb, yb - 0.14], [zb, yb + 0.06], [za, ya + 0.06]].map(([a, b]) => [a!, b!] as [number, number]).sort((p, q) => Math.atan2(p[1] - (ya + yb) / 2, p[0] - (za + zb) / 2) - Math.atan2(q[1] - (ya + yb) / 2, q[0] - (za + zb) / 2)), len + 0.5, 0, 0, 0, c);
    }
    if (d.detail > 0) {
      const ra: [number, number] = [ze + over, ye + 0.16];
      const rb: [number, number] = [zr, yr + 0.08];
      const n = Math.floor(len / 0.56);
      const prof: [number, number][] = [[ra[0], ra[1] - 0.06], [rb[0], rb[1] - 0.06], [rb[0], rb[1] + 0.06], [ra[0], ra[1] + 0.06]];
      prof.sort((p, q) => Math.atan2(p[1] - (ra[1] + rb[1]) / 2, p[0] - (ra[0] + rb[0]) / 2) - Math.atan2(q[1] - (ra[1] + rb[1]) / 2, q[0] - (ra[0] + rb[0]) / 2));
      for (let i = 0; i <= n; i++) t.prism(`roll:${ra.join()}:${rb.join()}`, prof, 0.12, -len / 2 + 0.05 + (i * (len - 0.1)) / n, 0, 0, shade(s.tile, 0.1));
    }
  }
  if (lean) {
    t.box(0, rise - 0.06, -lean * flip * w, len + 0.5, 0.24, 0.3, s.ridge, undefined, 0.02);
    return;
  }
  t.box(0, rise, 0, len + 0.7, 0.36, 0.4, s.ridge, undefined, 0.03);
  for (const e of [-1, 1]) {
    t.prism(`gable:${w.toFixed(2)}:${rise.toFixed(2)}`, [[-w, 0], [w, 0], [0, rise]], 0.24, e * (len / 2 - 0.2), 0, 0, s.end);
    if (d.detail > 0) t.prism(`gtrim:${w.toFixed(2)}:${rise.toFixed(2)}`, [[-w * 0.5, rise * 0.25], [w * 0.5, rise * 0.25], [0, rise * 0.85]], 0.06, e * (len / 2 - 0.05), 0, 0, GOLD, 'metal');
  }
  d.lasting(() => {
    for (const e of [-1, 1]) {
      t.cone(e * (len / 2 + 0.3), rise + 0.2, 0, 0.22, 0.04, 0.8, s.ridge, undefined, 6);
      t.ball(e * (len / 2 + 0.3), rise + 1.0, 0, 0.14, GOLD, undefined, 0, 1, 'metal');
      for (const k of [-1, 1]) t.cone(e * (len / 2 + 0.2), 0.1, k * (w + 0.3), 0.14, 0.03, 0.5, s.tile, undefined, 6);
    }
  });
}

/** Hip roof of a pavilion or tower: a tiled pyramid (one tier on low detail) with upturned corners and a gold finial. */
export function pavilionRoof(d: Drawer, x: number, y: number, z: number, w: number, dd: number, s: RoofStyle, tiers = 2) {
  const t = new Pen(d, new Frame(x, y, z));
  const r = Math.hypot(w, dd) / 2 + 0.5;
  let h = y;
  const n = d.detail === 0 ? 1 : tiers;
  for (let k = 0; k < n; k++) {
    const rk = r * (1 - k * 0.3);
    t.box(0, h - y - 0.2, 0, (w + 0.8) * (1 - k * 0.3), 0.2, (dd + 0.8) * (1 - k * 0.3), TIMBER, undefined, 0);
    t.cone(0, h - y, 0, rk, rk * 0.35, rk * 0.45, s.tile, undefined, 4, Math.PI / 4);
    if (d.detail > 0) for (const a of [0, 1, 2, 3]) t.cone(Math.cos(a * Math.PI / 2 + Math.PI / 4) * rk * 0.72, h - y + 0.02, Math.sin(a * Math.PI / 2 + Math.PI / 4) * rk * 0.72, 0.12, 0.02, 0.5, s.ridge, undefined, 5);
    h += rk * 0.45 + (k + 1 < n ? 0.5 : 0);
    if (k + 1 < n) t.box(0, h - y - 0.5, 0, rk * 0.6, 0.5, rk * 0.6, s.end, undefined, 0.02);
  }
  t.cone(0, h - y, 0, r * 0.35 * (1 - (n - 1) * 0.3), 0.06, 0.5, s.ridge, undefined, 6);
  t.cone(0, h - y + 0.4, 0, 0.16, 0.02, 0.9, GOLD, 'metal', 6);
}

/** Lacquered clerestory band under a raised roof: red panels between gold-capped posts, lattice where detail allows. */
export function clerestory(d: Drawer, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  slab(d, [x0, y0, z0], [x1, y1, z1], '#9c3326');
  if (d.detail === 0) return;
  const alongX = x1 - x0 > z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const n = Math.floor(len / 1.6);
  for (let i = 0; i < n; i++) {
    const a = (alongX ? x0 : z0) + (i + 0.5) * (len / n);
    const [lo, hi] = [y0 + 0.4, y1 - 0.4];
    if (alongX) for (const zz of [z0 - 0.02, z1]) slab(d, [a - 0.5, lo, zz], [a + 0.5, hi, zz + 0.02], '#2f5f48');
    else for (const xx of [x0 - 0.02, x1]) slab(d, [xx, lo, a - 0.5], [xx + 0.02, hi, a + 0.5], '#2f5f48');
  }
  slab(d, [x0 - 0.04, y1 - 0.2, z0 - 0.04], [x1 + 0.04, y1, z1 + 0.04], GOLD, 'metal');
}

import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { STUPA, T, type Piece } from './temple-layout';
import { Frame, shade } from './util';

const TEAL = '#2f8a7a';
const TEAL_DARK = '#226b5f';
const GOLD = '#e0b040';
const RED = '#b8402c';
const JADE = '#93a996';
const SAND = '#d8c9a3';

/**
 * Glazed teal roof over a flat roof slab: eave course with a gold rim, a gable along the long side, ridge cap and
 * upturned corner horns. Everything above the slab is out of reach, so it has no collider.
 */
export function tieredRoof(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  slab(d, [x0, y0, z0], [x1, y1, z1], TEAL_DARK);
  slab(d, [x0 - 0.06, y0 + 0.04, z0 - 0.06], [x1 + 0.06, y0 + 0.16, z1 + 0.06], GOLD, 'metal');
  const alongX = x1 - x0 >= z1 - z0;
  const span = alongX ? z1 - z0 : x1 - x0;
  const len = alongX ? x1 - x0 : z1 - z0;
  const rise = Math.min(1.6, span * 0.36);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const t = new Pen(d, new Frame(cx, y1, cz, alongX ? 0 : 1));
  const inset = 0.24;
  const w = span - 2 * inset;
  const L = len - 2 * inset;
  const key = `${w.toFixed(2)}:${rise.toFixed(2)}`;
  t.prism(`gable:${key}`, [[-w / 2, 0], [w / 2, 0], [0, rise]], L, 0, 0, 0, TEAL);
  if (d.detail > 0) {
    // Tile ribs down both slopes.
    const n = Math.max(2, Math.floor(L / 1.2));
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + 0.05 + (i * (L - 0.1)) / n;
      t.prism(`rib:${key}`, [[-w / 2 - 0.04, 0], [w / 2 + 0.04, 0], [0, rise + 0.06]], 0.1, x, 0.02, 0, shade(TEAL, 0.12));
    }
  }
  t.box(0, rise - 0.04, 0, L + 0.1, 0.2, 0.26, GOLD, 'metal', 0.03);
  d.lasting(() => {
    for (const s of [-1, 1]) {
      t.cone(s * (L / 2 + 0.02), rise + 0.16, 0, 0.16, 0.02, 0.62, GOLD, 'metal', 8);
      for (const k of [-1, 1]) t.box(s * (len / 2 - 0.1), 0, k * (span / 2 - 0.1), 0.26, 0.4, 0.26, TEAL, undefined, 0.04);
    }
  });
  if (d.detail > 0) for (const s of [-1, 1]) for (const k of [-1, 1]) t.ball(s * (len / 2 - 0.1), 0.48, k * (span / 2 - 0.1), 0.1, GOLD, undefined, 0, 1, 'metal');
}

/** Stepped stupa on the shrine roof: jade terraces, a gold bell dome, harmika and ringed spire. Drawn once. */
export function stupa(d: Drawer, q: Piece) {
  if (q.min[2] >= 0 || q.min[1] !== T.high) return;
  const t = new Pen(d, new Frame(0, T.high, 0));
  STUPA.slice(0, 3).forEach(([r, y0, y1], i) => {
    t.box(0, y0, 0, 2 * r, y1 - y0, 2 * r, i % 2 ? shade(JADE, 0.06) : JADE, undefined, 0.04);
    t.box(0, y1 - 0.16, 0, 2 * r + 0.08, 0.16, 2 * r + 0.08, SAND, undefined, 0.02);
  });
  let h = STUPA[3]![1];
  t.cyl(0, h, 0, 0.95, 0.2, GOLD, 'metal', 0.04);
  t.ball(0, h + 0.2, 0, 0.88, GOLD, [1, 1.08, 1], 0, 1, 'metal');
  h = STUPA[4]![1];
  t.box(0, h, 0, 0.9, 0.5, 0.9, RED, undefined, 0.03);
  t.box(0, h + 0.5, 0, 1.0, 0.12, 1.0, GOLD, 'metal', 0.02);
  h += 0.62;
  d.lasting(() => {
    const rings = d.detail === 0 ? 4 : 7;
    for (let i = 0; i < rings; i++) t.cyl(0, h + i * 0.3, 0, 0.42 - i * 0.045, 0.22, GOLD, 'metal', 0.03);
    t.cone(0, h + rings * 0.3, 0, 0.12, 0.02, 1.0, GOLD, 'metal', 8);
    t.ball(0, h + rings * 0.3 + 1.0, 0, 0.14, GOLD, undefined, 0, 1, 'metal');
  });
  if (d.detail > 0) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      t.cone(sx * 1.0, STUPA[2]![2], sz * 1.0, 0.14, 0.02, 0.5, GOLD, 'metal', 8);
      t.ball(sx * 1.48, STUPA[0]![2] + 0.08, sz * 1.48, 0.12, GOLD, undefined, 0, 1, 'metal');
    }
  }
}

/** Open belfry on the bell house roof: red posts, a hanging gong and a small teal roof. */
export function belfry(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const w = x1 - x0;
  const dd = z1 - z0;
  const t = new Pen(d, new Frame((x0 + x1) / 2, y0, (z0 + z1) / 2));
  const h = y1 - y0;
  t.box(0, 0, 0, w, 0.32, dd, SAND, undefined, 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.24), 0.32, sz * (dd / 2 - 0.24), 0.32, h - 1.0, 0.32, RED, undefined, 0.03);
  t.box(0, h - 0.68, 0, w, 0.2, dd, GOLD, 'metal', 0.02);
  t.box(0, h - 0.48, 0, w + 0.6, 0.24, dd + 0.6, TEAL_DARK, undefined, 0.03);
  t.box(0, h - 0.24, 0, w - 0.2, 0.4, dd - 0.2, TEAL, undefined, 0.03);
  t.box(0, h + 0.16, 0, w - 1.2, 0.32, dd - 1.2, TEAL, undefined, 0.03);
  d.lasting(() => {
    t.cone(0, h + 0.48, 0, 0.2, 0.02, 0.9, GOLD, 'metal', 8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.ball(sx * (w / 2 + 0.24), h - 0.2, sz * (dd / 2 + 0.24), 0.12, GOLD, undefined, 0, 1, 'metal');
  });
  t.beam(-w / 2 + 0.3, h - 1.1, 0, w / 2 - 0.3, h - 1.1, 0, 0.14, '#6e4a2f');
  t.cylZ(0, h - 2.0, 0, 0.62, 0.12, GOLD, 'metal', 0.03, d.detail === 0 ? 10 : 16);
  if (d.detail > 0) t.cylZ(0, h - 2.0, 0, 0.22, 0.16, shade(GOLD, -0.18), 'metal', 0.02);
  for (const s of [-1, 1]) t.beam(s * 0.4, h - 1.1, 0, s * 0.3, h - 1.5, 0, 0.04, '#3a4148');
}

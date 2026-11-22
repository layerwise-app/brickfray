import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { T, type Piece } from './temple-layout';
import { ROOF_JADE } from './temple-ornament';
import { Frame, shade } from './util';

/**
 * Spirit screens, each painted for where it stands, so the halves of the map read differently: vermilion with a gilded
 * sun roundel in the east court and jade tile with a white crane roundel in the west; whitewashed shrine walls in the
 * village strip and mossy carved stone along the gorge; the camp gates in their team's colour (orange sun under the
 * cliff, blue moon on the river terrace); carved timber lattice inside the nave doors.
 */
interface Look {
  body: string;
  frame: string;
  roundel: [string, string];
  cap: string;
  base: string;
}

const GOLD = '#e0b040';
const LOOKS: Record<string, Look> = {
  east: { body: '#b8402c', frame: GOLD, roundel: [GOLD, '#c8231b'], cap: ROOF_JADE.tile, base: '#c9b48a' },
  west: { body: '#3f8a6a', frame: '#f2ead6', roundel: ['#f2ead6', '#2f5f9a'], cap: '#2f5f7a', base: '#b8b49a' },
  north: { body: '#d0622c', frame: GOLD, roundel: [GOLD, '#f6c624'], cap: '#8a3f22', base: '#c9b48a' },
  south: { body: '#2f5f9a', frame: '#dfe6ea', roundel: ['#dfe6ea', '#9fc8e0'], cap: '#2f4f6a', base: '#b8b8a8' },
  village: { body: '#efe8d8', frame: '#7a4a2a', roundel: ['#c8231b', GOLD], cap: '#b5562e', base: '#5f7d9a' },
  gorge: { body: '#8c9082', frame: '#6f7469', roundel: ['#9a9d8e', '#7f8577'], cap: '#4f8a3a', base: '#73806a' }
};

function lookOf(q: Piece): string {
  const cx = (q.min[0] + q.max[0]) / 2;
  const cz = (q.min[2] + q.max[2]) / 2;
  if (Math.abs(cx) < 4.1 && Math.abs(cz) > T.hallZ - 2 && Math.abs(cz) < T.hallZ) return 'nave';
  if (Math.abs(cz) > T.gate - 0.5) return cz < 0 ? 'north' : 'south';
  if (Math.abs(cx) > T.courtOut) return cx > 0 ? 'village' : 'gorge';
  return cx > 0 ? 'east' : 'west';
}

export function screen(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const along = x1 - x0 >= z1 - z0;
  const L = along ? x1 - x0 : z1 - z0;
  const D = along ? z1 - z0 : x1 - x0;
  const H = y1 - y0;
  const t = new Pen(d, new Frame((x0 + x1) / 2, y0, (z0 + z1) / 2, along ? 0 : 1));
  const kind = lookOf(q);
  if (kind === 'nave') return lattice(t, d, L, D, H);
  const k = LOOKS[kind]!;
  t.box(0, 0, 0, L + 0.1, 0.6, D + 0.1, k.base, undefined, 0.03);
  t.box(0, 0.6, 0, L, H - 0.9, D, k.body, undefined, 0.02);
  t.box(0, H - 0.3, 0, L + 0.24, 0.18, D + 0.24, shade(k.cap, -0.12), undefined, 0.02);
  t.box(0, H - 0.12, 0, L + 0.1, 0.12, D + 0.1, k.cap, undefined, 0.02);
  if (d.detail === 0) return;
  if (kind === 'gorge') return carved(t, L, D, H, k);
  for (const s of [-1, 1]) {
    const f = s * (D / 2);
    const fz = (w: number) => f + s * w;
    // A raised frame round the painted field, then the roundel and a cloud scroll either side of it.
    for (const y of [0.78, H - 0.52]) t.box(0, y, fz(0.02), L - 0.3, 0.08, 0.04, k.frame, kind === 'village' ? undefined : 'metal', 0);
    for (const x of [-(L / 2 - 0.19), L / 2 - 0.19]) t.box(x, 0.78, fz(0.02), 0.08, H - 1.22, 0.04, k.frame, kind === 'village' ? undefined : 'metal', 0);
    const r = Math.min(0.62, (H - 1.6) / 2, L / 5);
    const cy = 0.6 + (H - 0.9) / 2;
    if (kind === 'village') {
      // A shrine niche with a seated figure, an offering and a lamp.
      t.box(0, cy - r, fz(0.01), r * 1.5, r * 2.2, 0.02, '#3a2a22', undefined, 0);
      t.box(0, cy - r + 0.06, fz(0.05), r * 0.7, r * 0.5, 0.08, '#c8a040', 'metal', 0);
      t.ball(0, cy - r * 0.15, fz(0.06), r * 0.28, '#d8b050', [1, 1.2, 0.6], 0, 1, 'metal');
      t.box(0, cy - r - 0.08, fz(0.1), r * 1.6, 0.06, 0.16, '#7a4a2a', undefined, 0);
      for (const x of [-r * 0.6, r * 0.6]) t.cyl(x, cy - r - 0.02, fz(0.12), 0.05, 0.12, '#c8231b', undefined, 0, 6);
      t.box(0, 0.62, fz(0.01), L - 0.3, 0.24, 0.02, '#2f5f9a', undefined, 0);
      continue;
    }
    t.cylZ(0, cy, fz(0.03), r, 0.06, k.roundel[0], kind === 'west' || kind === 'south' ? undefined : 'metal', 0, 14);
    t.cylZ(0, cy, fz(0.07), r * 0.62, 0.04, k.roundel[1], undefined, 0, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      t.box(Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 1.18 - 0.07, fz(0.04), 0.14, 0.14, 0.04, k.roundel[0], undefined, 0);
    }
    if (kind === 'south') for (const y of [0.95, 1.15]) t.box(0, y, fz(0.03), L - 0.6, 0.06, 0.02, '#9fc8e0', undefined, 0);
    if (L > 3.2) {
      for (const sx of [-1, 1]) {
        const cx = sx * (L / 2 - Math.max(0.7, L * 0.2));
        t.cylZ(cx, cy + 0.2, fz(0.03), 0.2, 0.04, k.frame, undefined, 0, 8);
        t.cylZ(cx + sx * 0.32, cy - 0.06, fz(0.03), 0.14, 0.04, k.frame, undefined, 0, 8);
        t.box(cx + sx * 0.1, cy - 0.3, fz(0.03), 0.7, 0.05, 0.03, k.frame, undefined, 0);
      }
    }
  }
  for (const sx of [-1, 1]) t.cone(sx * (L / 2 + 0.06), H - 0.02, 0, 0.1, 0.02, 0.28, k.cap, undefined, 5);
}

/** Carved, weathered stone along the gorge: raised square panels, a moss crown and hanging vines. */
function carved(t: Pen, L: number, D: number, H: number, k: Look) {
  const n = Math.max(1, Math.floor(L / 1.6));
  for (const s of [-1, 1]) {
    const f = s * (D / 2 + 0.03);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * (L / n);
      t.box(x, 0.9, f, L / n - 0.35, H - 1.5, 0.06, shade(k.body, 0.08), undefined, 0.02);
      t.box(x, 0.9 + (H - 1.5) / 2 - 0.2, f + s * 0.03, 0.4, 0.4, 0.04, shade(k.body, -0.1), undefined, 0);
    }
  }
  t.box(0, H - 0.02, 0, L * 0.7, 0.08, D * 0.8, k.cap, undefined, 0.02);
  for (let i = 0; i < 3; i++) t.box(-L / 2 + 0.5 + i * (L / 3), H - 1.3, D / 2 + 0.04, 0.12, 1.2, 0.03, '#2f6f36', undefined, 0);
}

/** Carved timber lattice screen inside a nave door: a lacquered frame, an open-work grid and a gilt crest. */
function lattice(t: Pen, d: Drawer, L: number, D: number, H: number) {
  const TIMBER = '#5a3424';
  t.box(0, 0, 0, L + 0.1, 0.6, D + 0.1, '#c9b48a', undefined, 0.03);
  t.box(0, 0.6, 0, L, H - 0.9, D, TIMBER, undefined, 0.02);
  t.box(0, H - 0.3, 0, L + 0.24, 0.3, D + 0.24, ROOF_JADE.tile, undefined, 0.02);
  if (d.detail === 0) return;
  for (const s of [-1, 1]) {
    const f = s * (D / 2 + 0.02);
    const cols = Math.floor(L / 0.5);
    for (let i = 1; i < cols; i++) t.box(-L / 2 + i * (L / cols), 0.9, f, 0.06, H - 1.6, 0.04, '#c99446', undefined, 0);
    const rows = Math.floor((H - 1.6) / 0.5);
    for (let j = 0; j <= rows; j++) t.box(0, 0.9 + j * ((H - 1.6) / rows), f, L - 0.3, 0.06, 0.04, '#c99446', undefined, 0);
    t.cylZ(0, H - 1.0, f + s * 0.03, 0.42, 0.05, GOLD, 'metal', 0, 14);
    t.box(0, 0.62, f, L - 0.2, 0.2, 0.04, '#a83a2c', undefined, 0);
  }
}

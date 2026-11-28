import type { Piece } from './fortress-plan';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, shade, type Vec3 } from './util';

/** Cover the town would have lying about: what each prop is, how tall it stands. */
export type PropTag =
  | 'wagon'
  | 'cart'
  | 'ram'
  | 'bales'
  | 'trough'
  | 'woodpile'
  | 'masonry'
  | 'block'
  | 'boat'
  | 'barrels'
  | 'sacks'
  | 'millstones'
  | 'timber'
  | 'stall'
  | 'well'
  | 'stones'
  | 'cross'
  | 'anvil';

const OAK = '#7a5434';
const DARK = '#5e3f27';
const IRON = '#3a3f45';
const STRAW = '#e3c25a';
const STONE = ['#a8a294', '#9c9588', '#b4ae9f', '#8f897c'];
const CLOTH = ['#b8402c', '#e8d9b0', '#3f6f9a', '#d0a040'];

/** The piece's footprint turned so `l` runs along its longer side: boxes centred `off` along it with half-extents. */
function frame(q: Piece) {
  const [cx, cz] = [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2];
  const [w, dd] = [q.max[0] - q.min[0], q.max[2] - q.min[2]];
  const along = w >= dd;
  const y0 = q.min[1];
  const h = q.max[1] - y0;
  const part = (off: number, hl: number, hd: number, a: number, b: number): [Vec3, Vec3] => {
    const [x, z, hx, hz] = along ? [cx + off, cz, hl, hd] : [cx, cz + off, hd, hl];
    return [[x - hx, y0 + a, z - hz], [x + hx, y0 + b, z + hz]];
  };
  return { part, L: Math.max(w, dd), D: Math.min(w, dd), h, cx, cz, along, y0 };
}

/** Collider boxes that follow what drawProp draws: open under a cart's bed and a stall's awning, round things inset. */
export function propSolid(q: Piece): [Vec3, Vec3][] {
  const { part, L, D, h } = frame(q);
  const full = part(0, L / 2, D / 2, 0, h);
  switch (q.tag as PropTag) {
    case 'wagon':
    case 'cart':
    case 'ram':
      return [part(0, L / 2, D / 2, 0.42, h), part(-L / 2 + 0.6, 0.3, D / 2, 0, 0.42), part(L / 2 - 0.6, 0.3, D / 2, 0, 0.42)];
    case 'stall':
      return [part(0, L / 2, D / 2, 0, 1.3), part(0, L / 2, D / 2, h - 0.36, h), ...[-1, 1].flatMap((s) => [part(s * (L / 2 - 0.12), 0.08, 0.08, 1.3, h - 0.36)])];
    case 'well':
      return [part(0, L / 2 - 0.15, D / 2, 0, 0.9), part(-L / 2 + 0.3, 0.08, 0.08, 0.9, h - 0.6), part(L / 2 - 0.3, 0.08, 0.08, 0.9, h - 0.6), part(0, L / 2, D / 2, h - 0.6, h)];
    case 'boat':
      return [part(-L / 2 + 0.6, 0.15, D / 2 - 0.1, 0, 0.9), part(L / 2 - 0.6, 0.15, D / 2 - 0.1, 0, 0.9), part(0, L / 2, D / 2, 0.9, h)];
    case 'cross':
      return [part(0, L / 2, D / 2, 0, 0.5), part(0, 0.3, 0.3, 0.5, h)];
    case 'anvil':
      return [part(0, L / 2, D / 2, 0, 0.6), part(0, L * 0.35, D * 0.25, 0.6, h)];
    case 'block':
    case 'stones':
      return [part(0, L / 2 - 0.06, D / 2 - 0.03, 0, h)];
    default:
      return [full];
  }
}

/** Draws a prop piece (kind 'prop') by its tag. */
export function drawProp(d: Drawer, q: Piece) {
  const { L, D, h, cx, cz, along, y0 } = frame(q);
  const t = new Pen(d, new Frame(cx, y0, cz, along ? 0 : 1));
  const rng = new Rng(Math.round(cx * 31 + cz * 17));
  const wheels = (r: number) => {
    for (const x of [-L / 2 + 0.6, L / 2 - 0.6]) {
      for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) {
        t.cylZ(x, r, z, r, 0.14, DARK, undefined, 0.02);
        if (d.detail > 0) t.ringUp(x, r, z, r - 0.02, 0.035, IRON, 'metal');
      }
    }
  };
  switch (q.tag as PropTag) {
    case 'wagon': {
      wheels(0.42);
      t.box(0, 0.42, 0, L, 0.14, D - 0.2, OAK, undefined, 0.02);
      for (const z of [-1, 1]) t.box(0, 0.56, z * (D / 2 - 0.16), L, 0.5, 0.08, DARK, undefined, 0.01);
      t.box(0, 0.56, 0, L - 0.3, h - 0.9, D - 0.36, STRAW, undefined, 0.08);
      t.ball(0, h - 0.4, 0, 0.7, '#ecd06a', [L * 0.7, 0.5, (D - 0.3) * 0.8], 0.2, 3);
      return;
    }
    case 'cart': {
      wheels(0.42);
      t.box(0, 0.42, 0, L, 0.14, D - 0.2, OAK, undefined, 0.02);
      for (let x = -L / 2 + 0.45; x < L / 2 - 0.3; x += 0.75) for (const z of [-0.36, 0.36]) t.cyl(x, 0.56, z * (D / 1.6), 0.34, h - 0.56, '#9a6a3f', undefined, 0.03);
      return;
    }
    case 'ram': {
      wheels(0.42);
      t.box(0, 0.42, 0, L, 0.16, D - 0.2, DARK, undefined, 0.02);
      t.cylX(0.2, 0.95, 0, 0.34, L - 0.2, '#6e4a2f');
      t.cone(L / 2 - 0.05, 0.95, 0, 0.36, 0.2, 0.3, IRON, 'metal', 8);
      for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) for (const z of [-1, 1]) t.box(x, 0.58, z * (D / 2 - 0.2), 0.14, h - 0.78, 0.14, OAK, undefined, 0.01);
      t.prism(`ram-roof:${D}`, [[-D / 2, 0], [D / 2, 0], [0, 0.42]], L, 0, h - 0.42, 0, '#8a5f3a');
      return;
    }
    case 'bales': {
      const n = Math.max(1, Math.round(L / 1.2));
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (i + 0.5) * (L / n);
        t.box(x, 0, 0, L / n - 0.04, Math.min(h, 0.64), D, STRAW, undefined, 0.05);
        if (h > 0.9 && i % 2 === 0) t.box(x, 0.64, 0, L / n - 0.08, h - 0.64, D - 0.1, '#d6b24a', undefined, 0.05);
        else if (h > 0.9) t.box(x, 0.64, 0, L / n - 0.08, h - 0.64, D - 0.1, '#ecd06a', undefined, 0.05);
      }
      return;
    }
    case 'trough': {
      t.box(0, 0, 0, L, h, D, '#9c9588', undefined, 0.04);
      t.box(0, h - 0.01, 0, L - 0.24, 0.02, D - 0.24, '#3f6f7a', 'glass', 0);
      return;
    }
    case 'woodpile': {
      t.box(0, 0, 0, L, 0.12, D, DARK, undefined, 0.01);
      const r = 0.16;
      for (let y = 0.12 + r; y < h - 0.05; y += r * 1.8) {
        for (let z = -D / 2 + r; z <= D / 2 - r + 0.01; z += r * 2) t.cylX(rng.range(-0.05, 0.05), y, z, r, L - 0.05, rng.pick(['#9a6a3f', '#8a5f3a', '#a67c52']));
      }
      return;
    }
    case 'masonry': {
      const c = () => shade(rng.pick(STONE), rng.range(-0.05, 0.03));
      t.box(0, 0, 0, L, h * 0.55, D, c(), undefined, 0.06);
      t.box(0, h * 0.55, 0, L - 0.08, h * 0.45, D - 0.08, c(), undefined, 0.06);
      if (d.detail > 0) t.box(L * 0.32, h * 0.55, D * 0.2, L * 0.2, 0.3, D * 0.3, c(), undefined, 0.04);
      return;
    }
    case 'block':
    case 'stones': {
      const rows = Math.max(1, Math.round(h / 0.64));
      for (let k = 0; k < rows; k++) {
        const off = k % 2 ? 0.06 : -0.06;
        t.box(off, (k * h) / rows, 0, L - 0.1, h / rows - 0.02, D - 0.06, shade(rng.pick(STONE), 0.06), undefined, 0.04);
      }
      if (q.tag === 'stones' && d.detail > 0) t.box(0, h, 0, L * 0.8, 0.06, 0.3, OAK, undefined, 0.01);
      return;
    }
    case 'boat': {
      for (const x of [-L / 2 + 0.6, L / 2 - 0.6]) {
        t.box(x, 0, 0, 0.2, 0.9, D - 0.3, DARK, undefined, 0.01);
        t.box(x, 0.8, 0, 0.3, 0.1, D - 0.2, OAK, undefined, 0.01);
      }
      t.prism(`hull:${D}:${h}`, [[-D / 2, 0], [D / 2, 0], [D / 2 - 0.2, h - 1.2], [0, h - 0.9], [-D / 2 + 0.2, h - 1.2]], L, 0, 0.9, 0, '#4f7a9a');
      if (d.detail > 0) t.box(0, 0.9, 0, L + 0.04, 0.12, D + 0.04, '#e8d9b0', undefined, 0.01);
      return;
    }
    case 'barrels': {
      const n = Math.max(1, Math.round(L / 0.8));
      const m = Math.max(1, Math.round(D / 0.8));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          const x = -L / 2 + (i + 0.5) * (L / n);
          const z = -D / 2 + (j + 0.5) * (D / m);
          t.cyl(x, 0, z, Math.min(L / n, D / m) / 2 - 0.04, h, '#9a6a3f', undefined, 0.03);
          if (d.detail > 0) for (const y of [0.2, h - 0.25]) t.cyl(x, y, z, Math.min(L / n, D / m) / 2 - 0.02, 0.06, IRON, 'metal');
        }
      }
      return;
    }
    case 'sacks': {
      const n = Math.max(1, Math.round(L / 0.7));
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (i + 0.5) * (L / n);
        t.box(x, 0, 0, L / n - 0.06, h * 0.55, D - 0.1, '#d8c8a0', undefined, 0.1);
        t.ball(x, h * 0.55, 0, 0.3, '#e0d2ae', [L / n / 0.7, (h * 0.45) / 0.3, D / 0.7], 0.1, i + 2);
      }
      return;
    }
    case 'millstones': {
      const r = Math.min(L, D) / 2 - 0.08;
      const n = Math.max(1, Math.round(h / 0.32));
      for (let k = 0; k < n; k++) t.cyl(0, (k * h) / n, 0, r - (k % 2) * 0.04, h / n - 0.02, shade('#a8a294', k % 2 ? -0.06 : 0.02), undefined, 0.04);
      t.cyl(0, h - 0.01, 0, 0.16, 0.02, '#2a2a2a');
      return;
    }
    case 'timber': {
      const n = Math.max(1, Math.round(h / 0.3));
      for (let k = 0; k < n; k++) for (let z = -D / 2 + 0.18; z <= D / 2 - 0.17; z += 0.36) t.box(k % 2 ? 0.1 : -0.1, (k * h) / n, z, L - 0.2, h / n - 0.02, 0.32, rng.pick(['#8a5f3a', '#7a5434', '#9a6a3f']), undefined, 0.01);
      return;
    }
    case 'stall': {
      t.box(0, 0, 0, L, 1.0, D, OAK, undefined, 0.02);
      for (let x = -L / 2 + 0.4; x < L / 2 - 0.3; x += 0.6) t.box(x, 1.0, rng.range(-0.2, 0.2), 0.4, 0.3, 0.4, rng.pick(['#c96a2a', '#e8c050', '#7aa040', '#b8402c']), undefined, 0.05);
      for (const s of [-1, 1]) t.box(s * (L / 2 - 0.12), 1.0, 0, 0.16, h - 1.36, 0.16, DARK, undefined, 0.01);
      const n = Math.max(2, Math.round(L / 0.6));
      for (let i = 0; i < n; i++) t.box(-L / 2 + (i + 0.5) * (L / n), h - 0.36, 0, L / n, 0.36, D + 0.2, CLOTH[(i + (cx > 0 ? 2 : 0)) % 2 === 0 ? (cx > 0 ? 2 : 0) : 1]!, undefined, 0.01);
      return;
    }
    case 'well': {
      const r = D / 2;
      const ring = d.detail === 0 ? 1 : 3;
      for (let i = 0; i < ring; i++) t.cyl(0, i * (0.9 / ring), 0, r - 0.05 - (i % 2) * 0.03, 0.9 / ring - 0.01, i % 2 ? '#9ea3a8' : '#b4b8bc', undefined, 0.03);
      t.cyl(0, 0.9, 0, r - 0.25, 0.01, '#20303a', 'glass');
      for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) t.box(x, 0.9, 0, 0.16, h - 1.5, 0.16, OAK, undefined, 0.02);
      t.cylX(0, h - 1.0, 0, 0.08, L - 0.6, DARK);
      t.prism(`well-roof:${D}`, [[-D / 2, 0], [D / 2, 0], [0, 0.6]], L, 0, h - 0.6, 0, '#a8452e');
      return;
    }
    case 'cross': {
      t.box(0, 0, 0, L, 0.25, D, '#b4ae9f', undefined, 0.03);
      t.box(0, 0.25, 0, L - 0.4, 0.25, D - 0.4, '#a8a294', undefined, 0.03);
      t.box(0, 0.5, 0, 0.6, h - 1.0, 0.6, '#c4bdab', undefined, 0.04);
      t.box(0, h - 0.5, 0, 0.6, 0.5, 0.6, '#d3ccbb', undefined, 0.04);
      t.box(0, h - 0.35, 0, 1.2, 0.2, 0.24, '#d3ccbb', undefined, 0.03);
      return;
    }
    case 'anvil': {
      t.box(0, 0, 0, L, 0.6, D, '#6e4a2f', undefined, 0.03);
      t.box(0, 0.6, 0, L * 0.7, h - 0.6, D * 0.5, IRON, 'metal', 0.03);
      if (d.detail > 0) t.cone(L * 0.4, h - 0.2, 0, 0.12, 0.02, 0.4, IRON, 'metal', 6, Math.PI / 2);
      return;
    }
  }
}

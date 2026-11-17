import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { faceFrame, Rng, shade, type Face } from './util';

export type RoofKind = 'gable' | 'flat';

interface RoofSpec {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  height: number;
  face: Face;
  roof: RoofKind;
  roofColor: string;
  wall: string[];
  trim: string;
  seed?: number;
}

const PITCH = 0.75;

function depthOf(p: RoofSpec) {
  return p.face === 'n' || p.face === 's' ? p.z1 - p.z0 : p.x1 - p.x0;
}

export function roofHeight(kind: RoofKind, p: { x0: number; z0: number; x1: number; z1: number; face: Face }) {
  if (kind === 'flat') return 0.7;
  const depth = p.face === 'n' || p.face === 's' ? p.z1 - p.z0 : p.x1 - p.x0;
  return (depth / 2) * PITCH + 0.3;
}

/** Gable roofs from overlapping slope rows (ridge parallel to the façade), or flat roofs with clutter. */
export function drawRoof(d: Drawer, p: RoofSpec) {
  const { f, length } = faceFrame(p.face, p.x0, p.z0, p.x1, p.z1);
  const t = new Pen(d, f);
  const D = depthOf(p);
  const base = p.height;
  const rng = new Rng(p.seed ?? Math.round(p.x0 * 7 + p.z1 * 5));
  if (p.roof === 'flat') {
    const c = shade(p.wall[0]!, -0.08);
    t.box(length / 2, base, -D / 2, length, 0.08, D, '#7c8389', undefined, 0);
    t.box(length / 2, base, -0.2, length, 0.7, 0.4, c, undefined, 0.02);
    t.box(length / 2, base, -D + 0.2, length, 0.7, 0.4, c, undefined, 0.02);
    for (const u of [0.2, length - 0.2]) t.box(u, base, -D / 2, 0.4, 0.7, D, c, undefined, 0.02);
    if (d.detail === 0) return;
    t.box(length / 2, base + 0.7, -0.2, length + 0.06, 0.12, 0.48, p.trim, undefined, 0.02);
    const ac = rng.range(1.5, length - 2.5);
    t.box(ac, base + 0.08, -D / 2, 1.4, 0.9, 1.0, '#b7bcc2', 'metal', 0.03);
    t.cyl(ac, base + 0.98, -D / 2, 0.36, 0.06, '#545c63', 'metal');
    if (length > 7) {
      const tx = length - ac > ac ? length - 2 : 2;
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) t.box(tx + sx, base + 0.08, -D / 2 + sz, 0.1, 1.2, 0.1, '#545c63', 'metal', 0);
      t.cyl(tx, base + 1.28, -D / 2, 0.75, 1.3, '#9a6a3f', undefined, 0.04);
      t.cone(tx, base + 2.58, -D / 2, 0.8, 0.1, 0.5, '#6e4a2f', undefined, t.segs);
    }
    return;
  }
  const rise = (D / 2) * PITCH;
  const over = 0.3;
  const c = p.roofColor;
  if (d.detail === 0) {
    t.prism('roof-low', [[over, -0.05], [-D / 2, rise], [-D - over, -0.05]].map(([z, y]) => [z!, y!]) as [number, number][], length + 0.4, length / 2, base, -0, c);
    t.prism(`gable:${D}`, [[0, 0], [-D / 2, rise], [-D, 0]], length - 0.02, length / 2, base, 0, shade(p.wall[0]!, -0.1));
    return;
  }
  const rows = Math.max(3, Math.round((D / 2 + over) / 0.42));
  const run = (D / 2 + over) / rows;
  const dy = run * PITCH;
  const segs = Math.max(1, Math.round(length / 3.2));
  const segLen = (length + 0.4) / segs;
  for (const side of [1, -1]) {
    for (let k = 0; k < rows; k++) {
      const zf = side === 1 ? over - k * run : -D - over + k * run;
      const zb = zf - side * run * 1.6;
      const y0 = base - 0.05 + k * dy;
      const prof: [number, number][] = [
        [zf, y0],
        [zf, y0 + 0.1],
        [zb, y0 + 0.1 + run * 1.6 * PITCH],
        [zb, y0]
      ];
      const key = `roof-row:${side}:${run.toFixed(3)}:${k}:${D}`;
      for (let s = 0; s < segs; s++) {
        const tint = (k + s) % 3 === 0 ? shade(c, 0.07) : (k + s) % 3 === 1 ? c : shade(c, -0.06);
        t.prism(key, prof, segLen - 0.01, -0.2 + segLen * (s + 0.5), 0, 0, tint);
      }
    }
  }
  t.box(length / 2, base + rise - 0.02, -D / 2, length + 0.44, 0.22, 0.36, shade(c, -0.2), undefined, 0.04);
  t.prism(`gable:${D}`, [[0, 0], [-D / 2, rise], [-D, 0]], length - 0.02, length / 2, base, 0, shade(p.wall[0]!, -0.1));
  const chimneys = length > 8 ? 2 : 1;
  for (let i = 0; i < chimneys; i++) {
    const u = chimneys === 1 ? length * 0.7 : length * (0.22 + i * 0.56);
    const cz = -D / 2 - 0.8;
    t.box(u, base + rise * 0.5, cz, 0.8, rise * 0.5 + 1.0, 0.8, shade(p.wall[0]!, -0.05), undefined, 0.02);
    t.box(u, base + rise + 1.0, cz, 0.96, 0.16, 0.96, p.trim, undefined, 0.02);
    if (d.detail >= 2) t.cyl(u, base + rise + 1.16, cz, 0.16, 0.3, '#7c8389', 'metal', 0.02);
  }
}

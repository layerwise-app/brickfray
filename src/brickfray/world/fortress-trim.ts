import { F, type Kind, type Opening, type Piece, type Roof, type Works } from './fortress-plan';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { faceFrame, Frame, shade, type Face } from './util';

/** Door and window surrounds, battlements on the curtain: drawn only, the works carry the colliders. */
export const FORTRESS_TRIM: Element<Works> = {
  draw(d, w) {
    for (const o of w.openings) surround(d, o);
    battlements(d, w.pieces);
    for (const r of w.roofs) if (!r.small) beams(d, r);
    for (const g of GLAZING) lancet(d, ...g);
  }
};

/** Tie beams under a hall roof, across its short side every 2.4 m. */
function beams(d: Drawer, r: Roof) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const alongX = r.face === 'n' || r.face === 's';
  const [a0, a1] = alongX ? [r.x0, r.x1] : [r.z0, r.z1];
  const [c0, c1] = alongX ? [r.z0, r.z1] : [r.x0, r.x1];
  if (c1 - c0 > 10) return;
  for (let a = a0 + 2.0; a < a1 - 1.0; a += 2.4) {
    if (alongX) t.box(a, r.base - 0.34, (c0 + c1) / 2, 0.26, 0.3, c1 - c0 - 0.2, '#5e3f27', undefined, 0.02);
    else t.box((c0 + c1) / 2, r.base - 0.34, a, c1 - c0 - 0.2, 0.3, 0.26, '#5e3f27', undefined, 0.02);
  }
}

/** Glazed lancets in the solid long walls of the great hall and the chapel: [x, sill, head]. */
export const GLAZING: [number, number, number][] = [
  [-11.6, 4.0, 5.6],
  [0.4, 4.0, 5.6],
  [8.0, 2.4, 4.6],
  [10.4, 2.4, 4.6]
];

/** A tall narrow window of dark glass in a stone surround, inside and out, in both long walls of the hall row. */
function lancet(d: Drawer, u: number, sill: number, head: number) {
  const [z0, z1, wall] = [F.hall, F.bandN, 0.8];
  for (const f of [new Frame(u, 0, z1, 0), new Frame(u, 0, z0, 2), new Frame(u, 0, z0 + wall, 0), new Frame(u, 0, z1 - wall, 2)]) {
    const t = new Pen(d, f);
    t.box(0, sill, 0.01, 0.56, head - sill, 0.06, '#2d4a6e', 'glass', 0);
    for (const s of [-1, 1]) t.box(s * 0.4, sill - 0.1, 0.05, 0.22, head - sill + 0.2, 0.12, '#e9e1cc', undefined, 0.02);
    t.box(0, head, 0.05, 1.02, 0.22, 0.14, '#e9e1cc', undefined, 0.02);
    t.box(0, sill - 0.2, 0.06, 1.0, 0.14, 0.18, '#e9e1cc', undefined, 0.02);
  }
}

const SURROUND: Partial<Record<Kind, string>> = {
  hall: '#e9e1cc',
  timber: '#5e3f27',
  tower: '#9a9da0',
  curtain: '#b3b5b4',
  wall: '#bdb6a6'
};

const ALL: Face[] = ['n', 's', 'e', 'w'];

/** Faces of a piece not buried in a neighbour, and whether its top shows. */
export function exposure(q: Piece, all: Piece[]): { faces: Face[]; top: boolean } {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const near = all.filter((o) => o !== q && o.kind !== 'ford' && o.max[0] >= x0 - 0.1 && o.min[0] <= x1 + 0.1 && o.max[2] >= z0 - 0.1 && o.min[2] <= z1 + 0.1 && o.max[1] >= y0 && o.min[1] <= y1 + 0.1);
  const inside = (x: number, y: number, z: number) => y < 0 || near.some((o) => x > o.min[0] && x < o.max[0] && y > o.min[1] && y < o.max[1] && z > o.min[2] && z < o.max[2]);
  const ys = [y0 + (y1 - y0) * 0.1, (y0 + y1) / 2, y1 - (y1 - y0) * 0.1];
  const across = (a: number, b: number) => [a + (b - a) * 0.08, (a + b) / 2, b - (b - a) * 0.08];
  const pts: Record<Face, [number, number, number][]> = { n: [], s: [], e: [], w: [] };
  for (const y of ys) {
    for (const x of across(x0, x1)) pts.n.push([x, y, z0 - 0.05]), pts.s.push([x, y, z1 + 0.05]);
    for (const z of across(z0, z1)) pts.w.push([x0 - 0.05, y, z]), pts.e.push([x1 + 0.05, y, z]);
  }
  const faces = ALL.filter((f) => !pts[f].every(([x, y, z]) => inside(x, y, z)));
  const top = !across(x0, x1).every((x) => across(z0, z1).every((z) => inside(x, y1 + 0.05, z)));
  return { faces, top };
}

/** Jambs and head proud of both faces of the wall; windows get a sill. */
function surround(d: Drawer, o: Opening) {
  const color = SURROUND[o.kind];
  if (!color) return;
  const mid = (o.a0 + o.a1) / 2;
  const frames = o.alongX ? [new Frame(mid, 0, o.c1, 0), new Frame(mid, 0, o.c0, 2)] : [new Frame(o.c1, 0, mid, 1), new Frame(o.c0, 0, mid, 3)];
  const w = o.a1 - o.a0;
  const h = o.y1 - o.y0;
  const bar = o.kind === 'timber' ? 0.2 : 0.24;
  const out = 0.12;
  for (const f of frames) {
    const t = new Pen(d, f);
    for (const s of [-1, 1]) t.box(s * (w / 2 + bar / 2), o.y0, out / 2 - 0.02, bar, h + bar, out, color, undefined, 0.02);
    t.box(0, o.y1, out / 2 - 0.02, w + bar * 2 + 0.12, bar, out + 0.04, color, undefined, 0.02);
    if (!o.door) t.box(0, o.y0 - 0.12, out / 2, w + bar * 2 + 0.16, 0.12, out + 0.1, color, undefined, 0.02);
    else if (o.kind === 'curtain' || o.kind === 'tower') t.box(0, o.y1 + bar, out / 2 - 0.02, 0.36, 0.3, out + 0.06, color, undefined, 0.02);
  }
}

/** Merlons along both edges of every curtain top that shows, once per spot where two runs meet. */
function battlements(d: Drawer, pieces: Piece[]) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const done: [number, number][] = [];
  const colors = ['#a9adae', '#9ea2a4', '#b3b6b6'];
  let k = 0;
  for (const q of pieces) {
    const crowned = q.kind === 'tower' && Math.abs(q.max[1] - 8.0) < 0.01;
    if (!crowned && (q.kind !== 'curtain' || q.max[1] < F.curtain - 0.01)) continue;
    if (!exposure(q, pieces).top) continue;
    const top = q.max[1];
    const alongX = q.max[0] - q.min[0] >= q.max[2] - q.min[2];
    const [a0, a1] = alongX ? [q.min[0], q.max[0]] : [q.min[2], q.max[2]];
    const [c0, c1] = alongX ? [q.min[2], q.max[2]] : [q.min[0], q.max[0]];
    for (const c of [c0 + 0.24, c1 - 0.24]) {
      for (let a = a0 + 0.8; a <= a1 - 0.4; a += 1.6) {
        const [x, z] = alongX ? [a, c] : [c, a];
        if (done.some(([px, pz]) => Math.abs(px - x) < 0.9 && Math.abs(pz - z) < 0.9)) continue;
        if (pieces.some((o) => o !== q && o.max[1] > top + 0.1 && x > o.min[0] && x < o.max[0] && z > o.min[2] && z < o.max[2])) continue;
        done.push([x, z]);
        const color = colors[k++ % colors.length]!;
        if (alongX) t.box(x, top - 0.02, z, 0.8, 0.96, 0.48, color, undefined, 0);
        else t.box(x, top - 0.02, z, 0.48, 0.96, 0.8, color, undefined, 0);
      }
    }
  }
}

/** Gable roof of an outbuilding: shingle rows like the big roofs, a ridge board, no chimney. */
export function shedRoof(d: Drawer, r: Roof) {
  const { f, length } = faceFrame(r.face, r.x0, r.z0, r.x1, r.z1);
  const t = new Pen(d, f);
  const D = r.face === 'n' || r.face === 's' ? r.z1 - r.z0 : r.x1 - r.x0;
  const pitch = 0.75;
  const rise = (D / 2) * pitch;
  const over = 0.25;
  const rows = d.detail === 0 ? 1 : Math.max(2, Math.round((D / 2 + over) / 0.42));
  const run = (D / 2 + over) / rows;
  for (const side of [1, -1]) {
    for (let k = 0; k < rows; k++) {
      const zf = side === 1 ? over - k * run : -D - over + k * run;
      const zb = zf - side * run * (rows === 1 ? 1 : 1.6);
      const y0 = r.base - 0.05 + k * run * pitch;
      const prof: [number, number][] = [[zf, y0], [zf, y0 + 0.1], [zb, y0 + 0.1 + (zf - zb) * side * pitch], [zb, y0]];
      const tint = k % 2 ? shade(r.color, -0.06) : r.color;
      t.prism(`shed-row:${side}:${run.toFixed(3)}:${k}:${D}:${rows}`, prof, length + 0.4, length / 2, 0, 0, tint);
    }
  }
  t.box(length / 2, r.base + rise - 0.02, -D / 2, length + 0.44, 0.2, 0.3, shade(r.color, -0.2), undefined, 0.03);
  t.prism(`gable:${D}`, [[0, 0], [-D / 2, rise], [-D, 0]], length - 0.02, length / 2, r.base, 0, shade(r.wall, -0.1));
}

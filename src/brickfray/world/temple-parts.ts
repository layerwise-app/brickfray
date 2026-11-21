import { PLATE } from '../engine/geometry';
import { drawBlock, plates, slab, STAIRS, type Masonry, type StairParams } from './blocks';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { belfry, stupa, tieredRoof } from './temple-ornament';
import { T, templeGeometry, type Kind, type Piece } from './temple-layout';
import { box, Frame, Rng, type Face } from './util';

export const JADE: Masonry = { colors: ['#93a996', '#849c88', '#a2b6a3', '#76907b'], variance: 0.35, lens: [3, 4, 2, 5], seam: '#4f6656' };
export const SANDSTONE: Masonry = { colors: ['#d8c9a3', '#cbbb93', '#e2d5b2'], variance: 0.3, lens: [2, 3, 4] };
const ROCK = ['#7d8276', '#6f7469', '#878c80', '#666b61', '#73806a', '#8a8470', '#5f7a5a'];
const VINE = '#3f8a3a';
const CEILING = '#8a3a2c';
export const C = {
  plinth: '#5f7d68',
  sand: '#d8c9a3',
  gold: '#e0b040',
  teal: '#2f8a7a',
  red: '#b8402c',
  moss: '#4f8a3a',
  walk: '#c9bd98',
  terrace: '#c4a27a'
} as const;

const ALL: Face[] = ['n', 's', 'e', 'w'];

interface Exposure {
  faces: Face[];
  top: boolean;
}

/** Faces of a piece not buried in a neighbour (wall joints, slab edges under walls), and whether its top shows. */
function exposure(q: Piece, all: Piece[]): Exposure {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const near = all.filter((o) => o !== q && o.max[0] >= x0 - 0.1 && o.min[0] <= x1 + 0.1 && o.max[2] >= z0 - 0.1 && o.min[2] <= z1 + 0.1 && o.max[1] >= y0 && o.min[1] <= y1 + 0.1);
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

/** Masonry with a dark plinth course at the foot, a sandstone cornice and, where the top shows, a coping. */
function stone(d: Drawer, q: Piece, e: Exposure, style: Masonry, bands = true) {
  drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style, faces: e.faces, top: e.top ? 'tiles' : 'none', topColor: C.sand });
  if (!bands || (d.detail === 0 && q.max[1] - q.min[1] < 1.5)) return;
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const band = (y: number, h: number, out: number, color: string) => {
    for (const f of e.faces) {
      if (f === 'n') slab(d, [x0, y, z0 - out], [x1, y + h, z0], color);
      if (f === 's') slab(d, [x0, y, z1], [x1, y + h, z1 + out], color);
      if (f === 'w') slab(d, [x0 - out, y, z0], [x0, y + h, z1], color);
      if (f === 'e') slab(d, [x1, y, z0], [x1 + out, y + h, z1], color);
    }
  };
  if (y0 <= 0.01) band(0, 0.48, 0.06, C.plinth);
  if (y1 - y0 > 2.4 && !e.top) band(y1 - 0.24, 0.24, 0.08, C.sand);
}

function pillar(d: Drawer, q: Piece) {
  const t = new Pen(d, new Frame((q.min[0] + q.max[0]) / 2, 0, (q.min[2] + q.max[2]) / 2));
  const h = q.max[1];
  t.box(0, 0, 0, 0.8, 0.32, 0.8, C.plinth);
  t.box(0, 0.32, 0, 0.7, 0.16, 0.7, C.sand);
  t.cyl(0, 0.48, 0, 0.27, h - 1.04, C.red, undefined, 0.02, [8, 12, 12][d.detail]);
  for (const y of [1.2, h - 1.4]) t.cyl(0, y, 0, 0.3, 0.12, C.gold, 'metal');
  t.box(0, h - 0.56, 0, 0.72, 0.24, 0.72, C.sand);
  t.box(0, h - 0.32, 0, 0.8, 0.32, 0.8, C.gold, 'metal');
}

/** Balustrade post standing in for a parapet block: plinth, carved shaft, coping with a gold knob. */
function post(d: Drawer, q: Piece) {
  const w = q.max[0] - q.min[0];
  const dd = q.max[2] - q.min[2];
  const h = q.max[1] - q.min[1];
  const t = new Pen(d, new Frame((q.min[0] + q.max[0]) / 2, q.min[1], (q.min[2] + q.max[2]) / 2));
  t.box(0, 0, 0, w, 0.24, dd, C.plinth);
  t.box(0, 0.24, 0, w - 0.1, h - 0.48, dd - 0.08, '#a2b6a3');
  if (d.detail > 0) t.box(0, 0.62, 0, w - 0.04, 0.08, dd - 0.02, C.sand, undefined, 0);
  t.box(0, h - 0.24, 0, w, 0.24, dd, C.sand);
  if (d.detail > 0) t.cone(0, h, 0, 0.08, 0.02, 0.16, C.gold, 'metal', 8);
}

/** A face that looks out of the playable area (the backs of the cliffs) is never seen. */
function outward(f: Face, q: Piece) {
  const E = T.edge + 0.01;
  return (f === 'n' && q.min[2] < -E) || (f === 's' && q.max[2] > E) || (f === 'w' && q.min[0] < -E) || (f === 'e' && q.max[0] > E);
}

/** Unreachable cliff or rock mass: rock columns stepped back from its face (never in front of the collider), moss on top. */
function rock(d: Drawer, q: Piece, e: Exposure) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const faces = e.faces.filter((f) => !outward(f, q));
  const inset = (f: Face) => (faces.includes(f) ? 0.7 : 0);
  slab(d, [x0 + inset('w'), y0, z0 + inset('n')], [x1 - inset('e'), y1 - 0.2, z1 - inset('s')], '#5c6158');
  const rng = new Rng(Math.round(x0 * 13 + z0 * 7 + y1));
  const layers = d.detail === 0 ? 2 : 4;
  // Slabs between the face plane and `depth` behind it, along the face from a to a + w.
  const put = (alongX: boolean, face: number, sign: number, a: number, w: number, yA: number, yB: number, out: number, depth: number, color: string) => {
    const [m0, m1] = [face + sign * out, face - sign * depth].sort((m, n) => m - n) as [number, number];
    if (alongX) slab(d, [a, yA, m0], [a + w, yB, m1], color);
    else slab(d, [m0, yA, a], [m1, yB, a + w], color);
  };
  for (const f of faces) {
    const alongX = f === 'n' || f === 's';
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    const sign = f === 's' || f === 'e' ? 1 : -1;
    const face = f === 'n' ? z0 : f === 's' ? z1 : f === 'w' ? x0 : x1;
    for (let a = a0; a < a1 - 0.01; ) {
      const w = Math.min(rng.range(1.2, d.detail === 0 ? 3.6 : 2.8), a1 - a);
      let y = Math.max(y0, -0.4);
      let last = 0;
      for (let k = 0; k < layers && y < y1; k++) {
        const h = k === layers - 1 ? y1 - y : rng.range(1.2, 2.6);
        const out = rng.range(-0.4, 0.02);
        const top = Math.min(y1 + 0.3, y + h + rng.range(-0.2, 0.3));
        put(alongX, face, sign, a + 0.03, w - 0.06, y, top, out, 0.8, rng.pick(ROCK));
        if (d.detail > 0 && k > 0 && out < last - 0.12) put(alongX, face, sign, a + 0.1, w - 0.2, y - 0.06, y + 0.1, last - 0.02, 0.4, C.moss);
        last = out;
        y += h;
      }
      if (d.detail > 0 && rng.chance(0.35)) put(alongX, face, sign, a + rng.range(0.2, Math.max(0.2, w - 0.7)), 0.5, y1 - rng.range(1.6, 4.4), y1 + 0.1, 0.04, 0.3, VINE);
      a += w;
    }
  }
  plates(d, x0, z0, x1, z1, y1 - 0.2, C.moss, false);
}

/** Lacquered red ceiling under a floor slab, seen from the rooms and passages below. */
function ceiling(d: Drawer, q: Piece) {
  slab(d, [q.min[0] + 0.02, q.min[1] - 0.04, q.min[2] + 0.02], [q.max[0] - 0.02, q.min[1], q.max[2] - 0.02], CEILING);
}

/** Gold sun discs and offering bowls on the four faces of the shrine's central pier (half-size r). */
function altarFaces(d: Drawer, r: number) {
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const turns of [0, 1, 2, 3]) {
    const f = t.at(new Frame(0, 0, 0, turns));
    f.cylZ(0, 1.9, r + 0.04, 0.42, 0.08, C.gold, 'metal', 0.02, d.detail === 0 ? 10 : 16);
    if (d.detail > 0) f.cylZ(0, 1.9, r + 0.1, 0.2, 0.06, C.red, undefined, 0.01);
    f.box(0, 0.9, r + 0.12, 1.4, 0.12, 0.24, C.sand, undefined, 0.02);
    for (const x of [-0.4, 0.4]) f.cyl(x, 1.02, r + 0.12, 0.09, 0.1, C.gold, 'metal', 0.02);
  }
}

const DRAW: Record<Kind, (d: Drawer, q: Piece, e: Exposure) => void> = {
  cliff: rock,
  rock,
  bank: (d, q, e) => stone(d, q, e, SANDSTONE, false),
  pillar,
  roof: (d, q) => tieredRoof(d, q),
  wall: (d, q, e) => stone(d, q, e, JADE),
  hall: (d, q, e) => stone(d, q, e, JADE),
  lintel: (d, q, e) => stone(d, q, e, SANDSTONE, false),
  slab: (d, q, e) => {
    drawBlock(d, { min: q.min, max: [q.max[0], q.max[1] - PLATE, q.max[2]], surface: 'stone', style: SANDSTONE, faces: e.faces, top: 'none' });
    ceiling(d, q);
    if (e.top) plates(d, q.min[0], q.min[2], q.max[0], q.max[2], q.max[1] - PLATE, C.terrace, false);
  },
  deck: (d, q, e) => {
    drawBlock(d, { min: q.min, max: [q.max[0], q.max[1] - PLATE, q.max[2]], surface: 'stone', style: SANDSTONE, faces: e.faces, top: 'none' });
    ceiling(d, q);
    plates(d, q.min[0], q.min[2], q.max[0], q.max[2], q.max[1] - PLATE, C.terrace, false);
    for (const z of [q.min[2] - 0.05, q.max[2]]) slab(d, [q.min[0], q.min[1] + 0.12, z], [q.max[0], q.min[1] + 0.26, z + 0.05], C.gold, 'metal');
  },
  pier: (d, q, e) => stone(d, q, e, JADE),
  parapet: post,
  stupa: (d, q) => stupa(d, q),
  kiosk: (d, q, e) => stone(d, q, e, JADE),
  tower: (d, q, e) => stone(d, q, e, JADE),
  bell: (d, q) => belfry(d, q),
  altar: (d, q, e) => {
    stone(d, q, e, SANDSTONE);
    if (q.min[2] < 0) altarFaces(d, q.max[0]);
  },
  screen: (d, q, e) => stone(d, q, e, SANDSTONE)
};

export const TEMPLE: Element<{ pieces: Piece[] }> = {
  colliders: (p) => p.pieces.map((q) => box(q.min, q.max, q.surface ?? 'stone', { walk: q.walk })),
  draw(d, p) {
    for (const q of p.pieces) DRAW[q.kind](d, q, exposure(q, p.pieces));
  }
};

/** Every structure and flight of steps of the map. */
export function templeStructures(p: Plan) {
  const { pieces, flights, doorways } = templeGeometry();
  p.add(TEMPLE, { pieces });
  p.navSeeds.push(...doorways);
  for (const f of flights) {
    const params: StairParams = { ...f, rise: T.rise, run: T.run, style: SANDSTONE, surface: 'stone', topColor: C.walk };
    p.add(STAIRS, params);
  }
}

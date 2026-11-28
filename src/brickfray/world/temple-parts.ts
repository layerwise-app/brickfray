import { PLATE } from '../engine/geometry';
import { drawBlock, plates, slab, STAIRS, type Masonry, type StairParams } from './blocks';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { burner, fence, greatStatue, guardians, house, kiosk, rail, ruin, stack, stele } from './temple-art';
import { board, floorJoists, galleryRafters, naveCeiling } from './temple-interior';
import { marketShed, ROOF_BLUE, villageLoad } from './temple-landmarks';
import { clerestory, pavilionRoof, ROOF_CLAY, ROOF_JADE, tiledRoof } from './temple-ornament';
import { screen } from './temple-screens';
import { prop, propSolid } from './temple-things';
import { templeGeometry } from './temple-geometry';
import { CAMP, T, type Kind, type Piece } from './temple-layout';
import { box, Frame, Rng, shade, type Face } from './util';

export const JADE: Masonry = { colors: ['#93a996', '#849c88', '#a2b6a3', '#76907b'], variance: 0.35, lens: [3, 4, 2, 5], seam: '#4f6656' };
export const SANDSTONE: Masonry = { colors: ['#e0c48e', '#d6b984', '#e8cf9c'], variance: 0.25, lens: [2, 3, 4], seam: '#a08860' };
/** District palettes: red lacquer in the great hall, ochre plaster in the ranges, weathered grey stone in the strips. */
const HALL_RED: Masonry = { colors: ['#a83a2c', '#9e3427', '#b24536'], variance: 0.15, lens: [4, 6, 8], seam: '#6a2219' };
const RANGE_OCHRE: Masonry = { colors: ['#d2a050', '#c99446', '#dcad62'], variance: 0.2, lens: [3, 4, 6], seam: '#8a6230' };
/** The east half's ranges: whitewashed plaster under blue-grey tiles (the west keeps ochre under clay). */
const RANGE_WHITE: Masonry = { colors: ['#ece6d6', '#e2dccb', '#f2ecdc'], variance: 0.12, lens: [4, 6, 8], seam: '#9a9484' };
const LINTEL: Masonry = { colors: ['#2f6f5a', '#2a6553'], variance: 0.1, lens: [6, 8], seam: '#e0b040' };
const ROCK = ['#7d8276', '#6f7469', '#878c80', '#666b61', '#73806a', '#8a8470', '#5f7a5a'];
const VINE = '#2f6f36';
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

const FACADE = new Set(['guest', 'refectory', 'library', 'gate']);

/**
 * The long faces of the ranges in bays: a red column every 4-5 m, a lattice window in each bay, and on the faces that
 * look into a camp the team's banner instead of the window (orange west, blue east). Flat on the wall, no colliders.
 */
function facade(d: Drawer, q: Piece, e: Exposure) {
  if (!FACADE.has(q.tag ?? '')) return;
  const [x0, , z0] = q.min;
  const [x1, y1, z1] = q.max;
  for (const f of e.faces) {
    const alongX = f === 'n' || f === 's';
    const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
    if (a1 - a0 < 6) continue;
    const n = Math.round((a1 - a0) / 4.8);
    const bay = (a1 - a0) / n;
    const at = f === 'n' ? z0 : f === 's' ? z1 : f === 'w' ? x0 : x1;
    const sign = f === 'n' || f === 'w' ? -1 : 1;
    const put = (a: number, w: number, ya: number, yb: number, out: number, color: string) => {
      const [m0, m1] = [at, at + sign * out].sort((p, r) => p - r) as [number, number];
      if (alongX) slab(d, [a, ya, m0], [a + w, yb, m1], color);
      else slab(d, [m0, ya, a], [m1, yb, a + w], color);
    };
    for (let i = 0; i <= n; i++) put(Math.min(Math.max(a0 + i * bay - 0.2, a0), a1 - 0.4), 0.4, 0.48, y1 - 0.24, 0.12, C.red);
    if (d.detail === 0) continue;
    const camp = !alongX && Math.abs(Math.abs(at) - CAMP) < 0.01;
    for (let i = 0; i < n; i++) {
      const m = a0 + (i + 0.5) * bay;
      if (camp) {
        const team = at < 0 ? '#d0622c' : '#3f6f9a';
        put(m - 0.7, 1.4, 1.2, y1 - 0.6, 0.06, team);
        put(m - 0.8, 1.6, y1 - 0.7, y1 - 0.5, 0.1, C.gold);
        put(m - 0.35, 0.7, y1 - 2.2, y1 - 1.5, 0.08, C.gold);
        continue;
      }
      put(m - 0.9, 1.8, 1.5, 3.1, 0.08, '#6a2a1e');
      put(m - 0.75, 1.5, 1.65, 2.95, 0.1, '#b07a48');
      for (const y of [2.05, 2.55]) put(m - 0.75, 1.5, y, y + 0.06, 0.13, '#6a2a1e');
      for (const k of [-0.25, 0.25]) put(m + k - 0.03, 0.06, 1.65, 2.95, 0.13, '#6a2a1e');
    }
  }
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

/** Balustrade post standing in for a parapet block: plinth, red lacquered shaft, coping with a gold knob. */
function post(d: Drawer, q: Piece) {
  const w = q.max[0] - q.min[0];
  const dd = q.max[2] - q.min[2];
  const h = q.max[1] - q.min[1];
  const t = new Pen(d, new Frame((q.min[0] + q.max[0]) / 2, q.min[1], (q.min[2] + q.max[2]) / 2));
  t.box(0, 0, 0, w, 0.24, dd, C.plinth);
  t.box(0, 0.24, 0, w - 0.1, h - 0.48, dd - 0.08, '#a83a2c');
  if (d.detail > 0) t.box(0, 0.62, 0, w - 0.04, 0.08, dd - 0.02, C.sand, undefined, 0);
  t.box(0, h - 0.24, 0, w, 0.24, dd, C.sand);
  if (d.detail > 0) t.cone(0, h, 0, 0.08, 0.02, 0.16, C.gold, 'metal', 8);
}

/** A lacquered handrail on a balustrade: a top rail on slim posts every 1.2 m (bullets and eyes pass between them). */
function handrail(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const along = x1 - x0 > z1 - z0;
  const t = new Pen(d, new Frame(0, 0, 0));
  const c = (along ? z0 + z1 : x0 + x1) / 2;
  slab(d, [along ? x0 : c - 0.06, y1 - 0.1, along ? c - 0.06 : z0], [along ? x1 : c + 0.06, y1, along ? c + 0.06 : z1], '#a83a2c');
  const a0 = along ? x0 : z0;
  const a1 = along ? x1 : z1;
  for (let a = a0 + 0.1; a <= a1 - 0.05; a += d.detail === 0 ? 2.4 : 1.2) t.box(along ? a : c, y0, along ? c : a, 0.08, y1 - y0 - 0.1, 0.08, '#7a2a1f', undefined, 0);
}

/** A face that looks out of the playable area (the backs of the cliffs) is never seen. */
function outward(f: Face, q: Piece) {
  const Z = T.edge + 0.01;
  const X = T.edgeX + 0.01;
  return (f === 'n' && q.min[2] < -Z) || (f === 's' && q.max[2] > Z) || (f === 'w' && q.min[0] < -X) || (f === 'e' && q.max[0] > X);
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
      if (d.detail > 0 && y1 - y0 > 5 && rng.chance(0.35)) {
        const v = a + rng.range(0.2, Math.max(0.2, w - 0.9));
        for (let k = 0; k < 3; k++) put(alongX, face, sign, v + k * 0.26, rng.range(0.12, 0.2), y1 - rng.range(1.0, 3.2), y1 + 0.1, 0.04, 0.2, k % 2 ? VINE : shade(VINE, -0.12));
      }
      a += w;
    }
  }
  plates(d, x0, z0, x1, z1, y1 - 0.2, C.moss, false);
}

/** Timber boards on a gallery floor: seams along its length every 0.8 m and staggered board ends every 4.8 m. */
function boards(d: Drawer, q: Piece) {
  const [x0, , z0] = q.min;
  const [x1, y, z1] = q.max;
  const alongX = x1 - x0 > z1 - z0;
  const [a0, a1] = alongX ? [x0, x1] : [z0, z1];
  const [c0, c1] = alongX ? [z0, z1] : [x0, x1];
  const seam = (a: number, b: number, c: number, e: number) => slab(d, alongX ? [a, y, c] : [c, y, a], alongX ? [b, y + 0.012, e] : [e, y + 0.012, b], '#7a5232');
  let row = 0;
  for (let c = c0 + 0.8; c < c1 - 0.1; c += 0.8, row++) {
    seam(a0, a1, c - 0.02, c + 0.02);
    for (let a = a0 + (row % 2 ? 2.4 : 4.8); a < a1 - 0.4; a += 4.8) seam(a - 0.02, a + 0.02, c - 0.8, c);
  }
}

/** Lacquered red ceiling under a floor slab, seen from the rooms and passages below. */
function ceiling(d: Drawer, q: Piece) {
  slab(d, [q.min[0] + 0.02, q.min[1] - 0.04, q.min[2] + 0.02], [q.max[0] - 0.02, q.min[1], q.max[2] - 0.02], CEILING);
}

/** Roofs: the nave's gable over both column rows, lean-tos over the galleries, jade tiles on the temple, clay on the ranges. */
function roof(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  slab(d, [x0, y0, z0], [x1, y1 - 0.24, z1], CEILING);
  if (x0 < 0 && x1 > 0 && y0 > T.hallTop - 0.1) {
    naveCeiling(d);
    return tiledRoof(d, x0, z0, x1, z1, y1, ROOF_JADE);
  }
  const inHall = Math.abs(x0 + x1) / 2 < T.arcade + 1 && Math.abs(z0 + z1) / 2 < 1;
  if (inHall && Math.abs(y0 - T.roofTop) < 0.1) {
    galleryRafters(d, q);
    const east = x0 > 0;
    tiledRoof(d, x0, z0, x1, z1, y1, ROOF_JADE, east ? 1 : -1);
    const cx = east ? T.col - 0.12 : -T.col + 0.12;
    return clerestory(d, cx - 0.28, y1, z0 + 0.2, cx + 0.28, T.hallTop, z1 - 0.2);
  }
  if (q.tag === 'shrine') return pavilionRoof(d, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, z1 - z0, x0 + x1 > 0 ? ROOF_JADE : ROOF_BLUE, 1);
  const clay = q.tag === 'guest' || q.tag === 'refectory' || q.tag === 'village' || q.tag === 'river' || q.tag === 'court';
  tiledRoof(d, x0, z0, x1, z1, y1, clay ? (x0 + x1 > 0 ? ROOF_BLUE : ROOF_CLAY) : ROOF_JADE);
}

/** Masonry of a block by its use and half: red lacquer for the temple's halls, ochre or white for the ranges. */
function hallStyle(q: Piece): Masonry {
  const east = q.min[0] + q.max[0] > 0;
  if (q.tag === 'guest' || q.tag === 'refectory') return east ? RANGE_WHITE : RANGE_OCHRE;
  if (q.tag === 'library') return east ? RANGE_WHITE : RANGE_OCHRE;
  return HALL_RED;
}

let houses = 0;
/** The face of a village house that looks onto the street or the lane. */
const houseFace = (q: Piece): Face => (q.tag === 'river' || q.tag === 'court' ? 'n' : 's');

const DRAW: Record<Kind, (d: Drawer, q: Piece, e: Exposure) => void> = {
  cliff: rock,
  rock,
  spur: rock,
  boulder: rock,
  pillar,
  pier: (d, q, e) => stone(d, q, e, HALL_RED),
  roof,
  wall: (d, q, e) => stone(d, q, e, HALL_RED),
  hall: (d, q, e) => {
    stone(d, q, e, hallStyle(q));
    facade(d, q, e);
  },
  cloister: (d, q, e) => stone(d, q, e, SANDSTONE),
  kiosk: (d, q) => kiosk(d, q),
  house: (d, q) => house(d, q, houses++, houseFace(q)),
  lintel: (d, q, e) => stone(d, q, e, q.min[1] > 2.5 && q.max[1] < 3.5 ? LINTEL : hallStyle(q), false),
  slab: (d, q, e) => {
    drawBlock(d, { min: q.min, max: [q.max[0], q.max[1] - PLATE, q.max[2]], surface: 'stone', style: SANDSTONE, faces: e.faces, top: 'none' });
    ceiling(d, q);
    floorJoists(d, q);
    if (e.top) plates(d, q.min[0], q.min[2], q.max[0], q.max[2], q.max[1] - PLATE, '#c08a58', false);
    if (e.top && d.detail > 0) boards(d, q);
  },
  parapet: post,
  rail: (d, q) => (q.tag === 'handrail' ? handrail(d, q) : rail(d, q)),
  fence: (d, q) => fence(d, q),
  screen: (d, q) => screen(d, q),
  banner: (d, q) => board(d, q),
  statue: (d, q) => (Math.abs(q.min[2]) < 3 ? greatStatue(d, q) : guardians(d, q)),
  dais: (d, q, e) => {
    stone(d, q, e, SANDSTONE, false);
    slab(d, [q.min[0] - 0.04, q.max[1] - 0.1, q.min[2] - 0.04], [q.max[0] + 0.04, q.max[1], q.max[2] + 0.04], C.gold, 'metal');
  },
  burner: (d, q) => burner(d, q),
  stele: (d, q) => stele(d, q, q.tag === 'strip'),
  ruin: (d, q) => (q.tag === 'shed' ? marketShed(d, q) : q.tag === 'load' ? villageLoad(d, q) : ruin(d, q)),
  stall: (d, q, e) => stone(d, q, e, SANDSTONE, false),
  stack: (d, q) => stack(d, q),
  planter: (d, q, e) => stone(d, q, e, SANDSTONE, false),
  prop: (d, q) => prop(d, q),
  deck: (d, q, e) => {
    if (q.surface === 'wood') {
      slab(d, q.min, [q.max[0], q.max[1] - PLATE, q.max[2]], '#7a5234');
      plates(d, q.min[0], q.min[2], q.max[0], q.max[2], q.max[1] - PLATE, '#a0744a', false);
      return;
    }
    drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: SANDSTONE, faces: e.faces, top: 'tiles', topColor: C.walk });
  }
};

export const TEMPLE: Element<{ pieces: Piece[] }> = {
  colliders: (p) => p.pieces.flatMap((q) => (q.solid ?? (q.kind === 'prop' ? propSolid(q) : undefined) ?? [[q.min, q.max]]).map(([a, b]) => box(a, b, q.surface ?? 'stone', { walk: q.walk, bulletsPass: q.bulletsPass }))),
  draw(d, p) {
    houses = 0;
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

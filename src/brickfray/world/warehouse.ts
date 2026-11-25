import { drawBlock, STAIRS, type Masonry, type StairParams } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, type Vec3 } from './util';

/**
 * Harbor warehouse on the north side: the short lane runs through it from end door to end door round the foreman's
 * office in the middle. Its front wall on the crane square has no door (the hall reaches the square only through the
 * customs house's clock passage, outside its west and east ends); the gallery along that wall looks out over the
 * square through a row of windows and nowhere else (a solid parapet closes its hall side).
 */
export const WH = { x0: -24.0, x1: 24.0, z0: -63.0, z1: -41.0, wall: 0.4, height: 8.0, deck: 4.2 } as const;
/** End-door z range (both end walls, on the shed road). */
export const END_DOOR: [number, number] = [-57.0, -51.0];
const END_H = 5.0;
/** Gallery deck along the front wall; the window sill is a metre above it, so a standing eye looks out and down. */
export const GALLERY = { x: 15.2, z0: WH.z1 - WH.wall - 2.0, z1: WH.z1 - WH.wall, sill: WH.deck + 1.0, lintel: WH.deck + 2.2, parapet: 2.2 } as const;
const WINDOWS = [-12.0, -6.0, 0, 6.0, 12.0];
const WIN_W = 2.4;
/** The foreman's office: a solid room on the end-door line, so no line runs door to door through the hall. */
export const OFFICE = { x: 3.0, z0: -58.2, z1: -49.8, height: 3.2 } as const;
const STAIR_FOOT = 22.4;
const BASE: Masonry = { colors: ['#9a5a43', '#8a4f3a', '#a8664c'], variance: 0.3 };
const SIDING = '#2f7f7a';
const RAIL = '#f6c624';

interface Part {
  min: Vec3;
  max: Vec3;
  kind: 'wall' | 'office' | 'deck' | 'parapet' | 'roof';
}

function wallSpans(lo: number, hi: number, holes: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let a = lo;
  for (const [h0, h1] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (h0 > a) out.push([a, h0]);
    a = Math.max(a, h1);
  }
  if (hi > a) out.push([a, hi]);
  return out;
}

function parts(): Part[] {
  const { x0, x1, z0, z1, wall: t, height: H, deck } = WH;
  const out: Part[] = [];
  const w = (min: Vec3, max: Vec3) => out.push({ min, max, kind: 'wall' });
  w([x0, 0, z0], [x1, H, z0 + t]);
  for (const x of [x0, x1 - t]) {
    for (const [a, b] of wallSpans(z0 + t, z1 - t, [END_DOOR])) w([x, 0, a], [x + t, H, b]);
    w([x, END_H, END_DOOR[0]], [x + t, H, END_DOOR[1]]);
  }
  const front = z1 - t;
  w([x0, 0, front], [x1, GALLERY.sill, z1]);
  const wins = WINDOWS.map((c) => [c - WIN_W / 2, c + WIN_W / 2] as [number, number]);
  for (const [a, b] of wallSpans(x0, x1, wins)) w([a, GALLERY.sill, front], [b, GALLERY.lintel, z1]);
  w([x0, GALLERY.lintel, front], [x1, H, z1]);
  out.push({ min: [-GALLERY.x, deck - 0.2, GALLERY.z0], max: [GALLERY.x, deck, GALLERY.z1], kind: 'deck' });
  out.push({ min: [-GALLERY.x, deck, GALLERY.z0 - 0.2], max: [GALLERY.x, deck + GALLERY.parapet, GALLERY.z0], kind: 'parapet' });
  out.push({ min: [-OFFICE.x, 0, OFFICE.z0], max: [OFFICE.x, OFFICE.height, OFFICE.z1], kind: 'office' });
  out.push({ min: [x0 - 0.3, H, z0 - 0.3], max: [x1 + 0.3, H + 2.8, z1 + 0.3], kind: 'roof' });
  return out;
}

const stairs = (): StairParams[] =>
  [-1, 1].map((s) => ({
    x: s * STAIR_FOOT,
    z: (GALLERY.z0 + GALLERY.z1) / 2,
    y0: 0,
    dir: s < 0 ? ('e' as const) : ('w' as const),
    width: GALLERY.z1 - GALLERY.z0,
    steps: 9,
    rise: WH.deck / 9,
    run: (STAIR_FOOT - GALLERY.x) / 9,
    style: { colors: ['#8a9096'], variance: 0 },
    surface: 'metal' as const
  }));

export const WAREHOUSE: Element<Record<string, never>> = {
  colliders: () => [
    ...parts().map((p) => box(p.min, p.max, p.kind === 'office' || p.kind === 'parapet' ? 'stone' : 'metal', { walk: p.kind === 'deck' })),
    ...stairs().flatMap((s) => METAL_STAIRS.colliders!(s))
  ],
  nav: () => {
    const out: Vec3[] = [];
    const mid = (END_DOOR[0] + END_DOOR[1]) / 2;
    for (const s of [-1, 1]) {
      out.push([s * (WH.x1 + 1.4), 0, mid], [s * (WH.x1 - 1.4), 0, mid]);
      out.push([s * 6.0, WH.deck, (GALLERY.z0 + GALLERY.z1) / 2], [s * 12.0, WH.deck, (GALLERY.z0 + GALLERY.z1) / 2]);
    }
    for (const s of stairs()) out.push(...METAL_STAIRS.nav!(s));
    return out;
  },
  draw(d) {
    for (const p of parts()) {
      if (p.kind === 'wall') wallPanel(d, p.min, p.max);
      else if (p.kind === 'office') office(d, p.min, p.max);
      else if (p.kind === 'deck') deckPanel(d, p.min, p.max);
      else if (p.kind === 'parapet') parapet(d, p.min, p.max);
    }
    for (const s of stairs()) METAL_STAIRS.draw(d, s);
    windowFrames(d);
    doors(d);
    roof(d);
    lamps(d);
  }
};

function lamps(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const x of [-16.0, -8.0, 8.0, 16.0]) {
    for (const z of [-59.0, -50.0]) {
      t.box(x, WH.height - 1.0, z, 0.03, 1.0, 0.03, '#2f363d', 'metal', 0);
      t.cone(x, WH.height - 1.3, z, 0.5, 0.12, 0.3, '#2f363d', 'metal');
      t.cyl(x, WH.height - 1.34, z, 0.34, 0.05, '#fff1c4', 'glow');
    }
  }
}

/** Pallet rack along local x: uprights, beams and loaded shelves every 1.2 m; solid to bullets. `height` defaults to 2.6. */
export const RACK: Element<{ x: number; z: number; length: number; turns?: number; height?: number }> = {
  colliders: (p) => [new Frame(p.x, 0, p.z, p.turns ?? 0).box([-p.length / 2, 0, -0.55], [p.length / 2, p.height ?? 2.6, 0.55], 'metal')],
  draw(d, p) {
    const t = new Pen(d, new Frame(p.x, 0, p.z, p.turns ?? 0));
    const h = p.height ?? 2.6;
    const bays = Math.max(1, Math.round(p.length / 2.4));
    const bw = p.length / bays;
    const shelves = Math.max(2, Math.round((h - 0.2) / 1.2));
    for (let i = 0; i <= bays; i++) for (const z of [-0.5, 0.5]) t.box(-p.length / 2 + i * bw, 0, z, 0.1, h, 0.1, '#2f6fb5', 'metal', 0);
    for (let k = 0; k <= shelves; k++) for (const z of [-0.5, 0.5]) t.box(0, k === shelves ? h - 0.15 : 0.1 + k * 1.2, z, p.length, 0.12, 0.08, '#f05a1a', 'metal', 0);
    // A back panel down the middle: a rack is solid to bullets, so it must not look see-through.
    t.box(0, 0.1, 0, p.length - 0.1, h - 0.25, 0.04, '#3a4046', 'metal', 0);
    const boxes = ['#c9a26e', '#d6b07a', '#b98a5a', '#e3d3a8'];
    for (let i = 0; i < bays; i++) {
      for (let k = 0; k < shelves; k++) {
        const x = -p.length / 2 + (i + 0.5) * bw;
        const y = 0.22 + k * 1.2;
        t.box(x, y - 0.1, 0, bw - 0.3, 0.1, 0.9, '#a67c52', undefined, 0);
        if ((i + k) % 3 === 2) continue;
        t.box(x, y, 0, bw - 0.5, d.detail === 0 ? 0.8 : 0.5 + ((i * 7 + k * 3) % 4) * 0.1, 0.8, boxes[(i + k) % 4]!, undefined, 0.02);
      }
    }
  }
};

function wallPanel(d: Drawer, min: Vec3, max: Vec3) {
  const baseTop = Math.min(max[1], 1.44);
  if (min[1] < 1.44) drawBlock(d, { min, max: [max[0], baseTop, max[2]], surface: 'stone', style: BASE, top: max[1] > 1.44 ? 'none' : 'tiles', topColor: '#7c8389' });
  const y0 = Math.max(min[1], 1.44);
  if (max[1] > y0) d.siding.box([min[0], y0, min[2]], max, SIDING);
}

/** The foreman's office: brick walls with a window and a door on each long side, a flat sheet roof. */
function office(d: Drawer, min: Vec3, max: Vec3) {
  const t = new Pen(d, new Frame(0, 0, 0));
  drawBlock(d, { min, max: [max[0], max[1] - 0.12, max[2]], surface: 'stone', style: BASE, top: 'none' });
  t.span(min[0] - 0.1, max[1] - 0.12, min[2] - 0.1, max[0] + 0.1, max[1], max[2] + 0.1, '#7c8389', 'metal', 0);
  for (const sx of [-1, 1]) {
    const x = sx * (max[0] + 0.03);
    t.box(x, 1.1, (min[2] + max[2]) / 2 - 1.6, 0.05, 1.2, 2.0, '#e9e6dc', undefined, 0);
    t.box(x + sx * 0.02, 1.2, (min[2] + max[2]) / 2 - 1.6, 0.04, 1.0, 1.8, '#26323a', 'glass', 0);
    t.box(x, 0, (min[2] + max[2]) / 2 + 1.8, 0.05, 2.2, 1.1, '#2f7fbf', 'metal', 0);
  }
}

function deckPanel(d: Drawer, min: Vec3, max: Vec3) {
  const t = new Pen(d, new Frame(0, 0, 0));
  t.span(min[0], min[1], min[2], max[0], max[1], max[2], '#737a81', undefined, 0.01);
  const top = max[1] + 0.006;
  d.ground.push({ x0: min[0], z0: min[2], x1: max[0], z1: max[2], y: top, base: top, color: '#a39a8b' });
  for (const x of [-14.0, -3.0, 3.0, 14.0]) t.beam(x, 2.8, max[2], x, min[1], min[2] + 0.1, 0.12, '#4a5259', 'metal');
}

/** The gallery's hall-side parapet: solid, yellow-capped, so the gallery watches the square only. */
function parapet(d: Drawer, min: Vec3, max: Vec3) {
  const t = new Pen(d, new Frame(0, 0, 0));
  t.span(min[0], min[1], min[2], max[0], max[1] - 0.08, max[2], '#8a9096', 'metal', 0);
  t.span(min[0] - 0.02, max[1] - 0.08, min[2] - 0.02, max[0] + 0.02, max[1], max[2] + 0.02, RAIL, 'metal', 0);
  if (d.detail === 0) return;
  for (let x = min[0] + 1.2; x < max[0]; x += 2.4) t.span(x - 0.04, min[1], min[2] - 0.03, x + 0.04, max[1] - 0.08, min[2], '#6c7178', 'metal', 0);
}

/** Dark frames round the gallery windows on both faces of the front wall. */
function windowFrames(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { sill, lintel } = GALLERY;
  for (const c of WINDOWS) {
    for (const z of [WH.z1 + 0.03, WH.z1 - WH.wall - 0.03]) {
      t.box(c, sill - 0.12, z, WIN_W + 0.24, 0.12, 0.06, '#2f363d', 'metal', 0);
      t.box(c, lintel, z, WIN_W + 0.24, 0.12, 0.06, '#2f363d', 'metal', 0);
      for (const s of [-1, 1]) t.box(c + s * (WIN_W / 2 + 0.06), sill, z, 0.12, lintel - sill, 0.06, '#2f363d', 'metal', 0);
    }
  }
}

/** Roller doors rolled up: the drum box and yellow guide rails frame each opening. */
function doors(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const frame = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const alongX = x1 - x0 > z1 - z0;
    const [a, b] = alongX ? [x0, x1] : [z0, z1];
    const c = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const at = (u: number, w: number, dd: number, y: number, hh: number, color: string) =>
      alongX ? t.box(u, y, c, w, hh, dd, color, 'metal', 0.01) : t.box(c, y, u, dd, hh, w, color, 'metal', 0.01);
    at((a + b) / 2, b - a + 0.3, 0.7, h, 0.55, '#4a5259');
    for (const u of [a + 0.06, b - 0.06]) at(u, 0.12, 0.6, 0, h, RAIL);
  };
  for (const x of [WH.x0, WH.x1 - WH.wall]) frame(x, END_DOOR[0], x + WH.wall, END_DOOR[1], END_H);
}

/** Steel beams under the ceiling every 4.8 m and a spine girder; the gable roof over them. Nobody stands up there. */
function roof(d: Drawer) {
  const { x0, x1, z0, z1, height: H, wall } = WH;
  const t = new Pen(d, new Frame(0, 0, 0));
  const finish = d.detail === 0 ? 'rubber' : 'metal';
  for (let x = x0 + 4.8; x < x1 - 1; x += 4.8) t.span(x - 0.1, H - 0.34, z0 + wall, x + 0.1, H, z1 - wall, '#4a5259', finish, 0);
  t.span(x0 + wall, H - 0.26, (z0 + z1) / 2 - 0.1, x1 - wall, H, (z0 + z1) / 2 + 0.1, '#4a5259', finish, 0);
  const r = new Pen(d, new Frame((x0 + x1) / 2, H, (z0 + z1) / 2));
  const D = z1 - z0 + 0.6;
  const L = x1 - x0 + 0.6;
  r.prism('wh3-roof', [[-D / 2, 0], [D / 2, 0], [0, 2.8]], L, 0, 0, 0, '#9aa1a8', 'metal');
  r.box(0, 2.7, 0, L + 0.1, 0.2, 0.4, '#7c8389', 'metal', 0.02);
  if (d.detail === 0) return;
  const n = Math.round(L / 4.8);
  for (let i = 0; i <= n; i++) r.prism('wh3-rib', [[-D / 2 - 0.02, 0.02], [D / 2 + 0.02, 0.02], [0, 2.86]], 0.1, -L / 2 + (i * L) / n, 0, 0, '#b7bcc2', 'metal');
}

/** Steel stair: solid step colliders, drawn as treads between closed side plates. */
export const METAL_STAIRS: Element<StairParams> = {
  colliders: STAIRS.colliders,
  nav: STAIRS.nav,
  draw(d, p) {
    const sideways = p.dir === 'e' || p.dir === 'w';
    const sgn = p.dir === 'e' || p.dir === 's' ? 1 : -1;
    const len = p.steps * p.run;
    const top = p.steps * p.rise;
    const f = new Frame(p.x, p.y0, p.z, sideways ? (sgn > 0 ? 0 : 2) : sgn > 0 ? 3 : 1);
    const t = new Pen(d, f);
    // Treads span between the stringers' inner faces and close onto riser plates: no tread ends poking through
    // the stringers, no slots between treads to sparkle at a distance.
    const inner = p.width - 0.14;
    for (let i = 0; i < p.steps; i++) {
      t.box((i + 0.5) * p.run, (i + 1) * p.rise - 0.08, 0, p.run, 0.08, inner, '#a39a8b', undefined, 0);
      t.box(i * p.run + 0.015, i * p.rise, 0, 0.03, p.rise - 0.08, inner, '#545c63', 'metal', 0);
    }
    for (const z of [-p.width / 2 + 0.04, p.width / 2 - 0.04]) {
      const lip = 0.1;
      const plate: [number, number][] = [[0, 0], [len, 0], [len, top], [len - p.run, top + lip], [0, p.rise + lip]];
      t.prism(`stringer2:${p.steps}:${p.run}:${p.rise}`, plate, 0.06, 0, 0, z, '#545c63', 'metal', Math.PI / 2);
      t.beam(0.1, p.rise + 0.9, z, len - 0.1, top + 0.9, z, 0.06, RAIL, 'metal');
      t.box(0.1, p.rise, z, 0.05, 0.92, 0.05, RAIL, 'metal', 0);
      t.box(len - 0.1, top, z, 0.05, 0.92, 0.05, RAIL, 'metal', 0);
    }
  }
};

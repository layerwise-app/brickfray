import { drawBlock, STAIRS, type Masonry, type StairParams } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, shade, type Vec3 } from './util';

/**
 * Harbor warehouse: corrugated walls on a brick base, end doors for the
 * north lane, a mezzanine along the north wall, a catwalk across to a south
 * gallery with open windows over the container yard.
 */
export const WH = { x0: -14.4, x1: 14.4, z0: -28.0, z1: -14.4, wall: 0.4, height: 7.2, deck: 3.36 } as const;
const DOOR_Z: [number, number] = [-20.0, -15.6];
const SOUTH_DOORS: [number, number][] = [[-9.6, -6.4], [6.4, 9.6]];
const WINDOWS = [-11.2, -7.2, -3.2, 3.2, 7.2, 11.2];
const BASE: Masonry = { colors: ['#9a5a43', '#8a4f3a', '#a8664c'], variance: 0.3 };
const SIDING = '#2f7f7a';
const RAIL = '#f6c624';

interface Part {
  min: Vec3;
  max: Vec3;
  kind: 'wall' | 'deck' | 'landing' | 'rail' | 'post' | 'roof';
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
    for (const [a, b] of wallSpans(z0 + t, z1, [DOOR_Z])) w([x, 0, a], [x + t, H, b]);
    w([x, 4.4, DOOR_Z[0]], [x + t, H, DOOR_Z[1]]);
  }
  const wins = WINDOWS.map((c) => [c - 0.8, c + 0.8] as [number, number]);
  for (const [a, b] of wallSpans(x0 + t, x1 - t, SOUTH_DOORS)) w([a, 0, z1 - t], [b, deck + 0.64, z1]);
  for (const [a, b] of SOUTH_DOORS) w([a, 3.6, z1 - t], [b, deck + 0.64, z1]);
  for (const [a, b] of wallSpans(x0 + t, x1 - t, wins)) w([a, deck + 0.64, z1 - t], [b, deck + 2.24, z1]);
  w([x0 + t, deck + 2.24, z1 - t], [x1 - t, H, z1]);
  const d = (min: Vec3, max: Vec3) => out.push({ min, max, kind: 'deck' });
  d([x0 + t, deck - 0.16, z0 + t], [x1 - t, deck, -25.2]);
  d([-1.2, deck - 0.16, -25.2], [1.2, deck, -16.4]);
  d([x0 + t, deck - 0.16, -16.4], [x1 - t, deck, z1 - t]);
  for (const s of [-1, 1]) out.push({ min: [s > 0 ? 10.4 : -12.0, 0, -25.2], max: [s > 0 ? 12.0 : -10.4, deck, -23.6], kind: 'landing' });
  const r = (min: Vec3, max: Vec3) => out.push({ min, max, kind: 'rail' });
  for (const [a, b] of [[x0 + t, -12.0], [-9.6, -1.2], [1.2, 9.6], [12.0, x1 - t]] as const) r([a, deck, -25.3], [b, deck + 1.0, -25.2]);
  for (const s of [-1, 1]) r([s * 1.2 - (s > 0 ? 0 : 0.1), deck, -25.2], [s * 1.2 + (s > 0 ? 0.1 : 0), deck + 1.0, -16.4]);
  for (const [a, b] of [[x0 + t, -1.2], [1.2, x1 - t]] as const) r([a, deck, -16.5], [b, deck + 1.0, -16.4]);
  for (const x of [-9.6, -4.8, 4.8, 9.6]) out.push({ min: [x - 0.12, 0, -25.4], max: [x + 0.12, deck - 0.16, -25.2], kind: 'post' });
  for (const x of [-6.4, 6.4]) out.push({ min: [x - 0.12, 0, -16.6], max: [x + 0.12, deck - 0.16, -16.4], kind: 'post' });
  for (const x of [-1.0, 1.0]) out.push({ min: [x - 0.1, 0, -20.9], max: [x + 0.1, deck - 0.16, -20.7], kind: 'post' });
  out.push({ min: [x0 - 0.3, H, z0 - 0.3], max: [x1 + 0.3, H + 2.6, z1 + 0.3], kind: 'roof' });
  return out;
}

export const WAREHOUSE: Element<Record<string, never>> = {
  colliders: () =>
    parts().map((p) =>
      box(p.min, p.max, 'metal', { walk: p.kind === 'deck' || p.kind === 'landing', bulletsPass: p.kind === 'rail' })
    ),
  nav: () => [
    [-15.6, 0, -17.8],
    [15.6, 0, -17.8],
    [-13.2, 0, -17.8],
    [13.2, 0, -17.8],
    [-8.0, 0, -13.6],
    [8.0, 0, -13.6],
    [-8.0, 0, -15.6],
    [8.0, 0, -15.6],
    [0, WH.deck, -20.8]
  ],
  draw(d) {
    for (const p of parts()) {
      if (p.kind === 'wall') wallPanel(d, p.min, p.max);
      else if (p.kind === 'deck') deckPanel(d, p.min, p.max);
      else if (p.kind === 'landing') landing(d, p.min, p.max);
      else if (p.kind === 'post') new Pen(d, new Frame(0, 0, 0)).span(p.min[0], p.min[1], p.min[2], p.max[0], p.max[1], p.max[2], '#545c63', 'metal');
    }
    railings(d);
    roof(d);
    lamps(d);
  }
};

function lamps(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const x of [-9.6, 0, 9.6]) {
    for (const z of [-22.4, -18.4]) {
      t.box(x, WH.height - 0.9, z, 0.03, 0.9, 0.03, '#2f363d', 'metal', 0);
      t.cone(x, WH.height - 1.2, z, 0.45, 0.12, 0.3, '#2f363d', 'metal');
      t.cyl(x, WH.height - 1.24, z, 0.3, 0.05, '#fff1c4', 'glow');
    }
  }
}

/** Pallet rack along local x: uprights, beams and loaded shelves; solid to bullets. */
export const RACK: Element<{ x: number; z: number; length: number; turns?: number }> = {
  colliders: (p) => [new Frame(p.x, 0, p.z, p.turns ?? 0).box([-p.length / 2, 0, -0.55], [p.length / 2, 2.6, 0.55], 'metal')],
  draw(d, p) {
    const t = new Pen(d, new Frame(p.x, 0, p.z, p.turns ?? 0));
    const bays = Math.max(1, Math.round(p.length / 2.4));
    const bw = p.length / bays;
    for (let i = 0; i <= bays; i++) for (const z of [-0.5, 0.5]) t.box(-p.length / 2 + i * bw, 0, z, 0.1, 2.6, 0.1, '#2f6fb5', 'metal', 0);
    for (const y of [0.1, 1.3, 2.45]) for (const z of [-0.5, 0.5]) t.box(0, y, z, p.length, 0.12, 0.08, '#f05a1a', 'metal', 0);
    const boxes = ['#c9a26e', '#d6b07a', '#b98a5a', '#e3d3a8'];
    for (let i = 0; i < bays; i++) {
      for (const [k, y] of [[0, 0.22], [1, 1.42]] as const) {
        if ((i + k) % 3 === 2) continue;
        const x = -p.length / 2 + (i + 0.5) * bw;
        t.box(x, y - 0.1, 0, bw - 0.3, 0.1, 0.9, '#a67c52', undefined, 0);
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

function landing(d: Drawer, min: Vec3, max: Vec3) {
  const t = new Pen(d, new Frame(0, 0, 0));
  t.span(min[0] + 0.05, 0, min[2] + 0.05, max[0] - 0.05, max[1] - 0.16, max[2] - 0.05, '#545c63', 'metal', 0.02);
  deckPanel(d, [min[0], max[1] - 0.16, min[2]], max);
  if (d.detail === 0) return;
  for (const y of [0.9, 1.9]) t.span(min[0], y, min[2] - 0.02, max[0], y + 0.08, max[2] + 0.02, '#f6c624', 'metal', 0);
}

function deckPanel(d: Drawer, min: Vec3, max: Vec3) {
  const t = new Pen(d, new Frame(0, 0, 0));
  t.span(min[0], min[1], min[2], max[0], max[1], max[2], '#737a81', undefined, 0.01);
  const top = max[1] + 0.006;
  d.ground.push({ x0: min[0], z0: min[2], x1: max[0], z1: max[2], y: top, base: top, color: '#a39a8b' });
  if (d.detail === 0) return;
  const alongX = max[0] - min[0] > max[2] - min[2];
  t.span(min[0], min[1] - 0.2, alongX ? min[2] : (min[2] + max[2]) / 2 - 0.08, max[0], min[1], alongX ? min[2] + 0.16 : (min[2] + max[2]) / 2 + 0.08, '#f6c624', 'metal', 0);
  if (alongX) t.span(min[0], min[1] - 0.2, max[2] - 0.16, max[0], min[1], max[2], '#f6c624', 'metal', 0);
}

function railings(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  for (const p of parts()) {
    if (p.kind !== 'rail') continue;
    const alongX = p.max[0] - p.min[0] > p.max[2] - p.min[2];
    const len = alongX ? p.max[0] - p.min[0] : p.max[2] - p.min[2];
    const cx = (p.min[0] + p.max[0]) / 2;
    const cz = (p.min[2] + p.max[2]) / 2;
    t.box(cx, WH.deck + 0.94, cz, alongX ? len : 0.07, 0.07, alongX ? 0.07 : len, RAIL, 'metal', 0);
    t.box(cx, WH.deck + 0.5, cz, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, RAIL, 'metal', 0);
    const n = Math.max(1, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) {
      const u = (alongX ? p.min[0] : p.min[2]) + (i * len) / n;
      t.box(alongX ? u : cx, WH.deck, alongX ? cz : u, 0.06, 1.0, 0.06, RAIL, 'metal', 0);
    }
  }
}

/** Steel beams under the flat ceiling: across every 4.8 m and a spine girder along, clear of the lamps. */
function trusses(d: Drawer) {
  const { x0, x1, z0, z1, wall, height: H } = WH;
  const t = new Pen(d, new Frame(0, 0, 0));
  const steel = '#4a5259';
  const finish = d.detail === 0 ? 'rubber' : 'metal';
  for (const x of [-12, -7.2, -2.4, 2.4, 7.2, 12]) t.span(x - 0.1, H - 0.34, z0 + wall, x + 0.1, H, z1 - wall, steel, finish, 0);
  t.span(x0 + wall, H - 0.26, (z0 + z1) / 2 - 0.1, x1 - wall, H, (z0 + z1) / 2 + 0.1, steel, finish, 0);
}

function roof(d: Drawer) {
  const { x0, x1, z0, z1, height: H } = WH;
  trusses(d);
  const t = new Pen(d, new Frame((x0 + x1) / 2, H, (z0 + z1) / 2));
  const D = z1 - z0 + 0.6;
  const L = x1 - x0 + 0.6;
  t.prism('wh-roof', [[-D / 2, 0], [D / 2, 0], [0, 2.6]], L, 0, 0, 0, '#9aa1a8', 'metal');
  if (d.detail > 0) {
    const n = Math.round(L / (d.detail === 2 ? 0.8 : 1.6));
    for (let i = 0; i <= n; i++) t.prism('wh-rib', [[-D / 2 - 0.02, 0.02], [D / 2 + 0.02, 0.02], [0, 2.66]], 0.08, -L / 2 + (i * L) / n, 0, 0, '#b7bcc2', 'metal');
    t.box(0, 2.5, 0, L + 0.1, 0.2, 0.4, '#7c8389', 'metal', 0.02);
    for (const x of [-8, 0, 8]) {
      t.box(x, 1.2, -1.6, 1.4, 1.2, 1.2, '#b7bcc2', 'metal', 0.03);
      t.cyl(x, 2.4, -1.6, 0.4, 0.3, '#545c63', 'metal');
    }
  }
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


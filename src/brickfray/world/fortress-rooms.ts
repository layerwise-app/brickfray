import { DECAL } from './blocks';
import { HALL_TABLE, HIGH_TABLE } from './fortress-north';
import { F, type Works } from './fortress-plan';
import { GLAZING } from './fortress-trim';
import { LOFT } from './fortress-west';
import { K, KEEP_TABLES } from './keep';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { box, Frame, Rng, type PlanCollider } from './util';

/**
 * The three halls dressed as rooms: a boarded ceiling on dark beams, oak panelling below limewash, tapestries,
 * candle beams and furniture that says what each room is (the lord's table under its cloth of estate in the great hall,
 * choir stalls, altar and painted glass in the chapel, a carpet round the keep's hearth); the stables get a boarded
 * ceiling too. Darker than the yards, so the doors and windows read as lit openings. Only the choir stalls collide; they
 * stand against the walls, off every route.
 */
export function fortressRooms(p: Plan, w: Works) {
  p.add(ROOMS, w);
  const rug = (x0: number, z0: number, x1: number, z1: number, color: string, y: number) =>
    p.add(DECAL, { x0, z0, x1, z1, y, color, surface: 'plastic', smooth: true, matte: true });
  const carpet = (x0: number, z0: number, x1: number, z1: number) => {
    rug(x0 - 0.16, z0 - 0.16, x1 + 0.16, z1 + 0.16, GOLD, 0.004);
    rug(x0, z0, x1, z1, CRIMSON, 0.006);
  };
  carpet(-3.6, -3.6, 3.6, 3.6);
  carpet(1.6, -8.8, 3.2, -3.76);
  carpet(-3.2, 3.76, -1.6, 8.8);
  carpet(-8.8, 1.6, -3.76, 3.2);
  carpet(3.76, -3.2, 8.8, -1.6);
  carpet(-1.6, -34.8, 0.64, -31.6);
  carpet(3.2, -35.6, 13.4, -34.8);
}

const HALL = { x0: -20.0, z0: F.hall + 0.8, x1: 1.6, z1: F.bandN - 0.8, ceiling: 6.4 } as const;
const CHAPEL = { x0: 2.4, z0: F.hall + 0.8, x1: 16.0, z1: F.bandN - 0.8, ceiling: 5.6 } as const;
const KEEP_IN = { x0: -K.half + K.wall, z0: -K.half + K.wall, x1: K.half - K.wall, z1: K.half - K.wall, ceiling: K.roof - K.slab } as const;
/** Choir stalls against the chapel's north and south walls: [x0, x1]. */
const STALLS = { north: [8.4, 13.2], south: [6.8, 10.8] } as const;

const OAK_DARK = '#46301f';
const OAK = '#5e3f27';
const OAK_LIGHT = '#7a5434';
const BOARDS = '#3c2a1c';
const IRON = '#2e3236';
const GOLD = '#c99a3e';
const CRIMSON = '#8a2a22';
const WAX = '#f2ead2';
const FLAME = '#ffd27a';
const DAYLIGHT = '#fff1d6';
const LAMPLIGHT = '#ffb868';

/** A wall face seen from inside a room: along x at z = `at` or along z at x = `at`, the room on its `dir` side. */
interface Face {
  alongX: boolean;
  at: number;
  dir: 1 | -1;
  a0: number;
  a1: number;
  top: number;
}
/** A hole in a face to leave bare: [a0, a1, y0, y1]. */
type Hole = [number, number, number, number];

const ROOMS: Element<Works> = {
  colliders: () => [
    stallBox(CHAPEL.z0, 1, STALLS.north),
    stallBox(CHAPEL.z1, -1, STALLS.south)
  ],
  draw(d, w) {
    const t = new Pen(d, new Frame(0, 0, 0, 0));
    greatHall(d, t, w);
    chapel(d, t, w);
    keepHall(d, t);
    stables(d, t);
  }
};

/** The stables: boards under the roof, beams over the stalls, joists under the hay loft. */
function stables(d: Drawer, t: Pen) {
  const [x0, x1, z0, z1] = [F.west, -34.4, -8.0, 8.0];
  // Beams only past the loft's edge: over the loft they would hang at head height.
  ceiling(d, t, { x0, z0, x1: LOFT.x1, z1, ceiling: F.inner }, BOARDS, null);
  ceiling(d, t, { x0: LOFT.x1, z0, x1, z1, ceiling: F.inner });
  const y = LOFT.top - 0.24;
  for (let x = x0 + 0.6; x < LOFT.x1; x += 1.2) t.span(x - 0.1, y - 0.22, z0, x + 0.1, y, x > LOFT.x1 - 1.6 ? 1.6 : z1, OAK, undefined, 0);
}

function stallBox(at: number, dir: 1 | -1, [a0, a1]: readonly [number, number]): PlanCollider {
  return box([a0, 0, at], [a1, 0.96, at + dir * 0.8], 'wood');
}

const faces = (r: { x0: number; z0: number; x1: number; z1: number; ceiling: number }): Face[] => [
  { alongX: true, at: r.z0, dir: 1, a0: r.x0, a1: r.x1, top: r.ceiling },
  { alongX: true, at: r.z1, dir: -1, a0: r.x0, a1: r.x1, top: r.ceiling },
  { alongX: false, at: r.x0, dir: 1, a0: r.z0, a1: r.z1, top: r.ceiling },
  { alongX: false, at: r.x1, dir: -1, a0: r.z0, a1: r.z1, top: r.ceiling }
];

/** Doors and windows the works left in this face, and the lancets drawn on it. */
function holesIn(f: Face, w: Works): Hole[] {
  const out: Hole[] = [];
  for (const o of w.openings) {
    if (o.alongX === f.alongX && (Math.abs(o.c0 - f.at) < 0.01 || Math.abs(o.c1 - f.at) < 0.01)) out.push([o.a0, o.a1, o.y0, o.y1]);
  }
  if (f.alongX && (Math.abs(f.at - HALL.z0) < 0.01 || Math.abs(f.at - HALL.z1) < 0.01)) {
    for (const [u, sill, head] of GLAZING) if (u > f.a0 && u < f.a1) out.push([u - 0.52, u + 0.52, sill - 0.22, head + 0.24]);
  }
  return out;
}

/** A box on a face: along a0..a1, up y0..y1, out from the wall d0..d1. */
function onFace(t: Pen, f: Face, a0: number, a1: number, y0: number, y1: number, d0: number, d1: number, color: string, glow = false) {
  const c0 = f.at + f.dir * d0;
  const c1 = f.at + f.dir * d1;
  const finish = glow ? 'glow' : undefined;
  if (f.alongX) t.span(a0, y0, c0, a1, y1, c1, color, finish, 0);
  else t.span(c0, y0, a0, c1, y1, a1, color, finish, 0);
}

/** Covers a band of a face, leaving its holes bare. */
function cover(t: Pen, f: Face, y0: number, y1: number, holes: Hole[], d0: number, d1: number, color: string) {
  const cuts = [...new Set([f.a0, f.a1, ...holes.flatMap(([a, b]) => [a, b]).filter((a) => a > f.a0 && a < f.a1)])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [s, e] = [cuts[i]!, cuts[i + 1]!];
    const over = holes.filter(([a, b]) => a <= s + 0.01 && b >= e - 0.01).sort((p, q) => p[2] - q[2]);
    let y = y0;
    for (const [, , h0, h1] of over) {
      if (h0 > y + 0.02) onFace(t, f, s, e, y, Math.min(h0, y1), d0, d1, color);
      y = Math.max(y, h1);
      if (y >= y1) break;
    }
    if (y1 > y + 0.02) onFace(t, f, s, e, y, y1, d0, d1, color);
  }
}

/** Oak panelling to shoulder height with a moulded rail and stiles, limewash above it, a painted band. */
function panelling(t: Pen, f: Face, holes: Hole[], wash?: string, band?: string) {
  cover(t, f, 0, 1.44, holes, 0, 0.05, OAK_DARK);
  cover(t, f, 1.44, 1.58, holes, 0, 0.09, OAK);
  if (t.detail > 0) {
    for (let a = f.a0 + 0.6; a < f.a1 - 0.3; a += 1.2) {
      if (holes.some(([h0, h1, y0]) => y0 < 1.44 && a > h0 - 0.1 && a < h1 + 0.1)) continue;
      onFace(t, f, a - 0.04, a + 0.04, 0.1, 1.44, 0.05, 0.07, OAK);
    }
  }
  if (wash) cover(t, f, 1.58, f.top, holes, 0, 0.03, wash);
  if (band) cover(t, f, 2.96, 3.16, holes, 0.03, 0.05, band);
}

/** Wall hanging on an iron rod: a field, a border, a stepped lozenge and a fringe. */
function tapestry(t: Pen, f: Face, a: number, y0: number, width: number, height: number, [field, trim, dark]: string[]) {
  const [a0, a1, y1] = [a - width / 2, a + width / 2, y0 + height];
  onFace(t, f, a0, a1, y0, y1, 0.04, 0.07, field);
  onFace(t, f, a0, a1, y1 - 0.16, y1 - 0.08, 0.07, 0.08, trim);
  onFace(t, f, a0, a1, y0 + 0.1, y0 + 0.18, 0.07, 0.08, trim);
  for (const s of [a0 + 0.1, a1 - 0.18]) onFace(t, f, s, s + 0.08, y0 + 0.1, y1 - 0.08, 0.07, 0.08, trim);
  const cy = y0 + height * 0.52;
  for (const [k, half] of [0.18, 0.42, 0.62, 0.42, 0.18].entries()) {
    const y = cy + (k - 2.5) * 0.2;
    onFace(t, f, a - half, a + half, y, y + 0.2, 0.07, 0.085, trim);
    if (half > 0.2) onFace(t, f, a - half + 0.16, a + half - 0.16, y + 0.04, y + 0.16, 0.085, 0.095, dark);
  }
  onFace(t, f, a0 - 0.14, a1 + 0.14, y1, y1 + 0.06, 0.06, 0.12, IRON);
  if (t.detail > 0) for (let s = a0 + 0.08; s < a1 - 0.05; s += 0.2) onFace(t, f, s, s + 0.07, y0 - 0.12, y0, 0.05, 0.07, trim);
}

/** Boards under the roof on beams every 2.4 m across the short span; `paint` tints the boards, `stars` dots them. */
function ceiling(d: Drawer, t: Pen, r: { x0: number; z0: number; x1: number; z1: number; ceiling: number }, paint = BOARDS, beam: string | null = OAK, stars = 0) {
  const y = r.ceiling;
  t.span(r.x0, y - 0.06, r.z0, r.x1, y, r.z1, paint, undefined, 0);
  if (!beam) return;
  const alongZ = r.x1 - r.x0 >= r.z1 - r.z0;
  const [a0, a1] = alongZ ? [r.x0, r.x1] : [r.z0, r.z1];
  for (let a = a0 + 1.2; a < a1 - 0.4; a += 2.4) {
    if (alongZ) t.span(a - 0.14, y - 0.44, r.z0, a + 0.14, y - 0.06, r.z1, beam, undefined, 0);
    else t.span(r.x0, y - 0.44, a - 0.14, r.x1, y - 0.06, a + 0.14, beam, undefined, 0);
  }
  if (!stars) return;
  const rng = new Rng(31);
  for (let i = 0; i < (d.detail === 0 ? stars / 2 : stars); i++) {
    const [x, z] = [rng.range(r.x0 + 0.3, r.x1 - 0.3), rng.range(r.z0 + 0.3, r.z1 - 0.3)];
    t.span(x - 0.06, y - 0.075, z - 0.06, x + 0.06, y - 0.06, z + 0.06, '#e8c060', 'glow', 0);
  }
}

/** Candle beam: two crossed oak bars hung from the ceiling on a chain, a candle at each end and on each arm. */
function candleBeam(d: Drawer, t: Pen, x: number, z: number, y: number, top: number, clip: [number, number, number, number]) {
  const r = 0.8;
  t.span(x - 0.025, y + 0.06, z - 0.025, x + 0.025, top, z + 0.025, IRON, 'metal', 0);
  t.span(x - r, y, z - 0.05, x + r, y + 0.1, z + 0.05, OAK, undefined, 0);
  t.span(x - 0.05, y, z - r, x + 0.05, y + 0.1, z + r, OAK, undefined, 0);
  const arms = d.detail === 0 ? [r] : [r, r * 0.5];
  for (const k of arms) {
    for (const [dx, dz] of [[k, 0], [-k, 0], [0, k], [0, -k]] as const) {
      t.span(x + dx - 0.035, y + 0.1, z + dz - 0.035, x + dx + 0.035, y + 0.28, z + dz + 0.035, WAX, undefined, 0);
      t.span(x + dx - 0.025, y + 0.28, z + dz - 0.025, x + dx + 0.025, y + 0.37, z + dz + 0.025, FLAME, 'glow', 0);
    }
  }
  d.anim.pools.add(x, z, 0.006, 3.2, LAMPLIGHT, 0.3, clip);
}

/** Daylight spilling in through a door onto the floor inside. */
function spill(d: Drawer, f: Face, a: number, clip: [number, number, number, number]) {
  const c = f.at + f.dir * 1.0;
  if (f.alongX) d.anim.pools.add(a, c, 0.006, 2.2, DAYLIGHT, 0.22, clip);
  else d.anim.pools.add(c, a, 0.006, 2.2, DAYLIGHT, 0.22, clip);
}

/** Leaded panes glowing on the inside of a lancet: daylight in the hall, coloured glass in the chapel. */
function panes(t: Pen, f: Face, u: number, sill: number, head: number, colors: string[], rng: Rng) {
  for (let y = sill + 0.06; y < head - 0.1; y += 0.4) {
    for (const s of [-1, 1]) {
      const a = u + s * 0.14;
      onFace(t, f, a - 0.12, a + 0.12, y, Math.min(y + 0.36, head - 0.06), 0.045, 0.06, rng.pick(colors), true);
    }
  }
}

const clipOf = (r: { x0: number; z0: number; x1: number; z1: number }): [number, number, number, number] => [r.x0, r.z0, r.x1, r.z1];

function greatHall(d: Drawer, t: Pen, w: Works) {
  const clip = clipOf(HALL);
  const [north, south, west, east] = faces(HALL);
  for (const f of [north!, south!, west!, east!]) panelling(t, f, holesIn(f, w), '#a9764f', '#6e2a1f');
  ceiling(d, t, HALL);
  // Boards and joists under the gallery.
  const g = { x0: HALL.x0, z0: HALL.z0, x1: -13.6, z1: HALL.z1, ceiling: F.storey - F.slab };
  t.span(g.x0, g.ceiling - 0.05, g.z0, g.x1, g.ceiling, g.z1, BOARDS, undefined, 0);
  for (let z = g.z0 + 0.6; z < g.z1; z += 1.2) t.span(g.x0, g.ceiling - 0.25, z - 0.1, g.x1, g.ceiling - 0.05, z + 0.1, OAK, undefined, 0);
  const rng = new Rng(5);
  for (const [u, sill, head] of GLAZING) {
    if (u > HALL.x1) continue;
    for (const f of [north!, south!]) panes(t, f, u, sill, head, ['#e9f1f2', '#d8e6ea', '#f4efdc'], rng);
  }
  for (const x of [-10.0, -1.6]) candleBeam(d, t, x, -32.4, 4.2, HALL.ceiling - 0.06, clip);
  tapestry(t, north!, -3.0, 1.9, 2.0, 2.4, ['#8e2219', '#d9a53a', '#5a140f']);
  tapestry(t, south!, -6.4, 1.9, 2.0, 2.4, ['#1f3f7a', '#e0c068', '#14284f']);
  // The lord's table: cloth, plates, cups and candles; above it a cloth of estate under a canopy.
  const [hx0, hz0, hx1, hz1] = HIGH_TABLE;
  t.span(hx0 - 0.06, 0.96, hz0 - 0.06, hx1, 1.0, hz1 + 0.06, '#e6dcc2', undefined, 0);
  t.span(hx0 - 0.08, 0.5, hz0 - 0.06, hx0 - 0.04, 0.98, hz1 + 0.06, '#e6dcc2', undefined, 0);
  tapestry(t, east!, (hz0 + hz1) / 2, 1.3, 3.2, 3.0, ['#7a1712', '#e0b44a', '#c8231b']);
  onFace(t, east!, hz0 - 0.2, hz1 + 0.2, 4.5, 4.66, 0, 1.0, OAK_LIGHT);
  onFace(t, east!, hz0 - 0.2, hz1 + 0.2, 4.3, 4.5, 0.92, 1.0, '#c8231b');
  const [lx0, lz0, lx1, lz1] = HALL_TABLE;
  t.span(lx0 + 0.1, 0.96, lz0, lx1 - 0.1, 1.0, lz1 + 0.06, '#d9c9a3', undefined, 0);
  if (d.detail > 0) {
    for (let x = lx0 + 0.5; x < lx1 - 0.3; x += 0.8) t.cyl(x, 1.0, lz1 - 0.3, 0.17, 0.03, '#d9d2c3', undefined, 0, 10);
    for (let z = hz0 + 0.5; z < hz1 - 0.3; z += 0.8) {
      t.cyl(hx0 + 0.3, 1.0, z, 0.17, 0.03, '#d9d2c3', undefined, 0, 10);
      t.cyl(hx0 + 0.5, 1.0, z + 0.3, 0.05, 0.16, GOLD, 'chrome', 0, 8);
    }
    for (const x of [lx0 + 1.0, lx1 - 1.6]) t.ball(x, 1.08, lz0 + 0.4, 0.14, '#b8803e', [1.4, 0.7, 1]);
  }
  for (const [x, z] of [[lx0 + 0.3, lz0 + 0.4], [lx1 - 0.3, lz0 + 0.4], [hx0 + 0.4, hz0 + 0.3], [hx0 + 0.4, hz1 - 0.3]] as const) {
    t.span(x - 0.04, 1.0, z - 0.04, x + 0.04, 1.26, z + 0.04, WAX, undefined, 0);
    t.span(x - 0.025, 1.26, z - 0.025, x + 0.025, 1.35, z + 0.025, FLAME, 'glow', 0);
  }
  spill(d, north!, -7.2, clip);
  spill(d, south!, -16.0, clip);
  spill(d, south!, -2.4, clip);
}

function chapel(d: Drawer, t: Pen, w: Works) {
  const clip = clipOf(CHAPEL);
  const [north, south, west, east] = faces(CHAPEL);
  for (const f of [north!, south!, west!, east!]) panelling(t, f, holesIn(f, w), '#64708c', '#c99a3e');
  ceiling(d, t, CHAPEL, '#22385e', '#7a2e22', 46);
  const rng = new Rng(11);
  const glass = ['#c8231b', '#1f62c7', '#f6c624', '#2f9a4a', '#8a3fb0', '#e07a2a'];
  for (const [u, sill, head] of GLAZING) {
    if (u < CHAPEL.x0) continue;
    for (const f of [north!, south!]) {
      panes(t, f, u, sill, head, glass, rng);
      const c = f.at + f.dir * 1.6;
      d.anim.pools.add(u, c, 0.006, 1.3, rng.pick(['#ff7a5a', '#6a9cff', '#ffd36a']), 0.22, clip);
    }
  }
  for (const [f, [a0, a1]] of [[north!, STALLS.north], [south!, STALLS.south]] as const) stall(t, f, a0, a1);
  // Dossal and cross over the altar, a frontal on its nave side.
  onFace(t, east!, -34.0, -31.6, 1.4, 4.2, 0.03, 0.07, '#6e1a16');
  for (const [a0, a1, y0, y1] of [[-34.0, -31.6, 4.04, 4.2], [-34.0, -31.6, 1.4, 1.56], [-34.0, -33.84, 1.4, 4.2], [-31.76, -31.6, 1.4, 4.2]] as const) {
    onFace(t, east!, a0, a1, y0, y1, 0.07, 0.08, GOLD);
  }
  onFace(t, east!, -32.9, -32.7, 1.9, 3.8, 0.07, 0.12, GOLD);
  onFace(t, east!, -33.45, -32.15, 3.1, 3.3, 0.07, 0.12, GOLD);
  const altar: Face = { alongX: false, at: 13.6, dir: -1, a0: -34.8, a1: -30.8, top: 1.2 };
  onFace(t, altar, -34.6, -31.0, 0.08, 1.16, 0, 0.04, '#8a1f1a');
  onFace(t, altar, -32.96, -32.64, 0.08, 1.16, 0.04, 0.05, GOLD);
  onFace(t, altar, -33.4, -32.2, 0.7, 0.84, 0.04, 0.05, GOLD);
  roodScreen(t);
  spill(d, north!, 4.8, clip);
  spill(d, south!, 12.8, clip);
}

/** The screen across the middle of the chapel in dark oak: a dado, slender posts, a cornice and the rood on top. */
function roodScreen(t: Pen) {
  const [x0, z0, x1, z1, h] = [7.2, -33.6, 11.2, -32.0, 3.2];
  const sides: Face[] = [
    { alongX: true, at: z0, dir: -1, a0: x0, a1: x1, top: h },
    { alongX: true, at: z1, dir: 1, a0: x0, a1: x1, top: h },
    { alongX: false, at: x0, dir: -1, a0: z0, a1: z1, top: h },
    { alongX: false, at: x1, dir: 1, a0: z0, a1: z1, top: h }
  ];
  for (const f of sides) {
    onFace(t, f, f.a0, f.a1, 0, h, 0, 0.03, OAK_DARK);
    onFace(t, f, f.a0, f.a1, 0.96, 1.08, 0.03, 0.08, OAK);
    onFace(t, f, f.a0, f.a1, 2.9, 3.2, 0.03, 0.12, OAK);
    onFace(t, f, f.a0, f.a1, 3.14, 3.2, 0.12, 0.14, GOLD);
    if (f.alongX) for (let a = f.a0 + 0.2; a < f.a1; a += 0.4) onFace(t, f, a - 0.04, a + 0.04, 1.08, 2.9, 0.03, 0.07, OAK_LIGHT);
  }
  t.span(x0, h, z0, x1, h + 0.04, z1, OAK, undefined, 0);
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  t.span(cx - 0.08, h + 0.04, cz - 0.06, cx + 0.08, h + 1.3, cz + 0.06, GOLD, undefined, 0);
  t.span(cx - 0.5, h + 0.8, cz - 0.06, cx + 0.5, h + 0.94, cz + 0.06, GOLD, undefined, 0);
}

/** Choir stall against a wall: seats with arms, a high panelled back, a canopy and a desk in front. */
function stall(t: Pen, f: Face, a0: number, a1: number) {
  onFace(t, f, a0, a1, 0, 0.46, 0, 0.5, OAK);
  onFace(t, f, a0, a1, 0.46, 0.52, 0, 0.56, OAK_LIGHT);
  onFace(t, f, a0, a1, 0.52, 2.0, 0, 0.06, OAK_DARK);
  onFace(t, f, a0, a1, 2.0, 2.14, 0, 0.42, OAK);
  onFace(t, f, a0, a1, 0, 0.88, 0.7, 0.8, OAK);
  onFace(t, f, a0, a1, 0.88, 0.96, 0.6, 0.8, OAK_LIGHT);
  for (let a = a0; a <= a1 + 0.01; a += t.detail === 0 ? a1 - a0 : 0.8) onFace(t, f, Math.min(a, a1 - 0.06), Math.min(a, a1 - 0.06) + 0.06, 0.46, 0.82, 0, 0.52, OAK);
}

function keepHall(d: Drawer, t: Pen) {
  const clip = clipOf(KEEP_IN);
  const [north, south, west, east] = faces(KEEP_IN);
  const doors: [typeof north, readonly [number, number]][] = [[north, K.doorN], [south, K.doorS], [west, K.doorW], [east, K.doorE]];
  for (const [f, [a0, a1]] of doors) {
    panelling(t, f!, [[a0, a1, 0, K.doorTop]]);
    spill(d, f!, (a0 + a1) / 2, clip);
  }
  ceiling(d, t, KEEP_IN);
  for (const [x, z] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]] as const) candleBeam(d, t, x, z, 4.4, KEEP_IN.ceiling - 0.06, clip);
  tapestry(t, north!, -4.8, 2.0, 2.4, 3.0, ['#8e2219', '#d9a53a', '#5a140f']);
  tapestry(t, south!, 4.8, 2.0, 2.4, 3.0, ['#1f3f7a', '#e0c068', '#14284f']);
  tapestry(t, west!, -4.8, 2.0, 2.0, 2.8, ['#2f5a34', '#d9b45a', '#1d3a22']);
  tapestry(t, east!, 4.8, 2.0, 2.0, 2.8, ['#6a2a5a', '#d9b45a', '#3e1734']);
  for (const [x0, z0, x1, z1] of KEEP_TABLES) {
    t.span(x0 + 0.1, 0.96, z0 - 0.06, x1 - 0.1, 1.0, z1 + 0.06, '#d9c9a3', undefined, 0);
    const front = z0 < 0 ? z1 - 0.3 : z0 + 0.3;
    if (d.detail > 0) for (let x = x0 + 0.5; x < x1 - 0.3; x += 0.8) t.cyl(x, 1.0, front, 0.17, 0.03, '#d9d2c3', undefined, 0, 10);
    for (const x of [x0 + 0.4, x1 - 0.4]) {
      t.span(x - 0.04, 1.0, front - 0.04, x + 0.04, 1.26, front + 0.04, WAX, undefined, 0);
      t.span(x - 0.025, 1.26, front - 0.025, x + 0.025, 1.35, front + 0.025, FLAME, 'glow', 0);
    }
  }
}

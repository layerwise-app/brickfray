import type { Face } from './blocks';

import { CUSTOMS, PASSAGE, span } from './docks-layout';
import type { Element, Plan } from './plan';
import { Pen } from './props-kit';
import { box, Frame, shade } from './util';

export interface CustomsParams {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  wall: string;
  /** Faces with windows; faces against another piece or inside the passage are left plain. */
  faces: Face[];
  /** Face that carries the clock (toward the square), and its centre along that face. */
  clock?: { face: Face; at: number };
}

const STOREY = CUSTOMS.storey;
const TRIM = '#ece6d6';
const GLASS = '#2b3a45';

/**
 * One solid piece of the customs house, red on the west half and blue on the east: windows drawn on, one collider.
 * The house is three pieces round the clock passage (see `customsHouse`).
 */
export const CUSTOMS_HOUSE: Element<CustomsParams> = {
  colliders: (p) => [box([p.x0, 0, p.z0], [p.x1, p.height, p.z1], 'stone')],
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const { x0, x1, z0, z1, height: H } = p;
    t.span(x0, 0, z0, x1, H - 0.6, z1, p.wall, undefined, 0);
    t.span(x0 - 0.06, 0, z0 - 0.06, x1 + 0.06, 0.7, z1 + 0.06, shade(p.wall, -0.3), undefined, 0);
    t.span(x0 - 0.05, STOREY - 0.1, z0 - 0.05, x1 + 0.05, STOREY + 0.12, z1 + 0.05, TRIM, undefined, 0);
    t.span(x0 - 0.2, H - 0.6, z0 - 0.2, x1 + 0.2, H - 0.3, z1 + 0.2, TRIM, undefined, 0);
    t.span(x0, H - 0.3, z0, x1, H, z1, shade(p.wall, -0.15), undefined, 0);
    for (const face of p.faces) windows(t, p, face, d.detail);
    if (p.clock) clock(t, p, p.clock, d.detail);
  }
};

/** The first floor bridging the clock passage: the passage's ceiling, lamps, tiled floor and framed mouths. */
const ARCADE: Element<{ s: number; wall: string }> = {
  colliders(p) {
    const a = legA(p.s);
    const b = legB(p.s);
    return [box([a.x0, STOREY, a.z0], [a.x1, CUSTOMS.height, PASSAGE.b0], 'stone'), box([b.x0, STOREY, b.z0], [b.x1, CUSTOMS.height, b.z1], 'stone')];
  },
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const H = CUSTOMS.height;
    const a = legA(p.s);
    const b = legB(p.s);
    const sq = p.s < 0 ? b.x1 : b.x0;
    const out = -p.s;
    /** x range on the square face from `inside` m within the wall to `outside` m in front of it. */
    const xb = (inside: number, outside: number): [number, number] => [Math.min(sq - out * inside, sq + out * outside), Math.max(sq - out * inside, sq + out * outside)];
    for (const r of [{ ...a, z1: PASSAGE.b0 }, b]) {
      t.span(r.x0, STOREY, r.z0, r.x1, H - 0.6, r.z1, p.wall, undefined, 0);
      t.span(r.x0, STOREY - 0.02, r.z0, r.x1, STOREY + 0.02, r.z1, '#d9d2c1', undefined, 0);
      t.span(r.x0, H - 0.3, r.z0, r.x1, H, r.z1, shade(p.wall, -0.15), undefined, 0);
    }
    // Cornice and storey band across the two mouths, so the bridge reads as part of the house.
    t.span(a.x0, H - 0.6, a.z0 - 0.2, a.x1, H - 0.3, a.z0 + 0.4, TRIM, undefined, 0);
    t.span(a.x0, STOREY - 0.3, a.z0 - 0.08, a.x1, STOREY + 0.12, a.z0 + 0.3, TRIM, undefined, 0);
    const [c0, c1] = xb(0.4, 0.2);
    t.span(c0, H - 0.6, b.z0, c1, H - 0.3, b.z1, TRIM, undefined, 0);
    const [l0, l1] = xb(0.3, 0.08);
    t.span(l0, STOREY - 0.3, b.z0, l1, STOREY + 0.12, b.z1, TRIM, undefined, 0);
    // Pilasters framing each mouth.
    for (const x of [a.x0, a.x1]) t.span(x - 0.18, 0, a.z0 - 0.12, x + 0.18, STOREY - 0.3, a.z0 + 0.2, TRIM, undefined, 0);
    const [q0, q1] = xb(0.2, 0.12);
    for (const z of [b.z0, b.z1]) t.span(q0, 0, z - 0.18, q1, STOREY - 0.3, z + 0.18, TRIM, undefined, 0);
    // A first-floor window over each mouth.
    t.span(a.x0 + 1.15, STOREY + 0.7, a.z0 - 0.08, a.x1 - 1.15, STOREY + 2.3, a.z0, TRIM, undefined, 0);
    t.span(a.x0 + 1.3, STOREY + 0.8, a.z0 - 0.1, a.x1 - 1.3, STOREY + 2.2, a.z0, GLASS, undefined, 0);
    const [w0, w1] = xb(0, 0.08);
    t.span(w0, STOREY + 0.7, b.z0 + 1.15, w1, STOREY + 2.3, b.z1 - 1.15, TRIM, undefined, 0);
    const [g0, g1] = xb(0, 0.1);
    t.span(g0, STOREY + 0.8, b.z0 + 1.3, g1, STOREY + 2.2, b.z1 - 1.3, GLASS, undefined, 0);
    // Ceiling lamps and a tiled floor.
    const cx = (a.x0 + a.x1) / 2;
    for (const z of [a.z0 + 3.0, a.z0 + 8.0]) t.box(cx, STOREY - 0.12, z, 0.9, 0.1, 0.5, '#fff1c4', 'glow', 0);
    t.box((b.x0 + b.x1) / 2 + out * -1.2, STOREY - 0.12, (b.z0 + b.z1) / 2, 0.5, 0.1, 0.9, '#fff1c4', 'glow', 0);
    const tile = '#b9b2a2';
    d.ground.push({ x0: a.x0, z0: a.z0, x1: a.x1, z1: PASSAGE.b1, y: 0.004, color: tile, smooth: true, matte: true });
    d.ground.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, y: 0.004, color: tile, smooth: true, matte: true });
    if (d.detail > 0) for (let z = a.z0 + 1.2; z < PASSAGE.b1 - 0.6; z += 1.2) d.ground.push({ x0: a.x0, z0: z, x1: a.x1, z1: z + 0.06, y: 0.006, color: shade(tile, -0.15), smooth: true, matte: true });
  }
};

/** Leg A (shed road to the corner) and leg B (corner to the square) as world rectangles on side s. */
function legA(s: number) {
  const [x0, x1] = span(s, PASSAGE.a0, PASSAGE.a1);
  return { x0, x1, z0: CUSTOMS.z0, z1: PASSAGE.b1 };
}

function legB(s: number) {
  const [x0, x1] = span(s, CUSTOMS.x0, PASSAGE.a1);
  return { x0, x1, z0: PASSAGE.b0, z1: PASSAGE.b1 };
}

/**
 * The customs house on side s: the main block by the base road, the gate lodge beside the hall's end door and the clock
 * wing on the square, round the clock passage, the house's first floor bridging it.
 */
export function customsHouse(p: Plan, s: -1 | 1) {
  const wall = s < 0 ? '#a24a36' : '#46657f';
  const out: Face = s < 0 ? 'w' : 'e';
  const toSquare: Face = s < 0 ? 'e' : 'w';
  const piece = (a: number, b: number, z0: number, z1: number, faces: Face[], clockAt?: number) => {
    const [x0, x1] = span(s, a, b);
    p.add(CUSTOMS_HOUSE, { x0, x1, z0, z1, height: CUSTOMS.height, wall, faces, clock: clockAt === undefined ? undefined : { face: toSquare, at: clockAt } });
  };
  piece(PASSAGE.a1, CUSTOMS.x1, CUSTOMS.z0, CUSTOMS.z1, ['n', 's', out]);
  piece(CUSTOMS.x0, PASSAGE.a0, CUSTOMS.z0, PASSAGE.b0, ['n']);
  piece(CUSTOMS.x0, PASSAGE.a1, PASSAGE.b1, CUSTOMS.z1, ['s', toSquare], (CUSTOMS.z1 - PASSAGE.b1) / 2);
  p.add(ARCADE, { s, wall });
}

/** A point `u` along a face, `out` metres in front of it, and that face's frame. */
function onFace(p: CustomsParams, face: Face, u: number, out: number): { x: number; z: number; alongX: boolean; sign: number } {
  if (face === 'n') return { x: p.x0 + u, z: p.z0 - out, alongX: true, sign: -1 };
  if (face === 's') return { x: p.x0 + u, z: p.z1 + out, alongX: true, sign: 1 };
  if (face === 'w') return { x: p.x0 - out, z: p.z0 + u, alongX: false, sign: -1 };
  return { x: p.x1 + out, z: p.z0 + u, alongX: false, sign: 1 };
}

function panel(t: Pen, p: CustomsParams, face: Face, u: number, y: number, w: number, h: number, depth: number, color: string) {
  const at = onFace(p, face, u, depth / 2);
  if (at.alongX) t.box(at.x, y, at.z, w, h, depth, color, undefined, 0);
  else t.box(at.x, y, at.z, depth, h, w, color, undefined, 0);
}

function windows(t: Pen, p: CustomsParams, face: Face, detail: number) {
  const len = face === 'n' || face === 's' ? p.x1 - p.x0 : p.z1 - p.z0;
  const bays = Math.max(1, Math.floor((len - 1.6) / 3.2));
  const start = (len - bays * 3.2) / 2;
  for (let i = 0; i < bays; i++) {
    const u = start + (i + 0.5) * 3.2;
    if (p.clock && face === p.clock.face && Math.abs(u - p.clock.at) < 2.6) continue;
    panel(t, p, face, u, STOREY + 0.6, 1.7, 1.7, 0.06, TRIM);
    panel(t, p, face, u, STOREY + 0.7, 1.4, 1.5, 0.1, GLASS);
    const door = face === 'n' ? i % 3 === 1 : i % 4 === 2;
    if (door) {
      panel(t, p, face, u, 0, 2.6, 2.9, 0.06, TRIM);
      panel(t, p, face, u, 0, 2.3, 2.75, 0.1, face === 'n' ? '#8a9096' : shade(p.wall, -0.45));
      if (detail > 0 && face === 'n') for (let k = 1; k < 9; k++) panel(t, p, face, u, k * 0.3, 2.3, 0.03, 0.12, '#6c7178');
      continue;
    }
    panel(t, p, face, u, 1.0, 1.7, 1.6, 0.06, TRIM);
    panel(t, p, face, u, 1.1, 1.4, 1.4, 0.1, GLASS);
  }
}

/** The clock over the square: a white face with a dark rim and two hands at ten past ten, the house's landmark. */
function clock(t: Pen, p: CustomsParams, c: { face: Face; at: number }, detail: number) {
  const { face, at: u } = c;
  const y = STOREY + 1.6;
  panel(t, p, face, u, STOREY + 0.3, 3.0, 2.8, 0.08, TRIM);
  const o = onFace(p, face, u, 0.12);
  if (o.alongX) {
    t.cylZ(o.x, y, o.z, 1.15, 0.12, '#2f363d');
    t.cylZ(o.x, y, o.z + o.sign * 0.04, 1.0, 0.12, '#f7f3e8');
  } else {
    t.cylX(o.x - 0.06, y, o.z, 1.15, 0.12, '#2f363d');
    t.cylX(o.x - 0.06 + o.sign * 0.04, y, o.z, 1.0, 0.12, '#f7f3e8');
  }
  if (detail === 0) return;
  const hand = (angle: number, len: number) => {
    const tip = onFace(p, face, u + Math.cos(angle) * len, 0.2);
    const base = onFace(p, face, u, 0.2);
    t.beam(base.x, y, base.z, tip.x, y + Math.sin(angle) * len, tip.z, 0.08, '#1b1f23');
  };
  hand(Math.PI * 0.83, 0.62);
  hand(Math.PI * 0.17, 0.85);
}

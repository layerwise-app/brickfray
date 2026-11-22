import { slab } from './blocks';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { T, type Piece } from './temple-layout';
import { Frame, shade } from './util';

/**
 * The great hall's timberwork and hangings, all out of reach and drawn only: the nave's coffered ceiling on painted
 * beams, rafters under the gallery roofs, joists and bay beams under the gallery floors, and the painted boards that
 * hang over alternate bays of the nave.
 */
const GOLD = '#e0b040';
const RED = '#a83a2c';
const GREEN = '#2f6f5a';
const TEAL = '#2f6f8a';
const TIMBER = '#5a3424';
const BAYS = [-20.8, -16.8, -12.0, -7.2, -2.4, 2.4, 7.2, 12.0, 16.8, 20.8];

/** Coffered nave ceiling under the hall roof: cross beams at every column bay, purlins along the hall, gilded medallions. */
export function naveCeiling(d: Drawer) {
  const y = T.hallTop;
  const X = T.col - 0.12;
  const t = new Pen(d, new Frame(0, 0, 0));
  const rows = [-X, -X / 2, 0, X / 2, X];
  for (const x of rows) {
    t.box(x, y - 0.42, 0, 0.36, 0.42, T.hallZ * 2, GREEN, undefined, 0.02);
    if (d.detail > 0) for (const s of [-1, 1]) t.box(x + s * 0.17, y - 0.44, 0, 0.04, 0.06, T.hallZ * 2, GOLD, 'metal', 0);
  }
  for (const z of BAYS) {
    t.box(0, y - 0.66, z, X * 2 + 0.4, 0.66, 0.44, RED, undefined, 0.03);
    if (d.detail > 0) {
      t.box(0, y - 0.7, z, X * 2 + 0.3, 0.06, 0.3, GOLD, 'metal', 0);
      for (const s of [-1, 1]) t.box(0, y - 0.42, z + s * 0.23, X * 2 + 0.3, 0.12, 0.03, GREEN, undefined, 0);
    }
  }
  if (d.detail === 0) return;
  for (let i = 0; i + 1 < BAYS.length; i++) {
    const z0 = BAYS[i]! + 0.22;
    const z1 = BAYS[i + 1]! - 0.22;
    for (let k = 0; k + 1 < rows.length; k++) {
      const x0 = rows[k]! + 0.18;
      const x1 = rows[k + 1]! - 0.18;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      slab(d, [x0, y - 0.3, z0], [x1, y - 0.26, z1], (i + k) % 2 ? TEAL : shade(TEAL, -0.12));
      t.box(cx, y - 0.34, cz, x1 - x0 - 0.5, 0.04, z1 - z0 - 0.5, shade(GREEN, 0.1), undefined, 0);
      t.cyl(cx, y - 0.4, cz, Math.min(0.55, (x1 - x0) * 0.3), 0.06, GOLD, 'metal', 0, 10);
      t.cyl(cx, y - 0.42, cz, Math.min(0.3, (x1 - x0) * 0.16), 0.02, RED, undefined, 0, 8);
    }
  }
}

/** Rafters and a wall plate under a gallery's lean-to roof (the roof piece q). */
export function galleryRafters(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, , z1] = q.max;
  const t = new Pen(d, new Frame(0, 0, 0));
  const step = d.detail === 0 ? 2.4 : 1.2;
  for (let z = z0 + 0.6; z < z1 - 0.3; z += step) t.box((x0 + x1) / 2, y0 - 0.22, z, x1 - x0 - 0.2, 0.22, 0.16, TIMBER, undefined, 0.01);
  const sx = Math.sign(x0 + x1);
  const plates = [sx > 0 ? x0 + 0.5 : x1 - 0.5, sx * (T.galleryOut - 0.2)];
  for (const x of plates) t.box(x, y0 - 0.4, (z0 + z1) / 2, 0.3, 0.3, z1 - z0 - 0.4, RED, undefined, 0.02);
  if (d.detail > 0) for (const x of plates) t.box(x, y0 - 0.42, (z0 + z1) / 2, 0.32, 0.04, z1 - z0 - 0.4, GOLD, 'metal', 0);
}

/** Joists under a gallery floor slab and a painted beam across it at every bay, seen from the aisle below. */
export function floorJoists(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, , z1] = q.max;
  const t = new Pen(d, new Frame(0, 0, 0));
  if (d.detail > 0) for (let z = z0 + 0.4; z < z1 - 0.2; z += 0.8) t.box((x0 + x1) / 2, y0 - 0.14, z, x1 - x0 - 0.1, 0.14, 0.12, TIMBER, undefined, 0);
  for (const z of BAYS) {
    if (z <= z0 + 0.2 || z >= z1 - 0.2) continue;
    t.box((x0 + x1) / 2, y0 - 0.36, z, x1 - x0, 0.36, 0.3, RED, undefined, 0.02);
    if (d.detail > 0) t.box((x0 + x1) / 2, y0 - 0.38, z, x1 - x0 - 0.1, 0.04, 0.18, GOLD, 'metal', 0);
  }
}

const BOARD = [
  { ground: '#2f5f9a', motif: '#f2e6c8' },
  { ground: '#c8231b', motif: GOLD },
  { ground: '#2f7a4a', motif: '#f6c624' },
  { ground: '#d2a050', motif: '#8a2a1f' }
];

/**
 * A painted board hung over a nave bay: a lacquered frame round a coloured ground, a gilded lotus wheel on both faces,
 * brocade bands, tassels, and cords up to the beam over it. Solid timber, so it reads as something a shot stops at.
 */
export function board(d: Drawer, q: Piece) {
  const [x0, y0, z0] = q.min;
  const [x1, y1, z1] = q.max;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const len = z1 - z0;
  const h = y1 - y0;
  const look = BOARD[Math.abs(Math.round(cz / 4.8 + (cx > 0 ? 0 : 2))) % BOARD.length]!;
  const t = new Pen(d, new Frame(0, 0, 0));
  slab(d, [x0, y0, z0], [x1, y1, z1], RED);
  for (const s of [-1, 1]) {
    const fx = s < 0 ? x0 - 0.02 : x1;
    slab(d, [fx, y0 + 0.24, z0 + 0.2], [fx + 0.02, y1 - 0.24, z1 - 0.2], look.ground);
    if (d.detail === 0) continue;
    for (const y of [y0 + 0.36, y1 - 0.42]) slab(d, [fx - s * 0.005, y, z0 + 0.3], [fx + 0.02 - s * 0.005, y + 0.06, z1 - 0.3], GOLD, 'metal');
    t.cylX(s < 0 ? x0 - 0.05 : x1, (y0 + y1) / 2, cz, Math.min(0.9, len * 0.24), 0.05, GOLD, 'metal');
    t.cylX(s < 0 ? x0 - 0.07 : x1 + 0.02, (y0 + y1) / 2, cz, Math.min(0.5, len * 0.13), 0.05, look.motif);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = Math.min(0.72, len * 0.19);
      t.box(s < 0 ? x0 - 0.06 : x1 + 0.03, (y0 + y1) / 2 + Math.sin(a) * r - 0.08, cz + Math.cos(a) * r, 0.03, 0.16, 0.16, look.motif, undefined, 0);
    }
    for (const z of [z0 + 0.45, z1 - 0.45]) t.box(s < 0 ? x0 - 0.04 : x1 + 0.01, y0 + 0.7, z, 0.03, h - 1.4, 0.08, GOLD, 'metal', 0);
  }
  slab(d, [x0 - 0.08, y1 - 0.12, z0 - 0.1], [x1 + 0.08, y1, z1 + 0.1], TIMBER);
  slab(d, [x0 - 0.06, y0, z0 - 0.06], [x1 + 0.06, y0 + 0.12, z1 + 0.06], GOLD, 'metal');
  for (const z of [z0 + 0.3, z1 - 0.3]) {
    t.cyl(cx, y1, z, 0.025, T.hallTop - 0.66 - y1, '#3a2a1f', undefined, 0, 4);
    if (d.detail > 0) t.cone(cx, y0 - 0.5, z, 0.02, 0.09, 0.5, '#c8231b', undefined, 6);
  }
  if (d.detail > 0) for (let z = z0 + 0.8; z < z1 - 0.6; z += 0.8) t.cone(cx, y0 - 0.36, z, 0.015, 0.06, 0.36, GOLD, undefined, 5);
}

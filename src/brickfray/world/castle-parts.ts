import { drawBlock, type Masonry } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, type Face, type PlanCollider, type Vec3 } from './util';

export const CASTLE_STONE: Masonry = { colors: ['#9ea2a4', '#8e9395', '#adb0b0', '#83888b'], variance: 0.35, lens: [3, 4, 2, 5] };
export const WALK_TILE = '#c9bea6';
export const ROOF_RED = '#9a3a2a';
/** Darker, cooler stone for the gatehouses so they read as their own mass against the curtain walls. */
const GATE_STONE: Masonry = { colors: ['#7f8287', '#717479', '#8c8f93', '#676a6f'], variance: 0.3, lens: [3, 4, 2, 5] };
const DRESSED = '#c9c2b2';
const PLINTH = '#7a756b';

/** Courtyard half-size, wall thickness and wall-walk height of the fortress. */
export const C = { inner: 30.8, outer: 34.8, walk: 3.84, tower: 27.6 } as const;

interface Piece {
  min: Vec3;
  max: Vec3;
  /** Faces drawn with bricks; tops get tiles when walkable. */
  faces: Face[];
  walk?: boolean;
  top?: 'tiles' | 'none' | 'studs';
}

/** Gaps in the inner merlon row (stair tops), as [from, to] along the wall. */
export interface WallParams {
  side: Face;
  /** Span along the wall axis. */
  from: number;
  to: number;
  gaps: [number, number][];
}

function wallPieces(p: WallParams): Piece[] {
  const { inner, outer, walk } = C;
  const s = p.side === 'n' || p.side === 'w' ? -1 : 1;
  const alongX = p.side === 'n' || p.side === 's';
  const mk = (a0: number, a1: number, d0: number, d1: number, y0: number, y1: number, faces: Face[], walkable?: boolean, top?: Piece['top']): Piece => {
    const da = s * d0;
    const db = s * d1;
    const lo: Vec3 = alongX ? [a0, y0, Math.min(da, db)] : [Math.min(da, db), y0, a0];
    const hi: Vec3 = alongX ? [a1, y1, Math.max(da, db)] : [Math.max(da, db), y1, a1];
    return { min: lo, max: hi, faces, walk: walkable, top };
  };
  const inward: Face = p.side === 'n' ? 's' : p.side === 's' ? 'n' : p.side === 'w' ? 'e' : 'w';
  const pieces: Piece[] = [mk(p.from, p.to, inner, outer, 0, walk, [inward], true, 'tiles')];
  pieces.push(mk(p.from, p.to, outer - 0.8, outer, walk, walk + 2.4, [inward], false, 'none'));
  for (let a = p.from + 0.4; a + 0.8 <= p.to - 0.2; a += 1.6) pieces.push(mk(a, a + 0.8, outer - 0.8, outer, walk + 2.4, walk + 3.36, [inward, p.side === 'n' || p.side === 's' ? 'e' : 'n', p.side === 'n' || p.side === 's' ? 'w' : 's'], false, 'studs'));
  for (let a = p.from + 0.8; a + 0.8 <= p.to - 0.4; a += 1.6) {
    if (p.gaps.some(([g0, g1]) => a + 0.8 > g0 && a < g1)) continue;
    pieces.push(mk(a, a + 0.8, inner, inner + 0.8, walk, walk + 0.96, [inward, alongX ? 'e' : 'n', alongX ? 'w' : 's'], false, 'studs'));
  }
  return pieces;
}

export const CURTAIN: Element<WallParams> = {
  colliders: (p) => wallPieces(p).map((q) => box(q.min, q.max, 'stone', { walk: q.walk })),
  draw(d, p) {
    for (const q of wallPieces(p)) drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: CASTLE_STONE, faces: q.faces, top: q.top, topColor: q.walk ? WALK_TILE : '#b8b1a3' });
    const s = p.side === 'n' || p.side === 'w' ? -1 : 1;
    const f = s * C.inner;
    const t = new Pen(d, new Frame(0, 0, 0));
    if (p.side === 'n' || p.side === 's') t.span(p.from, 0, f - s * 0.06, p.to, 0.64, f, PLINTH, undefined, 0.01);
    else t.span(f - s * 0.06, 0, p.from, f, 0.64, p.to, PLINTH, undefined, 0.01);
  }
};

/**
 * Corner tower: solid to the wall walk, a room at walk level with doorways to
 * both walks, crenellated roof and a cone cap. (sx, sz) pick the corner.
 */
export interface TowerParams {
  sx: 1 | -1;
  sz: 1 | -1;
}

function towerPieces(p: TowerParams): Piece[] {
  const { tower: a, outer: o, walk } = C;
  const X = (u: number) => p.sx * u;
  const Z = (u: number) => p.sz * u;
  const bx = (u0: number, u1: number, w0: number, w1: number, y0: number, y1: number, top: Piece['top'] = 'none', walkable = false): Piece => ({
    min: [Math.min(X(u0), X(u1)), y0, Math.min(Z(w0), Z(w1))],
    max: [Math.max(X(u0), X(u1)), y1, Math.max(Z(w0), Z(w1))],
    faces: ['n', 's', 'e', 'w'],
    walk: walkable,
    top
  });
  const ceil = walk + 2.88;
  const out: Piece[] = [bx(a, o, a, o, 0, walk, 'tiles', true)];
  const t = 0.8;
  out.push(bx(o - t, o, a, o, walk, ceil));
  out.push(bx(a, o - t, o - t, o, walk, ceil));
  const door = C.inner + 0.8;
  out.push(bx(a, a + t, a, door, walk, ceil), bx(a + t, door, a, a + t, walk, ceil));
  out.push(bx(a, a + t, door, o - t, walk + 2.4, ceil), bx(door, o - t, a, a + t, walk + 2.4, ceil));
  out.push(bx(a, o, a, o, ceil, ceil + 0.48, 'tiles'));
  return out;
}

export const CORNER_TOWER: Element<TowerParams> = {
  colliders: (p) => [...towerPieces(p).map((q) => box(q.min, q.max, 'stone', { walk: q.walk })), ...towerCap(p).colliders],
  draw(d, p) {
    for (const q of towerPieces(p)) drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: CASTLE_STONE, faces: q.faces, top: q.top, topColor: WALK_TILE });
    towerCap(p).draw(d);
  },
  nav(p) {
    const c = (C.tower + C.outer) / 2;
    return [[p.sx * c, C.walk, p.sz * c]];
  }
};

function towerCap(p: TowerParams) {
  const { tower: a, outer: o, walk } = C;
  const y = walk + 3.36;
  const cx = (p.sx * (a + o)) / 2;
  const cz = (p.sz * (a + o)) / 2;
  const half = (o - a) / 2;
  const colliders: PlanCollider[] = [box([cx - half, y, cz - half], [cx + half, y + 0.96, cz + half], 'stone')];
  return {
    colliders,
    draw(d: Drawer) {
      for (let i = 0; i < 4; i++) {
        for (let k = 0; k < 4; k++) {
          const u = -half + 0.4 + k * 1.8;
          const [lx, lz] = [[u, -half + 0.4], [half - 0.4, u], [-u, half - 0.4], [-half + 0.4, -u]][i]!;
          drawBlock(d, { min: [cx + lx! - 0.4, y, cz + lz! - 0.4], max: [cx + lx! + 0.4, y + 0.96, cz + lz! + 0.4], surface: 'stone', style: CASTLE_STONE, top: 'studs', topColor: '#b8b1a3' });
        }
      }
      const t = new Pen(d, new Frame(cx, y, cz));
      t.cone(0, 0, 0, half * 0.85, 0.1, 5.4, p.sz < 0 ? '#2f5d93' : ROOF_RED, undefined, 8, Math.PI / 8);
      t.cyl(0, 5.5, 0, 0.05, 1.1, '#545c63', 'metal');
      const [fx, fy, fz] = new Frame(cx, y + 6.4, cz).p(0.05, 0, 0);
      d.anim.flag([fx, fy, fz], p.sx * p.sz > 0 ? 0 : Math.PI / 2, 1.4, 0.8, p.sz > 0 ? ['#c8231b', '#f6c624'] : ['#1f62c7', '#f2f2ee'], false, 'border');
    }
  };
}

/** Gatehouse in the north (sz = -1) or south wall: closed gate alcove below, a room at walk level. */
export const GATE = { half: 5.6, depth: 1.6, alcove: 1.6, top: C.walk + 3.36 } as const;

function gatePieces(sz: 1 | -1): Piece[] {
  const { inner, outer, walk } = C;
  const h = GATE.half;
  const z0 = inner - GATE.depth;
  const Z = (u: number) => sz * u;
  const bx = (x0: number, x1: number, u0: number, u1: number, y0: number, y1: number, top: Piece['top'] = 'none', walkable = false): Piece => ({
    min: [x0, y0, Math.min(Z(u0), Z(u1))],
    max: [x1, y1, Math.max(Z(u0), Z(u1))],
    faces: [sz > 0 ? 'n' : 's', 'e', 'w'],
    walk: walkable,
    top
  });
  const a = GATE.alcove;
  const ceil = walk + 2.88;
  return [
    bx(-h, -a, z0, outer, 0, walk, 'tiles', true),
    bx(a, h, z0, outer, 0, walk, 'tiles', true),
    bx(-a, a, z0, outer, 3.04, walk, 'tiles', true),
    bx(-a, a, outer - 1.2, outer, 0, 3.04),
    bx(-h, h, z0, z0 + 0.8, walk, ceil),
    bx(-h, h, outer - 0.8, outer, walk, ceil),
    bx(-h, h, z0, outer, ceil, ceil + 0.48, 'tiles')
  ];
}

function gateMerlons(sz: 1 | -1): PlanCollider[] {
  const zf = sz * (C.inner - GATE.depth);
  const [z0, z1] = [Math.min(zf, zf + sz * 0.8), Math.max(zf, zf + sz * 0.8)];
  return Array.from({ length: 7 }, (_, k) => {
    const x = -GATE.half + 0.4 + (k * (2 * GATE.half - 0.8)) / 6;
    return box([x - 0.4, GATE.top, z0], [x + 0.4, GATE.top + 0.96, z1], 'stone');
  });
}

export const GATEHOUSE: Element<{ sz: 1 | -1 }> = {
  colliders: (p) => [...gatePieces(p.sz).map((q) => box(q.min, q.max, 'stone', { walk: q.walk })), ...gateMerlons(p.sz)],
  draw(d, p) {
    for (const q of gatePieces(p.sz)) drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: GATE_STONE, faces: q.faces, top: q.top, topColor: WALK_TILE });
    const zf = p.sz * (C.inner - GATE.depth);
    const t = new Pen(d, new Frame(0, 0, zf, p.sz > 0 ? 2 : 0));
    gateFace(t, p.sz < 0 ? ['#1f62c7', '#f2f2ee'] : ['#c8231b', '#f6c624']);
    const zp = -(C.outer - 1.2 - Math.abs(zf));
    const bars = d.detail === 0 ? 4 : 9;
    for (let i = 0; i < bars; i++) t.box(-GATE.alcove + 0.2 + (i * (GATE.alcove * 2 - 0.4)) / (bars - 1), 0, zp + 0.1, 0.1, 3.0, 0.1, '#3a4148', 'metal', 0);
    for (const y of [0.6, 1.5, 2.4]) t.box(0, y, zp + 0.16, GATE.alcove * 2, 0.08, 0.06, '#3a4148', 'metal', 0);
    t.box(0, 0, zp - 0.1, GATE.alcove * 2, 3.04, 0.12, '#6e4a2f', undefined, 0);
    for (const m of gateMerlons(p.sz)) drawBlock(d, { min: m.min, max: m.max, surface: 'stone', style: CASTLE_STONE, top: 'studs', topColor: '#b8b1a3' });
  },
  nav: (p) => [[0, C.walk, p.sz * (C.inner + 1.6)], [0, 0, p.sz * (C.inner - GATE.depth - 1.0)]]
};

/**
 * Courtyard face of a gatehouse, in its local frame (x along the face, +z out of it): a stepped brick arch
 * with dressed jambs and keystone, the side's coat of arms, arrow slits and a corbelled parapet.
 */
function gateFace(t: Pen, [field, charge]: [string, string]) {
  const a = GATE.alcove;
  const ceil = C.walk + 2.88;
  for (const s of [-1, 1]) {
    t.box(s * (a + 0.25), 0, 0.08, 0.5, 3.04, 0.16, DRESSED, undefined, 0.02);
    t.box(s * (a - 0.2), 2.56, 0.02, 0.4, 0.48, 0.04, DRESSED, undefined, 0.01);
    t.box(s * (a - 0.6), 2.84, 0.02, 0.4, 0.2, 0.04, DRESSED, undefined, 0.01);
    t.box(s * 2.4, 4.3, 0.02, 0.16, 1.3, 0.04, '#23272b', undefined, 0);
    t.box(s * 2.4, 4.86, 0.02, 0.5, 0.14, 0.04, '#23272b', undefined, 0);
  }
  t.box(0, 3.04, 0.08, 2 * a + 1.0, 0.56, 0.16, DRESSED, undefined, 0.02);
  t.box(0, 3.0, 0.12, 0.56, 0.8, 0.24, '#d9d3c4', undefined, 0.02);
  t.box(0, 4.24, 0.04, 1.5, 1.62, 0.08, '#3a3530', undefined, 0.02);
  t.box(0, 4.9, 0.1, 1.3, 0.9, 0.08, field, undefined, 0.02);
  t.prism('gate-shield', [[-0.65, 0], [0.65, 0], [0, -0.62]], 0.08, 0, 4.9, 0.1, field, undefined, Math.PI / 2);
  t.box(0, 4.42, 0.15, 0.22, 1.28, 0.04, charge, undefined, 0);
  t.box(0, 5.22, 0.15, 1.1, 0.22, 0.04, charge, undefined, 0);
  for (let x = -GATE.half + 0.45; x < GATE.half; x += 0.9) t.box(x, ceil - 0.42, 0.14, 0.32, 0.42, 0.28, DRESSED, undefined, 0.02);
  t.box(0, ceil, 0.16, 2 * GATE.half + 0.3, 0.2, 0.32, DRESSED, undefined, 0.02);
}

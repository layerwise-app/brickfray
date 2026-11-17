import { drawBlock, slab, type Masonry } from './blocks';
import { CASTLE_STONE, ROOF_RED, WALK_TILE } from './castle-parts';
import type { Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, type Face, type PlanCollider, type Vec3 } from './util';

/** Keep on an island ringed by a moat; bridges north/south, planks east/west. */
export const K = { half: 5.6, wall: 0.8, roof: 4.8, slab: 0.48, island: 7.2, moat: 12.8, water: -1.2, door: 0.8 } as const;
const BANK: Masonry = { colors: ['#8f897c', '#7f796d', '#9c9588'], variance: 0.3 };

interface Piece {
  min: Vec3;
  max: Vec3;
  faces?: Face[];
  top?: 'tiles' | 'none' | 'studs';
  walk?: boolean;
  surface?: 'stone' | 'wood';
}

const STAIR = { x0: -4.8, x1: -3.2, z0: 4.0, steps: 10, run: 0.8, rise: 0.48 } as const;

function keepPieces(): Piece[] {
  const { half: h, wall: w, roof, slab: s, door } = K;
  const base = roof - s;
  const out: Piece[] = [];
  const wallRun = (x0: number, z0: number, x1: number, z1: number, gap: boolean, faces: Face[]) => {
    const alongX = x1 - x0 > z1 - z0;
    if (!gap) {
      out.push({ min: [x0, 0, z0], max: [x1, base, z1], faces });
      return;
    }
    const mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
    if (alongX) {
      out.push({ min: [x0, 0, z0], max: [mid - door, base, z1], faces }, { min: [mid + door, 0, z0], max: [x1, base, z1], faces });
      out.push({ min: [mid - door, 2.56, z0], max: [mid + door, base, z1], faces });
    } else {
      out.push({ min: [x0, 0, z0], max: [x1, base, mid - door], faces }, { min: [x0, 0, mid + door], max: [x1, base, z1], faces });
      out.push({ min: [x0, 2.56, mid - door], max: [x1, base, mid + door], faces });
    }
  };
  wallRun(-h, -h, h, -h + w, true, ['n', 's']);
  wallRun(-h, h - w, h, h, true, ['n', 's']);
  wallRun(h - w, -h + w, h, h - w, true, ['e', 'w']);
  wallRun(-h, -h + w, -h + w, h - w, false, ['e', 'w']);
  const hz0 = STAIR.z0 - STAIR.steps * STAIR.run;
  const hz1 = hz0 + 4.8;
  out.push({ min: [-h, base, -h], max: [h, roof, hz0], top: 'tiles', walk: true });
  out.push({ min: [-h, base, hz1], max: [h, roof, h], top: 'tiles', walk: true });
  out.push({ min: [STAIR.x1, base, hz0], max: [h, roof, hz1], top: 'tiles', walk: true });
  out.push({ min: [-h, base, hz0], max: [STAIR.x0, roof, hz1], top: 'tiles' });
  out.push({ min: [-0.6, 0, -0.6], max: [0.6, base, 0.6], faces: ['n', 's', 'e', 'w'] });
  for (let i = 0; i < STAIR.steps; i++) {
    const z1 = STAIR.z0 - i * STAIR.run;
    out.push({ min: [STAIR.x0, 0, z1 - STAIR.run], max: [STAIR.x1, (i + 1) * STAIR.rise, z1], faces: ['e', 's'], top: 'tiles', walk: false });
  }
  for (let k = 0; k < 6; k++) {
    const u = -h + 0.4 + k * 2.0;
    for (const [x0, z0] of [[u, -h], [u, h - 0.8], [-h, u], [h - 0.8, u]] as const) {
      out.push({ min: [x0, roof, z0], max: [x0 + 0.8, roof + 0.96, z0 + 0.8], faces: ['n', 's', 'e', 'w'], top: 'studs' });
    }
  }
  out.push({ min: [STAIR.x1, roof, hz0 + 0.4], max: [STAIR.x1 + 0.2, roof + 1.0, hz1], surface: 'wood' });
  out.push({ min: [STAIR.x0, roof, hz1], max: [STAIR.x1 + 0.2, roof + 1.0, hz1 + 0.2], surface: 'wood' });
  return out;
}

export const KEEP: Element<Record<string, never>> = {
  colliders: () => keepPieces().map((q) => box(q.min, q.max, q.surface ?? 'stone', { walk: q.walk, bulletsPass: q.surface === 'wood' })),
  nav() {
    const out: Vec3[] = [];
    for (let i = 0; i < STAIR.steps; i += 3) out.push([(STAIR.x0 + STAIR.x1) / 2, (i + 1) * STAIR.rise, STAIR.z0 - (i + 0.5) * STAIR.run]);
    out.push([(STAIR.x0 + STAIR.x1) / 2, K.roof, STAIR.z0 - STAIR.steps * STAIR.run - 0.5], [(STAIR.x0 + STAIR.x1) / 2, 0, STAIR.z0 + 0.7]);
    for (const [x, z] of [[0, -6.4], [0, 6.4], [6.4, 0], [0, -4.0], [0, 4.0], [4.0, 0], [2.4, -2.4], [2.4, 2.4]] as const) out.push([x, 0, z]);
    return out;
  },
  draw(d) {
    for (const q of keepPieces()) {
      if (q.surface === 'wood') continue;
      drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: CASTLE_STONE, faces: q.faces ?? [], top: q.top ?? 'none', topColor: q.top === 'studs' ? '#b8b1a3' : WALK_TILE });
    }
    const t = new Pen(d, new Frame(0, 0, 0));
    const h = K.half;
    t.box(0, K.roof - K.slab - 0.32, 0, 2 * h + 0.2, 0.32, 2 * h + 0.2, '#8f897c', undefined, 0.03);
    const hz0 = STAIR.z0 - STAIR.steps * STAIR.run;
    for (let i = 0; i <= 4; i++) t.cyl(STAIR.x1 + 0.1, K.roof, hz0 + 0.4 + i * 0.9, 0.05, 1.0, '#6e4a2f');
    t.box(STAIR.x1 + 0.1, K.roof + 0.9, hz0 + 2.2, 0.1, 0.1, 3.6, '#8a5f3a', undefined, 0);
    t.box(STAIR.x0 + 0.9, K.roof + 0.9, hz0 + 4.1, 1.8, 0.1, 0.1, '#8a5f3a', undefined, 0);
    for (const [fx, fz, c] of [[h - 0.4, h - 0.4, '#c8231b'], [-h + 0.4, -h + 0.4, '#1f62c7']] as const) {
      t.cyl(fx, K.roof + 0.96, fz, 0.06, 3.2, '#b7bcc2', 'metal');
      d.anim.flag([fx + 0.05, K.roof + 4.0, fz], c === '#c8231b' ? 0 : Math.PI, 1.6, 1.0, [c, c === '#c8231b' ? '#f6c624' : '#f2f2ee'], false, 'border');
    }
    slab(d, [-h + 0.8, 0, -h + 0.8], [h - 0.8, 0.02, h - 0.8], '#8a5f3a');
    for (const [x, z] of [[0, -h], [0, h], [h, 0]] as const) {
      const f = new Frame(x, 0, z, z < 0 ? 2 : z > 0 ? 0 : 1);
      const p = new Pen(d, f);
      p.frame(0, 0, 0, 1.8, 2.66, 0.12, 0.3, '#6e4a2f');
      p.box(0, 2.56, 0.12, 2.2, 0.32, 0.2, '#b8b1a3', undefined, 0.02);
    }
  }
};

/** Moat banks and water ring; the bridges are separate elements. */
export const MOAT: Element<Record<string, never>> = {
  colliders() {
    const out: PlanCollider[] = [];
    const t = 0.8;
    for (const [lo, hi] of [[K.moat, K.moat + t], [K.island - t, K.island]] as const) {
      out.push(box([-hi, -2.4, -hi], [hi, 0, -lo], 'stone'));
      out.push(box([-hi, -2.4, lo], [hi, 0, hi], 'stone'));
      out.push(box([-hi, -2.4, -lo], [-lo, 0, lo], 'stone'));
      out.push(box([lo, -2.4, -lo], [hi, 0, lo], 'stone'));
    }
    return out;
  },
  draw(d) {
    for (const c of MOAT.colliders!({})) drawBlock(d, { min: c.min, max: [c.max[0], -0.01, c.max[2]], surface: 'stone', style: BANK, faces: ['n', 's', 'e', 'w'] });
    const r = K.moat;
    const i = K.island;
    const y = K.water;
    const color = '#2f7f86';
    d.anim.water(-r, -r, r, -i, y, color);
    d.anim.water(-r, i, r, r, y, color);
    d.anim.water(-r, -i, -i, i, y, color);
    d.anim.water(i, -i, r, i, y, color);
    slab(d, [-r, -2.4, -r], [r, -2.3, r], '#3c4a3a');
  }
};

export const BRIDGE: Element<{ sz: 1 | -1 }> = {
  colliders(p) {
    const z0 = p.sz * K.island;
    const z1 = p.sz * K.moat;
    const lo = Math.min(z0, z1);
    const hi = Math.max(z0, z1);
    return [
      box([-1.6, -0.4, lo], [1.6, 0.16, hi], 'stone', { walk: true }),
      box([-1.6, 0.16, lo], [-1.2, 0.8, hi], 'stone'),
      box([1.2, 0.16, lo], [1.6, 0.8, hi], 'stone')
    ];
  },
  draw(d, p) {
    for (const c of BRIDGE.colliders!(p)) drawBlock(d, { min: c.min, max: c.max, surface: 'stone', style: CASTLE_STONE, faces: ['e', 'w'], top: c.walk ? 'tiles' : 'studs', topColor: c.walk ? WALK_TILE : '#b8b1a3' });
    const mid = p.sz * ((K.island + K.moat) / 2);
    for (const s of [-1, 1]) drawBlock(d, { min: [-1.4, -2.4, mid + s * 1.4 - 0.5], max: [1.4, -0.4, mid + s * 1.4 + 0.5], surface: 'stone', style: BANK, faces: ['n', 's', 'e', 'w'] });
  }
};

export const PLANK_BRIDGE: Element<{ sx: 1 | -1 }> = {
  colliders(p) {
    const x0 = Math.min(p.sx * K.island, p.sx * K.moat);
    const x1 = Math.max(p.sx * K.island, p.sx * K.moat);
    return [
      box([x0, -0.16, -0.8], [x1, 0.08, 0.8], 'wood', { walk: true }),
      box([x0, 0.08, -0.9], [x1, 1.0, -0.8], 'wood', { bulletsPass: true }),
      box([x0, 0.08, 0.8], [x1, 1.0, 0.9], 'wood', { bulletsPass: true })
    ];
  },
  draw(d, p) {
    const x0 = Math.min(p.sx * K.island, p.sx * K.moat);
    const x1 = Math.max(p.sx * K.island, p.sx * K.moat);
    const t = new Pen(d, new Frame(0, 0, 0));
    const n = Math.round((x1 - x0) / 0.4);
    for (let i = 0; i < n; i++) t.box(x0 + (i + 0.5) * ((x1 - x0) / n), -0.16, 0, (x1 - x0) / n - 0.03, 0.24, 1.6, i % 2 ? '#a67c52' : '#b98a5a', undefined, 0.01);
    for (const z of [-1, 1]) {
      t.box((x0 + x1) / 2, -0.3, z * 0.6, x1 - x0, 0.16, 0.2, '#6e4a2f', undefined, 0);
      for (const x of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3]) t.box(x, -1.8, z * 0.85, 0.16, 2.8, 0.16, '#6e4a2f', undefined, 0.01);
      t.cylX((x0 + x1) / 2, 0.95, z * 0.85, 0.035, x1 - x0, '#d8c08a');
      t.cylX((x0 + x1) / 2, 0.55, z * 0.85, 0.03, x1 - x0, '#d8c08a');
    }
  }
};

import { drawBlock, slab, type Masonry } from './blocks';
import { CASTLE_STONE, WALK_TILE } from './castle-parts';
import { keepDressColliders, keepDressing, PARAPET_OUT } from './keep-dressing';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, type Face, type PlanCollider, type Vec3 } from './util';

/** Keep on an island ringed by a moat; bridges north/south, planks east/west. */
export const K = { half: 5.6, wall: 0.8, roof: 4.8, slab: 0.48, island: 7.2, moat: 12.8, water: -1.2, door: 0.8 } as const;
const BANK: Masonry = { colors: ['#8f897c', '#7f796d', '#9c9588'], variance: 0.3 };
/** Pale limestone so the keep stands apart from the tan curtain walls. */
const KEEP_STONE: Masonry = { colors: ['#d3ccbb', '#c4bdab', '#ddd7c8', '#b9b2a2'], variance: 0.3, lens: [3, 4, 2, 5] };

interface Piece {
  min: Vec3;
  max: Vec3;
  faces?: Face[];
  top?: 'tiles' | 'none' | 'studs';
  walk?: boolean;
  /** Corbelled ledge round the roof edge, tiled on top like the roof border walk. */
  ledge?: boolean;
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
  const P = PARAPET_OUT;
  for (let k = 0; k < 6; k++) {
    const u = -h + 0.4 + k * 2.0;
    for (const [x0, z0] of [[u, -h], [u, h - 0.8], [-h, u], [h - 0.8, u]] as const) {
      const min: Vec3 = [x0 === -h ? x0 - P : x0, roof, z0 === -h ? z0 - P : z0];
      const max: Vec3 = [x0 === h - 0.8 ? h + P : x0 + 0.8, roof + 0.96, z0 === h - 0.8 ? h + P : z0 + 0.8];
      out.push({ min, max, faces: ['n', 's', 'e', 'w'], top: 'studs' });
    }
  }
  const ledge = base - 0.32;
  out.push({ min: [-h - P, ledge, -h - P], max: [h + P, roof, -h], faces: ['n', 'e', 'w'], top: 'tiles', ledge: true });
  out.push({ min: [-h - P, ledge, h], max: [h + P, roof, h + P], faces: ['s', 'e', 'w'], top: 'tiles', ledge: true });
  out.push({ min: [h, ledge, -h], max: [h + P, roof, h], faces: ['e'], top: 'tiles', ledge: true });
  out.push({ min: [-h - P, ledge, -h], max: [-h, roof, h], faces: ['w'], top: 'tiles', ledge: true });
  out.push({ min: [STAIR.x1, roof, hz0 + 0.4], max: [STAIR.x1 + 0.2, roof + 1.0, hz1], surface: 'wood' });
  out.push({ min: [STAIR.x0, roof, hz1], max: [STAIR.x1 + 0.2, roof + 1.0, hz1 + 0.2], surface: 'wood' });
  return out;
}

export const KEEP: Element<Record<string, never>> = {
  colliders: () => [
    ...keepPieces().map((q) => box(q.min, q.max, q.surface ?? 'stone', { walk: q.walk, bulletsPass: q.surface === 'wood' })),
    ...keepDressColliders(K)
  ],
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
      const roof = q.top === 'tiles' && q.max[1] === K.roof && !q.ledge;
      drawBlock(d, { min: q.min, max: q.max, surface: 'stone', style: KEEP_STONE, faces: q.faces ?? [], top: roof ? 'none' : (q.top ?? 'none'), topColor: q.top === 'studs' ? '#d9d3c4' : q.ledge ? '#8f897c' : WALK_TILE });
    }
    keepRoof(d);
    keepDressing(d, K);
    const t = new Pen(d, new Frame(0, 0, 0));
    const h = K.half;
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
    const color = '#2a6b72';
    d.anim.water(-r, -r, r, -i, y, color);
    d.anim.water(-r, i, r, r, y, color);
    d.anim.water(-r, -i, -i, i, y, color);
    d.anim.water(i, -i, r, i, y, color);
    slab(d, [-r, -2.4, -r], [r, -2.3, r], '#3c4a3a');
    d.anim.foam.outline([[-i, -i], [i, -i], [i, i], [-i, i]], y, 0.55);
    for (const s of [-1, 1]) {
      d.anim.foam.edge(-r, s * r, r, s * r, y, 0, -s, 0.55);
      d.anim.foam.edge(s * r, -r, s * r, r, y, -s, 0, 0.55);
    }
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
    for (const s of [-1, 1]) {
      const z0 = mid + s * 1.4 - 0.5;
      const z1 = mid + s * 1.4 + 0.5;
      drawBlock(d, { min: [-1.4, -2.4, z0], max: [1.4, -0.4, z1], surface: 'stone', style: BANK, faces: ['n', 's', 'e', 'w'] });
      d.anim.foam.outline([[-1.4, z0], [1.4, z0], [1.4, z1], [-1.4, z1]], K.water, 0.4);
    }
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
      for (const x of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3]) {
        t.box(x, -1.8, z * 0.85, 0.16, 2.8, 0.16, '#6e4a2f', undefined, 0.01);
        d.anim.foam.ring(x, z * 0.85, K.water, 0.11, 0.26, 6);
      }
      t.cylX((x0 + x1) / 2, 0.95, z * 0.85, 0.035, x1 - x0, '#d8c08a');
      t.cylX((x0 + x1) / 2, 0.55, z * 0.85, 0.03, x1 - x0, '#d8c08a');
    }
  }
};

/**
 * Keep roof as studded flagstones: a dark border walk inside the merlons, a two-tone checker of 2.4 m slabs,
 * a compass rose in smooth tiles at the centre and a wooden trapdoor.
 */
function keepRoof(d: Drawer) {
  const h = K.half;
  const y = K.roof + 0.006;
  const hz0 = STAIR.z0 - STAIR.steps * STAIR.run;
  const hz1 = hz0 + 4.8;
  const edge = h - 0.8;
  const xs = [-h, -edge, STAIR.x1, -2.4, 0, 2.4, edge, h];
  const zs = [-h, -edge, hz0, -2.4, 0, hz1, 2.4, edge, h];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const [x0, x1, z0, z1] = [xs[i]!, xs[i + 1]!, zs[j]!, zs[j + 1]!];
      if (x0 >= STAIR.x0 - 0.01 && x1 <= STAIR.x1 + 0.01 && z0 >= hz0 - 0.01 && z1 <= hz1 + 0.01) continue;
      const border = x0 < -edge + 0.01 || x1 > edge - 0.01 || z0 < -edge + 0.01 || z1 > edge - 0.01;
      const cell = Math.floor((x0 + edge + 0.01) / 2.4) + Math.floor((z0 + edge + 0.01) / 2.4);
      d.ground.push({ x0, z0, x1, z1, y, base: y, color: border ? '#8f897c' : cell % 2 ? '#b3a68c' : '#c8bc9f' });
    }
  }
  const tile = (x0: number, z0: number, x1: number, z1: number, color: string, lift: number) =>
    d.ground.push({ x0, z0, x1, z1, y: y + lift, base: y + lift, color, smooth: true });
  tile(-1.2, -1.2, 1.2, 1.2, '#6e665a', 0.004);
  tile(-0.4, -1.2, 0.4, 1.2, '#e0b13a', 0.005);
  tile(-1.2, -0.4, 1.2, 0.4, '#e0b13a', 0.005);
  tile(-0.4, -0.4, 0.4, 0.4, '#b8402f', 0.006);
  tile(2.4, 2.4, 4.0, 4.0, '#7a5434', 0.004);
  const t = new Pen(d, new Frame(0, 0, 0));
  for (let k = 0; k < 3; k++) t.box(2.66 + k * 0.53, y + 0.008, 3.2, 0.03, 0.006, 1.56, '#5a3c24', undefined, 0);
  for (const z of [2.75, 3.65]) t.box(3.2, y + 0.01, z, 1.56, 0.01, 0.1, '#3a4148', 'metal', 0);
  t.cyl(3.7, y + 0.01, 3.2, 0.08, 0.03, '#3a4148', 'metal', 0, 8);
}

import { drawBlock, slab, type Masonry } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, shade, type PlanCollider, type Vec3 } from './util';

const P = 0.16;
const TOWER_STONE: Masonry = { colors: ['#e3d6bc', '#d6c7a8', '#efe5cf', '#cbb995'], variance: 0.3, lens: [3, 4, 6] };
const TOWER_TRIM = '#f2ede2';
const TOWER_ROOF = '#2f6a8a';

/**
 * Clock tower west of the fountain: an 8 m block with an east–west tunnel,
 * a lookout terrace at 4.96 m reached by stairs from north and south, and an
 * open belfry above the shaft. `x0` is the west face, centered on z = 0.
 */
export const TOWER = { x0: -17.6, shaftX1: -12.8, x1: -9.6, z: 2.4, tunnel: 1.2, floor: P + 4.8, tunnelTop: P + 2.88, belfryTop: P + 7.68 } as const;

function towerBoxes(): { min: Vec3; max: Vec3; kind: 'pier' | 'lintel' | 'pillar' | 'parapet' | 'roof' }[] {
  const { x0, shaftX1, x1, z, tunnel, floor, tunnelTop, belfryTop } = TOWER;
  const out: { min: Vec3; max: Vec3; kind: 'pier' | 'lintel' | 'pillar' | 'parapet' | 'roof' }[] = [
    { min: [x0, 0, -z], max: [x1, floor, -tunnel], kind: 'pier' },
    { min: [x0, 0, tunnel], max: [x1, floor, z], kind: 'pier' },
    { min: [x0, tunnelTop, -tunnel], max: [x1, floor, tunnel], kind: 'lintel' }
  ];
  for (const px of [x0, shaftX1 - 0.8]) for (const pz of [-z, z - 0.8]) out.push({ min: [px, floor, pz], max: [px + 0.8, belfryTop, pz + 0.8], kind: 'pillar' });
  out.push({ min: [x0, floor, -z + 0.8], max: [x0 + 0.4, floor + 1.12, z - 0.8], kind: 'parapet' });
  for (const pz of [-z, z - 0.4]) out.push({ min: [x0 + 0.8, floor, pz], max: [shaftX1 - 0.8, floor + 1.12, pz + 0.4], kind: 'parapet' });
  out.push({ min: [x1 - 0.4, floor, -z], max: [x1, floor + 1.12, z], kind: 'parapet' });
  out.push({ min: [x0 - 0.2, belfryTop, -z - 0.2], max: [shaftX1 + 0.2, belfryTop + 3.2, z + 0.2], kind: 'roof' });
  return out;
}

export const CLOCK_TOWER: Element<Record<string, never>> = {
  colliders() {
    return towerBoxes().map((b) => box(b.min, b.max, 'stone', { walk: b.kind === 'pier' || b.kind === 'lintel' }));
  },
  nav() {
    return [
      [(TOWER.x0 + TOWER.shaftX1) / 2, TOWER.floor, 0],
      [(TOWER.shaftX1 + TOWER.x1) / 2 - 0.2, TOWER.floor, 0],
      [-19.6, P, 0],
      [-17.2, P, 0],
      [-14.4, P, 0],
      [-11.6, P, 0],
      [-8.8, P, 0]
    ];
  },
  draw(d) {
    const { x0, shaftX1, x1, z, floor, belfryTop } = TOWER;
    for (const b of towerBoxes()) {
      if (b.kind === 'roof') continue;
      drawBlock(d, { min: b.min, max: b.max, surface: 'stone', style: TOWER_STONE, top: b.kind === 'parapet' || b.kind === 'pillar' ? 'tiles' : 'none', topColor: TOWER_TRIM });
    }
    slab(d, [x0 + 0.02, floor - 0.02, -z + 0.02], [x1 - 0.02, floor, z - 0.02], '#c9b48a');
    const t = new Pen(d, new Frame(0, 0, 0));
    if (d.detail > 0) {
      for (const xx of [x0, x1]) t.box(xx, TOWER.tunnelTop, 0, 0.3, 0.32, TOWER.tunnel * 2 + 0.4, TOWER_TRIM, undefined, 0.02);
      t.box((x0 + x1) / 2, floor - 0.32, -z - 0.06, x1 - x0 + 0.1, 0.32, 0.12, TOWER_TRIM, undefined, 0.02);
      t.box((x0 + x1) / 2, floor - 0.32, z + 0.06, x1 - x0 + 0.1, 0.32, 0.12, TOWER_TRIM, undefined, 0.02);
    }
    const cx = (x0 + shaftX1) / 2;
    const w = shaftX1 - x0;
    t.box(cx, belfryTop, 0, w + 0.4, 0.48, 2 * z + 0.4, TOWER_TRIM, undefined, 0.03);
    t.box(cx, belfryTop + 0.48, 0, w - 0.6, 2.4, 2 * z - 0.6, TOWER_STONE.colors[0]!, undefined, 0.02);
    t.box(cx, belfryTop + 2.88, 0, w, 0.32, 2 * z, TOWER_TRIM, undefined, 0.03);
    t.cone(cx, belfryTop + 3.2, 0, (w / 2) * Math.SQRT2 + 0.1, 0.05, 3.6, TOWER_ROOF, undefined, 4, Math.PI / 4);
    t.cyl(cx, belfryTop + 6.8, 0, 0.04, 1.2, '#c99a3e', 'chrome');
    t.ball(cx, belfryTop + 6.9, 0, 0.14, '#c99a3e', undefined, 0, 1, 'chrome');
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) clockFace(d, cx + nx * (w / 2 - 0.3), belfryTop + 1.68, nz * (z - 0.3), nx, nz);
    if (d.detail > 0) {
      t.cyl(cx, belfryTop - 1.6, 0, 0.5, 1.0, '#c99a3e', 'chrome', 0.06);
      t.cyl(cx, belfryTop - 0.6, 0, 0.06, 0.6, '#545c63', 'metal');
    }
  }
};

function clockFace(d: Drawer, x: number, y: number, z: number, nx: number, nz: number) {
  const turns = nz === 1 ? 0 : nz === -1 ? 2 : nx === 1 ? 1 : 3;
  const t = new Pen(d, new Frame(x, y, z, turns));
  t.cylZ(0, 0, 0.06, 0.95, 0.12, TOWER_TRIM, undefined, 0.03);
  t.cylZ(0, 0, 0.14, 0.82, 0.04, '#fbf8ef');
  if (d.detail === 0) return;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.68;
    t.box(Math.cos(a) * r, Math.sin(a) * r - 0.04, 0.17, i % 3 === 0 ? 0.08 : 0.05, i % 3 === 0 ? 0.08 : 0.05, 0.03, '#2f363d', undefined, 0);
  }
  t.box(0.0, -0.03, 0.19, 0.06, 0.5, 0.03, '#2f363d', undefined, 0);
  t.box(0.2, -0.03, 0.2, 0.42, 0.06, 0.03, '#2f363d', undefined, 0);
  t.cylZ(0, 0, 0.21, 0.06, 0.04, '#c99a3e', 'chrome');
}

/** Raised round-roofed bandstand east of the fountain, steps on three sides. */
export const BANDSTAND = { x0: 9.6, x1: 17.6, z0: -4.0, z1: 4.0, top: P + 1.44 } as const;
const BAND_STONE: Masonry = { colors: ['#f2ede2', '#e7e1d2', '#d9d2c1'], variance: 0.25 };

function bandPillars(): [number, number][] {
  const { x0, x1, z0, z1 } = BANDSTAND;
  return [
    [x0 + 0.5, z0 + 0.5],
    [x1 - 0.5, z0 + 0.5],
    [x0 + 0.5, z1 - 0.5],
    [x1 - 0.5, z1 - 0.5],
    [x1 - 0.5, 0]
  ];
}

export const BANDSTAND_EL: Element<Record<string, never>> = {
  colliders() {
    const { x0, x1, z0, z1, top } = BANDSTAND;
    const out: PlanCollider[] = [box([x0, 0, z0], [x1, top, z1], 'wood', { walk: true })];
    for (const [px, pz] of bandPillars()) out.push(box([px - 0.26, top, pz - 0.26], [px + 0.26, top + 2.88, pz + 0.26], 'stone'));
    const rail = (a: Vec3, b: Vec3) => out.push(box(a, b, 'metal', { bulletsPass: true }));
    rail([x1 - 0.2, top, z0 + 0.8], [x1, top + 0.96, -0.3]);
    rail([x1 - 0.2, top, 0.3], [x1, top + 0.96, z1 - 0.8]);
    for (const zz of [z0, z1 - 0.2]) {
      rail([x0 + 0.8, top, zz], [12.0, top + 0.96, zz + 0.2]);
      rail([15.2, top, zz], [x1 - 0.8, top + 0.96, zz + 0.2]);
    }
    for (const [a, b] of [[z0 + 0.8, -1.6], [1.6, z1 - 0.8]] as const) rail([x0, top, a], [x0 + 0.2, top + 0.96, b]);
    out.push(box([x0 - 0.6, top + 2.88, z0 - 0.6], [x1 + 0.6, top + 3.6, z1 + 0.6], 'plastic'));
    return out;
  },
  draw(d) {
    const { x0, x1, z0, z1, top } = BANDSTAND;
    drawBlock(d, { min: [x0, 0, z0], max: [x1, top, z1], surface: 'wood', style: BAND_STONE, top: 'tiles', topColor: '#c9a26e' });
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const [px, pz] of bandPillars()) {
      t.cyl(px, top, pz, 0.3, 0.16, '#f2f2ee', undefined, 0.03);
      t.cyl(px, top + 0.16, pz, 0.2, 2.56, '#f2f2ee', undefined, 0);
      t.cyl(px, top + 2.72, pz, 0.3, 0.16, '#f2f2ee', undefined, 0.03);
    }
    const iron = '#2f6a4a';
    const rail = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      t.box((ax + bx) / 2, top + 0.88, (az + bz) / 2, alongX ? len : 0.08, 0.08, alongX ? 0.08 : len, iron, 'metal', 0.01);
      const n = Math.round(len / (d.detail === 2 ? 0.2 : 0.4));
      for (let i = 0; i <= n; i++) t.box(ax + ((bx - ax) * i) / n, top, az + ((bz - az) * i) / n, 0.035, 0.9, 0.035, iron, 'metal', 0);
    };
    rail(x1 - 0.1, z0 + 0.8, x1 - 0.1, -0.3);
    rail(x1 - 0.1, 0.3, x1 - 0.1, z1 - 0.8);
    for (const zz of [z0 + 0.1, z1 - 0.1]) {
      rail(x0 + 0.8, zz, 12.0, zz);
      rail(15.2, zz, x1 - 0.8, zz);
    }
    rail(x0 + 0.1, z0 + 0.8, x0 + 0.1, -1.6);
    rail(x0 + 0.1, 1.6, x0 + 0.1, z1 - 0.8);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    t.box(cx, top + 2.88, cz, x1 - x0 + 1.2, 0.32, z1 - z0 + 1.2, '#f2f2ee', undefined, 0.04);
    t.box(cx, top + 3.2, cz, x1 - x0 + 1.0, 0.16, z1 - z0 + 1.0, '#c8231b', undefined, 0.02);
    t.cone(cx, top + 3.36, cz, 6.2, 0.3, 2.6, '#2f8a6e', undefined, 8, Math.PI / 8);
    t.cyl(cx, top + 5.9, cz, 0.3, 0.3, '#f2f2ee', undefined, 0.05);
    t.ball(cx, top + 6.4, cz, 0.22, '#c99a3e', undefined, 0, 1, 'chrome');
    if (d.detail > 0) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      t.ball(cx + Math.cos(a) * 4.9, top + 2.84, cz + Math.sin(a) * 4.9, 0.09, i % 2 ? '#f6c624' : '#f2f2ee', undefined, 0, 1, i % 2 ? 'glow' : 'plastic');
    }
  }
};

/** Arcade along the east façades: a colonnade with a walkable deck at 3.84 m. */
export const ARCADE = { x0: 27.2, x1: 32.0, z0: -15.2, z1: 15.2, deck: 3.84, slab: 0.48 } as const;
export const ARCADE_STAIRS = [-13.6, 11.2] as const;

export const ARCADE_EL: Element<Record<string, never>> = {
  colliders() {
    const { x0, x1, z0, z1, deck, slab: s } = ARCADE;
    const out: PlanCollider[] = [box([x0, deck - s, z0], [x1, deck, z1], 'stone', { walk: true })];
    for (let zz = z0; zz <= z1 + 0.01; zz += 3.8) out.push(box([x0, 0, zz - 0.25], [x0 + 0.5, deck - s, zz + 0.25], 'stone'));
    const gaps = ARCADE_STAIRS.map((s0) => [s0, s0 + 2.4] as const);
    let start: number = z0;
    for (const [g0, g1] of [...gaps, [z1, z1] as const]) {
      if (g0 - start > 0.1) out.push(box([x0, deck, start], [x0 + 0.32, deck + 1.0, g0], 'stone'));
      start = g1;
    }
    for (const zz of [z0, z1 - 0.32]) out.push(box([x0, deck, zz], [x1, deck + 1.0, zz + 0.32], 'stone'));
    return out;
  },
  draw(d) {
    const { x0, x1, z0, z1, deck, slab: s } = ARCADE;
    const style: Masonry = { colors: ['#e7e1d2', '#d9d2c1', '#f2ede2'], variance: 0.2 };
    drawBlock(d, { min: [x0, deck - s, z0], max: [x1, deck, z1], surface: 'stone', style, faces: ['w', 'n', 's'], top: 'tiles', topColor: '#c4553a' });
    const t = new Pen(d, new Frame(0, 0, 0));
    for (let zz = z0; zz <= z1 + 0.01; zz += 3.8) {
      t.box(x0 + 0.25, 0.16, zz, 0.6, 0.3, 0.6, '#d9d2c1', undefined, 0.03);
      t.cyl(x0 + 0.25, 0.46, zz, 0.2, deck - s - 0.76, '#f2ede2', undefined, 0);
      t.box(x0 + 0.25, deck - s - 0.3, zz, 0.6, 0.3, 0.6, '#d9d2c1', undefined, 0.03);
    }
    for (const b of ARCADE_EL.colliders!({}).slice(1)) {
      if (b.min[1] < deck - 0.01) continue;
      drawBlock(d, { min: b.min, max: b.max, surface: 'stone', style, top: 'studs', topColor: '#f2f2ee' });
    }
    if (d.detail > 0) t.box((x0 + x1) / 2 - 0.06, deck - s - 0.12, (z0 + z1) / 2, x1 - x0 + 0.1, 0.12, z1 - z0 + 0.12, shade('#e7e1d2', -0.15), undefined, 0.02);
  }
};

import type { Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, shade, type PlanCollider } from './util';
import { METAL_STAIRS } from './warehouse';

export const WATER_Y = -1.0;
export const QUAY_EDGE = 10.0;
const PLANK = '#a67c52';
const POST = '#5c4330';

export interface PierParams {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Plank deck at quay level on timber piles; boards run across the long side. */
export const PIER: Element<PierParams> = {
  colliders: (p) => [box([p.x0, -0.4, p.z0], [p.x1, 0, p.z1], 'wood', { walk: true })],
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const alongX = p.x1 - p.x0 > p.z1 - p.z0;
    const len = alongX ? p.x1 - p.x0 : p.z1 - p.z0;
    const wid = alongX ? p.z1 - p.z0 : p.x1 - p.x0;
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    // Without multisampling the gaps between boards would break into dashes: low butts them and keeps the tones.
    const n = Math.round(len / 0.4);
    const gap = d.detail === 0 ? 0 : 0.03;
    for (let i = 0; i < n; i++) {
      const u = (alongX ? p.x0 : p.z0) + (i + 0.5) * (len / n);
      const c = i % 3 === 0 ? shade(PLANK, -0.08) : i % 3 === 1 ? PLANK : shade(PLANK, 0.06);
      if (alongX) t.box(u, -0.14, cz, len / n - gap, 0.14, wid, c, undefined, 0.01);
      else t.box(cx, -0.14, u, wid, 0.14, len / n - gap, c, undefined, 0.01);
    }
    for (const s of [-1, 1]) {
      const o = s * (wid / 2 - 0.15);
      if (alongX) t.box(cx, -0.42, cz + o, len, 0.28, 0.2, POST, undefined, 0.01);
      else t.box(cx + o, -0.42, cz, 0.2, 0.28, len, POST, undefined, 0.01);
      const piles = Math.max(2, Math.round(len / 2.4) + 1);
      for (let i = 0; i < piles; i++) {
        const u = (alongX ? p.x0 : p.z0) + 0.2 + (i * (len - 0.4)) / (piles - 1);
        const [x, z] = alongX ? [u, cz + s * (wid / 2 - 0.15)] : [cx + s * (wid / 2 - 0.15), u];
        t.cyl(x, -2.2, z, 0.17, 2.2 + (d.detail > 0 && i % 2 === 0 ? 0.5 : -0.1), POST, undefined, 0.03);
        d.anim.foam.ring(x, z, WATER_Y, 0.17, 0.32, d.detail === 0 ? 6 : 10);
      }
    }
  }
};

/** Gangway width: two abreast, not a squeeze. */
export const GANGWAY_W = 2.0;
const GW = GANGWAY_W / 2;

/** Two steps and a short bridge from quay level onto a deck 0.96 up, climbing toward +z. */
export const GANGWAY: Element<{ x: number; z: number }> = {
  colliders(p) {
    const out: PlanCollider[] = METAL_STAIRS.colliders!(stair(p));
    out.push(box([p.x - GW, 0.8, p.z + 1.6], [p.x + GW, 0.96, p.z + 2.6], 'metal', { walk: true }));
    for (const s of [-1, 1]) out.push(box([p.x + s * GW - 0.05, 0.96, p.z + 0.8], [p.x + s * GW + 0.05, 0.96 + RAIL_H, p.z + 2.4], 'metal', { bulletsPass: true }));
    return out;
  },
  nav: (p) => [[p.x, 0, p.z - 0.8], [p.x, 0.96, p.z + 2.2]],
  draw(d, p) {
    METAL_STAIRS.draw(d, stair(p));
    const t = new Pen(d, new Frame(p.x, 0, p.z));
    t.box(0, 0.82, 2.1, GANGWAY_W, 0.14, 1.0, '#8a9096', 'metal', 0);
    for (const s of [-1, 1]) {
      t.box(s * GW, 0.9 + RAIL_H, 1.6, 0.06, 0.06, 1.6, '#f6c624', 'metal', 0);
      for (const z of [0.8, 1.6, 2.4]) t.box(s * GW, z < 1.6 ? 0.48 : 0.96, z, 0.06, (z < 1.6 ? 0.48 : 0) + RAIL_H, 0.06, '#f6c624', 'metal', 0);
    }
  }
};

const stair = (p: { x: number; z: number }) => ({
  x: p.x,
  z: p.z,
  y0: 0,
  dir: 's' as const,
  width: GANGWAY_W,
  steps: 2,
  rise: 0.48,
  run: 0.8,
  style: { colors: ['#8a9096'], variance: 0 },
  surface: 'metal' as const
});

/** Concrete quay face down to the water with rubber fenders and a capstone edge. */
export const QUAY_WALL: Element<{ x0: number; x1: number; z: number; gaps: [number, number][] }> = {
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    t.span(p.x0, WATER_Y - 1.2, p.z - 0.6, p.x1, -0.02, p.z, '#8d8f88', undefined, 0);
    t.span(p.x0, -0.02, p.z - 0.5, p.x1, 0.06, p.z + 0.02, '#c9c4b5', undefined, 0.01);
    const reach = 90;
    let a = Math.max(p.x0, -reach);
    for (const [g0, g1] of [...p.gaps, [reach, reach] as [number, number]].sort((m, n) => m[0] - n[0])) {
      if (g0 > a) d.anim.foam.edge(a, p.z + 0.01, Math.min(g0, reach), p.z + 0.01, WATER_Y, 0, 1, 0.9);
      a = Math.max(a, g1);
    }
    if (d.detail === 0) return;
    for (let x = p.x0 + 2; x < p.x1 - 1; x += 4) {
      if (p.gaps.some(([a, b]) => x > a - 0.6 && x < b + 0.6)) continue;
      t.box(x, WATER_Y - 0.6, p.z + 0.12, 0.5, 1.5, 0.24, '#22272c', 'rubber', 0.04);
    }
    t.span(p.x0, WATER_Y - 0.1, p.z, p.x1, WATER_Y + 0.12, p.z + 0.01, '#5d6b4f', undefined, 0);
  }
};

/** Higher than a jump (MOVE.jump), so the rail top is no foothold for stepping out over the water. */
export const RAIL_H = 1.25;

/**
 * Quay-side safety rail along x or z (the longer side of the box): steel posts, a yellow top tube and a mid chain.
 * `height` defaults to RAIL_H.
 */
export const EDGE_RAIL: Element<{ x0: number; z0: number; x1: number; z1: number; height?: number }> = {
  colliders: (p) => [box([p.x0, 0, p.z0], [p.x1, p.height ?? RAIL_H, p.z1], 'metal', { bulletsPass: true })],
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const alongX = p.x1 - p.x0 > p.z1 - p.z0;
    const len = alongX ? p.x1 - p.x0 : p.z1 - p.z0;
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    const h = p.height ?? RAIL_H;
    const n = Math.max(1, Math.round(len / (d.detail === 0 ? 3.2 : 1.6)));
    for (let i = 0; i <= n; i++) {
      const u = (alongX ? p.x0 : p.z0) + (i * len) / n;
      t.box(alongX ? u : cx, 0, alongX ? cz : u, 0.08, h, 0.08, '#545c63', 'metal', 0);
    }
    const span = (y: number, sh: number, w: number, color: string) =>
      t.box(cx, y, cz, alongX ? len : w, sh, alongX ? w : len, color, 'metal', 0);
    span(h - 0.07, 0.07, 0.07, '#f6c624');
    for (const y of h > RAIL_H ? [0.5, 1.0] : [0.6]) span(y, 0.05, 0.05, '#2f363d');
  }
};

/** Crane rails sunk into the quay along x. */
export const RAILS: Element<{ x0: number; x1: number; z: number[] }> = {
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const z of p.z) {
      t.span(p.x0, 0, z - 0.3, p.x1, 0.012, z + 0.3, '#6c7178', 'metal', 0);
      t.span(p.x0, 0, z - 0.05, p.x1, 0.05, z + 0.05, '#b7bcc2', 'chrome', 0);
    }
  }
};

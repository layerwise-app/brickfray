import { drawBlock, type Masonry } from './blocks';
import type { Drawer, Element } from './plan';
import { frameOf, pen, type At } from './props-kit';
import { Rng, shade, type PlanCollider, type Vec3 } from './util';

const GOLD = '#e0b040';
const BRONZE = '#9a6a2f';
const STONE = '#a9ae9c';
const MOSS = '#5f9a3e';
const LEAF = '#3f8f3a';
const WOOD = '#7a5234';
const RIM: Masonry = { colors: ['#d8c9a3', '#cbbb93', '#e2d5b2'], variance: 0.3, lens: [2, 3, 4] };

/** Stone lantern: plinth, shaft, a lit fire box and a curled cap. */
export const LANTERN: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.35, 0, -0.35], [0.35, 1.9, 0.35], 'stone')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, 0.7, 0.24, 0.7, shade(STONE, -0.1));
    t.cyl(0, 0.24, 0, 0.16, 0.62, STONE, undefined, 0.02);
    t.box(0, 0.86, 0, 0.6, 0.12, 0.6, STONE);
    t.box(0, 0.98, 0, 0.46, 0.42, 0.46, shade(STONE, -0.2));
    if (d.detail > 0) for (const s of [-1, 1]) t.box(0, 1.04, s * 0.2, 0.26, 0.3, 0.08, '#ffd27a', 'glow', 0);
    t.box(0, 1.4, 0, 0.78, 0.14, 0.78, STONE);
    t.cone(0, 1.54, 0, 0.42, 0.06, 0.3, shade(STONE, 0.05), undefined, 4, Math.PI / 4);
    t.ball(0, 1.86, 0, 0.08, MOSS);
    const f = frameOf(p);
    d.anim.flame(f.p(0, 1.1, 0));
  }
};

/** Bronze fire bowl on three legs. */
export const BRAZIER: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.45, 0, -0.45], [0.45, 1.1, 0.45], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      t.beam(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42, Math.cos(a) * 0.2, 0.8, Math.sin(a) * 0.2, 0.08, BRONZE, 'metal');
    }
    t.cone(0, 0.72, 0, 0.22, 0.5, 0.34, BRONZE, 'metal');
    t.ring(0, 1.06, 0, 0.48, 0.05, GOLD, 'metal');
    t.cyl(0, 0.98, 0, 0.4, 0.06, '#3a2a1f');
    d.anim.flame(frameOf(p).p(0, 1.08, 0));
  }
};

/** Pile of carved temple blocks fallen from a wall; chest-high cover. */
export const RUBBLE: Element<At & { seed?: number }> = {
  colliders: (p) => {
    const f = frameOf(p);
    return [f.box([-0.9, 0, -0.6], [0.9, 0.96, 0.6], 'stone'), f.box([-0.6, 0.96, -0.5], [0.5, 1.44, 0.5], 'stone')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const rng = new Rng(p.seed ?? Math.round(p.x * 7 + p.z * 13));
    const c = () => rng.pick(['#93a996', '#849c88', '#a2b6a3', '#d8c9a3']);
    t.box(-0.45, 0, 0, 0.88, 0.48, 1.2, c(), undefined, 0.04);
    t.box(0.45, 0, 0, 0.88, 0.48, 1.2, c(), undefined, 0.04);
    t.box(0, 0.48, 0.05, 1.76, 0.48, 1.1, c(), undefined, 0.04, rng.range(-0.08, 0.08));
    t.box(-0.05, 0.96, 0, 1.1, 0.48, 1.0, c(), undefined, 0.04, rng.range(-0.15, 0.15));
    if (d.detail > 0) {
      t.box(-0.05, 1.0, 0.51, 0.7, 0.32, 0.04, GOLD, 'metal', 0);
      t.box(0.3, 1.44, 0.1, 0.5, 0.16, 0.5, MOSS, undefined, 0.03);
      t.ball(0.75, 0.48, 0.5, 0.2, MOSS, [1.4, 0.5, 1], 0.2, 3);
    }
  }
};

/** Column drums lying where they fell, with the capital at one end. */
export const FALLEN_COLUMN: Element<At> = {
  colliders: (p) => [frameOf(p).box([-1.5, 0, -0.45], [1.5, 0.86, 0.45], 'stone')],
  draw(d, p) {
    const t = pen(d, p);
    for (const [x, len] of [[-1.45, 1.0], [-0.4, 1.0], [0.65, 0.7]] as const) t.cylX(x, 0.42, 0, 0.42, len - 0.04, '#b8402c', undefined, 0.02);
    t.box(1.15, 0, 0, 0.7, 0.86, 0.9, '#d8c9a3', undefined, 0.04);
    if (d.detail > 0) for (const x of [-0.45, 0.6]) t.cylX(x, 0.42, 0, 0.45, 0.1, GOLD, 'metal');
  }
};

/** Mossy jungle log. */
export const LOG: Element<At & { length?: number }> = {
  colliders: (p) => {
    const l = p.length ?? 3.2;
    return [frameOf(p).box([-l / 2, 0, -0.45], [l / 2, 0.9, 0.45], 'wood')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const l = p.length ?? 3.2;
    t.cylX(-l / 2, 0.45, 0, 0.45, l, WOOD, undefined, 0.04);
    if (d.detail > 0) {
      t.box(0, 0.78, 0, l * 0.6, 0.16, 0.5, MOSS, undefined, 0.04);
      t.cylX(l / 2 - 0.02, 0.45, 0, 0.36, 0.04, '#c9a27a');
      t.ball(-l / 4, 0.2, 0.45, 0.3, LEAF, [1.2, 0.8, 1], 0.2, 2);
    }
  }
};

/** Glazed urn with a plant. */
export const URN: Element<At & { color?: string }> = {
  colliders: (p) => [frameOf(p).box([-0.4, 0, -0.4], [0.4, 1.0, 0.4], 'stone')],
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color ?? '#2f7a8a';
    t.cyl(0, 0, 0, 0.26, 0.1, shade(c, -0.2));
    t.cone(0, 0.1, 0, 0.26, 0.42, 0.5, c);
    t.cone(0, 0.6, 0, 0.42, 0.24, 0.3, c);
    t.cyl(0, 0.9, 0, 0.27, 0.1, GOLD, 'metal');
    t.ball(0, 1.05, 0, 0.36, LEAF, [1, 0.8, 1], 0.25, 4);
  }
};

/** Guardian beast on a plinth (a stylised temple lion), facing local +z. */
export const GUARDIAN: Element<At> = {
  colliders: (p) => {
    const f = frameOf(p);
    return [f.box([-0.5, 0, -0.8], [0.5, 0.96, 0.8], 'stone'), f.box([-0.4, 0.96, -0.6], [0.4, 2.4, 0.5], 'stone')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const body = '#9fb3a0';
    t.box(0, 0, 0, 1.0, 0.8, 1.6, '#d8c9a3', undefined, 0.04);
    t.box(0, 0.8, 0, 1.1, 0.16, 1.7, GOLD, 'metal', 0.02);
    t.box(0, 0.96, -0.25, 0.7, 0.6, 0.7, body, undefined, 0.06);
    t.box(0, 0.96, 0.25, 0.6, 0.9, 0.5, body, undefined, 0.06);
    t.ball(0, 1.95, 0.25, 0.42, shade(body, -0.12), [1.1, 1, 0.9], 0.15, 5);
    t.box(0, 1.8, 0.45, 0.46, 0.4, 0.36, body, undefined, 0.06);
    if (d.detail > 0) {
      t.box(0, 1.82, 0.64, 0.3, 0.14, 0.04, '#b8402c', undefined, 0);
      for (const s of [-1, 1]) t.ball(s * 0.13, 2.08, 0.62, 0.06, GOLD, undefined, 0, 1, 'metal');
      t.ball(0.18, 1.08, 0.5, 0.16, GOLD, undefined, 0, 1, 'metal');
      for (const s of [-1, 1]) t.box(s * 0.18, 0.96, 0.52, 0.18, 0.3, 0.2, body, undefined, 0.04);
    }
  }
};

/** Lotus pool: a low sandstone basin (players can wade), lily pads and a fountain rising from a gold bud. */
export const LOTUS_POOL: Element<At> = {
  colliders(p) {
    const f = frameOf(p);
    const H = 1.4;
    const R = 0.32;
    const h = 0.56;
    const out: PlanCollider[] = [
      f.box([-H, 0, -H], [H, h, -H + R], 'stone'),
      f.box([-H, 0, H - R], [H, h, H], 'stone'),
      f.box([-H, 0, -H + R], [-H + R, h, H - R], 'stone'),
      f.box([H - R, 0, -H + R], [H, h, H - R], 'stone'),
      f.box([-H + R, 0, -H + R], [H - R, 0.16, H - R], 'water', { walk: true }),
      f.box([-0.3, 0.16, -0.3], [0.3, 1.0, 0.3], 'stone')
    ];
    return out;
  },
  draw(d, p) {
    const f = frameOf(p);
    const t = pen(d, p);
    const H = 1.4;
    const R = 0.32;
    const h = 0.56;
    const rim = (a: Vec3, b: Vec3) => {
      const [x0, y0, z0] = f.p(...a);
      const [x1, y1, z1] = f.p(...b);
      drawBlock(d, { min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], surface: 'stone', style: RIM, top: 'tiles', topColor: '#e2d5b2' });
    };
    rim([-H, 0, -H], [H, h, -H + R]);
    rim([-H, 0, H - R], [H, h, H]);
    rim([-H, 0, -H + R], [-H + R, h, H - R]);
    rim([H - R, 0, -H + R], [H, h, H - R]);
    t.box(0, 0, 0, 2 * (H - R), 0.16, 2 * (H - R), '#2a6f6a', undefined, 0);
    const [wx, , wz] = f.p(0, 0, 0);
    d.anim.water(wx - H + R, wz - H + R, wx + H - R, wz + H - R, 0.4, '#3aa69a');
    t.cyl(0, 0.16, 0, 0.3, 0.6, '#d8c9a3', undefined, 0.03);
    t.cone(0, 0.76, 0, 0.2, 0.36, 0.16, GOLD, 'metal');
    t.ball(0, 0.96, 0, 0.18, GOLD, [1, 1.3, 1], 0, 1, 'metal');
    const rng = new Rng(Math.round(p.x * 5 + p.z * 3));
    const pads = d.detail === 0 ? 3 : 6;
    for (let i = 0; i < pads; i++) {
      const a = (i / pads) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const r = rng.range(0.6, 0.85);
      t.cyl(Math.cos(a) * r, 0.41, Math.sin(a) * r, rng.range(0.16, 0.24), 0.03, LEAF);
      if (d.detail > 0 && i % 2 === 0) t.cone(Math.cos(a) * r, 0.44, Math.sin(a) * r, 0.04, 0.12, 0.12, '#f4a6c4', undefined, 6);
    }
    d.anim.jet(f.p(0, 1.06, 0), 0.55, 0.9);
  }
};

/** Expedition awning: four poles, a canvas roof and a field table under it (only the table blocks). */
export const AWNING: Element<At & { color: string }> = {
  colliders: (p) => [frameOf(p).box([-0.8, 0, -0.45], [0.8, 0.8, 0.45], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.cyl(sx * 1.5, 0, sz * 1.1, 0.05, sz < 0 ? 2.5 : 2.2, '#6e4a2f');
    t.prism('awning', [[-1.25, 2.15], [1.25, 2.45], [1.25, 2.52], [-1.25, 2.22]], 3.3, 0, 0, 0, p.color);
    if (d.detail > 0) t.prism('awning-hem', [[1.25, 2.3], [1.3, 2.3], [1.3, 2.52], [1.25, 2.52]], 3.3, 0, 0, 0, shade(p.color, -0.25));
    t.box(0, 0.72, 0, 1.6, 0.08, 0.9, WOOD, undefined, 0.02);
    for (const sx of [-1, 1]) t.box(sx * 0.7, 0, 0, 0.08, 0.72, 0.8, shade(WOOD, -0.15), undefined, 0);
    if (d.detail > 0) {
      t.box(-0.2, 0.8, 0.05, 0.7, 0.02, 0.5, '#efe3c2', undefined, 0);
      t.cyl(0.5, 0.8, -0.1, 0.1, 0.22, '#3a4148', 'metal');
    }
  }
};

/** A string of small prayer flags from a to b, sagging in the middle. */
export function prayerFlags(d: Drawer, a: Vec3, b: Vec3, count: number) {
  const colors = ['#2f6ad0', '#f2f2ee', '#c8231b', '#2f9a4a', '#f6c624'];
  const yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
  const sag = Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.06;
  const at = (u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u];
  const t = pen(d, { x: 0, z: 0 });
  for (let i = 0; i < 6; i++) {
    const p = at(i / 6);
    const q = at((i + 1) / 6);
    t.beam(p[0], p[1], p[2], q[0], q[1], q[2], 0.025, '#e9e1cc');
  }
  for (let i = 0; i < count; i++) {
    const [x, y, z] = at((i + 0.5) / count);
    t.box(x, y - 0.46, z, 0.36, 0.44, 0.02, colors[i % colors.length]!, undefined, 0, yaw);
  }
}

/** Low fern clumps along a wall foot (no collider: knee-high, players brush through them). */
export function ferns(d: Drawer, from: [number, number], to: [number, number], seed: number) {
  const t = pen(d, { x: 0, z: 0 });
  const rng = new Rng(seed);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.floor(len / (d.detail === 0 ? 4.0 : 2.2));
  for (let i = 0; i < n; i++) {
    if (rng.chance(0.3)) continue;
    const u = (i + rng.range(0.2, 0.8)) / n;
    const x = from[0] + (to[0] - from[0]) * u;
    const z = from[1] + (to[1] - from[1]) * u;
    const s = rng.range(0.7, 1.2);
    const c = rng.pick([LEAF, MOSS, '#2f7a34']);
    t.cyl(x, 0, z, 0.16 * s, 0.32 * s, shade(c, -0.15), undefined, 0.03, 6);
    const fronds = d.detail === 0 ? 3 : 6;
    const a0 = rng.range(0, Math.PI);
    for (let k = 0; k < fronds; k++) {
      const a = a0 + (k / fronds) * Math.PI * 2;
      const r = 0.38 * s;
      t.box(x + Math.sin(a) * r, 0.12 + (k % 2) * 0.1, z + Math.cos(a) * r, 0.16, 0.06, 0.7 * s, k % 2 ? c : shade(c, 0.1), undefined, 0, a);
    }
  }
}

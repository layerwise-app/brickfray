import { drawBlock, type Masonry } from './blocks';
import type { Element } from './plan';
import { frameOf, pen, type At } from './props-kit';
import { Rng, type PlanCollider } from './util';

const STONE: Masonry = { colors: ['#e7e1d2', '#d9d2c1', '#f2ede2'], variance: 0.3, lens: [3, 4, 2] };
const POOL = '#3aa6c9';

/** Square fountain basin (6.4 m) with a two-bowl centerpiece; players can wade in. */
export const FOUNTAIN: Element<At> = {
  colliders(p) {
    const f = frameOf(p);
    const H = 3.2;
    const R = 0.4;
    const h = 0.64;
    const out: PlanCollider[] = [
      f.box([-H, 0, -H], [H, h, -H + R], 'stone'),
      f.box([-H, 0, H - R], [H, h, H], 'stone'),
      f.box([-H, 0, -H + R], [-H + R, h, H - R], 'stone'),
      f.box([H - R, 0, -H + R], [H, h, H - R], 'stone'),
      f.box([-H + R, 0, -H + R], [H - R, 0.16, H - R], 'water', { walk: true }),
      f.box([-0.75, 0.16, -0.75], [0.75, 1.25, 0.75], 'stone')
    ];
    for (const [a, b] of [[1.55, 0.65], [0.65, 1.55], [1.15, 1.15]] as const) out.push(f.box([-a, 1.25, -b], [a, 1.52, b], 'stone'));
    out.push(f.box([-0.25, 1.52, -0.25], [0.25, 2.62, 0.25], 'stone'));
    return out;
  },
  draw(d, p) {
    const f = frameOf(p);
    const t = pen(d, p);
    const H = 3.2;
    const R = 0.4;
    const h = 0.64;
    const wall = (a: [number, number, number], b: [number, number, number]) => {
      const [x0, y0, z0] = f.p(...a);
      const [x1, y1, z1] = f.p(...b);
      drawBlock(d, { min: [Math.min(x0, x1), y0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)], surface: 'stone', style: STONE, top: 'studs', topColor: '#f2f2ee' });
    };
    wall([-H, 0, -H], [H, h, -H + R]);
    wall([-H, 0, H - R], [H, h, H]);
    wall([-H, 0, -H + R], [-H + R, h, H - R]);
    wall([H - R, 0, -H + R], [H, h, H - R]);
    t.box(0, 0, 0, 2 * (H - R), 0.16, 2 * (H - R), POOL, undefined, 0);
    const [wx, , wz] = f.p(0, 0, 0);
    d.anim.water(wx - H + R, wz - H + R, wx + H - R, wz + H - R, 0.44, '#5cc4e4');
    t.cyl(0, 0.16, 0, 0.9, 0.32, '#d9d2c1', undefined, 0.04);
    t.cyl(0, 0.48, 0, 0.5, 0.77, '#e7e1d2', undefined, 0.03);
    if (d.detail > 0) for (const y of [0.62, 1.05]) t.cyl(0, y, 0, 0.56, 0.08, '#c99a3e', 'chrome');
    t.cone(0, 1.25, 0, 0.5, 1.6, 0.27, '#e7e1d2', undefined, t.segs + 6);
    t.cyl(0, 1.38, 0, 1.47, 0.08, '#8fd3ea', 'glass', 0, t.segs + 6);
    if (d.detail > 0) t.ring(0, 1.46, 0, 1.56, 0.06, '#f2ede2');
    t.cyl(0, 1.52, 0, 0.2, 0.7, '#e7e1d2', undefined, 0.02);
    t.cone(0, 2.2, 0, 0.22, 0.8, 0.2, '#e7e1d2', undefined, t.segs);
    t.cyl(0, 2.33, 0, 0.72, 0.05, '#8fd3ea', 'glass');
    t.ball(0, 2.5, 0, 0.16, '#c99a3e', undefined, 0, 1, 'chrome');
    const [jx, jy, jz] = f.p(0, 2.6, 0);
    d.anim.jet([jx, jy, jz], 0.75, 1.35);
    if (d.detail >= 2) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        t.ball(Math.cos(a) * 1.15, 0.5, Math.sin(a) * 1.15, 0.12, '#f2ede2');
      }
    }
  }
};

const PRODUCE = [
  ['#f58a1f', '#f5a623'],
  ['#c8231b', '#e0442f'],
  ['#a6c629', '#5aa83f'],
  ['#f6c624', '#f3e6b8'],
  ['#6a3d9a', '#8e5cc0']
];

/** Market stall facing local +z with a striped awning. */
export const STALL: Element<At & { colors: [string, string]; seed?: number }> = {
  colliders(p) {
    const f = frameOf(p);
    const out: PlanCollider[] = [f.box([-1.3, 0, -0.05], [1.3, 1.12, 0.75], 'wood'), f.box([-1.1, 0, -0.75], [1.1, 0.5, -0.35], 'wood')];
    for (const x of [-1.3, 1.3]) for (const z of [-0.8, 0.62]) out.push(f.box([x - 0.06, 0, z - 0.06], [x + 0.06, 2.3, z + 0.06], 'wood'));
    out.push(f.box([-1.45, 2.3, -1.0], [1.45, 2.72, 1.05], 'plastic', { bulletsPass: true }));
    return out;
  },
  draw(d, p) {
    const t = pen(d, p);
    const rng = new Rng(p.seed ?? Math.round(p.x * 5 + p.z * 11));
    const [a, b] = p.colors;
    t.box(0, 0, 0.35, 2.6, 0.9, 0.8, '#b98a5a', undefined, 0.02);
    t.box(0, 0.12, 0.76, 2.4, 0.62, 0.04, a, undefined, 0.01);
    t.box(0, 0.9, 0.35, 2.7, 0.06, 0.9, '#e7e1d2', undefined, 0.01);
    for (const x of [-1.3, 1.3]) {
      t.box(x, 0, -0.8, 0.1, 2.68, 0.1, '#8a5f3a', undefined, 0.01);
      t.box(x, 0, 0.62, 0.1, 2.3, 0.1, '#8a5f3a', undefined, 0.01);
    }
    const stripes = 6;
    const w = 2.9 / stripes;
    for (let i = 0; i < stripes; i++) {
      t.prism('awning', [[-1.0, 2.64], [1.05, 2.26], [1.05, 2.31], [-1.0, 2.7]], w, -1.45 + w * (i + 0.5), 0, 0, i % 2 ? b : a);
      t.box(-1.45 + w * (i + 0.5), 2.04, 1.05, w - 0.02, 0.26, 0.04, i % 2 ? a : b, undefined, 0.01);
    }
    for (let i = 0; i < 3; i++) {
      const x = -0.85 + i * 0.85;
      const [c1, c2] = rng.pick(PRODUCE);
      t.box(x, 0.96, 0.35, 0.74, 0.16, 0.62, '#9a6a3f', undefined, 0.01);
      const n = d.detail === 2 ? 4 : 3;
      for (let ix = 0; ix < n; ix++) {
        for (let iz = 0; iz < 3; iz++) {
          t.ball(x - 0.27 + (ix * 0.54) / (n - 1), 1.14 + (ix + iz) % 2 * 0.03, 0.15 + iz * 0.2, 0.085, (ix + iz) % 3 ? c1! : c2!);
        }
      }
    }
    t.box(0, 0, -0.55, 2.2, 0.5, 0.4, '#9a6a3f', undefined, 0.02);
  }
};

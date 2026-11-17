import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { Rng, shade } from './util';

export type TreeKind = 'oak' | 'pine' | 'poplar' | 'blossom' | 'birch';

export interface TreeParams extends At {
  kind: TreeKind;
  size?: number;
  seed?: number;
}

const GREENS = ['#3f8f3a', '#2f7a34', '#5aa83f', '#246b35'];
const PINES = ['#1f5a32', '#2a6a3a', '#174a2b'];
const BLOSSOM = ['#f6a9c6', '#f8c3d6', '#ee8db3', '#fbe0ea'];
const BARK = '#6e4a2f';

/** Trunk height in meters before scaling; players collide with the trunk only. */
const TRUNK: Record<TreeKind, number> = { oak: 2.4, pine: 1.4, poplar: 1.9, blossom: 2.1, birch: 2.6 };

function canopy(p: Pen, rng: Rng, cy: number, s: number, colors: string[], spread: number) {
  const det = p.detail;
  const lumps = det === 0 ? 1 : det === 1 ? 7 : 12;
  if (det === 0) {
    p.ball(0, cy, 0, 1.5 * s * spread, colors[0]!, [1, 0.85, 1]);
    return;
  }
  p.ball(0, cy, 0, 1.25 * s * spread, colors[0]!, [1, 0.9, 1], 0.12, 3);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const ring = i % 3 === 0 ? 0.45 : 1;
    const r = rng.range(0.55, 0.8) * s * spread;
    const dist = 1.05 * s * spread * ring;
    const y = cy + (ring < 1 ? 0.75 * s : rng.range(-0.35, 0.35) * s);
    p.ball(Math.cos(a) * dist, y, Math.sin(a) * dist, r, colors[(i + 1) % colors.length]!, [1, 0.88, 1], 0.18, (i % 4) + 1);
  }
}

/** Toy canopy of stacked rounded discs with leaf clumps poking out. */
function discCanopy(p: Pen, rng: Rng, y0: number, s: number, radii: number[], colors: string[]) {
  if (p.detail === 0) {
    const r = Math.max(...radii) * s;
    p.cone(0, y0, 0, r * 0.75, r * 0.45, radii.length * 0.32 * s * 0.45, colors[0]!, undefined, 7);
    p.cone(0, y0 + radii.length * 0.32 * s * 0.45, 0, r, r * 0.35, radii.length * 0.32 * s * 0.55, colors[1] ?? colors[0]!, undefined, 7);
    return;
  }
  const h = 0.32 * s;
  radii.forEach((r, i) => {
    const jx = rng.range(-0.08, 0.08) * s;
    const jz = rng.range(-0.08, 0.08) * s;
    p.cyl(jx, y0 + i * h, jz, r * s, h - 0.01, colors[i % colors.length]!, undefined, 0.07 * s, p.detail === 2 ? 12 : 9);
  });
  const widest = radii.indexOf(Math.max(...radii));
  const clumps = p.detail === 2 ? 7 : 4;
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const layer = Math.max(0, Math.min(radii.length - 2, widest + rng.int(-2, 1)));
    const r = radii[layer]! * s;
    p.cyl(Math.cos(a) * r * 0.9, y0 + layer * h - h * 0.3, Math.sin(a) * r * 0.9, 0.42 * s, h * 1.6, colors[(i + 1) % colors.length]!, undefined, 0.08 * s, 8);
  }
  if (p.detail === 2) {
    const top = radii.length;
    for (let i = 0; i < 3; i++) p.cyl(rng.range(-0.25, 0.25) * s, y0 + top * h - 0.02, rng.range(-0.25, 0.25) * s, 0.12, 0.09, colors[0]!, undefined, 0.02, 8);
  }
}

function trunk(p: Pen, h: number, r: number, color: string) {
  p.cyl(0, 0, 0, r * 1.5, 0.16, shade(color, -0.1), undefined, 0.03);
  if (p.detail === 0) {
    p.box(0, 0, 0, r * 1.8, h, r * 1.8, color, undefined, 0);
    return;
  }
  const seg = 0.48;
  for (let y = 0.16, i = 0; y < h - 0.01; y += seg, i++) p.cyl(0, y, 0, r * (1 - i * 0.03), Math.min(seg, h - y) - 0.004, i % 2 ? shade(color, 0.06) : color, undefined, 0.02);
}

export const TREE: Element<TreeParams> = {
  colliders(p) {
    const s = p.size ?? 1;
    const r = (p.kind === 'pine' ? 0.22 : 0.26) * s;
    return [frameOf(p).box([-r, 0, -r], [r, TRUNK[p.kind] * s, r], 'wood')];
  },
  draw(d, p) {
    const s = p.size ?? 1;
    const rng = new Rng(p.seed ?? Math.round(p.x * 31 + p.z * 17));
    const t = pen(d, p);
    const h = TRUNK[p.kind] * s;
    switch (p.kind) {
      case 'oak': {
        trunk(t, h, 0.2 * s, BARK);
        discCanopy(t, rng, h - 0.1 * s, s, [1.0, 1.5, 1.75, 1.8, 1.65, 1.35, 0.95, 0.5], [GREENS[0]!, GREENS[1]!, GREENS[2]!]);
        break;
      }
      case 'blossom': {
        trunk(t, h, 0.2 * s, BARK);
        if (d.detail > 0) {
          t.cylX(0.35 * s, h * 0.8, 0, 0.08 * s, 0.7 * s, BARK);
          t.cylZ(0, h * 0.7, -0.3 * s, 0.07 * s, 0.6 * s, BARK);
        }
        canopy(t, rng, h + 0.9 * s, s, BLOSSOM, 0.85);
        break;
      }
      case 'birch': {
        trunk(t, h, 0.15 * s, '#ece8dc');
        if (d.detail > 0) for (let i = 0; i < 5; i++) t.box(0, 0.4 + i * 0.5 * s, 0, 0.32 * s, 0.06, 0.32 * s, '#2f363d', undefined, 0, i);
        canopy(t, rng, h + 0.8 * s, s * 0.8, ['#8fc23f', '#6fae3a', '#a6c629'], 0.9);
        break;
      }
      case 'pine': {
        trunk(t, h, 0.16 * s, BARK);
        const tiers = d.detail === 0 ? 2 : 4;
        for (let i = 0; i < tiers; i++) {
          const k = i / tiers;
          const r0 = (1.55 - k * 1.05) * s;
          const height = (d.detail === 0 ? 2.2 : 1.35) * s;
          const y = h * 0.7 + i * (d.detail === 0 ? 1.6 : 0.95) * s;
          t.cone(0, y, 0, r0, i === tiers - 1 ? 0 : r0 * 0.28, height, PINES[i % PINES.length]!, undefined, d.detail === 0 ? 7 : 9);
        }
        break;
      }
      case 'poplar': {
        trunk(t, h, 0.16 * s, BARK);
        discCanopy(t, rng, h - 0.2 * s, s, [0.6, 0.85, 0.95, 1.0, 1.0, 0.95, 0.9, 0.85, 0.75, 0.65, 0.5, 0.3], [PINES[1]!, GREENS[1]!, GREENS[3]!]);
        break;
      }
    }
  }
};

export interface BushParams extends At {
  size?: number;
  flowers?: string;
  seed?: number;
}

export const BUSH: Element<BushParams> = {
  colliders(p) {
    const s = p.size ?? 1;
    return [frameOf(p).box([-0.7 * s, 0, -0.7 * s], [0.7 * s, 0.85 * s, 0.7 * s], 'foliage', { bulletsPass: true })];
  },
  draw(d, p) {
    const s = p.size ?? 1;
    const t = pen(d, p);
    const rng = new Rng(p.seed ?? Math.round(p.x * 13 + p.z * 7));
    if (d.detail === 0) {
      t.ball(0, 0.4 * s, 0, 0.75 * s, GREENS[0]!, [1, 0.7, 1]);
      return;
    }
    const n = d.detail === 1 ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(0, 0.6);
      const dist = i === 0 ? 0 : 0.38 * s;
      t.ball(Math.cos(a) * dist, 0.42 * s, Math.sin(a) * dist, rng.range(0.38, 0.5) * s, GREENS[i % GREENS.length]!, [1, 0.85, 1], 0.2, (i % 3) + 1);
    }
    if (p.flowers && d.detail >= 2) {
      for (let i = 0; i < 7; i++) {
        const a = rng.range(0, Math.PI * 2);
        const dist = rng.range(0.1, 0.55) * s;
        t.ball(Math.cos(a) * dist, 0.72 * s + rng.range(-0.1, 0.05), Math.sin(a) * dist, 0.07, i % 3 ? p.flowers : '#fff6d8');
      }
    }
  }
};

export interface FlowerBedParams extends At {
  w: number;
  dd: number;
  colors: string[];
  seed?: number;
}

/** Flowers on a soil plate; sits inside a planter whose collider covers it. */
export const FLOWERS: Element<FlowerBedParams> = {
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, p.w, 0.08, p.dd, '#5a3c26', undefined, 0);
    if (d.detail === 0) {
      t.box(0, 0.08, 0, p.w * 0.9, 0.18, p.dd * 0.9, '#4f9a3c', undefined, 0);
      return;
    }
    const rng = new Rng(p.seed ?? Math.round(p.x * 7 + p.z * 3));
    const step = d.detail === 2 ? 0.34 : 0.5;
    t.box(0, 0.06, 0, p.w - 0.1, 0.1, p.dd - 0.1, '#3f8f3a', undefined, 0);
    for (let x = -p.w / 2 + step / 2; x < p.w / 2; x += step) {
      for (let z = -p.dd / 2 + step / 2; z < p.dd / 2; z += step) {
        const jx = x + rng.range(-0.07, 0.07);
        const jz = z + rng.range(-0.07, 0.07);
        const h = rng.range(0.12, 0.28);
        t.box(jx, 0.1, jz, 0.04, h, 0.04, '#2f7a34', undefined, 0);
        t.cyl(jx, 0.1 + h, jz, 0.08, 0.05, rng.pick(p.colors), undefined, 0.02, 6);
      }
    }
  }
};

export interface RockParams extends At {
  size?: number;
  seed?: number;
  color?: string;
}

export const ROCK: Element<RockParams> = {
  colliders(p) {
    const s = p.size ?? 1;
    return [frameOf(p).box([-0.75 * s, 0, -0.6 * s], [0.75 * s, 0.85 * s, 0.6 * s], 'stone')];
  },
  draw(d, p) {
    const s = p.size ?? 1;
    const t = pen(d, p);
    const c = p.color ?? '#8d9196';
    const seed = p.seed ?? 1;
    t.ball(0, 0.35 * s, 0, 0.8 * s, c, [1.05, 0.62, 0.85], 0.32, seed);
    if (d.detail > 0) {
      t.ball(0.45 * s, 0.25 * s, 0.25 * s, 0.45 * s, shade(c, 0.1), [1, 0.7, 1], 0.3, seed + 1);
      t.ball(-0.4 * s, 0.6 * s, -0.1 * s, 0.4 * s, shade(c, -0.08), [1, 0.75, 1], 0.3, seed + 2);
    }
  }
};

export interface HedgeParams extends At {
  /** Length along local x. */
  length: number;
  height?: number;
  depth?: number;
}

export const HEDGE: Element<HedgeParams> = {
  colliders(p) {
    const h = p.height ?? 1.1;
    const dd = p.depth ?? 0.8;
    return [frameOf(p).box([-p.length / 2, 0, -dd / 2], [p.length / 2, h, dd / 2], 'foliage', { bulletsPass: true })];
  },
  draw(d, p) {
    const h = p.height ?? 1.1;
    const dd = p.depth ?? 0.8;
    const t = pen(d, p);
    t.box(0, 0, 0, p.length - 0.04, h - 0.2, dd - 0.04, '#2f7a34', undefined, 0.06);
    if (d.detail === 0) return;
    const n = Math.max(2, Math.round(p.length / 0.55));
    for (let i = 0; i < n; i++) {
      const x = -p.length / 2 + (i + 0.5) * (p.length / n);
      t.ball(x, h - 0.26, 0, dd * 0.42, GREENS[i % GREENS.length]!, [1.2, 0.8, 1], 0.16, (i % 3) + 1);
    }
  }
};

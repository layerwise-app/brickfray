import type { Element } from './plan';
import { frameOf, pen, type At } from './props-kit';
import type { PlanCollider } from './util';

const IRON = '#2f363d';
const LAMP_GLOW = '#ffe2a0';

export const LAMP: Element<At & { color?: string; double?: boolean }> = {
  colliders: (p) => [frameOf(p).box([-0.17, 0, -0.17], [0.17, 3.7, 0.17], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color ?? IRON;
    t.box(0, 0, 0, 0.34, 0.24, 0.34, c, 'metal', 0.03);
    t.cyl(0, 0.24, 0, 0.12, 0.3, c, 'metal', 0.03);
    t.cyl(0, 0.5, 0, 0.065, 3.0, c, 'metal');
    const heads = p.double ? [-1, 1] : [1];
    for (const s of heads) {
      if (d.detail > 0) {
        t.box(s * 0.32, 3.32, 0, 0.6, 0.06, 0.06, c, 'metal', 0.01);
        t.cyl(s * 0.62, 3.0, 0, 0.03, 0.34, c, 'metal');
      }
      const hx = s * (d.detail > 0 ? 0.62 : 0.3);
      t.cone(hx, 2.68, 0, 0.13, 0.2, 0.08, c, 'metal');
      t.box(hx, 2.76, 0, 0.3, 0.32, 0.3, '#fff3d0', 'glass', 0.01);
      t.box(hx, 2.8, 0, 0.12, 0.2, 0.12, LAMP_GLOW, 'glow', 0);
      t.cone(hx, 3.08, 0, 0.24, 0.04, 0.16, c, 'metal');
      if (d.detail >= 2) t.ball(hx, 3.27, 0, 0.045, '#c99a3e', undefined, 0, 1, 'chrome');
    }
    if (d.detail >= 2) t.ball(0, 3.55, 0, 0.07, '#c99a3e', undefined, 0, 1, 'chrome');
  }
};

export const BENCH: Element<At & { color?: string }> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-0.9, 0, -0.28], [0.9, 0.47, 0.25], 'wood'), f.box([-0.9, 0.47, 0.12], [0.9, 0.92, 0.28], 'wood')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const wood = p.color ?? '#9a6a3f';
    for (const x of [-0.72, 0.72]) {
      t.box(x, 0, 0, 0.08, 0.44, 0.5, IRON, 'metal', 0.01);
      t.box(x, 0.44, 0.2, 0.08, 0.48, 0.08, IRON, 'metal', 0.01);
    }
    const slats = d.detail === 0 ? 1 : 3;
    for (let i = 0; i < slats; i++) t.box(0, 0.42, -0.18 + (i * 0.36) / Math.max(1, slats - 1) - (slats === 1 ? -0.18 : 0), 1.8, 0.05, slats === 1 ? 0.5 : 0.13, wood, undefined, 0.012);
    const back = d.detail === 0 ? 1 : 2;
    for (let i = 0; i < back; i++) t.box(0, 0.58 + i * 0.18, 0.22, 1.8, back === 1 ? 0.3 : 0.12, 0.05, wood, undefined, 0.012);
  }
};

export const CONE: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.19, 0, -0.19], [0.19, 0.62, 0.19], 'plastic')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, 0.38, 0.05, 0.38, '#f05a1a', undefined, 0.01);
    t.cone(0, 0.05, 0, 0.15, 0.03, 0.56, '#f5701f', undefined, d.detail === 0 ? 8 : 14);
    if (d.detail > 0) t.cone(0, 0.28, 0, 0.098, 0.074, 0.11, '#f4f4ee', undefined, 14);
  }
};

/** Striped roadwork / crowd barrier, 2 m long along local x. */
export const BARRIER: Element<At & { colors?: [string, string] }> = {
  colliders: (p) => [frameOf(p).box([-1, 0, -0.2], [1, 1.05, 0.2], 'plastic', { bulletsPass: true })],
  draw(d, p) {
    const t = pen(d, p);
    const [a, b] = p.colors ?? ['#d8231b', '#f4f4ee'];
    for (const x of [-0.85, 0.85]) {
      t.box(x, 0, 0, 0.16, 0.08, 0.4, '#2f363d', 'rubber', 0.01);
      t.box(x, 0.08, 0, 0.08, 0.95, 0.08, '#b7bcc2', 'metal', 0.01);
    }
    const n = d.detail === 0 ? 1 : 5;
    for (let i = 0; i < n; i++) {
      const w = 1.9 / n;
      t.box(-0.95 + w * (i + 0.5), 0.7, 0, w - 0.01, 0.24, 0.06, i % 2 ? b : a, undefined, 0.01);
    }
    if (d.detail > 0) t.box(0, 0.3, 0, 1.7, 0.08, 0.05, a, undefined, 0.01);
  }
};

export type FenceKind = 'picket' | 'iron' | 'chain' | 'wood';

export interface FenceParams extends At {
  /** Length along local x. */
  length: number;
  kind: FenceKind;
  height?: number;
  color?: string;
}

const FENCE_H: Record<FenceKind, number> = { picket: 1.0, iron: 1.5, chain: 2.6, wood: 1.6 };

export const FENCE: Element<FenceParams> = {
  colliders(p) {
    const h = p.height ?? FENCE_H[p.kind];
    return [frameOf(p).box([-p.length / 2, 0, -0.1], [p.length / 2, h, 0.1], p.kind === 'wood' || p.kind === 'picket' ? 'wood' : 'metal', { bulletsPass: true })];
  },
  draw(d, p) {
    const t = pen(d, p);
    const h = p.height ?? FENCE_H[p.kind];
    const L = p.length;
    const metal = p.kind === 'iron' || p.kind === 'chain';
    const c = p.color ?? (p.kind === 'picket' ? '#f2f2ee' : p.kind === 'iron' ? IRON : p.kind === 'chain' ? '#9aa1a8' : '#8a5f3a');
    const finish = metal ? 'metal' : undefined;
    const posts = Math.max(2, Math.round(L / (p.kind === 'chain' ? 2.4 : 1.6)) + 1);
    for (let i = 0; i < posts; i++) {
      const x = -L / 2 + (i * L) / (posts - 1);
      if (p.kind === 'chain') t.cyl(x, 0, 0, 0.05, h, c, 'metal');
      else t.box(x, 0, 0, 0.12, h + 0.06, 0.12, c, finish, 0.015);
      if (p.kind === 'iron' && d.detail >= 1) t.ball(x, h + 0.1, 0, 0.07, '#c99a3e', undefined, 0, 1, 'chrome');
    }
    for (const y of p.kind === 'picket' ? [0.25, 0.75] : p.kind === 'chain' ? [0.05, h - 0.05] : [0.18, h - 0.2]) t.box(0, y - 0.03, 0, L, 0.06, 0.05, c, finish, 0.01);
    if (d.detail === 0 && p.kind !== 'picket') {
      t.box(0, 0.1, 0, L, h - 0.2, 0.02, c, p.kind === 'chain' ? 'glass' : finish, 0);
      return;
    }
    if (p.kind === 'chain') {
      const n = Math.round(L / (d.detail === 2 ? 0.16 : 0.3));
      for (let i = 1; i < n; i++) t.box(-L / 2 + (i * L) / n, 0.05, 0, 0.012, h - 0.1, 0.012, c, 'metal', 0);
      const rows = Math.round(h / (d.detail === 2 ? 0.16 : 0.3));
      for (let i = 1; i < rows; i++) t.box(0, (i * h) / rows, 0, L, 0.012, 0.012, c, 'metal', 0);
      return;
    }
    const gap = p.kind === 'iron' ? 0.16 : p.kind === 'picket' ? 0.2 : 0.22;
    const n = Math.floor(L / gap);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * (L / n);
      if (p.kind === 'iron') t.box(x, 0.12, 0, 0.035, h - 0.12, 0.035, c, 'metal', 0);
      else if (p.kind === 'picket') {
        t.box(x, 0.05, 0, 0.12, 0.85, 0.04, c, undefined, 0.01);
        if (d.detail >= 2) t.prism('picket-tip', [[-0.02, 0], [0.02, 0], [0.02, 0.06], [0, 0.12], [-0.02, 0.06]], 0.12, x, 0.9, 0, c, undefined, Math.PI / 2);
      } else t.box(x, 0.02, 0, gap - 0.02, h - 0.04, 0.04, i % 2 ? c : '#7d5434', undefined, 0.01);
    }
  }
};

export const BIN: Element<At & { color?: string }> = {
  colliders: (p) => [frameOf(p).box([-0.28, 0, -0.28], [0.28, 0.95, 0.28], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color ?? '#2f6a4a';
    t.cyl(0, 0, 0, 0.27, 0.86, c, 'metal', 0.03);
    t.cyl(0, 0.86, 0, 0.29, 0.06, '#2f363d', 'metal', 0.02);
    if (d.detail > 0) for (const y of [0.2, 0.6]) t.cyl(0, y, 0, 0.28, 0.04, '#b7bcc2', 'chrome');
  }
};

export const HYDRANT: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.2, 0, -0.2], [0.2, 0.75, 0.2], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    t.cyl(0, 0, 0, 0.17, 0.08, '#a8170f', 'metal', 0.02);
    t.cyl(0, 0.08, 0, 0.12, 0.5, '#d8231b', 'metal', 0.02);
    t.cyl(0, 0.58, 0, 0.14, 0.06, '#d8231b', 'metal', 0.02);
    t.cone(0, 0.64, 0, 0.12, 0.04, 0.1, '#d8231b', 'metal');
    if (d.detail > 0) t.cylX(0, 0.42, 0, 0.05, 0.4, '#c99a3e', 'chrome');
  }
};

export const BOLLARD: Element<At & { color?: string; tall?: boolean }> = {
  colliders: (p) => [frameOf(p).box([-0.15, 0, -0.15], [0.15, p.tall ? 0.95 : 0.6, 0.15], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    const h = p.tall ? 0.85 : 0.5;
    t.cyl(0, 0, 0, 0.12, h, p.color ?? IRON, 'metal', 0.02);
    t.cyl(0, h, 0, 0.15, 0.08, p.color ?? IRON, 'metal', 0.03);
    if (d.detail > 0) t.cyl(0, h * 0.75, 0, 0.125, 0.06, '#f4f4ee', undefined);
  }
};

/** Café table with a parasol and two chairs; chairs face local ±x. */
export const CAFE_TABLE: Element<At & { canopy: string; trim?: string }> = {
  colliders(p) {
    const f = frameOf(p);
    const out: PlanCollider[] = [f.box([-0.45, 0, -0.45], [0.45, 0.76, 0.45], 'wood')];
    out.push(f.box([-1.0, 0, -0.24], [-0.56, 0.9, 0.24], 'wood'), f.box([0.56, 0, -0.24], [1.0, 0.9, 0.24], 'wood'));
    out.push(f.box([-1.35, 2.1, -1.35], [1.35, 2.5, 1.35], 'plastic', { bulletsPass: true }));
    return out;
  },
  draw(d, p) {
    const t = pen(d, p);
    t.cyl(0, 0, 0, 0.26, 0.04, IRON, 'metal');
    t.cyl(0, 0.04, 0, 0.04, 0.68, IRON, 'metal');
    t.cyl(0, 0.72, 0, 0.45, 0.04, '#f2f2ee', undefined, 0.015);
    for (const s of [-1, 1]) {
      const x = s * 0.78;
      t.box(x, 0.44, 0, 0.42, 0.05, 0.42, '#c8231b', undefined, 0.01);
      t.box(x + s * 0.19, 0.49, 0, 0.05, 0.42, 0.42, '#c8231b', undefined, 0.01);
      if (d.detail > 0) for (const z of [-0.17, 0.17]) for (const dx of [-0.17, 0.17]) t.box(x + dx, 0, z, 0.035, 0.44, 0.035, IRON, 'metal', 0);
      else t.box(x, 0, 0, 0.3, 0.44, 0.3, IRON, 'metal', 0);
    }
    t.cyl(0, 0.76, 0, 0.025, 1.5, '#e7e1d2');
    const ribs = d.detail === 0 ? 1 : 8;
    if (ribs === 1) t.cone(0, 2.1, 0, 1.35, 0.06, 0.4, p.canopy, undefined, 8);
    else {
      t.cone(0, 2.1, 0, 1.35, 0.06, 0.4, p.canopy, undefined, 8);
      t.cone(0, 2.08, 0, 1.37, 1.3, 0.06, p.trim ?? '#f2f2ee', undefined, 8);
      t.ball(0, 2.52, 0, 0.06, p.trim ?? '#f2f2ee');
    }
  }
};

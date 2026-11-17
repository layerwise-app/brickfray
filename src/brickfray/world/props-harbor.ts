import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { shade } from './util';

export const CONTAINER_SIZE = { length: 6.0, width: 2.4, height: 2.56 } as const;

export interface ContainerParams extends At {
  color: string;
  /** Doors open at both ends so players can walk through. */
  open?: boolean;
  /** Top can be stood on and gets waypoints. */
  walk?: boolean;
}

function ribs(t: Pen, len: number, h: number, z: number, color: string, y0: number) {
  const n = t.detail === 2 ? Math.round(len / 0.3) : Math.round(len / 0.6);
  for (let i = 0; i < n; i++) t.box(-len / 2 + (i + 0.5) * (len / n), y0, z, (len / n) * 0.42, h, 0.05, color, 'metal', 0.01);
}

/** Shipping container, 6 m along local x; doors at +x (and -x when open). */
export const CONTAINER: Element<ContainerParams> = {
  colliders(p) {
    const f = frameOf(p);
    const { length: L, width: W, height: H } = CONTAINER_SIZE;
    if (!p.open) return [f.box([-L / 2, 0, -W / 2], [L / 2, H, W / 2], 'metal', { walk: p.walk })];
    return [
      f.box([-L / 2, 0, -W / 2], [L / 2, 0.16, W / 2], 'wood', { walk: true }),
      f.box([-L / 2, 0, -W / 2 - 0.1], [L / 2, H, -W / 2 + 0.1], 'metal'),
      f.box([-L / 2, 0, W / 2 - 0.1], [L / 2, H, W / 2 + 0.1], 'metal'),
      f.box([-L / 2, H - 0.12, -W / 2 + 0.1], [L / 2, H, W / 2 - 0.1], 'metal', { walk: p.walk })
    ];
  },
  draw(d, p) {
    const t = pen(d, p);
    const { length: L, width: W, height: H } = CONTAINER_SIZE;
    const c = p.color;
    const frame = shade(c, -0.22);
    if (d.detail === 0) {
      if (!p.open) {
        t.box(0, 0, 0, L, H, W, c, 'metal', 0);
        t.box(L / 2, 0.1, 0, 0.04, H - 0.2, W - 0.2, frame, 'metal', 0);
      } else {
        t.box(0, 0, -W / 2 + 0.05, L, H, 0.1, c, 'metal', 0);
        t.box(0, 0, W / 2 - 0.05, L, H, 0.1, c, 'metal', 0);
        t.box(0, H - 0.12, 0, L, 0.12, W - 0.2, c, 'metal', 0);
        t.box(0, 0, 0, L, 0.16, W - 0.2, '#7d5434', undefined, 0);
      }
      return;
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (L / 2 - 0.08), 0, sz * (W / 2 - 0.08), 0.16, H, 0.16, frame, 'metal', 0.02);
    for (const sz of [-1, 1]) {
      t.box(0, 0, sz * (W / 2 - 0.07), L - 0.32, 0.18, 0.14, frame, 'metal', 0.01);
      t.box(0, H - 0.16, sz * (W / 2 - 0.07), L - 0.32, 0.16, 0.14, frame, 'metal', 0.01);
      t.box(0, 0.18, sz * (W / 2 - 0.05), L - 0.32, H - 0.34, 0.06, c, 'metal', 0);
      ribs(t, L - 0.4, H - 0.4, sz * (W / 2 - 0.01), shade(c, 0.06), 0.2);
    }
    t.box(0, H - 0.1, 0, L - 0.3, 0.1, W - 0.28, c, 'metal', 0);
    if (d.detail >= 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, H - 0.14]) t.box(sx * (L / 2 - 0.09), y, sz * (W / 2 - 0.09), 0.2, 0.15, 0.2, '#545c63', 'metal', 0.01);
    if (p.open) {
      t.box(0, 0, 0, L - 0.1, 0.16, W - 0.2, '#7d5434', undefined, 0.01);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          t.box(sx * (L / 2 - 0.6), 0.14, sz * (W / 2 + 0.05), 1.15, H - 0.3, 0.05, shade(c, -0.05), 'metal', 0.01);
          if (d.detail >= 2) for (const k of [-0.25, 0.25]) t.cyl(sx * (L / 2 - 0.6) + k, 0.17, sz * (W / 2 + 0.09), 0.025, H - 0.36, '#b7bcc2', 'chrome');
        }
        t.box(sx * (L / 2 - 0.08), H - 0.34, 0, 0.14, 0.18, W - 0.3, frame, 'metal', 0.01);
      }
      return;
    }
    t.box(L / 2 - 0.02, 0.18, 0, 0.04, H - 0.34, W - 0.3, shade(c, -0.06), 'metal', 0);
    t.box(-L / 2 + 0.02, 0.18, 0, 0.04, H - 0.34, W - 0.3, c, 'metal', 0);
    t.box(L / 2, 0.18, 0, 0.05, H - 0.34, 0.03, frame, 'metal', 0);
    for (const k of [-0.75, -0.35, 0.35, 0.75]) {
      t.cyl(L / 2 + 0.05, 0.2, k, 0.025, H - 0.4, '#b7bcc2', 'chrome');
      if (d.detail >= 2) t.box(L / 2 + 0.08, 1.1, k + 0.08, 0.04, 0.05, 0.18, '#545c63', 'metal', 0);
    }
  }
};

export interface CrateParams extends At {
  /** 'small' 0.8 m, 'large' 1.2 m. */
  size?: 'small' | 'large';
  color?: string;
}

export const crateHeight = (size: 'small' | 'large' = 'small') => (size === 'large' ? 1.12 : 0.8);

export const CRATE: Element<CrateParams> = {
  colliders(p) {
    const s = p.size === 'large' ? 0.6 : 0.4;
    return [frameOf(p).box([-s, 0, -s], [s, crateHeight(p.size), s], 'wood')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const large = p.size === 'large';
    const w = large ? 1.2 : 0.8;
    const studs = large ? 3 : 2;
    const h = crateHeight(p.size) - 0.16;
    const c = p.color ?? '#b98a5a';
    const edge = shade(c, -0.25);
    t.box(0, 0, 0, w - 0.02, h, w - 0.02, c, undefined, 0.02);
    t.part(0, h, 0, studs, studs, 1, edge, true);
    if (d.detail === 0) return;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.05), 0, sz * (w / 2 - 0.05), 0.11, h, 0.11, edge, undefined, 0.01);
    for (const sz of [-1, 1]) {
      t.box(0, 0, sz * (w / 2 - 0.05), w - 0.1, 0.1, 0.11, edge, undefined, 0.01);
      t.box(0, h - 0.1, sz * (w / 2 - 0.05), w - 0.1, 0.1, 0.11, edge, undefined, 0.01);
    }
    if (d.detail >= 2) {
      for (const sx of [-1, 1]) {
        t.box(sx * (w / 2 - 0.05), 0, 0, 0.11, 0.1, w - 0.1, edge, undefined, 0.01);
        t.box(sx * (w / 2 - 0.05), h - 0.1, 0, 0.11, 0.1, w - 0.1, edge, undefined, 0.01);
      }
      for (const y of [h * 0.36, h * 0.64]) t.box(0, y, 0, w + 0.01, 0.025, w + 0.01, shade(c, -0.12), undefined, 0);
    }
  }
};

export interface BarrelParams extends At {
  kind?: 'wood' | 'drum';
  color?: string;
}

export const BARREL: Element<BarrelParams> = {
  colliders: (p) => [frameOf(p).box([-0.33, 0, -0.33], [0.33, 0.92, 0.33], p.kind === 'drum' ? 'metal' : 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    if (p.kind === 'drum') {
      const c = p.color ?? '#1f62c7';
      t.cyl(0, 0, 0, 0.31, 0.9, c, 'metal', 0.03);
      if (d.detail > 0) for (const y of [0.3, 0.6]) t.cyl(0, y, 0, 0.32, 0.04, shade(c, -0.15), 'metal');
      if (d.detail >= 2) t.cyl(0.14, 0.9, 0.05, 0.05, 0.03, '#b7bcc2', 'chrome');
      return;
    }
    const c = p.color ?? '#9a6a3f';
    t.cyl(0, 0, 0, 0.27, 0.08, c, undefined, 0.02);
    t.cyl(0, 0.08, 0, 0.32, 0.74, c, undefined, 0);
    t.cyl(0, 0.82, 0, 0.27, 0.08, c, undefined, 0.02);
    if (d.detail > 0) for (const y of [0.1, 0.42, 0.74]) t.cyl(0, y, 0, 0.33, 0.06, '#545c63', 'metal');
    if (d.detail >= 2) t.cyl(0, 0.9, 0, 0.24, 0.01, shade(c, -0.15));
  }
};

export const PALLET: Element<At & { load?: 'sacks' | 'boxes' }> = {
  colliders: (p) => [frameOf(p).box([-0.6, 0, -0.4], [0.6, p.load ? 0.9 : 0.16, 0.4], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, 1.2, 0.1, 0.8, '#a67c52', undefined, 0.01);
    if (d.detail > 0) for (const z of [-0.3, -0.1, 0.1, 0.3]) t.box(0, 0.1, z, 1.2, 0.04, 0.16, '#b98a5a', undefined, 0.005);
    if (p.load === 'sacks') {
      for (let i = 0; i < (d.detail === 0 ? 2 : 5); i++) {
        const x = i < 3 ? -0.36 + i * 0.36 : -0.18 + (i - 3) * 0.36;
        const y = i < 3 ? 0.32 : 0.62;
        t.ball(x, y, 0, 0.26, i % 2 ? '#e3d3a8' : '#d4c08f', [0.75, 0.62, 1.25]);
      }
    } else if (p.load === 'boxes') {
      t.box(-0.28, 0.14, 0, 0.56, 0.38, 0.74, '#c9a26e', undefined, 0.01);
      t.box(0.3, 0.14, 0, 0.56, 0.38, 0.74, '#d6b07a', undefined, 0.01);
      t.box(0, 0.52, 0, 0.6, 0.36, 0.6, '#c9a26e', undefined, 0.01);
      if (d.detail > 0) t.box(0, 0.88, 0, 0.62, 0.02, 0.1, '#e7e1d2', undefined, 0);
    }
  }
};

export const ROPE: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.36, 0, -0.36], [0.36, 0.22, 0.36], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    const n = d.detail === 0 ? 1 : 3;
    for (let i = 0; i < n; i++) t.ring(0, i * 0.065, 0, 0.27 - i * 0.02, 0.055, i % 2 ? '#d8c08a' : '#cdb27a');
    if (d.detail >= 2) t.cylX(0.3, 0.06, 0.12, 0.04, 0.5, '#cdb27a');
  }
};

/** Stack of boards 2.4 m along local x. */
export const PLANKS: Element<At & { layers?: number }> = {
  colliders: (p) => [frameOf(p).box([-1.25, 0, -0.45], [1.25, 0.12 * (p.layers ?? 4) + 0.1, 0.45], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    const n = p.layers ?? 4;
    for (const x of [-0.9, 0, 0.9]) t.box(x, 0, 0, 0.12, 0.1, 0.8, '#7d5434', undefined, 0.01);
    for (let i = 0; i < n; i++) {
      const per = d.detail === 0 ? 1 : 3;
      for (let k = 0; k < per; k++) {
        const z = per === 1 ? 0 : -0.29 + k * 0.29;
        t.box(((i + k) % 3) * 0.05 - 0.05, 0.1 + i * 0.12, z, 2.4, 0.1, per === 1 ? 0.86 : 0.27, (i + k) % 2 ? '#c9a26e' : '#b98a5a', undefined, 0.01);
      }
    }
  }
};

export const MOORING: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.26, 0, -0.26], [0.26, 0.62, 0.26], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    t.cyl(0, 0, 0, 0.26, 0.08, '#2f363d', 'metal', 0.02);
    t.cyl(0, 0.08, 0, 0.17, 0.4, '#2f363d', 'metal');
    t.cyl(0, 0.46, 0, 0.25, 0.14, '#2f363d', 'metal', 0.05);
    if (d.detail > 0) t.ring(0, 0.2, 0, 0.2, 0.04, '#d8c08a');
  }
};

/** Lifebuoy on a short post, ring facing local +z. */
export const LIFEBUOY: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.1, 0, -0.1], [0.1, 1.4, 0.1], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, 0.14, 1.4, 0.14, '#f2f2ee', undefined, 0.02);
    t.ringUp(0, 0.95, 0.12, 0.28, 0.08, '#f05a1a');
    if (d.detail > 0) for (const a of [0, 1, 2, 3]) t.box(Math.cos((a * Math.PI) / 2) * 0.28, 0.9 + Math.sin((a * Math.PI) / 2) * 0.28, 0.14, 0.1, 0.1, 0.17, '#f2f2ee', undefined, 0.01);
  }
};

export function crateStack(at: At, layout: { dx: number; dz: number; level: number; size?: 'small' | 'large' }[]): { el: typeof CRATE; p: CrateParams }[] {
  return layout.map((c) => ({
    el: CRATE,
    p: { x: at.x + c.dx, z: at.z + c.dz, y: (at.y ?? 0) + c.level, size: c.size }
  }));
}


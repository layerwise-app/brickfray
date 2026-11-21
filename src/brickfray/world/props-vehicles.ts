import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { shade } from './util';

const TYRE = '#22272c';
const HUB = '#cfd4d8';
const GLASS = '#9fd2ea';
const DARK = '#2f363d';

function wheel(t: Pen, x: number, z: number, r: number, w: number) {
  t.cylZ(x, r, z, r, w, TYRE, 'rubber', 0.05, Math.max(16, t.segsFor(r)));
  t.cylZ(x, r, z + Math.sign(z) * 0.02, r * 0.55, w, HUB, t.detail > 0 ? 'chrome' : 'metal', 0.02, Math.max(12, t.segsFor(r * 0.55)));
  if (t.detail >= 2) t.cylZ(x, r, z + Math.sign(z) * 0.04, r * 0.2, w, '#8a9096', 'metal');
}

/** Compact car, 4 m long along local x, nose at +x. */
export const CAR: Element<At & { color: string; roof?: string }> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-2.0, 0, -0.92], [2.0, 0.9, 0.92], 'metal'), f.box([-1.35, 0.9, -0.82], [0.95, 1.46, 0.82], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color;
    const side = Math.PI / 2;
    t.prism('car-body', [[-2.0, 0.26], [2.0, 0.26], [2.02, 0.66], [1.7, 0.84], [0.95, 0.88], [-1.5, 0.9], [-1.98, 0.8]], 1.82, 0, 0, 0, c, undefined, side);
    t.prism('car-cabin', [[-1.38, 0.86], [1.0, 0.86], [0.42, 1.4], [-1.12, 1.4]], 1.6, 0, 0, 0, GLASS, 'glass', side);
    t.box(-0.35, 1.38, 0, 1.56, 0.08, 1.64, p.roof ?? c, undefined, 0.03);
    if (d.detail > 0) {
      t.box(-0.35, 0.88, 0, 0.12, 0.5, 1.64, p.roof ?? c, undefined, 0.02);
      for (const z of [-0.95, 0.95]) {
        t.box(0.82, 0.92, z, 0.12, 0.1, 0.1, c, undefined, 0.02);
        t.box(-0.3, 0.3, z * 0.96, 0.02, 0.55, 0.04, shade(c, -0.25), undefined, 0);
        t.box(0.1, 0.66, z * 0.97, 0.16, 0.04, 0.04, '#b7bcc2', 'chrome', 0);
      }
      t.box(-2.03, 0.4, 0, 0.03, 0.14, 0.44, '#f6c624', undefined, 0.005);
      t.box(2.06, 0.3, 0, 0.03, 0.12, 0.4, '#f2f2ee', undefined, 0.005);
    }
    t.box(2.01, 0.4, 0, 0.06, 0.2, 0.9, DARK, 'metal', 0.01);
    for (const z of [-0.64, 0.64]) {
      t.box(2.0, 0.56, z, 0.06, 0.14, 0.32, '#fff6d6', 'chrome', 0.02);
      t.box(-1.99, 0.6, z, 0.06, 0.14, 0.26, '#d8231b', 'glass', 0.01);
    }
    t.box(2.04, 0.2, 0, 0.12, 0.16, 1.86, '#b7bcc2', 'chrome', 0.04);
    t.box(-2.04, 0.2, 0, 0.12, 0.16, 1.86, '#b7bcc2', 'chrome', 0.04);
    for (const x of [-1.25, 1.25]) {
      for (const z of [-0.8, 0.8]) {
        t.box(x, 0.26, z, 0.9, 0.3, 0.3, '#1c2229', 'rubber', 0);
        wheel(t, x, z, 0.33, 0.26);
      }
    }
  }
};

/** Delivery van, 5 m long along local x, nose at +x, sliding door on local +z. */
export const VAN: Element<At & { color: string; stripe: string }> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-2.5, 0, -1.02], [1.5, 2.36, 1.02], 'metal'), f.box([1.5, 0, -1.02], [2.5, 1.3, 1.02], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color;
    const big = d.detail === 0 ? 0 : 0.1;
    t.box(-0.5, 0.36, 0, 3.98, 2.0, 2.02, c, undefined, big);
    t.box(1.98, 0.36, 0, 1.0, 0.92, 2.0, c, undefined, big);
    t.prism('van-shield', [[-0.5, 0], [0.5, 0], [-0.5, 0.95]], 1.9, 1.95, 1.28, 0, GLASS, 'glass', Math.PI / 2);
    t.box(-0.5, 1.0, 0, 3.99, 0.22, 2.04, p.stripe, undefined, 0.02);
    for (const z of [-1.0, 1.0]) t.box(1.05, 1.42, z, 0.8, 0.5, 0.06, GLASS, 'glass', 0.02);
    for (const z of [-0.7, 0.7]) {
      t.box(2.49, 0.86, z, 0.04, 0.16, 0.36, '#fff6d6', 'chrome', 0.01);
      t.box(-2.5, 1.6, z, 0.04, 0.3, 0.16, '#d8231b', 'glass', 0.01);
    }
    t.box(2.52, 0.3, 0, 0.12, 0.2, 2.04, DARK, 'rubber', 0.03);
    t.box(-2.52, 0.3, 0, 0.12, 0.2, 2.04, DARK, 'rubber', 0.03);
    t.box(2.49, 0.55, 0, 0.04, 0.24, 1.1, DARK, 'metal', 0.01);
    if (d.detail > 0) {
      t.box(-0.2, 0.42, 1.0, 1.5, 1.86, 0.04, shade(c, -0.12), undefined, 0.01);
      t.box(0.3, 1.2, 1.03, 0.25, 0.05, 0.04, DARK, 'metal', 0.01);
      t.box(-1.2, 2.36, 0, 2.2, 0.08, 1.4, '#b7bcc2', 'metal', 0.01);
      if (d.detail >= 2) for (const x of [-2.0, -0.4]) t.box(x, 2.44, 0, 0.06, 0.08, 1.4, DARK, 'metal', 0);
    }
    for (const x of [-1.6, 1.7]) for (const z of [-0.88, 0.88]) wheel(t, x, z, 0.38, 0.28);
  }
};

/** Small forklift, forks toward local +x. */
export const FORKLIFT: Element<At & { color?: string }> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-1.1, 0, -0.62], [0.9, 2.15, 0.62], 'metal'), f.box([0.9, 0, -0.5], [1.9, 0.3, 0.5], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color ?? '#f6c624';
    t.box(-0.15, 0.25, 0, 1.7, 0.75, 1.2, c, undefined, d.detail ? 0.06 : 0);
    t.box(-0.85, 0.3, 0, 0.5, 0.9, 1.15, DARK, 'metal', 0.04);
    t.box(-0.25, 1.0, 0, 0.5, 0.12, 0.6, DARK, 'rubber', 0.03);
    t.box(-0.4, 1.12, 0, 0.12, 0.5, 0.6, DARK, 'rubber', 0.03);
    for (const z of [-0.55, 0.55]) for (const x of [-0.95, 0.5]) t.box(x, 1.0, z, 0.08, 1.12, 0.08, DARK, 'metal', 0.01);
    t.box(-0.22, 2.08, 0, 1.6, 0.07, 1.2, c, undefined, 0.02);
    for (const z of [-0.35, 0.35]) {
      t.box(0.8, 0.1, z, 0.1, 2.0, 0.1, '#7c8389', 'metal', 0.01);
      t.box(1.35, 0.06, z, 1.1, 0.06, 0.14, '#7c8389', 'metal', 0.01);
    }
    if (d.detail > 0) t.box(0.8, 0.5, 0, 0.08, 0.06, 0.8, '#7c8389', 'metal', 0);
    for (const x of [-0.75, 0.45]) for (const z of [-0.55, 0.55]) wheel(t, x, z, 0.28, 0.22);
  }
};

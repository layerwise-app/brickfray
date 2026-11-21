import type { FlagPattern } from './anim';
import type { Element } from './plan';
import { frameOf, pen, type At } from './props-kit';
import type { PlanCollider } from './util';

const WOOD = '#8a5f3a';
const DARK_WOOD = '#6e4a2f';
const IRON = '#3a4148';

/**
 * Banner hanging flat against a wall that faces local +z; the cloth is
 * animated, the pole is static. No collider: it hangs above head height.
 */
export const BANNER: Element<At & { colors: string[]; width?: number; height?: number; pattern?: FlagPattern }> = {
  draw(d, p) {
    const t = pen(d, p);
    const w = p.width ?? 1.2;
    const h = p.height ?? 2.4;
    t.cylX(0, 0, 0.12, 0.04, w + 0.3, IRON, 'metal');
    for (const s of [-1, 1]) t.ball(s * (w / 2 + 0.17), 0, 0.12, 0.06, '#c99a3e', undefined, 0, 1, 'chrome');
    const f = frameOf(p);
    const [x, y, z] = f.p(-w / 2, -0.02, 0.16);
    d.anim.flag([x, y, z], f.yaw, w, h, p.colors, true, p.pattern);
  }
};

/** Flag on a pole, cloth flies toward local +x. */
export const FLAGPOLE: Element<At & { colors: string[]; height?: number; pattern?: FlagPattern }> = {
  colliders: (p) => [frameOf(p).box([-0.1, 0, -0.1], [0.1, p.height ?? 4, 0.1], 'metal')],
  draw(d, p) {
    const t = pen(d, p);
    const h = p.height ?? 4;
    t.cyl(0, 0, 0, 0.14, 0.2, IRON, 'metal', 0.03);
    // Low has no MSAA: a 2 px pole steps into segments FXAA cannot join, so it is drawn thicker and evenly lit.
    if (d.detail === 0) t.cyl(0, 0.2, 0, 0.075, h - 0.2, '#c3c7cc', 'plastic', 0, 8);
    else t.cyl(0, 0.2, 0, 0.05, h - 0.2, '#b7bcc2', 'metal');
    t.ball(0, h + 0.05, 0, 0.09, '#c99a3e', undefined, 0, 1, 'chrome');
    const f = frameOf(p);
    const [x, y, z] = f.p(0.05, h - 0.1, 0);
    d.anim.flag([x, y, z], f.yaw, 1.7, 1.05, p.colors, false, p.pattern);
  }
};

/** Wall torch: iron bracket on a wall facing local +z, flickering flame. */
export const TORCH: Element<At> = {
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, -0.2, 0.03, 0.14, 0.3, 0.06, IRON, 'metal', 0.01);
    t.box(0, -0.1, 0.16, 0.06, 0.06, 0.26, IRON, 'metal', 0.01);
    t.cone(0, -0.08, 0.3, 0.05, 0.1, 0.2, DARK_WOOD, undefined, 8);
    t.cone(0, 0.08, 0.3, 0.1, 0.12, 0.06, IRON, 'metal', 8);
    const f = frameOf(p);
    d.anim.flame(f.p(0, 0.13, 0.3), { at: f.p(0, 0.32, 0.012), yaw: f.yaw });
  }
};

/** Hand cart, 2.4 m along local x, handles toward +x. */
export const CART: Element<At & { load?: 'hay' | 'barrels' }> = {
  colliders: (p) => [frameOf(p).box([-1.2, 0, -0.75], [1.0, p.load === 'hay' ? 1.55 : 1.05, 0.75], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(-0.1, 0.5, 0, 2.0, 0.12, 1.3, WOOD, undefined, 0.02);
    for (const z of [-0.65, 0.65]) t.box(-0.1, 0.62, z, 2.0, 0.4, 0.08, DARK_WOOD, undefined, 0.01);
    t.box(-1.08, 0.62, 0, 0.08, 0.4, 1.3, DARK_WOOD, undefined, 0.01);
    for (const z of [-0.3, 0.3]) t.box(1.35, 0.55, z, 1.1, 0.07, 0.07, DARK_WOOD, undefined, 0.01);
    for (const z of [-0.74, 0.74]) {
      t.cylZ(-0.2, 0.48, z, 0.48, 0.1, DARK_WOOD, undefined, 0.02);
      if (d.detail > 0) {
        t.cylZ(-0.2, 0.48, z * 1.05, 0.12, 0.14, IRON, 'metal');
        t.ring(-0.2, 0.48, z, 0.46, 0.035, IRON, 'metal');
      }
    }
    if (p.load === 'hay') {
      t.box(-0.1, 0.62, 0, 1.8, 0.55, 1.15, '#e3c25a', undefined, 0.06);
      t.ball(-0.1, 1.2, 0, 0.6, '#ecd06a', [1.4, 0.55, 0.9], 0.25, 2);
    } else if (p.load === 'barrels') {
      for (const x of [-0.6, 0.3]) t.cyl(x, 0.62, 0, 0.3, 0.42, '#9a6a3f', undefined, 0.03);
    }
  }
};

/** Round stone well with a little roof; 2.2 m footprint. */
export const WELL: Element<At> = {
  colliders(p) {
    const f = frameOf(p);
    const out: PlanCollider[] = [f.box([-0.95, 0, -0.95], [0.95, 0.9, 0.95], 'stone')];
    for (const x of [-0.85, 0.85]) out.push(f.box([x - 0.08, 0.9, -0.08], [x + 0.08, 2.3, 0.08], 'wood'));
    out.push(f.box([-1.15, 2.2, -0.85], [1.15, 2.9, 0.85], 'wood', { bulletsPass: true }));
    return out;
  },
  draw(d, p) {
    const t = pen(d, p);
    const ring = d.detail === 0 ? 1 : 3;
    for (let i = 0; i < ring; i++) t.cyl(0, i * (0.9 / ring), 0, 0.95 - (i % 2) * 0.03, 0.9 / ring - 0.01, i % 2 ? '#9ea3a8' : '#b4b8bc', undefined, 0.03);
    t.cyl(0, 0.9, 0, 0.75, 0.01, '#20303a', 'glass');
    for (const x of [-0.85, 0.85]) t.box(x, 0.9, 0, 0.14, 1.45, 0.14, WOOD, undefined, 0.02);
    t.cylX(0, 1.85, 0, 0.08, 1.6, DARK_WOOD);
    t.prism('well-roof', [[-0.85, 0], [0.85, 0], [0, 0.6]], 2.3, 0, 2.25, 0, '#a8452e');
    if (d.detail > 0) {
      t.cyl(0, 1.15, 0, 0.03, 0.7, '#d8c08a');
      t.cyl(0, 0.95, 0, 0.16, 0.24, '#7d5434', undefined, 0.02);
    }
  }
};

export const HAY: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.6, 0, -0.4], [0.6, 0.64, 0.4], 'foliage')],
  draw(d, p) {
    const t = pen(d, p);
    t.box(0, 0, 0, 1.2, 0.64, 0.8, '#e3c25a', undefined, 0.05);
    if (d.detail > 0) for (const x of [-0.3, 0.3]) t.box(x, -0.005, 0, 0.05, 0.65, 0.81, '#a8452e', undefined, 0);
  }
};

/** Archery target on an easel, face toward local +z. */
export const TARGET: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.6, 0, -0.35], [0.6, 1.7, 0.2], 'foliage')],
  draw(d, p) {
    const t = pen(d, p);
    for (const x of [-0.45, 0.45]) t.box(x, 0, -0.15, 0.08, 1.45, 0.08, WOOD, undefined, 0.01);
    t.box(0, 0, -0.3, 0.08, 1.3, 0.08, WOOD, undefined, 0.01);
    const rings = ['#e3c25a', '#c8231b', '#1f62c7', '#f2f2ee', '#f6c624'];
    t.cylZ(0, 1.05, 0, 0.55, 0.2, '#e3c25a', undefined, 0.04);
    if (d.detail > 0) rings.slice(1).forEach((c, i) => t.cylZ(0, 1.05, 0.11 + i * 0.006, 0.44 - i * 0.1, 0.02, c));
  }
};

export const WEAPON_RACK: Element<At> = {
  colliders: (p) => [frameOf(p).box([-0.9, 0, -0.3], [0.9, 1.8, 0.3], 'wood', { bulletsPass: true })],
  draw(d, p) {
    const t = pen(d, p);
    for (const x of [-0.8, 0.8]) t.box(x, 0, 0, 0.1, 1.4, 0.5, WOOD, undefined, 0.01);
    for (const y of [0.25, 1.1]) t.box(0, y, 0, 1.7, 0.08, 0.14, DARK_WOOD, undefined, 0.01);
    const n = d.detail === 0 ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const x = -0.6 + (i * 1.2) / (n - 1);
      t.cyl(x, 0.05, 0, 0.025, 1.6, '#9a6a3f');
      t.cone(x, 1.65, 0, 0.05, 0, 0.16, '#b7bcc2', 'metal', 6);
    }
  }
};

import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { shade } from './util';

const DARK = '#2f363d';
const STEEL = '#7d8a96';
const COIL = { r: 0.55, width: 1.2, cradle: 0.12 } as const;
/** Top of a coil on its cradle: crouch cover a standing eye (1.62) sees over. */
/** The element with its small parts kept at every distance, merged into the chunks already there (fewer draws than fading ones). */
export const lasting = <P>(el: Element<P>): Element<P> => ({ ...el, draw: (d, p) => d.lasting(() => el.draw(d, p)) });

export const COIL_TOP = COIL.cradle + COIL.r * 2;

/** One steel coil lying eye-sideways (axis along local x) at local (0, y, z), its cradle under it. */
function coil(t: Pen, y: number, z: number, color: string) {
  for (const x of [-0.4, 0.4]) t.box(x, y, z, 0.16, COIL.cradle, COIL.r * 1.7, '#7d5434', undefined, 0.01);
  const cy = y + COIL.cradle + COIL.r;
  t.cylX(-COIL.width / 2, cy, z, COIL.r, COIL.width, color, 'metal', 0.03);
  t.cylX(-COIL.width / 2 - 0.01, cy, z, COIL.r * 0.42, COIL.width + 0.02, DARK, 'metal');
  if (t.detail > 0) for (const x of [-0.3, 0.3]) t.cylX(x - 0.03, cy, z, COIL.r + 0.012, 0.06, '#c8cdd2', 'metal');
}

/** Coil collider: one box to the full 1.22 m, so there is no bevel ledge low enough to climb onto the coils from the ground. */
function coilBoxes(f: ReturnType<typeof frameOf>, x0: number, x1: number, y: number, z0: number, z1: number) {
  return [f.box([x0, y, z0], [x1, y + COIL_TOP, z1], 'metal')];
}

/** `count` steel coils side by side along local z on a long cradle: 1.22 m, crouch cover. */
export const STEEL_COILS: Element<At & { count?: number; color?: string }> = {
  colliders(p) {
    const n = p.count ?? 2;
    return coilBoxes(frameOf(p), -COIL.width / 2, COIL.width / 2, 0, -COIL.r * n, COIL.r * n);
  },
  draw(d, p) {
    const t = pen(d, p);
    const n = p.count ?? 2;
    for (let i = 0; i < n; i++) coil(t, 0, (i - (n - 1) / 2) * COIL.r * 2, i % 2 ? shade(p.color ?? STEEL, -0.08) : (p.color ?? STEEL));
  }
};

const WAGON = { length: 9.0, width: 2.6, deck: 1.1, hood: 2.7 } as const;

/**
 * Hooded coil wagon along local x on the siding: the steel coils ride under a rounded hood, so the wagon is one solid
 * 2.7 m shape (standing cover, no ledge to stand on). The frame is skirted to the rails: what stops a body is what shows.
 */
export const FLAT_WAGON: Element<At> = {
  colliders(p) {
    const L = WAGON.length / 2;
    return [frameOf(p).box([-L, 0, -WAGON.width / 2], [L, WAGON.hood, WAGON.width / 2], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const L = WAGON.length;
    t.box(0, 0.86, 0, L, 0.24, WAGON.width, '#5a3e2f', undefined, 0.02);
    t.box(0, 0.62, 0, L - 0.2, 0.24, WAGON.width - 0.1, '#3a2e28', 'metal', 0.01);
    t.box(0, 0.05, 0, L - 1.6, 0.57, WAGON.width - 0.5, DARK, 'metal', 0);
    for (const x of [-L / 2 + 1.6, L / 2 - 1.6]) {
      t.box(x, 0.12, 0, 2.2, 0.5, WAGON.width - 0.2, '#23272b', 'metal', 0.02);
      for (const sz of [-1, 1]) for (const ax of [x - 0.7, x + 0.7]) t.cylZ(ax, 0.42, sz * 0.75, 0.42, 0.14, '#1b1f23', 'metal');
    }
    for (const sx of [-1, 1]) {
      t.box(sx * (L / 2 + 0.05), 0.55, 0, 0.1, 0.3, WAGON.width - 0.4, '#1b1f23', 'metal', 0);
      for (const sz of [-1, 1]) t.cylX(sx * (L / 2 + 0.05) + (sx < 0 ? -0.3 : 0), 0.7, sz * 0.85, 0.16, 0.3, '#545c63', 'metal');
    }
    if (d.detail > 0) for (let x = -L / 2 + 0.6; x < L / 2; x += 1.2) for (const sz of [-1, 1]) t.box(x, 0.66, sz * (WAGON.width / 2 + 0.01), 0.08, 0.38, 0.02, '#4a3a30', undefined, 0);
    // The hood: three telescoping sections over the coils, a rounded top, ribs at the section joints.
    const hood = '#8e99a4';
    const w = WAGON.width / 2;
    const wall = WAGON.hood - 0.5;
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 2.85;
      const c = i === 1 ? hood : shade(hood, -0.07);
      t.box(x, WAGON.deck, 0, 2.8, wall - WAGON.deck, WAGON.width, c, 'metal', 0.02);
      t.prism('coil-hood', [[-w, 0], [w, 0], [w * 0.6, 0.42], [-w * 0.6, 0.42]], 2.8, x, wall, 0, c, 'metal');
      if (d.detail > 0) t.box(x + 1.4, WAGON.deck, 0, 0.1, wall - WAGON.deck + 0.1, WAGON.width + 0.04, '#5d666f', 'metal', 0);
    }
    t.box(0, WAGON.hood - 0.08, 0, 8.6, 0.08, 1.1, '#f6c624', 'metal', 0);
    if (d.detail > 0) for (const sz of [-1, 1]) t.box(-3.0, WAGON.deck + 0.6, sz * (w + 0.01), 1.2, 0.5, 0.02, '#c0392b', undefined, 0);
  }
};

const BAG = { size: 1.1, height: 1.32 } as const;

/**
 * Bulk bags on pallets, `count` in a row along local z: woven one-tonne sacks, 1.32 m, crouch cover a standing eye sees
 * over and too tall to hop (so bots path round them rather than into them).
 */
export const BULK_BAGS: Element<At & { count?: number; color?: string }> = {
  colliders(p) {
    const h = ((p.count ?? 2) * BAG.size) / 2;
    return [frameOf(p).box([-BAG.size / 2, 0, -h], [BAG.size / 2, BAG.height, h], 'wood')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const n = p.count ?? 2;
    const c = p.color ?? '#e9e6dc';
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * BAG.size;
      t.box(0, 0, z, BAG.size - 0.04, 0.14, BAG.size - 0.04, '#a67c52', undefined, 0.01);
      t.box(0, 0.14, z, BAG.size - 0.06, BAG.height - 0.26, BAG.size - 0.06, i % 2 ? shade(c, -0.06) : c, undefined, 0.08);
      t.box(0, BAG.height - 0.12, z, BAG.size - 0.24, 0.08, BAG.size - 0.24, shade(c, -0.12), undefined, 0.04);
      if (d.detail > 0) {
        for (const [lx, lz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]] as const) t.box(lx, BAG.height - 0.12, z + lz, 0.08, 0.12, 0.08, '#2f7fbf', undefined, 0);
        t.box(0, 0.5, z + (i % 2 ? 1 : -1) * 0.001, BAG.size - 0.04, 0.05, BAG.size - 0.04, '#c0392b', undefined, 0);
      }
    }
  }
};

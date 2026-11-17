import { drawBlock, type Masonry } from './blocks';
import { CASTLE_STONE, ROOF_RED } from './castle-parts';
import type { Element } from './plan';
import { frameOf, Pen, pen, type At } from './props-kit';
import { box, Frame, shade, type PlanCollider } from './util';

const WOOD = '#8a5f3a';
const DARK = '#6e4a2f';
const PLANK = '#b98a5a';

/** Hay loft along the west wall: a walkable plank deck at 2.4 m on posts, stalls below. */
export const LOFT = { x0: -30.8, x1: -25.2, z0: -6.4, z1: 6.4, top: 2.4 } as const;

function loftColliders(): PlanCollider[] {
  const { x0, x1, z0, z1, top } = LOFT;
  const out: PlanCollider[] = [box([x0, top - 0.24, z0], [x1, top, z1], 'wood', { walk: true })];
  for (const z of [-6.0, -2.0, 2.0, 6.0]) out.push(box([x1 - 0.5, 0, z - 0.15], [x1 - 0.2, top - 0.24, z + 0.15], 'wood'));
  for (const z of [-2.0, 2.0]) out.push(box([x0, 0, z - 0.1], [x0 + 3.2, 1.2, z + 0.1], 'wood'));
  out.push(box([x1 - 0.2, top, z0], [x1, top + 1.0, z1 - 2.8], 'wood', { bulletsPass: true }));
  out.push(box([x0, top, z0], [x1, top + 1.0, z0 + 0.2], 'wood', { bulletsPass: true }));
  return out;
}

export const HAYLOFT: Element<Record<string, never>> = {
  colliders: loftColliders,
  draw(d) {
    const { x0, x1, z0, z1, top } = LOFT;
    const t = new Pen(d, new Frame(0, 0, 0));
    const n = Math.round((z1 - z0) / 0.8);
    for (let i = 0; i < n; i++) t.box((x0 + x1) / 2, top - 0.24, z0 + (i + 0.5) * 0.8, x1 - x0, 0.24, 0.78, i % 2 ? PLANK : shade(PLANK, -0.08), undefined, 0.01);
    for (const z of [-6.0, -2.0, 2.0, 6.0]) {
      t.box(x1 - 0.35, 0, z, 0.3, top - 0.24, 0.3, DARK, undefined, 0.02);
      t.box((x0 + x1) / 2, top - 0.5, z, x1 - x0, 0.26, 0.2, DARK, undefined, 0.01);
    }
    for (const z of [-2.0, 2.0]) {
      t.box(x0 + 1.6, 0, z, 3.2, 1.2, 0.2, WOOD, undefined, 0.01);
      t.box(x0 + 1.6, 1.12, z, 3.3, 0.12, 0.3, DARK, undefined, 0.01);
    }
    for (const [rz0, rz1, x] of [[z0, z1 - 2.8, x1 - 0.1]] as const) {
      for (let z = rz0 + 0.1; z <= rz1; z += 1.2) t.box(x, top, z, 0.12, 1.0, 0.12, DARK, undefined, 0.01);
      t.box(x, top + 0.9, (rz0 + rz1) / 2, 0.12, 0.12, rz1 - rz0, WOOD, undefined, 0.01);
      t.box(x, top + 0.45, (rz0 + rz1) / 2, 0.08, 0.1, rz1 - rz0, WOOD, undefined, 0);
    }
    t.box((x0 + x1) / 2, top + 0.9, z0 + 0.1, x1 - x0, 0.12, 0.12, WOOD, undefined, 0.01);
    for (const [x, z] of [[-29.6, -4.4], [-29.6, -3.2], [-28.4, 3.6], [-29.6, 4.4]] as const) t.box(x, top, z, 1.2, 0.64, 0.8, '#e3c25a', undefined, 0.05);
    t.box(-29.4, 0, 0, 2.0, 0.5, 0.6, DARK, undefined, 0.02);
    t.box(-29.4, 0.38, 0, 1.8, 0.1, 0.45, '#3f7fa0', 'glass', 0);
  }
};

/** Smithy against the east wall; its flat roof (3.36 m) joins the wall walk. */
export const SMITHY = { x0: 25.2, x1: 30.8, z0: -6.4, z1: 6.4, roof: 3.36 } as const;

function smithyColliders(): PlanCollider[] {
  const { x0, x1, z0, z1, roof } = SMITHY;
  const out: PlanCollider[] = [box([x0, roof - 0.48, z0], [x1, roof, z1], 'stone', { walk: true })];
  out.push(box([x0, 0, z0], [x1, roof - 0.48, z0 + 0.8], 'stone'), box([x0, 0, z1 - 0.8], [x1, roof - 0.48, z1], 'stone'));
  for (const z of [-2.0, 2.0]) out.push(box([x0, 0, z - 0.4], [x0 + 0.8, roof - 0.48, z + 0.4], 'stone'));
  out.push(box([28.0, 0, -1.2], [30.8, 0.96, 1.2], 'stone'));
  out.push(box([28.8, roof, -0.8], [30.4, roof + 1.6, 0.8], 'stone'));
  out.push(box([26.0, 0, -3.6], [26.8, 0.8, -2.8], 'metal'));
  out.push(box([x0, roof, z0], [x0 + 0.2, roof + 1.0, z1], 'wood', { bulletsPass: true }));
  return out;
}

const SMITHY_STONE: Masonry = { colors: ['#8f897c', '#9c9588', '#7f796d'], variance: 0.3 };

export const SMITHY_EL: Element<Record<string, never>> = {
  colliders: smithyColliders,
  draw(d) {
    const cs = smithyColliders();
    const { x0, z0, z1, roof } = SMITHY;
    drawBlock(d, { min: cs[0]!.min, max: cs[0]!.max, surface: 'stone', style: CASTLE_STONE, faces: ['w', 'n', 's'], top: 'tiles', topColor: '#c9bea6' });
    for (const c of cs.slice(1, 5)) drawBlock(d, { min: c.min, max: c.max, surface: 'stone', style: SMITHY_STONE });
    drawBlock(d, { min: cs[5]!.min, max: cs[5]!.max, surface: 'stone', style: { colors: ['#a8452e', '#b44a31', '#8f3a26'], variance: 0.3 }, top: 'studs', topColor: '#545c63' });
    drawBlock(d, { min: cs[6]!.min, max: cs[6]!.max, surface: 'stone', style: { colors: ['#a8452e', '#b44a31'], variance: 0.3 }, top: 'none' });
    const t = new Pen(d, new Frame(0, 0, 0));
    t.box(29.4, 0.96, 0, 2.4, 0.08, 1.8, '#ff8a2a', 'glow', 0);
    if (d.detail > 0) for (let i = 0; i < 6; i++) t.ball(28.6 + (i % 3) * 0.6, 1.02, -0.4 + Math.floor(i / 3) * 0.8, 0.14, i % 2 ? '#ffb347' : '#2f363d', [1, 0.6, 1], 0, 1, i % 2 ? 'glow' : 'plastic');
    t.box(26.4, 0, -3.2, 0.5, 0.5, 0.5, '#3a4148', 'metal', 0.02);
    t.box(26.4, 0.5, -3.2, 0.9, 0.3, 0.4, '#3a4148', 'metal', 0.03);
    t.cone(27.0, 0.65, -3.2, 0.15, 0.02, 0.4, '#3a4148', 'metal', 6);
    t.box(29.6, roof + 1.6, 0, 1.8, 0.16, 1.8, '#545c63', undefined, 0.02);
    for (let z = z0 + 0.1; z <= z1; z += 1.6) t.box(x0 + 0.1, roof, z, 0.12, 1.0, 0.12, DARK, undefined, 0.01);
    t.box(x0 + 0.1, roof + 0.9, 0, 0.12, 0.12, z1 - z0, WOOD, undefined, 0.01);
    t.box(x0 + 0.4, roof - 0.48 - 0.2, 0, 0.4, 0.2, z1 - z0, DARK, undefined, 0.01);
    d.anim.flame([29.4, 1.0, -0.5]);
    d.anim.flame([29.4, 1.0, 0.5]);
  }
};

/** Canvas A-frame tent, 3.2 m along local x, open toward +x. */
export const TENT: Element<At & { color: string; trim?: string }> = {
  colliders: (p) => [frameOf(p).box([-1.6, 0, -1.3], [1.6, 2.1, 1.3], 'foliage', { bulletsPass: true })],
  draw(d, p) {
    const t = pen(d, p);
    const trim = p.trim ?? '#f2f2ee';
    t.prism('tent-l', [[-1.35, 0], [-1.25, 0], [0.05, 2.0], [0, 2.1]], 3.2, 0, 0, 0, p.color);
    t.prism('tent-r', [[1.35, 0], [1.25, 0], [-0.05, 2.0], [0, 2.1]], 3.2, 0, 0, 0, shade(p.color, -0.08));
    t.cylX(0, 2.1, 0, 0.05, 3.5, DARK);
    for (const x of [-1.65, 1.65]) t.box(x, 0, 0, 0.08, 2.15, 0.08, DARK, undefined, 0);
    if (d.detail > 0) {
      t.box(0, 0.02, 0, 3.0, 0.04, 2.4, shade(p.color, -0.35), undefined, 0);
      for (const s of [-1, 1]) t.prism(`tent-trim${s}`, s < 0 ? [[-1.37, 0], [-1.33, 0], [-1.25, 0.1], [-1.29, 0.12]] : [[1.37, 0], [1.33, 0], [1.25, 0.1], [1.29, 0.12]], 3.25, 0, 0.0, 0, trim);
      t.ball(1.7, 2.3, 0, 0.1, trim);
    }
  }
};

/** Stone storehouse with a gable roof along x; solid, a lane blocker. */
export const STOREHOUSE: Element<{ x0: number; z0: number; x1: number; z1: number }> = {
  colliders: (p) => [box([p.x0, 0, p.z0], [p.x1, 2.88, p.z1], 'stone'), box([p.x0, 2.88, p.z0 + 0.6], [p.x1, 3.84, p.z1 - 0.6], 'wood')],
  draw(d, p) {
    drawBlock(d, { min: [p.x0, 0, p.z0], max: [p.x1, 2.88, p.z1], surface: 'stone', style: SMITHY_STONE, top: 'none' });
    const t = new Pen(d, new Frame((p.x0 + p.x1) / 2, 2.88, (p.z0 + p.z1) / 2));
    const half = (p.z1 - p.z0) / 2 + 0.3;
    t.prism(`store-roof:${half}`, [[-half, 0], [half, 0], [0, 1.5]], p.x1 - p.x0 + 0.4, 0, -0.02, 0, ROOF_RED);
    if (d.detail > 0) for (const s of [-1, 1]) t.prism(`store-ridge:${half}`, [[-0.12, 1.4], [0.12, 1.4], [0, 1.58]], p.x1 - p.x0 + 0.5, 0, 0, 0, shade(ROOF_RED, -0.2 * s));
    for (const s of [-1, 1]) {
      const door = new Pen(d, new Frame((p.x0 + p.x1) / 2, 0, s < 0 ? p.z0 : p.z1, s < 0 ? 2 : 0));
      door.box(0, 0, 0.04, 1.2, 2.1, 0.1, WOOD, undefined, 0.02);
      if (d.detail > 0) for (const y of [0.4, 1.6]) door.box(0, y, 0.1, 1.2, 0.1, 0.04, '#3a4148', 'metal', 0);
    }
  }
};

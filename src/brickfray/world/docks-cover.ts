import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { CONTAINER, CONTAINER_SIZE } from './props-harbor';
import { shade, type PlanCollider } from './util';

const DARK = '#2f363d';
const STEEL = '#545c63';
const WOOD = '#a67c52';
const TYRE = '#1b1f23';

/** Round section `r` around an axis as three boxes (a cross and a square): close to the drawn disc from every side. */
function disc(f: ReturnType<typeof frameOf>, r: number, y0: number, y1: number, surface: 'wood' | 'metal'): PlanCollider[] {
  const k = r * 0.5;
  const q = r * 0.71;
  return [f.box([-r, y0, -k], [r, y1, k], surface), f.box([-k, y0, -r], [k, y1, r], surface), f.box([-q, y0, -q], [q, y1, q], surface)];
}

/**
 * Wooden cable drum. `upright` lies on a flange (1.0 m, crouch cover); otherwise it stands on its rims with the axle
 * along local x (2.0 m, standing cover).
 */
/** A drum laid flat: 1.3 m, crouch cover too tall to hop, so bots path round it rather than into it. */
const DRUM_FLAT = 1.3;

export const CABLE_DRUM: Element<At & { upright?: boolean; cable?: string }> = {
  colliders(p) {
    const f = frameOf(p);
    if (p.upright) return disc(f, 0.9, 0, DRUM_FLAT, 'wood');
    return [f.box([-0.6, 0, -0.7], [0.6, 2.0, 0.7], 'wood'), f.box([-0.6, 0.3, -1.0], [0.6, 1.7, 1.0], 'wood')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const cable = p.cable ?? DARK;
    if (p.upright) {
      for (const y of [0, DRUM_FLAT - 0.12]) t.cyl(0, y, 0, 0.9, 0.12, WOOD, undefined, 0.02);
      t.cyl(0, 0.12, 0, 0.72, DRUM_FLAT - 0.24, cable);
      t.cyl(0, DRUM_FLAT, 0, 0.16, 0.02, DARK, 'metal');
      if (d.detail > 0) for (const a of [0, 1, 2, 3]) t.box(Math.cos(a * 1.571) * 0.55, DRUM_FLAT, Math.sin(a * 1.571) * 0.55, 0.08, 0.02, 0.08, STEEL, 'metal', 0);
      return;
    }
    for (const x of [-0.53, 0.53]) {
      t.cylX(x, 1.0, 0, 1.0, 0.14, WOOD, undefined, 0.02);
      if (d.detail > 0) t.cylX(x * 1.12, 1.0, 0, 0.22, 0.04, STEEL, 'metal');
    }
    t.cylX(0, 1.0, 0, 0.78, 0.92, cable);
    if (d.detail > 0) t.cylX(0, 1.0, 0, 0.8, 0.06, shade(cable, 0.25));
    if (d.detail >= 2) t.beam(0.46, 1.6, 0.4, 0.46, 0.05, 1.05, 0.06, cable);
  }
};

/** Steel waste skip, 3.2 m along local x with sloped ends, 1.8 m tall: standing cover. */
export const SKIP: Element<At & { color: string }> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-1.6, 0.9, -0.9], [1.6, 1.8, 0.9], 'metal'), f.box([-1.35, 0, -0.9], [1.35, 0.9, 0.9], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const c = p.color;
    const side: [number, number][] = [[-1.1, 0.06], [1.1, 0.06], [1.6, 1.8], [-1.6, 1.8]];
    t.prism('skip-side', side.map(([x, y]) => [x, y] as [number, number]), 1.8, 0, 0, 0, c, 'metal', Math.PI / 2);
    t.box(0, 1.72, 0, 3.3, 0.1, 1.86, shade(c, -0.2), 'metal', 0.01);
    t.box(0, 1.5, 0, 3.0, 0.24, 1.62, '#3a3530', undefined, 0);
    for (const x of [-1.15, 1.15]) t.box(x, 0, 0, 0.3, 0.08, 1.7, DARK, 'metal', 0.01);
    if (d.detail === 0) return;
    for (const sz of [-1, 1]) {
      for (const x of [-0.6, 0, 0.6]) t.box(x, 0.2, sz * 0.92, 0.08, 1.5, 0.04, shade(c, -0.12), 'metal', 0);
      for (const x of [-1.25, 1.25]) t.cylZ(x, 1.2, sz * 0.98, 0.1, 0.08, DARK, 'metal');
    }
    t.box(-0.7, 1.74, 0.2, 1.2, 0.08, 0.3, WOOD, undefined, 0.01);
    t.box(0.5, 1.74, -0.3, 0.9, 0.12, 0.2, '#7d5434', undefined, 0.01);
  }
};

/** Low flatbed chassis along local x; the deck is skirted to the ground (what stops a body is what shows). */
function chassis(t: Pen, len: number, color: string) {
  t.box(0, 1.1, 0, len, 0.2, 2.5, shade(color, -0.1), 'metal', 0.02);
  t.box(0, 0.05, 0, len - 0.2, 1.05, 2.3, DARK, 'metal', 0);
  for (const sz of [-1, 1]) {
    t.box(-0.6, 0.32, sz * 1.18, len - 3.4, 0.62, 0.06, color, 'metal', 0.01);
    for (const x of [len / 2 - 1.5, len / 2 - 0.5]) {
      t.cylZ(x, 0.5, sz * 1.0, 0.5, 0.46, TYRE, 'rubber');
      if (t.detail > 0) t.cylZ(x, 0.5, sz * 1.25, 0.24, 0.04, '#9aa1a8', 'metal');
    }
  }
  t.box(len / 2 - 0.05, 0.3, 0, 0.1, 0.5, 2.4, '#f6c624', 'metal', 0);
  t.box(-len / 2 + 0.05, 0.3, 0, 0.1, 0.8, 2.4, DARK, 'metal', 0);
  if (t.detail > 0) for (const sz of [-1, 1]) t.box(len / 2 - 0.02, 0.55, sz * 0.95, 0.06, 0.14, 0.3, '#c8231b', 'glow', 0);
}

/** Road tractor facing local -x: a box cab over the front axle. */
function tractor(t: Pen, x: number, color: string) {
  t.box(x, 0.05, 0, 3.0, 1.15, 2.3, DARK, 'metal', 0.02);
  t.box(x - 0.6, 1.2, 0, 1.8, 1.9, 2.4, color, 'metal', 0.05);
  t.box(x - 1.48, 2.0, 0, 0.06, 0.8, 2.0, '#26323a', 'glass', 0);
  t.box(x - 0.6, 3.1, 0, 1.6, 0.14, 2.2, shade(color, -0.15), 'metal', 0.02);
  for (const sz of [-1, 1]) {
    for (const ax of [x - 0.9, x + 1.0]) t.cylZ(ax, 0.5, sz * 1.0, 0.5, 0.46, TYRE, 'rubber');
    if (t.detail > 0) t.box(x - 0.2, 2.0, sz * 1.21, 0.9, 0.7, 0.03, '#26323a', 'glass', 0);
  }
  t.box(x - 1.52, 0.4, 0, 0.1, 0.5, 2.2, '#9aa1a8', 'metal', 0);
  if (t.detail > 0) for (const sz of [-1, 1]) t.box(x - 1.54, 0.75, sz * 0.85, 0.04, 0.18, 0.36, '#fff1c4', 'glow', 0);
}

export interface TruckParams extends At {
  color: string;
  /** Container on the chassis; omitted: an empty flatbed with `load` on it. */
  box?: string;
  load?: 'pipes' | 'timber';
  /** No road tractor in front. */
  bare?: boolean;
}

const CH = { len: 7.0, deck: 1.3, cab: 3.2 } as const;
const chassisLen = (p: TruckParams) => (p.box ? CONTAINER_SIZE.length : CH.len);

/**
 * Container truck (or a parked flatbed) along local x, tractor at -x. With a box it is a 3.9 m blocker; a flatbed of
 * pipes or timber stands about 2 m: cover a body hides behind.
 */
export const TRUCK: Element<TruckParams> = {
  colliders(p) {
    const f = frameOf(p);
    const L = chassisLen(p);
    const out = [f.box([-L / 2, 0, -1.25], [L / 2, CH.deck, 1.25], 'metal')];
    if (!p.bare) out.push(f.box([-L / 2 - CH.cab, 0, -1.2], [-L / 2, 3.24, 1.2], 'metal'));
    // The load sits hard against the cab (or the chassis front): no slot between them to see or shoot through. A box
    // truck's chassis is the box's length, a load covers the whole deck: no bare deck at 1.3 m to climb onto.
    if (p.box) out.push(f.box([-L / 2, CH.deck, -CONTAINER_SIZE.width / 2], [L / 2, CH.deck + CONTAINER_SIZE.height, CONTAINER_SIZE.width / 2], 'metal'));
    else if (p.load) out.push(f.box([-L / 2, CH.deck, -1.25], [L / 2, CH.deck + 0.72, 1.25], p.load === 'timber' ? 'wood' : 'metal'));
    return out;
  },
  draw(d, p) {
    const t = pen(d, p);
    const L = chassisLen(p);
    chassis(t, L, p.color);
    if (!p.bare) tractor(t, -L / 2 - CH.cab / 2, p.color);
    const load = t.at(t.f.child(0, 0, 0));
    if (p.box) {
      const [x, , z] = t.f.p(0, 0, 0);
      CONTAINER.draw(d, { x, z, y: (p.y ?? 0) + CH.deck, turns: p.turns, color: p.box });
      return;
    }
    if (p.load === 'pipes') pipes(load, CH.len, CH.deck, 2.5, 3);
    else if (p.load === 'timber') timber(load, CH.len, CH.deck, 2.5, 0.72);
  }
};

/** Pipes along local x on two sleepers, `rows` high and pyramid-stacked, `w` wide at the bottom. */
function pipes(t: Pen, len: number, y: number, w: number, rows: number) {
  const r = w / 8;
  for (const x of [-len / 3, len / 3]) t.box(x, y, 0, 0.2, 0.1, w, '#7d5434', undefined, 0.01);
  for (let k = 0; k < rows; k++) {
    const n = 4 - k;
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * r * 2;
      t.cylX(0, y + 0.1 + r + k * r * 1.72, z, r, len, k % 2 ? '#8a9096' : '#7c8389', 'metal');
      if (t.detail > 0) t.cylX(0, y + 0.1 + r + k * r * 1.72, z, r * 0.7, len + 0.02, '#2f363d', 'metal');
    }
  }
}

/** Sawn-timber bundles along local x with full-width battens between layers (no light through). */
function timber(t: Pen, len: number, y: number, w: number, h: number) {
  const layer = (h - 0.08) / 2;
  for (let k = 0; k < 2; k++) {
    const y0 = y + k * (layer + 0.04);
    for (const x of [-len / 3, 0, len / 3]) t.box(x, y0, 0, 0.12, 0.04, w, '#7d5434', undefined, 0);
    t.box(0, y0 + 0.04, 0, len, layer, w, k ? '#d8b98a' : '#c9a26e', undefined, 0.01);
    if (t.detail > 0) for (const z of [-w / 4, w / 4]) t.box(0, y0 + 0.04 + layer / 2, z, len + 0.01, 0.02, 0.02, '#9a7a52', undefined, 0);
  }
}

/** Steel pipes stacked on the quay, 6 m along local x: 1.1 m, crouch cover. */
export const PIPE_STACK: Element<At> = {
  colliders(p) {
    const f = frameOf(p);
    return [f.box([-3.0, 0, -1.05], [3.0, 0.62, 1.05], 'metal'), f.box([-3.0, 0.62, -0.55], [3.0, 1.1, 0.55], 'metal')];
  },
  draw(d, p) {
    pipes(pen(d, p), 6.0, 0, 2.1, 3);
  }
};

/** Stacked sawn timber, 4.8 m along local x, 1.2 wide: `layers` bundles of 0.9 m (2 = standing cover). */
export const TIMBER: Element<At & { layers?: number }> = {
  colliders: (p) => [frameOf(p).box([-2.4, 0, -0.6], [2.4, 0.96 * (p.layers ?? 2), 0.6], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    for (let k = 0; k < (p.layers ?? 2); k++) timber(t, 4.8, k * 0.96, 1.2, 0.96);
  }
};

const FISH_LAYER = 1.05;

/**
 * Plastic fish boxes on a pallet, 1.2 x 0.8, five boxes high: 1.05 m, crouch cover. `tall` stacks a second pallet on
 * top (2.1 m): too high to hop onto, so it can stand against a rail without being a step up onto it.
 */
export const FISH_BOXES: Element<At & { colors?: string[]; tall?: boolean }> = {
  colliders: (p) => [frameOf(p).box([-0.6, 0, -0.4], [0.6, FISH_LAYER * (p.tall ? 2 : 1), 0.4], 'wood')],
  draw(d, p) {
    const t = pen(d, p);
    const cs = p.colors ?? ['#2f7fbf', '#e9e6dc', '#c0392b'];
    for (let level = 0; level < (p.tall ? 2 : 1); level++) {
      const y0 = level * FISH_LAYER;
      t.box(0, y0, 0, 1.2, 0.12, 0.8, WOOD, undefined, 0.01);
      for (let k = 0; k < 5; k++) {
        const c = cs[(k + level) % cs.length]!;
        for (const x of [-0.3, 0.3]) {
          t.box(x, y0 + 0.12 + k * 0.186, 0, 0.58, 0.18, 0.78, c, undefined, 0.015);
          if (d.detail > 0) t.box(x, y0 + 0.2 + k * 0.186, 0.395, 0.2, 0.05, 0.01, shade(c, -0.3), undefined, 0);
        }
      }
    }
  }
};

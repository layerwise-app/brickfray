import type { Element } from './plan';
import { frameOf, pen, type At, type Pen } from './props-kit';
import { WATER_Y } from './docks-parts';
import { box, shade, type PlanCollider, type Vec3 } from './util';

/** Moored coaster, 19.6 m along local x (bow +x), boarded from local -z by gangways. */
export const BOAT = { deck: 0.96, half: 2.8, aft: -9.6, bow: 9.8, roof: 3.84 } as const;
export const BOAT_GANGWAYS: [number, number][] = [[-9.2, -8.0], [1.6, 2.8]];
const HOUSE = { x0: -8.0, x1: -3.2, z0: -1.2, z1: 1.6 } as const;
const DOOR = { z0: -0.36, z1: 0.76 } as const;
const STAIR = { x: -2.0, z0: -2.4, z1: -1.2, steps: 6, run: 0.6 } as const;
/** Roof rail: higher than a jump so its top is no perch. */
const RAIL_H = 1.25;
/** Opening in the aft roof rail: the second way off the roof, a drop onto the aft deck. */
const AFT_GAP = { z0: -0.4, z1: 0.8 } as const;
const HULL = '#1f4e79';
const RED = '#b0302a';
const WHITE = '#e9e6dc';
const DECK_WOOD = '#b98a5a';

/** Deck outline: stepped boxes inside the drawn bow curve. */
const DECKS: [number, number, number][] = [
  [BOAT.aft, 5.6, 2.8],
  [5.6, 7.2, 2.2],
  [7.2, 8.0, 1.9],
  [8.0, 8.8, 1.1]
];

function rails(): [Vec3, Vec3][] {
  const D = BOAT.deck;
  const top = D + RAIL_H;
  const out: [Vec3, Vec3][] = [];
  let a: number = BOAT.aft;
  for (const [g0, g1] of BOAT_GANGWAYS) {
    out.push([[a, D, -2.8], [g0, top, -2.6]]);
    a = g1;
  }
  out.push([[a, D, -2.8], [5.6, top, -2.6]]);
  out.push([[BOAT.aft, D, 2.6], [5.6, top, 2.8]]);
  out.push([[BOAT.aft, D, -2.8], [BOAT.aft + 0.2, top, 2.8]]);
  for (const s of [-1, 1]) {
    for (const [x0, x1, h] of DECKS.slice(1)) out.push(s < 0 ? [[x0, D, -h - 0.2], [x1, top, -h + 0.1]] : [[x0, D, h - 0.1], [x1, top, h + 0.2]]);
  }
  out.push([[8.6, D, -1.1], [8.8, top, 1.1]]);
  return out;
}

function houseColliders(): PlanCollider[] {
  const { x0, x1, z0, z1 } = HOUSE;
  const D = BOAT.deck;
  const f = frameOf({ x: 0, z: 0 });
  const sill = D + 1.04;
  const lintel = BOAT.roof - 0.64;
  const out: PlanCollider[] = [];
  for (const [a, b] of [[z0, DOOR.z0], [DOOR.z1, z1]] as const) {
    for (const x of [x0, x1 - 0.2]) out.push(f.box([x, D, a], [x + 0.2, sill, b], 'metal'));
  }
  for (const z of [z0, z1 - 0.2]) out.push(f.box([x0, D, z], [x1, sill, z + 0.2], 'metal'));
  for (const x of [x0, x1 - 0.2]) for (const z of [z0, z1 - 0.2, DOOR.z0 - 0.2, DOOR.z1]) out.push(f.box([x, sill, z], [x + 0.2, lintel, z + 0.2], 'metal'));
  out.push(f.box([x0, lintel, z0], [x1, BOAT.roof, z1], 'metal', { walk: true }));
  const top = BOAT.roof + RAIL_H;
  out.push(f.box([x0, BOAT.roof, z1 - 0.1], [x1, top, z1], 'metal', { bulletsPass: true }));
  out.push(f.box([x0, BOAT.roof, z0], [x0 + 0.1, top, AFT_GAP.z0], 'metal', { bulletsPass: true }));
  out.push(f.box([x0, BOAT.roof, AFT_GAP.z1], [x0 + 0.1, top, z1], 'metal', { bulletsPass: true }));
  out.push(f.box([x1 - 0.1, BOAT.roof, z0], [x1, top, z1], 'metal', { bulletsPass: true }));
  out.push(f.box([x0, BOAT.roof, z0], [-5.8, top, z0 + 0.1], 'metal', { bulletsPass: true }));
  out.push(f.box([-4.4, BOAT.roof, z0], [x1, top, z0 + 0.1], 'metal', { bulletsPass: true }));
  return out;
}

const houseExtras = (): PlanCollider[] => [
  box([-4.6, BOAT.deck, 0.9], [-3.8, BOAT.deck + 1.0, 1.4], 'metal'),
  box([-7.6, BOAT.roof, 0.6], [-6.8, BOAT.roof + 1.6, 1.4], 'metal')
];

function stairBoxes(): [Vec3, Vec3][] {
  const D = BOAT.deck;
  const rise = (BOAT.roof - D) / STAIR.steps;
  const out: [Vec3, Vec3][] = [];
  for (let i = 0; i < STAIR.steps; i++) out.push([[STAIR.x - (i + 1) * STAIR.run, D, STAIR.z0], [STAIR.x - i * STAIR.run, D + (i + 1) * rise, STAIR.z1]]);
  return out;
}

export const BOAT_EL: Element<At> = {
  colliders(p) {
    const f = frameOf(p);
    const out: PlanCollider[] = DECKS.map(([x0, x1, h]) => f.box([x0, -2.0, -h], [x1, BOAT.deck, h], 'metal', { walk: true }));
    for (const [a, b] of rails()) out.push(f.box(a, b, 'metal'));
    for (const c of [...houseColliders(), ...houseExtras()]) out.push(f.box(c.min, c.max, c.surface, { walk: c.walk, bulletsPass: c.bulletsPass }));
    for (const [a, b] of stairBoxes()) out.push(f.box(a, b, 'metal'));
    out.push(f.box([0.8, BOAT.deck, -1.2], [4.4, BOAT.deck + 0.48, 1.2], 'wood', { walk: true }));
    out.push(f.box([7.2, BOAT.deck, -0.5], [8.0, BOAT.deck + 0.7, 0.5], 'metal'));
    return out;
  },
  nav: (p) => {
    const f = frameOf(p);
    return [f.p(-6.8, BOAT.deck, -1.9), f.p(-1.0, BOAT.deck, -1.9), f.p(-3.5, BOAT.deck + 1.44, -1.8), f.p(-5.3, BOAT.roof, -1.8), f.p(-5.3, BOAT.roof, 0.2), f.p(-7.4, BOAT.roof, 0.2), f.p(-8.8, BOAT.deck, 0.2), f.p(-2.4, BOAT.deck, 2.2)];
  },
  draw(d, p) {
    const t = pen(d, p);
    hull(t);
    for (const [a, b] of rails()) {
      t.span(a[0], b[1] - 0.12, a[2], b[0], b[1], b[2], WHITE, 'metal', 0.02);
      t.span(a[0], a[1], a[2], b[0], b[1] - 0.12, b[2], shade(HULL, 0.08), 'metal', 0);
    }
    deck(t);
    house(t);
    for (const [a, b] of stairBoxes()) {
      t.span(a[0], b[1] - 0.08, a[2], b[0], b[1], b[2], '#8a9096', 'metal', 0);
      if (d.detail > 0) t.span(a[0], a[1], a[2] - 0.01, b[0], b[1] - 0.08, a[2] + 0.05, '#545c63', 'metal', 0);
    }
    t.box(2.6, BOAT.deck, 0, 3.6, 0.48, 2.4, '#2f363d', 'metal', 0.03);
    for (let i = 0; i < 4; i++) t.box(1.15 + i * 0.96, BOAT.deck + 0.48, 0, 0.86, 0.06, 2.2, i % 2 ? '#3a6b4f' : '#33604a', 'metal', 0);
    t.box(7.6, BOAT.deck, 0, 0.8, 0.5, 1.0, '#2f363d', 'metal', 0.04);
    t.cylZ(7.6, BOAT.deck + 0.55, 0, 0.18, 1.2, RED, 'metal');
    if (d.detail > 0) t.ring(7.6, BOAT.deck + 0.02, 1.4, 0.32, 0.06, '#d8c08a');
  }
};

function hull(t: Pen) {
  const plan: [number, number][] = [[BOAT.aft, -2.8], [5.6, -2.8], [8.0, -2.0], [BOAT.bow, 0], [8.0, 2.0], [5.6, 2.8], [BOAT.aft, 2.8]];
  t.d.anim.foam.outline(plan.map(([x, z]) => t.f.p(x * 1.004, 0, z * 1.012)).map(([x, , z]) => [x, z] as [number, number]), WATER_Y, 0.8);
  t.prismUp('boat-hull', plan, BOAT.deck + 1.28, 0, -1.3, 0, HULL, 'plastic');
  const low = plan.map(([x, z]) => [x * 1.004, z * 1.012] as [number, number]);
  t.prismUp('boat-belly', low, 0.5, 0, -1.2, 0, RED, 'plastic');
  t.prismUp('boat-stripe', plan.map(([x, z]) => [x * 1.003, z * 1.01] as [number, number]), 0.14, 0, BOAT.deck - 0.62, 0, WHITE, 'plastic');
  if (t.detail > 0) for (const s of [-1, 1]) for (const x of [-6.4, 0.0, 4.8]) t.box(x, -0.6, s * 2.86, 0.5, 0.5, 0.06, '#2f363d', 'metal', 0);
}

function deck(t: Pen) {
  if (t.detail === 0) {
    // Planks as toned strips: hairline seams would break up without multisampling.
    for (const [x0, x1, h] of DECKS) {
      const n = Math.round((2 * h - 0.1) / 0.4);
      const w = (2 * h - 0.1) / n;
      for (let i = 0; i < n; i++) {
        const z = -h + 0.05 + i * w;
        t.span(x0, BOAT.deck - 0.1, z, x1, BOAT.deck, z + w, shade(DECK_WOOD, PLANK_TONES[(i + Math.round(h * 5)) % 3]!), undefined, 0);
      }
    }
    return;
  }
  for (const [x0, x1, h] of DECKS) t.span(x0, BOAT.deck - 0.1, -h + 0.05, x1, BOAT.deck, h - 0.05, DECK_WOOD, undefined, 0);
  for (let z = -2.4; z <= 2.41; z += 0.8) t.box(-2.0, BOAT.deck, z, 15.2, 0.012, 0.04, shade(DECK_WOOD, -0.2), undefined, 0);
}

const PLANK_TONES = [-0.07, 0, 0.06] as const;

/** Wheelhouse roof: a studded plate with a smooth hatch tile, rail posts and a mid rail. */
function roof(t: Pen) {
  const { x0, x1, z0, z1 } = HOUSE;
  const R = BOAT.roof;
  const tile = (ax: number, az: number, bx: number, bz: number, y: number, color: string, smooth?: boolean) => {
    const [px, , pz] = t.f.p(ax, y, az);
    const [qx, , qz] = t.f.p(bx, y, bz);
    t.d.ground.push({ x0: Math.min(px, qx), z0: Math.min(pz, qz), x1: Math.max(px, qx), z1: Math.max(pz, qz), y, base: y, color, smooth });
  };
  tile(x0 + 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.1, R, shade(WHITE, -0.08));
  tile(-6.1, -0.9, -5.1, -0.1, R + 0.004, '#8a9096', true);
  for (const z of [-0.75, -0.25]) t.box(-5.6, R + 0.004, z, 0.5, 0.03, 0.05, '#545c63', 'metal', 0);
  const posts: [number, number][] = [];
  for (let k = 0; k <= 4; k++) posts.push([x0 + 0.05 + (k * (x1 - x0 - 0.1)) / 4, z1 - 0.05]);
  for (const x of [x0 + 0.05, -5.85, -4.35, x1 - 0.05]) posts.push([x, z0 + 0.05]);
  posts.push([x1 - 0.05, (z0 + z1) / 2], [x0 + 0.05, AFT_GAP.z0 - 0.05], [x0 + 0.05, AFT_GAP.z1 + 0.05]);
  const mid = RAIL_H / 2;
  for (const [x, z] of posts) t.box(x, R, z, 0.06, RAIL_H - 0.08, 0.06, '#f6c624', 'metal', 0);
  t.span(x0, R + mid, z1 - 0.08, x1, R + mid + 0.05, z1 - 0.02, '#f6c624', 'metal', 0);
  t.span(x1 - 0.08, R + mid, z0, x1 - 0.02, R + mid + 0.05, z1, '#f6c624', 'metal', 0);
  for (const [a, b] of [[z0, AFT_GAP.z0], [AFT_GAP.z1, z1]] as const) t.span(x0 + 0.02, R + mid, a, x0 + 0.08, R + mid + 0.05, b, '#f6c624', 'metal', 0);
  t.span(x0, R + mid, z0 + 0.02, -5.8, R + mid + 0.05, z0 + 0.08, '#f6c624', 'metal', 0);
  t.span(-4.4, R + mid, z0 + 0.02, x1, R + mid + 0.05, z0 + 0.08, '#f6c624', 'metal', 0);
}

function house(t: Pen) {
  const { x0, x1, z0, z1 } = HOUSE;
  const D = BOAT.deck;
  const R = BOAT.roof;
  for (const c of houseColliders()) {
    const [a, b] = [c.min, c.max];
    if (c.bulletsPass) {
      t.span(a[0], b[1] - 0.08, a[2], b[0], b[1], b[2], '#f6c624', 'metal', 0);
      continue;
    }
    if (c.walk) t.span(a[0], a[1], a[2], b[0], b[1] - 0.01, b[2], shade(WHITE, -0.06), 'metal', 0.02);
    else t.span(a[0], a[1], a[2], b[0], b[1], b[2], WHITE, 'metal', 0.02);
  }
  roof(t);
  t.span(x0 - 0.05, R - 0.12, z0 - 0.05, x1 + 0.05, R - 0.02, z1 + 0.05, '#2f7f7a', 'metal', 0);
  t.span(x0 - 0.02, D + 0.9, z0 - 0.02, x1 + 0.02, D + 1.04, z1 + 0.02, '#2f7f7a', 'metal', 0);
  t.cyl(-7.2, R, 1.0, 0.42, 1.6, RED, 'metal');
  t.cyl(-7.2, R + 1.6, 1.0, 0.44, 0.3, '#1b1f23', 'metal');
  t.box(-3.5, R, 1.3, 0.12, 2.6, 0.12, WHITE, 'metal', 0);
  t.box(-3.5, R + 2.2, 1.3, 0.12, 0.08, 1.2, WHITE, 'metal', 0);
  if (t.detail === 0) return;
  t.box(-4.2, D, 1.15, 0.8, 1.0, 0.5, '#545c63', 'metal', 0.03);
  t.ringUp(-4.2, D + 1.2, 0.84, 0.3, 0.04, '#7d5434');
  t.box(-4.2, D + 1.2, 0.84, 0.08, 0.08, 0.12, '#7d5434', undefined, 0);
  t.ringUp(-5.6, D + 0.55, z1 + 0.04, 0.28, 0.08, '#f05a1a');
  t.ball(-3.5, R + 2.7, 1.3, 0.12, '#ff3b2f', undefined, 0, 1, 'glow');
}

import { QUAY } from './fortress-layout';
import { F } from './fortress-plan';
import { church, house, hz, rick, sheep, tree, windmill } from './fortress-village';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, shade } from './util';

/**
 * The land beyond the edges, drawn without colliders and without detail it does not need (nobody can reach it):
 * north the crag climbs in rock ledges to a broken watchtower; south the river bends past a far bank of fields and a
 * hamlet; west the town runs on from the square; east the farm's fields come up to the farmyard.
 */
const X = F.edgeX + 0.8;
const E = F.edge + 0.8;
const WATER = '#3f8f96';
const BED = '#4f6a5a';
const LEVEL = -0.6;
const FAR = 240;
const GRASS = ['#7fa64e', '#86ad52', '#79a048'];
const CROPS = ['#86ad52', '#9cbf5a', '#d9c27a', '#c9b46a', '#7a9e4a', '#a48a5a', '#e0c860', '#6f9a4a'];
const CRAG = ['#8a8578', '#7d786c', '#969083', '#706b60'];

type Tile = { x0: number; z0: number; x1: number; z1: number; y?: number; base?: number; smooth?: boolean };

function tile(d: Drawer, r: Tile, color: string) {
  d.ground.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: r.y ?? 0, base: r.base, color: hz(color, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), smooth: r.smooth });
}

function plots(d: Drawer, r: Tile, w: number, dd: number, rng: Rng, colors: string[]) {
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / w));
  const nz = Math.max(1, Math.round((r.z1 - r.z0) / dd));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x0 = r.x0 + ((r.x1 - r.x0) * i) / nx;
      const z0 = r.z0 + ((r.z1 - r.z0) * j) / nz;
      tile(d, { ...r, x0, z0, x1: x0 + (r.x1 - r.x0) / nx, z1: z0 + (r.z1 - r.z0) / nz }, shade(rng.pick(colors), rng.pick([0.03, 0, -0.03])));
    }
  }
}

export function fortressOutside(d: Drawer) {
  const rng = new Rng(41);
  const t = new Pen(d, new Frame(0, 0, 0));
  waters(d, t);
  crag(d, t, rng);
  farBank(d, t, rng);
  town(d, t, rng);
  farm(d, t, rng);
}

/**
 * The river south of the wall: it bends, wide below the town, narrowing past the mill, widening into a pool below the
 * farm, with the quay's cove cut into its bank. No moats: the town and the farm run on from the camps.
 */
function waters(d: Drawer, t: Pen) {
  const reaches: [number, number, number][] = [[-FAR, -40, 70], [-40, -8, 62], [-8, 16, 56], [16, 48, 64], [48, FAR, 84]];
  for (const [x0, x1, z1] of reaches) {
    d.anim.water(x0, E, x1, z1, LEVEL, WATER);
    tile(d, { x0, z0: E, x1, z1, y: LEVEL - 1.2 }, BED);
  }
  // The quay's cove and the mill race's tail, inside the wall line.
  d.anim.water(QUAY.cove0, QUAY.coveZ, QUAY.cove1, E, LEVEL, WATER);
  tile(d, { x0: QUAY.cove0, z0: QUAY.coveZ, x1: QUAY.cove1, z1: E, y: LEVEL - 1.2 }, BED);
  t.box(0, LEVEL - 1.4, E - 0.2, X * 2, 1.4 - LEVEL, 0.4, hz('#8f897c', 0, E), undefined, 0);
  d.anim.foam.edge(-X, E, X, E, LEVEL, 0, 1, 0.6);
  // The near bank's features beyond the wall: a landing stage below the town, a shingle spit off the ford, reed beds.
  for (let z = E + 0.6; z < E + 7.2; z += 0.8) t.box(-50, LEVEL + 0.5, z, 4.0, 0.16, 0.7, hz('#8a5f3a', -50, z), undefined, 0);
  for (const [x, z] of [[-51.8, E + 2], [-48.2, E + 2], [-51.8, E + 6.4], [-48.2, E + 6.4]] as const) t.box(x, LEVEL - 1.2, z, 0.3, 1.86, 0.3, '#5e3f27', undefined, 0);
  tile(d, { x0: 4, z0: E, x1: 14, z1: E + 3.2, y: LEVEL + 0.1 }, '#cdbf9a');
  tile(d, { x0: 6, z0: E + 3.2, x1: 11, z1: E + 5.6, y: LEVEL + 0.1 }, '#cdbf9a');
  for (const [x, z] of [[-24, E + 1.2], [-21, E + 2.0], [44, E + 1.0], [47, E + 1.6], [58, E + 1.2]] as const) for (let k = 0; k < 5; k++) t.box(x + k * 0.5, LEVEL, z + (k % 2) * 0.4, 0.12, 1.2 + (k % 3) * 0.2, 0.12, '#7a8a4a', undefined, 0);
  // Far bank: a shingle beach where the river runs wide, reeds where it narrows.
  for (const [x0, x1, z1] of reaches) tile(d, { x0, z0: z1, x1, z1: z1 + 6, y: 0.2 }, '#cdbf9a');
}

/** The crag: a grassy shelf behind the field wall, rock ledges climbing north, pines, a broken watchtower on top. */
function crag(d: Drawer, t: Pen, rng: Rng) {
  plots(d, { x0: -78, z0: -54, x1: 78, z1: -E, y: F.street }, 12, 8.4, rng, GRASS);
  let y = F.street;
  let z = -54;
  for (let k = 0; k < 7; k++) {
    const rise = rng.range(1.6, 3.2);
    const depth = rng.range(5, 9);
    for (let x = -96; x < 96; ) {
      const w = rng.range(5, 11);
      const out = rng.range(-3.2, 3.2);
      t.box(x + w / 2, y - 0.4, z + out - 0.8, w + 0.3, rise + 0.4, 1.6, hz(rng.pick(CRAG), x, z), undefined, 0);
      x += w;
    }
    y += rise;
    plots(d, { x0: -110, z0: z - depth, x1: 110, z1: z, y }, 18, depth, rng, k > 3 ? ['#6f8a4a', '#7a9450', '#687f46'] : GRASS);
    if (d.detail > 0 || k % 2 === 0) for (let i = 0; i < 9; i++) tree(t, rng.range(-90, 90), y, z - rng.range(1, depth - 1), rng.range(1.0, 1.6), 'pine', rng);
    if (k === 2 && d.detail > 0) for (let i = 0; i < 6; i++) sheep(t, rng.range(-50, 50), y, z - rng.range(1, depth - 1), rng.range(0, Math.PI * 2));
    z -= depth;
  }
  plots(d, { x0: -FAR, z0: -FAR, x1: FAR, z1: z, y }, 40, 40, rng, ['#5f7a40', '#6a8446']);
  // Rock spurs running down to the field wall at uneven spacing, so the crag's foot is ragged, not a ruled line.
  for (const [x, w, h, dz] of [[-54, 7, 2.6, 7], [-38, 5, 1.8, 4], [-20, 9, 3.4, 9], [-2, 6, 2.2, 5], [17, 10, 3.8, 8], [33, 6, 2.0, 5], [51, 8, 3.0, 7], [70, 9, 2.6, 6]] as const) {
    const c = hz(rng.pick(CRAG), x, -E);
    t.box(x, F.street - 0.4, -E - 0.8 - dz / 2, w, h + 0.4, dz, c, undefined, 0);
    t.box(x + w * 0.2, F.street + h - 0.1, -E - 0.8 - dz * 0.7, w * 0.6, h * 0.6, dz * 0.5, shade(c, -0.05), undefined, 0);
  }
  // The broken watchtower on the crag top: a landmark you can see from the whole crag street.
  const [tx, tz] = [-14, z + 6];
  const stone = hz('#a8a294', tx, tz);
  t.box(tx, y, tz, 6.4, 9.6, 6.4, stone, undefined, 0);
  t.box(tx - 1.6, y + 9.6, tz, 3.2, 3.2, 6.4, shade(stone, -0.04), undefined, 0);
  t.box(tx + 1.6, y + 9.6, tz - 1.6, 3.2, 1.6, 3.2, shade(stone, 0.03), undefined, 0);
  t.box(tx, y + 5.0, tz + 3.25, 0.5, 1.2, 0.1, '#1b1d20', undefined, 0);
}

/** The far bank of the river: willows on the bank, fields, a hamlet with a church, a ferry landing. */
function farBank(d: Drawer, t: Pen, rng: Rng) {
  plots(d, { x0: -FAR, z0: 90, x1: FAR, z1: FAR, y: 0.4 }, 18, 14, rng, CROPS);
  for (const [x0, x1, z1] of [[-FAR, -40, 76], [-40, -8, 68], [-8, 16, 62], [16, 48, 70], [48, FAR, 90]] as const) plots(d, { x0, z0: z1, x1, z1: 90, y: 0.4 }, 16, 12, rng, CROPS);
  for (let x = -110; x < 110; x += rng.range(9, 14)) tree(t, x, 0.4, (x < -40 ? 78 : x < -8 ? 70 : x < 16 ? 64 : x < 48 ? 72 : 92) + rng.range(0, 2), rng.range(0.9, 1.2), 'willow', rng);
  for (const [x, w] of [[-34, 7.2], [-25, 8.0], [-16, 7.2], [22, 8.0], [31, 7.2]] as const) house(d, x, 0.4, 96, 'n', w, 8, rng);
  church(d, 3, 0.4, 100, 'n');
  t.box(-2, LEVEL + 0.4, 60.4, 4.8, 0.2, 3.2, hz('#8a5f3a', -2, 60), undefined, 0);
  if (d.detail > 0) for (let i = 0; i < 12; i++) tree(t, rng.range(-140, 140), 0.4, rng.range(110, 170), rng.range(1.2, 1.7), rng.chance(0.5) ? 'pine' : 'oak', rng);
}

/**
 * West: the town runs on from the square. A paved street along the square's back, house rows whose fronts step in and
 * out, lanes running off between them, the church on its green.
 */
function town(d: Drawer, t: Pen, rng: Rng) {
  plots(d, { x0: -FAR, z0: -FAR, x1: -X, z1: FAR, y: 0.02 }, 14, 14, rng, ['#c9bfa8', '#bfb59c', '#c4ba9f']);
  // The front row: gaps where lanes run off, fronts stepping between 64.4 and 68.4 m out.
  for (const [z, x, w] of [[-46.4, -70, 8], [-36.8, -68.4, 8.8], [-27.2, -70, 7.2], [-12.8, -69.2, 8], [-4.0, -72.4, 7.2], [12.0, -68.8, 8.8], [21.6, -70.8, 7.2], [31.2, -68.4, 8], [41.6, -69.6, 8.8], [52.0, -71.4, 8]] as const) house(d, x, 0.02, z, 'e', w, 8, rng);
  for (const z of [-60, -50, 50, 60, -20, 4]) house(d, -86 + rng.range(-2, 2), 0.02, z, 'e', 7.2, 8, rng);
  church(d, -104, 0.02, -8, 'e');
  if (d.detail > 0) for (let i = 0; i < 14; i++) tree(t, rng.range(-150, -96), 0.02, rng.range(-70, 70), rng.range(1.0, 1.5), 'oak', rng);
}

/** East: the farm's fields come up to the farmyard's fence; ricks, a windmill, an orchard, sheep. */
function farm(d: Drawer, t: Pen, rng: Rng) {
  plots(d, { x0: X, z0: -E, x1: FAR, z1: E, y: 0.02 }, 12, 9, rng, CROPS);
  plots(d, { x0: X, z0: -FAR, x1: FAR, z1: -E, y: 0.02 }, 16, 12, rng, CROPS);
  // Hedgerows between the first fields, so the farmyard's edge is a hedge, not a straight bank.
  for (const z of [-24, 0, 24]) for (let x = X + 4; x < 120; x += 2.2) tree(t, x, 0.02, z + rng.range(-0.4, 0.4), 0.45, 'oak', rng);
  windmill(d, 88, 0.02, -18, 'w');
  for (const [x, z] of [[76, 8], [82, 18], [86, 4], [74, 32]] as const) rick(t, x, 0.02, z);
  house(d, 80, 0.02, -36, 'w', 8, 8, rng);
  house(d, 84, 0.02, 40, 'w', 9.6, 8, rng);
  if (d.detail > 0) for (let i = 0; i < 6; i++) sheep(t, rng.range(70, 100), 0.02, rng.range(-12, 30), rng.range(0, Math.PI * 2));
  for (let i = 0; i < (d.detail === 0 ? 6 : 14); i++) tree(t, rng.range(100, 140), 0.02, rng.range(-60, 60), rng.range(0.8, 1.1), 'oak', rng);
}

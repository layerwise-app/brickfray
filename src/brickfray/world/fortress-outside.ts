import { country } from './fortress-country';
import { F } from './fortress-plan';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { Frame, Rng, shade } from './util';
import { hz } from './fortress-village';

/**
 * The land beyond the edges, drawn without colliders (nobody can reach it). North the crag drops 14 m to a valley with
 * a stream, terraced fields climbing the far side; the river leaves the ford past the stakes and falls over the crag at
 * the north-east; south the moat under the barbican, a bridge and the road to a village; west the village street along
 * the stables and the orchard fence; east the far bank, fields, a mill and a second village.
 */
export const OUT = {
  /** Crag edge (z) and the valley floor (y). */
  cliff: -51.2,
  valley: -14,
  /** River beyond the stakes (x), moat (z) and the moat's west end (x). */
  river: [44.8, 58] as const,
  moat: [46.4, 53.6] as const,
  moatEnd: -40,
  /** Village street (x) and the line of house fronts west of it; the south road (x). */
  lane: [-56, -51.2] as const,
  fronts: -57.6,
  road: [-6.4, -1.6] as const,
  /** Where the drawn country ends; fog hides the edge. */
  far: 240
} as const;

const GRASS = '#7fa64e';
const MEADOW = '#86ad52';
const LANE = '#bfa880';
const COBBLE = '#b9ad94';
const BED = '#4f6a5a';
const WATER = '#3f8f96';
const BANK = -0.7;
const CROPS = ['#86ad52', '#9cbf5a', '#d9c27a', '#c9b46a', '#7a9e4a', '#a48a5a', '#e0c860', '#6f9a4a'];
const CRAG = ['#8a8578', '#7d786c', '#969083', '#706b60'];

export function fortressOutside(d: Drawer) {
  const rng = new Rng(41);
  ground(d, rng);
  waters(d);
  cliff(d, rng);
  falls(d, rng);
  bridge(d);
  country(d, rng);
}

type Tile = { x0: number; z0: number; x1: number; z1: number; y?: number; base?: number; smooth?: boolean };

/** One ground tile, hazed by its distance. */
function tile(d: Drawer, r: Tile, color: string) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  d.ground.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, y: r.y ?? 0, base: r.base, color: hz(color, cx, cz), smooth: r.smooth });
}

/** A rectangle cut into plots, each its own crop or a tone of one colour. */
export function plots(d: Drawer, r: Tile, w: number, dd: number, rng: Rng, colors: string[]) {
  const xs = cuts(r.x0, r.x1, w);
  const zs = cuts(r.z0, r.z1, dd);
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const c = shade(rng.pick(colors), rng.pick([0.03, 0, -0.03]));
      tile(d, { ...r, x0: xs[i]!, x1: xs[i + 1]!, z0: zs[j]!, z1: zs[j + 1]! }, c);
    }
  }
}

function cuts(a: number, b: number, step: number) {
  const n = Math.max(1, Math.round((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** Ground outside the playable outline; every tile beside water has a bank down to the bed. */
function ground(d: Drawer, rng: Rng) {
  const { cliff, valley, river, moat, moatEnd, lane, road, far } = OUT;
  const meadow = [GRASS, MEADOW, '#79a048'];
  plots(d, { x0: -48.4, z0: cliff, x1: 32.0, z1: -48.8 }, 9.6, 2.4, rng, meadow);
  tile(d, { x0: 32.0, z0: cliff, x1: river[0], z1: -50.4, base: BANK }, GRASS);
  plots(d, { x0: -48.4, z0: -48.8, x1: EDGE_GARDEN, z1: -27.2 }, 7.2, 7.2, rng, meadow);
  tile(d, { x0: -51.2, z0: cliff, x1: -48.4, z1: moat[1] }, GRASS);
  tile(d, { x0: lane[0], z0: cliff, x1: lane[1], z1: moat[1], smooth: true }, LANE);
  plots(d, { x0: -66.0, z0: cliff, x1: lane[0], z1: moat[1] }, 10, 12, rng, meadow);
  plots(d, { x0: -far, z0: cliff, x1: -66.0, z1: moat[1] }, 19.2, 24, rng, CROPS);
  plots(d, { x0: -48.4, z0: F.bandS, x1: -28.0, z1: moat[0], base: BANK }, 10.2, 9.6, rng, ['#c9b46a', '#d2bd72']);
  tile(d, { x0: -48.4, z0: moat[0], x1: moatEnd, z1: moat[1], base: BANK }, GRASS);
  tile(d, { x0: -28.0, z0: 45.6, x1: -7.2, z1: moat[0], base: BANK }, GRASS);
  tile(d, { x0: -0.8, z0: 45.6, x1: 10.4, z1: moat[0], base: BANK }, GRASS);
  tile(d, { x0: -7.2, z0: 45.6, x1: -0.8, z1: 48.0, smooth: true }, COBBLE);
  plots(d, { x0: 10.4, z0: 40.8, x1: F.ford0, z1: moat[0], base: BANK }, 8.8, 5.6, rng, meadow);
  plots(d, { x0: -far, z0: moat[1], x1: road[0], z1: far, base: BANK }, 19.2, 24, rng, CROPS);
  tile(d, { x0: road[0], z0: moat[1], x1: road[1], z1: far, base: BANK, smooth: true }, LANE);
  plots(d, { x0: road[1], z0: moat[1], x1: river[0], z1: far, base: BANK }, 15.4, 24, rng, CROPS);
  tile(d, { x0: river[1], z0: cliff, x1: river[1] + 3.6, z1: far, base: BANK, smooth: true }, LANE);
  plots(d, { x0: river[1] + 3.6, z0: cliff, x1: far, z1: far }, 19.2, 24, rng, CROPS);
  for (const r of [
    { x0: river[0], z0: cliff, x1: river[1], z1: far },
    { x0: F.ford0, z0: EDGE_FORD, x1: river[0], z1: moat[0] },
    { x0: moatEnd, z0: moat[0], x1: river[0], z1: moat[1] }
  ]) tile(d, { ...r, y: BANK }, BED);
  // Valley floor, the stream along it and the pool under the falls.
  const v = { y: valley, base: valley - 0.6 };
  plots(d, { ...v, x0: -far, z0: -60, x1: 40, z1: cliff }, 24, 8.8, rng, meadow);
  plots(d, { ...v, x0: 64, z0: -80, x1: far, z1: cliff }, 24, 9.6, rng, meadow);
  plots(d, { ...v, x0: -far, z0: -80, x1: 40, z1: -64 }, 24, 16, rng, meadow);
  tile(d, { ...v, x0: 40, z0: -80, x1: 64, z1: -68 }, MEADOW);
  for (const r of [{ x0: -far, z0: -64, x1: 40, z1: -60 }, { x0: 40, z0: -68, x1: 64, z1: cliff }]) tile(d, { ...r, y: valley - 0.6 }, BED);
  terraces(d, rng);
}

const EDGE_GARDEN = -34.4;
const EDGE_FORD = 40.4;

/** Terraced fields stepping up the far side of the valley, stone risers and hedges along their fronts. */
function terraces(d: Drawer, rng: Rng) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { valley, far } = OUT;
  const rise = 2.4;
  for (let k = 0; k < 9; k++) {
    const z1 = -80 - 8 * k;
    const z0 = k === 8 ? -far : z1 - 8;
    const y = valley + rise * (k + 1);
    plots(d, { x0: -far, z0, x1: far, z1, y, base: y - rise }, 26, z1 - z0, rng, CROPS);
    t.box(0, y - rise, z1 - 0.25, far * 2, rise + 0.3, 0.5, hz('#a39a86', 0, z1), undefined, 0);
    if (d.detail > 0 && k % 2 === 0) t.box(0, y, z1 - 0.9, far * 2, 0.9, 0.9, hz('#4a7a36', 0, z1), undefined, 0);
  }
}

function waters(d: Drawer) {
  const { cliff, valley, river, moat, moatEnd, far } = OUT;
  d.anim.water(river[0], cliff, river[1], far, F.water, WATER);
  d.anim.water(F.ford0, EDGE_FORD, river[0], moat[0], F.water, WATER);
  d.anim.water(moatEnd, moat[0], river[0], moat[1], F.water, WATER);
  d.anim.water(-far, -64, 40, -60, valley - 0.1, WATER);
  d.anim.water(40, -68, 64, cliff, valley - 0.1, WATER);
  d.anim.foam.edge(-28.0, moat[0], 10.4, moat[0], F.water, 0, 1, 0.6);
  d.anim.foam.edge(moatEnd, moat[1], river[0], moat[1], F.water, 0, -1, 0.5);
  d.anim.foam.edge(river[1], cliff, river[1], 120, F.water, -1, 0, 0.6);
}

/** The crag's face under the north edge: stepped rock slabs with ledges and scrub, wider toward the foot. */
function cliff(d: Drawer, rng: Rng) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { cliff: z, valley, river, far } = OUT;
  const [g0, g1] = [river[0] - 3.2, river[1] + 3.2];
  let x = -far;
  while (x < far) {
    const near = Math.abs(x) < 90;
    const w = x < g0 ? Math.min(near ? rng.range(4.8, 7.2) : 16, g0 - x) : near ? rng.range(4.8, 7.2) : 16;
    const cx = x + w / 2;
    x = x < g0 && x + w >= g0 ? g1 : x + w;
    const c = hz(rng.pick(CRAG), cx, z);
    const dd = rng.range(1.2, 3.2);
    t.box(cx, valley - 0.6, z - dd / 2, w + 0.2, -valley + 0.6 - rng.range(0, 0.3), dd, c, undefined, 0);
    const e = rng.range(1.6, 3.6);
    const h = rng.range(3.2, 8.0);
    t.box(cx + rng.range(-1, 1), valley - 0.6, z - dd - e / 2, w * rng.range(0.6, 0.9), h, e, shade(c, -0.05), undefined, 0);
    if (d.detail > 0 && near && rng.chance(0.6)) t.ball(cx, valley + h, z - dd - e / 2, rng.range(0.7, 1.2), hz('#4f7a3a', cx, z), [1.2, 0.7, 1], 0.2, rng.int(1, 9));
  }
  for (const [x0, x1] of [[river[0] - 3.2, river[0]], [river[1], river[1] + 3.2]] as const) {
    t.box((x0 + x1) / 2, valley - 0.6, z - 1.8, x1 - x0, -valley + 2.2, 3.6, hz('#7d786c', x0, z), undefined, 0);
  }
}

/** The river pours over the crag lip in a broken sheet into a pool, spray and foam at its foot. */
function falls(d: Drawer, rng: Rng) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { cliff: z, valley, river } = OUT;
  const step = d.detail === 0 ? 2.6 : 1.3;
  const sheet = ['#d8eef0', '#c4e4ea', '#e9f6f6', '#b5dbe3'];
  for (let x = river[0] + step / 2; x < river[1]; x += step) {
    t.box(x, valley - 0.1, z - 0.5 - rng.range(0, 0.6), step + 0.05, F.water - valley + 0.05, 0.5, rng.pick(sheet), undefined, 0);
  }
  t.box((river[0] + river[1]) / 2, F.water - 0.5, z - 0.3, river[1] - river[0], 0.45, 0.7, '#eef8f8', undefined, 0);
  d.anim.foam.edge(river[0], z, river[1], z, F.water, 0, 1, 1.2);
  const spray = d.detail === 0 ? 3 : 6;
  for (let i = 0; i < spray; i++) {
    const x = river[0] + 1.5 + ((river[1] - river[0] - 3) * i) / (spray - 1);
    t.ball(x, valley + 0.3, z - 2.2 - rng.range(0, 1.2), rng.range(1.4, 2.2), '#f4fbfb', [1.4, 0.6, 1], 0.2, i + 1);
  }
  d.anim.foam.ring((river[0] + river[1]) / 2, z - 4.4, valley - 0.1, 6.0, 1.8, 16);
  // Spray rising over the lip, so the fall shows from the ford and the ward.
  for (let i = 0; i < (d.detail === 0 ? 3 : 5); i++) {
    const x = river[0] + 2.0 + i * 2.4 + rng.range(-0.6, 0.6);
    t.ball(x, rng.range(-1.6, 0.4), z - 1.6 - rng.range(0, 1.2), rng.range(1.2, 1.9), '#eef6f6', [1.3, 0.8, 1], 0.25, i + 3);
  }
}

/** Stone bridge from the outer gate across the moat. */
function bridge(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { moat, road } = OUT;
  const [x0, x1] = [-7.6, -0.4];
  const z0 = 48.0;
  const len = moat[1] - z0;
  const zc = z0 + len / 2;
  const stone = '#c9bfa8';
  t.box((x0 + x1) / 2, -0.4, zc, x1 - x0, 0.44, len, stone, undefined, 0);
  t.box((road[0] + road[1]) / 2, 0.02, zc, road[1] - road[0], 0.04, len, shade(LANE, -0.04), undefined, 0);
  for (const x of [x0 + 0.2, x1 - 0.2]) t.box(x, 0.04, zc, 0.4, 0.72, len, shade(stone, -0.05), undefined, 0);
  t.box((x0 + x1) / 2, BANK, zc, x1 - x0 + 0.8, 0.5, 1.6, shade(stone, -0.12), undefined, 0);
}

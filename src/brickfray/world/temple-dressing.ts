import { DECAL, GROUND, VISUAL } from './blocks';
import type { Element, Plan } from './plan';
import type { At } from './props-kit';
import { BANNER, TORCH } from './props-castle';
import { BARREL, CRATE } from './props-harbor';
import { BUSH, ROCK, TREE } from './props-nature';
import { T } from './temple-layout';
import { AWNING, BRAZIER, FALLEN_COLUMN, ferns, GUARDIAN, LANTERN, LOG, LOTUS_POOL, prayerFlags, RUBBLE, URN } from './temple-props';
import type { Vec3 } from './util';

const GRASS = '#5c9a3e';
const PAVING = '#d8c49a';
const FLAGSTONE = '#c4ab80';
const MOSS = ['#7fa45a', '#6f9a4a'];
const TERRACOTTA = '#b07a5a';
const PATH = '#a9895a';
const SAFFRON = ['#e8a33a', '#b8402c', '#f6c624'];
/** North camp is team 1's (orange), south camp team 0's (blue), as in the HUD. */
const CAMP = { north: { banner: ['#ff7a1a', '#f2f2ee', '#7a3a12'], canvas: '#e8843a' }, south: { banner: ['#2f7dff', '#f2f2ee', '#17284f'], canvas: '#4f86d8' } };
const LAMP = '#ffb060';

/** Adds an element and its half-turn copy (south side) about the centre. */
function both<P extends At>(p: Plan, el: Element<P>, at: P) {
  p.add(el, at);
  p.add(el, { ...at, x: -at.x, z: -at.z, turns: (at.turns ?? 0) + 2 });
}

const turnV = (v: Vec3): Vec3 => [-v[0], v[1], -v[2]];

function ground(p: Plan) {
  const E = T.edge;
  const g = (x0: number, z0: number, x1: number, z1: number, color: string, surface: 'foliage' | 'stone') => p.add(GROUND, { x0, z0, x1, z1, y: 0, color, surface, depth: 2.4 });
  g(-E, -E, E, -T.row, GRASS, 'foliage');
  g(-E, T.row, E, E, GRASS, 'foliage');
  g(-E, -T.row, -T.galleryOut, T.row, GRASS, 'foliage');
  g(T.galleryOut, -T.row, E, T.row, GRASS, 'foliage');
  g(-T.galleryOut, -T.row, T.galleryOut, T.row, PAVING, 'stone');
  const decal = (x0: number, z0: number, x1: number, z1: number, color: string) => {
    p.add(DECAL, { x0, z0, x1, z1, y: 0.004, color, surface: 'stone' });
    p.add(DECAL, { x0: -x1, z0: -z1, x1: -x0, z1: -z0, y: 0.004, color, surface: 'stone' });
  };
  decal(-8.0, -8.0, 8.0, -6.4, FLAGSTONE);
  decal(-8.0, -6.4, -6.4, 0, FLAGSTONE);
  decal(6.4, -6.4, 8.0, 0, FLAGSTONE);
  decal(-5.6, -5.6, 5.6, 0, '#a8452e');
  for (const [x0, z0, x1, z1] of [[-20.8, -17.6, -13.6, -11.2], [-12.8, -17.6, -5.6, -11.2], [-0.8, -17.6, 7.2, -11.2], [8.8, -17.6, 17.6, -11.2]] as const) decal(x0, z0, x1, z1, TERRACOTTA);
  decal(-4.8, -18.4, -2.4, -6.4, '#9a8f74');
  decal(-28.4, -18.4, -26.8, 14.4, PATH);
  decal(-24.0, -18.4, -22.4, 18.4, FLAGSTONE);
  decal(-30.4, -21.2, 24.8, -19.6, PATH);
  for (const x of [-17.2, -3.6, 2.8, 16.8]) decal(x - 0.8, -19.6, x + 0.8, -18.4, PATH);
  const moss: [number, number, number, number][] = [[-19.6, -9.6, -17.6, -8.8], [-11.2, -3.2, -9.6, -2.0], [9.6, -9.6, 11.2, -8.4], [16.8, -3.6, 19.2, -2.4], [-2.4, -9.6, -1.6, -7.2], [12.0, -7.2, 13.6, -6.4], [-16.0, -10.4, -14.4, -9.6]];
  moss.forEach((m, i) => decal(...m, MOSS[i % 2]!));
  for (const [x0, z0, x1, z1] of [[-20.0, -29.6, -12.0, -27.2], [2.4, -30.4, 9.6, -28.8], [14.4, -27.2, 20.0, -25.6]] as const) decal(x0, z0, x1, z1, '#4f8a3a');
}

/** Streams: foam where the water meets the bank wall and the far cliff. */
const STREAMS: Element<object> = {
  draw(d) {
    for (const s of [-1, 1]) {
      const bank = s * 31.2;
      const far = s * 34.4;
      d.anim.foam.edge(bank, -T.edge, bank, T.edge, T.water, s, 0, 0.5);
      d.anim.foam.edge(far, -T.edge, far, T.edge, T.water, -s, 0, 0.7);
    }
  }
};

function court(p: Plan) {
  both(p, LOTUS_POOL, { x: -13.6, z: -5.6 });
  both(p, RUBBLE, { x: -9.2, z: -4.8, turns: 1 });
  both(p, RUBBLE, { x: 9.2, z: -5.2, seed: 3 });
  both(p, FALLEN_COLUMN, { x: 15.6, z: -5.2 });
  both(p, BRAZIER, { x: -7.6, z: -7.6 });
  both(p, BRAZIER, { x: 7.6, z: -7.6 });
  both(p, GUARDIAN, { x: 0.6, z: -9.6 });
  both(p, GUARDIAN, { x: 5.0, z: -9.6 });
  both(p, URN, { x: -20.8, z: -9.6, color: '#2f7a8a' });
  both(p, URN, { x: 20.4, z: -8.8, color: '#b8402c' });
}

function districts(p: Plan) {
  for (const side of ['north', 'south'] as const) {
    const k = side === 'north' ? 1 : -1;
    const c = CAMP[side];
    const at = (x: number, z: number, turns = 0) => ({ x: k * x, z: k * z, turns: side === 'north' ? turns : turns + 2 });
    p.add(AWNING, { ...at(-7.6, -23.2), color: c.canvas });
    p.add(CRATE, { ...at(-5.4, -23.6), size: 'large' });
    p.add(CRATE, { ...at(-5.4, -23.6), y: 1.12, size: 'small' });
    p.add(CRATE, { ...at(-20.8, -22.0), size: 'large' });
    p.add(CRATE, { ...at(-20.8, -22.0), y: 1.12, size: 'small' });
    p.add(BARREL, { ...at(-19.8, -21.4), kind: 'wood' });
    p.add(LANTERN, at(-14.0, -21.2));
    p.add(LOTUS_POOL, at(0.8, -22.4));
    p.add(CRATE, { ...at(6.0, -22.0), size: 'large' });
    p.add(BARREL, { ...at(6.9, -21.4), kind: 'drum', color: c.banner[0] });
    p.add(CRATE, { ...at(12.4, -21.6), size: 'large' });
    p.add(CRATE, { ...at(13.3, -22.2), size: 'small' });
    p.add(TREE, { ...at(-28.8, -29.4), kind: 'oak', size: 1.1 });
    p.add(TREE, { ...at(23.6, -29.2), kind: 'blossom', size: 1.0 });
    p.add(TREE, { ...at(-1.6, -29.6), kind: 'poplar', size: 1.0 });
    for (const [x, z] of [[-12.8, -29.8], [9.6, -29.8], [-24.0, -29.8]] as const) p.add(BUSH, { ...at(x, z), size: 1.1 });
    for (const x of [-20.0, -6.8, 5.6, 13.2]) p.add(BANNER, { ...at(x, -T.row, 2), y: 5.4, colors: c.banner, width: 1.3, height: 2.6, pattern: 'chevron' });
    p.add(VISUAL, (d) => {
      for (const x of [-14, 0, 12]) prayerFlags(d, [k * x, 6.1, k * -T.row], [k * (x + 3), 8.2, k * -T.edge], 9);
      ferns(d, [k * -T.edge, k * -29.9], [k * T.galleryOut, k * -29.9], side === 'north' ? 3 : 4);
      ferns(d, [k * -30.0, k * -18.4], [k * -30.0, k * 14.0], side === 'north' ? 5 : 6);
    });
  }
}

function lanes(p: Plan) {
  both(p, ROCK, { x: -29.0, z: -11.2, size: 1.5, color: '#8a8f82' });
  both(p, LOG, { x: -26.6, z: -4.8, turns: 1 });
  both(p, ROCK, { x: -29.0, z: 1.6, size: 1.4, color: '#7d8276', seed: 4 });
  both(p, LOG, { x: -26.6, z: 8.0, turns: 1, length: 2.8 });
  both(p, BUSH, { x: -29.6, z: 12.4, size: 1.2 });
}

/** Banners on the court faces of the rows, torches by doors and in rooms, and pools of their light. */
function lights(p: Plan) {
  for (const x of [-20.0, -6.8, 0, 5.6]) both(p, BANNER, { x, z: -T.canyon, y: 5.4, colors: SAFFRON, width: 1.2, height: 2.4, pattern: 'border' });
  const torches: [number, number, number, number][] = [
    [-13.6, 2.4, -16.4, 3],
    [-12.8, 2.4, -16.4, 1],
    [7.2, 2.4, -16.4, 3],
    [8.8, 2.4, -12.4, 1],
    [-24.0, 2.4, -8.0, 1],
    [-24.0, 2.4, 3.2, 1],
    [-6.4, 2.3, -2.6, 3],
    [-5.6, 2.3, 2.6, 1],
    [-19.0, 2.4, -10.4, 0],
    [-7.6, 2.4, -10.4, 0]
  ];
  for (const [x, y, z, turns] of torches) both(p, TORCH, { x, y, z, turns });
  p.add(VISUAL, (d) => {
    const pool = (x: number, z: number, r: number, k: number) => {
      d.anim.pools.add(x, z, 0.006, r, LAMP, k);
      d.anim.pools.add(-x, -z, 0.006, r, LAMP, k);
    };
    for (const [x, z] of [[-14.4, -16.4], [-12.0, -16.4], [6.4, -16.4], [9.6, -12.4], [-23.2, -8.0], [-23.2, 3.2]] as const) pool(x, z, 2.6, 0.22);
    for (const [x, z] of [[-7.6, -7.6], [7.6, -7.6], [-14.0, -21.2]] as const) pool(x, z, 2.2, 0.16);
    const top = T.stupaTop + 1.2;
    for (const corner of [[-6.2, -6.2], [-6.2, 0]] as const) {
      const a: Vec3 = [0, top, 0];
      const b: Vec3 = [corner[0], T.roofTop + 0.6, corner[1]];
      prayerFlags(d, a, b, 10);
      prayerFlags(d, a, turnV(b), 10);
    }
  });
}

/** Courtyard life, camps, lane cover, banners, lamps and the streams' foam. */
export function templeDressing(p: Plan) {
  ground(p);
  p.add(STREAMS, {});
  court(p);
  districts(p);
  lanes(p);
  lights(p);
}

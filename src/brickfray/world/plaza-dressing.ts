import { BLOCK, DECAL } from './blocks';
import type { Plan } from './plan';
import { BUSH, FLOWERS, HEDGE, TREE, type TreeKind } from './props-nature';
import { FOUNTAIN, STALL } from './props-plaza';
import { BARRIER, BENCH, BIN, BOLLARD, CAFE_TABLE, CONE, HYDRANT, LAMP } from './props-street';
import { CAR, VAN } from './props-vehicles';

const P = 0.16;
const PLANTER = { colors: ['#b44a31', '#c4553a', '#a8452e'], variance: 0.25 };
const BLOOMS = ['#c8231b', '#f6c624', '#f3a6c3', '#f2f2ee', '#c43a85', '#f58a1f'];

function planter(p: Plan, x: number, z: number, w: number, dd: number, h: number, tree?: TreeKind, y0 = P) {
  p.add(BLOCK, { min: [x - w / 2, 0, z - dd / 2], max: [x + w / 2, y0 + h, z + dd / 2], surface: 'stone', style: PLANTER, top: 'tiles', topColor: '#e7e1d2' });
  p.add(FLOWERS, { x, z, y: y0 + h, w: w - 0.5, dd: dd - 0.5, colors: BLOOMS });
  if (tree) p.add(TREE, { x, z, y: y0 + h, kind: tree, size: 0.95 });
}

/** Props of the Sunny Plaza: fountain, planters, stalls, parked cars, café terrace. */
export function plazaDressing(p: Plan) {
  p.add(FOUNTAIN, { x: 0, z: 0, y: P });
  for (const [x, z, t] of [[-6.4, -12.0, 'oak'], [6.4, -12.0, 'blossom'], [-6.4, 12.0, 'blossom'], [6.4, 12.0, 'oak']] as const) planter(p, x, z, 3.2, 3.2, 0.64, t);
  for (const s of [-1, 1]) {
    p.add(STALL, { x: -4.0 * s, z: -15.6 * s, y: P, turns: s > 0 ? 0 : 2, colors: ['#c8231b', '#f2f2ee'], seed: 3 + s });
    p.add(STALL, { x: 4.0 * s, z: -15.6 * s, y: P, turns: s > 0 ? 0 : 2, colors: ['#2f8a3e', '#f3e6b8'], seed: 7 + s });
    p.add(BENCH, { x: -6.4 * s, z: 3.2 * s, y: P, turns: s > 0 ? 3 : 1 });
    p.add(BENCH, { x: -3.2 * s, z: -6.8 * s, y: P, turns: s > 0 ? 2 : 0 });
    p.add(HEDGE, { x: -14.4 * s, z: -18.6 * s, y: P, length: 6.4, height: 1.1 });
    p.add(HEDGE, { x: 14.4 * s, z: -18.6 * s, y: P, length: 6.4, height: 1.1 });
    p.add(LAMP, { x: -20.4 * s, z: -18.8 * s, y: P, double: true });
    p.add(LAMP, { x: 20.4 * s, z: -18.8 * s, y: P, double: true });
    p.add(LAMP, { x: 9.6 * s, z: -9.6 * s, y: P });
    p.add(BIN, { x: -1.8 * s, z: -18.8 * s, y: P });
    p.add(BUSH, { x: -20.4 * s, z: -10.4 * s, y: P, flowers: '#f3a6c3' });
    p.add(BUSH, { x: 20.4 * s, z: 10.4 * s, y: P, flowers: '#f6c624' });
  }
  for (const z of [-3.6, 3.6]) p.add(LAMP, { x: -19.6, z, y: P });
  for (const z of [-6.0, 6.0]) planter(p, 19.6, z, 1.6, 4.0, 0.48);
  for (const x of [-12.8, -4.8, 4.8, 12.8]) {
    for (const z of [-28.4, 28.4]) p.add(TREE, { x: x + (z > 0 ? 0 : 0), z, y: P, kind: Math.abs(x) > 8 ? 'oak' : 'poplar', size: 0.9 });
  }
  for (const [x, z] of [[-29.6, -20], [-29.6, 20], [29.6, -20.8], [29.6, 20.8]] as const) p.add(TREE, { x, z, y: P, kind: 'pine', size: 0.9 });
  for (const x of [-28.8, -20.8, 20.8, 28.8]) for (const z of [-27.2, 27.2]) p.add(LAMP, { x, z, y: P });
  for (const [x, z] of [[-4.4, -26.8], [4.4, 26.8], [-21.2, 19.6], [21.2, -19.6]] as const) p.add(HYDRANT, { x, z, y: P });
  for (const s of [-1, 1]) for (const x of [-4.4, 4.4]) p.add(BOLLARD, { x, z: s * 20.3, y: P });

  cars(p);
  terrace(p);
  roadworks(p);
}

function cars(p: Plan) {
  const parked: [number, number, number, string, string?][] = [
    [-16.8, -25.0, 0, '#c8231b'],
    [-9.6, -25.0, 0, '#3bb3d6', '#f2f2ee'],
    [9.6, -25.0, 0, '#f6c624'],
    [16.8, -25.0, 0, '#2f8a3e', '#f2f2ee'],
    [12.8, -21.4, 2, '#f58a1f'],
    [16.8, 25.0, 2, '#1f62c7', '#f2f2ee'],
    [9.6, 25.0, 2, '#c43a85'],
    [-9.6, 25.0, 2, '#a6c629'],
    [-16.8, 25.0, 2, '#f2f2ee', '#c8231b'],
    [-12.8, 21.4, 0, '#6d7ea8'],
    [-22.8, -7.2, 1, '#e7e1d2', '#2f6a8a'],
    [-22.8, 8.0, 3, '#c8231b'],
    [26.0, 8.0, 3, '#1b9aa0']
  ];
  for (const [x, z, turns, color, roof] of parked) p.add(CAR, { x, z, turns, color, roof });
  p.add(VAN, { x: -12.8, z: -21.6, turns: 2, color: '#f2f2ee', stripe: '#1f62c7' });
  p.add(VAN, { x: 12.8, z: 21.6, turns: 0, color: '#f6c624', stripe: '#c8231b' });
  p.add(VAN, { x: 25.6, z: -4.0, turns: 1, color: '#f2f2ee', stripe: '#2f8a3e' });
}

function terrace(p: Plan) {
  const top = 0.96;
  for (const z of [-11.2, -6.4, 4.8, 9.6]) p.add(CAFE_TABLE, { x: -29.8, z, y: top, turns: 1, canopy: z < 0 ? '#c8231b' : '#1b9aa0' });
  for (const [z0, z1] of [[-14.0, -3.2], [3.2, 14.0]] as const) {
    p.add(BLOCK, { min: [-28.0, top, z0], max: [-27.2, top + 0.48, z1], surface: 'stone', style: PLANTER, top: 'tiles', topColor: '#e7e1d2' });
    p.add(FLOWERS, { x: -27.6, z: (z0 + z1) / 2, y: top + 0.48, w: 0.5, dd: z1 - z0 - 0.4, colors: BLOOMS });
  }
  p.add(DECAL, { x0: -31.6, z0: -1.6, x1: -28.4, z1: 1.6, y: top + 0.004, color: '#c4553a', surface: 'stone' });
}

function roadworks(p: Plan) {
  for (const [x, z] of [[23.2, 15.6], [24.4, 17.2], [25.6, 15.6], [23.2, -16.4], [-23.6, -16.4], [-24.8, -17.6]] as const) p.add(CONE, { x, z });
  p.add(BARRIER, { x: 24.4, z: 18.8 });
  p.add(BARRIER, { x: -24.0, z: -18.8, turns: 0, colors: ['#f58a1f', '#f2f2ee'] });
  p.add(DECAL, { x0: 23.6, z0: 16.0, x1: 25.2, z1: 17.6, y: 0.008, color: '#2f363d', surface: 'metal', smooth: true });
}

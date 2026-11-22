import type { Plan } from './plan';
import { BANNER, CART, FLAGPOLE, HAY, TARGET, TORCH, WEAPON_RACK } from './props-castle';
import { BARREL, CRATE, PLANKS } from './props-harbor';
import { FLOWERS, TREE } from './props-nature';

/** Team colours: red holds the upper ward (team 1), blue the barbican (team 0). */
export const RED = ['#c8231b', '#f6c624', '#7a1712'];
export const BLUE = ['#1f62c7', '#f2f2ee', '#17284f'];

/** Props with their own colliders stand against walls, clear of spawns and of the routes the blockout measured. */
export function fortressDressing(p: Plan) {
  ward(p);
  barbican(p);
  courts(p);
  westLane(p);
  eastLane(p);
}

/** Torches either side of a door in a wall face; `turns` points out of the face. */
function doorTorches(p: Plan, x: number, z: number, half: number, turns: number, y = 2.3) {
  const alongX = turns % 2 === 0;
  for (const s of [-1, 1]) p.add(TORCH, { x: alongX ? x + s * half : x, z: alongX ? z : z + s * half, y, turns });
}

function ward(p: Plan) {
  for (const x of [-14.4, -2.4]) p.add(BANNER, { x, z: -38.4, y: 5.6, turns: 2, colors: RED, width: 1.2, height: 2.2, pattern: 'border' });
  doorTorches(p, -7.2, -38.4, 2.0, 2);
  doorTorches(p, 4.8, -38.4, 2.0, 2);
  p.add(FLAGPOLE, { x: 16.8, z: -47.2, colors: RED, height: 5.6, pattern: 'chevron' });
  // Kitchen garden beds against its west wall, a fruit tree at its foot.
  for (const z of [-45.6, -41.6]) p.add(FLOWERS, { x: -29.4, z, w: 1.4, dd: 3.2, colors: ['#e07a2a', '#c8231b', '#f2f2ee'], seed: Math.round(-z) });
  p.add(TREE, { x: -31.6, z: -30.0, kind: 'blossom', size: 0.85 });
}

function barbican(p: Plan) {
  for (const x of [-8.8, 0.8]) p.add(BANNER, { x, z: 44.8, y: 5.4, turns: 2, colors: BLUE, width: 1.4, height: 2.6, pattern: 'chevron' });
  for (const x of [-13.0, 2.0]) p.add(BANNER, { x, z: 27.2, y: 6.6, turns: 2, colors: BLUE, width: 1.2, height: 2.4, pattern: 'border' });
  p.add(TORCH, { x: -7.9, z: 34.4, y: 2.3, turns: 0 });
  p.add(TORCH, { x: -4.0, z: 35.2, y: 2.3, turns: 3 });
  doorTorches(p, -5.6, 27.2, 2.3, 2, 2.6);
  p.add(FLAGPOLE, { x: -25.0, z: 44.2, colors: BLUE, height: 5.6, pattern: 'chevron' });
  p.add(WEAPON_RACK, { x: -15.2, z: 44.3, turns: 2 });
}

function courts(p: Plan) {
  for (const x of [-12.4, 8.4]) p.add(BANNER, { x, z: -27.2, y: 5.2, turns: 0, colors: RED, width: 1.2, height: 2.2, pattern: 'bands' });
  for (const [x, z, t] of [[2.4, -9.6, 2], [-2.4, 9.6, 0], [-9.6, 2.4, 3], [9.6, -2.4, 1]] as const) {
    const alongX = t % 2 === 0;
    for (const s of [-1, 1]) p.add(TORCH, { x: alongX ? x + s * 1.75 : x, z: alongX ? z : z + s * 1.75, y: 2.3, turns: t });
  }
  for (const [x, z] of [[4.55, -21.6], [4.6, -20.85]] as const) p.add(BARREL, { x, z });
  p.add(CART, { x: 8.0, z: 26.2, turns: 0, load: 'barrels' });
  p.add(HAY, { x: -18.6, z: 25.8, turns: 1 });
  // Flank sheds: the forge's stock beside its fire, a rack on the coal store, barrels at the trough house, planks at the woodshed.
  for (const [x, z] of [[18.85, -5.95], [19.5, -5.95]] as const) p.add(BARREL, { x, z });
  p.add(WEAPON_RACK, { x: 13.6, z: 6.1, turns: 2 });
  for (const [x, z] of [[-19.45, 5.95], [-18.8, 5.95]] as const) p.add(BARREL, { x, z });
  p.add(PLANKS, { x: -14.0, z: -5.95 });
  p.add(CRATE, { x: -19.35, z: -26.55, size: 'large' });
  p.add(CRATE, { x: -19.35, z: -26.55, y: 1.12, size: 'small', turns: 1 });
  doorTorches(p, 12.0, 24.8, 1.9, 3);
}

function westLane(p: Plan) {
  for (const [x, z, kind, size] of [[-45.6, -24.8, 'oak', 0.95], [-45.2, -13.6, 'blossom', 0.9], [-33.6, -24.4, 'blossom', 0.85], [-43.2, -10.6, 'oak', 0.8], [-31.2, -11.6, 'blossom', 0.8]] as const) {
    p.add(TREE, { x, z, kind, size });
  }
  p.add(HAY, { x: -38.4, z: -22.1 });
  p.add(HAY, { x: -37.0, z: -22.1 });
  p.add(HAY, { x: -37.7, z: -22.1, y: 0.64 });
  for (const z of [-6.0, 6.0]) p.add(HAY, { x: -46.6, z, turns: 1 });
  p.add(HAY, { x: -46.6, z: -2.0, turns: 1 });
  p.add(CART, { x: -34.6, z: 25.6, turns: 1, load: 'hay' });
  for (const x of [-46.4, -45.1]) p.add(HAY, { x, z: 15.5 });
  p.add(HAY, { x: -45.75, z: 15.5, y: 0.64 });
  doorTorches(p, -41.2, 16.0, 1.75, 2);
  // Paddock: a hay cart against the flank wall, bales off the stack's north face.
  p.add(CART, { x: -21.6, z: -6.8, turns: 1, load: 'hay' });
  for (const x of [-26.8, -25.5]) p.add(HAY, { x, z: 3.55 });
  p.add(HAY, { x: -26.15, z: 3.55, y: 0.64 });
}

function eastLane(p: Plan) {
  for (const x of [16.8, 19.6]) p.add(TARGET, { x, z: 39.45, turns: 2 });
  p.add(HAY, { x: 22.4, z: 39.5 });
  for (const [x, z] of [[35.3, 17.9], [36.0, 17.85]] as const) p.add(BARREL, { x, z });
  p.add(CRATE, { x: 23.05, z: -26.55, size: 'large' });
}

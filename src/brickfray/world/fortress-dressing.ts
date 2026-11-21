import { C, GATE } from './castle-parts';
import { BLOCK } from './blocks';
import { CASTLE_STONE } from './castle-parts';
import { STOREHOUSE, TENT } from './fortress-parts';
import type { Plan } from './plan';
import { BANNER, CART, HAY, TARGET, TORCH, WEAPON_RACK, WELL } from './props-castle';
import { BARREL, CRATE } from './props-harbor';
import { BUSH, TREE } from './props-nature';
import { STALL } from './props-plaza';
import { FENCE } from './props-street';

const BLUE = ['#1f62c7', '#f2f2ee', '#17284f'];
const RED = ['#c8231b', '#f6c624', '#7a1712'];

/** Courtyard life: banners, torches, market, training yard, carts and cover. */
export function fortressDressing(p: Plan) {
  const wallZ = C.inner;
  for (const s of [-1, 1] as const) {
    const colors = s < 0 ? BLUE : RED;
    for (const x of [-24, -20.8, 20.8, 24]) p.add(BANNER, { x, z: s * wallZ, y: 3.5, turns: s < 0 ? 0 : 2, colors, width: 1.4, height: 2.6, pattern: 'chevron' });
    for (const x of [-2.6, 2.6]) p.add(TORCH, { x, z: s * (wallZ - 1.6), y: 2.3, turns: s < 0 ? 0 : 2 });
    for (const x of [-4.1, 4.1]) p.add(BANNER, { x, z: s * (wallZ - GATE.depth), y: 6.1, turns: s < 0 ? 0 : 2, colors, width: 1.1, height: 2.6, pattern: 'border' });
    for (const x of [-12, 12]) p.add(TORCH, { x, z: s * wallZ, y: 2.4, turns: s < 0 ? 0 : 2 });
    p.add(TENT, { x: s * 24.8, z: s * -24.4, turns: s < 0 ? 2 : 0, color: s < 0 ? '#2f6ab0' : '#c0392b' });
    p.add(TENT, { x: s * -24.8, z: s * -24.4, turns: s < 0 ? 0 : 2, color: s < 0 ? '#e7e1d2' : '#e7e1d2', trim: s < 0 ? '#1f62c7' : '#c8231b' });
    for (const [dx, dz, size] of [[0, 0, 'large'], [1.2, 0.2, 'small'], [0.4, 1.2, 'small']] as const) p.add(CRATE, { x: s * (16 + dx), z: s * (-22.4 + dz), size });
    p.add(CRATE, { x: s * 16, z: s * -22.4, y: 1.12, size: 'small' });
    for (const [dx, dz] of [[0, 0], [0.7, 0.1], [0.3, 0.7]] as const) p.add(BARREL, { x: s * (-16 + dx), z: s * (-22.8 + dz) });
    p.add(CART, { x: s * -8.0, z: s * -20.0, turns: s < 0 ? 1 : 3, load: s < 0 ? 'hay' : 'barrels' });
  }
  for (const s of [-1, 1] as const) {
    for (const z of [-21.6, 21.6]) p.add(TORCH, { x: s * C.inner, z, y: 2.4, turns: s < 0 ? 1 : 3 });
  }
  for (const [x, z, t] of [[-5.6, 0, 3], [5.6, 0, 1]] as const) for (const dz of [-1.3, 1.3]) p.add(TORCH, { x, z: z + dz, y: 2.2, turns: t });
  for (const [x, z, t] of [[0, -5.6, 2], [0, 5.6, 0]] as const) for (const dx of [-1.3, 1.3]) p.add(TORCH, { x: x + dx, z, y: 2.2, turns: t });

  p.add(WELL, { x: -19.2, z: 0 });
  p.add(STALL, { x: -21.6, z: -18.4, turns: 1, colors: ['#1f62c7', '#f3e6b8'], seed: 4 });
  p.add(STALL, { x: -21.6, z: 18.4, turns: 1, colors: ['#c8231b', '#f3e6b8'], seed: 9 });
  p.add(CART, { x: -17.6, z: -10.4, turns: 0, load: 'hay' });
  p.add(CART, { x: -17.6, z: 10.4, turns: 2, load: 'barrels' });
  for (const [x, z] of [[-24.0, -2.4], [-24.0, 2.4]] as const) p.add(HAY, { x, z, turns: 1 });
  p.add(HAY, { x: -24.0, z: 2.4, y: 0.64, turns: 1 });
  for (const [x, z] of [[-14.4, -16.8], [-14.4, 16.8]] as const) {
    p.add(CRATE, { x, z, size: 'large' });
    p.add(BARREL, { x: x - 1.0, z: z + 0.4 });
  }

  for (const s of [-1, 1] as const) {
    const z0 = s < 0 ? -18.4 : 8.8;
    const z1 = s < 0 ? -8.8 : 18.4;
    p.add(FENCE, { x: 15.2, z: (z0 + z1) / 2, turns: 1, length: z1 - z0, kind: 'wood', height: 1.1 });
    p.add(FENCE, { x: 18.8, z: s < 0 ? z0 : z1, length: 7.2, kind: 'wood', height: 1.1 });
    p.add(TARGET, { x: 20.8, z: (z0 + z1) / 2 - 2.4, turns: 3 });
    p.add(TARGET, { x: 20.8, z: (z0 + z1) / 2 + 2.4, turns: 3 });
    p.add(HAY, { x: 17.6, z: (z0 + z1) / 2, turns: 1 });
    p.add(WEAPON_RACK, { x: 24.0, z: s < 0 ? z1 - 1.0 : z0 + 1.0 });
  }
  for (const s of [-1, 1] as const) {
    p.add(STOREHOUSE, { x0: -23.2, z0: s < 0 ? -15.2 : 12.0, x1: -19.6, z1: s < 0 ? -12.0 : 15.2 });
    for (const [x0, x1] of [[-5.6, -2.4], [2.4, 5.6]] as const) {
      p.add(BLOCK, { min: [x0, 0, s * 18.4 - 0.4], max: [x1, 0.96, s * 18.4 + 0.4], surface: 'stone', style: CASTLE_STONE, top: 'tiles', topColor: '#b8b1a3' });
    }
    for (const k of [[0, 0, 0, 'large'], [1.2, 0, 0, 'large'], [0, 0, 1.12, 'small'], [0.6, 1.0, 0, 'small']] as const) {
      p.add(CRATE, { x: 18.4 + k[0], z: s * (4.0 + k[1]), y: k[2], size: k[3] });
    }
    p.add(BARREL, { x: 10.4, z: s * 15.2, kind: 'wood' });
    p.add(CRATE, { x: 11.4, z: s * 15.6, size: 'large' });
    p.add(CRATE, { x: -10.4, z: s * 15.2, size: 'large' });
    p.add(CRATE, { x: -10.4, z: s * 15.2, y: 1.12, size: 'small' });
  }
  for (const [x, z] of [[24.0, -7.6], [24.0, 7.6]] as const) {
    p.add(BARREL, { x, z, kind: 'wood' });
    p.add(CRATE, { x: x - 1.0, z, size: 'small' });
  }
  for (const [x, z, kind] of [[-25.6, -22.4, 'oak'], [25.6, 22.4, 'oak'], [-9.2, 25.2, 'birch'], [9.2, -25.2, 'birch']] as const) p.add(TREE, { x, z, kind, size: 0.9 });
  for (const [x, z] of [[-27.6, -18.4], [27.6, 18.4], [5.6, 26.8], [-5.6, -26.8]] as const) p.add(BUSH, { x, z });
}

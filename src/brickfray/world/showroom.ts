import * as THREE from 'three';
import { GROUND } from './blocks';
import { defineMap, Plan, type Element } from './plan';
import type { At } from './props-kit';
import { BUSH, FLOWERS, HEDGE, ROCK, TREE } from './props-nature';
import { BENCH, BARRIER, BIN, BOLLARD, CAFE_TABLE, CONE, FENCE, HYDRANT, LAMP } from './props-street';
import { CAR, FORKLIFT, VAN } from './props-vehicles';
import { FOUNTAIN, STALL } from './props-plaza';
import { BARREL, CONTAINER, CRATE, LIFEBUOY, MOORING, PALLET, PLANKS, ROPE } from './props-harbor';
import { BANNER, CART, FLAGPOLE, HAY, TARGET, TORCH, WEAPON_RACK, WELL } from './props-castle';

const ROWS: { z: number; items: [Element<never>, Record<string, unknown>, number][] }[] = [
  { z: -12, items: [[TREE, { kind: 'oak' }, 5], [TREE, { kind: 'blossom' }, 5], [TREE, { kind: 'pine' }, 5], [TREE, { kind: 'poplar' }, 4], [TREE, { kind: 'birch' }, 4], [BUSH, { flowers: '#f3a6c3' }, 2.5], [ROCK, {}, 3], [HEDGE, { length: 3 }, 4]] },
  { z: -4, items: [[LAMP, {}, 2.5], [LAMP, { double: true }, 3], [BENCH, {}, 3], [CONE, {}, 1.2], [CONE, {}, 1.5], [BARRIER, {}, 3], [BIN, {}, 1.5], [HYDRANT, {}, 1.5], [BOLLARD, {}, 1.2], [CAFE_TABLE, { canopy: '#c8231b' }, 3.5], [FENCE, { length: 3, kind: 'picket' }, 3.5], [FENCE, { length: 3, kind: 'iron' }, 3.5], [FENCE, { length: 3, kind: 'chain' }, 3.5], [FENCE, { length: 3, kind: 'wood' }, 3.5]] },
  { z: 4, items: [[CAR, { color: '#c8231b' }, 5], [CAR, { color: '#3bb3d6', roof: '#f2f2ee' }, 5], [VAN, { color: '#f2f2ee', stripe: '#1f62c7' }, 6], [FORKLIFT, {}, 4], [FOUNTAIN, {}, 8], [STALL, { colors: ['#c8231b', '#f2f2ee'] }, 4], [STALL, { colors: ['#2f8a3e', '#f3e6b8'] }, 4]] },
  { z: 13, items: [[CONTAINER, { color: '#c8231b' }, 7], [CONTAINER, { color: '#1f62c7', open: true }, 9], [CRATE, {}, 1.5], [CRATE, { size: 'large' }, 2], [BARREL, {}, 1.2], [BARREL, { kind: 'drum' }, 1.2], [PALLET, { load: 'sacks' }, 2], [PALLET, { load: 'boxes' }, 2], [ROPE, {}, 1.2], [PLANKS, {}, 3], [MOORING, {}, 1.2], [LIFEBUOY, {}, 1.2]] },
  { z: 21, items: [[CART, { load: 'hay' }, 4], [CART, { load: 'barrels' }, 4], [WELL, {}, 3.5], [HAY, {}, 2], [TARGET, {}, 2], [WEAPON_RACK, {}, 3], [FLAGPOLE, { colors: ['#c8231b', '#f6c624'], pattern: 'border' }, 3], [BANNER, { colors: ['#1f62c7', '#f2f2ee', '#17284f'], y: 3.2, pattern: 'chevron' }, 2], [TORCH, { y: 2 }, 1.5], [FLOWERS, { w: 1.6, dd: 1.2, colors: ['#c8231b', '#f6c624', '#f3a6c3'] }, 2.5]] }
];

export const SHOWROOM = defineMap({
  id: 'plaza',
  name: 'Props',
  atmosphere: { zenith: '#4f9be8', horizon: '#d8e9f5', ground: '#a39b8a', sunColor: '#fff4e2', sunIntensity: 2.8, sunDirection: new THREE.Vector3(0.45, 0.8, 0.5).normalize(), fogNear: 90 },
  bounds: { min: [-40, -5, -20], max: [40, 30, 30] },
  killY: -3,
  seed: 3,
  plan() {
    const p = new Plan();
    p.add(GROUND, { x0: -40, z0: -20, x1: 40, z1: 30, y: 0, color: '#9fa4a8', surface: 'stone' });
    for (const row of ROWS) {
      const total = row.items.reduce((a, [, , w]) => a + w, 0);
      let x = -total / 2;
      for (const [el, params, w] of row.items) {
        p.add(el as Element<At>, { ...params, x: x + w / 2, z: row.z } as At);
        x += w;
      }
    }
    p.spawn(0, 0, 0, 0);
    return p;
  }
});

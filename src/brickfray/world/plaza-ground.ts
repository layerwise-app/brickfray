import { DECAL, GROUND } from './blocks';
import type { Plan } from './plan';
import { CAFE, HALL } from './plaza-north';
import { BASE, BLVD, LAND, QUAY, SQ, STREET } from './plaza-layout';
import { TOWER } from './plaza-middle';
import { ALLEY, ARCADE, SHOP, YARD } from './plaza-south';

type Rect = [number, number, number, number];

/**
 * Ground slab, then paving that names each lane: asphalt, tram rails and pale kerbs on the boulevard; warm cobbles in
 * Market Street; big stone squares with a coloured border in each square (terracotta west, blue-grey east); granite
 * slabs on the quay; worn setts on the base roads; gravel in the yards; tiled floors indoors.
 */
export function plazaGround(p: Plan) {
  const X = LAND.x + 1.6;
  const ground = (x0: number, z0: number, x1: number, z1: number) => p.add(GROUND, { x0, z0, x1, z1, y: 0, color: '#8f877b', surface: 'stone', smooth: true, matte: true });
  ground(-X, LAND.north - BLVD.jog - 0.4, X, QUAY.side + 0.4);
  ground(-QUAY.mid - 0.4, QUAY.side + 0.4, QUAY.mid + 0.4, LAND.south + 0.4);
  const paint = (r: Rect, color: string, smooth = false, y = 0.004) => p.add(DECAL, { x0: Math.min(r[0], r[2]), z0: r[1], x1: Math.max(r[0], r[2]), z1: r[3], y, color, surface: 'stone', smooth });
  const checker = (r: Rect, a: string, b: string, cell: number, y = 0.008) => {
    const [x0, x1] = [Math.min(r[0], r[2]), Math.max(r[0], r[2])];
    for (let i = 0, x = x0; x < x1 - 0.01; i++, x += cell) {
      for (let j = 0, z = r[1]; z < r[3] - 0.01; j++, z += cell) paint([x, z, Math.min(x1, x + cell), Math.min(r[3], z + cell)], (i + j) % 2 ? a : b, false, y);
    }
  };
  // Boulevard: asphalt between pale kerbs, the tram rails along its north side.
  const j = BLVD.jog;
  const m = BLVD.mid;
  for (const [x0, x1, dz] of [[-BASE, -m, 0], [-m, m, -j], [m, BASE, 0]] as const) {
    paint([x0, BLVD.z0 + dz, x1, BLVD.z1 + dz], '#cfc6b4');
    paint([x0, BLVD.z0 + dz + 3.2, x1, BLVD.z1 + dz - 2.4], '#5d5f63', true, 0.008);
    for (const z of [BLVD.z0 + dz + 0.5, BLVD.z0 + dz + 1.9]) paint([x0 === -BASE ? -LAND.x : x0, z - 0.06, x1 === BASE ? LAND.x : x1, z + 0.06], '#8d9196', true, 0.012);
    for (let x = x0 + 2; x < x1 - 2; x += 6.4) paint([x, -37.7 + dz, Math.min(x + 3.2, x1 - 1), -37.5 + dz], '#f2f2ee', true, 0.012);
  }
  for (const s of [-1, 1]) for (const z of [BLVD.z0 + 0.5, BLVD.z0 + 1.9]) paint([s * (m - 0.06), z - j, s * (m + 0.06), z], '#8d9196', true, 0.012);
  for (const s of [-1, 1]) {
    const W = s < 0;
    // Market Street cobbles, the square's border and stone squares.
    paint([s * STREET.x0, STREET.z0, s * SQ.bay, STREET.z1], W ? '#9a8f80' : '#8a8f94');
    paint([s * SQ.bay, SQ.z0, s * SQ.x1, SQ.z1], W ? '#c4553a' : '#3f6f8a');
    checker([s * (SQ.x0 + 0.8), SQ.z0 + 0.8, s * (SQ.x1 - 0.8), SQ.z1 - 0.8], W ? '#ebe1cb' : '#e6ecef', W ? '#dccfb3' : '#d3dde2', 3.2);
    checker([s * SQ.bay, STREET.z1, s * SQ.x0, SQ.z1 - 0.8], W ? '#ebe1cb' : '#e6ecef', W ? '#dccfb3' : '#d3dde2', 2.4);
    // Base road setts, yard gravel, alley cobbles, hall and shop floors.
    paint([s * BASE, LAND.north, s * LAND.x, QUAY.z0], '#a39684');
    paint([s * YARD.x0, YARD.z0 - 8, s * YARD.x1, YARD.z1], '#b9a888');
    paint([s * ALLEY.x0, YARD.z1, s * ALLEY.x1, QUAY.z0], '#9a8f80');
    checker([s * (HALL.x0 + 0.8), HALL.z0 + 0.8, s * (HALL.x1 - 0.8), HALL.z1 - 0.8], W ? '#c4553a' : '#dfe9ef', W ? '#e3d6bc' : '#3f6f8a', 1.6);
    checker([s * (SHOP.x0 + 0.8), SHOP.z0 + 0.8, s * (SHOP.x1 - 0.8), SHOP.z1 - 0.8], W ? '#f2f2ee' : '#b98a5a', W ? '#7fc8e8' : '#a8774a', 0.8);
  }
  // Tower Street and Portico Lane share the town hall's grey setts; the council hall is black and white.
  paint([SQ.x1, SQ.z0, -SQ.x1, SQ.z1], '#b7b0a3');
  paint([ARCADE.x0, SQ.z1, ARCADE.x1, ARCADE.lane], '#b7b0a3');
  paint([HALL.x1, CAFE.back, -HALL.x1, SQ.z0], '#b7b0a3');
  checker([TOWER.x0 + 0.8, TOWER.z0 + 0.8, TOWER.x1 - 0.8, TOWER.z1 - 0.8], '#2f363d', '#efe5cf', 1.6);
  // Quay granite, the arcade's terracotta tiles, a pale kerb line along the rail.
  paint([-LAND.x, QUAY.z0, LAND.x, QUAY.side], '#c9c6bd');
  paint([-QUAY.mid, QUAY.side, QUAY.mid, QUAY.z1], '#c9c6bd');
  paint([-QUAY.mid, QUAY.z1 - 0.6, QUAY.mid, QUAY.z1], '#e3d6bc', false, 0.008);
  for (const s of [-1, 1]) paint([s * LAND.x, QUAY.side - 0.6, s * QUAY.mid, QUAY.side], '#e3d6bc', false, 0.008);
  checker([ARCADE.x0, ARCADE.z0, ARCADE.x1, ARCADE.z1], '#c9774f', '#b8693f', 0.8);
}

import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../sim/collision';
import { MAPS } from '../world/index';
import { K } from '../world/keep';
import { TOWER } from '../world/plaza-parts';
import type { MapId } from '../world/types';
import { ROOMS, roomAt } from './space';

const MAP_IDS = Object.keys(MAPS) as MapId[];
/** A side with a wall (kept pressure at least this) must find one within REACH of the box's face on most rays. */
const WALL = 0.5;
const REACH = 1.0;
const SHARE = 0.5;
/** Wall rays start this far inside the face, past the furniture in the middle of a room. */
const INSET = 1.5;

describe('map spaces', () => {
  it('puts the fortress keep, the plaza council hall and the temple nave in rooms of their own, and the open map in none', () => {
    expect(roomAt('fortress', 0, 1.6, 0)).toEqual({ index: 0, amount: 1 });
    expect(roomAt('plaza', (TOWER.x0 + TOWER.x1) / 2, 1.6, 4)).toEqual({ index: 0, amount: 1 });
    expect(roomAt('temple', 0, 1.6, 12).index).toBe(0);
    expect(roomAt('fortress', 0, 1.6, K.half + 4).index).toBe(-1);
    expect(roomAt('plaza', -3, 1.6, 6).index).toBe(-1);
  });

  it.each(MAP_IDS)('%s: every room box stands where the layout has walls and a roof', (map) => {
    const { colliders } = MAPS[map].layout();
    const world = new CollisionWorld(colliders);
    const bad: string[] = [];
    ROOMS[map].forEach((r, i) => {
      const floor = r.min[1] + 0.5;
      const mid = [(r.min[0] + r.max[0]) / 2, floor + 1.6, (r.min[2] + r.max[2]) / 2] as const;
      const grid = [0.1, 0.3, 0.5, 0.7, 0.9];
      const ears = grid.flatMap((u) => grid.map((v) => [r.min[0] + (r.max[0] - r.min[0]) * u, floor + 1.6, r.min[2] + (r.max[2] - r.min[2]) * v]));
      const solid = ears.filter((p) => colliders.some((c) => !c.bulletsPass && [0, 1, 2].every((a) => p[a]! > c.min[a]! && p[a]! < c.max[a]!)));
      if (solid.length > ears.length * 0.4) bad.push(`room ${i}: ${solid.length}/${ears.length} of its floor is solid`);
      const heights = [floor + 1.2, Math.min(floor + 2.4, r.max[1] - 0.3)];
      for (const [side, axis, sign] of [[0, 0, -1], [1, 0, 1], [4, 2, -1], [5, 2, 1]] as const) {
        if (r.walls[side] < WALL) continue;
        const across = axis === 0 ? 2 : 0;
        const face = sign < 0 ? r.min[axis] : r.max[axis];
        let hits = 0;
        let rays = 0;
        for (const y of heights) {
          for (const u of [0.15, 0.3, 0.5, 0.7, 0.85]) {
            const o = [0, y, 0];
            o[axis] = sign < 0 ? Math.min(r.min[axis] + INSET, mid[axis]!) : Math.max(r.max[axis] - INSET, mid[axis]!);
            o[across] = r.min[across] + (r.max[across] - r.min[across]) * u;
            const d = [0, 0, 0];
            d[axis] = sign;
            const hit = world.raycast(o[0]!, o[1]!, o[2]!, d[0]!, d[1]!, d[2]!, 80, true);
            rays++;
            if (hit && Math.abs(o[axis]! + sign * hit.t - face) <= REACH) hits++;
          }
        }
        if (hits / rays < SHARE) bad.push(`room ${i} side ${side}: ${hits}/${rays} rays find its wall`);
      }
      if (r.walls[3] >= WALL) {
        let hits = 0;
        for (const u of [0.25, 0.5, 0.75]) {
          for (const v of [0.25, 0.5, 0.75]) {
            const x = r.min[0] + (r.max[0] - r.min[0]) * u;
            const z = r.min[2] + (r.max[2] - r.min[2]) * v;
            const hit = world.raycast(x, floor + 1.2, z, 0, 1, 0, 80, true);
            if (hit && floor + 1.2 + hit.t <= r.max[1] + REACH) hits++;
          }
        }
        if (hits / 9 < SHARE) bad.push(`room ${i} ceiling: ${hits}/9 rays find a roof over them`);
      }
    });
    expect(bad).toEqual([]);
  });
});

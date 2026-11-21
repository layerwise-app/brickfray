import { describe, expect, it } from 'vitest';
import { K } from '../world/keep';
import { QUAY_EDGE } from '../world/docks-parts';
import { TOWER } from '../world/plaza-parts';
import { pickSpot } from './scenery';
import { roomAt } from './space';

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('map spaces', () => {
  it('puts the fortress keep and the plaza tower passage in rooms of their own, and the open map in none', () => {
    expect(roomAt('fortress', 0, 1.6, 0)).toEqual({ index: 0, amount: 1 });
    expect(roomAt('plaza', (TOWER.x0 + TOWER.x1) / 2, 1.6, 0)).toEqual({ index: 0, amount: 1 });
    expect(roomAt('fortress', 0, 1.6, K.half + 4).index).toBe(-1);
  });

  it('rings the bell from the belfry and sounds the ship horns out at sea, every time', () => {
    const rng = seeded(7);
    const bells = new Set<string>();
    const horns: number[] = [];
    for (let i = 0; i < 400; i++) {
      const plaza = pickSpot('plaza', rng);
      if (plaza.spot === 'bell') bells.add(JSON.stringify(plaza.position));
      const docks = pickSpot('docks', rng);
      if (docks.spot === 'horn') horns.push(docks.position.z);
    }
    expect(bells.size).toBe(1);
    expect(JSON.parse([...bells][0]!).x).toBeGreaterThan(TOWER.x0);
    expect(horns.length).toBeGreaterThan(0);
    expect(Math.min(...horns)).toBeGreaterThan(QUAY_EDGE + 100);
  });
});

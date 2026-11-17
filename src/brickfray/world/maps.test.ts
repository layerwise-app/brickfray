import { describe, expect, test } from 'vitest';
import { CollisionWorld } from '../sim/collision';
import { DOCKS } from './map-docks';
import { FORTRESS } from './map-fortress';
import { PLAZA } from './map-plaza';
import type { MapDefinition } from './types';
import { validateLayout } from './validate';

const maps: MapDefinition[] = [PLAZA, FORTRESS, DOCKS];

describe.each(maps.map((m) => [m.id, m] as const))('%s layout', (_id, map) => {
  const layout = map.layout();
  const report = validateLayout(layout);

  test('is deterministic', () => {
    const again = JSON.stringify((map as { layout(): unknown }).layout());
    expect(again).toBe(JSON.stringify(layout));
  });

  test('has enough spawns on solid ground', () => {
    expect(layout.spawns.filter((s) => s.team === undefined).length).toBeGreaterThanOrEqual(16);
    expect(layout.spawns.filter((s) => s.team === 0).length).toBeGreaterThanOrEqual(8);
    expect(layout.spawns.filter((s) => s.team === 1).length).toBeGreaterThanOrEqual(8);
    expect(report.spawnIssues).toEqual([]);
  });

  test('spawns face open space', () => {
    const world = new CollisionWorld(layout.colliders);
    const blocked = layout.spawns.filter((s) => {
      const [x, y, z] = s.position;
      const hit = world.raycast(x, y + 1.6, z, -Math.sin(s.yaw), 0, -Math.cos(s.yaw), 8, true);
      return hit !== null;
    });
    expect(blocked).toEqual([]);
  });

  test('keeps players inside the bounds', () => {
    expect(report.leaks).toEqual([]);
  });

  test('waypoints form one strongly connected graph', () => {
    expect(report.stranded).toEqual([]);
    expect(report.deadEnds).toEqual([]);
  });

  test('waypoints cover every reachable floor', () => {
    expect(report.uncoveredFloor).toEqual([]);
  });
});

import { describe, expect, test } from 'vitest';
import { nearestWaypoint } from '../sim/bot-nav';
import { CollisionWorld } from '../sim/collision';
import { DOCKS } from './map-docks';
import { FORTRESS } from './map-fortress';
import { PLAZA } from './map-plaza';
import { TEMPLE } from './map-temple';
import { ColliderIndex } from './nav';
import type { MapDefinition } from './types';
import { validateLayout } from './validate';

const maps: MapDefinition[] = [PLAZA, FORTRESS, DOCKS, TEMPLE];

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

describe('fortress nav', () => {
  // Bots walk to the waypoint nearest the player, then straight at them: one behind a wall parks a solo wave there.
  test('the waypoint bots head for sees a player standing against a wall', () => {
    const layout = FORTRESS.layout();
    const world = new CollisionWorld(layout.colliders);
    const index = new ColliderIndex(layout.colliders);
    const wps = layout.waypoints;
    const R = 0.33;
    let spots = 0;
    const unseen: string[] = [];
    for (const c of layout.colliders) {
      if (c.max[1] - c.min[1] < 1.6) continue;
      const around: [number, number][] = [];
      for (let x = c.min[0] - R; x <= c.max[0] + R + 1e-6; x += 0.4) around.push([x, c.min[2] - R], [x, c.max[2] + R]);
      for (let z = c.min[2] - R; z <= c.max[2] + R + 1e-6; z += 0.4) around.push([c.min[0] - R, z], [c.max[0] + R, z]);
      for (const [x, z] of around) {
        const y = index.support(x, z, c.min[1] + 0.6);
        if (y < layout.killY || !index.clear(x, z, y)) continue;
        if (!wps.some((w) => Math.abs(w.position[1] - y) < 0.3 && Math.hypot(w.position[0] - x, w.position[2] - z) < 3.2)) continue;
        spots++;
        const [wx, wy, wz] = wps[nearestWaypoint(wps, x, y, z)]!.position;
        if (!world.clearLine(wx, wy + 0.6, wz, x, y + 0.6, z) && !world.clearLine(wx, wy + 1.6, wz, x, y + 1.2, z)) unseen.push(`${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`);
      }
    }
    expect(spots).toBeGreaterThan(5000);
    expect(unseen.length).toBeLessThan(spots * 0.01);
  });
});

describe('temple edges', () => {
  // The gorge (west) and river (south) sides are open: only the rail stands there, so the view runs out over the edge.
  test('the gorge and river sides carry a rail, not a wall', () => {
    const tall = TEMPLE.layout().colliders.filter((c) => {
      const west = c.max[0] < -37.2 && c.min[2] > -35.2 && c.max[2] < 35.2;
      const south = c.min[2] > 40.4 && c.min[0] > -31.2 && c.max[0] < 31.2;
      return (west || south) && c.max[1] > 1.3;
    });
    expect(tall).toEqual([]);
  });

  // The cliff side is boulders with balustrade between them: at least a third of it is open to the stream.
  test('the cliff side is not one wall', () => {
    const tall = TEMPLE.layout().colliders.filter((c) => c.min[2] < -40.4 && c.max[0] > -31.2 && c.min[0] < 31.2 && c.max[1] > 1.3);
    let closed = 0;
    for (let x = -31.0; x < 31.2; x += 0.4) if (tall.some((c) => x > c.min[0] && x < c.max[0])) closed += 0.4;
    expect(closed / 62.4).toBeLessThan(0.67);
  });
});

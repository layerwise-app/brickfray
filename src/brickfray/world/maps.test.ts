import { describe, expect, test } from 'vitest';
import { nearestWaypoint } from '../sim/bot-nav';
import { CollisionWorld } from '../sim/collision';
import { DOCKS } from './map-docks';
import { FORTRESS } from './map-fortress';
import { PLAZA } from './map-plaza';
import { TEMPLE } from './map-temple';
import { T } from './temple-layout';
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
    expect(spots).toBeGreaterThan(3000);
    expect(unseen.length).toBeLessThan(spots * 0.01);
  });
});

describe('temple edges', () => {
  // Rails' player barriers reach higher than the rails but stop no bullets and are not seen: they do not close an edge.
  const tall = TEMPLE.layout().colliders.filter((c) => c.max[1] > 1.4 && !c.bulletsPass);
  // Share of an edge (along `alongX` from -half to half) that a tall collider touching it closes.
  const closed = (touches: (c: (typeof tall)[number]) => boolean, alongX: boolean, half: number) => {
    const at = tall.filter(touches);
    let shut = 0;
    for (let a = -half; a < half; a += 0.4) if (at.some((c) => (alongX ? a > c.min[0] && a < c.max[0] : a > c.min[2] && a < c.max[2]))) shut += 0.4;
    return shut / (2 * half);
  };

  // The gorge (north), the river (south) and the camps' terrace edges (west, east) are mostly railed, open to the view.
  test('no side of the map is one wall', () => {
    expect(closed((c) => c.min[2] < -T.edge + 0.01, true, T.edgeX)).toBeLessThan(0.25);
    expect(closed((c) => c.max[2] > T.edge - 0.01, true, T.edgeX)).toBeLessThan(0.5);
    expect(closed((c) => c.min[0] < -T.edgeX + 0.01, false, T.edge)).toBeLessThan(0.25);
    expect(closed((c) => c.max[0] > T.edgeX - 0.01, false, T.edge)).toBeLessThan(0.25);
  });
});

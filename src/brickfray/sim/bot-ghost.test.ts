import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../characters/roster';
import { MAPS } from '../world';
import type { MapId } from '../world/types';
import type { BeliefState } from './bot-belief';
import { BotDirector } from './bots';
import { TICK } from './constants';
import { HostSim } from './host';
import { createMoveState } from './movement';
import type { HostPlayer } from './types';

type Brain = BeliefState & { target: number; hunt: number };
type Spot = readonly [number, number, number];

/**
 * Eight fill bots fight a free-for-all (no damage, so nobody respawns) with a ghost among them: an enemy that never
 * moves on its own, makes no sound and never fires, kept every tick where no bot has a line to it and more than 12 m
 * from all of them. `hiding` picks where it hides (the westmost or eastmost hidden waypoint). Returns every bot's position, facing
 * and shot count each tick, how often any bot believed in, hunted or targeted the ghost, and where the ghost stood.
 */
function haunt(map: MapId, hiding: 'first' | 'last', secs: number) {
  const layout = MAPS[map].layout();
  const sim = new HostSim(layout, { mode: 'ffa', map, minutes: 10, seats: 0, difficulty: 'normal' }, 21);
  sim.damageEnabled = false;
  const bots = new BotDirector(sim);
  const brains = (bots as unknown as { brains: Map<number, Brain> }).brains;
  const crew: HostPlayer[] = [];
  for (let i = 0; i < 8; i++) {
    const spawn = layout.spawns[Math.floor((i * layout.spawns.length) / 8)]!;
    const p = sim.addPlayer(`Bot${i}`, CHARACTER_IDS[i % CHARACTER_IDS.length]!, 'grunt');
    sim.spawn(p, spawn);
    bots.add(p);
    crew.push(p);
  }
  const ghost = sim.addPlayer('Ghost', 'vega');
  sim.spawn(ghost, layout.spawns[0]!);
  const spots = layout.waypoints.map((w) => w.position).sort((p, q) => p[0] - q[0]);
  if (hiding === 'last') spots.reverse();
  const hidden = (p: Spot) =>
    crew.every((b) => {
      const e = sim.eye(b);
      return Math.hypot(p[0] - e[0], p[2] - e[2]) > 12 && !sim.world.clearLine(e[0], e[1], e[2], p[0], p[1] + 1.2, p[2]) && !sim.world.clearLine(e[0], e[1], e[2], p[0], p[1] + 1.7, p[2]);
    });
  const trail: string[] = [];
  const where: Spot[] = [];
  let sensed = 0;
  let moved = 0;
  for (let t = 0; t < secs; t += TICK) {
    const m = ghost.move;
    if (!hidden([m.x, m.y, m.z])) {
      const spot = spots.find(hidden);
      if (spot) {
        ghost.move = createMoveState(spot[0], spot[1], spot[2]);
        ghost.move.grounded = true;
        moved++;
      }
    }
    where.push([ghost.move.x, ghost.move.y, ghost.move.z]);
    bots.tick();
    sim.tick(TICK);
    sim.drain();
    for (const b of crew) trail.push(`${b.move.x.toFixed(5)} ${b.move.z.toFixed(5)} ${b.yaw.toFixed(5)} ${b.arms.shots}`);
    for (const br of brains.values()) if (br.target === ghost.id || br.hunt === ghost.id || br.beliefs.has(ghost.id)) sensed++;
  }
  return { trail, sensed, moved, where };
}

describe.each(['plaza', 'fortress', 'docks', 'temple'] as const)('a ghost on %s', (map) => {
  it('draws no bot: no decision reads an enemy no sense reported', () => {
    const a = haunt(map, 'first', 40);
    const b = haunt(map, 'last', 40);
    // The ghost really hid, in different places in the two matches, and no bot ever came to know of it.
    expect(a.moved).toBeGreaterThan(0);
    expect(a.where.reduce((s, p, i) => s + Math.hypot(p[0] - b.where[i]![0], p[2] - b.where[i]![2]), 0) / a.where.length).toBeGreaterThan(10);
    expect(a.sensed + b.sensed).toBe(0);
    // So every bot moved, looked and fired exactly the same way in both.
    const diverged = a.trail.findIndex((s, i) => s !== b.trail[i]);
    expect(diverged === -1 ? 'identical' : `tick ${Math.floor(diverged / 8)}: ${a.trail[diverged]} vs ${b.trail[diverged]}`).toBe('identical');
  });
});

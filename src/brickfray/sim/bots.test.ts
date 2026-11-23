import { describe, expect, it } from 'vitest';
import { MAPS } from '../world';
import { TICK } from './constants';
import { Match } from './match';

const ALL_MAPS = ['plaza', 'fortress', 'docks', 'temple'] as const;

describe.each(ALL_MAPS)('snapbots on %s', (id) => {
  it('reach an idle player, open fire and never walk into the kill zone', () => {
    const match = new Match(MAPS[id].layout(), { mode: 'solo', map: id, minutes: 0, seats: 0, difficulty: 'normal' });
    const me = match.addHuman('Me', 'rivet');
    match.start();
    me.protectedUntil = Infinity;
    let shots = 0;
    let fell = 0;
    for (let t = 0; t < 60; t += TICK) {
      match.tick(TICK);
      const { events, traces } = match.sim.drain();
      shots += traces.length;
      fell += events.filter((e) => e.type === 'kill' && e.killer === e.victim).length;
    }
    const far = [...match.sim.players.values()].filter((p) => p.bot && p.alive && Math.hypot(p.move.x - me.move.x, p.move.z - me.move.z) > 30);
    expect(fell).toBe(0);
    expect(shots).toBeGreaterThan(20);
    expect(far).toEqual([]);
  });
});

/** Seconds a bot may stay within a metre of one spot, alive and out of contact with any enemy. */
const STILL = 5;

describe.each(ALL_MAPS)('team bots on %s', (id) => {
  it('never stand idle, respawned or not', () => {
    const match = new Match(MAPS[id].layout(), { mode: 'tdm', map: id, minutes: 30, seats: 10, difficulty: 'normal' }, 1);
    match.start();
    const brains = (match.bots as unknown as { brains: Map<number, { target: number; lostFor: number; post: { on: number } | null }> }).brains;
    const trail = new Map<number, { t: number; x: number; y: number; z: number; contact: boolean }[]>();
    const idle: string[] = [];
    let deaths = 0;
    for (let step = 0; step < 240 / TICK; step++) {
      // Nobody reaches the score limit: the match keeps playing, so bots keep dying and respawning.
      match.state.teamScore = [0, 0];
      match.tick(TICK);
      deaths += match.sim.drain().events.filter((e) => e.type === 'kill').length;
      if (step % 15 !== 0) continue;
      for (const p of match.sim.players.values()) {
        if (!p.alive) {
          trail.delete(p.id);
          continue;
        }
        const brain = brains.get(p.id)!;
        // A fight round a corner flickers in and out of sight; holding ground in one is deliberate, as is a long gun
        // holding a high post (it comes down after a while).
        const contact = (brain.target !== 0 && brain.lostFor <= 1) || (brain.post?.on ?? -1) >= 0;
        const h = trail.get(p.id) ?? [];
        h.push({ t: match.time, x: p.move.x, y: p.move.y, z: p.move.z, contact });
        while (h[0]!.t < match.time - STILL) h.shift();
        trail.set(p.id, h);
        if (match.time - h[0]!.t < STILL - 0.3) continue;
        const span = Math.max(...h.map((q) => Math.hypot(q.x - p.move.x, (q.y - p.move.y) * 0.5, q.z - p.move.z)));
        if (span >= 1 || h.filter((q) => q.contact).length * 2 > h.length) continue;
        idle.push(`${p.name} at ${p.move.x.toFixed(1)},${p.move.y.toFixed(1)},${p.move.z.toFixed(1)} t=${match.time.toFixed(0)}`);
        h.length = 0;
      }
    }
    expect(deaths).toBeGreaterThan(20);
    expect(idle).toEqual([]);
  });
});

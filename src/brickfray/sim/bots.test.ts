import { describe, expect, it } from 'vitest';
import { MAPS } from '../world';
import { TICK } from './constants';
import { Match } from './match';

describe.each(['plaza', 'fortress', 'docks'] as const)('snapbots on %s', (id) => {
  it('reach an idle player, open fire and never walk into the kill zone', () => {
    const match = new Match(MAPS[id].layout(), { mode: 'solo', map: id, minutes: 0, bots: 0, difficulty: 'normal' });
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

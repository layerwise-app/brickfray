import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { GrenadeWatch, type DodgeState } from './bot-dodge';
import { BotNav } from './bot-nav';
import { BotDirector } from './bots';
import { TICK } from './constants';
import { HostSim } from './host';
import type { HostPlayer } from './types';

/** A floor `w` × `d` m over the kill zone, nothing else: no waypoints, no spawns, so a bot with nobody to hunt stays put. */
function platform(w: number, d: number): MapLayout {
  return { id: 'plaza', bounds: { min: [-40, -10, -40], max: [40, 10, 40] }, colliders: [{ min: [-w / 2, -1, -d / 2], max: [w / 2, 0, d / 2], surface: 'stone' }], spawns: [], waypoints: [], killY: -5 };
}

/** A bot of `skill` at `at`, a live grenade resting at `grenade` with `fuse` s left, thrown by an enemy who is gone. */
function scene(layout: MapLayout, at: [number, number, number], grenade: [number, number, number], skill: number, seed: number, fuse = 2.5) {
  const sim = new HostSim(layout, { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, seed);
  const bots = new BotDirector(sim);
  const bot = sim.addPlayer('Bot', 'vega', 'grunt');
  sim.spawn(bot, { position: at, yaw: 0 });
  bots.add(bot, skill);
  const thrower = sim.addPlayer('Thrower', 'rivet');
  sim.grenades.push({ id: 1, owner: thrower.id, x: grenade[0], y: grenade[1] + 0.09, z: grenade[2], vx: 0, vy: 0, vz: 0, fuse, bounces: 0, resting: true });
  return { sim, bots, bot };
}

/** Run until the grenade has gone off; whether the bot was hurt, and where it ended up. */
function play(sim: HostSim, bots: BotDirector, bot: HostPlayer) {
  let hurt = false;
  let lowest = bot.move.y;
  for (let t = 0; t < 4; t += TICK) {
    bots.tick();
    sim.tick(TICK);
    hurt ||= sim.drain().events.some((e) => e.type === 'damage' && e.victim === bot.id);
    lowest = Math.min(lowest, bot.move.y);
  }
  return { hurt, lowest, alive: bot.alive };
}

describe('bots and live grenades', () => {
  it('a sharp bot gets out of the blast before it goes off, every time', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { sim, bots, bot } = scene(platform(40, 40), [0, 0, 0], [0, 0, -1.5], 1, seed);
      const { hurt } = play(sim, bots, bot);
      expect(hurt, `seed ${seed}`).toBe(false);
    }
  });

  it('a careless bot is often caught, a sharp one never', () => {
    const caught = (skill: number) => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const { sim, bots, bot } = scene(platform(40, 40), [0, 0, 0], [0, 0, -1.5], skill, seed);
        if (play(sim, bots, bot).hurt) n++;
      }
      return n;
    };
    const careless = caught(0);
    expect(careless).toBeGreaterThanOrEqual(5);
    expect(careless).toBeLessThan(20);
    expect(caught(1)).toBe(0);
  });

  it('a short fuse (a cooked grenade) still gets a quick bot out', () => {
    const { sim, bots, bot } = scene(platform(40, 40), [0, 0, 0], [0, 0, -2], 1, 3, 1.4);
    expect(play(sim, bots, bot).hurt).toBe(false);
  });

  it('runs along a ledge, never off it, when away from the grenade is over the edge', () => {
    for (let seed = 1; seed <= 6; seed++) {
      // A pier 10 m wide: the bot 1 m from its +x edge, the grenade inland of it.
      const { sim, bots, bot } = scene(platform(10, 20), [4, 0, 0], [2, 0, 0], 1, seed);
      const { hurt, lowest, alive } = play(sim, bots, bot);
      expect(alive, `seed ${seed}`).toBe(true);
      expect(lowest, `seed ${seed}`).toBeGreaterThan(-0.5);
      expect(hurt, `seed ${seed}`).toBe(false);
    }
  });

  it('by kind: a Zipbot keeps rushing, a Megabot ignores all but a close one', () => {
    const layout = platform(40, 40);
    const sim = new HostSim(layout, { mode: 'solo', map: 'plaza', minutes: 0, seats: 0, difficulty: 'normal' }, 5);
    const me = sim.addPlayer('Me', 'vega');
    sim.spawn(me, { position: [0, 0, 20], yaw: 0 });
    const watch = new GrenadeWatch(sim, new BotNav(sim));
    const state = (): DodgeState => ({ noticed: new Map(), escape: null });
    const kind = (k: 'rusher' | 'boss' | 'grunt', d: number) => {
      const bot = sim.addPlayer(k, k, k);
      sim.spawn(bot, { position: [0, 0, 0], yaw: 0 });
      sim.grenades.length = 0;
      sim.grenades.push({ id: bot.id, owner: me.id, x: 0, y: 0.09, z: -d, vx: 0, vy: 0, vz: 0, fuse: 2.5, bounces: 0, resting: true });
      const b = state();
      let spot = null;
      // Past any reaction time.
      for (let t = 0; t < 1; t += TICK) {
        sim.time += TICK;
        spot = watch.dodge(bot, b, 1, () => 0.5);
      }
      sim.removePlayer(bot.id);
      return spot;
    };
    expect(kind('rusher', 1.5)).toBeNull();
    expect(kind('boss', 4)).toBeNull();
    expect(kind('boss', 1.5)).not.toBeNull();
    expect(kind('grunt', 4)).not.toBeNull();
  });
});

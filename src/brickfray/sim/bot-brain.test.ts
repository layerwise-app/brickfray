import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../characters/types';
import { MAPS } from '../world';
import type { MapLayout } from '../world/types';
import { BotDirector } from './bots';
import { TICK } from './constants';
import { HostSim } from './host';
import { Match } from './match';
import { BUTTON } from './types';

const field: MapLayout = { id: 'plaza', bounds: { min: [-80, -2, -80], max: [80, 12, 80] }, colliders: [{ min: [-80, -1, -80], max: [80, 0, 80], surface: 'stone' }], spawns: [], waypoints: [], killY: -5 };

type Brains = Map<number, { target: number; lostFor: number; lane: number }>;
const brainsOf = (bots: BotDirector) => (bots as unknown as { brains: Brains }).brains;

/** A fill bot playing `character` at the origin facing -Z, and a player who never shoots back standing `d` m off along `dir`. */
function duel(character: CharacterId, d: number, dir: [number, number] = [0, -1]) {
  const sim = new HostSim(field, { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, 7);
  const bots = new BotDirector(sim);
  const bot = sim.addPlayer('Bot', character, 'grunt');
  sim.spawn(bot, { position: [0, 0, 0], yaw: 0 });
  bots.add(bot);
  const me = sim.addPlayer('Me', 'vega');
  sim.spawn(me, { position: [dir[0] * d, 0, dir[1] * d], yaw: 0 });
  me.protectedUntil = Infinity;
  const run = (secs: number) => {
    for (let t = 0; t < secs; t += TICK) {
      bots.tick();
      sim.tick(TICK);
      sim.drain();
    }
  };
  const apart = () => Math.hypot(bot.move.x - me.move.x, bot.move.z - me.move.z);
  return { sim, bots, bot, me, run, apart };
}

describe('bots in a fight', () => {
  it('reload an empty gun even when the reload key was already down (a grenade throw cancels a reload)', () => {
    const { bot, run } = duel('vega', 60);
    bot.arms.ammo.ar = 0;
    bot.arms.prevButtons = BUTTON.reload;
    run(3);
    expect(bot.arms.ammo.ar).toBeGreaterThan(0);
  });

  it('turn on an attacker shooting from behind at once', () => {
    const { sim, bots, bot, me, run } = duel('vega', 15, [0, 1]);
    run(0.2);
    expect(brainsOf(bots).get(bot.id)!.target).toBe(0);
    sim.damage(bot, 10, { attacker: me.id, weapon: 'ar', kind: 'body', from: [me.move.x, me.move.y + 1.6, me.move.z] });
    run(0.1);
    expect(brainsOf(bots).get(bot.id)!.target).toBe(me.id);
    run(1);
    // Facing +Z, toward the attacker.
    expect(Math.abs(Math.atan2(Math.sin(bot.yaw - Math.PI), Math.cos(bot.yaw - Math.PI)))).toBeLessThan(0.3);
    expect(brainsOf(bots).get(bot.id)!.lostFor).toBe(0);
  });

  it('a long gun keeps its distance, a rifle stops at mid range, a shotgun closes in', () => {
    const harpoon = duel('coral', 12);
    harpoon.run(4);
    expect(harpoon.apart()).toBeGreaterThan(16);
    const rifle = duel('vega', 30);
    rifle.run(5);
    expect(rifle.apart()).toBeGreaterThan(20);
    expect(rifle.apart()).toBeLessThan(29);
    const shotgun = duel('clack', 16);
    shotgun.run(4);
    expect(shotgun.apart()).toBeLessThan(8);
  });

  it('fire on an enemy in sight: a long gun once its sights are up and the body is under the crosshair', () => {
    for (const character of ['coral', 'moss', 'vega', 'clack'] as const) {
      const { bot, run } = duel(character, character === 'clack' ? 6 : 25);
      run(3);
      expect(bot.arms.shots, character).toBeGreaterThan(0);
    }
  });
});

describe('team bots', () => {
  it('spread over the flanks: no flank takes more than two of a team of five', () => {
    const match = new Match(MAPS.docks.layout(), { mode: 'tdm', map: 'docks', minutes: 30, seats: 10, difficulty: 'normal' }, 3);
    match.start();
    for (let t = 0; t < 1; t += TICK) match.tick(TICK);
    const brains = brainsOf(match.bots);
    for (const team of [0, 1]) {
      const lanes = [...match.sim.players.values()].filter((p) => p.team === team).map((p) => brains.get(p.id)!.lane);
      for (const lane of [-1, 0, 1]) expect(lanes.filter((l) => l === lane).length).toBeLessThanOrEqual(2);
    }
  });
});

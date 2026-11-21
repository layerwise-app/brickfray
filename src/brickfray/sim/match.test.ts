import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { TICK } from './constants';
import { WEAPONS } from '../weapons/defs';
import { Match, waveTuning } from './match';
import { BUTTON, DIFFICULTIES, type Difficulty } from './types';

function arena(): MapLayout {
  const spawns = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    spawns.push({ position: [Math.cos(a) * 14, 0, Math.sin(a) * 14] as [number, number, number], yaw: 0, team: (i % 2) as 0 | 1 });
  }
  return {
    id: 'plaza',
    bounds: { min: [-20, -2, -20], max: [20, 10, 20] },
    colliders: [
      { min: [-20, -1, -20], max: [20, 0, 20], surface: 'plastic' },
      { min: [-2, 0, -2], max: [2, 1.2, 2], surface: 'plastic' },
      { min: [-21, 0, -21], max: [-20, 4, 21], surface: 'stone' },
      { min: [20, 0, -21], max: [21, 4, 21], surface: 'stone' },
      { min: [-21, 0, -21], max: [21, 4, -20], surface: 'stone' },
      { min: [-21, 0, 20], max: [21, 4, 21], surface: 'stone' }
    ],
    spawns,
    waypoints: [],
    killY: -5
  };
}

describe('Match', () => {
  it('bots fight in free-for-all and score kills', () => {
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 6, difficulty: 'normal' });
    match.start();
    let kills = 0;
    for (let t = 0; t < 90; t += TICK) {
      match.tick(TICK);
      kills += match.sim.drain().events.filter((e) => e.type === 'kill').length;
    }
    expect(match.state.phase).toBe('playing');
    expect(kills).toBeGreaterThan(3);
  });

  it('a human shot to the head deals headshot damage through the command path', () => {
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 0, difficulty: 'normal' });
    // Vega carries the Clicker AR: 40 to the head.
    const a = match.addHuman('A', 'vega');
    const b = match.addHuman('B', 'rivet');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    match.sim.spawn(a, { position: [0, 0, 10], yaw: 0 });
    match.sim.spawn(b, { position: [0, 0, 4], yaw: 0 });
    a.protectedUntil = b.protectedUntil = 0;
    match.sim.drain();
    const pitch = Math.atan2(0, 6);
    match.sim.applyCommand(a.id, { seq: 1, forward: 0, right: 0, yaw: 0, pitch, buttons: BUTTON.fire, slot: 0, viewTime: match.time, life: a.life });
    const { events, traces } = match.sim.drain();
    expect(traces).toHaveLength(1);
    const damage = events.find((e) => e.type === 'damage');
    expect(damage).toMatchObject({ victim: b.id, kind: 'head', amount: 40 });
  });

  it('commands made before the client saw a respawn keep the new spawn and facing', () => {
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 0, difficulty: 'normal' });
    const a = match.addHuman('A', 'rivet');
    match.start();
    const staleLife = a.life;
    match.sim.spawn(a, { position: [5, 0, 5], yaw: 1.2 });
    const stale = { seq: 1, forward: 1, right: 0, yaw: -2, pitch: 0, buttons: 0, slot: 0, viewTime: match.time, life: staleLife };
    match.sim.applyCommand(a.id, stale);
    expect(a.yaw).toBe(1.2);
    expect([a.move.x, a.move.z]).toEqual([5, 5]);
    match.sim.applyCommand(a.id, { ...stale, seq: 2, life: a.life });
    expect(a.yaw).toBe(-2);
  });

  it("weapon slots and the melee follow the character's loadout", () => {
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 0, difficulty: 'normal' });
    const a = match.addHuman('A', 'coral');
    const b = match.addHuman('B', 'rivet');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    expect(a.arms.weapon).toBe('harpoon');
    let seq = 0;
    const send = (slot: number, buttons = 0) => match.sim.applyCommand(a.id, { seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons, slot, viewTime: match.time, life: a.life });
    for (let i = 0; i < 60; i++) send(1);
    expect(a.arms.weapon).toBe('buzzer');
    for (let i = 0; i < 60; i++) send(0);
    expect(a.arms.weapon).toBe('harpoon');
    match.sim.spawn(a, { position: [0, 0, 6], yaw: 0 });
    match.sim.spawn(b, { position: [0, 0, 4.5], yaw: Math.PI });
    a.protectedUntil = b.protectedUntil = 0;
    match.sim.drain();
    for (let i = 0; i < 20; i++) send(0, i === 0 ? BUTTON.melee : 0);
    const { events } = match.sim.drain();
    // Coral swings the Anchor: 60 a hit.
    expect(events.find((e) => e.type === 'damage')).toMatchObject({ victim: b.id, amount: 60 });
  });

  it('the Pulse Carbine fires three rounds per trigger pull', () => {
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 0, difficulty: 'normal' });
    const a = match.addHuman('A', 'nova');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    match.sim.spawn(a, { position: [0, 0, 6], yaw: 0 });
    let seq = 0;
    for (let i = 0; i < 30; i++) match.sim.applyCommand(a.id, { seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: i < 2 ? BUTTON.fire : 0, slot: 0, viewTime: match.time, life: a.life });
    expect(a.arms.ammo.pulse).toBe(WEAPONS.pulse.mag - 3);
  });

  it('first spawns land in different places from match to match', () => {
    const spots = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, bots: 0, difficulty: 'normal' });
      const me = match.addHuman('Me', 'rivet');
      match.start();
      spots.add(`${me.move.x.toFixed(1)},${me.move.z.toFixed(1)}`);
    }
    expect(spots.size).toBeGreaterThan(1);
  });

  it('solo keeps going wave after wave until the player falls', () => {
    const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, bots: 0, difficulty: 'normal' });
    const human = match.addHuman('Me', 'nova');
    match.start();
    human.protectedUntil = Infinity;
    for (let t = 0; t < 6; t += TICK) match.tick(TICK);
    expect(match.state.wave).toBe(1);
    for (let wave = 1; wave <= 3; wave++) {
      // Kill every snapbot by hand until the break.
      for (let t = 0; t < 60 && match.state.phase !== 'intermission'; t += TICK) {
        for (const p of match.sim.players.values()) if (p.bot && p.alive) match.sim.damage(p, 999, { attacker: human.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
        human.health = 100;
        match.tick(TICK);
      }
      expect(match.state.phase).toBe('intermission');
      // The next wave waits for the upgrade pick, then comes after a short break.
      const offer = match.sim.drain().events.find((e) => e.type === 'upgradeOffer');
      for (let t = 0; t < 10; t += TICK) match.tick(TICK);
      expect(match.state).toMatchObject({ phase: 'intermission', wave });
      expect(offer?.type === 'upgradeOffer' && match.pickUpgrade(human.id, offer.options[1]!)).toBe(true);
      for (let t = 0; t < 6; t += TICK) match.tick(TICK);
      expect(match.state).toMatchObject({ phase: 'playing', wave: wave + 1 });
    }
  });
});

describe('solo difficulty', () => {
  const tuning = (d: Difficulty) => Array.from({ length: 15 }, (_, i) => waveTuning(d, i + 1));
  const keys = ['skill', 'damage', 'count', 'alive'] as const;

  it.each(DIFFICULTIES)('%s gets harder every wave', (d) => {
    const waves = tuning(d);
    for (let i = 1; i < waves.length; i++) {
      for (const k of keys) expect(waves[i]![k]).toBeGreaterThanOrEqual(waves[i - 1]![k]);
      expect(waves[i]!.count).toBeGreaterThan(waves[i - 1]!.count);
    }
    expect(waves[4]!.skill).toBeGreaterThan(waves[0]!.skill);
    expect(waves[4]!.damage).toBeGreaterThan(waves[0]!.damage);
  });

  it('harder settings start harder', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((d) => waveTuning(d, 1));
    for (const k of keys) {
      expect(normal![k]).toBeGreaterThanOrEqual(easy![k]);
      expect(hard![k]).toBeGreaterThanOrEqual(normal![k]);
    }
    expect(hard!.skill).toBeGreaterThan(easy!.skill);
  });
});

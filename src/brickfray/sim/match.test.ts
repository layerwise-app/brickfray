import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { CHARACTER_IDS } from '../characters/roster';
import { TICK } from './constants';
import { WEAPONS } from '../weapons/defs';
import { Match } from './match';
import { botsThrough, secondsToReach, waveRoster, waveTuning } from './waves';
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
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, seats: 6, difficulty: 'normal' });
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
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
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
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
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
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
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
    const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' });
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
      const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, seats: 0, difficulty: 'normal' });
      const me = match.addHuman('Me', 'rivet');
      match.start();
      spots.add(`${me.move.x.toFixed(1)},${me.move.z.toFixed(1)}`);
    }
    expect(spots.size).toBeGreaterThan(1);
  });

  it('solo keeps going wave after wave until the player falls', () => {
    const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, seats: 0, difficulty: 'normal' });
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
  const tuning = (d: Difficulty) => Array.from({ length: 30 }, (_, i) => waveTuning(d, i + 1));

  it.each(DIFFICULTIES)('%s aims and hits harder every wave, and its aim trails a mover less', (d) => {
    const waves = tuning(d);
    for (let i = 1; i < waves.length; i++) {
      expect(waves[i]!.skill).toBeGreaterThanOrEqual(waves[i - 1]!.skill);
      expect(waves[i]!.damage).toBeGreaterThanOrEqual(waves[i - 1]!.damage);
      expect(waves[i]!.lag).toBeLessThanOrEqual(waves[i - 1]!.lag);
    }
    expect(waves[11]!.skill).toBeGreaterThan(waves[0]!.skill);
    expect(waves[29]!.damage).toBeGreaterThan(waves[11]!.damage);
  });

  it('harder settings start harder', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((d) => waveTuning(d, 1));
    for (const k of ['skill', 'damage', 'count', 'alive', 'bossHealth'] as const) {
      expect(normal![k]).toBeGreaterThanOrEqual(easy![k]);
      expect(hard![k]).toBeGreaterThanOrEqual(normal![k]);
    }
    expect(hard!.lag).toBeLessThan(easy!.lag);
    expect(hard!.heal).toBeLessThan(1);
  });

  it('the waves change mix and theme, with something new every two or three waves up to 12', () => {
    const roster = (w: number) => waveRoster('normal', w);
    const kinds = (w: number) => new Set(roster(w));
    expect(kinds(1)).toEqual(new Set(['grunt']));
    expect(kinds(2).has('rusher') && !kinds(2).has('sniper')).toBe(true);
    expect(kinds(3).has('sniper')).toBe(true);
    expect(kinds(5).has('boss')).toBe(true);
    const themes = Array.from({ length: 12 }, (_, i) => waveTuning('normal', i + 1).theme);
    const firsts = themes.map((t, i) => (themes.indexOf(t) === i ? i + 1 : 0)).filter(Boolean);
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]! - firsts[i - 1]!).toBeLessThanOrEqual(3);
    expect(firsts.at(-1)).toBeGreaterThanOrEqual(10);
    // No two waves in a row share a mix (a share of each kind within 10%).
    const mix = (w: number) => ['grunt', 'rusher', 'sniper', 'boss'].map((k) => roster(w).filter((x) => x === k).length / roster(w).length);
    for (let w = 2; w <= 20; w++) expect(mix(w).some((v, i) => Math.abs(v - mix(w - 1)[i]!) > 0.1)).toBe(true);
  });

  it('boss waves bring fewer snapbots alongside the boss than the waves around them', () => {
    for (const d of DIFFICULTIES) {
      for (const w of [5, 10, 15, 20]) {
        const regulars = (n: number) => waveRoster(d, n).filter((k) => k !== 'boss').length;
        expect(waveRoster(d, w).includes('boss')).toBe(true);
        expect(regulars(w)).toBeLessThan(regulars(w - 1));
      }
    }
  });

  it('the leaderboard checks count every snapbot the table sends and the least time it takes', () => {
    for (const d of DIFFICULTIES) {
      let bots = 0;
      for (let w = 1; w <= 30; w++) {
        bots += waveRoster(d, w).length;
        expect(botsThrough(d, w)).toBe(bots);
        expect(waveTuning(d, w).count).toBe(waveRoster(d, w).length);
        expect(secondsToReach(d, w + 1)).toBeGreaterThan(secondsToReach(d, w));
      }
    }
  });

  it('a solo match sends the table: each wave event names its theme and the wave its snapbots in order', () => {
    const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, seats: 0, difficulty: 'normal' }, 3);
    const me = match.addHuman('Me', 'vega');
    match.start();
    me.protectedUntil = Infinity;
    const seen: string[] = [];
    let theme = '';
    for (let t = 0; t < 120 && match.state.wave < 3; t += TICK) {
      match.tick(TICK);
      for (const e of match.sim.drain().events) {
        if (e.type === 'wave') theme = e.theme;
        if (e.type === 'spawn' && match.sim.players.get(e.player)?.bot) seen.push(match.sim.players.get(e.player)!.bot!);
        if (e.type === 'upgradeOffer') match.pickUpgrade(me.id, e.options[0]!);
      }
      expect(match.state.theme).toBe(theme || null);
      for (const p of match.sim.players.values()) if (p.bot && p.alive && match.time > 5) match.sim.damage(p, 999, { attacker: me.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
    }
    expect(seen.slice(0, waveRoster('normal', 1).length + waveRoster('normal', 2).length)).toEqual([...waveRoster('normal', 1), ...waveRoster('normal', 2)]);
  });
});

describe('room seats', () => {
  const room = (bots: number) => {
    const match = new Match(arena(), { mode: 'tdm', map: 'plaza', minutes: 3, seats: bots, difficulty: 'normal' });
    const host = match.addHuman('Host', CHARACTER_IDS[0]!);
    match.start();
    return { match, host };
  };
  const count = (match: Match) => {
    const all = [...match.sim.players.values()];
    return { humans: all.filter((p) => !p.bot).length, bots: all.filter((p) => p.bot).length, sides: [0, 1].map((t) => all.filter((p) => p.team === t).length) };
  };

  it('fills the room with bots up to its size', () => {
    expect(count(room(6).match)).toEqual({ humans: 1, bots: 5, sides: [3, 3] });
    expect(count(room(1).match)).toEqual({ humans: 1, bots: 0, sides: [1, 0] });
  });

  it('gives a bot seat to a human who joins and fills it again when they leave', () => {
    const { match } = room(6);
    const guest = match.addHuman('Guest', CHARACTER_IDS[1]!);
    expect(count(match)).toEqual({ humans: 2, bots: 4, sides: [3, 3] });
    match.remove(guest.id);
    expect(count(match)).toEqual({ humans: 1, bots: 5, sides: [3, 3] });
    expect([...match.sim.players.values()].every((p) => p.alive)).toBe(true);
  });

  it('lets humans in past the room size', () => {
    const { match } = room(2);
    match.addHuman('A', CHARACTER_IDS[1]!);
    match.addHuman('B', CHARACTER_IDS[2]!);
    expect(count(match)).toEqual({ humans: 3, bots: 0, sides: [2, 1] });
  });
});

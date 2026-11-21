import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { GRENADE } from '../weapons/defs';
import { copyArms, createArms, stepArms } from './arms';
import { GRENADE_REFILL, PLAYER, TICK } from './constants';
import { Match } from './match';
import { BUTTON, type Command, type GameEvent, type PlayerState } from './types';
import { takeUpgrade } from './upgrades';

function arena(): MapLayout {
  const spawns = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { position: [Math.cos(a) * 14, 0, Math.sin(a) * 14] as [number, number, number], yaw: 0, team: (i % 2) as 0 | 1 };
  });
  return {
    id: 'plaza',
    bounds: { min: [-20, -4, -20], max: [20, 10, 20] },
    // A floor with a hole in the middle: below it is the map's water.
    colliders: [
      { min: [-20, -1, -20], max: [-3, 0, 20], surface: 'plastic' },
      { min: [3, -1, -20], max: [20, 0, 20], surface: 'plastic' },
      { min: [-3, -1, -20], max: [3, 0, -3], surface: 'plastic' },
      { min: [-3, -1, 3], max: [3, 0, 20], surface: 'plastic' }
    ],
    spawns,
    waypoints: [],
    killY: -0.8
  };
}

function ffa(bots = 0) {
  const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots, difficulty: 'normal' });
  return match;
}

const idle = (seq: number, p: PlayerState, buttons = 0): Command => ({ seq, forward: 0, right: 0, yaw: 0, pitch: 0.4, buttons, slot: 0, viewTime: 0, life: p.life });

/** Throw one grenade: press, then release a few ticks later. Returns the next command number. */
function throwOne(match: Match, p: PlayerState, seq: number) {
  match.sim.applyCommand(p.id, { ...idle(seq++, p, BUTTON.grenade), viewTime: match.time });
  for (let i = 0; i < 3; i++) match.sim.applyCommand(p.id, { ...idle(seq++, p, BUTTON.grenade), viewTime: match.time });
  match.sim.applyCommand(p.id, { ...idle(seq++, p), viewTime: match.time });
  return seq;
}

describe('grenade refill', () => {
  it('a thrown grenade comes back after the refill time, one at a time', () => {
    const match = ffa();
    const a = match.addHuman('A', 'rivet');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    match.sim.spawn(a, { position: [10, 0, 10], yaw: 0 });
    let seq = throwOne(match, a, 1);
    for (let i = 0; i < 40; i++) match.sim.applyCommand(a.id, idle(seq++, a));
    seq = throwOne(match, a, seq);
    expect(a.arms.grenades).toBe(0);
    expect(a.arms.grenadeTimer).toBeGreaterThan(GRENADE_REFILL - 1.2);
    // Ticks after the first throw: 4 + 1 + 40 + 5 = 50 so far.
    let ticks = 50;
    const arrivals: number[] = [];
    let held = 0;
    while (ticks < 60 * 40) {
      match.sim.applyCommand(a.id, idle(seq++, a));
      ticks++;
      if (a.arms.grenades > held) arrivals.push(ticks);
      held = a.arms.grenades;
    }
    expect(a.arms.grenades).toBe(GRENADE.perLife);
    expect(a.arms.grenadeTimer).toBe(0);
    // The first comes back 15 s after its throw; the second 15 s after that, not in parallel.
    expect(arrivals.length).toBe(2);
    expect(Math.abs((arrivals[0]! - 4) * TICK - GRENADE_REFILL)).toBeLessThan(0.05);
    expect(Math.abs((arrivals[1]! - arrivals[0]!) * TICK - GRENADE_REFILL)).toBeLessThan(0.05);
  });

  it('the refill time is the player’s own (from upgrades) and survives a respawn', () => {
    const match = ffa();
    const a = match.addHuman('A', 'rivet');
    match.start();
    for (let i = 0; i < 3; i++) takeUpgrade(a, 'grenadeRefill');
    expect(a.arms.grenadeRefill).toBe(6);
    match.sim.spawn(a, { position: [10, 0, 10], yaw: 0 });
    expect(a.arms.grenadeRefill).toBe(6);
    expect(a.arms.grenades).toBe(a.arms.grenadeMax);
    let seq = throwOne(match, a, 1);
    for (let i = 0; i < 6 * 60 - 30; i++) match.sim.applyCommand(a.id, idle(seq++, a));
    expect(a.arms.grenades).toBe(GRENADE.perLife - 1);
    for (let i = 0; i < 40; i++) match.sim.applyCommand(a.id, idle(seq++, a));
    expect(a.arms.grenades).toBe(GRENADE.perLife);
  });

  it('a client replaying from a snapshot gets each grenade on the same command as the host', () => {
    const p = { arms: createArms(), move: { sprinting: false, vx: 0, vz: 0, grounded: true, crouch: 0 }, character: 'rivet', yaw: 0, pitch: 0, id: 1, life: 0 } as unknown as PlayerState;
    p.arms.grenades = 0;
    const client = { ...p, arms: copyArms(p.arms, createArms()) } as PlayerState;
    const host: number[] = [];
    const replay: number[] = [];
    let hostHeld = 0;
    let clientHeld = 0;
    for (let i = 0; i < 60 * 31; i++) {
      const cmd = idle(i + 1, p);
      stepArms(p, cmd, TICK, null);
      // Every 30 commands the client takes the host's state again, the timer rounded as the wire rounds it.
      if (i % 30 === 0) {
        copyArms(p.arms, client.arms);
        client.arms.grenadeTimer = Math.fround(p.arms.grenadeTimer);
      } else stepArms(client, cmd, TICK, null);
      if (p.arms.grenades !== hostHeld) host.push(i);
      if (client.arms.grenades !== clientHeld) replay.push(i);
      hostHeld = p.arms.grenades;
      clientHeld = client.arms.grenades;
    }
    expect(host.length).toBe(2);
    expect(replay).toEqual(host);
  });

  it('bots follow the same rule', () => {
    const match = ffa(1);
    match.start();
    const bot = [...match.sim.players.values()].find((p) => p.bot)!;
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    bot.arms.grenades = 1;
    let seq = 10_000;
    for (let i = 0; i < GRENADE_REFILL * 60 + 3; i++) match.sim.applyCommand(bot.id, idle(seq++, bot));
    expect(bot.arms.grenades).toBe(2);
  });
});

describe('deaths', () => {
  const kills = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'kill' }> => e.type === 'kill');

  it('falling into the water is its own cause, not an explosion', () => {
    const match = ffa();
    const a = match.addHuman('A', 'rivet');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    match.sim.spawn(a, { position: [0, 0.5, 0], yaw: 0 });
    a.protectedUntil = 0;
    match.sim.drain();
    for (let i = 0; i < 90 && a.alive; i++) match.sim.applyCommand(a.id, { ...idle(i + 1, a), viewTime: match.time });
    const [kill] = kills(match.sim.drain().events);
    expect(kill).toMatchObject({ killer: a.id, victim: a.id, weapon: 'water' });
  });

  it('a kill says when the victim comes back: the respawn delay in timed modes, never in solo', () => {
    const match = ffa();
    const a = match.addHuman('A', 'rivet');
    const b = match.addHuman('B', 'vega');
    match.start();
    for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
    a.protectedUntil = b.protectedUntil = 0;
    match.sim.drain();
    match.sim.damage(b, 999, { attacker: a.id, weapon: 'ar', kind: 'body', from: [0, 1, 0] });
    const [kill] = kills(match.sim.drain().events);
    expect(kill!.respawnAt).toBeCloseTo(match.time + PLAYER.respawnDelay, 6);
    while (!b.alive) match.tick(TICK);
    expect(match.time).toBeGreaterThanOrEqual(kill!.respawnAt!);
    expect(match.time - kill!.respawnAt!).toBeLessThan(TICK * 1.5);

    const solo = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, bots: 0, difficulty: 'normal' });
    const me = solo.addHuman('Me', 'rivet');
    solo.start();
    for (let t = 0; t < 4.2; t += TICK) solo.tick(TICK);
    me.protectedUntil = 0;
    solo.sim.drain();
    solo.sim.damage(me, 999, { attacker: me.id, weapon: 'grenade', kind: 'body', from: [0, 1, 0] });
    expect(kills(solo.sim.drain().events)[0]!.respawnAt).toBeNull();
  });
});

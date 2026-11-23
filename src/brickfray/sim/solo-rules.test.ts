import { describe, expect, it } from 'vitest';
import type { MapLayout, SpawnPoint, Waypoint } from '../world/types';
import { magSize } from './arms';
import { BotRoam, type RoamState } from './bot-roam';
import { CollisionWorld } from './collision';
import { PLAYER, REGEN, TICK } from './constants';
import { Match } from './match';
import { pickSpawn } from './spawns';
import { BUTTON, type GameEvent, type HostPlayer } from './types';
import { drawOffer, idleCards, noUpgrades, takeUpgrade } from './upgrades';

function flat(extra: MapLayout['colliders'] = [], waypoints: Waypoint[] = []): MapLayout {
  return {
    id: 'plaza',
    bounds: { min: [-60, -2, -60], max: [60, 12, 60] },
    colliders: [{ min: [-60, -1, -60], max: [60, 0, 60], surface: 'stone' }, ...extra],
    spawns: [{ position: [0, 0, 30], yaw: 0 }],
    waypoints,
    killY: -5
  };
}

function solo(difficulty: 'easy' | 'normal' | 'hard' = 'normal', layout = flat()) {
  const match = new Match(layout, { mode: 'solo', map: 'plaza', minutes: 0, seats: 0, difficulty }, 11);
  const me = match.addHuman('Me', 'vega');
  return { match, me };
}

const damageTo = (events: GameEvent[], id: number) => events.filter((e): e is Extract<GameEvent, { type: 'damage' }> => e.type === 'damage' && e.victim === id);

describe('bots hit humans for their share by every means', () => {
  it('a swing and a grenade are scaled like a bullet', () => {
    const { match, me } = solo();
    match.sim.spawn(me, { position: [0, 0, 0], yaw: 0 });
    me.protectedUntil = 0;
    const bot = match.sim.addPlayer('Snap', 'grunt', 'grunt');
    match.sim.spawn(bot, { position: [0, 0, -1.2], yaw: 0 });
    match.sim.botDamage = 0.4;
    // Facing the bot (yaw 0 looks down -z), so no backstab: the mallet's 55 at 0.4.
    me.yaw = 0;
    bot.yaw = Math.PI;
    let seq = 0;
    for (let i = 0; i < 20; i++) match.sim.applyCommand(bot.id, { seq: ++seq, forward: 0, right: 0, yaw: Math.PI, pitch: 0, buttons: i === 0 ? BUTTON.melee : 0, slot: 0, viewTime: match.time, life: bot.life });
    expect(damageTo(match.sim.drain().events, me.id).map((e) => e.amount)).toEqual([22]);
    // A grenade at the player's feet from a bot that is already gone: 100 at the centre, at 0.4.
    me.health = me.maxHealth;
    const thrower = match.sim.addPlayer('Snap', 'grunt', 'grunt');
    match.sim.spawn(thrower, { position: [0, 0, -12], yaw: 0 });
    for (let i = 0; i < 5; i++) match.sim.applyCommand(thrower.id, { seq: i + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: i < 3 ? BUTTON.grenade : 0, slot: 0, viewTime: match.time, life: thrower.life });
    const g = match.sim.grenades[0]!;
    Object.assign(g, { x: me.move.x, y: 0.1, z: me.move.z, vx: 0, vy: 0, vz: 0, resting: true });
    match.remove(thrower.id);
    for (let t = 0; t < 3.5; t += TICK) match.sim.tick(TICK);
    const blast = damageTo(match.sim.drain().events, me.id);
    expect(blast.length).toBe(1);
    expect(blast[0]!.amount).toBeLessThanOrEqual(40);
    expect(blast[0]!.amount).toBeGreaterThan(30);
  });
});

describe('spawn picker', () => {
  const spawns: SpawnPoint[] = [
    { position: [0, 0, 0], yaw: 0, team: 0 },
    { position: [-50, 0, 0], yaw: 0, team: 0 },
    { position: [50, 0, 50], yaw: 0 },
    { position: [50, 0, -50], yaw: 0, team: 1 }
  ];
  const layout = flat([{ min: [-46, 0, -6], max: [-44, 4, 6], surface: 'stone' }]);
  const world = new CollisionWorld(layout.colliders);
  const player = (id: number, team: 0 | 1 | -1, x: number, z: number) => ({ id, team, alive: true, move: { x, y: 0, z } }) as unknown as HostPlayer;

  it('a team player only takes its team’s spawns', () => {
    for (let i = 0; i < 20; i++) {
      const s = pickSpawn(world, spawns, player(1, 0, 0, 0), [player(2, 1, 50, -50)], [], 0, () => i / 20);
      expect(s.team).toBe(0);
    }
  });

  it('a clear line from an enemy 60 m away counts against a spawn', () => {
    // The enemy at (-40, 0, 55) sees the open spawn at (0, 0, 0) from 68 m; the one behind the wall is hidden.
    const s = pickSpawn(world, spawns.slice(0, 2), player(1, 0, 0, 0), [player(2, 1, 20, 66)], [], 0, () => 0);
    expect(s.position).toEqual([-50, 0, 0]);
  });
});

describe('hard half heal', () => {
  it('holds regeneration through the break, so the next wave starts at the half heal', () => {
    const { match, me } = solo('hard');
    match.start();
    me.protectedUntil = Infinity;
    for (let t = 0; t < 5; t += TICK) match.tick(TICK);
    me.health = 20;
    for (let t = 0; t < 60 && match.state.phase !== 'intermission'; t += TICK) {
      for (const p of match.sim.players.values()) if (p.bot && p.alive) match.sim.damage(p, 9999, { attacker: me.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
      if (match.state.phase === 'playing') me.health = 20;
      match.tick(TICK);
    }
    expect(match.state.phase).toBe('intermission');
    const healed = me.health;
    expect(healed).toBeCloseTo(70, 0);
    const offer = match.sim.drain().events.find((e) => e.type === 'upgradeOffer');
    if (offer?.type === 'upgradeOffer') match.pickUpgrade(me.id, offer.options.find((o) => o !== 'health' && o !== 'armor') ?? offer.options[0]!);
    while (match.state.phase === 'intermission') match.tick(TICK);
    expect(me.health).toBe(healed);
    for (let t = 0; t < REGEN.delay + 1; t += TICK) match.tick(TICK);
    expect(me.health).toBeGreaterThan(healed + 10);
  });
});

describe('Zipbots', () => {
  it('sprint in, wind up crouched, lunge into a swing, then back off', () => {
    const { match, me } = solo();
    match.sim.spawn(me, { position: [0, 0, 0], yaw: 0 });
    me.protectedUntil = Infinity;
    match.sim.damageEnabled = true;
    const bot = match.sim.addPlayer('Zip', 'rusher', 'rusher');
    match.bots.add(bot);
    match.sim.spawn(bot, { position: [0, 0, -25], yaw: 0 });
    let closest = Infinity;
    let crouched = false;
    let swungAt = -1;
    let backed = 0;
    for (let t = 0; t < 12; t += TICK) {
      match.bots.tick();
      match.sim.tick(TICK);
      const d = Math.hypot(bot.move.x, bot.move.z);
      closest = Math.min(closest, d);
      if (d < 6 && bot.move.crouch > 0.5) crouched = true;
      for (const e of match.sim.drain().events) if (e.type === 'melee' && e.player === bot.id && swungAt < 0) swungAt = t;
      if (swungAt >= 0 && t > swungAt + 0.8) backed = Math.max(backed, d);
    }
    expect(closest).toBeLessThan(2.2);
    expect(crouched).toBe(true);
    expect(swungAt).toBeGreaterThan(0);
    expect(backed).toBeGreaterThan(3);
  });
});

describe('upgrade cards for the character', () => {
  it('every magazine level adds a round, even to a one-round harpoon', () => {
    const { match } = solo();
    const coral = match.addHuman('Coral', 'coral');
    const sizes = [magSize(coral.arms, 'harpoon')];
    for (let i = 0; i < 3; i++) {
      takeUpgrade(coral, 'magazine');
      sizes.push(magSize(coral.arms, 'harpoon'));
    }
    expect(sizes).toEqual([1, 2, 3, 4]);
  });

  it('grenade cards wait for a first throw', () => {
    const { match, me } = solo();
    expect(idleCards(me)).toEqual(['grenades', 'grenadeRefill']);
    for (let w = 1; w < 40; w++) expect(drawOffer(noUpgrades(), 77, w, 3, idleCards(me)).some((id) => id === 'grenades' || id === 'grenadeRefill')).toBe(false);
    match.sim.spawn(me, { position: [0, 0, 0], yaw: 0 });
    let seq = 0;
    for (let i = 0; i < 6; i++) match.sim.applyCommand(me.id, { seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: i < 3 ? BUTTON.grenade : 0, slot: 0, viewTime: match.time, life: me.life });
    expect(idleCards(me)).toEqual([]);
  });

  it('slow kits hit snapbots harder in solo only', () => {
    const hit = (mode: 'solo' | 'ffa') => {
      const match = new Match(flat(), { mode, map: 'plaza', minutes: 10, seats: 0, difficulty: 'normal' }, 2);
      const coral = match.addHuman('Coral', 'coral');
      match.sim.spawn(coral, { position: [0, 0, 0], yaw: 0 });
      const bot = match.sim.addPlayer('Snap', 'grunt', 'grunt');
      match.sim.spawn(bot, { position: [0, 0, -10], yaw: 0 });
      bot.protectedUntil = 0;
      match.sim.damageEnabled = true;
      const pitch = Math.atan2(PLAYER.eye - 0.35 - 1.1 - PLAYER.eye + 1.1, 10);
      match.sim.applyCommand(coral.id, { seq: 1, forward: 0, right: 0, yaw: 0, pitch, buttons: BUTTON.fire, slot: 0, viewTime: match.time, life: coral.life });
      return damageTo(match.sim.drain().events, bot.id)[0]?.amount ?? 0;
    };
    expect(hit('ffa')).toBe(80);
    expect(hit('solo')).toBe(104);
  });
});

describe('bots reach a player anywhere', () => {
  it('a player on a block no waypoint reaches draws bots to a spot with a clear shot at it', () => {
    // A 6 m block; waypoints round its foot (no line up to its top) and one 14 m off with a view of the top.
    const block = { min: [-3, 0, -3], max: [3, 6, 3], surface: 'stone' } as MapLayout['colliders'][number];
    const wps: Waypoint[] = [
      { position: [4, 0, 0], links: [1] },
      { position: [0, 0, 4], links: [0, 2] },
      { position: [-4, 0, 0], links: [1, 3] },
      { position: [-18, 0, 0], links: [2] }
    ];
    const layout = flat([block], wps);
    const { match } = solo('normal', layout);
    const on = [0, 6, 0] as [number, number, number];
    const bot = match.sim.addPlayer('Snap', 'grunt', 'grunt');
    match.sim.spawn(bot, { position: [5, 0, 1], yaw: 0 });
    const roam = new BotRoam(match.sim, () => 0.5);
    const state: RoamState = { path: [], lastSeen: null, patrol: null, patrolUntil: 0, approach: null, post: null, postRest: 0 };
    expect(roam.approach(bot, state, on, 34)).toEqual([-18, 0, 0]);
    // On the graph, the bot goes for the player itself.
    expect(roam.approach(bot, { ...state, approach: null }, [-4, 0, 0.5], 34)).toEqual([-4, 0, 0.5]);
  });
});

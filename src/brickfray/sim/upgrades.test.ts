import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { magSize } from './arms';
import { REGEN, TICK } from './constants';
import { Match, PICK_TIME } from './match';
import { createMoveState, stepMove } from './movement';
import { BUTTON, type Command, type GameEvent, type HostPlayer } from './types';
import { drawOffer, maxLevel, noUpgrades, takeUpgrade, UPGRADE_IDS, UPGRADES, type UpgradeId } from './upgrades';

function arena(): MapLayout {
  const spawns = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { position: [Math.cos(a) * 14, 0, Math.sin(a) * 14] as [number, number, number], yaw: 0, team: (i % 2) as 0 | 1 };
  });
  return {
    id: 'plaza',
    bounds: { min: [-30, -2, -30], max: [30, 10, 30] },
    colliders: [{ min: [-30, -1, -30], max: [30, 0, 30], surface: 'plastic' }],
    spawns,
    waypoints: [],
    killY: -5
  };
}

function ffa() {
  const match = new Match(arena(), { mode: 'ffa', map: 'plaza', minutes: 10, bots: 0, difficulty: 'normal' }, 7);
  const a = match.addHuman('A', 'vega');
  const b = match.addHuman('B', 'rivet');
  match.start();
  for (let t = 0; t < 4.2; t += TICK) match.tick(TICK);
  match.sim.spawn(a, { position: [0, 0, 10], yaw: 0 });
  match.sim.spawn(b, { position: [0, 0, 4], yaw: 0 });
  a.protectedUntil = b.protectedUntil = 0;
  return { match, a, b };
}

const cmd = (seq: number, p: HostPlayer, buttons = 0, forward = 0): Command => ({ seq, forward, right: 0, yaw: 0, pitch: 0, buttons, slot: 0, viewTime: 0, life: p.life });

describe('upgrade cards', () => {
  it('deals three different cards, the same for the same seed and wave', () => {
    const levels = noUpgrades();
    for (let wave = 1; wave < 40; wave++) {
      const cards = drawOffer(levels, 1234, wave);
      expect(new Set(cards).size).toBe(3);
      expect(drawOffer(levels, 1234, wave)).toEqual(cards);
    }
    const waves = Array.from({ length: 12 }, (_, i) => drawOffer(levels, 1234, i + 1).join());
    expect(new Set(waves).size).toBeGreaterThan(6);
  });

  it('never deals an upgrade at its cap, and deals fewer cards when fewer are left', () => {
    const levels = noUpgrades();
    for (const id of UPGRADE_IDS) if (id !== 'speed' && id !== 'armor') levels[id] = maxLevel(id);
    for (let wave = 1; wave < 20; wave++) expect(drawOffer(levels, 99, wave).sort()).toEqual(['armor', 'speed']);
    levels.speed = maxLevel('speed');
    levels.armor = maxLevel('armor');
    expect(drawOffer(levels, 99, 1)).toEqual([]);
  });

  it('deals the rare, strong upgrades less often', () => {
    const counts = new Map<UpgradeId, number>();
    for (let wave = 0; wave < 3000; wave++) for (const id of drawOffer(noUpgrades(), 5, wave)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const rare = UPGRADE_IDS.filter((id) => UPGRADES[id].rare);
    const common = UPGRADE_IDS.filter((id) => !UPGRADES[id].rare);
    for (const r of rare) for (const c of common) expect(counts.get(r)!).toBeLessThan(counts.get(c)!);
  });

  it('every level steps up by less than the one before and stops at the cap', () => {
    for (const id of UPGRADE_IDS) {
      const steps = UPGRADES[id].steps;
      for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]!);
    }
    const p = ffa().a;
    for (let i = 0; i < 9; i++) takeUpgrade(p, 'health');
    expect(p.upgrades.health).toBe(maxLevel('health'));
    expect(p.maxHealth).toBe(230);
  });
});

describe('upgrade effects are real in the sim', () => {
  it('max health raises the cap and heals by the same amount', () => {
    const { a } = ffa();
    a.health = 60;
    takeUpgrade(a, 'health');
    expect([a.maxHealth, a.health]).toEqual([140, 100]);
  });

  it('magazines grow for every gun, and a reload fills the bigger magazine', () => {
    const { match, a } = ffa();
    takeUpgrade(a, 'magazine');
    expect([magSize(a.arms, 'ar'), magSize(a.arms, 'pistol'), magSize(a.arms, 'sniper'), magSize(a.arms, 'harpoon')]).toEqual([42, 17, 7, 2]);
    expect(a.arms.ammo.ar).toBe(42);
    a.arms.ammo.ar = 3;
    let seq = 0;
    match.sim.applyCommand(a.id, cmd(++seq, a, BUTTON.reload));
    for (let i = 0; i < 200; i++) match.sim.applyCommand(a.id, cmd(++seq, a));
    expect(a.arms.ammo.ar).toBe(42);
  });

  it('reloads run shorter by the upgrade share', () => {
    const { match, a } = ffa();
    const time = () => {
      a.arms.ammo.ar = 3;
      let seq = a.lastSeq;
      match.sim.applyCommand(a.id, cmd(++seq, a, BUTTON.reload));
      let ticks = 1;
      while (a.arms.reload > 0) {
        match.sim.applyCommand(a.id, cmd(++seq, a));
        ticks++;
      }
      return ticks * TICK;
    };
    const before = time();
    takeUpgrade(a, 'reload');
    takeUpgrade(a, 'reload');
    expect(time() / before).toBeCloseTo(0.65, 1);
  });

  it('move speed upgrades raise the top speed', () => {
    const { match, a } = ffa();
    const top = () => {
      const s = createMoveState(0, 0, 0);
      s.grounded = true;
      s.pace = a.move.pace;
      for (let i = 0; i < 120; i++) stepMove(match.sim.world, s, { forward: 1, right: 0, yaw: 0, jump: false, crouch: false, sprint: false, ads: false }, TICK);
      return Math.hypot(s.vx, s.vz);
    };
    const before = top();
    takeUpgrade(a, 'speed');
    expect(top() / before).toBeCloseTo(1 + UPGRADES.speed.steps[0]!, 2);
  });

  it('damage upgrades scale every hit; armour soaks damage before health', () => {
    const { match, a, b } = ffa();
    takeUpgrade(a, 'damage');
    match.sim.drain();
    // Vega's AR: 40 to the head, +20%.
    match.sim.applyCommand(a.id, { ...cmd(a.lastSeq + 1, a, BUTTON.fire), pitch: Math.atan2(0, 6), viewTime: match.time });
    expect(match.sim.drain().events.find((e) => e.type === 'damage')).toMatchObject({ victim: b.id, amount: 48 });
    takeUpgrade(b, 'armor');
    expect([b.armor, b.health]).toEqual([80, 100]);
    match.sim.damage(b, 70, { attacker: a.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
    expect(b.armor).toBe(0);
    expect(b.health).toBeCloseTo(100 - (70 * 1.2 - 80), 6);
  });

  it('regeneration starts sooner and runs faster', () => {
    const regained = (levels: number) => {
      const { match, a, b } = ffa();
      for (let i = 0; i < levels; i++) takeUpgrade(a, 'regen');
      match.sim.damage(a, 50, { attacker: b.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
      for (let t = 0; t < REGEN.delay - 0.5; t += TICK) match.tick(TICK);
      return a.health - 50;
    };
    expect(regained(0)).toBe(0);
    expect(regained(1)).toBeGreaterThan(20);
  });

  it('grenade upgrades add slots, shorten the refill and survive a respawn', () => {
    const { match, a } = ffa();
    takeUpgrade(a, 'grenades');
    takeUpgrade(a, 'grenadeRefill');
    expect([a.arms.grenades, a.arms.grenadeMax, a.arms.grenadeRefill]).toEqual([3, 3, 7]);
    match.sim.spawn(a, { position: [5, 0, 5], yaw: 0 });
    expect([a.arms.grenades, a.arms.grenadeMax, a.arms.grenadeRefill, a.arms.magScale]).toEqual([3, 3, 7, 1]);
  });
});

describe('solo waves with upgrade picks', () => {
  function solo() {
    const match = new Match(arena(), { mode: 'solo', map: 'plaza', minutes: 0, bots: 0, difficulty: 'normal' }, 11);
    const me = match.addHuman('Me', 'vega');
    match.start();
    me.protectedUntil = Infinity;
    const events: GameEvent[] = [];
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += TICK) {
        match.tick(TICK);
        events.push(...match.sim.drain().events);
      }
    };
    const clear = () => {
      for (let t = 0; t < 90 && match.state.phase !== 'intermission'; t += TICK) {
        for (const p of match.sim.players.values()) if (p.bot && p.alive) match.sim.damage(p, 9999, { attacker: me.id, weapon: 'ar', kind: 'body', from: [0, 0, 0] });
        run(TICK);
      }
    };
    run(6);
    return { match, me, events, run, clear };
  }

  it('a cleared wave refills ammo, grenades and health, then waits for the pick', () => {
    const { match, me, events, run, clear } = solo();
    me.arms.ammo.ar = 2;
    me.arms.ammo.pistol = 1;
    me.arms.grenades = 0;
    me.health = 40;
    clear();
    expect(match.state.phase).toBe('intermission');
    expect([me.arms.ammo.ar, me.arms.ammo.pistol, me.arms.grenades, me.health]).toEqual([30, 12, 2, 100]);
    const offer = events.find((e) => e.type === 'upgradeOffer');
    expect(offer).toMatchObject({ player: me.id, wave: 1 });
    run(PICK_TIME - 1);
    expect(match.state).toMatchObject({ phase: 'intermission', wave: 1 });
  });

  it('takes only a dealt card, once; the next wave follows the pick', () => {
    const { match, me, events, run, clear } = solo();
    clear();
    const offer = events.find((e) => e.type === 'upgradeOffer') as Extract<GameEvent, { type: 'upgradeOffer' }>;
    const missing = UPGRADE_IDS.find((id) => !offer.options.includes(id))!;
    expect(match.pickUpgrade(me.id, missing)).toBe(false);
    expect(match.pickUpgrade(me.id, offer.options[2]!)).toBe(true);
    expect(match.pickUpgrade(me.id, offer.options[1]!)).toBe(false);
    expect(me.upgrades[offer.options[2]!]).toBe(1);
    expect(match.sim.events.at(-1)).toMatchObject({ type: 'upgrade', id: offer.options[2], level: 1, auto: false });
    run(4.9);
    expect(match.state.phase).toBe('intermission');
    run(0.2);
    expect(match.state).toMatchObject({ phase: 'playing', wave: 2 });
  });

  it('an idle player gets the first card after the timer, then the next wave', () => {
    const { match, me, events, run, clear } = solo();
    clear();
    const offer = events.find((e) => e.type === 'upgradeOffer') as Extract<GameEvent, { type: 'upgradeOffer' }>;
    run(PICK_TIME + 0.1);
    expect(events.find((e) => e.type === 'upgrade')).toMatchObject({ id: offer.options[0], auto: true });
    expect(me.upgrades[offer.options[0]!]).toBe(1);
    run(5.1);
    expect(match.state).toMatchObject({ phase: 'playing', wave: 2 });
  });

  it('the same seed deals the same cards wave after wave', () => {
    const deal = () => {
      const { match, me, events, clear } = solo();
      const dealt: string[] = [];
      for (let wave = 1; wave <= 3; wave++) {
        clear();
        const offer = events.filter((e) => e.type === 'upgradeOffer').at(-1) as Extract<GameEvent, { type: 'upgradeOffer' }>;
        dealt.push(offer.options.join());
        match.pickUpgrade(me.id, offer.options[0]!);
        for (let t = 0; t < 6; t += TICK) match.tick(TICK);
      }
      return dealt;
    };
    expect(deal()).toEqual(deal());
  });
});

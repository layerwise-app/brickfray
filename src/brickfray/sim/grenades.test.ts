import { describe, expect, it } from 'vitest';
import type { MapLayout } from '../world/types';
import { aimDirection } from './arms';
import { CollisionWorld } from './collision';
import { PLAYER, TICK } from './constants';
import { stepGrenade, throwGrenade, throwPitchFor } from './grenades';
import { Match } from './match';

const ground = new CollisionWorld([{ min: [-200, -1, -200], max: [200, 0, 200], surface: 'stone' }]);
const deg = (d: number) => (d * Math.PI) / 180;

/** Where a throw from standing first comes down on flat ground, and where it bursts. */
function flight(pitch: number, low = false, run: [number, number, number] = [0, 0, 0]) {
  const g = throwGrenade(1, 1, [0, PLAYER.eye, 0], aimDirection(0, pitch), run, 0, low);
  let carry = -1;
  for (let t = 0; t < 5; t += TICK) {
    const falling = g.vy < 0;
    if (stepGrenade(ground, g, TICK)) break;
    if (carry < 0 && ((falling && g.vy >= 0) || g.resting)) carry = Math.hypot(g.x, g.z);
  }
  return { carry, burst: Math.hypot(g.x, g.z) };
}

describe('grenade throw', () => {
  it('goes farther the higher the aim up to about 45°, then comes down nearer, with a hard limit', () => {
    const carries = [0, 15, 30, 45, 60].map((d) => flight(deg(d)).carry);
    expect(carries[0]).toBeGreaterThan(12);
    expect(carries[0]).toBeLessThan(14);
    expect(carries[1]).toBeGreaterThan(carries[0]!);
    expect(carries[2]).toBeGreaterThan(carries[1]!);
    expect(carries[3]).toBeGreaterThan(carries[2]!);
    expect(carries[4]).toBeLessThan(carries[3]!);
    let longest = 0;
    for (let d = 0; d <= 89; d++) longest = Math.max(longest, flight(deg(d)).burst);
    expect(longest).toBeGreaterThan(28);
    expect(longest).toBeLessThan(33);
    // A sprint adds a little, not a new range.
    expect(flight(deg(45), false, [0, 0, -7.2]).carry - carries[3]!).toBeLessThan(4);
  });

  it('the underhand lob stays short at any aim', () => {
    for (const d of [-20, 0, 30, 60]) expect(flight(deg(d), true).burst).toBeLessThan(7);
  });

  it('a landing bites: it bursts within a few metres of where it came down', () => {
    for (const d of [0, 20, 45]) {
      const { carry, burst } = flight(deg(d));
      expect(burst - carry).toBeLessThan(5);
    }
  });

  it('the pitch a bot asks for lands its throw where it wants, up to the longest throw', () => {
    for (const want of [6, 10, 15, 20, 25]) {
      const pitch = throwPitchFor(want, -PLAYER.eye)!;
      expect(Math.abs(flight(pitch).carry - want)).toBeLessThan(0.6);
    }
    expect(throwPitchFor(40, -PLAYER.eye)).toBeNull();
  });
});

function flat(): MapLayout {
  return { id: 'plaza', bounds: { min: [-60, -2, -60], max: [60, 10, 60] }, colliders: [{ min: [-60, -1, -60], max: [60, 0, 60], surface: 'stone' }], spawns: [{ position: [0, 0, 0], yaw: 0 }], waypoints: [], killY: -5 };
}

describe('bot grenades', () => {
  it('land near a target 10–18 m off and are never thrown from 20 m or more', () => {
    const misses: number[] = [];
    for (const d of [10, 14, 18, 24]) {
      const match = new Match(flat(), { mode: 'solo', map: 'plaza', minutes: 0, bots: 0, difficulty: 'normal' }, 5);
      const me = match.addHuman('Me', 'vega');
      match.sim.spawn(me, { position: [0, 0, 0], yaw: 0 });
      match.sim.damageEnabled = false;
      const bot = match.sim.addPlayer('Snap', 'grunt', 'grunt');
      match.bots.add(bot);
      match.bots.skill = 0.6;
      match.sim.spawn(bot, { position: [0, 0, -d], yaw: Math.PI });
      const brain = (match.bots as unknown as { brains: Map<number, { grenadeCooldown: number }> }).brains.get(bot.id)!;
      let burst: number | null = null;
      for (let i = 0; i < 60 * 12 && burst === null; i++) {
        bot.move.x = 0;
        bot.move.z = -d;
        brain.grenadeCooldown = Math.min(brain.grenadeCooldown, 0);
        match.bots.tick();
        match.sim.tick(TICK);
        for (const e of match.sim.drain().events) if (e.type === 'explosion') burst = Math.hypot(e.position[0], e.position[2]);
      }
      if (d >= 20) expect(burst).toBeNull();
      else misses.push(burst!);
    }
    for (const m of misses) expect(m).toBeLessThan(4);
  });
});

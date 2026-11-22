import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { achievement, ACHIEVEMENTS, CATEGORIES, progressOf, STAT_KEYS, statsOf, TIER_COUNT, tiersReached } from './catalogue';

describe('catalogue', () => {
  it('has unique ids, known stats and goals that only rise', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(CATEGORIES).toContain(a.category);
      for (const stat of statsOf(a)) expect(STAT_KEYS, a.id).toContain(stat);
      expect(a.tiers.length, a.id).toBeGreaterThan(0);
      a.tiers.forEach((goal, i) => {
        expect(Number.isInteger(goal) && goal > 0, a.id).toBe(true);
        if (i) expect(goal, a.id).toBeGreaterThan(a.tiers[i - 1]!);
      });
    }
    expect(TIER_COUNT).toBe(ACHIEVEMENTS.reduce((n, a) => n + a.tiers.length, 0));
  });

  it('holds what the owner asked for', () => {
    const big = [10, 50, 100, 500, 1000, 5000, 10000];
    expect(achievement('kills').tiers).toEqual(big);
    expect(achievement('assists').tiers).toEqual(big);
    expect(achievement('headshots').tiers).toEqual(big);
    for (const id of ['sidearm', 'melee', 'double', 'triple', 'quad', 'penta', 'hexa'] as const) expect(achievement(id).tiers[0]).toBeLessThanOrEqual(10);
    expect(['double', 'triple', 'quad', 'penta', 'hexa'].map((id) => achievement(id as 'double').source)).toEqual(
      [2, 3, 4, 5, 6].map((n) => ({ stat: `chain${n}` }))
    );
    for (const id of ['double', 'triple', 'quad', 'penta', 'hexa'] as const) expect(achievement(id).tiers[0]).toBe(1);
  });

  it('reads progress from the totals', () => {
    const kills = achievement('kills');
    expect(tiersReached(kills, 0)).toBe(0);
    expect(tiersReached(kills, 9)).toBe(0);
    expect(tiersReached(kills, 10)).toBe(1);
    expect(tiersReached(kills, 4999)).toBe(5);
    expect(tiersReached(kills, 1e9)).toBe(7);
    expect(progressOf(kills, { kills: 42 })).toBe(42);
    expect(progressOf(kills, {})).toBe(0);
    const roster = achievement('roster');
    expect(progressOf(roster, { 'play.rivet': 3, 'play.moss': 1, 'win.nova': 1 })).toBe(2);
    expect(roster.tiers).toEqual([CHARACTER_IDS.length]);
    expect(progressOf(achievement('waveHard'), { 'best.wave.hard': 12, 'best.wave.easy': 30 })).toBe(12);
  });
});

import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../characters/roster';
import { PLAYER } from '../sim/constants';
import { MELEES, SIDEARMS } from './defs';
import { LOADOUTS } from './loadouts';
import { timeToKill } from './ttk';

const RANGES = [3, 8, 15, 25, 40, 60];
const best = (id: (typeof CHARACTER_IDS)[number], d: number) => Math.min(timeToKill(LOADOUTS[id].primary, d), timeToKill(LOADOUTS[id].secondary, d));

describe('character loadouts', () => {
  it('each character carries a primary, a sidearm and a melee weapon of their own', () => {
    const combos = new Set<string>();
    for (const id of CHARACTER_IDS) {
      const l = LOADOUTS[id];
      expect(SIDEARMS.has(l.primary)).toBe(false);
      expect(SIDEARMS.has(l.secondary)).toBe(true);
      combos.add(`${l.primary}/${l.secondary}/${l.melee}`);
    }
    expect(combos.size).toBe(CHARACTER_IDS.length);
    expect(new Set(CHARACTER_IDS.map((id) => LOADOUTS[id].primary)).size).toBe(CHARACTER_IDS.length);
    expect(new Set(CHARACTER_IDS.map((id) => LOADOUTS[id].melee)).size).toBe(CHARACTER_IDS.length);
  });

  it('no character out-guns the rest across ranges', () => {
    for (const id of CHARACTER_IDS) {
      let sum = 0;
      for (const d of RANGES) {
        const all = CHARACTER_IDS.map((c) => best(c, d)).sort((a, b) => a - b);
        const median = (all[2]! + all[3]!) / 2;
        sum += Math.log(best(id, d) / median);
      }
      expect(Math.abs(sum / RANGES.length), id).toBeLessThan(0.12);
    }
  });

  it('every character has a range where they are (nearly) the quickest to kill', () => {
    for (const id of CHARACTER_IDS) {
      const niche = RANGES.some((d) => best(id, d) <= 1.1 * Math.min(...CHARACTER_IDS.map((c) => best(c, d))));
      expect(niche, id).toBe(true);
    }
  });

  it('every melee weapon kills in two hits, or one from behind', () => {
    for (const m of Object.values(MELEES)) {
      expect(m.damage * 2).toBeGreaterThanOrEqual(PLAYER.health);
      expect(m.damage).toBeLessThan(PLAYER.health);
      expect(m.backstab).toBeGreaterThanOrEqual(PLAYER.health);
    }
  });
});

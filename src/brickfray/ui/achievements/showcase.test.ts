import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS } from '../../../lib/achievements/catalogue';
import type { Unlock } from '../../../lib/achievements/contract';
import { newTiers, SHOWCASE } from './showcase';

const u = (id: Unlock['id'], tier = 1): Unlock => ({ id, tier, at: 0 });

describe('unlocks shown at once', () => {
  it('ranks every achievement', () => {
    expect([...SHOWCASE].sort()).toEqual([...ACHIEVEMENT_IDS].sort());
  });

  it('leads with the rarest, one tier per achievement, the longest chain standing for the shorter ones', () => {
    const got = newTiers([u('kills', 1), u('kills', 2), u('double'), u('triple'), u('penta'), u('matches'), u('flawless'), u('grenade')], 3);
    expect(got.lead.map((x) => `${x.id}:${x.tier}`)).toEqual(['penta:1', 'flawless:1', 'grenade:1']);
    expect(got.rest).toBe(4);
    expect(newTiers([u('kills', 1), u('kills', 3), u('kills', 2)]).lead).toEqual([u('kills', 3)]);
    expect(newTiers([])).toEqual({ lead: [], rest: 0 });
  });

  it('leaves out an unlock of the retired six-kill achievement', () => {
    const hexa = { id: 'hexa', tier: 2, at: 0 } as unknown as Unlock;
    expect(newTiers([hexa, u('quad'), u('kills')], 4)).toEqual({ lead: [u('quad'), u('kills')], rest: 0 });
    expect(newTiers([hexa])).toEqual({ lead: [], rest: 0 });
  });
});

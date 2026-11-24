import { describe, expect, it } from 'vitest';
import { BoardError } from '../board/contract';
import { report, soloReport } from '../board/test-db';
import { parseReport, parseUpload } from '../board/validate';
import { countChain, countKill, fitFeats, megabotsThrough, noFeats, parseFeats, type MatchFeats, type SeenKill } from './feats';

const NOW = 1_800_000_100_000;

function feats(over: Partial<MatchFeats> = {}): MatchFeats {
  return { ...noFeats(), ...over };
}

function refusal(raw: unknown, r = report()) {
  try {
    parseFeats(raw, r);
  } catch (error) {
    return error instanceof BoardError ? error.message : `other: ${String(error)}`;
  }
  return null;
}

describe('feats a report carries', () => {
  it('takes counts that fit the report, rebuilt from known fields only', () => {
    const r = report({ kills: 10, character: 'moss' });
    const sent = { sidearm: 3, melee: 2, grenade: 1, longshot: 4, airborne: 2, bounty: 1, megabot: 0, chains: [3, 1, 0, 0, 0], extra: 99 };
    expect(parseFeats(sent, r)).toEqual(feats({ sidearm: 3, melee: 2, grenade: 1, longshot: 4, airborne: 2, bounty: 1, chains: [3, 1, 0, 0, 0] }));
    expect(parseFeats(null, r)).toBeNull();
    expect(parseFeats(undefined, r)).toBeNull();
  });

  it('still takes a report an older build queued with chains of six, and drops that count', () => {
    const r = report({ kills: 12 });
    expect(parseFeats(feats({ chains: [2, 2, 1, 1, 1] }), r)?.chains).toEqual([2, 2, 1, 1, 0]);
    expect(parseReport({ ...r, feats: feats({ chains: [1, 1, 1, 1, 1] }) }, NOW).feats?.chains).toEqual([1, 1, 1, 1, 0]);
  });

  it('refuses forged counters', () => {
    const r = report({ kills: 10, character: 'rivet' });
    const ok = feats();
    expect(refusal(ok, r)).toBeNull();
    // Each count is a whole number from 0 to the kills.
    expect(refusal({ ...ok, sidearm: 11 }, r)).toBe('feats: sidearm out of range');
    expect(refusal({ ...ok, melee: -1 }, r)).toBe('feats: melee out of range');
    expect(refusal({ ...ok, grenade: 1.5 }, r)).toBe('feats: grenade out of range');
    expect(refusal({ ...ok, airborne: '3' }, r)).toBe('feats: airborne out of range');
    // A kill has one weapon.
    expect(refusal({ ...ok, sidearm: 5, melee: 4, grenade: 2 }, r)).toBe('feats: weapon kinds over kills');
    expect(refusal({ ...ok, airborne: 9, grenade: 2 }, r)).toBe('feats: airborne over gun kills');
    // Rivet carries no long gun; Moss does.
    expect(refusal({ ...ok, longshot: 1 }, r)).toBe('feats: longshot out of range');
    expect(refusal({ ...ok, longshot: 8, melee: 2, grenade: 1 }, { ...r, character: 'moss' })).toBe('feats: long shots over gun kills');
    // Bounties are a room rule; Megabots come only in the waves a run reached.
    const run = soloReport({ kills: 10, wave: 5 });
    expect(refusal({ ...ok, bounty: 1 }, run)).toBe('feats: bounty out of range');
    expect(refusal({ ...ok, megabot: 1 }, r)).toBe('feats: megabot out of range');
    const bosses = megabotsThrough('normal', 5);
    expect(bosses).toBeGreaterThan(0);
    expect(refusal({ ...ok, megabot: bosses }, run)).toBeNull();
    expect(refusal({ ...ok, megabot: bosses + 1 }, run)).toBe('feats: megabot out of range');
    expect(refusal({ ...ok, megabot: 1 }, soloReport({ kills: 10, wave: 1 }))).toBe('feats: megabot out of range');
    // Chains: five counts, never more long chains than short ones, never more chained kills than kills.
    expect(refusal({ ...ok, chains: [1, 1, 1, 1] }, r)).toBe('feats: chains');
    expect(refusal({ ...ok, chains: 'many' }, r)).toBe('feats: chains');
    expect(refusal({ ...ok, chains: [0, 1, 0, 0, 0] }, r)).toBe('feats: longer chains than shorter ones');
    expect(refusal({ ...ok, chains: [5, 0, 0, 0, 0] }, r)).toBeNull();
    expect(refusal({ ...ok, chains: [5, 1, 0, 0, 0] }, r)).toBe('feats: chains over kills');
    expect(refusal({ ...ok, chains: [2, 2, 2, 2, 2] }, r)).toBe('feats: chains over kills');
    expect(refusal({ ...ok, chains: [1, 1, 1, 1, 1] }, r)).toBeNull();
    expect(refusal([], r)).toBe('feats: not an object');
    expect(refusal('x', r)).toBe('feats: not an object');
  });

  it('sinks the whole report: a forged counter keeps the match off the board as well', () => {
    const good = { ...report({ kills: 10 }), feats: feats({ sidearm: 2 }) };
    const forged = { ...report({ kills: 10 }), feats: feats({ sidearm: 500 }) };
    const sixes = { ...report({ kills: 10 }), feats: feats({ chains: [9, 9, 9, 9, 9] }) };
    expect(parseReport(good, NOW).feats).toEqual(good.feats);
    expect(() => parseReport(forged, NOW)).toThrow('feats: sidearm out of range');
    const upload = parseUpload({ playerId: 'p'.repeat(22), name: 'Ace', matches: [good, forged, sixes] }, NOW);
    expect(upload.matches.map((m) => m.key)).toEqual([good.key]);
    expect(upload.refused).toEqual([forged.key, sixes.key]);
  });
});

describe('counting in the browser', () => {
  const kill = (over: Partial<SeenKill> = {}): SeenKill => ({ weapon: 'ar', sidearm: 'pistol', airborne: false, distance: 10, bounty: 0, megabot: false, ...over });

  it('sorts each kill', () => {
    let f = noFeats();
    f = countKill(f, kill({ weapon: 'pistol' }));
    f = countKill(f, kill({ weapon: 'mallet', airborne: true }));
    f = countKill(f, kill({ weapon: 'grenade', airborne: true }));
    f = countKill(f, kill({ weapon: 'sniper', distance: 40 }));
    f = countKill(f, kill({ weapon: 'sniper', distance: 39.9 }));
    f = countKill(f, kill({ weapon: 'harpoon', distance: null }));
    f = countKill(f, kill({ weapon: 'ar', distance: 80, bounty: 75 }));
    f = countKill(f, kill({ megabot: true }));
    expect(f).toEqual(feats({ sidearm: 1, melee: 1, grenade: 1, longshot: 1, airborne: 1, bounty: 1, megabot: 1 }));
  });

  it('counts each chain once at every length it reaches, six and more as five', () => {
    let f = noFeats();
    for (const n of [2, 3, 4, 2, 2, 3, 4, 5, 6, 7, 8, 1]) f = countChain(f, n);
    expect(f.chains).toEqual([3, 2, 2, 1, 0]);
  });

  it('trims what it sends to what the server takes', () => {
    // Counts made from events can run ahead of the scoreboard's kills (a kill on the last frame): never a refusal.
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % (n + 1));
    for (let i = 0; i < 2000; i++) {
      const solo = i % 3 === 0;
      const r = solo ? soloReport({ kills: rand(30), wave: 1 + rand(14), character: 'moss' }) : report({ kills: rand(30), character: i % 2 ? 'moss' : 'rivet' });
      const raw: MatchFeats = {
        sidearm: rand(20),
        melee: rand(20),
        grenade: rand(20),
        longshot: rand(20),
        airborne: rand(20),
        bounty: rand(20),
        megabot: rand(5),
        chains: [rand(12), rand(8), rand(6), rand(4), rand(3)].sort((a, b) => b - a) as MatchFeats['chains']
      };
      const fit = fitFeats(raw, r);
      expect(() => parseFeats(fit, r), JSON.stringify({ raw, kills: r.kills })).not.toThrow();
      expect(fit.sidearm + fit.melee + fit.grenade).toBeLessThanOrEqual(r.kills);
    }
    expect(fitFeats(feats({ chains: [4, 2, 1, 0, 0] }), report({ kills: 10 })).chains).toEqual([4, 2, 0, 0, 0]);
  });
});

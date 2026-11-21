import { describe, expect, it } from 'vitest';
import { BoardError } from './contract';
import { report, soloReport } from './test-db';
import { cleanName, parseLeaderboardQuery, parseReport, parseUpload, periodStart } from './validate';

const NOW = 1_800_000_100_000;

function refused(raw: unknown) {
  try {
    parseReport(raw, NOW);
  } catch (error) {
    return error instanceof BoardError ? error.message : `other: ${String(error)}`;
  }
  return null;
}

describe('match reports', () => {
  it('accepts what the game produces', () => {
    expect(parseReport(report(), NOW).score).toBe(1200);
    expect(parseReport(soloReport({ wave: 12, durationS: 900, kills: 120, score: 14000 }), NOW).wave).toBe(12);
  });

  it('refuses malformed fields', () => {
    expect(refused(null)).toBe('not an object');
    expect(refused({ ...report(), key: 'x' })).toBe('bad key');
    expect(refused({ ...report(), mode: 'ctf' })).toBe('mode unknown');
    expect(refused({ ...report(), map: '../etc' })).toBe('bad map');
    expect(refused({ ...report(), character: 'brickman' })).toBe('character unknown');
    expect(refused({ ...report(), kills: -1 })).toBe('kills out of range');
    expect(refused({ ...report(), kills: 2.5 })).toBe('kills out of range');
    expect(refused({ ...report(), score: '1200' })).toBe('score out of range');
    expect(refused({ ...report(), result: null })).toBe('result unknown');
    expect(refused({ ...soloReport(), difficulty: 'insane' })).toBe('difficulty unknown');
  });

  it('refuses what no match can produce', () => {
    expect(refused(report({ durationS: 2 }))).toBe('too short');
    expect(refused(report({ durationS: 3 * 3600 }))).toBe('durationS out of range');
    expect(refused(report({ headshots: 11 }))).toBe('headshots over kills');
    expect(refused(report({ kills: 500, score: 50000, durationS: 120 }))).toBe('too many kills');
    expect(refused(report({ deaths: 80, durationS: 120 }))).toBe('too many deaths');
    expect(refused(report({ score: 999999 }))).toBe('score over its kills');
    expect(refused(report({ placement: 7, players: 6 }))).toBe('bad placement');
    expect(refused(report({ players: 11 }))).toBe('players out of range');
    expect(refused(report({ wave: 3 }))).toBe('wave outside solo');
    expect(refused(soloReport({ deaths: 2 }))).toBe('bad solo run');
    expect(refused(soloReport({ wave: 0 }))).toBe('bad solo run');
    expect(refused(soloReport({ wave: 40, durationS: 60 }))).toBe('waves too fast');
    expect(refused(report({ endedAt: NOW - 90 * 86_400_000 }))).toBe('bad time');
  });

  it('pulls a time from the future back to now', () => {
    expect(parseReport(report({ endedAt: NOW + 3_600_000 }), NOW).endedAt).toBe(NOW);
  });

  it('splits an upload into usable reports and keys never to retry', () => {
    const good = report();
    const bad = report({ kills: -3 });
    const upload = parseUpload({ playerId: 'p'.repeat(22), name: ' Ace ', matches: [good, bad, { junk: true }] }, NOW);
    expect(upload.matches.map((m) => m.key)).toEqual([good.key]);
    expect(upload.refused).toEqual([bad.key]);
    expect(upload.name).toBe('Ace');
    expect(() => parseUpload({ playerId: 'short', name: '', matches: [] }, NOW)).toThrow('bad player id');
    expect(() => parseUpload({ playerId: 'p'.repeat(22), name: '', matches: Array(21).fill(good) }, NOW)).toThrow('bad batch');
  });
});

describe('names', () => {
  it('keeps one clean line of at most 16 characters', () => {
    expect(cleanName('  Brick   Layer ')).toBe('Brick Layer');
    expect(cleanName('a\u202ebc\u200bd\n')).toBe('abcd');
    expect(cleanName('ＷＩＤＥ')).toBe('WIDE');
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(16));
    expect(cleanName('積み木の王様になりたい人です、よろしく')).toHaveLength(16);
    expect(cleanName('😀'.repeat(20))).toBe('😀'.repeat(16));
    expect(cleanName('\u200b \u200b')).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe('leaderboard queries', () => {
  it('solo boards need a difficulty, room boards drop it', () => {
    expect(() => parseLeaderboardQuery({ mode: 'solo', period: 'all', page: 0 })).toThrow('difficulty unknown');
    expect(parseLeaderboardQuery({ mode: 'ffa', period: 'week', page: 2, difficulty: 'hard', tzOffset: 480, playerId: 'bad' })).toEqual({
      mode: 'ffa',
      period: 'week',
      difficulty: null,
      page: 2,
      tzOffset: 480,
      playerId: null
    });
  });

  it('starts today and this week at the player’s own midnight, weeks on Monday', () => {
    // Saturday 2026-11-21 15:30 UTC = 23:30 in UTC+8.
    const now = Date.UTC(2026, 10, 21, 15, 30);
    expect(new Date(periodStart('day', now, 480)).toISOString()).toBe('2026-11-20T16:00:00.000Z');
    expect(new Date(periodStart('day', now, 0)).toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(new Date(periodStart('week', now, 480)).toISOString()).toBe('2026-11-15T16:00:00.000Z');
    expect(new Date(periodStart('week', now, -300)).toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(periodStart('all', now, 0)).toBe(0);
  });
});

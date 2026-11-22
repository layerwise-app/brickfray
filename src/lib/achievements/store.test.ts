import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { boardMatch, boardStat, boardUnlock, user } from '~/db/schema';
import type { DetailPlayer, MatchDetail, MatchReport } from '../board/contract';
import type { BoardDb } from '../board/db';
import { storeMatches } from '../board/matches';
import { claimPlayer, ensurePlayer } from '../board/players';
import { report, soloReport, testDb } from '../board/test-db';
import { ACHIEVEMENTS, TIER_COUNT } from './catalogue';
import { noFeats } from './feats';
import { achievementsPage, countUpload, nextTiers, profileTotals, settle } from './store';
import { matchTally, medalsOf } from './tally';

const NOW = 1_800_000_100_000;
const id = (n: number) => `player-${String(n).padStart(2, '0')}-${'x'.repeat(12)}`;

let db: BoardDb;
beforeEach(async () => {
  db = await testDb();
});

/** What uploadMatches does once a batch is admitted. */
async function upload(n: number, reports: MatchReport[], now = NOW) {
  const player = await ensurePlayer(db, id(n), `P${n}`, now);
  await storeMatches(db, player, reports, now);
  return { player, news: await countUpload(db, player.profileId, reports.map(matchTally), now) };
}

const tiers = (news: { unlocks: { id: string; tier: number }[] }) => news.unlocks.map((u) => `${u.id}:${u.tier}`);

describe('counting matches', () => {
  it('adds a match once however often it is uploaded, and unlocks each tier once', async () => {
    const m = report({ kills: 10, assists: 2, headshots: 3, result: 'loss', character: 'vega' });
    const first = await upload(1, [m]);
    expect(tiers(first.news)).toEqual(['kills:1', 'matches:1']);
    expect(first.news.unlocks.every((u) => u.at === NOW)).toBe(true);
    const again = await upload(1, [m, m], NOW + 1000);
    expect(again.news.unlocks).toEqual([]);
    expect(await profileTotals(db, first.player.profileId)).toEqual({ matches: 1, kills: 10, assists: 2, headshots: 3, 'play.vega': 1 });
    expect(await db.select().from(boardUnlock)).toHaveLength(2);
  });

  it('sums the totals over matches and keeps the best wave per difficulty', async () => {
    const { player } = await upload(1, [
      soloReport({ wave: 7, kills: 30, difficulty: 'hard' }),
      soloReport({ wave: 4, kills: 20, difficulty: 'hard' }),
      soloReport({ wave: 3, kills: 10, difficulty: 'easy' })
    ]);
    const later = await upload(1, [soloReport({ wave: 5, kills: 5, difficulty: 'hard' })]);
    const totals = await profileTotals(db, player.profileId);
    expect(totals).toMatchObject({ matches: 4, kills: 65, 'best.wave.hard': 7, 'best.wave.easy': 3 });
    expect(totals['best.wave.normal']).toBeUndefined();
    // A worse run moves no wave goal: only the kills goal it fed is reported as next.
    expect(later.news.next.map((n) => n.id)).not.toContain('waveEasy');
  });

  it('counts the matches stored before achievements from the columns they have', async () => {
    const player = await ensurePlayer(db, id(1), 'Old', NOW);
    await storeMatches(db, player, [report({ kills: 30, result: 'win', character: 'moss' }), report({ kills: 25, result: 'loss', character: 'moss' })], NOW);
    await db.run(sql`UPDATE board_match SET tally = NULL`);
    await settle(db, player.profileId);
    expect(await profileTotals(db, player.profileId)).toMatchObject({ matches: 2, kills: 55, winFfa: 1, 'play.moss': 2, 'win.moss': 1 });
    expect((await db.select().from(boardMatch)).map((m) => [m.counted, !!m.tally])).toEqual([
      [1, true],
      [1, true]
    ]);
    await settle(db, player.profileId);
    expect((await profileTotals(db, player.profileId)).kills).toBe(55);
  });

  it('unlocks several tiers at once in catalogue order', async () => {
    const big = Array.from({ length: 12 }, () => report({ kills: 50, assists: 10, headshots: 45, durationS: 900, score: 5000 }));
    const { news } = await upload(1, big);
    expect(tiers(news)).toEqual(['kills:1', 'kills:2', 'kills:3', 'kills:4', 'assists:1', 'assists:2', 'assists:3', 'headshots:1', 'headshots:2', 'headshots:3', 'headshots:4', 'matches:1', 'matches:2', 'winFfa:1', 'winFfa:2']);
    expect(news.next[0]).toEqual({ id: 'kills', tier: 5, value: 600, goal: 1000 });
  });

  it('counts feats, chains and medals', async () => {
    const players: DetailPlayer[] = [
      { name: 'Bolt', character: 'vega', team: -1, score: 1500, kills: 12, deaths: 2, assists: 1, bot: true, me: false },
      { name: 'Me', character: 'coral', team: -1, score: 1200, kills: 10, deaths: 0, assists: 4, bot: false, me: true }
    ];
    const detail: MatchDetail = { mode: 'ffa', players, winner: 0 };
    const f = { ...noFeats(), sidearm: 2, melee: 1, grenade: 1, longshot: 3, airborne: 1, bounty: 1, chains: [2, 1, 1, 0, 0] as [number, number, number, number, number] };
    const { player, news } = await upload(1, [report({ character: 'coral', kills: 10, deaths: 0, assists: 4, placement: 2, players: 2, result: 'loss', detail, feats: f })]);
    expect(await profileTotals(db, player.profileId)).toMatchObject({ sidearm: 2, melee: 1, grenade: 1, longshot: 3, airborne: 1, bounty: 1, chain2: 2, chain3: 1, chain4: 1, medals: 2 });
    expect(tiers(news)).toEqual(['kills:1', 'melee:1', 'grenade:1', 'longshot:1', 'airborne:1', 'double:1', 'triple:1', 'quad:1', 'bounty:1', 'matches:1', 'medals:1']);
  });

  it('marks a flawless win only for a player who fought for it', () => {
    expect(matchTally(report({ result: 'win', deaths: 0, kills: 4 })).sum.flawless).toBe(1);
    expect(matchTally(report({ result: 'win', deaths: 0, kills: 0, score: 0 })).sum.flawless).toBeUndefined();
    expect(matchTally(report({ result: 'win', deaths: 1 })).sum.flawless).toBeUndefined();
    expect(matchTally(report({ result: 'loss', deaths: 0 })).sum.flawless).toBeUndefined();
    expect(matchTally(soloReport({ deaths: 0 })).sum.flawless).toBeUndefined();
  });

  it('gives medals by the results screen rule: shared places, none for zero', () => {
    const p = (kills: number, assists: number, me = false): DetailPlayer => ({ name: 'x', character: 'nova', team: -1, score: 0, kills, deaths: 0, assists, bot: false, me });
    const ffa = (players: DetailPlayer[]): MatchDetail => ({ mode: 'ffa', players, winner: null });
    expect(medalsOf(ffa([p(9, 0), p(9, 0), p(9, 1, true), p(1, 0)]))).toBe(2);
    expect(medalsOf(ffa([p(9, 3), p(8, 3), p(7, 3), p(6, 0, true)]))).toBe(0);
    expect(medalsOf(ffa([p(9, 3), p(8, 2), p(7, 1), p(7, 0, true)]))).toBe(1);
    expect(medalsOf({ mode: 'solo', upgrades: [] })).toBe(0);
    expect(medalsOf(null)).toBe(0);
  });
});

describe('profiles and accounts', () => {
  it("adds up an account's browsers and keeps each unlock's earliest date", async () => {
    await db.insert(user).values({ id: 'u1', name: 'u1', email: 'u1@example.com' });
    await upload(1, [report({ kills: 6, result: 'loss' })], NOW);
    await upload(2, [report({ kills: 6, result: 'loss' })], NOW + 5000);
    const laptop = await claimPlayer(db, id(1), 'u1', 'Ace', NOW + 6000);
    await claimPlayer(db, id(2), 'u1', 'Ace', NOW + 7000);
    const { news } = await upload(2, [report({ kills: 1, result: 'loss' })], NOW + 8000);
    expect(tiers(news)).toEqual(['kills:1']);
    const rows = await db.select().from(boardUnlock);
    expect(rows.map((r) => [r.achievement, r.tier, r.unlockedAt]).sort()).toEqual([
      ['kills', 1, NOW + 8000],
      ['matches', 1, NOW]
    ]);
    const page = await achievementsPage(db, (await ensurePlayer(db, id(1), null, NOW)).profileId, NOW + 9000);
    expect(page.items.find((a) => a.id === 'kills')).toMatchObject({ value: 13, unlocked: [NOW + 8000, null, null, null, null, null, null] });
    expect(page.items.find((a) => a.id === 'matches')?.value).toBe(3);
    expect(laptop.playerId).toBe(id(1));
    expect(await db.select().from(boardStat)).not.toHaveLength(0);
  });

  it('shows every achievement, locked ones with their goals, to a player the server has not met', async () => {
    const page = await achievementsPage(db, null, NOW);
    expect(page.items.map((a) => a.id)).toEqual(ACHIEVEMENTS.map((a) => a.id));
    expect(page).toMatchObject({ unlocked: 0, total: TIER_COUNT });
    for (const a of page.items) expect(a.value).toBe(0);
  });

  it('counts on the page what an upload left uncounted', async () => {
    const player = await ensurePlayer(db, id(1), 'Ace', NOW);
    await storeMatches(db, player, [report({ kills: 12, result: 'loss' })], NOW);
    const page = await achievementsPage(db, player.profileId, NOW + 1);
    expect(page.items.find((a) => a.id === 'kills')).toMatchObject({ value: 12, unlocked: [NOW + 1, null, null, null, null, null, null] });
    expect(page.unlocked).toBe(2);
  });
});

describe('next goals', () => {
  it('lists the nearest unfinished goals among those the match fed', () => {
    const next = nextTiers({ kills: 44, assists: 3, headshots: 9, 'play.rivet': 1 }, new Set(['kills', 'assists', 'headshots', 'play.rivet']), 3);
    expect(next).toEqual([
      { id: 'headshots', tier: 1, value: 9, goal: 10 },
      { id: 'kills', tier: 2, value: 44, goal: 50 },
      { id: 'assists', tier: 1, value: 3, goal: 10 }
    ]);
  });

  it('finds the uncounted matches by their index', async () => {
    const plan = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN
      SELECT m.id FROM board_match m WHERE m.profile_id = 'x' AND m.counted = 0 AND m.tally IS NOT NULL`);
    expect(plan.map((p) => p.detail).join('\n')).toMatch(/board_match_uncounted_idx/);
  });
});

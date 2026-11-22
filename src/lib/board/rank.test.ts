import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchReport } from './contract';
import type { BoardDb } from './db';
import { leaderboard, storeMatches } from './matches';
import { ensurePlayer } from './players';
import { matchRank } from './rank';
import { report, soloReport, testDb } from './test-db';

const NOW = 1_800_000_100_000;
const id = (n: number) => `player-${String(n).padStart(2, '0')}-${'x'.repeat(12)}`;

let db: BoardDb;
beforeEach(async () => {
  db = await testDb();
});

async function play(n: number, ...reports: MatchReport[]) {
  const player = await ensurePlayer(db, id(n), `P${n}`, NOW);
  await storeMatches(db, player, reports, NOW);
  return player;
}

describe('the rank of a stored match', () => {
  it('moves the player up when it beats their best, and says where they were', async () => {
    await play(1, report({ score: 3000 }));
    await play(2, report({ score: 2000 }));
    await play(3, report({ score: 1000 }));
    const better = report({ score: 2500 });
    await play(4, report({ score: 500 }), better);
    expect(await matchRank(db, id(4), better.key, 'ffa')).toEqual({ mode: 'ffa', difficulty: null, rank: 2, total: 4, before: 4, run: 2 });
  });

  it('keeps the rank of a better earlier match, and places the new one on its own', async () => {
    await play(1, report({ score: 3000 }));
    await play(2, report({ score: 2000 }));
    const worse = report({ score: 1500 });
    await play(3, report({ score: 2500 }), worse);
    expect(await matchRank(db, id(3), worse.key, 'ffa')).toMatchObject({ rank: 2, before: 2, run: 3, total: 3 });
  });

  it('has no rank before a first match on the board', async () => {
    await play(1, soloReport({ wave: 9 }));
    const first = soloReport({ wave: 4 });
    await play(2, soloReport({ wave: 12, difficulty: 'hard' }), first);
    expect(await matchRank(db, id(2), first.key, 'solo')).toEqual({ mode: 'solo', difficulty: 'normal', rank: 2, total: 2, before: null, run: 2 });
  });

  it('agrees with the leaderboard on every row', async () => {
    const keys: [number, string][] = [];
    for (let n = 1; n <= 12; n++) {
      const runs = [soloReport({ wave: (n * 7) % 11, score: n * 100 }), soloReport({ wave: (n * 5) % 9, score: 50 })];
      await play(n, ...runs);
      keys.push([n, runs[1]!.key]);
    }
    const page = await leaderboard(db, { mode: 'solo', difficulty: 'normal', map: null, page: 0, playerId: null }, null);
    for (const [n, key] of keys) {
      const rank = await matchRank(db, id(n), key, 'solo');
      expect(rank?.rank).toBe(page.rows.find((r) => r.name === `P${n}`)?.rank);
      expect(rank?.total).toBe(page.total);
    }
  });

  it('answers only the player who stored the match, for its own mode', async () => {
    const mine = report();
    await play(1, mine);
    await play(2, report());
    expect(await matchRank(db, id(2), mine.key, 'ffa')).toBeNull();
    expect(await matchRank(db, id(1), mine.key, 'tdm')).toBeNull();
    expect(await matchRank(db, id(1), 'no-such-match', 'ffa')).toBeNull();
  });

  it('finds the match by its unique key and the board by its index', async () => {
    const mine = report();
    await play(1, mine);
    const plan = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN
      SELECT m.id FROM board_match t JOIN board_match m ON m.mode = t.mode AND m.difficulty IS t.difficulty
      WHERE t.player_id = ${id(1)} AND t.match_key = ${mine.key} AND t.mode = 'ffa'`);
    const text = plan.map((p) => p.detail).join('\n');
    expect(text).toMatch(/board_match_player_key_uq/);
    expect(text).toMatch(/board_match_board_idx/);
  });
});

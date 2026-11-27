import { sql, type SQL } from 'drizzle-orm';
import type { BoardMode, MatchRank } from './contract';
import type { BoardDb } from './db';

interface RankRow {
  mode: MatchRank['mode'];
  difficulty: MatchRank['difficulty'];
  minutes: MatchRank['minutes'];
  rank: number | null;
  total: number | null;
  rank_before: number | null;
  run: number | null;
}

/** The board's order (matches.ts leaderboard): waves by wave then score, rooms by score then kills; earlier wins a tie. */
function order(solo: boolean, m: SQL = sql``): SQL {
  return solo ? sql`${m}wave DESC, ${m}score DESC, ${m}ended_at ASC, ${m}id ASC` : sql`${m}score DESC, ${m}kills DESC, ${m}ended_at ASC, ${m}id ASC`;
}

/**
 * Where a stored match leaves its player on the all-time board it belongs to (every map; solo: its difficulty; rooms: its time limit):
 * their rank now, their rank without this match (null: it is their first there), and where this match alone would
 * place against everyone else's best. Null when this player stored no match under `key`. One query; the target
 * comes through board_match_player_key_uq, the board through board_match_board_idx.
 */
export async function matchRank(db: BoardDb, playerId: string, key: string, mode: BoardMode): Promise<MatchRank | null> {
  const by = order(mode === 'solo');
  const own = order(mode === 'solo', sql`m.`);
  const row = await db.get<RankRow>(sql`
    WITH target AS (
      SELECT id, profile_id, mode, difficulty, minutes FROM board_match WHERE player_id = ${playerId} AND match_key = ${key} AND mode = ${mode}
    ), board AS (
      SELECT m.id, m.profile_id, m.wave, m.score, m.kills, m.ended_at,
        ROW_NUMBER() OVER (PARTITION BY m.profile_id ORDER BY ${own}) AS pick,
        ROW_NUMBER() OVER (PARTITION BY m.profile_id ORDER BY m.id = t.id, ${own}) AS pick_prior
      FROM target t JOIN board_match m ON m.mode = t.mode AND m.difficulty IS t.difficulty AND m.minutes IS t.minutes
    ), now AS (
      SELECT profile_id, ROW_NUMBER() OVER (ORDER BY ${by}) AS rank, COUNT(*) OVER () AS total FROM board WHERE pick = 1
    ), prior AS (
      SELECT profile_id, ROW_NUMBER() OVER (ORDER BY ${by}) AS rank
      FROM board WHERE pick_prior = 1 AND id <> (SELECT id FROM target)
    ), alone AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY ${by}) AS rank
      FROM board WHERE (pick = 1 AND profile_id <> (SELECT profile_id FROM target)) OR id = (SELECT id FROM target)
    )
    SELECT t.mode, t.difficulty, t.minutes,
      (SELECT rank FROM now WHERE profile_id = t.profile_id) AS rank,
      (SELECT total FROM now LIMIT 1) AS total,
      (SELECT rank FROM prior WHERE profile_id = t.profile_id) AS rank_before,
      (SELECT rank FROM alone WHERE id = t.id) AS run
    FROM target t`);
  if (!row || row.rank === null || row.total === null || row.run === null) return null;
  return { mode: row.mode, difficulty: row.difficulty, minutes: row.minutes, rank: row.rank, total: row.total, before: row.rank_before, run: row.run };
}

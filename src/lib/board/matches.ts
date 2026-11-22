import { sql, type SQL } from 'drizzle-orm';
import { boardMatch } from '~/db/schema';
import {
  HISTORY_PAGE,
  LEADERBOARD_PAGE,
  avatarUrl,
  type BoardEntry,
  type BoardPlayer,
  type HistoryPage,
  type LeaderboardPage,
  type LeaderboardQuery,
  type MatchDetail,
  type MatchReport,
  type MatchView,
  type RankedEntry
} from './contract';
import { matchTally } from '../achievements/tally';
import { inOrder, type BoardDb } from './db';
import type { PlayerRef } from './players';

/** Stores reported matches once each: a key the player already sent is left as it is. */
export async function storeMatches(db: BoardDb, player: PlayerRef, reports: MatchReport[], now: number) {
  // One statement per match: D1 caps the bound values of a single statement.
  await inOrder(
    db,
    reports.map((report) => {
      const { key, ticket: _, detail, feats: __, ...r } = report;
      return db
        .insert(boardMatch)
        .values({ ...r, detail: detail && JSON.stringify(detail), tally: JSON.stringify(matchTally(report)), matchKey: key, playerId: player.id, profileId: player.profileId, createdAt: now })
        .onConflictDoNothing({ target: [boardMatch.playerId, boardMatch.matchKey] });
    })
  );
  return reports.map((r) => r.key);
}

const ENTRY = sql`m.id, m.mode, m.map, m.difficulty, m.wave, m.character, m.ended_at, m.duration_s, m.score, m.kills, m.deaths, m.assists, m.headshots, m.placement, m.players, m.result`;

interface EntryRow {
  id: number;
  mode: BoardEntry['mode'];
  map: string;
  difficulty: BoardEntry['difficulty'];
  wave: number;
  character: string;
  ended_at: number;
  duration_s: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  headshots: number;
  placement: number;
  players: number;
  result: BoardEntry['result'];
}

interface PlayerRow {
  name: string;
  tag: number | null;
  avatar_hero: string | null;
  avatar_image: string | null;
}

interface RankedRow extends EntryRow, PlayerRow {
  rank: number;
  total: number;
  mine: number;
}

function boardPlayer(r: PlayerRow): BoardPlayer {
  return { name: r.name, tag: r.tag, avatar: { hero: r.avatar_hero, image: r.avatar_image ? avatarUrl(r.avatar_image) : null } };
}

function entry(r: EntryRow): BoardEntry {
  return {
    id: r.id,
    mode: r.mode,
    map: r.map,
    difficulty: r.difficulty,
    wave: r.wave,
    character: r.character,
    endedAt: r.ended_at,
    durationS: r.duration_s,
    score: r.score,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    headshots: r.headshots,
    placement: r.placement,
    players: r.players,
    result: r.result
  };
}

/** Waves rank by the wave reached, then score; rooms by score, then kills. Earlier beats later on a tie. */
function order(mode: LeaderboardQuery['mode']): SQL {
  return mode === 'solo' ? sql`m.wave DESC, m.score DESC, m.ended_at ASC, m.id ASC` : sql`m.score DESC, m.kills DESC, m.ended_at ASC, m.id ASC`;
}

/**
 * One row per player (their best match of all time on this board), ranked, one page of them, plus the asker's own
 * row wherever it ranks. `profileId` is the asker's profile, never sent back. board_match_board_idx finds the board's rows.
 */
export async function leaderboard(db: BoardDb, q: LeaderboardQuery, profileId: string | null): Promise<LeaderboardPage> {
  const from = q.page * LEADERBOARD_PAGE;
  const me = profileId ?? '';
  const rows = await db.all<RankedRow>(sql`
    WITH best AS (
      SELECT m.*, ROW_NUMBER() OVER (PARTITION BY m.profile_id ORDER BY ${order(q.mode)}) AS pick
      FROM board_match m
      WHERE m.mode = ${q.mode} ${q.difficulty ? sql`AND m.difficulty = ${q.difficulty}` : sql``} ${q.map ? sql`AND m.map = ${q.map}` : sql``}
    ), ranked AS (
      SELECT m.*, ROW_NUMBER() OVER (ORDER BY ${order(q.mode)}) AS rank, COUNT(*) OVER () AS total
      FROM best m WHERE m.pick = 1
    )
    SELECT ${ENTRY}, m.rank, m.total, p.name, p.tag, p.avatar_hero, p.avatar_image, m.profile_id = ${me} AS mine
    FROM ranked m JOIN board_profile p ON p.id = m.profile_id
    WHERE (m.rank > ${from} AND m.rank <= ${from + LEADERBOARD_PAGE}) OR m.profile_id = ${me}
    ORDER BY m.rank`);
  const ranked = rows.map((r): RankedEntry => {
    const { endedAt: _, ...rest } = entry(r);
    return { ...rest, ...boardPlayer(r), rank: r.rank, mine: !!r.mine };
  });
  const pageRows = ranked.filter((r) => r.rank > from && r.rank <= from + LEADERBOARD_PAGE);
  return {
    rows: pageRows,
    total: rows[0]?.total ?? 0,
    page: q.page,
    pageSize: LEADERBOARD_PAGE,
    me: ranked.find((r) => r.mine) ?? null
  };
}

interface TotalsRow {
  matches: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  headshots: number | null;
  wins: number | null;
  best_score: number | null;
  best_wave: number | null;
  seconds: number | null;
}

/** A profile's own matches, newest first, and its totals over all of them. */
export async function history(db: BoardDb, profileId: string, page: number): Promise<HistoryPage> {
  const [rows, totals] = await Promise.all([
    db.all<EntryRow>(sql`
      SELECT ${ENTRY} FROM board_match m WHERE m.profile_id = ${profileId}
      ORDER BY m.ended_at DESC, m.id DESC LIMIT ${HISTORY_PAGE} OFFSET ${page * HISTORY_PAGE}`),
    db.get<TotalsRow>(sql`
      SELECT COUNT(*) AS matches, SUM(kills) AS kills, SUM(deaths) AS deaths, SUM(assists) AS assists,
        SUM(headshots) AS headshots, SUM(result = 'win') AS wins, MAX(score) AS best_score, MAX(wave) AS best_wave,
        SUM(duration_s) AS seconds
      FROM board_match WHERE profile_id = ${profileId}`)
  ]);
  const t = totals ?? ({ matches: 0 } as TotalsRow);
  return {
    rows: rows.map(entry),
    total: t.matches,
    page,
    pageSize: HISTORY_PAGE,
    totals: {
      matches: t.matches,
      kills: t.kills ?? 0,
      deaths: t.deaths ?? 0,
      assists: t.assists ?? 0,
      headshots: t.headshots ?? 0,
      wins: t.wins ?? 0,
      bestScore: t.best_score ?? 0,
      bestWave: t.best_wave ?? 0,
      seconds: t.seconds ?? 0
    }
  };
}

interface MatchRow extends EntryRow, PlayerRow {
  profile_id: string;
  detail: string | null;
}

/** One stored match with who played it and its score panel; its date only when it is the asker's. */
export async function matchView(db: BoardDb, id: number, profileId: string | null): Promise<MatchView | null> {
  const row = await db.get<MatchRow>(sql`
    SELECT ${ENTRY}, m.profile_id, m.detail, p.name, p.tag, p.avatar_hero, p.avatar_image
    FROM board_match m JOIN board_profile p ON p.id = m.profile_id WHERE m.id = ${id}`);
  if (!row) return null;
  const mine = row.profile_id === profileId;
  const match = entry(row);
  return {
    match: { ...match, endedAt: mine ? match.endedAt : null },
    player: boardPlayer(row),
    mine,
    detail: row.detail ? (JSON.parse(row.detail) as MatchDetail) : null
  };
}

export const EMPTY_HISTORY: HistoryPage = {
  rows: [],
  total: 0,
  page: 0,
  pageSize: HISTORY_PAGE,
  totals: { matches: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, wins: 0, bestScore: 0, bestWave: 0, seconds: 0 }
};

import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import {
  BoardError,
  MODES,
  NAME_MAX,
  PERIODS,
  SOLO_LEVELS,
  UPLOAD_BATCH,
  type BoardMode,
  type LeaderboardQuery,
  type MatchReport,
  type MatchResult,
  type SoloLevel
} from './contract';

// The scores come from the browser: these checks keep out malformed and impossible records, not a determined forger.

const DAY = 86_400_000;
const ID = /^[A-Za-z0-9_-]{16,64}$/;
const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const SLUG = /^[a-z][a-z0-9-]{0,23}$/;
const RESULTS: MatchResult[] = ['win', 'loss', 'draw'];
/** A match in a room lasts at most 15 minutes plus overtime; a solo run has no clock. */
const MAX_SECONDS: Record<BoardMode, number> = { solo: 6 * 3600, ffa: 40 * 60, tdm: 40 * 60 };
const MAX_PLAYERS = 10;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BoardError('invalid', 'not an object');
  return value as Record<string, unknown>;
}

function count(value: unknown, field: string, max = 1_000_000) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new BoardError('invalid', `${field} out of range`);
  return value;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new BoardError('invalid', `${field} unknown`);
  return value as T;
}

export function isPlayerId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

export function playerId(value: unknown): string {
  if (!isPlayerId(value)) throw new BoardError('invalid', 'bad player id');
  return value;
}

/** A display name: one line of visible characters, at most NAME_MAX, or null when nothing usable is left. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .normalize('NFKC')
    // Controls, zero-width and direction overrides: they hide or reorder what others see.
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = [...text].slice(0, NAME_MAX).join('').trim();
  return chars.length ? chars : null;
}

/** Checks one reported match against what the game can produce; `now` is the server's clock. */
export function parseReport(raw: unknown, now: number): MatchReport {
  const r = record(raw);
  if (typeof r.key !== 'string' || !KEY.test(r.key)) throw new BoardError('invalid', 'bad key');
  const mode = oneOf(r.mode, MODES, 'mode');
  if (typeof r.map !== 'string' || !SLUG.test(r.map)) throw new BoardError('invalid', 'bad map');
  const character = oneOf(r.character, CHARACTER_IDS, 'character');
  const solo = mode === 'solo';
  const difficulty: SoloLevel | null = solo ? oneOf(r.difficulty, SOLO_LEVELS, 'difficulty') : null;
  const result: MatchResult | null = solo ? null : oneOf(r.result, RESULTS, 'result');
  if (typeof r.endedAt !== 'number' || !Number.isFinite(r.endedAt) || r.endedAt < now - 60 * DAY) throw new BoardError('invalid', 'bad time');
  const durationS = count(r.durationS, 'durationS', MAX_SECONDS[mode]);
  const wave = count(r.wave, 'wave', 1000);
  const kills = count(r.kills, 'kills');
  const deaths = count(r.deaths, 'deaths');
  const assists = count(r.assists, 'assists');
  const headshots = count(r.headshots, 'headshots');
  const score = count(r.score, 'score', 10_000_000);
  const players = count(r.players, 'players', MAX_PLAYERS);
  const placement = count(r.placement, 'placement', MAX_PLAYERS);

  const fail = (why: string) => {
    throw new BoardError('invalid', why);
  };
  if (durationS < 5) fail('too short');
  if (players < 1 || placement < 1 || placement > players) fail('bad placement');
  if (solo && (wave < 1 || deaths > 1 || players !== 1)) fail('bad solo run');
  if (!solo && wave !== 0) fail('wave outside solo');
  if (headshots > kills) fail('headshots over kills');
  // Kills and assists at most one every 1.5 s, deaths one per respawn (3 s), waves one per break (7 s) plus fighting.
  if (kills > 10 + durationS / 1.5 || assists > 10 + durationS / 1.5) fail('too many kills');
  if (deaths > 1 + durationS / 3) fail('too many deaths');
  if (wave > 1 + durationS / 8) fail('waves too fast');
  // A kill scores 100 (150 to the head), an assist 50; the slack leaves room for wave bonuses.
  if (score > 150 * kills + 50 * assists + 250 * wave) fail('score over its kills');

  return {
    key: r.key,
    mode,
    map: r.map,
    difficulty,
    wave,
    character,
    endedAt: Math.min(Math.round(r.endedAt), now),
    durationS,
    score,
    kills,
    deaths,
    assists,
    headshots,
    placement,
    players,
    result
  };
}

/** An upload: the reports that pass, and the keys of those that never will. */
export function parseUpload(raw: unknown, now: number) {
  const r = record(raw);
  const id = playerId(r.playerId);
  const name = cleanName(r.name);
  if (!Array.isArray(r.matches) || r.matches.length > UPLOAD_BATCH) throw new BoardError('invalid', 'bad batch');
  const matches: MatchReport[] = [];
  const refused: string[] = [];
  for (const item of r.matches) {
    try {
      matches.push(parseReport(item, now));
    } catch (error) {
      if (!(error instanceof BoardError)) throw error;
      const key = (item as { key?: unknown } | null)?.key;
      if (typeof key === 'string' && KEY.test(key)) refused.push(key);
    }
  }
  return { playerId: id, name, matches, refused };
}

export function parseLeaderboardQuery(raw: unknown): LeaderboardQuery {
  const r = record(raw);
  const mode = oneOf(r.mode, MODES, 'mode');
  return {
    mode,
    period: oneOf(r.period, PERIODS, 'period'),
    difficulty: mode === 'solo' ? oneOf(r.difficulty, SOLO_LEVELS, 'difficulty') : null,
    page: count(r.page, 'page', 10_000),
    tzOffset: typeof r.tzOffset === 'number' && Math.abs(r.tzOffset) <= 14 * 60 ? Math.round(r.tzOffset) : 0,
    playerId: isPlayerId(r.playerId) ? r.playerId : null
  };
}

export function parseHistoryQuery(raw: unknown) {
  const r = record(raw);
  return { playerId: playerId(r.playerId), page: count(r.page, 'page', 10_000) };
}

/** Start of the period in the player's own calendar (weeks start on Monday). */
export function periodStart(period: LeaderboardQuery['period'], now: number, tzOffset: number) {
  if (period === 'all') return 0;
  const local = now + tzOffset * 60_000;
  const midnight = local - (((local % DAY) + DAY) % DAY);
  if (period === 'day') return midnight - tzOffset * 60_000;
  // 1970-01-01 was a Thursday, day 3 of a week that starts on Monday.
  const weekday = (Math.floor(midnight / DAY) + 3) % 7;
  return midnight - weekday * DAY - tzOffset * 60_000;
}

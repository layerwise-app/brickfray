import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { MATCH } from '~/brickfray/sim/constants';
import { botsThrough, secondsToReach } from '~/brickfray/sim/waves';
import { BoardError, MODES, SOLO_LEVELS, UPLOAD_BATCH, type BoardMode, type LeaderboardQuery, type MatchReport, type MatchResult, type SoloLevel } from './contract';
import { maxScore, OVER, parseDetail } from './detail';
import { cleanName } from './names';
import type { Ticket } from './ticket';

// The scores come from the browser. A report must fit the rules of the game (parseReport) and the ticket the server
// signed when its match started (admit): no forged record can claim more than a perfect run of that length would give.

const DAY = 86_400_000;
const ID = /^[A-Za-z0-9_-]{16,64}$/;
const KEY = /^[A-Za-z0-9_-]{8,64}$/;
const SLUG = /^[a-z][a-z0-9-]{0,23}$/;
const RESULTS: MatchResult[] = ['win', 'loss', 'draw'];
/** A match in a room lasts at most 15 minutes plus overtime; a solo run has no clock. */
const MAX_SECONDS: Record<BoardMode, number> = { solo: 6 * 3600, ffa: 40 * 60, tdm: 40 * 60 };
const MAX_PLAYERS = MATCH.maxPlayers;
/** A ticket older than this no longer takes a report. */
const TICKET_DAYS = 7;
/** Seconds a report may run ahead of the server's count: clock steps, a slow ticket request. */
const SLACK = 10;

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
  // Kills and assists at most one every 1.5 s, deaths one per respawn (3 s).
  if (kills > 10 + durationS / 1.5 || assists > 10 + durationS / 1.5) fail('too many kills');
  if (deaths > 1 + durationS / 3) fail('too many deaths');
  // Half the pace the waves can spawn at: the played time a slow browser counts runs short (admit checks real time).
  if (difficulty && durationS < secondsToReach(difficulty, wave) / 2) fail('waves too fast');
  // A solo run cannot down more snapbots than its waves have sent; a room ends at its kill limit (a blast may go a few over).
  if (difficulty && kills + assists > botsThrough(difficulty, wave)) fail('more kills than snapbots');
  // …and every earlier wave was cleared to get here. Half of them is asked for: a snapbot can fall in the water by itself.
  if (difficulty && kills + assists < botsThrough(difficulty, wave - 1) / 2) fail('waves without kills');
  if (mode === 'ffa' && kills > MATCH.ffaKills + OVER) fail('kills over the limit');
  if (mode === 'tdm' && kills > MATCH.tdmKills + OVER) fail('kills over the limit');
  if (mode === 'ffa' && assists > (players - 1) * MATCH.ffaKills) fail('too many assists');
  if (mode === 'tdm' && assists > MATCH.tdmKills + OVER) fail('too many assists');
  // A kill scores 100 (150 to the head) plus, in a room, its victim's bounty; an assist 50; nothing else scores.
  if (score > maxScore(mode, kills, assists)) fail('score over its kills');

  const ticket = r.ticket ?? null;
  if (ticket !== null && (typeof ticket !== 'string' || ticket.length > 1000)) throw new BoardError('invalid', 'bad ticket');

  const report = {
    key: r.key,
    ticket,
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
  return { ...report, detail: parseDetail(r.detail, report) };
}

/**
 * Checks a report against the ticket of its match and returns it with the server's own end time. The ticket ties the
 * report to its player and settings, to one stored row (its key), and to real time: the match cannot have run longer
 * than the time since the ticket, nor a solo run reached its wave sooner than the waves can spawn.
 */
export function admit(report: MatchReport, ticket: Ticket | null, uploader: string, now: number): MatchReport {
  const fail = (why: string): never => {
    throw new BoardError('invalid', why);
  };
  if (!ticket) return fail('no ticket');
  if (ticket.playerId !== uploader || ticket.key !== report.key) fail('ticket of another match');
  if (ticket.mode !== report.mode || ticket.map !== report.map || ticket.difficulty !== report.difficulty) fail('ticket of another match');
  if (ticket.issuedAt > now || now - ticket.issuedAt > TICKET_DAYS * DAY) fail('ticket out of date');
  // A late upload keeps its own end time when the server can believe it; the span is the real time the match had.
  const endedAt = report.endedAt >= ticket.issuedAt && report.endedAt <= now ? report.endedAt : now;
  const span = (endedAt - ticket.issuedAt) / 1000 + SLACK;
  if (report.durationS > span) fail('longer than its ticket');
  if (report.difficulty && span < secondsToReach(report.difficulty, report.wave)) fail('waves too fast');
  return { ...report, endedAt };
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

export function parseMatchStart(raw: unknown) {
  const r = record(raw);
  const mode = oneOf(r.mode, MODES, 'mode');
  if (typeof r.map !== 'string' || !SLUG.test(r.map)) throw new BoardError('invalid', 'bad map');
  return { playerId: playerId(r.playerId), mode, map: r.map, difficulty: mode === 'solo' ? oneOf(r.difficulty, SOLO_LEVELS, 'difficulty') : null };
}

export function parseLeaderboardQuery(raw: unknown): LeaderboardQuery {
  const r = record(raw);
  const mode = oneOf(r.mode, MODES, 'mode');
  const map = r.map ?? null;
  if (map !== null && (typeof map !== 'string' || !SLUG.test(map))) throw new BoardError('invalid', 'bad map');
  return {
    mode,
    difficulty: mode === 'solo' ? oneOf(r.difficulty, SOLO_LEVELS, 'difficulty') : null,
    map,
    page: count(r.page, 'page', 10_000),
    playerId: isPlayerId(r.playerId) ? r.playerId : null
  };
}

export function parseHistoryQuery(raw: unknown) {
  const r = record(raw);
  return { playerId: playerId(r.playerId), page: count(r.page, 'page', 10_000) };
}

/** The rank of a match the asker stored: their player id, the match's key and its mode. */
export function parseRankQuery(raw: unknown) {
  const r = record(raw);
  if (typeof r.key !== 'string' || !KEY.test(r.key)) throw new BoardError('invalid', 'bad key');
  return { playerId: playerId(r.playerId), key: r.key, mode: oneOf(r.mode, MODES, 'mode') };
}

/** A score panel asked for: a stored match's id, and who asks (their own match shows its date). */
export function parseMatchQuery(raw: unknown) {
  const r = record(raw);
  if (typeof r.id !== 'number' || !Number.isSafeInteger(r.id) || r.id < 1) throw new BoardError('invalid', 'bad match id');
  return { id: r.id, playerId: isPlayerId(r.playerId) ? r.playerId : null };
}

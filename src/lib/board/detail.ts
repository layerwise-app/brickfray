import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { MATCH } from '~/brickfray/sim/constants';
import { KILL_SCORE, MAX_KILL_SCORE } from '~/brickfray/sim/streaks';
import { maxLevel, UPGRADE_IDS, type UpgradeId } from '~/brickfray/sim/upgrades';
import { BoardError, type BoardMode, type DetailPlayer, type MatchDetail, type MatchReport } from './contract';
import { cleanName, DEFAULT_NAME } from './names';

// The score panel a report carries. Everything in it must agree with the report's own numbers and the rules of the
// game, so a detail can show nothing the report itself could not have claimed.

/** Kills one explosion can add past a room's limit. */
export const OVER = 5;
const MAX_PLAYERS = MATCH.maxPlayers;
const UPGRADE_CAP = UPGRADE_IDS.reduce((sum, id) => sum + maxLevel(id), 0);

type Report = Omit<MatchReport, 'detail' | 'feats'>;

/** Most kills and assists can score: a kill 100 (150 to the head) plus, in a room, the bounty its victim carried; an assist 50. */
export function maxScore(mode: BoardMode, kills: number, assists: number) {
  return (mode === 'solo' ? KILL_SCORE.head : MAX_KILL_SCORE) * kills + 50 * assists;
}

function fail(why: string): never {
  throw new BoardError('invalid', why);
}

function count(value: unknown, field: string, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) fail(`detail ${field} out of range`);
  return value;
}

function player(raw: unknown, r: Report): DetailPlayer {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('detail player not an object');
  const p = raw as Record<string, unknown>;
  const limit = (r.mode === 'tdm' ? MATCH.tdmKills : MATCH.ffaKills) + OVER;
  const pace = Math.floor(10 + r.durationS / 1.5);
  const kills = count(p.kills, 'kills', Math.min(limit, pace));
  const assists = count(p.assists, 'assists', pace);
  const deaths = count(p.deaths, 'deaths', Math.floor(1 + r.durationS / 3));
  const score = count(p.score, 'score', maxScore(r.mode, kills, assists));
  const team = p.team;
  if (r.mode === 'ffa' ? team !== -1 : team !== 0 && team !== 1) fail('detail team');
  if (typeof p.character !== 'string' || !CHARACTER_IDS.includes(p.character as never)) fail('detail character');
  if (typeof p.bot !== 'boolean' || typeof p.me !== 'boolean') fail('detail flags');
  return { name: cleanName(p.name) ?? DEFAULT_NAME, character: p.character, team: team as number, score, kills, deaths, assists, bot: p.bot, me: p.me };
}

/** The report's detail, checked and rebuilt from known fields only; null when the client sent none. */
export function parseDetail(raw: unknown, r: Report): MatchDetail | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('detail not an object');
  const d = raw as Record<string, unknown>;
  if (d.mode !== r.mode) fail('detail of another mode');

  if (r.mode === 'solo') {
    // One pick per cleared wave, no upgrade past its cap.
    if (!Array.isArray(d.upgrades) || d.upgrades.length > Math.min(r.wave, UPGRADE_CAP)) fail('detail upgrades');
    const upgrades = d.upgrades.map((id: unknown) => ((UPGRADE_IDS as readonly unknown[]).includes(id) ? (id as UpgradeId) : fail('detail upgrade unknown')));
    for (const id of UPGRADE_IDS) if (upgrades.filter((u) => u === id).length > maxLevel(id)) fail('detail upgrade over its cap');
    return { mode: 'solo', upgrades };
  }

  if (!Array.isArray(d.players) || d.players.length !== r.players || r.players > MAX_PLAYERS) fail('detail players');
  const players = d.players.map((p) => player(p, r));
  for (let i = 1; i < players.length; i++) {
    const [a, b] = [players[i - 1]!, players[i]!];
    if (b.score > a.score || (b.score === a.score && b.kills > a.kills)) fail('detail not in score order');
  }
  const index = players.findIndex((p) => p.me);
  const me = players[index];
  if (!me || players.filter((p) => p.me).length !== 1) fail('detail without its reporter');
  if (index + 1 !== r.placement || me.bot || me.character !== r.character) fail('detail reporter disagrees');
  if (me.score !== r.score || me.kills !== r.kills || me.deaths !== r.deaths || me.assists !== r.assists) fail('detail reporter disagrees');

  if (r.mode === 'ffa') {
    const winner = d.winner;
    if (winner !== null && (typeof winner !== 'number' || !Number.isInteger(winner) || winner < 0 || winner >= players.length)) fail('detail winner');
    if ((r.result === 'win') !== (winner === index) || (r.result === 'draw' && winner !== null)) fail('detail result disagrees');
    return { mode: 'ffa', players, winner };
  }

  if (!Array.isArray(d.teams) || d.teams.length !== 2) fail('detail teams');
  const teams: [number, number] = [count(d.teams[0], 'teams', MATCH.tdmKills + OVER), count(d.teams[1], 'teams', MATCH.tdmKills + OVER)];
  const winner = d.winner;
  if (winner !== null && winner !== 0 && winner !== 1) fail('detail winner');
  if (winner === null ? teams[0] !== teams[1] : teams[winner] <= teams[1 - winner]!) fail('detail winner disagrees with teams');
  const result = winner === null ? 'draw' : winner === me.team ? 'win' : 'loss';
  if (r.result !== result) fail('detail result disagrees');
  return { mode: 'tdm', players, teams, winner };
}

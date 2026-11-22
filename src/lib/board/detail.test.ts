import { describe, expect, it } from 'vitest';
import { botsThrough } from '~/brickfray/sim/waves';
import { BoardError, type DetailPlayer, type MatchReport } from './contract';
import { report, soloReport } from './test-db';
import { parseReport } from './validate';

const NOW = 1_800_000_100_000;
/** A wave-5 run the report rules accept. */
const RUN = { wave: 5, durationS: 600, kills: botsThrough('normal', 5) - 2, assists: 0, score: 100 * (botsThrough('normal', 5) - 2) };

function row(over: Partial<DetailPlayer> = {}): DetailPlayer {
  return { name: 'Bolt', character: 'vega', team: -1, score: 500, kills: 5, deaths: 3, assists: 0, bot: true, me: false, ...over };
}

/** A free-for-all the reporter (Ace, 1200 points) won, as the end screen showed it. */
function ffa(over: Partial<MatchReport> = {}): MatchReport {
  const players = [row({ name: 'Ace', character: 'rivet', score: 1200, kills: 10, deaths: 4, assists: 2, bot: false, me: true }), row(), row({ name: 'Pixel', score: 300, kills: 3 })];
  return report({ players: 3, detail: { mode: 'ffa', players, winner: 0 }, ...over });
}

function tdm(winner: 0 | 1 | null, teams: [number, number]): MatchReport {
  const players = [row({ name: 'Ace', character: 'rivet', team: 0, score: 1200, kills: 10, deaths: 4, assists: 2, bot: false, me: true }), row({ team: 1 }), row({ team: 0, score: 100, kills: 1 }), row({ team: 1, score: 0, kills: 0 })];
  return report({ mode: 'tdm', players: 4, result: winner === null ? 'draw' : winner === 0 ? 'win' : 'loss', detail: { mode: 'tdm', players, teams, winner } });
}

function refused(raw: unknown) {
  try {
    parseReport(raw, NOW);
  } catch (error) {
    return error instanceof BoardError ? error.message : `other: ${String(error)}`;
  }
  return null;
}

function players(r: MatchReport) {
  if (r.detail?.mode === 'solo' || !r.detail) throw new Error('room detail expected');
  return r.detail.players;
}

function withPlayers(r: MatchReport, change: (list: DetailPlayer[]) => DetailPlayer[]): MatchReport {
  return { ...r, detail: { ...r.detail!, players: change(players(r).map((p) => ({ ...p }))) } as MatchReport['detail'] };
}

describe('match detail', () => {
  it('keeps the score panel the game shows, rebuilt from known fields only', () => {
    const r = ffa();
    const raw = { ...r, detail: { ...r.detail, extra: 'x'.repeat(5000), players: players(r).map((p) => ({ ...p, html: '<b>' })) } };
    expect(parseReport(raw, NOW).detail).toEqual(r.detail);
    expect(parseReport(tdm(0, [30, 12]), NOW).detail).toMatchObject({ mode: 'tdm', teams: [30, 12], winner: 0 });
    expect(parseReport(tdm(null, [20, 20]), NOW).detail).toMatchObject({ winner: null });
    expect(parseReport(soloReport({ ...RUN, detail: { mode: 'solo', upgrades: ['health', 'health', 'speed'] } }), NOW).detail).toEqual({ mode: 'solo', upgrades: ['health', 'health', 'speed'] });
    // A client from before details: the report stands on its own.
    expect(parseReport(report(), NOW).detail).toBeNull();
  });

  it('cleans the names of everyone in the match by the name rule', () => {
    const r = withPlayers(ffa(), (list) => [{ ...list[0]!, name: 'Ace Bolt!' }, { ...list[1]!, name: '😀' }, list[2]!]);
    expect(players(parseReport(r, NOW)).map((p) => p.name)).toEqual(['AceBolt', 'Player', 'Pixel']);
  });

  it('refuses a detail that disagrees with its own report', () => {
    expect(refused(ffa({ score: 1100 }))).toBe('detail reporter disagrees');
    expect(refused(ffa({ placement: 2 }))).toBe('detail reporter disagrees');
    expect(refused(ffa({ character: 'moss' }))).toBe('detail reporter disagrees');
    expect(refused(ffa({ players: 4 }))).toBe('detail players');
    expect(refused(ffa({ result: 'loss' }))).toBe('detail result disagrees');
    expect(refused({ ...ffa(), detail: { mode: 'tdm', players: players(ffa()), teams: [0, 0], winner: null } })).toBe('detail of another mode');
    expect(refused({ ...tdm(0, [30, 12]), result: 'loss' })).toBe('detail result disagrees');
    expect(refused(tdm(0, [12, 30]))).toBe('detail winner disagrees with teams');
    expect(refused(tdm(null, [12, 30]))).toBe('detail winner disagrees with teams');
    expect(refused(withPlayers(ffa(), (list) => list.map((p) => ({ ...p, me: false }))))).toBe('detail without its reporter');
    expect(refused(withPlayers(ffa(), (list) => list.map((p, i) => ({ ...p, me: i < 2 }))))).toBe('detail without its reporter');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, list[2]!, list[1]!]))).toBe('detail not in score order');
  });

  it('refuses players and numbers no match can have', () => {
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, character: 'brickman' }, list[2]!]))).toBe('detail character');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, team: 1 }, list[2]!]))).toBe('detail team');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, kills: 36, score: 1100 }, list[2]!]))).toBe('detail kills out of range');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, score: 1000, kills: 5 }, list[2]!]))).toBe('detail score out of range');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, deaths: 500 }, list[2]!]))).toBe('detail deaths out of range');
    expect(refused(withPlayers(ffa(), (list) => [list[0]!, { ...list[1]!, bot: 'yes' as never }, list[2]!]))).toBe('detail flags');
    expect(refused({ ...ffa(), detail: { mode: 'ffa', players: players(ffa()), winner: 7 } })).toBe('detail winner');
    expect(refused({ ...ffa(), detail: 'big' })).toBe('detail not an object');
    expect(refused({ ...ffa(), players: 10, detail: { mode: 'ffa', players: Array(11).fill(row()), winner: null } })).toBe('detail players');
  });

  it('refuses solo upgrades the run could not have taken', () => {
    const run = (upgrades: unknown[]) => soloReport({ ...RUN, detail: { mode: 'solo', upgrades: upgrades as never } });
    expect(refused(run(['health', 'speed', 'speed', 'reload', 'armor', 'damage']))).toBe('detail upgrades');
    expect(refused(run(['health', 'wings']))).toBe('detail upgrade unknown');
    expect(refused(run(['armor', 'armor', 'armor', 'armor']))).toBe('detail upgrade over its cap');
    expect(refused({ ...soloReport(RUN), detail: { mode: 'solo', upgrades: 'health' } })).toBe('detail upgrades');
    expect(refused({ ...soloReport(RUN), detail: { mode: 'ffa', players: [], winner: null } })).toBe('detail of another mode');
  });
});

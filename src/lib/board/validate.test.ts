import { describe, expect, it } from 'vitest';
import { BoardError } from './contract';
import { report, soloReport } from './test-db';
import { botsThrough, secondsToReach } from '~/brickfray/sim/waves';
import { issueTicket, openTicket, type Ticket } from './ticket';
import { admit, parseLeaderboardQuery, parseMatchQuery, parseReport, parseUpload } from './validate';

const NOW = 1_800_000_100_000;

function refused(raw: unknown) {
  try {
    parseReport(raw, NOW);
  } catch (error) {
    return error instanceof BoardError ? error.message : `other: ${String(error)}`;
  }
  return null;
}

const PLAYER = 'p'.repeat(22);

function admitted(report: ReturnType<typeof soloReport>, ticket: Partial<Ticket> | null, now = NOW) {
  const full: Ticket | null = ticket && { key: report.key, playerId: PLAYER, mode: report.mode, map: report.map, difficulty: report.difficulty, issuedAt: NOW - 3600_000, ...ticket };
  try {
    return admit(report, full, PLAYER, now);
  } catch (error) {
    return error instanceof BoardError ? error.message : `other: ${String(error)}`;
  }
}

describe('match tickets', () => {
  it('opens only what this server signed', async () => {
    const { key, ticket } = await issueTicket('secret', { playerId: PLAYER, mode: 'solo', map: 'temple', difficulty: 'hard' }, NOW);
    expect(await openTicket('secret', ticket)).toEqual({ key, playerId: PLAYER, mode: 'solo', map: 'temple', difficulty: 'hard', issuedAt: NOW });
    expect(await openTicket('other', ticket)).toBeNull();
    const [version, body, signature] = ticket.split('.');
    const forged = btoa(JSON.stringify({ key, playerId: PLAYER, mode: 'solo', map: 'temple', difficulty: 'hard', issuedAt: NOW - 86_400_000 })).replace(/=+$/, '');
    expect(await openTicket('secret', `${version}.${forged}.${signature}`)).toBeNull();
    expect(await openTicket('secret', `${version}.${body}.AAAA`)).toBeNull();
    expect(await openTicket('secret', null)).toBeNull();
    expect(await openTicket('secret', 'v1.x')).toBeNull();
  });

  it('takes a report that fits its ticket, with the end time the server can vouch for', () => {
    const run = soloReport({ wave: 5, durationS: 600, kills: 40, score: 4400, endedAt: NOW - 1000 });
    expect(admitted(run, {})).toEqual(run);
    expect(admitted({ ...run, endedAt: NOW + 5000 }, {})).toEqual({ ...run, endedAt: NOW });
    expect(admitted({ ...run, endedAt: NOW - 7200_000 }, {})).toEqual({ ...run, endedAt: NOW });
    expect(admitted(report({ endedAt: NOW - 1000 }), {})).toMatchObject({ score: 1200 });
  });

  it('refuses a report without the ticket of its own match', () => {
    const run = soloReport({ wave: 5, durationS: 600, kills: 40, score: 4400, endedAt: NOW - 1000 });
    expect(admitted(run, null)).toBe('no ticket');
    expect(admitted(run, { key: 'another-match-key' })).toBe('ticket of another match');
    expect(admitted(run, { playerId: 'q'.repeat(22) })).toBe('ticket of another match');
    expect(admitted(run, { difficulty: 'easy' })).toBe('ticket of another match');
    expect(admitted(run, { map: 'docks' })).toBe('ticket of another match');
    expect(admitted(run, { issuedAt: NOW - 8 * 86_400_000 })).toBe('ticket out of date');
    expect(admitted(run, { issuedAt: NOW + 60_000 })).toBe('ticket out of date');
  });

  it('refuses more play than the time since the ticket allows', () => {
    const minute = { issuedAt: NOW - 60_000 };
    expect(admitted(soloReport({ wave: 1, durationS: 600, kills: 3, score: 300, endedAt: NOW }), minute)).toBe('longer than its ticket');
    // A late upload cannot stretch its match: the end it claims is what counts.
    expect(admitted(soloReport({ wave: 1, durationS: 600, kills: 3, score: 300, endedAt: NOW - 3540_000 }), {})).toBe('longer than its ticket');
    // The fastest the waves can come, at the kill rate the report check allows.
    const reach = Math.ceil(secondsToReach('hard', 30));
    const bots = botsThrough('hard', 30);
    const length = Math.ceil(bots * 1.5);
    const perfect = soloReport({ difficulty: 'hard', wave: 30, durationS: length, kills: bots, assists: 0, score: 150 * bots, endedAt: NOW });
    expect(parseReport(perfect, NOW).wave).toBe(30);
    expect(admitted(perfect, { issuedAt: NOW - length * 1000 })).toEqual(perfect);
    expect(admitted(perfect, { issuedAt: NOW - length * 500 })).toBe('longer than its ticket');
    const rushed = soloReport({ difficulty: 'hard', wave: 30, durationS: Math.ceil(reach / 2), kills: 10, score: 1000, endedAt: NOW });
    expect(refused(rushed)).toBe('waves without kills');
    expect(admitted(rushed, { issuedAt: NOW - reach * 600 })).toBe('waves too fast');
  });
});

describe('match reports', () => {
  it('accepts what the game produces', () => {
    expect(parseReport(report(), NOW).score).toBe(1200);
    const kills = botsThrough('normal', 12) - 2;
    expect(parseReport(soloReport({ wave: 12, durationS: 900, kills, assists: 0, score: 110 * kills }), NOW).wave).toBe(12);
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
    expect(refused(soloReport({ wave: 1, kills: 6, score: 600 }))).toBe('more kills than snapbots');
    expect(refused(soloReport({ wave: 12, durationS: 900, kills: 20, score: 2000 }))).toBe('waves without kills');
    expect(refused(report({ kills: 36, score: 3600 }))).toBe('kills over the limit');
    expect(refused(report({ mode: 'tdm', kills: 56, score: 5600 }))).toBe('kills over the limit');
    expect(refused(report({ mode: 'tdm', assists: 80 }))).toBe('too many assists');
    expect(refused(report({ kills: 10, assists: 2, score: 1601 }))).toBe('score over its kills');
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

describe('board queries', () => {
  it('all-time boards: solo ones need a difficulty, room ones drop it; a map narrows any of them', () => {
    expect(() => parseLeaderboardQuery({ mode: 'solo', map: null, page: 0 })).toThrow('difficulty unknown');
    expect(parseLeaderboardQuery({ mode: 'ffa', map: null, page: 2, difficulty: 'hard', playerId: 'bad' })).toEqual({ mode: 'ffa', difficulty: null, map: null, page: 2, playerId: null });
    expect(parseLeaderboardQuery({ mode: 'solo', map: 'temple', page: 0, difficulty: 'easy', playerId: null })).toMatchObject({ map: 'temple', difficulty: 'easy' });
    expect(() => parseLeaderboardQuery({ mode: 'ffa', map: '../x', page: 0 })).toThrow('bad map');
    // A page loaded before the map filter asks without one (and with the period it no longer has): every map.
    expect(parseLeaderboardQuery({ mode: 'ffa', period: 'week', tzOffset: 60, page: 0 })).toMatchObject({ map: null });
  });

  it('a score panel is asked for by a stored match id', () => {
    expect(parseMatchQuery({ id: 42, playerId: PLAYER })).toEqual({ id: 42, playerId: PLAYER });
    expect(parseMatchQuery({ id: 42, playerId: 'x' })).toEqual({ id: 42, playerId: null });
    for (const id of [0, -1, 1.5, '42', null]) expect(() => parseMatchQuery({ id, playerId: null })).toThrow('bad match id');
  });
});

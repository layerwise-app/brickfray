import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { boardAvatar, boardMatch, boardPlayer, boardProfile, user } from '~/db/schema';
import { checkAvatar, readAvatar, saveAvatar } from './avatar';
import type { LeaderboardQuery } from './contract';
import type { BoardDb } from './db';
import { history, leaderboard, matchView, storeMatches } from './matches';
import { claimPlayer, ensurePlayer, findPlayer, updateProfile } from './players';
import { allow, HOUR } from './rate';
import { report, soloReport, testDb } from './test-db';

const NOW = 1_800_000_100_000;
const DAY = 86_400_000;
const id = (n: number) => `player-${String(n).padStart(2, '0')}-${'x'.repeat(12)}`;

let db: BoardDb;
beforeEach(async () => {
  db = await testDb();
});

async function play(n: number, name: string, ...reports: ReturnType<typeof report>[]) {
  const player = await ensurePlayer(db, id(n), name, NOW);
  await storeMatches(db, player, reports, NOW);
  return player;
}

function board(over: Partial<LeaderboardQuery> = {}): LeaderboardQuery {
  return { mode: 'ffa', difficulty: null, map: null, page: 0, playerId: null, ...over };
}

async function addUser(userId: string) {
  await db.insert(user).values({ id: userId, name: userId, email: `${userId}@example.com` });
}

describe('recording matches', () => {
  it('keeps one row per match key however often it is sent', async () => {
    const player = await ensurePlayer(db, id(1), 'Ace', NOW);
    const m = report();
    await storeMatches(db, player, [m], NOW);
    await storeMatches(db, player, [m, m], NOW);
    expect(await db.select().from(boardMatch)).toHaveLength(1);
  });

  it('creates one anonymous profile per player, named on first sight', async () => {
    const a = await ensurePlayer(db, id(1), 'Ace', NOW);
    const again = await ensurePlayer(db, id(1), 'Renamed', NOW);
    expect(again.profileId).toBe(a.profileId);
    expect(await db.select().from(boardProfile)).toMatchObject([{ name: 'Ace', userId: null }]);
  });
});

describe('leaderboard', () => {
  it('ranks each player once, by their best match, and marks the asker', async () => {
    await play(1, 'Ace', report({ score: 900 }), report({ score: 2100 }));
    await play(2, 'Bolt', report({ score: 1500 }));
    const me = await play(3, 'Cog', report({ score: 1500, kills: 12, endedAt: NOW - 1000 }));
    const page = await leaderboard(db, board(), me.profileId);
    expect(page.rows.map((r) => [r.rank, r.name, r.score, r.mine])).toEqual([
      [1, 'Ace', 2100, false],
      [2, 'Cog', 1500, true],
      [3, 'Bolt', 1500, false]
    ]);
    expect(page.total).toBe(3);
    expect(page.me?.rank).toBe(2);
  });

  it('ranks waves by the wave reached, then score, per difficulty', async () => {
    await play(1, 'Ace', soloReport({ wave: 8, score: 4000 }), soloReport({ wave: 9, score: 3000 }));
    await play(2, 'Bolt', soloReport({ wave: 9, score: 3500 }));
    await play(3, 'Cog', soloReport({ wave: 20, score: 9000, difficulty: 'easy' }));
    const page = await leaderboard(db, board({ mode: 'solo', difficulty: 'normal' }), null);
    expect(page.rows.map((r) => [r.name, r.wave, r.score])).toEqual([
      ['Bolt', 9, 3500],
      ['Ace', 9, 3000]
    ]);
    expect(await leaderboard(db, board({ mode: 'ffa' }), null)).toMatchObject({ rows: [], total: 0 });
  });

  it('ranks all time, on every map or on one, without dates', async () => {
    await play(1, 'Old', report({ score: 5000, endedAt: NOW - 30 * DAY, map: 'temple' }));
    await play(2, 'Week', report({ score: 3000, endedAt: NOW - 2 * DAY }), report({ score: 2500, map: 'docks' }));
    await play(3, 'Today', report({ score: 1000, endedAt: NOW - 60_000, map: 'docks' }));
    const names = async (map: string | null) => (await leaderboard(db, board({ map }), null)).rows.map((r) => [r.name, r.score, r.map]);
    expect(await names(null)).toEqual([
      ['Old', 5000, 'temple'],
      ['Week', 3000, 'plaza'],
      ['Today', 1000, 'docks']
    ]);
    expect(await names('docks')).toEqual([
      ['Week', 2500, 'docks'],
      ['Today', 1000, 'docks']
    ]);
    expect(await names('fortress')).toEqual([]);
    expect(JSON.stringify(await leaderboard(db, board(), null))).not.toContain('endedAt');
  });

  it('shows each name with its tag', async () => {
    await play(1, 'Ace', report({ score: 900 }));
    await play(2, 'Ace', report({ score: 800 }));
    const rows = (await leaderboard(db, board(), null)).rows;
    expect(rows.map((r) => r.name)).toEqual(['Ace', 'Ace']);
    expect(rows[0]!.tag).not.toBe(rows[1]!.tag);
    for (const r of rows) expect(r.tag).toBeGreaterThanOrEqual(1000);
  });

  it('pages in SQL and still reports the asker’s rank off the page', async () => {
    for (let i = 1; i <= 45; i++) await play(i, `P${i}`, report({ score: 10_000 - i * 10, kills: 60, durationS: 900 }));
    const asker = await findPlayer(db, id(44));
    const first = await leaderboard(db, board({ playerId: id(44) }), asker!.profileId);
    expect(first.rows).toHaveLength(20);
    expect(first.rows[0]!.name).toBe('P1');
    expect(first.total).toBe(45);
    expect(first.me).toMatchObject({ rank: 44, name: 'P44', mine: true });
    const third = await leaderboard(db, board({ page: 2 }), asker!.profileId);
    expect(third.rows.map((r) => r.rank)).toEqual([41, 42, 43, 44, 45]);
    expect(third.rows.find((r) => r.mine)?.name).toBe('P44');
  });

  it('never sends player ids or emails', async () => {
    await addUser('u1');
    await play(1, 'Ace', report());
    await claimPlayer(db, id(1), 'u1', 'Ace', NOW);
    const text = JSON.stringify(await leaderboard(db, board(), null));
    expect(text).not.toContain(id(1));
    expect(text).not.toContain('example.com');
    expect(text).not.toContain('u1');
  });
});

describe('history', () => {
  it('lists the profile’s matches newest first with totals over all of them', async () => {
    const p = await play(
      1,
      'Ace',
      report({ endedAt: NOW - 3000, score: 800, kills: 6, result: 'loss', placement: 3 }),
      report({ endedAt: NOW - 1000, score: 2000, kills: 14 }),
      soloReport({ endedAt: NOW - 2000, wave: 11, score: 5000, kills: 40, durationS: 1200 })
    );
    await play(2, 'Other', report({ score: 9000, kills: 60, durationS: 900 }));
    const page = await history(db, p.profileId, 0);
    expect(page.rows.map((r) => r.score)).toEqual([2000, 5000, 800]);
    expect(page.totals).toMatchObject({ matches: 3, kills: 60, wins: 1, bestScore: 5000, bestWave: 11, seconds: 2400 });
  });
});

describe('score panel', () => {
  it('opens any stored match with its detail; the date only for the asker’s own', async () => {
    const detail = { mode: 'solo' as const, upgrades: ['health' as const, 'speed' as const] };
    const ace = await play(1, 'Ace', soloReport({ detail, endedAt: NOW - 5000 }), report({ score: 700 }));
    const other = await play(2, 'Bolt', report());
    const [solo, old] = (await history(db, ace.profileId, 0)).rows.sort((a, b) => a.id - b.id);
    const own = await matchView(db, solo!.id, ace.profileId);
    expect(own).toMatchObject({ mine: true, detail, match: { wave: 5, endedAt: NOW - 5000 }, player: { name: 'Ace', tag: ace.tag } });
    expect(await matchView(db, solo!.id, other.profileId)).toMatchObject({ mine: false, detail, match: { endedAt: null } });
    expect(await matchView(db, solo!.id, null)).toMatchObject({ mine: false, match: { endedAt: null } });
    // Stored before details were kept: the row alone.
    expect(await matchView(db, old!.id, ace.profileId)).toMatchObject({ detail: null, match: { score: 700 } });
    expect(await matchView(db, 99_999, null)).toBeNull();
  });
});

describe('signing in', () => {
  it('first browser lends the account its profile; the second merges in with its matches', async () => {
    await addUser('u1');
    const a = await play(1, 'Laptop', report({ score: 1000 }));
    const b = await play(2, 'Phone', report({ score: 3000 }), report({ score: 500 }));
    await updateProfile(db, b, { hero: 'nova' }, NOW);

    const first = await claimPlayer(db, id(1), 'u1', 'Laptop', NOW);
    expect(first).toMatchObject({ playerId: id(1), profile: { name: 'Laptop' } });
    const second = await claimPlayer(db, id(2), 'u1', 'Phone', NOW);
    // The account keeps its name, tag and portrait.
    expect(second.profile).toEqual(first.profile);

    const profiles = await db.select().from(boardProfile);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ id: a.profileId, userId: 'u1' });
    expect((await history(db, a.profileId, 0)).totals.matches).toBe(3);
    const ranked = await leaderboard(db, board(), a.profileId);
    expect(ranked.rows.map((r) => [r.name, r.score, r.mine])).toEqual([['Laptop', 3000, true]]);
    // Claiming again changes nothing.
    await claimPlayer(db, id(2), 'u1', 'Phone', NOW);
    expect(await db.select().from(boardProfile)).toHaveLength(1);
  });

  it('a browser the server never heard of joins the account', async () => {
    await addUser('u1');
    await play(1, 'Laptop', report());
    await claimPlayer(db, id(1), 'u1', 'Laptop', NOW);
    const fresh = await claimPlayer(db, id(9), 'u1', 'New', NOW);
    expect(fresh).toMatchObject({ playerId: id(9), profile: { name: 'Laptop' } });
    expect((await findPlayer(db, id(9)))?.userId).toBe('u1');
  });

  it('an account with no browser on record gets a profile named by the browser', async () => {
    await addUser('u1');
    expect(await claimPlayer(db, id(5), 'u1', 'Fresh', NOW)).toMatchObject({ playerId: id(5), profile: { name: 'Fresh' } });
  });

  it('never moves a player that belongs to another account', async () => {
    await addUser('u1');
    await addUser('u2');
    await play(1, 'Mine', report());
    await claimPlayer(db, id(1), 'u1', 'Mine', NOW);
    const stolen = await claimPlayer(db, id(1), 'u2', 'Thief', NOW);
    expect(stolen.playerId).not.toBe(id(1));
    expect((await findPlayer(db, id(1)))?.userId).toBe('u1');
    expect((await findPlayer(db, stolen.playerId))?.userId).toBe('u2');
  });
});

describe('profile and avatar', () => {
  const png = (w: number, h: number) => {
    const bytes = new Uint8Array(64);
    const view = new DataView(bytes.buffer);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    view.setUint32(16, w);
    view.setUint32(20, h);
    return bytes;
  };

  it('accepts a small square in a listed type and nothing else', () => {
    expect(checkAvatar('image/png', png(128, 128))).toBe('image/png');
    expect(() => checkAvatar('image/gif', png(128, 128))).toThrow('avatar type');
    expect(() => checkAvatar('image/png', png(1024, 1024))).toThrow('avatar dimensions');
    expect(() => checkAvatar('image/png', png(128, 64))).toThrow('avatar dimensions');
    expect(() => checkAvatar('image/webp', png(128, 128))).toThrow('avatar header');
    expect(() => checkAvatar('image/png', new Uint8Array(40 * 1024))).toThrow('avatar size');
  });

  it('a new picture replaces the old one; choosing a portrait removes it', async () => {
    const p = await ensurePlayer(db, id(1), 'Ace', NOW);
    const first = await saveAvatar(db, p, 'image/png', png(128, 128), NOW);
    const second = await saveAvatar(db, p, 'image/png', png(64, 64), NOW);
    expect(await readAvatar(db, first)).toBeNull();
    expect((await readAvatar(db, second))?.bytes).toEqual(png(64, 64));
    const view = await updateProfile(db, p, { hero: 'moss', name: 'MossFan' }, NOW);
    expect(view).toEqual({ name: 'MossFan', tag: p.tag, avatar: { hero: 'moss', image: null } });
    expect(await db.select().from(boardAvatar).where(eq(boardAvatar.profileId, p.profileId))).toHaveLength(0);
  });
});

describe('rate limits', () => {
  it('counts per key and window', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await allow(db, 'k', 3, HOUR, NOW));
    expect(results).toEqual([true, true, true, false]);
    expect(await allow(db, 'other', 3, HOUR, NOW)).toBe(true);
    expect(await allow(db, 'k', 3, HOUR, NOW + HOUR)).toBe(true);
    expect(await allow(db, 'batch', 10, HOUR, NOW, 8)).toBe(true);
    expect(await allow(db, 'batch', 10, HOUR, NOW, 3)).toBe(false);
  });
});

describe('players', () => {
  it('cascade with their profile', async () => {
    const p = await play(1, 'Ace', report());
    await db.delete(boardProfile).where(eq(boardProfile.id, p.profileId));
    expect(await db.select().from(boardPlayer)).toHaveLength(0);
    expect(await db.select().from(boardMatch)).toHaveLength(0);
  });
});

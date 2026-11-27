import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import type { BoardDb } from '../board/db';
import { achievementsPage, profileTotals } from './store';

// The achievements migration runs on the live board, which already has matches: they must stay as they were and be
// counted the first time their player is seen again.

const MIGRATION = '20261122080747_achievements';
const NOW = 1_800_000_100_000;

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('achievements migration', () => {
  it('keeps every match, counts none yet, and counts them all once their player is seen', async () => {
    dir = mkdtempSync(join(tmpdir(), 'achievements-migration-'));
    for (const name of readdirSync('drizzle')) if (name < MIGRATION) cpSync(join('drizzle', name), join(dir, name), { recursive: true });
    const client = new DatabaseSync(':memory:');
    client.exec('PRAGMA foreign_keys = ON');
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: dir });

    client.exec(`INSERT INTO board_profile (id, name, name_key, tag, avatar_hero, created_at, updated_at) VALUES ('p1', 'Ace', 'ace', 1234, 'moss', 0, 0)`);
    client.exec(`INSERT INTO board_player (id, profile_id, created_at, last_seen_at) VALUES ('player-1', 'p1', 0, 0)`);
    const match = client.prepare(`INSERT INTO board_match (player_id, profile_id, match_key, mode, map, difficulty, wave, character, ended_at, duration_s, score,
      kills, deaths, assists, headshots, placement, players, result, detail, created_at) VALUES ('player-1', 'p1', ?, ?, 'plaza', ?, ?, ?, 0, 600, 900, ?, 1, ?, ?, 1, ?, ?, ?, 0)`);
    const detail = JSON.stringify({
      mode: 'ffa',
      winner: 0,
      players: [
        { name: 'Ace', character: 'moss', team: -1, score: 900, kills: 8, deaths: 1, assists: 3, bot: false, me: true },
        { name: 'Bot', character: 'nova', team: -1, score: 300, kills: 3, deaths: 5, assists: 0, bot: true, me: false }
      ]
    });
    match.run('m1', 'ffa', null, 0, 'moss', 8, 3, 2, 2, 'win', detail);
    match.run('m2', 'tdm', null, 0, 'nova', 5, 6, 1, 8, 'loss', null);
    match.run('m3', 'solo', 'hard', 6, 'rivet', 20, 1, 4, 1, null, null);
    const before = client.prepare('SELECT * FROM board_match ORDER BY id').all();

    await migrate(db, { migrationsFolder: 'drizzle' });
    const after = client.prepare('SELECT * FROM board_match ORDER BY id').all() as Record<string, unknown>[];
    // Later migrations add columns of their own (the time limit), empty on these old rows.
    expect(after.map(({ tally: _, counted: __, minutes, ...rest }) => (expect(minutes).toBeNull(), rest))).toEqual(before);
    expect(after.map((m) => [m.tally, m.counted])).toEqual([
      [null, 0],
      [null, 0],
      [null, 0]
    ]);
    expect(client.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    const totals = await profileTotals(db as BoardDb, 'p1');
    expect(totals).toEqual({});
    const page = await achievementsPage(db as BoardDb, 'p1', NOW);
    const value = (id: string) => page.items.find((a) => a.id === id)?.value;
    expect([value('matches'), value('kills'), value('assists'), value('headshots'), value('winFfa'), value('medals'), value('waveHard'), value('roster')]).toEqual([3, 33, 10, 7, 1, 2, 6, 3]);
    expect(client.prepare('SELECT COUNT(*) AS n FROM board_match WHERE counted = 1').get()).toEqual({ n: 3 });
    const again = await achievementsPage(db as BoardDb, 'p1', NOW + 1);
    expect(again.items.find((a) => a.id === 'kills')?.value).toBe(33);
  });
});

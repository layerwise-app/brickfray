import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { afterEach, describe, expect, it } from 'vitest';

const BACKFILL = readdirSync('drizzle').find((name) => name.endsWith('_board_minutes_backfill'))!;

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('time-limit backfill', () => {
  it('gives each older room match the shortest limit its played time fits, and leaves solo runs and kept limits alone', async () => {
    dir = mkdtempSync(join(tmpdir(), 'minutes-backfill-'));
    for (const name of readdirSync('drizzle')) if (name < BACKFILL) cpSync(join('drizzle', name), join(dir, name), { recursive: true });
    const client = new DatabaseSync(':memory:');
    client.exec('PRAGMA foreign_keys = ON');
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: dir });

    client.exec(`INSERT INTO board_profile (id, name, name_key, tag, created_at, updated_at) VALUES ('p1', 'Ace', 'ace', 1234, 0, 0)`);
    client.exec(`INSERT INTO board_player (id, profile_id, created_at, last_seen_at) VALUES ('player-1', 'p1', 0, 0)`);
    const match = client.prepare(`INSERT INTO board_match (player_id, profile_id, match_key, mode, map, difficulty, minutes, wave, character, ended_at, duration_s,
      score, kills, deaths, assists, headshots, placement, players, created_at) VALUES ('player-1', 'p1', ?, ?, 'plaza', ?, ?, 0, 'moss', 0, ?, 100, 1, 0, 0, 0, 1, 2, 0)`);
    const rows: [string, string, string | null, number | null, number][] = [
      ['a', 'ffa', null, null, 181],
      ['b', 'tdm', null, null, 300],
      ['c', 'ffa', null, null, 420],
      ['d', 'ffa', null, null, 605],
      ['e', 'tdm', null, null, 900],
      ['f', 'ffa', null, 15, 200],
      ['g', 'solo', 'hard', null, 400]
    ];
    for (const r of rows) match.run(...r);

    await migrate(db, { migrationsFolder: 'drizzle' });
    const after = client.prepare('SELECT match_key, minutes FROM board_match ORDER BY match_key').all();
    expect(after.map((r) => [r.match_key, r.minutes])).toEqual([
      ['a', 3],
      ['b', 5],
      ['c', 10],
      ['d', 10],
      ['e', 15],
      ['f', 15],
      ['g', null]
    ]);
  });
});

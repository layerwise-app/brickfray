import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanName, DEFAULT_NAME, nameKey } from './names';

// The names-and-tags migration runs on a live database that already has rows: this builds one as it was before
// (every earlier migration, rows in the old shape), applies the rest and checks what the backfill left.

const TAGS_MIGRATION = '20261122014634_board_names_tags';
const NAMES = ['Brick Fan', 'brick fan', 'BRICK FAN', 'ÉMILE', 'émile', 'Zoë.Ångström', 'Nguyễn Văn', '砖块 大王', 'スーパー佐々木', '벽돌왕', 'Ace_!@#Bolt', 'Иван Ace', 'ǃAceǀ', 'İstanbul', 'ẞTRASSE', 'ŁÓDŹ Ǎ', '𠀀x', '😀', ''];

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function before() {
  dir = mkdtempSync(join(tmpdir(), 'board-migration-'));
  for (const name of readdirSync('drizzle')) if (name < TAGS_MIGRATION) cpSync(join('drizzle', name), join(dir, name), { recursive: true });
  return dir;
}

describe('names and tags migration', () => {
  it('cleans stored names like the server does, tags them without collisions, keeps portraits steady', async () => {
    const client = new DatabaseSync(':memory:');
    client.exec('PRAGMA foreign_keys = ON');
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: before() });

    const profile = client.prepare('INSERT INTO board_profile (id, name, avatar_hero, avatar_image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0)');
    NAMES.forEach((name, i) => profile.run(`p${i}`, name, null, null, i));
    profile.run('chosen', 'Chosen', 'moss', null, 100);
    profile.run('upload', 'Upload', null, 'img1', 101);
    client.exec(`INSERT INTO board_player (id, profile_id, created_at, last_seen_at) VALUES ('player-p0', 'p0', 0, 0)`);
    const match = client.prepare(`INSERT INTO board_match (player_id, profile_id, match_key, mode, map, wave, character, ended_at, duration_s, score, kills, deaths, assists, headshots, placement, players, created_at)
      VALUES ('player-p0', 'p0', ?, 'ffa', 'plaza', 0, ?, ?, 600, 100, 1, 0, 0, 0, 1, 2, 0)`);
    match.run('m1', 'nova', 2000);
    match.run('m2', 'coral', 1000);

    await migrate(db, { migrationsFolder: 'drizzle' });
    const rows = client.prepare('SELECT id, name, name_key AS key, tag, avatar_hero AS hero, avatar_image AS image FROM board_profile').all() as {
      id: string;
      name: string;
      key: string;
      tag: number;
      hero: string | null;
      image: string | null;
    }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    NAMES.forEach((name, i) => {
      const want = cleanName(name) ?? DEFAULT_NAME;
      expect({ name: byId[`p${i}`]!.name, key: byId[`p${i}`]!.key }, name).toEqual({ name: want, key: nameKey(want) });
    });
    for (const r of rows) expect(r.tag, r.name).toBeGreaterThanOrEqual(1000);
    for (const r of rows) expect(r.tag, r.name).toBeLessThanOrEqual(9999);
    expect(new Set(rows.map((r) => `${r.key}#${r.tag}`)).size).toBe(rows.length);
    expect(rows.filter((r) => r.key === 'brickfan')).toHaveLength(3);

    // The latest match's character; a chosen portrait and an upload stay as they were; every other profile gets one.
    expect(byId.p0!.hero).toBe('nova');
    expect(byId.chosen).toMatchObject({ hero: 'moss', image: null });
    expect(byId.upload).toMatchObject({ hero: null, image: 'img1' });
    for (const r of rows) expect(r.hero ?? r.image).toBeTruthy();

    // From here on the pair is unique.
    const taken = byId.p0!;
    expect(() => client.prepare('INSERT INTO board_profile (id, name, name_key, tag, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0)').run('dup', 'x', taken.key, taken.tag)).toThrow('UNIQUE');
    expect(client.prepare(`SELECT detail FROM board_match WHERE match_key = 'm1'`).get()).toEqual({ detail: null });
  });
});

import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { boardProfile } from '~/db/schema';
import type { BoardDb } from './db';
import { nameKey } from './names';
import { ensurePlayer, getProfile, updateProfile } from './players';
import { createProfile, freeTag, renameProfile, repairProfile } from './tags';
import { testDb } from './test-db';

const NOW = 1_800_000_100_000;
const id = (n: number) => `player-${String(n).padStart(2, '0')}-${'x'.repeat(12)}`;

let db: BoardDb;
beforeEach(async () => {
  db = await testDb();
});

async function profileOf(n: number) {
  const p = await ensurePlayer(db, id(n), null, NOW);
  return (await getProfile(db, p.profileId))!;
}

/** Holds every tag from `from` to `to` for a name, as other profiles would. */
async function fill(key: string, from: number, to: number) {
  await db.run(sql`
    WITH RECURSIVE t(n) AS (SELECT ${from} UNION ALL SELECT n + 1 FROM t WHERE n < ${to})
    INSERT INTO board_profile (id, name, name_key, tag, created_at, updated_at) SELECT 'held-' || ${key} || n, ${key}, ${key}, n, 0, 0 FROM t`);
}

/** The database another request reaches first: `before` runs once, just ahead of the first call of `method`. */
function racing(method: 'insert' | 'run', before: (row?: unknown) => PromiseLike<unknown>): BoardDb {
  let done = false;
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== method || typeof value !== 'function') return typeof value === 'function' ? value.bind(target) : value;
      if (method === 'run') {
        return async (...args: unknown[]) => {
          if (!done) {
            done = true;
            await before();
          }
          return value.apply(target, args);
        };
      }
      return (table: unknown) => {
        const builder = value.call(target, table);
        if (done || table !== boardProfile) return builder;
        return {
          values: (row: unknown) => {
            const insert = builder.values(row);
            return {
              onConflictDoNothing: () => ({
                returning: async (cols: never) => {
                  done = true;
                  await before(row);
                  return insert.onConflictDoNothing().returning(cols);
                }
              })
            };
          }
        };
      };
    }
  });
}

describe('tags', () => {
  it('a new profile gets a four-digit tag and a random portrait it keeps', async () => {
    const p = await profileOf(1);
    expect(p.name).toBe('Player');
    expect(p.nameKey).toBe('player');
    expect(p.tag).toBeGreaterThanOrEqual(1000);
    expect(p.tag).toBeLessThanOrEqual(9999);
    expect(CHARACTER_IDS).toContain(p.avatarHero);
    expect((await profileOf(1)).avatarHero).toBe(p.avatarHero);
    const heroes = new Set<string | null>();
    for (let n = 2; n < 40; n++) heroes.add((await profileOf(n)).avatarHero);
    expect(heroes.size).toBeGreaterThan(3);
  });

  it('players of one name, in any case, never share a tag', async () => {
    const tags = [];
    for (let n = 1; n <= 30; n++) {
      const p = await ensurePlayer(db, id(n), n % 2 ? 'Ace' : 'ACE', NOW);
      tags.push((await getProfile(db, p.profileId))!.tag);
    }
    expect(new Set(tags).size).toBe(30);
    expect((await db.select().from(boardProfile)).every((p) => p.nameKey === 'ace')).toBe(true);
  });

  it('falls back to five digits once a name has used every four-digit tag', async () => {
    await fill('busy', 1000, 9998);
    expect(await freeTag(db, 'busy')).toBe(9999);
    await fill('full', 1000, 9999);
    const tag = await freeTag(db, 'full');
    expect(tag).toBeGreaterThanOrEqual(10_000);
    expect(tag).toBeLessThanOrEqual(99_999);
  });

  it('a rename keeps the tag when the new name has it free, and takes a free one when not', async () => {
    const ace = await ensurePlayer(db, id(1), 'Ace', NOW);
    const before = (await getProfile(db, ace.profileId))!.tag!;
    expect(await updateProfile(db, ace, { name: 'ace' }, NOW)).toMatchObject({ name: 'ace', tag: before });
    expect(await updateProfile(db, ace, { name: 'Bolt' }, NOW)).toMatchObject({ name: 'Bolt', tag: before });

    const other = await ensurePlayer(db, id(2), 'Cog', NOW);
    await db.update(boardProfile).set({ tag: before }).where(eq(boardProfile.id, other.profileId));
    const moved = await updateProfile(db, other, { name: 'BOLT' }, NOW);
    expect(moved.name).toBe('BOLT');
    expect(moved.tag).not.toBe(before);
    expect((await getProfile(db, ace.profileId))!.tag).toBe(before);
  });

  it('two profiles taking the same free pair at once: the second picks again', async () => {
    // The rival inserts the very pair this request picked, between its check and its insert.
    const rival = racing('insert', (row) => db.insert(boardProfile).values({ ...(row as typeof boardProfile.$inferInsert), id: 'rival', userId: null }));
    expect(await createProfile(rival, { id: 'mine', userId: null, name: 'Twin' }, NOW)).toBe(true);
    const twins = await db.select().from(boardProfile).where(eq(boardProfile.nameKey, 'twin'));
    expect(twins.map((p) => p.id).sort()).toEqual(['mine', 'rival']);
    expect(twins[0]!.tag).not.toBe(twins[1]!.tag);
  });

  it('a rename that loses the race to its pair takes another tag', async () => {
    const ace = await ensurePlayer(db, id(1), 'Ace', NOW);
    const tag = (await getProfile(db, ace.profileId))!.tag!;
    const rival = racing('run', () => db.insert(boardProfile).values({ id: 'rival', name: 'Zed', nameKey: 'zed', tag, createdAt: NOW, updatedAt: NOW }));
    await renameProfile(rival, ace.profileId, 'Zed', NOW);
    const after = (await getProfile(db, ace.profileId))!;
    expect(after.name).toBe('Zed');
    expect(after.tag).not.toBe(tag);
  });

  it('a profile a Worker from before tags made gets its name cleaned, a tag and a portrait when next seen', async () => {
    const ace = await ensurePlayer(db, id(1), 'Ace', NOW);
    await db.update(boardProfile).set({ name: 'Old Name!', nameKey: null, tag: null, avatarHero: null }).where(eq(boardProfile.id, ace.profileId));
    await ensurePlayer(db, id(1), null, NOW);
    expect(await getProfile(db, ace.profileId)).toMatchObject({ name: 'OldName', nameKey: 'oldname', tag: expect.any(Number), avatarHero: expect.any(String) });
    await repairProfile(db, 'missing', NOW);
    expect(nameKey('OldName')).toBe('oldname');
  });
});

import { and, between, eq, inArray, ne, sql } from 'drizzle-orm';
import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { boardProfile } from '~/db/schema';
import type { BoardDb } from './db';
import { cleanName, DEFAULT_NAME, nameKey } from './names';

// Name#1234: the number after a name tells apart players of the same name. board_profile_name_tag_uq keeps each
// (name without case, tag) pair to one profile; two profiles picking the same free pair at once is settled there,
// and the loser picks again.

/** Four digits first; five once a name has used every four-digit tag. */
const SPACES = [
  [1000, 9000],
  [10_000, 90_000]
] as const;
const PICKS = 8;
const TRIES = 6;

function pick(low: number, size: number) {
  return low + Math.floor(Math.random() * size);
}

export function randomHero() {
  return CHARACTER_IDS[Math.floor(Math.random() * CHARACTER_IDS.length)]!;
}

/** A tag no profile of this name holds: a few random picks, or the whole list once the picks keep landing on taken ones. */
export async function freeTag(db: BoardDb, key: string): Promise<number> {
  for (const [low, size] of SPACES) {
    const picks = new Set<number>();
    while (picks.size < PICKS) picks.add(pick(low, size));
    const held = await db
      .select({ tag: boardProfile.tag })
      .from(boardProfile)
      .where(and(eq(boardProfile.nameKey, key), inArray(boardProfile.tag, [...picks])));
    const taken = new Set(held.map((r) => r.tag));
    const free = [...picks].find((t) => !taken.has(t));
    if (free !== undefined) return free;
    const all = await db
      .select({ tag: boardProfile.tag })
      .from(boardProfile)
      .where(and(eq(boardProfile.nameKey, key), between(boardProfile.tag, low, low + size - 1)));
    if (all.length >= size) continue;
    const used = new Set(all.map((r) => r.tag));
    const open: number[] = [];
    for (let t = low; t < low + size; t++) if (!used.has(t)) open.push(t);
    return open[Math.floor(Math.random() * open.length)]!;
  }
  throw new Error(`no free tag for ${key}`);
}

/**
 * Inserts a profile under a free tag and a random portrait. False when nothing was inserted because the account
 * already has a profile (user_id is unique too): the caller reads that one.
 */
export async function createProfile(db: BoardDb, p: { id: string; userId: string | null; name: string }, now: number) {
  const key = nameKey(p.name);
  const hero = randomHero();
  for (let i = 0; i < TRIES; i++) {
    const tag = await freeTag(db, key);
    const [row] = await db
      .insert(boardProfile)
      .values({ id: p.id, userId: p.userId, name: p.name, nameKey: key, tag, avatarHero: hero, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning({ id: boardProfile.id });
    if (row) return true;
    if (p.userId && (await db.select({ id: boardProfile.id }).from(boardProfile).where(eq(boardProfile.userId, p.userId)).get())) return false;
  }
  throw new Error('profile found no free tag');
}

/** A new name. The tag stays unless another profile of the new name holds it; then a free one replaces it. */
export async function renameProfile(db: BoardDb, profileId: string, name: string, now: number) {
  const key = nameKey(name);
  let tag: number | null = (await db.select({ tag: boardProfile.tag }).from(boardProfile).where(eq(boardProfile.id, profileId)).get())?.tag ?? null;
  for (let i = 0; i < TRIES; i++) {
    const clash =
      tag !== null &&
      (await db
        .select({ id: boardProfile.id })
        .from(boardProfile)
        .where(and(eq(boardProfile.nameKey, key), eq(boardProfile.tag, tag), ne(boardProfile.id, profileId)))
        .get());
    if (tag === null || clash) tag = await freeTag(db, key);
    // OR IGNORE: when another profile took the pair since the check, the row stays as it was and the loop picks again.
    await db.run(sql`UPDATE OR IGNORE board_profile SET name = ${name}, name_key = ${key}, tag = ${tag}, updated_at = ${now} WHERE id = ${profileId}`);
    const row = await db.select({ name: boardProfile.name, nameKey: boardProfile.nameKey, tag: boardProfile.tag }).from(boardProfile).where(eq(boardProfile.id, profileId)).get();
    if (!row) throw new Error('profile vanished');
    if (row.name === name && row.nameKey === key && row.tag === tag) return;
    tag = null;
  }
  throw new Error('rename found no free tag');
}

/** A profile a Worker from before tags created (during a publish): cleaned name, a tag and a portrait, as a new one has. */
export async function repairProfile(db: BoardDb, profileId: string, now: number) {
  const row = await db.select({ name: boardProfile.name, avatarHero: boardProfile.avatarHero, avatarImage: boardProfile.avatarImage }).from(boardProfile).where(eq(boardProfile.id, profileId)).get();
  if (!row) return;
  await renameProfile(db, profileId, cleanName(row.name) ?? DEFAULT_NAME, now);
  if (!row.avatarHero && !row.avatarImage) await db.update(boardProfile).set({ avatarHero: randomHero() }).where(eq(boardProfile.id, profileId));
}

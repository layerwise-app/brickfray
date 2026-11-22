import { and, eq, isNull, notExists, sql } from 'drizzle-orm';
import { boardAvatar, boardMatch, boardPlayer, boardProfile } from '~/db/schema';
import { carryUnlocks } from '../achievements/store';
import { avatarUrl, type ClaimResult, type ProfileView } from './contract';
import { inOrder, newId, type BoardDb } from './db';
import { DEFAULT_NAME } from './names';
import { createProfile, renameProfile, repairProfile } from './tags';

export interface PlayerRef {
  id: string;
  profileId: string;
  userId: string | null;
  /** Null on a profile created before tags (see repairProfile). */
  tag: number | null;
}

export function profileView(p: { name: string; tag: number | null; avatarHero: string | null; avatarImage: string | null }): ProfileView {
  return { name: p.name, tag: p.tag, avatar: { hero: p.avatarHero, image: p.avatarImage ? avatarUrl(p.avatarImage) : null } };
}

export async function findPlayer(db: BoardDb, playerId: string): Promise<PlayerRef | null> {
  const row = await db
    .select({ id: boardPlayer.id, profileId: boardPlayer.profileId, userId: boardProfile.userId, tag: boardProfile.tag })
    .from(boardPlayer)
    .innerJoin(boardProfile, eq(boardProfile.id, boardPlayer.profileId))
    .where(eq(boardPlayer.id, playerId))
    .get();
  return row ?? null;
}

export async function getProfile(db: BoardDb, profileId: string) {
  return (await db.select().from(boardProfile).where(eq(boardProfile.id, profileId)).get()) ?? null;
}

/** The player behind an id, created with its own anonymous profile the first time the server hears of it. */
export async function ensurePlayer(db: BoardDb, playerId: string, name: string | null, now: number): Promise<PlayerRef> {
  const found = await findPlayer(db, playerId);
  if (found?.tag === null) await repairProfile(db, found.profileId, now);
  if (found) return found;
  const profileId = newId();
  await createProfile(db, { id: profileId, userId: null, name: name ?? DEFAULT_NAME }, now);
  await db.insert(boardPlayer).values({ id: playerId, profileId, createdAt: now, lastSeenAt: now }).onConflictDoNothing();
  const player = await findPlayer(db, playerId);
  // Two first uploads at once: the other one's profile won, so ours goes.
  if (player?.profileId !== profileId) await db.delete(boardProfile).where(eq(boardProfile.id, profileId));
  if (!player) throw new Error('player row missing after insert');
  return player;
}

/**
 * Signing in on this browser: its player (and every match it reported) joins the account. The account's first
 * browser lends it its anonymous profile; later browsers merge into that one, keeping the account's name and
 * picture. A player id that already belongs to another account is left alone and the browser gets a fresh id.
 */
export async function claimPlayer(db: BoardDb, playerId: string, userId: string, name: string | null, now: number): Promise<ClaimResult> {
  let current = await findPlayer(db, playerId);
  let id = playerId;
  if (current?.userId && current.userId !== userId) {
    id = newId();
    current = null;
  }
  let own = await db.select().from(boardProfile).where(eq(boardProfile.userId, userId)).get();

  if (!own && current && !current.userId) {
    try {
      await db
        .update(boardProfile)
        .set({ userId, updatedAt: now })
        .where(and(eq(boardProfile.id, current.profileId), isNull(boardProfile.userId)));
    } catch {
      // Another browser of this account got there first (user_id is unique): merge into its profile below.
    }
    own = await db.select().from(boardProfile).where(eq(boardProfile.userId, userId)).get();
  }
  if (!own) {
    await createProfile(db, { id: newId(), userId, name: name ?? DEFAULT_NAME }, now);
    own = await db.select().from(boardProfile).where(eq(boardProfile.userId, userId)).get();
    if (!own) throw new Error('account profile missing after insert');
  }

  if (!current) {
    await db
      .insert(boardPlayer)
      .values({ id, profileId: own.id, createdAt: now, lastSeenAt: now })
      .onConflictDoUpdate({ target: boardPlayer.id, set: { profileId: own.id, lastSeenAt: now } });
  } else if (current.profileId !== own.id) {
    const old = await getProfile(db, current.profileId);
    // Every profile has a portrait; an uploaded picture only the merged browser had comes along.
    const adopt = !own.avatarImage && old?.avatarImage;
    await inOrder(db, [
      db.update(boardPlayer).set({ profileId: own.id, lastSeenAt: now }).where(eq(boardPlayer.id, id)),
      db.update(boardMatch).set({ profileId: own.id }).where(eq(boardMatch.playerId, id)),
      carryUnlocks(db, current.profileId, own.id),
      ...(adopt
        ? [
            db.update(boardAvatar).set({ profileId: own.id }).where(eq(boardAvatar.profileId, old.id)),
            db.update(boardProfile).set({ avatarHero: old.avatarHero, avatarImage: old.avatarImage, updatedAt: now }).where(eq(boardProfile.id, own.id))
          ]
        : []),
      db
        .delete(boardProfile)
        .where(
          and(
            eq(boardProfile.id, current.profileId),
            isNull(boardProfile.userId),
            notExists(db.select({ one: sql`1` }).from(boardPlayer).where(eq(boardPlayer.profileId, current.profileId)))
          )
        )
    ]);
    own = (await getProfile(db, own.id)) ?? own;
  }
  return { playerId: id, profile: profileView(own) };
}

/** Name and portrait changes from the profile screen or the menu's name field. */
export async function updateProfile(db: BoardDb, player: PlayerRef, change: { name?: string; hero?: string }, now: number) {
  if (change.name) await renameProfile(db, player.profileId, change.name, now);
  if (change.hero) {
    await inOrder(db, [
      db.update(boardProfile).set({ avatarHero: change.hero, avatarImage: null, updatedAt: now }).where(eq(boardProfile.id, player.profileId)),
      db.delete(boardAvatar).where(eq(boardAvatar.profileId, player.profileId))
    ]);
  }
  const profile = await getProfile(db, player.profileId);
  if (!profile) throw new Error('profile vanished');
  return profileView(profile);
}

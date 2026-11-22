import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, getRequestHeaders } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import { db } from '~/db';
import { auth } from '~/lib/auth';
import { checkAvatar, saveAvatar } from './avatar';
import {
  BoardError,
  type AccountView,
  type ClaimResult,
  type HistoryPage,
  type LeaderboardPage,
  type LeaderboardQuery,
  type MatchReport,
  type MatchRank,
  type MatchStart,
  type MatchView,
  type ProfileView,
  type UploadResult
} from './contract';
import { countUpload } from '../achievements/store';
import { matchTally } from '../achievements/tally';
import { EMPTY_HISTORY, history, leaderboard, matchView, storeMatches } from './matches';
import { matchRank } from './rank';
import { cleanName } from './names';
import { claimPlayer, ensurePlayer, findPlayer, getProfile, profileView, updateProfile } from './players';
import { allowAll, HOUR, ipKey, MINUTE } from './rate';
import { issueTicket, openTicket } from './ticket';
import { admit, parseHistoryQuery, parseLeaderboardQuery, parseMatchQuery, parseMatchStart, parseRankQuery, parseUpload, playerId } from './validate';

// The browser's player id is its credential here; the auth session only decides which account a claim joins.

async function caller() {
  return ipKey(getRequestHeader('cf-connecting-ip') ?? getRequestHeader('x-real-ip') ?? 'unknown');
}

async function session() {
  return auth.api.getSession({ headers: getRequestHeaders() });
}

function record(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new BoardError('invalid', 'not an object');
  return raw as Record<string, unknown>;
}

/** Signs match tickets. Layerwise sets the secret on a published app; without one (local dev) a fixed key stands in. */
function ticketSecret() {
  return env.BETTER_AUTH_SECRET || (import.meta.env.DEV ? 'brickfray-dev' : '');
}

/** Called as a match starts: the ticket its report will need (see ticket.ts). */
export const startMatch = createServerFn({ method: 'POST' })
  .validator((raw: { playerId: string; mode: string; map: string; difficulty: string | null }) => parseMatchStart(raw))
  .handler(async ({ data }): Promise<MatchStart | { refused: 'rate' | 'off' }> => {
    const secret = ticketSecret();
    if (!secret) return { refused: 'off' };
    const now = Date.now();
    const ok = await allowAll(
      db,
      [
        [`start:p:${data.playerId}`, 12, 10 * MINUTE],
        [`start:p:${data.playerId}`, 40, HOUR],
        [`start:ip:${await caller()}`, 120, HOUR]
      ],
      now
    );
    if (!ok) return { refused: 'rate' };
    return issueTicket(secret, data, now);
  });

export const uploadMatches = createServerFn({ method: 'POST' })
  .validator((raw: { playerId: string; name: string; matches: MatchReport[] }) => parseUpload(raw, Date.now()))
  .handler(async ({ data }): Promise<UploadResult> => {
    const now = Date.now();
    const n = data.matches.length;
    if (!n) return { stored: [], refused: data.refused, limited: false, achievements: null };
    const ip = await caller();
    const ok = await allowAll(
      db,
      [
        [`up:p:${data.playerId}`, 20, 10 * MINUTE],
        [`up:p:${data.playerId}`, 60, HOUR],
        [`up:ip:${ip}`, 240, HOUR]
      ],
      now,
      n
    );
    if (!ok) return { stored: [], refused: data.refused, limited: true, achievements: null };
    const secret = ticketSecret();
    const admitted: MatchReport[] = [];
    const refused = [...data.refused];
    for (const report of data.matches) {
      try {
        admitted.push(admit(report, secret ? await openTicket(secret, report.ticket) : null, data.playerId, now));
      } catch (error) {
        if (!(error instanceof BoardError)) throw error;
        refused.push(report.key);
      }
    }
    if (!admitted.length) return { stored: [], refused, limited: false, achievements: null };
    const player = await ensurePlayer(db, data.playerId, data.name, now);
    const stored = await storeMatches(db, player, admitted, now);
    return { stored, refused, limited: false, achievements: await countUpload(db, player.profileId, admitted.map(matchTally), now) };
  });

export const getLeaderboard = createServerFn({ method: 'GET' })
  .validator((raw: Omit<LeaderboardQuery, 'playerId'> & { playerId: string | null }) => parseLeaderboardQuery(raw))
  .handler(async ({ data }): Promise<LeaderboardPage> => {
    const player = data.playerId ? await findPlayer(db, data.playerId) : null;
    return leaderboard(db, data, player?.profileId ?? null);
  });

/** Asked once a match is stored: where it leaves the asker on its board, for the end-of-match screen. */
export const getMatchRank = createServerFn({ method: 'GET' })
  .validator((raw: { playerId: string; key: string; mode: string }) => parseRankQuery(raw))
  .handler(async ({ data }): Promise<MatchRank | { refused: 'rate' } | null> => {
    const ok = await allowAll(
      db,
      [
        [`rank:p:${data.playerId}`, 30, 10 * MINUTE],
        [`rank:ip:${await caller()}`, 300, HOUR]
      ],
      Date.now()
    );
    if (!ok) return { refused: 'rate' };
    return matchRank(db, data.playerId, data.key, data.mode);
  });

/** The score panel of one stored match (a ranking row or one of the asker's own). */
export const getMatch = createServerFn({ method: 'GET' })
  .validator((raw: { id: number; playerId: string | null }) => parseMatchQuery(raw))
  .handler(async ({ data }): Promise<MatchView | null> => {
    const player = data.playerId ? await findPlayer(db, data.playerId) : null;
    return matchView(db, data.id, player?.profileId ?? null);
  });

export const getHistory = createServerFn({ method: 'GET' })
  .validator((raw: { playerId: string; page: number }) => parseHistoryQuery(raw))
  .handler(async ({ data }): Promise<HistoryPage> => {
    const player = await findPlayer(db, data.playerId);
    return player ? history(db, player.profileId, data.page) : EMPTY_HISTORY;
  });

export const getAccount = createServerFn({ method: 'GET' })
  .validator((raw: { playerId: string }) => ({ playerId: playerId(record(raw).playerId) }))
  .handler(async ({ data }): Promise<AccountView> => {
    const [signed, player] = await Promise.all([session(), findPlayer(db, data.playerId)]);
    const profile = player ? await getProfile(db, player.profileId) : null;
    return {
      signedIn: !!signed,
      email: signed?.user.email ?? null,
      linked: !!signed && player?.userId === signed.user.id,
      profile: profile ? profileView(profile) : null
    };
  });

/** Joins this browser's player to the signed-in account (see claimPlayer). */
export const claimAccount = createServerFn({ method: 'POST' })
  .validator((raw: { playerId: string; name: string }) => {
    const r = record(raw);
    return { playerId: playerId(r.playerId), name: cleanName(r.name) };
  })
  .handler(async ({ data }): Promise<ClaimResult | { refused: 'auth' | 'rate' }> => {
    const signed = await session();
    if (!signed) return { refused: 'auth' };
    const now = Date.now();
    if (!(await allowAll(db, [[`claim:ip:${await caller()}`, 30, HOUR]], now))) return { refused: 'rate' };
    return claimPlayer(db, data.playerId, signed.user.id, data.name, now);
  });

export const saveProfile = createServerFn({ method: 'POST' })
  .validator((raw: { playerId: string; name?: string; hero?: string }) => {
    const r = record(raw);
    const name = r.name === undefined ? undefined : cleanName(r.name);
    if (name === null) throw new BoardError('invalid', 'empty name');
    if (r.hero !== undefined && !CHARACTER_IDS.includes(r.hero as never)) throw new BoardError('invalid', 'unknown hero');
    return { playerId: playerId(r.playerId), name, hero: r.hero as string | undefined };
  })
  .handler(async ({ data }): Promise<ProfileView | { refused: 'rate' }> => {
    const now = Date.now();
    const ip = await caller();
    const ok = await allowAll(
      db,
      [
        [`profile:p:${data.playerId}`, 30, HOUR],
        [`profile:ip:${ip}`, 120, HOUR]
      ],
      now
    );
    if (!ok) return { refused: 'rate' };
    const player = await ensurePlayer(db, data.playerId, data.name ?? null, now);
    return updateProfile(db, player, { name: data.name, hero: data.hero }, now);
  });

/** A picture already cut to a small square in the browser; checked again here before it is kept. */
export const uploadAvatar = createServerFn({ method: 'POST' })
  .validator((raw: FormData) => {
    if (!(raw instanceof FormData)) throw new BoardError('invalid', 'not a form');
    return raw;
  })
  .handler(async ({ data }): Promise<ProfileView | { refused: 'rate' | 'invalid' }> => {
    const id = playerId(data.get('playerId'));
    const file = data.get('file');
    if (!(file instanceof Blob)) return { refused: 'invalid' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    let type;
    try {
      type = checkAvatar(file.type, bytes);
    } catch (error) {
      if (error instanceof BoardError) return { refused: 'invalid' };
      throw error;
    }
    const now = Date.now();
    const ip = await caller();
    const ok = await allowAll(
      db,
      [
        [`avatar:p:${id}`, 10, HOUR],
        [`avatar:ip:${ip}`, 30, HOUR]
      ],
      now
    );
    if (!ok) return { refused: 'rate' };
    const player = await ensurePlayer(db, id, null, now);
    await saveAvatar(db, player, type, bytes, now);
    const profile = await getProfile(db, player.profileId);
    if (!profile) throw new Error('profile vanished');
    return profileView(profile);
  });

import { lt, sql } from 'drizzle-orm';
import { boardRate } from '~/db/schema';
import type { BoardDb } from './db';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Counts `amount` against `key` in a fixed window; false once the window has had more than `limit`. */
export async function allow(db: BoardDb, key: string, limit: number, windowMs: number, now: number, amount = 1): Promise<boolean> {
  const window = Math.floor(now / windowMs) * windowMs;
  const [row] = await db
    .insert(boardRate)
    .values({ key: `${key}@${windowMs}`, window, count: amount })
    .onConflictDoUpdate({ target: [boardRate.key, boardRate.window], set: { count: sql`${boardRate.count} + ${amount}` } })
    .returning({ count: boardRate.count });
  // Old windows go now and then rather than on every call.
  if (Math.random() < 0.02) await db.delete(boardRate).where(lt(boardRate.window, now - 2 * 24 * HOUR));
  return (row?.count ?? 0) <= limit;
}

/** Every limit must pass; each one is counted even when an earlier one already failed. */
export async function allowAll(db: BoardDb, limits: [key: string, limit: number, windowMs: number][], now: number, amount = 1) {
  let ok = true;
  for (const [key, limit, windowMs] of limits) if (!(await allow(db, key, limit, windowMs, now, amount))) ok = false;
  return ok;
}

/** The address as a short hash: enough to count requests, nothing to keep. */
export async function ipKey(ip: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`brickfray:${ip}`));
  return [...new Uint8Array(digest).slice(0, 10)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

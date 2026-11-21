import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core';

/** D1 in the Worker, node:sqlite in tests: the board code takes either. */
export type BoardDb = SQLiteAsyncDatabase<'sync' | 'async', any, any>;

type Runnable = PromiseLike<unknown>;

/** Runs the statements in order, as one transaction where the driver can (D1 batches). */
export async function inOrder(db: BoardDb, statements: Runnable[]) {
  const batch = (db as { batch?: (items: Runnable[]) => Promise<unknown> }).batch;
  if (batch && statements.length > 1) {
    await batch.call(db, statements);
    return;
  }
  for (const statement of statements) await statement;
}

/** 128 random bits, URL-safe: ids nobody can guess. */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

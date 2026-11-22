import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import type { MatchReport } from './contract';
import type { BoardDb } from './db';

/** A fresh in-memory database with every migration applied, foreign keys on like D1. */
export async function testDb(): Promise<BoardDb> {
  const client = new DatabaseSync(':memory:');
  client.exec('PRAGMA foreign_keys = ON');
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}

let serial = 0;

export function report(over: Partial<MatchReport> = {}): MatchReport {
  serial++;
  return {
    key: `match-${String(serial).padStart(4, '0')}`,
    ticket: null,
    mode: 'ffa',
    map: 'plaza',
    difficulty: null,
    wave: 0,
    character: 'rivet',
    endedAt: 1_800_000_000_000,
    durationS: 600,
    score: 1200,
    kills: 10,
    deaths: 4,
    assists: 2,
    headshots: 3,
    placement: 1,
    players: 6,
    result: 'win',
    detail: null,
    ...over
  };
}

export function soloReport(over: Partial<MatchReport> = {}): MatchReport {
  return report({ mode: 'solo', difficulty: 'normal', wave: 5, result: null, players: 1, placement: 1, deaths: 1, ...over });
}

import { sql } from 'drizzle-orm';
import type { MatchDetail } from '../board/contract';
import { inOrder, type BoardDb } from '../board/db';
import { ACHIEVEMENTS, isAchievementId, progressOf, statsOf, STAT_KEYS, TIER_COUNT, tiersReached, type StatKey, type Totals } from './catalogue';
import type { AchievementNews, AchievementsPage, NextTier, Unlock } from './contract';
import { isBest, matchTally, movedStats, type MatchTally, type TallySource } from './tally';

// Achievement totals live per player in board_stat; a profile's are the sum over its players, so an account that
// gathers browsers gathers their totals with no copying. Only stored matches move them, each exactly once (settle).

interface OldRow extends Omit<TallySource, 'detail' | 'feats'> {
  id: number;
  detail: string | null;
}

/**
 * Adds every match of the profile not counted yet to its player's totals and marks it counted, in one transaction
 * (D1 batch), so a match counts once however often it is uploaded and a request cut short leaves nothing half done.
 * Matches stored before achievements get their tally first, from the columns they have.
 */
export async function settle(db: BoardDb, profileId: string) {
  const old = await db.all<OldRow>(sql`
    SELECT id, mode, difficulty, wave, character, kills, deaths, assists, headshots, result, detail
    FROM board_match WHERE profile_id = ${profileId} AND counted = 0 AND tally IS NULL`);
  const tallies = Object.fromEntries(old.map((r) => [r.id, matchTally({ ...r, detail: r.detail ? (JSON.parse(r.detail) as MatchDetail) : null, feats: null })]));
  const fill = old.length
    ? [db.run(sql`UPDATE board_match SET tally = json_extract(${JSON.stringify(tallies)}, '$."' || id || '"')
        WHERE profile_id = ${profileId} AND counted = 0 AND tally IS NULL AND id IN (SELECT value FROM json_each(${JSON.stringify(old.map((r) => r.id))}))`)]
    : [];
  const pending = sql`m.profile_id = ${profileId} AND m.counted = 0 AND m.tally IS NOT NULL`;
  await inOrder(db, [
    ...fill,
    db.run(sql`
      INSERT INTO board_stat (player_id, stat, value)
      SELECT m.player_id, j.key, SUM(j.value) FROM board_match m, json_each(m.tally, '$.sum') j
      WHERE ${pending} GROUP BY m.player_id, j.key
      ON CONFLICT (player_id, stat) DO UPDATE SET value = board_stat.value + excluded.value`),
    db.run(sql`
      INSERT INTO board_stat (player_id, stat, value)
      SELECT m.player_id, j.key, MAX(j.value) FROM board_match m, json_each(m.tally, '$.best') j
      WHERE ${pending} GROUP BY m.player_id, j.key
      ON CONFLICT (player_id, stat) DO UPDATE SET value = MAX(board_stat.value, excluded.value)`),
    db.run(sql`UPDATE board_match AS m SET counted = 1 WHERE ${pending}`)
  ]);
}

const KNOWN = new Set<string>(STAT_KEYS);

/** The profile's totals over all its players: sums add, bests keep the highest. */
export async function profileTotals(db: BoardDb, profileId: string): Promise<Totals> {
  const rows = await db.all<{ stat: string; total: number; top: number }>(sql`
    SELECT s.stat, SUM(s.value) AS total, MAX(s.value) AS top
    FROM board_stat s JOIN board_player p ON p.id = s.player_id
    WHERE p.profile_id = ${profileId} GROUP BY s.stat`);
  const totals: Totals = {};
  for (const r of rows) if (KNOWN.has(r.stat)) totals[r.stat as StatKey] = isBest(r.stat) ? r.top : r.total;
  return totals;
}

function reachedTiers(totals: Totals): [string, number][] {
  const out: [string, number][] = [];
  for (const def of ACHIEVEMENTS) for (let tier = 1; tier <= tiersReached(def, progressOf(def, totals)); tier++) out.push([def.id, tier]);
  return out;
}

const ORDER = new Map<string, number>(ACHIEVEMENTS.map((a, i) => [a.id, i]));

/** Records every tier the totals reach and the profile has not got yet; returns those, dated now. */
export async function unlockReached(db: BoardDb, profileId: string, totals: Totals, now: number): Promise<Unlock[]> {
  const reached = reachedTiers(totals);
  if (!reached.length) return [];
  // One statement whatever the count: D1 caps the bound values of a statement, so the pairs travel as one JSON value.
  const rows = await db.all<{ achievement: string; tier: number; unlocked_at: number }>(sql`
    INSERT INTO board_unlock (profile_id, achievement, tier, unlocked_at)
    SELECT ${profileId}, json_extract(value, '$[0]'), json_extract(value, '$[1]'), ${now} FROM json_each(${JSON.stringify(reached)}) WHERE true
    ON CONFLICT DO NOTHING
    RETURNING achievement, tier, unlocked_at`);
  return rows
    .filter((r) => isAchievementId(r.achievement))
    .map((r) => ({ id: r.achievement as Unlock['id'], tier: r.tier, at: r.unlocked_at }))
    .sort((a, b) => ORDER.get(a.id)! - ORDER.get(b.id)! || a.tier - b.tier);
}

/** The nearest unfinished goals among the achievements the moved stats feed, nearest first. */
export function nextTiers(totals: Totals, moved: Set<StatKey>, limit = 3): NextTier[] {
  const out: NextTier[] = [];
  for (const def of ACHIEVEMENTS) {
    if (!statsOf(def).some((s) => moved.has(s))) continue;
    const value = progressOf(def, totals);
    const done = tiersReached(def, value);
    if (done >= def.tiers.length) continue;
    out.push({ id: def.id, tier: done + 1, value, goal: def.tiers[done]! });
  }
  return out.sort((a, b) => b.value / b.goal - a.value / a.goal).slice(0, limit);
}

/** After an upload stored matches: count them, record what they unlocked, and say what is next. */
export async function countUpload(db: BoardDb, profileId: string, tallies: readonly MatchTally[], now: number): Promise<AchievementNews> {
  await settle(db, profileId);
  const totals = await profileTotals(db, profileId);
  const unlocks = await unlockReached(db, profileId, totals, now);
  return { unlocks, next: nextTiers(totals, movedStats(tallies)) };
}

/** Every achievement with the profile's progress and unlock dates. */
export async function achievementsPage(db: BoardDb, profileId: string | null, now: number): Promise<AchievementsPage> {
  let totals: Totals = {};
  const dates = new Map<string, number>();
  if (profileId) {
    await settle(db, profileId);
    totals = await profileTotals(db, profileId);
    await unlockReached(db, profileId, totals, now);
    const rows = await db.all<{ achievement: string; tier: number; unlocked_at: number }>(sql`
      SELECT achievement, tier, unlocked_at FROM board_unlock WHERE profile_id = ${profileId}`);
    for (const r of rows) dates.set(`${r.achievement}:${r.tier}`, r.unlocked_at);
  }
  const items = ACHIEVEMENTS.map((def) => ({
    id: def.id,
    value: progressOf(def, totals),
    unlocked: def.tiers.map((_, i) => dates.get(`${def.id}:${i + 1}`) ?? null)
  }));
  return { items, unlocked: items.reduce((n, a) => n + a.unlocked.filter((d) => d !== null).length, 0), total: TIER_COUNT };
}

/** A browser's profile folding into an account's: its unlock dates come along, the earlier date winning. */
export function carryUnlocks(db: BoardDb, from: string, to: string) {
  return db.run(sql`
    INSERT INTO board_unlock (profile_id, achievement, tier, unlocked_at)
    SELECT ${to}, achievement, tier, unlocked_at FROM board_unlock WHERE profile_id = ${from}
    ON CONFLICT DO UPDATE SET unlocked_at = MIN(board_unlock.unlocked_at, excluded.unlocked_at)`);
}

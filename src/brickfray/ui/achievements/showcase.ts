import type { AchievementId } from '../../../lib/achievements/catalogue';
import type { Unlock } from '../../../lib/achievements/contract';

/** The chain each streak achievement counts. */
export const CHAINS: Partial<Record<AchievementId, number>> = { double: 2, triple: 3, quad: 4, penta: 5, hexa: 6 };

/** Which unlock leads when several come at once: the rarest feats first, the plain counters last. */
export const SHOWCASE: readonly AchievementId[] = [
  'hexa', 'penta', 'quad', 'triple', 'double', 'flawless', 'rosterWins', 'roster', 'waveHard', 'waveNormal', 'waveEasy',
  'megabot', 'winTdm', 'winFfa', 'bounty', 'longshot', 'airborne', 'melee', 'grenade', 'sidearm', 'medals', 'headshots',
  'kills', 'assists', 'matches'
];

/**
 * The highest new tier of each achievement an upload unlocked, rarest first. `shown` of them lead, leaving out a shorter
 * chain when a longer one came with it (a hexa kill made the double too); the rest only count towards "+N".
 */
export function newTiers(unlocks: readonly Unlock[], shown = Infinity): { lead: Unlock[]; rest: number } {
  const top = new Map<AchievementId, Unlock>();
  for (const u of unlocks) if ((top.get(u.id)?.tier ?? 0) < u.tier) top.set(u.id, u);
  const all = SHOWCASE.flatMap((id) => top.get(id) ?? []);
  const chain = all.find((u) => CHAINS[u.id]);
  const lead = all.filter((u) => !CHAINS[u.id] || u === chain).slice(0, shown);
  return { lead, rest: all.length - lead.length };
}

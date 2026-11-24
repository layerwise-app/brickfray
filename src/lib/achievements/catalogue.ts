import { CHARACTER_IDS } from '~/brickfray/characters/roster';
import type { CharacterId } from '~/brickfray/characters/types';
import { SOLO_LEVELS, type SoloLevel } from '../board/contract';

// Every achievement, as data. Unlocks are stored by id and tier number, so ids never change and tiers are only ever
// appended. A retired id or stat keeps its stored rows, which reads skip ('hexa' and 'chain6', for chains of six):
// never reuse one. Names, descriptions and art live in the UI (ui/achievements), keyed by id.

export const CATEGORIES = ['combat', 'weapons', 'streaks', 'matches', 'solo', 'heroes'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Totals that only add up, per player. */
export const SUM_STATS = [
  'matches',
  'kills',
  'assists',
  'headshots',
  'sidearm',
  'melee',
  'grenade',
  'longshot',
  'airborne',
  'bounty',
  'megabot',
  'chain2',
  'chain3',
  'chain4',
  'chain5',
  'winFfa',
  'winTdm',
  'flawless',
  'medals'
] as const;
export type SumStat = (typeof SUM_STATS)[number] | `play.${CharacterId}` | `win.${CharacterId}`;
/** Totals that keep the highest value seen ("best."), per player. */
export type BestStat = `best.wave.${SoloLevel}`;
export type StatKey = SumStat | BestStat;

export const BEST_PREFIX = 'best.';
export const STAT_KEYS: readonly StatKey[] = [
  ...SUM_STATS,
  ...CHARACTER_IDS.map((id) => `play.${id}` as const),
  ...CHARACTER_IDS.map((id) => `win.${id}` as const),
  ...SOLO_LEVELS.map((level) => `best.wave.${level}` as const)
];

/** What an achievement counts: one total, or how many characters have a total of at least one. */
export type Source = { stat: StatKey } | { roster: 'play' | 'win' };

export interface AchievementDef {
  id: string;
  category: Category;
  source: Source;
  /** Goals in rising order; reaching one unlocks that tier (tier 1 is the first goal). */
  tiers: readonly number[];
}

const BIG = [10, 50, 100, 500, 1000, 5000, 10000] as const;
const WAVES = [5, 10, 15, 20] as const;

export const ACHIEVEMENTS = [
  { id: 'kills', category: 'combat', source: { stat: 'kills' }, tiers: BIG },
  { id: 'assists', category: 'combat', source: { stat: 'assists' }, tiers: BIG },
  { id: 'headshots', category: 'combat', source: { stat: 'headshots' }, tiers: BIG },
  { id: 'sidearm', category: 'weapons', source: { stat: 'sidearm' }, tiers: [10, 50, 100, 500, 1000, 5000] },
  { id: 'melee', category: 'weapons', source: { stat: 'melee' }, tiers: [1, 10, 50, 100, 500, 1000] },
  { id: 'grenade', category: 'weapons', source: { stat: 'grenade' }, tiers: [1, 10, 50, 100, 500, 1000] },
  { id: 'longshot', category: 'weapons', source: { stat: 'longshot' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'airborne', category: 'weapons', source: { stat: 'airborne' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'double', category: 'streaks', source: { stat: 'chain2' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'triple', category: 'streaks', source: { stat: 'chain3' }, tiers: [1, 10, 50, 100] },
  { id: 'quad', category: 'streaks', source: { stat: 'chain4' }, tiers: [1, 5, 25, 100] },
  { id: 'penta', category: 'streaks', source: { stat: 'chain5' }, tiers: [1, 5, 25] },

  { id: 'bounty', category: 'streaks', source: { stat: 'bounty' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'matches', category: 'matches', source: { stat: 'matches' }, tiers: [1, 10, 50, 100, 500, 1000] },
  { id: 'winFfa', category: 'matches', source: { stat: 'winFfa' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'winTdm', category: 'matches', source: { stat: 'winTdm' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'flawless', category: 'matches', source: { stat: 'flawless' }, tiers: [1, 5, 25] },
  { id: 'medals', category: 'matches', source: { stat: 'medals' }, tiers: [1, 10, 50, 100, 500, 1000] },
  { id: 'waveEasy', category: 'solo', source: { stat: 'best.wave.easy' }, tiers: WAVES },
  { id: 'waveNormal', category: 'solo', source: { stat: 'best.wave.normal' }, tiers: WAVES },
  { id: 'waveHard', category: 'solo', source: { stat: 'best.wave.hard' }, tiers: WAVES },
  { id: 'megabot', category: 'solo', source: { stat: 'megabot' }, tiers: [1, 10, 50, 100, 500] },
  { id: 'roster', category: 'heroes', source: { roster: 'play' }, tiers: [CHARACTER_IDS.length] },
  { id: 'rosterWins', category: 'heroes', source: { roster: 'win' }, tiers: [CHARACTER_IDS.length] }
] as const satisfies readonly AchievementDef[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];
export const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map((a) => a.id);
export const TIER_COUNT = ACHIEVEMENTS.reduce((sum, a) => sum + a.tiers.length, 0);

const BY_ID = new Map<string, AchievementDef>(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievement(id: AchievementId): AchievementDef {
  return BY_ID.get(id)!;
}

export function isAchievementId(id: unknown): id is AchievementId {
  return typeof id === 'string' && BY_ID.has(id);
}

export type Totals = Partial<Record<StatKey, number>>;

/** Where an achievement stands for these totals. */
export function progressOf(def: AchievementDef, totals: Totals): number {
  const source = def.source;
  if ('stat' in source) return totals[source.stat] ?? 0;
  return CHARACTER_IDS.filter((id) => (totals[`${source.roster}.${id}`] ?? 0) > 0).length;
}

/** How many of its tiers a value reaches. */
export function tiersReached(def: AchievementDef, value: number) {
  let n = 0;
  while (n < def.tiers.length && value >= def.tiers[n]!) n++;
  return n;
}

/** The stats an achievement reads: a batch that moved none of them cannot have moved it. */
export function statsOf(def: AchievementDef): StatKey[] {
  const source = def.source;
  return 'stat' in source ? [source.stat] : CHARACTER_IDS.map((id) => `${source.roster}.${id}` as const);
}

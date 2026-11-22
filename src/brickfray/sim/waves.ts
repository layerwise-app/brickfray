import type { BotKind } from '../characters/types';
import type { Difficulty } from './types';

// The size and pace of solo waves. Pure numbers: the match runs them and the leaderboard checks reports against them.

/** Seconds from the upgrade pick (or a wave with nothing left to pick) to the next wave. */
export const WAVE_BREAK = 5;

/**
 * What a wave is about, for its banner: the first Zipbots and Scopebots, a Zipbot rush, a Scopebot nest, a Snapbot
 * horde, a mixed assault, and the Megabot waves (alone with Snapbots, with a Zipbot escort, two at once).
 */
export const WAVE_THEMES = ['opening', 'zipbots', 'scopebots', 'rush', 'boss', 'assault', 'nest', 'horde', 'bossEscort', 'bossPair'] as const;
export type WaveTheme = (typeof WAVE_THEMES)[number];

/** A wave at normal: how many of each kind, and how much faster than usual they come (swarms). */
interface WaveDef {
  theme: WaveTheme;
  grunt?: number;
  rusher?: number;
  sniper?: number;
  boss?: number;
  /** Multiplies the time between spawns. */
  pace?: number;
  /** Extra snapbots allowed on the field at once. */
  crowd?: number;
}

/** Something new every two or three waves up to 12; after it the late cycle repeats, growing. */
const TABLE: readonly WaveDef[] = [
  { theme: 'opening', grunt: 4 },
  { theme: 'zipbots', grunt: 3, rusher: 2 },
  { theme: 'scopebots', grunt: 4, rusher: 1, sniper: 1 },
  { theme: 'rush', grunt: 1, rusher: 7, pace: 0.6, crowd: 2 },
  { theme: 'boss', grunt: 2, boss: 1 },
  { theme: 'assault', grunt: 4, rusher: 3, sniper: 2 },
  { theme: 'nest', grunt: 3, sniper: 5 },
  { theme: 'horde', grunt: 10, pace: 0.75 },
  { theme: 'assault', grunt: 5, rusher: 4, sniper: 3 },
  { theme: 'bossEscort', rusher: 5, boss: 1, crowd: 1 },
  { theme: 'rush', grunt: 2, rusher: 10, pace: 0.6, crowd: 2 },
  { theme: 'bossPair', grunt: 2, sniper: 3, boss: 2 }
];

/** From wave 13: a cycle of five whose bosses land on every fifth wave, each pass bigger. */
const CYCLE: readonly WaveDef[] = [
  { theme: 'assault', grunt: 5, rusher: 4, sniper: 3 },
  { theme: 'rush', grunt: 2, rusher: 10, pace: 0.6, crowd: 2 },
  { theme: 'bossPair', grunt: 3, rusher: 3, boss: 2 },
  { theme: 'nest', grunt: 5, sniper: 6 },
  { theme: 'horde', grunt: 12, pace: 0.75 }
];

interface Ramp {
  /** [wave 1, added per wave, cap] */
  skill: [number, number, number];
  /** Seconds the bots' aim trails a moving target: [wave 1, taken off per wave, floor]. */
  lag: [number, number, number];
  damage: [number, number, number];
  /** Wave sizes as a share of the table's (normal). */
  size: number;
  /** [wave 1, added per wave, cap] snapbots on the field at once. */
  alive: [number, number, number];
  /** Share of max health restored between waves; below 1 regeneration also waits until the next wave is under way. */
  heal: number;
  bossHealth: number;
  /** Share added to bot damage per wave past LATE. */
  late: number;
}

const RAMP: Record<Difficulty, Ramp> = {
  easy: { skill: [0.05, 0.03, 0.5], lag: [0.3, 0.012, 0.16], damage: [0.36, 0.02, 0.55], size: 0.85, alive: [2, 0.35, 5], heal: 1, bossHealth: 600, late: 0.1 },
  normal: { skill: [0.15, 0.04, 0.8], lag: [0.22, 0.012, 0.08], damage: [0.37, 0.025, 0.7], size: 1.15, alive: [2, 0.5, 6], heal: 1, bossHealth: 750, late: 0.07 },
  hard: { skill: [0.3, 0.05, 1], lag: [0.16, 0.012, 0.03], damage: [0.5, 0.03, 0.92], size: 1.4, alive: [2, 0.6, 8], heal: 0.5, bossHealth: 800, late: 0.07 }
};

/** From this wave on, aim and damage keep climbing past their caps, so even a fully upgraded run comes to an end. */
const LATE = 12;

function waveDef(wave: number): { def: WaveDef; growth: number } {
  if (wave <= TABLE.length) return { def: TABLE[wave - 1]!, growth: 1 };
  const k = wave - TABLE.length - 1;
  return { def: CYCLE[k % CYCLE.length]!, growth: 1 + 0.15 * Math.floor(k / CYCLE.length + 1) };
}

/** How hard a solo wave is: bot aim, bot damage to the player, how many fight at once and how fast they come. */
export function waveTuning(difficulty: Difficulty, wave: number) {
  const r = RAMP[difficulty];
  const { def } = waveDef(wave);
  const step = wave - 1;
  const late = Math.max(0, wave - LATE);
  const roster = waveRoster(difficulty, wave);
  return {
    theme: def.theme,
    skill: Math.min(1, Math.min(r.skill[2], r.skill[0] + r.skill[1] * step) + 0.02 * late),
    lag: Math.max(r.lag[2], r.lag[0] - r.lag[1] * step),
    damage: Math.min(r.damage[2], r.damage[0] + r.damage[1] * step) * (1 + r.late * late),
    count: roster.length,
    alive: Math.min(r.alive[2], r.alive[0] + Math.floor(r.alive[1] * step)) + (def.crowd ?? 0),
    spawnEvery: Math.max(0.5, 1.4 - 0.06 * step) * (def.pace ?? 1),
    heal: r.heal,
    bossHealth: r.bossHealth
  };
}

/** The snapbots of a wave in the order they come: kinds spread evenly through it, a boss a third of the way in. */
export function waveRoster(difficulty: Difficulty, wave: number): BotKind[] {
  const { def, growth } = waveDef(wave);
  const size = RAMP[difficulty].size * growth;
  const scaled = (n = 0) => (n ? Math.max(1, Math.round(n * size)) : 0);
  const counts: [BotKind, number][] = [
    ['grunt', scaled(def.grunt)],
    ['rusher', scaled(def.rusher)],
    ['sniper', scaled(def.sniper)]
  ];
  const total = counts.reduce((s, [, n]) => s + n, 0);
  const placed = new Map<BotKind, number>();
  const out: BotKind[] = [];
  for (let i = 0; i < total; i++) {
    let best: BotKind = 'grunt';
    let lack = -Infinity;
    for (const [kind, n] of counts) {
      const due = (n * (i + 1)) / total - (placed.get(kind) ?? 0);
      if (n > (placed.get(kind) ?? 0) && due > lack) {
        lack = due;
        best = kind;
      }
    }
    placed.set(best, (placed.get(best) ?? 0) + 1);
    out.push(best);
  }
  const bosses = def.boss ? def.boss + Math.floor((growth - 1) / 0.3) : 0;
  for (let i = 0; i < bosses; i++) out.splice(Math.floor(((i + 1) * out.length) / (bosses + 2)) + i, 0, 'boss');
  return out;
}

/** Snapbots a run has met once it is in `wave`: every wave up to and including it. */
export function botsThrough(difficulty: Difficulty, wave: number) {
  let total = 0;
  for (let i = 1; i <= wave; i++) total += waveRoster(difficulty, i).length;
  return total;
}

/** The least seconds of play before `wave` can start: each earlier wave has to spawn its bots, then take its break. */
export function secondsToReach(difficulty: Difficulty, wave: number) {
  let total = 0;
  for (let i = 1; i < wave; i++) {
    const t = waveTuning(difficulty, i);
    total += (t.count - 1) * t.spawnEvery + WAVE_BREAK;
  }
  return total;
}

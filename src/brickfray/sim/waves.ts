import type { Difficulty } from './types';

// The size and pace of solo waves. Pure numbers: the match runs them and the leaderboard checks reports against them.

/** Seconds from the upgrade pick (or a wave with nothing left to pick) to the next wave. */
export const WAVE_BREAK = 5;

interface Ramp {
  /** [wave 1, added per wave, cap] */
  skill: [number, number, number];
  damage: [number, number, number];
  /** [base, added per wave] */
  count: [number, number];
  /** [wave 1, added per wave, cap] snapbots on the field at once. */
  alive: [number, number, number];
  /** Share of max health restored between waves. */
  heal: number;
}

// Wave 1 is as it always was; the climb after it is gentler so the upgrades taken between waves can keep up.
const RAMP: Record<Difficulty, Ramp> = {
  easy: { skill: [0.05, 0.04, 0.6], damage: [0.2, 0.02, 0.45], count: [2, 1.2], alive: [2, 0.5, 6], heal: 1 },
  normal: { skill: [0.18, 0.05, 0.9], damage: [0.3, 0.03, 0.65], count: [3, 1.6], alive: [3, 0.6, 8], heal: 1 },
  hard: { skill: [0.4, 0.06, 1], damage: [0.45, 0.04, 0.9], count: [4, 2.2], alive: [4, 0.7, 10], heal: 0.5 }
};

/** From this wave on, aim and damage keep climbing past their caps, so even a fully upgraded run comes to an end. */
const LATE = 10;

/** How hard a solo wave is: bot aim, bot damage to the player, wave size and how many fight at once. */
export function waveTuning(difficulty: Difficulty, wave: number) {
  const r = RAMP[difficulty];
  const step = wave - 1;
  const late = Math.max(0, wave - LATE);
  return {
    skill: Math.min(1, Math.min(r.skill[2], r.skill[0] + r.skill[1] * step) + 0.02 * late),
    damage: Math.min(r.damage[2], r.damage[0] + r.damage[1] * step) * (1 + 0.05 * late),
    count: Math.floor(r.count[0] + r.count[1] * wave),
    alive: Math.min(r.alive[2], r.alive[0] + Math.floor(r.alive[1] * step)),
    spawnEvery: Math.max(0.5, 1.4 - 0.08 * step),
    heal: r.heal
  };
}

/** Every fifth wave adds bosses on top of its count: one at wave 5, two at wave 10… */
export function waveBosses(wave: number) {
  return wave % 5 === 0 ? wave / 5 : 0;
}

/** Snapbots a run has met once it is in `wave`: every wave up to and including it. */
export function botsThrough(difficulty: Difficulty, wave: number) {
  let total = 0;
  for (let i = 1; i <= wave; i++) total += waveTuning(difficulty, i).count + waveBosses(i);
  return total;
}

/** The least seconds of play before `wave` can start: each earlier wave has to spawn its bots, then take its break. */
export function secondsToReach(difficulty: Difficulty, wave: number) {
  let total = 0;
  for (let i = 1; i < wave; i++) {
    const t = waveTuning(difficulty, i);
    total += (t.count + waveBosses(i) - 1) * t.spawnEvery + WAVE_BREAK;
  }
  return total;
}

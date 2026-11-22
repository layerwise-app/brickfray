import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponId } from '../weapons/defs';
import type { PlayerState } from './types';

/** Bots lob grenades at targets up to this far (m): a grenade is for a fight, not for sniping. */
export const THROW_REACH = 20;
/** About how far (m) a thrown grenade skids on after it first comes down. */
export const ROLL = 3.5;
/** A Megabot takes this long (s) between blasts: each one is a beat the player can answer. */
export const BOSS_VOLLEY = 1.4;

const PROFILE = {
  grunt: { reaction: 0.42, turn: 4.2, error: 0.08, range: 34, keep: 14 },
  rusher: { reaction: 0.3, turn: 6.5, error: 0.1, range: 24, keep: 2 },
  sniper: { reaction: 0.65, turn: 2.6, error: 0.035, range: 70, keep: 30 },
  boss: { reaction: 0.35, turn: 3.2, error: 0.06, range: 22, keep: 8 }
};

/** Fill bots play their character's primary: how far they engage and the distance they hold. */
const ENGAGE: Record<WeaponId, { range: number; keep: number }> = {
  ar: { range: 34, keep: 14 },
  shotgun: { range: 24, keep: 5 },
  sniper: { range: 70, keep: 30 },
  pistol: { range: 26, keep: 10 },
  nailer: { range: 26, keep: 8 },
  pulse: { range: 45, keep: 18 },
  harpoon: { range: 55, keep: 24 },
  cannon: { range: 30, keep: 12 },
  buzzer: { range: 20, keep: 6 }
};

/** How a bot reacts, turns, misses and spaces itself: by snapbot kind, or a fill bot's character's primary. */
export function botProfile(bot: PlayerState) {
  const base = PROFILE[bot.bot ?? 'grunt'];
  return bot.character !== bot.bot ? { ...base, ...ENGAGE[LOADOUTS[bot.character].primary] } : base;
}

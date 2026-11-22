import { LOADOUTS } from '../weapons/loadouts';
import type { WeaponId } from '../weapons/defs';
import type { PlayerState } from './types';

/** Bots lob grenades at targets up to this far (m): a grenade is for a fight, not for sniping. */
export const THROW_REACH = 20;
/** About how far (m) a thrown grenade skids on after it first comes down. */
export const ROLL = 3.5;
/** A Megabot takes this long (s) between blasts: each one is a beat the player can answer. */
export const BOSS_VOLLEY = 1.4;

/** Distances (m) a bot fights from: it closes beyond `max`, backs off inside `min`, holds and strafes between. */
export interface Band {
  min: number;
  max: number;
}

export interface BotProfile {
  reaction: number;
  turn: number;
  error: number;
  /** How far it notices and engages an enemy (m). */
  range: number;
  band: Band;
  /** Out of sight it heads for a waypoint inside its band with a line to the enemy; snapbots walk straight at the player. */
  standoff: boolean;
  /** A gun where a miss costs a reload (scoped, one heavy shot): fire only aimed down the sights with the body under the crosshair. */
  patient?: boolean;
}

/**
 * Snapbots. The solo waves' skill ramp (waves.ts) is balanced on these reaction times: a slower reaction offsets a bot
 * that holds its aim through a moment out of sight and reloads after a throw, so they sit above the fill bots' `FILL`.
 */
const PROFILE: Record<NonNullable<PlayerState['bot']>, BotProfile> = {
  grunt: { reaction: 0.55, turn: 4.2, error: 0.08, range: 34, band: { min: 11, max: 17 }, standoff: false },
  rusher: { reaction: 0.39, turn: 6.5, error: 0.1, range: 24, band: { min: 0, max: 5 }, standoff: false },
  sniper: { reaction: 0.85, turn: 2.6, error: 0.035, range: 70, band: { min: 27, max: 33 }, standoff: false },
  boss: { reaction: 0.46, turn: 3.2, error: 0.06, range: 22, band: { min: 5, max: 11 }, standoff: false }
};

/** Fill bots' reaction and aim; their range and spacing come from their character's primary. */
const FILL = { reaction: 0.42, turn: 4.2, error: 0.08 };

/**
 * Fill bots play their character's primary at its good range: long guns hold far back, rifles stop at mid range,
 * close-range guns walk in.
 */
const ENGAGE: Record<WeaponId, { range: number; band: Band; patient?: boolean }> = {
  ar: { range: 34, band: { min: 12, max: 26 } },
  shotgun: { range: 24, band: { min: 0, max: 7 } },
  sniper: { range: 70, band: { min: 22, max: 55 }, patient: true },
  pistol: { range: 26, band: { min: 6, max: 16 } },
  nailer: { range: 26, band: { min: 6, max: 16 } },
  pulse: { range: 45, band: { min: 14, max: 32 } },
  harpoon: { range: 55, band: { min: 18, max: 42 }, patient: true },
  cannon: { range: 30, band: { min: 0, max: 10 } },
  buzzer: { range: 20, band: { min: 0, max: 7 } }
};

/** How a bot reacts, turns, misses and spaces itself: by snapbot kind, or a fill bot's character's primary. */
export function botProfile(bot: PlayerState): BotProfile {
  return bot.character !== bot.bot ? { ...FILL, ...ENGAGE[LOADOUTS[bot.character].primary], standoff: true } : PROFILE[bot.bot ?? 'grunt'];
}

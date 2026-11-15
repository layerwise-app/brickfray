/**
 * Game-session tunables: free-for-all rules, idle limits, the solo wave roster and modifiers, and the
 * katana focus mode. Pure data, so every session module can import it without pulling in systems.
 */
import type { t } from './core/i18n';
import type { EnemyManager } from './entities/enemies';

/** A key of the translation table. */
export type TranslationKey = Parameters<typeof t>[0];
/** An enemy type name the enemy manager can spawn. */
export type EnemyKind = Parameters<EnemyManager['spawn']>[0];

// ---------------- free for all ----------------
/** Kills that win a match. */
export const FFA_TARGET = 20;
/** Match length in seconds. */
export const FFA_TIME = 600;
/** Seconds before a dead player may respawn. */
export const RESPAWN = 2.5;
/** Longest player name, in characters. */
export const NAME_MAX = 14;
/** Tracer thickness drawn for other players' shots, per weapon kind. */
export const TRACER_THICK: Readonly<Record<string, number>> = { rifle: 0.02, shotgun: 0.014, sniper: 0.03 };

// ---------------- idle players ----------------
/** Seconds without input before a player's snapshots carry the idle flag. */
export const IDLE_FLAG = 30;
/** Idle seconds before a player is dropped from a running match. */
export const IDLE_MATCH = 150;
/** Idle seconds before a player is dropped from a lobby. */
export const IDLE_LOBBY = 300;
/** How many seconds before the limit the "still there?" warning shows. */
export const IDLE_WARN = 20;

// ---------------- solo waves ----------------
export interface RosterEntry {
  type: EnemyKind;
  /** First wave this type appears in. */
  from: number;
  /** Base pick weight. */
  weight: number;
}

export const ROSTER: readonly RosterEntry[] = [
  { type: 'grunt', from: 1, weight: 10 },
  { type: 'rusher', from: 2, weight: 6 },
  { type: 'bomber', from: 3, weight: 3 },
  { type: 'sniper', from: 3, weight: 4 },
  { type: 'flyer', from: 4, weight: 4 },
  { type: 'heavy', from: 5, weight: 4 },
  { type: 'shield', from: 6, weight: 4 },
];

export interface WaveModifier {
  key: 'none' | 'caffeine' | 'heavy' | 'swarm';
  /** Banner text; null for the plain wave. */
  label: TranslationKey | null;
  speed: number;
  damage: number;
}

/** Wave modifiers, in the order they unlock. */
export const MODIFIERS: readonly WaveModifier[] = [
  { key: 'none', label: null, speed: 1, damage: 1 },
  { key: 'caffeine', label: 'modifierCaffeine', speed: 1.35, damage: 0.85 },
  { key: 'heavy', label: 'modifierHeavy', speed: 0.9, damage: 1.4 },
  { key: 'swarm', label: 'modifierSwarm', speed: 1.15, damage: 0.9 },
];

/** Seconds of rest between waves. */
export const INTERMISSION = 8;

// ---------------- focus slash (solo only) ----------------
export const FOCUS_TIME = 2.6;
export const FOCUS_SCALE = 0.26;
export const FOCUS_RANGE = 24;
export const FOCUS_MAX_CHAIN = 2;
export const FOCUS_ARM = 0.18;
export const DASH_SPEED = 46;
/** Katana kills in a row that charge a focus slash. */
export const KATANA_CHARGE_KILLS = 3;

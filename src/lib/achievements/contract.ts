import type { AchievementId } from './catalogue';

// What the achievements client and server exchange.

/** A tier reached: `tier` counts from 1 (the achievement's first goal); `at` is the server's clock. */
export interface Unlock {
  id: AchievementId;
  tier: number;
  at: number;
}

/** How far an achievement is from its next tier. */
export interface NextTier {
  id: AchievementId;
  /** The tier being worked towards (1-based). */
  tier: number;
  value: number;
  goal: number;
}

/** What an upload did to the uploader's achievements: tiers it unlocked, and the nearest goals among those it moved. */
export interface AchievementNews {
  unlocks: Unlock[];
  next: NextTier[];
}

export interface AchievementState {
  id: AchievementId;
  value: number;
  /** When each tier was unlocked (server clock), null while locked; one entry per tier. */
  unlocked: (number | null)[];
}

/** Every achievement in catalogue order, with the player's progress. */
export interface AchievementsPage {
  items: AchievementState[];
  /** Tiers unlocked, out of every tier there is. */
  unlocked: number;
  total: number;
}

import { MATCH } from './constants';
import type { MatchSettings } from './types';

/**
 * Team deathmatch: the players each side fields as the room asks. `seats` on the wire is the room's total; the lobby
 * sets it two at a time, and an odd total (a free-for-all size carried over) rounds up so the sides stay equal.
 */
export function perTeam(seats: number) {
  return Math.max(1, Math.ceil(Math.min(seats, MATCH.maxPlayers) / 2));
}

/**
 * The room's size with this many humans in it. Free-for-all: the seats, never fewer than the humans. Team
 * deathmatch: two equal sides, each as large as the larger side of humans when they outgrow the setting.
 */
export function roomSize(settings: Pick<MatchSettings, 'mode' | 'seats'>, humans: number) {
  if (settings.mode === 'tdm') return 2 * Math.max(perTeam(settings.seats), Math.ceil(humans / 2));
  return Math.max(humans, Math.min(settings.seats, MATCH.maxPlayers));
}

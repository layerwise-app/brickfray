import type { ScoreRow } from '../../game/hud';
import type { MatchSettings } from '../../sim/types';
import type { Lang } from '../i18n';

/**
 * The final order of a room: by score, then kills (the board's and the stored score panel's order), except that the
 * free-for-all winner, who reached the kill limit or led on kills at the bell, is always first.
 */
export function standings(rows: readonly ScoreRow[], mode: MatchSettings['mode'] | undefined, winner: number | null): ScoreRow[] {
  const sorted = [...rows];
  if (mode !== 'ffa' || winner === null) return sorted;
  const at = sorted.findIndex((r) => r.id === winner);
  if (at > 0) sorted.unshift(...sorted.splice(at, 1));
  return sorted;
}

/** The leaderboard moments: number one, the top 10, the top 100; nothing below. */
export type RankTier = 'top1' | 'top10' | 'top100' | null;
export function tierOf(rank: number): RankTier {
  return rank === 1 ? 'top1' : rank <= 10 ? 'top10' : rank <= 100 ? 'top100' : null;
}

/** A place as each language writes it in "3rd of 8": English and French take a suffix, the rest the plain number. */
export function ordinal(lang: Lang, n: number) {
  if (lang === 'fr') return n === 1 ? '1er' : `${n}e`;
  if (lang !== 'en') return String(n);
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Shots that hit someone, of shots fired; null before the first shot. */
export function accuracy(shots: number, hit: number) {
  return shots > 0 ? Math.round((100 * hit) / shots) : null;
}

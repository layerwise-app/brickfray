import type { ScoreRow } from '../../game/hud';
import { byStanding } from '../../sim/match';
import type { Lang } from '../i18n';

/** The final order of a room, the host's own rule (it names the winner by it too): points, then kills, then fewer deaths. */
export function standings(rows: readonly ScoreRow[]): ScoreRow[] {
  return [...rows].sort(byStanding);
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

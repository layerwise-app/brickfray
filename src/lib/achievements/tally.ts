import { CHAIN_TOP } from '~/brickfray/sim/streaks';
import type { MatchDetail, MatchReport } from '../board/contract';
import { BEST_PREFIX, type BestStat, type StatKey, type SumStat } from './catalogue';

// What one accepted match adds to its player's totals, worked out on the server from the checked report alone.

export interface MatchTally {
  /** Added to the totals. */
  sum: Partial<Record<SumStat, number>>;
  /** Kept when higher than the total. */
  best: Partial<Record<BestStat, number>>;
}

export type TallySource = Pick<MatchReport, 'mode' | 'difficulty' | 'wave' | 'character' | 'kills' | 'deaths' | 'assists' | 'headshots' | 'result' | 'detail' | 'feats'>;

/**
 * Medals the reporter took on a room's final scoreboard: gold, silver or bronze for kills and for assists, the rule
 * of the results screen (ui/hud/Medal.tsx awardMedals): equal counts share a place, nobody earns one for zero.
 */
export function medalsOf(detail: MatchDetail | null): number {
  if (!detail || detail.mode === 'solo') return 0;
  const me = detail.players.find((p) => p.me);
  if (!me) return 0;
  let medals = 0;
  for (const kind of ['kills', 'assists'] as const) {
    const value = me[kind];
    if (value > 0 && 1 + detail.players.filter((p) => p[kind] > value).length <= 3) medals++;
  }
  return medals;
}

export function matchTally(r: TallySource): MatchTally {
  const win = r.result === 'win';
  const f = r.feats;
  const sum: MatchTally['sum'] = {
    matches: 1,
    kills: r.kills,
    assists: r.assists,
    headshots: r.headshots,
    [`play.${r.character}`]: 1
  };
  if (r.mode !== 'solo') {
    sum[r.mode === 'ffa' ? 'winFfa' : 'winTdm'] = win ? 1 : 0;
    // A win nobody touched counts only when the player fought for it: a camper on the winning team does not.
    sum.flawless = win && r.deaths === 0 && r.kills > 0 ? 1 : 0;
    sum.medals = medalsOf(r.detail);
    if (win) sum[`win.${r.character}` as SumStat] = 1;
  }
  if (f) {
    Object.assign(sum, { sidearm: f.sidearm, melee: f.melee, grenade: f.grenade, longshot: f.longshot, airborne: f.airborne, bounty: f.bounty, megabot: f.megabot });
    f.chains.slice(0, CHAIN_TOP - 1).forEach((n, i) => (sum[`chain${i + 2}` as SumStat] = n));
  }
  for (const key of Object.keys(sum) as SumStat[]) if (!sum[key]) delete sum[key];
  const best: MatchTally['best'] = r.mode === 'solo' && r.difficulty ? { [`best.wave.${r.difficulty}`]: r.wave } : {};
  return { sum, best };
}

/** The stats a set of tallies moved. */
export function movedStats(tallies: readonly MatchTally[]): Set<StatKey> {
  const moved = new Set<StatKey>();
  for (const t of tallies) for (const key of [...Object.keys(t.sum), ...Object.keys(t.best)]) moved.add(key as StatKey);
  return moved;
}

export const isBest = (stat: string) => stat.startsWith(BEST_PREFIX);

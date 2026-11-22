import { describe, expect, it } from 'vitest';
import type { ScoreRow } from '../../game/hud';
import { awardMedals } from './Medal';
import { clock, ordinal, standings, tierOf } from './standings';

function row(id: number, kills: number, assists: number, score = kills * 100 + assists * 50): ScoreRow {
  return { id, name: `P${id}`, character: 'rivet', team: -1, kills, deaths: 0, assists, score, ping: 0, me: id === 1, bot: id !== 1 };
}

describe('medals', () => {
  it('gives gold, silver and bronze by kills and by assists, both to one player if earned', () => {
    const rows = [row(1, 12, 1), row(2, 9, 6), row(3, 7, 4), row(4, 3, 5), row(5, 1, 0)];
    const medals = awardMedals(rows);
    expect(medals.get(1)).toEqual([{ kind: 'kills', tier: 1 }]);
    expect(medals.get(2)).toEqual([
      { kind: 'kills', tier: 2 },
      { kind: 'assists', tier: 1 }
    ]);
    expect(medals.get(3)).toEqual([
      { kind: 'kills', tier: 3 },
      { kind: 'assists', tier: 3 }
    ]);
    expect(medals.get(4)).toEqual([{ kind: 'assists', tier: 2 }]);
    expect(medals.get(5)).toBeUndefined();
  });

  it('shares a place on a tie and skips the next, and gives nothing for zero', () => {
    const medals = awardMedals([row(1, 10, 0), row(2, 10, 0), row(3, 8, 0), row(4, 0, 0)]);
    expect([1, 2, 3, 4].map((id) => medals.get(id)?.[0]?.tier ?? null)).toEqual([1, 1, 3, null]);
  });
});

describe('standings', () => {
  it('orders by points, then kills, then fewer deaths, whatever order the rows came in', () => {
    const rows = [row(2, 9, 8), row(1, 10, 0, 1000), { ...row(3, 10, 0, 1000), deaths: 4 }, row(4, 2, 1)];
    expect(standings(rows).map((r) => r.id)).toEqual([2, 1, 3, 4]);
  });
});

describe('leaderboard tiers', () => {
  it('marks number one, the top 10 and the top 100, and nothing past it', () => {
    expect([1, 2, 10, 11, 100, 101].map(tierOf)).toEqual(['top1', 'top10', 'top10', 'top100', 'top100', null]);
  });
});

describe('formats', () => {
  it('writes places and times', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map((n) => ordinal('en', n))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
    expect(ordinal('fr', 1)).toBe('1er');
    expect(ordinal('zh', 3)).toBe('3');
    expect(clock(372)).toBe('6:12');
    expect(clock(3725)).toBe('1:02:05');
  });
});

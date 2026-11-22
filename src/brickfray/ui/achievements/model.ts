import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getAchievements } from '../../../lib/achievements/achievements.functions';
import type { AchievementId } from '../../../lib/achievements/catalogue';
import { newsFor, subscribeNews } from '../../../lib/achievements/client/news';
import type { AchievementNews } from '../../../lib/achievements/contract';
import { LONG_SHOT } from '../../../lib/achievements/feats';
import { getOutcome, subscribeOutcome, type Outcome } from '../../../lib/board/client/outcome';
import { CHAIN_WINDOW } from '../../sim/streaks';
import { BOARD, usePlayerId } from '../board/me';
import type { Lang, MessageKey } from '../i18n';
import { CHAINS } from './showcase';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const WAVES: Partial<Record<AchievementId, 'easy' | 'normal' | 'hard'>> = { waveEasy: 'easy', waveNormal: 'normal', waveHard: 'hard' };

export function achievementName(t: T, id: AchievementId) {
  return t(`ach.${id}` as MessageKey);
}

/** What counts towards it, in one line. */
export function achievementHow(t: T, id: AchievementId) {
  const chain = CHAINS[id];
  if (chain) return t('ach.chain.how', { n: chain, s: CHAIN_WINDOW });
  const level = WAVES[id];
  if (level) return t('ach.wave.how', { level: t(`difficulty.${level}`) });
  if (id === 'longshot') return t('ach.longshot.how', { m: LONG_SHOT });
  return t(`ach.${id}.how` as MessageKey);
}

/** A date without the time; the year only when it is not this one. */
export function day(lang: Lang, at: number) {
  const same = new Date(at).getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(lang, { year: same ? undefined : 'numeric', month: 'short', day: 'numeric' }).format(at);
}

/** Every achievement with the player's progress (their account's when this browser joined one). */
export function useAchievements() {
  const playerId = usePlayerId();
  return useQuery({ queryKey: [...BOARD, 'achievements', playerId], queryFn: () => getAchievements({ data: { playerId } }) });
}

/** The outcome of the match a screen belongs to (its settings object), or null. */
export function useMatchOutcome(settings: object | null): Outcome | null {
  const outcome = useSyncExternalStore(subscribeOutcome, getOutcome, getOutcome);
  return outcome && outcome.settings === settings ? outcome : null;
}

/** What the upload of this outcome's match did to the player's achievements, once it is known. */
export function useNews(outcome: Outcome | null): AchievementNews | null {
  const key = outcome?.upload === 'stored' ? outcome.report.key : null;
  return useSyncExternalStore(
    subscribeNews,
    () => newsFor(key),
    () => null
  );
}

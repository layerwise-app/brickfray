import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getMatchRank } from '../../../lib/board/board.functions';
import { getOutcome, subscribeOutcome, type Outcome } from '../../../lib/board/client/outcome';
import type { MatchRank } from '../../../lib/board/contract';
import type { MatchSettings } from '../../sim/types';
import { number } from '../board/format';
import { BOARD, usePlayerId } from '../board/me';
import { TrophyIcon } from '../board/icons';
import { useT, type MessageKey } from '../i18n';
import { CrownIcon } from '../icons';
import { Confetti, UnrankedIcon } from './results-art';
import { tierOf, type RankTier } from './standings';

/** The finished match's outcome, once its report is made: only the one that belongs to `settings`' match. */
export function useOutcome(settings: MatchSettings | null): Outcome | null {
  const outcome = useSyncExternalStore(subscribeOutcome, getOutcome, getOutcome);
  return outcome && outcome.settings === settings ? outcome : null;
}

/**
 * The player's all-time rank on the match's board as one badge: the cup, "#19", and how far this match moved it
 * ("▲35", or "new" for a first ranked match). From the top 100 up the badge turns gold with its tier, and a new
 * place there throws confetti. While the rank loads the cup waits quietly; a match that cannot be ranked gets one
 * short muted line (the full reason on hover or focus).
 */
export function RankBadge({ outcome }: { outcome: Outcome | null }) {
  const { t } = useT();
  const playerId = usePlayerId();
  const report = outcome?.report;
  const rank = useQuery({
    queryKey: [...BOARD, 'matchRank', report?.key],
    queryFn: () => getMatchRank({ data: { playerId, key: report!.key, mode: report!.mode } }),
    enabled: outcome?.upload === 'stored',
    staleTime: Infinity,
    retry: 2
  });
  if (!outcome) return <Unranked short='rank.short.none' long='rank.none' />;
  if (outcome.upload === 'local' || outcome.upload === 'refused' || outcome.upload === 'waiting') return <Unranked short={`rank.short.${outcome.upload}`} long={`rank.${outcome.upload}`} />;
  if (outcome.upload === 'sending' || rank.isLoading) {
    return (
      <Labelled>
        <span className='bf-rank' data-busy role='status' aria-label={t('rank.checking')} title={t('rank.checking')}>
          <TrophyIcon size={20} />
          <span className='bf-rank-dots' aria-hidden />
        </span>
      </Labelled>
    );
  }
  const data = rank.data;
  if (!data || 'refused' in data) return <Unranked short='rank.short.failed' long='rank.failed' />;
  return (
    <Labelled>
      <Ranked rank={data} solo={outcome.report.mode === 'solo'} />
    </Labelled>
  );
}

/** The badge under a word that says what it is: the player's place on the leaderboard, not in this match. */
function Labelled({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <span className='bf-rank-box'>
      <small className='bf-rank-cap bf-in'>{t('board.title')}</small>
      {children}
    </span>
  );
}

function Unranked({ short, long }: { short: MessageKey; long: MessageKey }) {
  const { t } = useT();
  return (
    <span className='bf-rank-off' role='status' title={t(long)}>
      <UnrankedIcon size={18} />
      {t(short)}
    </span>
  );
}

function Ranked({ rank, solo }: { rank: MatchRank; solo: boolean }) {
  const { t, lang } = useT();
  const tier = tierOf(rank.rank);
  const first = rank.before === null;
  const up = !first && rank.before! > rank.rank ? rank.before! - rank.rank : 0;
  const board = solo && rank.difficulty ? `${t('board.mode.solo')} · ${t(`difficulty.${rank.difficulty}`)}` : t(`board.mode.${rank.mode}`);
  const detail = [`${t('board.title')} · ${board}`, `#${number(lang, rank.rank)} ${t('rank.total', { n: number(lang, rank.total) })}`];
  if (rank.run !== rank.rank) detail.push(t(solo ? 'rank.runSolo' : 'rank.runRoom', { n: number(lang, rank.run) }));
  const tierText: Record<Exclude<RankTier, null>, MessageKey> = { top1: 'rank.top1', top10: 'rank.top10', top100: 'rank.top100' };
  return (
    <span className='bf-rank bf-in' data-tier={tier ?? undefined} role='status' title={detail.join('\n')} aria-label={detail.join('. ')}>
      {tier && (
        <span className='bf-rank-tier bf-display'>
          {tier === 'top1' ? <CrownIcon size={22} /> : <TrophyIcon size={19} />}
          {t(tierText[tier])}
        </span>
      )}
      <span className='bf-rank-num bf-display'>
        {!tier && <TrophyIcon size={19} className='bf-rank-cup' />}
        {tier !== 'top1' && <span>#{number(lang, rank.rank)}</span>}
        {first ? <span className='bf-rank-new'>{t('rank.new')}</span> : up > 0 && <span className='bf-rank-up'>▲{number(lang, up)}</span>}
      </span>
      {tier && (first || up > 0) && <Confetti pieces={26} />}
    </span>
  );
}

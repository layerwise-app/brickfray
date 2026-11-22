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

/** The finished match's outcome, once its report is made: only the one that belongs to `settings`' match. */
export function useOutcome(settings: MatchSettings | null): Outcome | null {
  const outcome = useSyncExternalStore(subscribeOutcome, getOutcome, getOutcome);
  return outcome && outcome.settings === settings ? outcome : null;
}

type Tier = 'top1' | 'top10' | 'top100' | null;
function tierOf(rank: number): Tier {
  return rank === 1 ? 'top1' : rank <= 10 ? 'top10' : rank <= 100 ? 'top100' : null;
}

/**
 * The player's all-time rank on the match's board once the server has it: how this match moved it, and a
 * celebration from the top 100 up (stronger for the top 10 and number one). Until then, or when the match cannot be
 * ranked, one quiet line says why.
 */
export function RankCallout({ outcome }: { outcome: Outcome | null }) {
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
  if (!outcome) return <Quiet text={t('rank.none')} />;
  if (outcome.upload === 'local' || outcome.upload === 'refused' || outcome.upload === 'waiting') return <Quiet text={t(`rank.${outcome.upload}`)} />;
  if (outcome.upload === 'sending' || rank.isLoading) return <Quiet text={t('rank.checking')} busy />;
  const data = rank.data;
  if (!data || 'refused' in data) return <Quiet text={t('rank.failed')} />;
  return <Ranked rank={data} solo={outcome.report.mode === 'solo'} />;
}

function Quiet({ text, busy }: { text: string; busy?: boolean }) {
  return (
    <p className='bf-rank-quiet' role='status' data-busy={busy || undefined}>
      {busy && <span className='bf-rank-dots' aria-hidden />}
      {text}
    </p>
  );
}

function Ranked({ rank, solo }: { rank: MatchRank; solo: boolean }) {
  const { t, lang } = useT();
  const tier = tierOf(rank.rank);
  const moved = rank.before === null || rank.before > rank.rank;
  const board = solo && rank.difficulty ? `${t('board.mode.solo')} · ${t(`difficulty.${rank.difficulty}`)}` : t(`board.mode.${rank.mode}`);
  const n = (v: number) => `#${number(lang, v)}`;
  const tierText: Record<Exclude<Tier, null>, MessageKey> = { top1: 'rank.top1', top10: 'rank.top10', top100: 'rank.top100' };
  return (
    <div className='bf-rank' data-tier={tier ?? undefined} data-new={(tier && moved) || undefined} role='status'>
      <div className='bf-rank-label'>
        <TrophyIcon size={15} />
        <span>
          {t('board.title')} · {board}
        </span>
      </div>
      {tier && (
        <div className='bf-rank-badge bf-display'>
          {tier === 'top1' ? <CrownIcon size={30} /> : <TrophyIcon size={26} />}
          <span>{t(tierText[tier])}</span>
        </div>
      )}
      <div className='bf-rank-line'>
        {rank.before === null ? (
          <span className='bf-rank-main'>
            <span className='bf-rank-tag'>{t(solo ? 'rank.firstSolo' : 'rank.firstRoom')}</span>
            <span className='bf-display bf-rank-num'>{n(rank.rank)}</span>
          </span>
        ) : moved ? (
          <span className='bf-rank-main'>
            <span className='bf-display bf-rank-from'>{n(rank.before)}</span>
            <span className='bf-rank-arrow' aria-hidden>
              →
            </span>
            <span className='bf-display bf-rank-num'>{n(rank.rank)}</span>
            <span className='bf-rank-up'>▲ {number(lang, rank.before - rank.rank)}</span>
          </span>
        ) : (
          <span className='bf-rank-main'>
            <span className='bf-rank-tag'>{t('rank.kept')}</span>
            <span className='bf-display bf-rank-num'>{n(rank.rank)}</span>
          </span>
        )}
        <span className='bf-rank-total'>{t('rank.total', { n: number(lang, rank.total) })}</span>
      </div>
      {rank.run !== rank.rank && <div className='bf-rank-run'>{t(solo ? 'rank.runSolo' : 'rank.runRoom', { n: number(lang, rank.run) })}</div>}
    </div>
  );
}

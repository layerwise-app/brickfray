import type { UseQueryResult } from '@tanstack/react-query';
import { useT } from '../i18n';
import { ChevronIcon } from './icons';

/** "Name#1234", the tag quieter than the name; `label` is a short yellow tag after it ("You", "Your rank"). */
export function PlayerName({ name, tag, label }: { name: string; tag: number | null; label?: string | false }) {
  return (
    <span className='bf-board-name'>
      <span className='truncate'>{name}</span>
      {tag !== null && <span className='bf-board-tagno'>#{tag}</span>}
      {label && <span className='bf-board-tag'>{label}</span>}
    </span>
  );
}

/** Loading, failed or empty: one line in the list's place. */
export function Status({ query, empty, emptyText }: { query: UseQueryResult<unknown>; empty: boolean; emptyText: string }) {
  const { t } = useT();
  if (query.isLoading) return <p className='bf-board-note bf-board-wait'>{t('busy.loading')}</p>;
  if (query.isError && !query.data)
    return (
      <div className='bf-board-note'>
        <p>{t('board.error')}</p>
        <button className='bf-btn bf-btn-ghost !h-10 !px-4 text-sm font-semibold' onClick={() => void query.refetch()}>
          {t('board.retry')}
        </button>
      </div>
    );
  if (empty) return <p className='bf-board-note'>{emptyText}</p>;
  return null;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const { t, lang } = useT();
  const last = Math.max(0, Math.ceil(total / pageSize) - 1);
  const fmt = new Intl.NumberFormat(lang);
  return (
    <div className='bf-board-pager'>
      <button className='bf-btn bf-btn-ghost bf-icon-btn' disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label={t('board.prev')}>
        <ChevronIcon size={18} />
      </button>
      <span className='tabular-nums'>{t('board.range', { from: fmt.format(page * pageSize + 1), to: fmt.format(Math.min(total, (page + 1) * pageSize)), total: fmt.format(total) })}</span>
      <button className='bf-btn bf-btn-ghost bf-icon-btn' disabled={page >= last} onClick={() => onPage(page + 1)} aria-label={t('board.next')}>
        <ChevronIcon size={18} flip />
      </button>
    </div>
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getLeaderboard } from '../../../lib/board/board.functions';
import { MODES, PERIODS, SOLO_LEVELS, type BoardMode, type BoardPeriod, type RankedEntry, type SoloLevel } from '../../../lib/board/contract';
import { useT, type Lang } from '../i18n';
import { BOARD, usePlayerId } from './account';
import { Avatar } from './Avatar';
import { ago, kda, mapName, number } from './format';
import { Pager, Status } from './parts';

export interface RankFilter {
  mode: BoardMode;
  period: BoardPeriod;
  difficulty: SoloLevel;
}

export function Rankings({ filter, setFilter }: { filter: RankFilter; setFilter: (f: RankFilter) => void }) {
  const { t, lang } = useT();
  const playerId = usePlayerId();
  const [page, setPage] = useState(0);
  const query = {
    mode: filter.mode,
    period: filter.period,
    difficulty: filter.mode === 'solo' ? filter.difficulty : null,
    page,
    tzOffset: -new Date().getTimezoneOffset(),
    playerId
  };
  const board = useQuery({
    queryKey: [...BOARD, 'ranks', query],
    queryFn: () => getLeaderboard({ data: query }),
    placeholderData: keepPreviousData
  });
  const choose = (next: Partial<RankFilter>) => {
    setPage(0);
    setFilter({ ...filter, ...next });
  };
  const data = board.data;
  const me = data?.me;
  const meOnPage = !!me && data.rows.some((r) => r.mine);

  return (
    <div className='bf-board-tab'>
      <div className='bf-board-filters'>
        <div className='bf-seg' role='group' aria-label={t('mode')}>
          {MODES.map((m) => (
            <button key={m} aria-pressed={filter.mode === m} onClick={() => choose({ mode: m })}>
              {t(`board.mode.${m}`)}
            </button>
          ))}
        </div>
        <div className='bf-board-filter-row'>
          <div className='bf-seg' role='group'>
            {PERIODS.map((p) => (
              <button key={p} aria-pressed={filter.period === p} onClick={() => choose({ period: p })}>
                {t(`board.period.${p}`)}
              </button>
            ))}
          </div>
          {filter.mode === 'solo' && (
            <div className='bf-seg' role='group' aria-label={t('difficulty')}>
              {SOLO_LEVELS.map((d) => (
                <button key={d} aria-pressed={filter.difficulty === d} onClick={() => choose({ difficulty: d })}>
                  {t(`difficulty.${d}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='bf-board-list bf-scroll' data-fetching={board.isFetching && !board.isLoading}>
        <Status query={board} empty={!!data && !data.rows.length} emptyText={t('board.empty')} />
        {data && data.rows.length > 0 && (
          <ol>
            {data.rows.map((r) => (
              <RankRow key={r.id} row={r} lang={lang} />
            ))}
          </ol>
        )}
      </div>

      <div className='bf-board-foot'>
        {me && !meOnPage ? (
          <button className='bf-board-row bf-board-mine-bar' data-mine onClick={() => setPage(Math.floor((me.rank - 1) / data.pageSize))}>
            <RankCells row={me} lang={lang} label={t('board.yourRank')} />
          </button>
        ) : (
          !me && data && <p className='bf-board-note'>{t('board.unranked')}</p>
        )}
        {data && data.total > data.pageSize && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </div>
    </div>
  );
}

function RankRow({ row, lang }: { row: RankedEntry; lang: Lang }) {
  return (
    <li className='bf-board-row' data-mine={row.mine || undefined} data-top={row.rank <= 3 ? row.rank : undefined}>
      <RankCells row={row} lang={lang} />
    </li>
  );
}

function RankCells({ row, lang, label }: { row: RankedEntry; lang: Lang; label?: string }) {
  const { t } = useT();
  const solo = row.mode === 'solo';
  const stats = [
    solo ? `${t('score')} ${number(lang, row.score)}` : kda(lang, row),
    solo ? `${number(lang, row.kills)} ${t('kills')}` : row.mode === 'tdm' ? t(row.result === 'win' ? 'victory' : row.result === 'draw' ? 'draw' : 'defeat') : t('board.place', { n: row.placement, total: row.players }),
    mapName(lang, row.map),
    ago(lang, row.endedAt)
  ];
  return (
    <>
      <span className='bf-board-rank bf-display'>{row.rank}</span>
      <Avatar avatar={row.avatar} character={row.character} />
      <span className='bf-board-who'>
        <span className='bf-board-name'>
          {label && <span className='bf-board-tag'>{label}</span>}
          <span className='truncate'>{row.name}</span>
          {row.mine && !label && <span className='bf-board-tag'>{t('you')}</span>}
        </span>
        <span className='bf-board-stats'>{stats.join(' · ')}</span>
      </span>
      <span className='bf-board-score'>
        <span className='bf-display'>{solo ? t('wave', { n: row.wave }) : number(lang, row.score)}</span>
      </span>
    </>
  );
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getHistory } from '../../../lib/board/board.functions';
import { localHistory, pendingMatches } from '../../../lib/board/client/history';
import { flushMatches } from '../../../lib/board/client/sync';
import type { BoardEntry, HistoryTotals } from '../../../lib/board/contract';
import { useGame } from '../App';
import { useT, type Lang } from '../i18n';
import { HeadshotIcon } from '../icons';
import { BOARD, usePlayerId } from './account';
import { Avatar } from './Avatar';
import { clock, kda, mapName, number, playTime, when } from './format';
import { Pager, Status } from './parts';

export function History() {
  const game = useGame();
  const { t, lang } = useT();
  const playerId = usePlayerId();
  const [page, setPage] = useState(0);
  const history = useQuery({
    queryKey: [...BOARD, 'history', playerId, page],
    queryFn: async () => {
      // Matches still waiting go up first, so the server's page is the whole story.
      await flushMatches(game.settings.name);
      try {
        return { ...(await getHistory({ data: { playerId, page } })), offline: false };
      } catch {
        return { ...localHistory(page), offline: true };
      }
    },
    placeholderData: keepPreviousData
  });
  const data = history.data;
  const waiting = data && !data.offline ? pendingMatches().length : 0;

  return (
    <div className='bf-board-tab'>
      {data && <Totals totals={data.totals} lang={lang} />}
      <div className='bf-board-list bf-scroll' data-fetching={history.isFetching && !history.isLoading}>
        {data?.offline && <p className='bf-board-note bf-board-offline'>{t('board.offline')}</p>}
        {waiting > 0 && <p className='bf-board-note bf-board-offline'>{t('board.waiting', { n: waiting })}</p>}
        <Status query={history} empty={!!data && !data.rows.length} emptyText={t('board.emptyHistory')} />
        {data && data.rows.length > 0 && (
          <ol>
            {data.rows.map((m) => (
              <MatchRow key={m.id} match={m} lang={lang} />
            ))}
          </ol>
        )}
      </div>
      {data && data.total > data.pageSize && (
        <div className='bf-board-foot'>
          <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

function Totals({ totals, lang }: { totals: HistoryTotals; lang: Lang }) {
  const { t } = useT();
  const tiles = [
    [t('board.matches'), number(lang, totals.matches)],
    [t('board.wins'), number(lang, totals.wins)],
    [t('board.kills'), number(lang, totals.kills)],
    [t('board.bestScore'), number(lang, totals.bestScore)],
    [t('board.bestWave'), totals.bestWave ? number(lang, totals.bestWave) : '–'],
    [t('board.timePlayed'), playTime(lang, totals.seconds)]
  ];
  return (
    <dl className='bf-board-totals'>
      {tiles.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className='bf-display'>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MatchRow({ match: m, lang }: { match: BoardEntry; lang: Lang }) {
  const { t } = useT();
  const outcome =
    m.mode === 'solo'
      ? t('wave', { n: m.wave })
      : m.mode === 'tdm' || m.result === 'win'
        ? t(m.result === 'win' ? 'victory' : m.result === 'draw' ? 'draw' : 'defeat')
        : t('board.place', { n: m.placement, total: m.players });
  const title = [t(`mode.${m.mode}`), mapName(lang, m.map), m.difficulty && t(`difficulty.${m.difficulty}`)].filter(Boolean).join(' · ');
  return (
    <li className='bf-board-row bf-board-match'>
      <Avatar character={m.character} />
      <span className='bf-board-who'>
        <span className='bf-board-name'>
          <span className='truncate'>{title}</span>
        </span>
        <span className='bf-board-stats'>
          {kda(lang, m)} ·{' '}
          <span className='bf-board-hs' title={t('board.headshots')}>
            <HeadshotIcon size={12} /> {number(lang, m.headshots)}
          </span>{' '}
          · {clock(m.durationS)} · {when(lang, m.endedAt)}
        </span>
      </span>
      <span className='bf-board-score'>
        <span className='bf-board-result' data-result={m.mode === 'solo' ? 'wave' : (m.result ?? undefined)}>
          {outcome}
        </span>
        <span className='bf-display'>{number(lang, m.score)}</span>
      </span>
    </li>
  );
}

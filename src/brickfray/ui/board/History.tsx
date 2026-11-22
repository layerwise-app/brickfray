import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getHistory } from '../../../lib/board/board.functions';
import { localDetail, localHistory, pendingMatches } from '../../../lib/board/client/history';
import { flushMatches } from '../../../lib/board/client/sync';
import type { BoardEntry, BoardPlayer, HistoryTotals } from '../../../lib/board/contract';
import { useGame } from '../App';
import { useT, type Lang } from '../i18n';
import { StatHead } from '../hud/stat-head';
import { Avatar } from './Avatar';
import { clock, mapName, number, outcome, playTime, when } from './format';
import { BOARD, usePlayerId } from './me';
import { Pager, Status } from './parts';
import type { OpenMatch } from './ScorePanel';

/** board.css hides the trailing columns as the panel narrows; the date stays under the match. */
const COLUMNS = ['match', 'result', 'score', 'kills', 'deaths', 'assists', 'time'] as const;
type Column = (typeof COLUMNS)[number];

export function History({ player, onOpen }: { player: BoardPlayer | null; onOpen: (match: OpenMatch) => void }) {
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
  const open = (m: BoardEntry) => onOpen({ id: m.id, entry: m, player, local: m.id < 0 ? localDetail(m.id) : undefined });
  const head: Record<Column, React.ReactNode> = {
    match: t('board.col.match'),
    result: t('board.col.result'),
    score: <StatHead stat='score' size={14} />,
    kills: <StatHead stat='kills' size={14} />,
    deaths: <StatHead stat='deaths' size={14} />,
    assists: <StatHead stat='assists' size={14} />,
    time: <StatHead stat='time' size={14} />
  };

  return (
    <div className='bf-board-tab'>
      {data && <Totals totals={data.totals} lang={lang} />}
      <div className='bf-board-list bf-scroll' data-cols='history' data-fetching={history.isFetching && !history.isLoading}>
        {data?.offline && <p className='bf-board-note bf-board-offline'>{t('board.offline')}</p>}
        {waiting > 0 && <p className='bf-board-note bf-board-offline'>{t('board.waiting', { n: waiting })}</p>}
        <Status query={history} empty={!!data && !data.rows.length} emptyText={t('board.emptyHistory')} />
        {data && data.rows.length > 0 && (
          <>
            <div className='bf-board-tr bf-board-th'>
              {COLUMNS.map((c) => (
                <span key={c} data-col={c}>
                  {head[c]}
                </span>
              ))}
            </div>
            <ol>
              {data.rows.map((m) => (
                <li key={m.id}>
                  <button className='bf-board-tr' onClick={() => open(m)}>
                    <MatchCells match={m} lang={lang} />
                  </button>
                </li>
              ))}
            </ol>
          </>
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

function MatchCells({ match: m, lang }: { match: BoardEntry; lang: Lang }) {
  const { t } = useT();
  const title = [t(`board.mode.${m.mode}`), mapName(lang, m.map), m.difficulty && t(`difficulty.${m.difficulty}`)].filter(Boolean).join(' · ');
  const cell: Record<Column, React.ReactNode> = {
    match: (
      <span className='bf-board-who'>
        <Avatar avatar={{ hero: m.character, image: null }} size={32} />
        <span className='bf-board-lines'>
          <span className='bf-board-match-title'>{title}</span>
          <span className='bf-board-when'>{when(lang, m.endedAt)}</span>
        </span>
      </span>
    ),
    result: (
      <span className='bf-board-result' data-result={m.mode === 'solo' ? 'wave' : (m.result ?? undefined)}>
        {outcome(lang, m)}
      </span>
    ),
    score: <span className='bf-display bf-board-big'>{number(lang, m.score)}</span>,
    kills: number(lang, m.kills),
    deaths: number(lang, m.deaths),
    assists: number(lang, m.assists),
    time: clock(m.durationS)
  };
  return COLUMNS.map((c) => (
    <span key={c} data-col={c}>
      {cell[c]}
    </span>
  ));
}

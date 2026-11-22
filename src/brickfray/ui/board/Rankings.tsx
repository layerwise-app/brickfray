import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getLeaderboard } from '../../../lib/board/board.functions';
import { MODES, SOLO_LEVELS, type BoardMode, type RankedEntry, type SoloLevel } from '../../../lib/board/contract';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import { MAP_IDS } from '../../game/settings';
import type { MapId } from '../../world/types';
import { useT, type Lang } from '../i18n';
import { StatHead } from '../hud/stat-head';
import { Avatar } from './Avatar';
import { clock, mapName, number, outcome } from './format';
import { BOARD, usePlayerId } from './me';
import { Pager, PlayerName, Status } from './parts';
import type { OpenMatch } from './ScorePanel';

export interface RankFilter {
  mode: BoardMode;
  difficulty: SoloLevel;
  /** Null: every map. */
  map: MapId | null;
}

/** The columns of each board; board.css hides the trailing ones as the panel narrows. */
type Column = 'rank' | 'player' | 'wave' | 'score' | 'kills' | 'headshots' | 'time' | 'map' | 'hero' | 'deaths' | 'assists' | 'result';
const COLUMNS: Record<'solo' | 'room', Column[]> = {
  solo: ['rank', 'player', 'wave', 'score', 'kills', 'headshots', 'time', 'map', 'hero'],
  room: ['rank', 'player', 'score', 'kills', 'deaths', 'assists', 'result', 'map']
};

export function Rankings({ filter, setFilter, onOpen }: { filter: RankFilter; setFilter: (f: RankFilter) => void; onOpen: (match: OpenMatch) => void }) {
  const { t, lang } = useT();
  const playerId = usePlayerId();
  const [page, setPage] = useState(0);
  const solo = filter.mode === 'solo';
  const query = { mode: filter.mode, difficulty: solo ? filter.difficulty : null, map: filter.map, page, playerId };
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
  const columns = COLUMNS[solo ? 'solo' : 'room'];
  const open = (r: RankedEntry) => onOpen({ id: r.id, entry: r, player: { name: r.name, tag: r.tag, avatar: r.avatar } });

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
        {/* A short box (a phone on its side): difficulty and map as two drop-downs beside the modes, so the list keeps a row. */}
        <div className='bf-board-picks'>
          {solo && (
            <select aria-label={t('difficulty')} value={filter.difficulty} onChange={(e) => choose({ difficulty: e.target.value as SoloLevel })}>
              {SOLO_LEVELS.map((d) => (
                <option key={d} value={d}>
                  {t(`difficulty.${d}`)}
                </option>
              ))}
            </select>
          )}
          <select aria-label={t('map')} value={filter.map ?? ''} onChange={(e) => choose({ map: (e.target.value || null) as MapId | null })}>
            {[null, ...MAP_IDS].map((m) => (
              <option key={m ?? 'all'} value={m ?? ''}>
                {m ? mapName(lang, m) : t('board.allMaps')}
              </option>
            ))}
          </select>
        </div>
        <div className='bf-board-filter-row'>
          {solo && (
            <div className='bf-seg' role='group' aria-label={t('difficulty')}>
              {SOLO_LEVELS.map((d) => (
                <button key={d} aria-pressed={filter.difficulty === d} onClick={() => choose({ difficulty: d })}>
                  {t(`difficulty.${d}`)}
                </button>
              ))}
            </div>
          )}
          <div className='bf-seg bf-board-maps' role='group' aria-label={t('map')}>
            {[null, ...MAP_IDS].map((m) => (
              <button key={m ?? 'all'} aria-pressed={filter.map === m} onClick={() => choose({ map: m })}>
                {m ? mapName(lang, m) : t('board.allMaps')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='bf-board-list bf-scroll' data-cols={solo ? 'solo' : 'room'} data-onemap={filter.map !== null || undefined} data-fetching={board.isFetching && !board.isLoading}>
        <Status query={board} empty={!!data && !data.rows.length} emptyText={t('board.empty')} />
        {data && data.rows.length > 0 && (
          <>
            <div className='bf-board-tr bf-board-th'>
              {columns.map((c) => (
                <Head key={c} column={c} />
              ))}
            </div>
            <ol>
              {data.rows.map((r) => (
                <li key={r.id}>
                  <button className='bf-board-tr' data-mine={r.mine || undefined} data-top={r.rank <= 3 ? r.rank : undefined} onClick={() => open(r)}>
                    <Cells row={r} columns={columns} lang={lang} />
                  </button>
                </li>
              ))}
            </ol>
            {me && !meOnPage && (
              <button className='bf-board-tr bf-board-mine-bar' data-mine title={t('board.yourRank')} onClick={() => setPage(Math.floor((me.rank - 1) / data.pageSize))}>
                <Cells row={me} columns={columns} lang={lang} />
              </button>
            )}
          </>
        )}
      </div>

      <div className='bf-board-foot'>
        {!me && data && data.rows.length > 0 && <p className='bf-board-note'>{t('board.unranked')}</p>}
        {data && data.total > data.pageSize && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </div>
    </div>
  );
}

const STATS = { score: 'score', kills: 'kills', headshots: 'headshots', deaths: 'deaths', assists: 'assists', time: 'time' } as const;

/** Numbers wear their mark over their word, as everywhere else; the rest of the columns are words. */
function Head({ column }: { column: Column }) {
  const { t } = useT();
  const stat = STATS[column as keyof typeof STATS];
  if (stat)
    return (
      <span data-col={column}>
        <StatHead stat={stat} size={14} />
      </span>
    );
  const label: Partial<Record<Column, string>> = {
    rank: '#',
    player: t('player'),
    wave: t('board.col.wave'),
    map: t('map'),
    hero: t('board.col.hero'),
    result: t('board.col.result')
  };
  return <span data-col={column}>{label[column]}</span>;
}

function Cells({ row, columns, lang }: { row: RankedEntry; columns: Column[]; lang: Lang }) {
  const { t } = useT();
  const cell: Record<Column, React.ReactNode> = {
    rank: <span className='bf-board-rank bf-display'>{row.rank}</span>,
    player: (
      <span className='bf-board-who'>
        <Avatar avatar={row.avatar} character={row.character} size={32} />
        <PlayerName name={row.name} tag={row.tag} label={row.mine && t('you')} />
      </span>
    ),
    wave: <span className='bf-display bf-board-big'>{number(lang, row.wave)}</span>,
    score: <span className='bf-display bf-board-big'>{number(lang, row.score)}</span>,
    kills: number(lang, row.kills),
    headshots: number(lang, row.headshots),
    time: clock(row.durationS),
    map: mapName(lang, row.map),
    hero: <Avatar avatar={{ hero: row.character, image: null }} size={26} />,
    deaths: number(lang, row.deaths),
    assists: number(lang, row.assists),
    result: (
      <span className='bf-board-result' data-result={row.result ?? undefined}>
        {outcome(lang, row)}
      </span>
    )
  };
  return columns.map((c) => (
    <span key={c} data-col={c} title={c === 'hero' ? (ROSTER[row.character as CharacterId]?.name ?? row.character) : undefined}>
      {cell[c]}
    </span>
  ));
}

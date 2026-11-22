import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useRef } from 'react';
import { getMatch } from '../../../lib/board/board.functions';
import type { BoardEntry, BoardPlayer, DetailPlayer, MatchDetail } from '../../../lib/board/contract';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import { TEAM_COLORS } from '../../game/remotes';
import { noUpgrades, type UpgradeId } from '../../sim/upgrades';
import { StatHead, StatIcon, type Stat } from '../hud/stat-head';
import { UpgradeList } from '../hud/UpgradeList';
import { useT, type Lang } from '../i18n';
import { BackIcon, BotIcon, CrownIcon } from '../icons';
import { Avatar } from './Avatar';
import { clock, mapName, number, outcome, when } from './format';
import { BOARD, usePlayerId } from './me';
import { PlayerName } from './parts';

/** A row opened from a list: shown at once from what the list had, completed by the server's copy. */
export interface OpenMatch {
  /** Negative: a match kept on this device only (History offline). */
  id: number;
  entry: Omit<BoardEntry, 'endedAt'> & { endedAt?: number | null };
  player: BoardPlayer | null;
  /** This device's detail of a match the server does not have. */
  local?: MatchDetail | null;
}

/** The score panel of one finished match, over the board: what the player saw when it ended. */
export function ScorePanel({ open, onClose }: { open: OpenMatch; onClose: () => void }) {
  const { t, lang } = useT();
  const playerId = usePlayerId();
  const back = useRef<HTMLButtonElement>(null);
  const remote = open.id > 0;
  const view = useQuery({
    queryKey: [...BOARD, 'match', open.id, playerId],
    queryFn: () => getMatch({ data: { id: open.id, playerId } }),
    enabled: remote
  });
  const entry = view.data?.match ?? open.entry;
  const player = view.data?.player ?? open.player;
  const detail = remote ? (view.data?.detail ?? null) : (open.local ?? null);
  const mine = remote ? !!view.data?.mine : true;
  const endedAt = remote ? view.data?.match.endedAt : open.entry.endedAt;
  const loading = remote && view.isLoading;

  // Focus moves into the panel, so Tab and Esc start here.
  useEffect(() => back.current?.focus(), []);

  const facts = [t(`board.mode.${entry.mode}`), mapName(lang, entry.map), entry.difficulty && t(`difficulty.${entry.difficulty}`), clock(entry.durationS), endedAt && when(lang, endedAt)];

  return (
    <section className='bf-board-detail' role='dialog' aria-modal aria-labelledby='bf-board-detail-title'>
      <header className='bf-board-head'>
        <button ref={back} className='bf-btn bf-btn-ghost bf-icon-btn bf-board-back' onClick={onClose} aria-label={t('back')}>
          <BackIcon size={20} />
        </button>
        <div className='flex min-w-0 flex-1 flex-col'>
          <h3 id='bf-board-detail-title' className='bf-display bf-board-detail-title' data-result={entry.result ?? undefined}>
            {title(t, lang, entry, detail)}
          </h3>
          <p className='bf-board-facts'>
            {facts.filter(Boolean).map((fact, i) => (
              <Fragment key={i}>
                {i > 0 && ' · '}
                <span>{fact}</span>
              </Fragment>
            ))}
          </p>
        </div>
      </header>
      {player && (
        <div className='bf-board-owner'>
          <Avatar avatar={player.avatar} character={entry.character} size={36} />
          <PlayerName name={player.name} tag={player.tag} label={mine && t('you')} />
        </div>
      )}
      <div className='bf-board-detail-body bf-scroll' data-fetching={loading || undefined}>
        {entry.mode === 'solo' ? <Run entry={entry} detail={detail} loading={loading} lang={lang} /> : <Room entry={entry} detail={detail} loading={loading} mine={mine} lang={lang} />}
      </div>
    </section>
  );
}

type T = ReturnType<typeof useT>['t'];

function title(t: T, lang: Lang, entry: OpenMatch['entry'], detail: MatchDetail | null) {
  if (entry.mode === 'ffa' && entry.result === 'loss' && detail?.mode === 'ffa' && detail.winner !== null) {
    const winner = detail.players[detail.winner];
    if (winner) return t('wins', { name: winner.name });
  }
  return outcome(lang, entry);
}

type Tile = [label: string, value: React.ReactNode, accent?: boolean, stat?: Stat];

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <dl className='bf-board-tiles'>
      {tiles.map(([label, value, accent, stat]) => (
        <div key={label} data-accent={accent || undefined}>
          <dt>
            {stat && <StatIcon stat={stat} size={14} />}
            {label}
          </dt>
          <dd className='bf-display'>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Run({ entry, detail, loading, lang }: { entry: OpenMatch['entry']; detail: MatchDetail | null; loading: boolean; lang: Lang }) {
  const { t } = useT();
  const upgrades: UpgradeId[] = detail?.mode === 'solo' ? detail.upgrades : [];
  const levels = noUpgrades();
  for (const id of upgrades) levels[id]++;
  return (
    <>
      <Tiles
        tiles={[
          [t('run.wave'), number(lang, entry.wave), true],
          [t('score'), number(lang, entry.score), false, 'score'],
          [t('board.kills'), number(lang, entry.kills), false, 'kills'],
          [t('board.headshots'), number(lang, entry.headshots), false, 'headshots'],
          [t('board.col.time'), clock(entry.durationS), false, 'time']
        ]}
      />
      <div className='bf-board-hero'>
        <Avatar avatar={{ hero: entry.character, image: null }} size={28} />
        <span>{ROSTER[entry.character as CharacterId]?.name ?? entry.character}</span>
      </div>
      <section className='flex flex-col gap-2'>
        <h4 className='bf-board-label'>
          {t('run.upgrades')}
          {detail && ` · ${number(lang, upgrades.length)}`}
        </h4>
        {loading ? null : detail ? upgrades.length ? <UpgradeList levels={levels} order={upgrades} /> : <p className='bf-board-hint'>{t('board.noPicks')}</p> : <p className='bf-board-hint'>{t('board.noUpgrades')}</p>}
      </section>
    </>
  );
}

function Room({ entry, detail, loading, mine, lang }: { entry: OpenMatch['entry']; detail: MatchDetail | null; loading: boolean; mine: boolean; lang: Lang }) {
  const { t } = useT();
  const tiles = (
    <Tiles
      tiles={[
        [t('board.col.result'), outcome(lang, entry), true],
        [t('score'), number(lang, entry.score), false, 'score'],
        [t('board.kills'), number(lang, entry.kills), false, 'kills'],
        [t('board.deaths'), number(lang, entry.deaths), false, 'deaths'],
        [t('board.assists'), number(lang, entry.assists), false, 'assists']
      ]}
    />
  );
  if (detail?.mode === 'tdm') {
    return (
      <>
        {tiles}
        {([0, 1] as const).map((team) => (
          <section key={team} className='flex flex-col gap-1.5'>
            <h4 className='bf-board-team bf-display' style={{ background: TEAM_COLORS[team] }}>
              {detail.winner === team && <CrownIcon size={18} aria-label={t('board.winner')} />}
              {t(`team.${team}`)} <span className='tabular-nums'>{number(lang, detail.teams[team])}</span>
            </h4>
            <Scoreboard players={detail.players} only={team} mine={mine} lang={lang} />
          </section>
        ))}
      </>
    );
  }
  if (detail?.mode === 'ffa') {
    return (
      <>
        {tiles}
        <Scoreboard players={detail.players} winner={detail.winner} mine={mine} lang={lang} />
      </>
    );
  }
  return (
    <>
      {tiles}
      {!loading && <p className='bf-board-hint'>{t('board.noDetail')}</p>}
    </>
  );
}

/**
 * The final scoreboard in its own order: a free-for-all numbers each place; a team's list does not (the team's score
 * is its place). The player's own row is yellow, as on the results screen.
 */
function Scoreboard({ players, only, winner, mine, lang }: { players: DetailPlayer[]; only?: 0 | 1; winner?: number | null; mine: boolean; lang: Lang }) {
  const { t } = useT();
  const places = only === undefined;
  return (
    <div className='bf-board-list bf-board-score-list' data-cols='scoreboard' data-teams={places ? undefined : true}>
      <div className='bf-board-tr bf-board-th'>
        {places && <span data-col='rank'>#</span>}
        <span data-col='player'>{t('player')}</span>
        <StatHead stat='kills' size={14} />
        <StatHead stat='deaths' size={14} />
        <StatHead stat='assists' size={14} />
        <StatHead stat='score' size={14} />
      </div>
      <ol>
        {players.map((p, i) =>
          only !== undefined && p.team !== only ? null : (
            <li key={i} className='bf-board-tr' data-me={p.me || undefined}>
              {places && (
                <span data-col='rank' className='bf-board-rank bf-display'>
                  {i + 1}
                </span>
              )}
              <span data-col='player' className='bf-board-who'>
                <Avatar avatar={{ hero: p.character, image: null }} size={28} />
                <PlayerName name={p.name} tag={null} label={p.me && mine && t('you')} />
                {p.bot && (
                  <span className='bf-board-bot' title={t('bot')}>
                    <span>{t('bot')}</span>
                    <BotIcon size={16} aria-label={t('bot')} />
                  </span>
                )}
                {winner === i && <CrownIcon size={18} className='bf-board-crown' aria-label={t('board.winner')} />}
              </span>
              <span data-col='kills'>{number(lang, p.kills)}</span>
              <span data-col='deaths'>{number(lang, p.deaths)}</span>
              <span data-col='assists'>{number(lang, p.assists)}</span>
              <span data-col='score' className='bf-display bf-board-big'>
                {number(lang, p.score)}
              </span>
            </li>
          )
        )}
      </ol>
    </div>
  );
}

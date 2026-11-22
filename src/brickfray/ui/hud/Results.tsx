import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ScoreRow } from '../../game/hud';
import { TEAM_COLORS } from '../../game/remotes';
import { useGame, useHud } from '../App';
import { mapName } from '../board/format';
import { TrophyIcon } from '../board/icons';
import { useT, type MessageKey } from '../i18n';
import { BotIcon, CrownIcon, DoorIcon, PlayIcon } from '../icons';
import { awardMedals, MedalIcon, type Medal } from './Medal';
import { RankCallout, useOutcome } from './RankCallout';
import { RunHeadline, RunStats } from './RunResult';
import { PLATE, plateColor, Swatch } from './Scoreboard';
import { ordinal, standings } from './standings';
import './results.css';

const BoardPanel = lazy(() => import('../board/BoardPanel'));

const medalKey = (m: Medal) => `results.medal.${m.kind}.${m.tier}` as MessageKey;

/** The end of every match: who placed where with their medals, or how far the run went; then the leaderboard rank. */
export function Results() {
  const hud = useHud();
  const game = useGame();
  const { t, lang } = useT();
  const outcome = useOutcome(hud.settings);
  const [board, setBoard] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const mode = hud.settings?.mode;
  const solo = mode === 'solo';
  const rows = standings(hud.rows, mode, hud.winner);
  const medals = awardMedals(rows);
  const place = rows.findIndex((r) => r.me);
  const mine = place >= 0 ? (medals.get(rows[place]!.id) ?? []) : [];

  let title: string;
  let good = false;
  if (solo) title = t('gameOver');
  else if (mode === 'tdm') {
    good = hud.winner !== null && hud.winner === hud.myTeam;
    title = hud.winner === null ? t('draw') : good ? t('victory') : t('defeat');
  } else {
    good = place >= 0 && rows[place]!.id === hud.winner;
    const winner = rows.find((r) => r.id === hud.winner);
    title = good ? t('victory') : winner ? t('wins', { name: winner.name }) : t('draw');
  }

  // The keyboard starts on the first action.
  useEffect(() => first.current?.focus({ preventScroll: true }), []);

  // Esc closes the board over the results instead of opening the pause menu (Input listens on window, bubbling).
  useEffect(() => {
    if (!board) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      game.audio.play('uiBack');
      setBoard(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [board, game]);

  const openBoard = () => {
    game.audio.play('uiClick');
    setBoard(true);
  };

  return (
    <>
    <div className='bf-results pointer-events-auto' data-solo={solo || undefined} inert={board}>
      <div className='bf-results-card bf-pop'>
        <header className='bf-results-head'>
          <div className='bf-results-title'>
            {good && <CrownIcon size={40} className='shrink-0 text-[var(--bf-yellow)]' />}
            <h2 className={`bf-display ${good ? 'text-[var(--bf-yellow)]' : ''}`}>{title}</h2>
          </div>
          {solo ? (
            <RunHeadline outcome={outcome} />
          ) : (
            <>
              <p className='bf-results-place bf-display'>
                {place >= 0 && t('results.place', { n: ordinal(lang, place + 1), total: rows.length })}
                <span className='bf-results-facts'>
                  {mode && t(`mode.${mode}`)} · {hud.settings && mapName(lang, hud.settings.map)}
                </span>
              </p>
              {mode === 'tdm' && <TeamScore score={hud.teamScore} mine={hud.myTeam} />}
              {mine.length ? (
                <div className='bf-results-medals'>
                  {mine.map((m) => (
                    <div key={m.kind} className='bf-results-medal' data-tier={m.tier}>
                      <MedalIcon medal={m} size={44} />
                      <span className='bf-display'>{t(medalKey(m))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='bf-results-hint'>{t('results.medalHint')}</p>
              )}
            </>
          )}
          <RankCallout outcome={outcome} />
        </header>
        <div className='bf-results-body bf-panel bf-studs'>
          <div className='bf-results-scroll bf-scroll'>{solo ? <RunStats /> : <Standings rows={rows} medals={medals} winner={mode === 'ffa' ? hud.winner : null} />}</div>
        </div>
        <footer className='bf-results-actions'>
          {solo && (
            <button ref={first} className='bf-btn bf-btn-primary' onClick={() => game.startMatch()}>
              <PlayIcon size={20} />
              <span className='font-bold'>{t('playAgain')}</span>
            </button>
          )}
          <button ref={solo ? undefined : first} className='bf-btn bf-btn-blue' onClick={openBoard}>
            <TrophyIcon size={19} />
            <span className='font-semibold'>{t('board.title')}</span>
          </button>
          <button className='bf-btn bf-btn-red' onClick={() => game.leave()}>
            <DoorIcon size={18} />
            <span className='font-semibold'>{t('leave')}</span>
          </button>
          {!solo && <span className='bf-results-lobby'>{t('backToLobby', { n: Math.ceil(hud.phaseLeft) })}</span>}
        </footer>
      </div>
    </div>
      {board && (
        <Suspense fallback={null}>
          <div className='pointer-events-auto absolute inset-0 z-40'>
            <BoardPanel
              onClose={() => {
                game.audio.play('uiBack');
                setBoard(false);
              }}
              onName={() => {}}
            />
          </div>
        </Suspense>
      )}
    </>
  );
}

function TeamScore({ score, mine }: { score: [number, number]; mine: number }) {
  const { t } = useT();
  return (
    <div className='bf-results-teams'>
      {([0, 1] as const).map((team) => (
        <span key={team} className='bf-display' style={{ background: TEAM_COLORS[team], boxShadow: PLATE }} data-mine={mine === team || undefined}>
          {t(`team.${team}`)} <b className='tabular-nums'>{score[team]}</b>
        </span>
      ))}
    </div>
  );
}

/** Everyone in the match in the mode's order, each with the medals they earned. */
function Standings({ rows, medals, winner }: { rows: ScoreRow[]; medals: Map<number, Medal[]>; winner: number | null }) {
  const { t } = useT();
  return (
    <div className='bf-standings' role='table'>
      <div className='bf-standings-head' role='row'>
        <span role='columnheader' aria-label='#' />
        <span role='columnheader' className='pl-1'>
          {t('player')}
        </span>
        <span role='columnheader' />
        <span role='columnheader' className='text-center'>
          {t('kills')}
        </span>
        <span role='columnheader' className='text-center'>
          {t('deaths')}
        </span>
        <span role='columnheader' className='text-center'>
          {t('assists')}
        </span>
        <span role='columnheader' className='text-right'>
          {t('score')}
        </span>
      </div>
      {rows.map((r, i) => (
        <div key={r.id} role='row' className='bf-standings-row' data-me={r.me || undefined} style={{ background: plateColor(r), boxShadow: PLATE }}>
          <span role='cell' className='bf-display bf-standings-place'>
            {i + 1}
          </span>
          <span role='cell' className='bf-standings-name'>
            <Swatch row={r} />
            <span className='truncate'>{r.name}</span>
            {r.id === winner && <CrownIcon size={16} className='shrink-0' />}
            {r.bot && <BotIcon size={16} className='shrink-0 opacity-70' aria-label={t('bot')} />}
          </span>
          <span role='cell' className='bf-standings-medals'>
            {(medals.get(r.id) ?? []).map((m) => (
              <MedalIcon key={m.kind} medal={m} size={22} title={t(medalKey(m))} />
            ))}
          </span>
          <span role='cell' className='bf-standings-num'>
            {r.kills}
          </span>
          <span role='cell' className='bf-standings-num' data-soft>
            {r.deaths}
          </span>
          <span role='cell' className='bf-standings-num' data-soft>
            {r.assists}
          </span>
          <span role='cell' className='bf-standings-score'>
            {r.score}
          </span>
        </div>
      ))}
    </div>
  );
}

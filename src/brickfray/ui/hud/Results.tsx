import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ScoreRow } from '../../game/hud';
import { useGame, useHud } from '../App';
import { TrophyIcon } from '../board/icons';
import { useT } from '../i18n';
import { CrownIcon, DoorIcon, PlayIcon, SkullIcon, UsersIcon } from '../icons';
import { awardMedals, MedalIcon, type Medal } from './Medal';
import { Podium } from './Podium';
import { UnlockStrip } from '../achievements/UnlockStrip';
import { RankBadge, useOutcome } from './RankCallout';
import { AssistsIcon, Confetti, KillsIcon, Ribbon, Tip, type RibbonTone } from './results-art';
import { CountUp, IntroSkipped, useIntro } from './results-intro';
import { medalKey, ResultsTable } from './ResultsTable';
import { RunChips, RunHero } from './RunResult';
import { ordinal, standings } from './standings';
import { TeamBar } from './TeamBar';
import './results.css';
import './results-fx.css';
import './results-podium.css';
import './results-table.css';
import './results-run.css';
import './results-compact.css';

const BoardPanel = lazy(() => import('../board/BoardPanel'));

/**
 * The end of every match, said with shapes rather than sentences: a ribbon with the result, then for a room the
 * podium (the player marked, on their own brick when they finished lower), their medals, kills, deaths, assists and
 * leaderboard badge beside the standings; for a solo run the wave it reached, what ended it and its numbers. The
 * entrance plays once and any input skips it.
 */
export function Results() {
  const hud = useHud();
  const game = useGame();
  const { t, lang } = useT();
  const outcome = useOutcome(hud.settings);
  const root = useRef<HTMLDivElement>(null);
  const skipped = useIntro(root);
  const [board, setBoard] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const mode = hud.settings?.mode;
  const solo = mode === 'solo';
  const teams = mode === 'tdm';
  const rows = standings(hud.rows, mode, hud.winner);
  const medals = awardMedals(rows);
  const place = rows.findIndex((r) => r.me);
  const me = place >= 0 ? rows[place]! : null;

  let tone: RibbonTone = 'slate';
  let title: string;
  let won = false;
  if (solo) {
    tone = 'red';
    title = t('gameOver');
  } else if (teams) {
    won = hud.winner !== null && hud.winner === hud.myTeam;
    tone = hud.winner === null ? 'grey' : won ? 'gold' : 'slate';
    title = hud.winner === null ? t('draw') : won ? t('victory') : t('defeat');
  } else {
    won = !!me && me.id === hud.winner;
    const winner = rows.find((r) => r.id === hud.winner);
    if (won) {
      tone = 'gold';
      title = t('victory');
    } else if (me) {
      tone = place === 1 ? 'silver' : place === 2 ? 'bronze' : 'slate';
      title = t('results.placeTitle', { n: ordinal(lang, place + 1) });
    } else title = winner ? t('wins', { name: winner.name }) : t('draw');
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
      <div ref={root} className='bf-results pointer-events-auto' data-mode={mode} data-won={won || undefined} inert={board}>
        <IntroSkipped value={skipped}>
          {won && <Confetti />}
          <div className='bf-results-grid'>
            <header className='bf-results-top'>
              <Ribbon tone={tone} icon={won ? <CrownIcon className='bf-ribbon-icon' /> : solo ? <SkullIcon className='bf-ribbon-icon' /> : undefined}>
                {title}
              </Ribbon>
            </header>
            {teams && <TeamBar score={hud.teamScore} mine={hud.myTeam} winner={hud.winner} />}
            {solo ? (
              <>
                <section className='bf-results-hero'>
                  <RunHero outcome={outcome} />
                </section>
                <section className='bf-results-side'>
                  <RunChips />
                  <RankBadge outcome={outcome} />
                </section>
              </>
            ) : (
              <>
                <section className='bf-results-hero'>
                  <Podium rows={rows} teams={teams} />
                  {me && <MyLine row={me} medals={medals.get(me.id) ?? []} outcome={<RankBadge outcome={outcome} />} />}
                </section>
                <section className='bf-results-side'>
                  <ResultsTable rows={rows} medals={medals} winner={hud.winner} teams={teams} />
                </section>
              </>
            )}
            <div className='bf-results-unlocks'>
              <UnlockStrip outcome={outcome} />
            </div>
            <footer className='bf-results-actions bf-in'>
              {solo && (
                <button ref={first} className='bf-btn bf-btn-primary' onClick={() => game.startMatch()}>
                  <PlayIcon size={20} />
                  <span className='font-bold'>{t('playAgain')}</span>
                </button>
              )}
              <button ref={solo ? undefined : first} className='bf-btn bf-btn-blue' onClick={openBoard} aria-label={t('board.title')}>
                <TrophyIcon size={19} />
                <span className='font-semibold'>{t('board.title')}</span>
              </button>
              <button className='bf-btn bf-btn-red' onClick={() => game.leave()} aria-label={t('leave')}>
                <DoorIcon size={18} />
                <span className='font-semibold'>{t('leave')}</span>
              </button>
              {!solo && <LobbyRing left={hud.phaseLeft} />}
            </footer>
          </div>
        </IntroSkipped>
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

/** The player's own match in one line: the medals they won, kills, deaths, assists, and their leaderboard badge. */
function MyLine({ row, medals, outcome }: { row: ScoreRow; medals: Medal[]; outcome: ReactNode }) {
  const { t } = useT();
  return (
    <div className='bf-mine'>
      {medals.length > 0 && (
        <span className='bf-mine-medals'>
          {medals.map((m, i) => (
            <Tip key={m.kind} text={t(medalKey(m))} className='bf-mine-medal bf-in' style={{ ['--i' as string]: i }}>
              <MedalIcon medal={m} size={46} />
            </Tip>
          ))}
        </span>
      )}
      <span className='bf-mine-stats'>
        <Tip text={t('results.kills')} className='bf-stat'>
          <KillsIcon size={26} className='text-[#ff6a5a]' />
          <b className='bf-display'>
            <CountUp value={row.kills} delay={0.7} />
          </b>
        </Tip>
        <Tip text={t('results.deaths')} className='bf-stat'>
          <SkullIcon size={26} className='text-white/70' />
          <b className='bf-display'>
            <CountUp value={row.deaths} delay={0.75} />
          </b>
        </Tip>
        <Tip text={t('results.assists')} className='bf-stat'>
          <AssistsIcon size={26} className='text-[#6aa8ff]' />
          <b className='bf-display'>
            <CountUp value={row.assists} delay={0.8} />
          </b>
        </Tip>
      </span>
      {outcome}
    </div>
  );
}

/** The room goes back to its lobby on its own: the seconds left as a ring that empties. */
function LobbyRing({ left }: { left: number }) {
  const { t } = useT();
  const [total] = useState(() => Math.max(1, left));
  const n = Math.max(0, Math.ceil(left));
  const c = 2 * Math.PI * 15;
  return (
    <span className='bf-lobby-ring' role='timer' aria-label={t('backToLobby', { n })} title={t('backToLobby', { n })}>
      <UsersIcon size={20} />
      <span className='bf-lobby-dial'>
        <svg viewBox='0 0 36 36' aria-hidden>
          <circle cx='18' cy='18' r='15' />
          <circle cx='18' cy='18' r='15' strokeDasharray={`${(c * Math.max(0, left)) / total} ${c}`} />
        </svg>
        <b className='bf-display'>{n}</b>
      </span>
    </span>
  );
}

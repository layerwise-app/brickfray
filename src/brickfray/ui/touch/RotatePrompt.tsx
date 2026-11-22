import { useEffect, useState, useSyncExternalStore } from 'react';
import { phoneSized } from '../../game/input-mode';
import { useApp, useGame, useHud } from '../App';
import { useT } from '../i18n';

const PORTRAIT = '(orientation: portrait)';
/** The match is held because the phone is upright. Outlives the HUD remounting as a match loads. */
let holding = false;

function portraitPhone() {
  return phoneSized() && window.matchMedia(PORTRAIT).matches;
}

function onOrientation(fn: () => void) {
  const query = window.matchMedia(PORTRAIT);
  query.addEventListener('change', fn);
  window.addEventListener('resize', fn);
  return () => {
    query.removeEventListener('change', fn);
    window.removeEventListener('resize', fn);
  };
}

/**
 * Phones play matches in landscape: held upright, the match is covered and held (a solo run stops) until the phone
 * turns, then play picks up again. A player who paused first keeps the pause menu, so they can leave without turning.
 * Results stay readable either way.
 */
export function RotatePrompt() {
  const game = useGame();
  const app = useApp();
  const hud = useHud();
  const { t } = useT();
  const portrait = useSyncExternalStore(onOrientation, portraitPhone, () => false);
  const [held, setHeld] = useState(holding);

  // Orientation is the external system: turning upright holds the match, turning back lets it go. Resuming from the
  // pause menu while upright holds it again.
  useEffect(() => {
    const sync = () => {
      const state = game.app.state;
      if (state.screen !== 'match' || game.hud.state.phase === 'ended') {
        holding = false;
        return;
      }
      if (portraitPhone()) {
        if (!state.paused) {
          holding = true;
          game.setPaused(true);
        }
      } else if (holding) {
        holding = false;
        if (state.paused) game.resume();
      }
      setHeld(holding);
    };
    sync();
    const offApp = game.app.subscribe(sync);
    const offTurn = onOrientation(sync);
    return () => {
      offApp();
      offTurn();
    };
  }, [game]);

  if (!portrait || hud.phase === 'ended' || (app.paused && !held)) return null;
  return (
    <div className='bf-rotate pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-[#0b1222] p-8 text-center'>
      <div className='flex flex-col items-center gap-5'>
        <svg className='bf-rotate-phone' width={84} height={84} viewBox='0 0 84 84' aria-hidden>
          <rect x='27' y='8' width='30' height='56' rx='7' fill='none' stroke='#ffffff' strokeWidth={4} />
          <rect x='37' y='14' width='10' height='2.6' rx='1.3' fill='#ffffff' opacity={0.7} />
          <path d='M66 58a26 26 0 0 1-22 18' fill='none' stroke='var(--bf-yellow)' strokeWidth={4} strokeLinecap='round' />
          <path d='M49 70l-6 6 7 4' fill='none' stroke='var(--bf-yellow)' strokeWidth={4} strokeLinecap='round' strokeLinejoin='round' />
        </svg>
        <span className='bf-display text-3xl leading-tight'>{t('touch.rotate')}</span>
        <span className='text-base text-[var(--bf-muted)]'>{t('touch.rotateHint')}</span>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { localMatches } from '../../../lib/board/client/history';
import type { Game } from '../../game/game';
import { useGame } from '../App';
import { useT } from '../i18n';
import { BackIcon } from '../icons';
import { History } from './History';
import { useAccount } from './me';
import { Rankings, type RankFilter } from './Rankings';
import { ScorePanel, type OpenMatch } from './ScorePanel';
import './board.css';
import './board-table.css';
import './score-panel.css';

/** The leaderboard, or the player's own matches (opened from the profile menu). */
export type BoardView = 'ranks' | 'history';

/** Opens on the board of the last thing played, every map. */
function firstFilter(game: Game): RankFilter {
  const last = localMatches().at(-1);
  return { mode: last?.mode ?? 'solo', difficulty: last?.difficulty ?? game.settings.difficulty, map: null };
}

/**
 * A dialog over the menu (or the results screen) with one list: the rankings or the player's own matches. Identity
 * lives in the profile menu, not here. `onName` is unused: the results screen still passes it.
 */
export default function BoardPanel({ view = 'ranks', onClose }: { view?: BoardView; onClose: () => void; onName?: (name: string) => void }) {
  const game = useGame();
  const { t } = useT();
  const [filter, setFilter] = useState(() => firstFilter(game));
  const [match, setMatch] = useState<OpenMatch | null>(null);
  const profile = useAccount().data?.profile ?? null;
  const panel = useRef<HTMLElement>(null);

  // Esc steps back out of an open score panel first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (match) setMatch(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, match]);

  // Focus moves into the dialog so the keyboard starts there.
  useEffect(() => panel.current?.focus(), []);

  // Tab wraps around inside the dialog instead of leaving the page.
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter((el) => el.offsetParent && !el.closest('[inert]'));
    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const openMatch = (next: OpenMatch) => {
    game.audio.play('uiClick');
    setMatch(next);
  };
  const closeMatch = () => {
    game.audio.play('uiBack');
    setMatch(null);
  };

  return (
    <div className='bf-board-backdrop' onClick={onClose}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-board-title' className='bf-panel bf-studs bf-pop bf-board' data-view={view} onClick={(e) => e.stopPropagation()} onKeyDown={trap}>
        <header className='bf-board-head' inert={!!match}>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-touch-target bf-board-back' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-board-title' className='bf-display bf-board-title'>
            {t(view === 'ranks' ? 'board.title' : 'board.myMatches')}
          </h2>
        </header>
        <div className='bf-board-body' inert={!!match}>
          {view === 'ranks' ? <Rankings filter={filter} setFilter={setFilter} onOpen={openMatch} /> : <History player={profile} onOpen={openMatch} />}
        </div>
        {match && <ScorePanel open={match} onClose={closeMatch} />}
      </section>
    </div>
  );
}

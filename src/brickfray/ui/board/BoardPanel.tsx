import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { localMatches } from '../../../lib/board/client/history';
import type { Game } from '../../game/game';
import { useGame } from '../App';
import { useT } from '../i18n';
import { BackIcon } from '../icons';
import { adoptName, joinAccount } from './account';
import { Avatar } from './Avatar';
import { History } from './History';
import { BOARD, useAccount } from './me';
import { PlayerName } from './parts';
import { Profile } from './Profile';
import { Rankings, type RankFilter } from './Rankings';
import { ScorePanel, type OpenMatch } from './ScorePanel';
import './board.css';
import './board-table.css';
import './score-panel.css';

type Tab = 'ranks' | 'history' | 'profile';
const TABS: Tab[] = ['ranks', 'history', 'profile'];

/** Opens on the board of the last thing played, every map. */
function firstFilter(game: Game): RankFilter {
  const last = localMatches().at(-1);
  return { mode: last?.mode ?? 'solo', difficulty: last?.difficulty ?? game.settings.difficulty, map: null };
}

/** The leaderboard screen over the main menu: rankings, the player's own matches, and their profile and sign-in. */
export default function BoardPanel({ onClose, onName }: { onClose: () => void; onName: (name: string) => void }) {
  const game = useGame();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('ranks');
  const [filter, setFilter] = useState(() => firstFilter(game));
  const [match, setMatch] = useState<OpenMatch | null>(null);
  const account = useAccount();
  const client = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  const joining = useRef(false);
  const data = account.data;

  // A session this browser's player has not joined yet (signed in elsewhere in the app, or a join that failed):
  // join it now. An account's name, renamed on another device, replaces the one kept here.
  useEffect(() => {
    if (!data?.signedIn) return;
    if (!data.linked) {
      if (joining.current) return;
      joining.current = true;
      joinAccount(game, onName)
        .then(() => client.invalidateQueries({ queryKey: BOARD }))
        .catch(() => {})
        .finally(() => (joining.current = false));
    } else if (data.profile) {
      adoptName(game, data.profile.name, onName);
    }
  }, [data, game, onName, client]);

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

  const pick = (next: Tab) => {
    if (next !== tab) game.audio.play('uiHover', { volume: 0.6 });
    setTab(next);
  };
  const openMatch = (next: OpenMatch) => {
    game.audio.play('uiClick');
    setMatch(next);
  };
  const closeMatch = () => {
    game.audio.play('uiBack');
    setMatch(null);
  };
  const profile = data?.profile ?? null;

  return (
    <div className='bf-board-backdrop' onClick={onClose}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-board-title' className='bf-panel bf-studs bf-pop bf-board' onClick={(e) => e.stopPropagation()} onKeyDown={trap}>
        <header className='bf-board-head' inert={!!match}>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-board-back' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-board-title' className='bf-display bf-board-title'>
            {t('board.title')}
          </h2>
          <button className='bf-board-chip' onClick={() => pick('profile')} aria-label={t('board.tab.profile')}>
            <Avatar avatar={profile?.avatar} character={game.settings.character} size={32} />
            <PlayerName name={profile?.name || game.settings.name || t('player')} tag={profile?.tag ?? null} />
          </button>
        </header>
        <div className='bf-seg bf-board-tabs' role='tablist' inert={!!match}>
          {TABS.map((id) => (
            <button key={id} role='tab' aria-selected={tab === id} aria-pressed={tab === id} onClick={() => pick(id)}>
              {t(`board.tab.${id}`)}
            </button>
          ))}
        </div>
        <div className='bf-board-body' inert={!!match}>
          {tab === 'ranks' && <Rankings filter={filter} setFilter={setFilter} onOpen={openMatch} />}
          {tab === 'history' && <History player={profile} onOpen={openMatch} />}
          {tab === 'profile' && <Profile account={data} onName={onName} />}
        </div>
        {match && <ScorePanel open={match} onClose={closeMatch} />}
      </section>
    </div>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { localMatches } from '../../../lib/board/client/history';
import type { Game } from '../../game/game';
import { useGame } from '../App';
import { useT } from '../i18n';
import { BackIcon } from '../icons';
import { adoptName, BOARD, joinAccount, useAccount } from './account';
import { Avatar } from './Avatar';
import { History } from './History';
import { Profile } from './Profile';
import { Rankings, type RankFilter } from './Rankings';
import './board.css';

type Tab = 'ranks' | 'history' | 'profile';
const TABS: Tab[] = ['ranks', 'history', 'profile'];

/** Opens on the board of the last thing played. */
function firstFilter(game: Game): RankFilter {
  const last = localMatches().at(-1);
  return { mode: last?.mode ?? 'solo', period: 'week', difficulty: last?.difficulty ?? game.settings.difficulty };
}

/** The leaderboard screen over the main menu: rankings, the player's own matches, and their profile and sign-in. */
export default function BoardPanel({ onClose, onName }: { onClose: () => void; onName: (name: string) => void }) {
  const game = useGame();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('ranks');
  const [filter, setFilter] = useState(() => firstFilter(game));
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus moves into the dialog so the keyboard starts there.
  useEffect(() => panel.current?.focus(), []);

  // Tab wraps around inside the dialog instead of leaving the page.
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter((el) => el.offsetParent);
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

  return (
    <div className='bf-board-backdrop' onClick={onClose}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-board-title' className='bf-panel bf-studs bf-pop bf-board' onClick={(e) => e.stopPropagation()} onKeyDown={trap}>
        <header className='bf-board-head'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-board-back' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-board-title' className='bf-display bf-board-title'>
            {t('board.title')}
          </h2>
          <button className='bf-board-chip' onClick={() => pick('profile')} aria-label={t('board.tab.profile')}>
            <Avatar avatar={data?.profile?.avatar} character={game.settings.character} size={32} />
            <span className='truncate'>{data?.profile?.name || game.settings.name || t('player')}</span>
          </button>
        </header>
        <div className='bf-seg bf-board-tabs' role='tablist'>
          {TABS.map((id) => (
            <button key={id} role='tab' aria-selected={tab === id} aria-pressed={tab === id} onClick={() => pick(id)}>
              {t(`board.tab.${id}`)}
            </button>
          ))}
        </div>
        {tab === 'ranks' && <Rankings filter={filter} setFilter={setFilter} />}
        {tab === 'history' && <History />}
        {tab === 'profile' && <Profile account={data} onName={onName} />}
      </section>
    </div>
  );
}

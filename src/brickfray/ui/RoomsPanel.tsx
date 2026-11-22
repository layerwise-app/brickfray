import { useEffect, useState } from 'react';
import { MATCH } from '../sim/constants';
import { useApp, useGame } from './App';
import { useT } from './i18n';
import { BackIcon, LockIcon, RefreshIcon, UsersIcon } from './icons';

export function RoomsPanel({ onClose }: { onClose: () => void }) {
  const game = useGame();
  const app = useApp();
  const { t } = useT();
  const [code, setCode] = useState('');
  const browsing = app.busy === 'browse';

  // Esc closes it, as it closes every other dialog over the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className='absolute inset-0 z-10 grid place-items-center bg-[#0b1222]/60 p-4 backdrop-blur-sm' onClick={onClose}>
      <div className='bf-panel bf-studs bf-pop flex w-full max-w-[560px] flex-col gap-5 p-6' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center gap-3'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-touch-target !h-11 !w-11' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 className='bf-display text-3xl'>{t('rooms')}</h2>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <button className='bf-btn bf-btn-primary !h-14' onClick={() => void game.createRoom('private')}>
            <LockIcon size={20} />
            <span className='font-bold'>{t('createPrivate')}</span>
          </button>
          <button className='bf-btn bf-btn-blue !h-14' onClick={() => void game.createRoom('public')}>
            <UsersIcon size={20} />
            <span className='font-bold'>{t('createPublic')}</span>
          </button>
        </div>

        <form
          className='flex gap-3'
          onSubmit={(e) => {
            e.preventDefault();
            void game.joinCode(code);
          }}
        >
          <input
            className='bf-input bf-display flex-1 text-center text-2xl tracking-[0.3em] uppercase'
            placeholder={t('codePlaceholder')}
            value={code}
            maxLength={8}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className='bf-btn bf-btn-primary' disabled={code.trim().length < 4}>
            <span className='font-bold'>{t('join')}</span>
          </button>
        </form>

        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bf-muted)]'>{t('publicRooms')}</h3>
            <button className='bf-btn bf-btn-ghost bf-touch-target !h-9 !px-3 text-sm' onClick={() => void game.browse()} disabled={browsing}>
              <RefreshIcon size={16} className={browsing ? 'animate-spin' : ''} />
              {t('refresh')}
            </button>
          </div>
          <div className='bf-scroll flex max-h-64 flex-col gap-2 overflow-y-auto'>
            {browsing && !app.lobbies && <div className='py-4 text-center text-[var(--bf-muted)]'>{t('busy.browse')}</div>}
            {!browsing && app.lobbies?.length === 0 && <div className='py-4 text-center text-[var(--bf-muted)]'>{t('noRooms')}</div>}
            {app.lobbies?.map(({ slot, lobby }) => (
              <button key={slot} className='flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-left hover:bg-white/10' onClick={() => void game.joinSlot(slot)}>
                <span className='bf-display text-xl'>{lobby.hostName}</span>
                <span className='text-sm text-[var(--bf-muted)]'>
                  {t(`mode.${lobby.settings.mode}`)} · {t(`map.${lobby.settings.map}`)}
                </span>
                <span className='ml-auto text-sm font-semibold'>{lobby.phase === 'playing' ? t('inMatch') : t('inLobby')}</span>
                <span className='bf-display text-lg'>
                  {lobby.count}/{Math.max(lobby.count, Math.min(lobby.settings.seats, MATCH.maxPlayers))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

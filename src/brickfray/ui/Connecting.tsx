import { useEffect } from 'react';
import type { AppError } from '../game/app-store';
import { useApp, useGame } from './App';
import { useT } from './i18n';

export function Connecting() {
  const app = useApp();
  const game = useGame();
  const { t } = useT();
  return (
    <div className='absolute inset-0 grid place-items-center bg-[#0b1222]/55 backdrop-blur-sm'>
      <div className='bf-fade-in flex flex-col items-center gap-6'>
        <div className='bf-spinner' />
        <div className='bf-display text-3xl'>{t(`busy.${app.busy ?? 'loading'}`)}</div>
        <button className='bf-btn bf-btn-ghost' onClick={() => game.leave()}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ error }: { error: Exclude<AppError, null> }) {
  const game = useGame();
  const { t } = useT();
  useEffect(() => {
    const timer = setTimeout(() => game.app.set({ error: null }), 6000);
    return () => clearTimeout(timer);
  }, [error, game]);
  return (
    <div className='pointer-events-none absolute inset-x-0 top-6 z-50 flex justify-center px-4'>
      <div role='alert' className='bf-pop pointer-events-auto flex items-center gap-3 rounded-2xl bg-[var(--bf-red)] px-5 py-3 font-semibold shadow-[0_6px_0_#9b2018,0_12px_30px_rgba(0,0,0,.35)]'>
        {t(`error.${error}`)}
        <button className='ml-2 text-xl leading-none opacity-80 hover:opacity-100' onClick={() => game.app.set({ error: null })} aria-label='×'>
          ×
        </button>
      </div>
    </div>
  );
}

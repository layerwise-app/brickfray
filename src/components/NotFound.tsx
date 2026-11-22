import { Link } from '@tanstack/react-router';
import { useT } from '~/brickfray/ui/i18n';
import '~/brickfray/ui/game.css';

/** Any address the game does not have: a lone brick, one line, and the way back to the game. */
export function NotFound() {
  const { t } = useT();
  return (
    <main className='bf-root grid place-items-center p-6'>
      <div className='bf-panel bf-studs flex w-full max-w-[440px] flex-col items-center gap-5 px-8 pb-8 pt-10 text-center'>
        <img src='/brickfray-icon.svg' alt='' width={88} height={88} className='-rotate-6 drop-shadow-[0_8px_0_rgba(0,0,0,.35)]' />
        <div className='flex flex-col gap-2'>
          <span className='bf-display text-6xl leading-none text-[var(--bf-yellow)]'>404</span>
          <h1 className='bf-display text-3xl leading-tight'>{t('notFound.title')}</h1>
          <p className='text-[var(--bf-muted)]'>{t('notFound.body')}</p>
        </div>
        <Link to='/' className='bf-btn bf-btn-primary !h-14 !px-7'>
          <span className='bf-display text-2xl'>{t('notFound.home')}</span>
        </Link>
      </div>
    </main>
  );
}

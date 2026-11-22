import { useEffect, useRef } from 'react';
import { useT } from './i18n';
import { BackIcon, ExternalIcon } from './icons';
import './menu-credits.css';

const AUTHOR = 'devrsi0n';
const AUTHOR_URL = 'https://x.com/devrsi0n';
const TOOL = 'Fable 5.2';

/** Who made the game, in a small card over the menu; Esc or a tap outside closes it. */
export function Credits({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const panel = useRef<HTMLElement>(null);
  const [before, after = ''] = t('credits.builtWith', { tool: '\u0000' }).split('\u0000');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus moves into the card so the keyboard starts there.
  useEffect(() => panel.current?.focus(), []);

  return (
    <div className='bf-credits-backdrop' onClick={onClose}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-credits-title' className='bf-panel bf-studs bf-pop bf-credits' onClick={(e) => e.stopPropagation()}>
        <header className='bf-credits-head'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-touch-target' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-credits-title' className='bf-display bf-credits-title'>
            {t('credits')}
          </h2>
        </header>
        <div className='bf-credits-block'>
          <p className='bf-credits-label'>{t('credits.madeBy')}</p>
          <a className='bf-credits-author' href={AUTHOR_URL} target='_blank' rel='noopener noreferrer'>
            <span className='bf-credits-who'>
              <span className='bf-display bf-credits-name'>{AUTHOR}</span>
              <span className='bf-credits-url'>x.com/{AUTHOR}</span>
            </span>
            <ExternalIcon size={20} />
          </a>
        </div>
        <p className='bf-credits-tool'>
          {before}
          <b>{TOOL}</b>
          {after}
        </p>
      </section>
    </div>
  );
}

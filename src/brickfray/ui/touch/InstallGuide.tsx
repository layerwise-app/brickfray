import { useEffect, useRef, useState, type ReactNode } from 'react';
import { phoneSized, touchCapable } from '../../game/input-mode';
import { canFullscreen } from '../../game/touch-screen';
import { useT, type MessageKey } from '../i18n';
import { BackIcon, FullscreenIcon } from '../icons';
import './install.css';

/** Opened from the home screen (iPhone) or installed and launched as an app. */
function standalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
}

/** A phone whose browser cannot make a page fullscreen (iPhone Safari), not yet running from the home screen. */
export function canInstall() {
  return typeof window !== 'undefined' && phoneSized() && touchCapable() && !canFullscreen() && !standalone();
}

/** Takes the fullscreen button's place where there is no fullscreen: it shows how to play from the home screen. */
export function InstallButton() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!canInstall()) return null;
  return (
    <>
      <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={() => setOpen(true)} aria-label={t('touch.install.button')} title={t('touch.install.button')}>
        <FullscreenIcon size={22} />
      </button>
      {open && <InstallGuide onClose={() => setOpen(false)} />}
    </>
  );
}

const STEPS: { title: MessageKey; hint: MessageKey; icon: ReactNode }[] = [
  { title: 'touch.install.share', hint: 'touch.install.shareHint', icon: <ShareGlyph /> },
  { title: 'touch.install.add', hint: 'touch.install.addHint', icon: <AddGlyph /> },
  { title: 'touch.install.open', hint: 'touch.install.openHint', icon: <img src='/apple-touch-icon.png' alt='' draggable={false} /> }
];

/** Share, Add to Home Screen, open it from there: three pictured steps in a card over the menu. */
function InstallGuide({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => panel.current?.focus(), []);

  return (
    <div className='bf-install-backdrop' onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-install-title' className='bf-panel bf-studs bf-pop bf-install' onClick={(e) => e.stopPropagation()}>
        <header className='bf-install-head'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-install-title' className='bf-display bf-install-title'>
            {t('touch.install.title')}
          </h2>
        </header>
        <p className='bf-install-lead'>{t('touch.install.lead')}</p>
        <ol className='bf-install-steps'>
          {STEPS.map((step, i) => (
            <li key={step.title} className='bf-install-step'>
              <span className='bf-install-art'>
                {step.icon}
                <span className='bf-install-n bf-display'>{i + 1}</span>
              </span>
              <span className='bf-install-what'>{t(step.title)}</span>
              <span className='bf-install-hint'>{t(step.hint)}</span>
            </li>
          ))}
        </ol>
        <button className='bf-btn bf-btn-primary bf-install-ok' onClick={onClose}>
          <span className='font-bold'>{t('touch.install.close')}</span>
        </button>
      </section>
    </div>
  );
}

/** The browser's Share button: a tray with an arrow leaving it. */
function ShareGlyph() {
  return (
    <svg viewBox='0 0 48 48' fill='none' stroke='currentColor' strokeWidth={3.4} strokeLinecap='round' strokeLinejoin='round' aria-hidden>
      <path d='M17 19h-4a3 3 0 0 0-3 3v17a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V22a3 3 0 0 0-3-3h-4' />
      <path d='M24 29V5M16.5 12.5 24 5l7.5 7.5' />
    </svg>
  );
}

/** Add to Home Screen: a plus in a rounded square. */
function AddGlyph() {
  return (
    <svg viewBox='0 0 48 48' fill='none' stroke='currentColor' strokeWidth={3.4} strokeLinecap='round' strokeLinejoin='round' aria-hidden>
      <rect x='8' y='8' width='32' height='32' rx='8' />
      <path d='M24 16v16M16 24h16' />
    </svg>
  );
}

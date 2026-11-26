import { useState } from 'react';
import { useT } from './i18n';

const SEEN = 'brickfray.browserTipSeen';
const CHROME = 'https://www.google.com/chrome/';

/** Desktop Firefox and Safari lack Keyboard Lock: there Esc leaves fullscreen and Ctrl+W closes the tab mid-match. */
function wanted() {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  if (nav.userAgentData?.brands?.some((b) => /Chromium|Google Chrome/.test(b.brand))) return false;
  const ua = nav.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (mobile || !matchMedia('(any-pointer: fine)').matches) return false;
  try {
    return localStorage.getItem(SEEN) !== '1';
  } catch {
    return true;
  }
}

export function BrowserTip() {
  const { t } = useT();
  const [open, setOpen] = useState(wanted);
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      // Blocked storage: the tip comes back next visit.
    }
  };
  return (
    <div role='status' className='bf-panel bf-pop absolute right-0 top-[calc(100%+12px)] z-10 flex w-[320px] flex-col gap-2 p-4 text-left'>
      <b className='text-[15px] leading-tight'>{t('browserTip.title')}</b>
      <p className='text-[13px] leading-snug text-[var(--bf-muted)]'>{t('browserTip.body')}</p>
      <div className='mt-1 flex gap-2'>
        <a className='bf-btn bf-btn-blue !h-10 flex-1 whitespace-nowrap text-sm font-semibold' href={CHROME} target='_blank' rel='noreferrer'>
          {t('browserTip.get')}
        </a>
        <button className='bf-btn bf-btn-ghost !h-10 flex-1 whitespace-nowrap text-sm font-semibold' onClick={dismiss}>
          {t('browserTip.ok')}
        </button>
      </div>
    </div>
  );
}

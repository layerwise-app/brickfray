import { useEffect, useState, useSyncExternalStore } from 'react';
import { getOutcome, subscribeOutcome } from '../../../lib/board/client/outcome';
import { useApp } from '../App';
import { useT } from '../i18n';

const SECONDS = 6;

/** A solo run left before its end is still recorded: back on the menu, a note says so and at which wave. */
export function RunSaved() {
  const app = useApp();
  const { t } = useT();
  const outcome = useSyncExternalStore(subscribeOutcome, getOutcome, getOutcome);
  const [done, setDone] = useState<string | null>(null);
  const key = outcome?.left ? outcome.report.key : null;
  const show = !!key && key !== done && app.screen === 'menu';

  // A timer: the note leaves on its own.
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setDone(key), SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [show, key]);

  if (!show || !outcome) return null;
  return (
    <div className='bf-run-saved pointer-events-auto absolute left-1/2 top-[max(16px,env(safe-area-inset-top))] z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#0b1222]/92 py-2.5 pl-3 pr-5 shadow-[inset_0_2px_0_rgba(255,255,255,.12),0_6px_0_rgba(0,0,0,.35)]' role='status' onClick={() => setDone(key)}>
      <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bf-yellow)] text-xl font-black text-[#2a1a00] shadow-[inset_0_-3px_0_rgba(0,0,0,.2)]'>✓</span>
      <span className='flex flex-col'>
        <span className='bf-display text-2xl leading-tight'>{t('results.saved', { n: outcome.report.wave })}</span>
        <span className='text-sm font-semibold text-white/75'>{t('results.savedScore', { n: outcome.report.score })}</span>
      </span>
    </div>
  );
}

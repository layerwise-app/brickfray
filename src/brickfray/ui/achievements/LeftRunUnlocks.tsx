import { useSyncExternalStore } from 'react';
import { getOutcome, subscribeOutcome } from '../../../lib/board/client/outcome';
import { useApp } from '../App';
import { UnlockToasts } from './UnlockToasts';

/** Back on the menu after leaving a solo run early: what that run unlocked. */
export function LeftRunUnlocks() {
  const app = useApp();
  const outcome = useSyncExternalStore(subscribeOutcome, getOutcome, getOutcome);
  if (app.screen !== 'menu' || !outcome?.left) return null;
  return (
    <div className='bf-ach-hud'>
      <UnlockToasts outcome={outcome} />
    </div>
  );
}

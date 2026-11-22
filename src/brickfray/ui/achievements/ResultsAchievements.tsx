import { useHud } from '../App';
import { useMatchOutcome } from './model';
import { UnlockToasts } from './UnlockToasts';

/** Over the end-of-match screen: the unlock toasts in the top corner. */
export function ResultsAchievements() {
  const hud = useHud();
  const outcome = useMatchOutcome(hud.settings);
  return (
    <div className='bf-ach-hud'>
      <UnlockToasts outcome={outcome} />
    </div>
  );
}

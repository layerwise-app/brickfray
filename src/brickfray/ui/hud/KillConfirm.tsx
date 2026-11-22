import { TEAM_COLORS } from '../../game/remotes';
import { useHud } from '../App';
import { useT } from '../i18n';
import { HeadshotIcon, SkullIcon } from '../icons';
import { BountyChip } from './Bounty';

const HEAD_GOLD = '#ffd23f';
const KEYFRAMES = `@keyframes bf-kill-confirm {
  0% { opacity: 0; transform: translate(-50%, 0) scale(1.45); }
  10% { opacity: 1; transform: translate(-50%, 0) scale(0.96); }
  16% { transform: translate(-50%, 0) scale(1); }
  78% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -6px) scale(0.97); }
}`;

/**
 * Under the crosshair for 1.2 s after the local player takes someone down: a skull, the word, the victim's name
 * and the headshot reticle when it was one. Keyed by the feed entry, so each new kill plays it once; it ends at opacity 0.
 */
export function KillConfirm() {
  const hud = useHud();
  const { t } = useT();
  const kill = [...hud.feed].reverse().find((f) => f.mine && !f.self);
  // Stays mounted through death and respawn, so an old kill never replays.
  if (!kill) return null;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        key={kill.key}
        className='absolute left-1/2 top-[calc(50%+78px)] flex items-center gap-2 whitespace-nowrap rounded-xl bg-black/55 py-1 pl-2 pr-3 shadow-[0_3px_0_rgba(0,0,0,.35)]'
        style={{ animation: 'bf-kill-confirm 1.2s ease-out both', visibility: hud.alive ? 'visible' : 'hidden', border: kill.headshot ? `2px solid ${HEAD_GOLD}` : '2px solid rgba(255,255,255,.18)' }}
      >
        <SkullIcon size={22} className='text-[#ff4a3d] drop-shadow-[0_1px_0_rgba(0,0,0,.6)]' />
        <span className='bf-display bf-hud-text text-lg uppercase leading-none tracking-wide text-white/85'>{t('eliminated')}</span>
        <span className='bf-display bf-hud-text text-2xl leading-none' style={{ color: kill.victimTeam !== -1 ? TEAM_COLORS[kill.victimTeam] : '#ffffff' }}>
          {kill.victim}
        </span>
        {/* The gold HEADSHOT callout above says it in words; the tag here is its reticle. */}
        {kill.headshot && <HeadshotIcon size={20} className='drop-shadow-[0_1px_0_rgba(0,0,0,.6)]' style={{ color: HEAD_GOLD }} />}
        {kill.bounty > 0 && <BountyChip amount={kill.bounty} collected />}
      </div>
    </>
  );
}

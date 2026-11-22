import type { SVGProps } from 'react';
import type { KillCause } from '../../sim/types';
import { useHud } from '../App';
import { useT } from '../i18n';
import { Avatar } from '../board/Avatar';
import { SkullIcon, WeaponIcon } from '../icons';
import { KillsIcon } from './results-art';
import { LOW_HEALTH } from './Vitals';
import { shownName } from './names';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Two waves under a falling drop, on the 64×24 grid of the weapon silhouettes. */
export function WaterIcon({ size = 64, ...rest }: IconProps) {
  return (
    <svg width={size} height={(size * 24) / 64} viewBox='0 0 64 24' fill='currentColor' aria-hidden {...rest}>
      <path d='M32 0.5C29.8 3.6 26.4 6.4 26.4 9a5.6 5.6 0 0 0 11.2 0C37.6 6.4 34.2 3.6 32 0.5z' />
      <path d='M10 17.5q4-4 8 0t8 0t8 0t8 0t8 0t8 0M10 22.6q4-4 8 0t8 0t8 0t8 0t8 0t8 0' fill='none' stroke='currentColor' strokeWidth={2.8} strokeLinecap='round' />
    </svg>
  );
}

/** What a kill was dealt with: a weapon's silhouette, or the world's hazard. */
export function CauseIcon({ cause, size, ...rest }: IconProps & { cause: KillCause }) {
  if (cause === 'water') return <WaterIcon size={size} {...rest} />;
  return <WeaponIcon weapon={cause} size={size} {...rest} />;
}

/**
 * Who or what took the player out, and the seconds until the host brings them back. A player who did it gets a card:
 * their portrait, the weapon, the health they had left and their streak.
 */
export function Death() {
  const hud = useHud();
  const { t } = useT();
  const d = hud.death!;
  const water = d.weapon === 'water';
  const second = Math.ceil(hud.respawnLeft);
  const room = hud.settings?.mode !== 'solo';
  const by = d.killer ? d.by : null;
  return (
    <div className='bf-death bf-fade-in absolute inset-x-0 bottom-[4%] flex origin-bottom flex-col items-center justify-center gap-2 [@media(max-height:480px)]:scale-[0.7] [@media(max-height:480px)]:flex-row'>
      <div className='bf-death-card flex items-center gap-4 rounded-2xl bg-[#0b1222]/80 py-2.5 pl-2.5 pr-5 shadow-[inset_0_2px_0_rgba(255,255,255,.1),0_5px_0_rgba(0,0,0,.4)]'>
        {by ? (
          <span className='relative shrink-0'>
            <Avatar character={by.character} size={64} className='bf-death-face' />
            <SkullIcon size={22} className='absolute -bottom-1 -right-1 rounded-full bg-[#0b1222] p-[3px] text-[var(--bf-red)]' />
          </span>
        ) : (
          <SkullIcon size={26} className='ml-2 text-[var(--bf-red)]' />
        )}
        <div className='flex min-w-0 flex-col gap-1.5'>
          <div className='flex items-center gap-3'>
            <span className='bf-display truncate text-3xl leading-none'>{water ? t('fellInWater') : d.killer ? t('eliminatedBy', { name: shownName(t, d.killer, d.by?.character) }) : t('eliminatedSelf')}</span>
            <CauseIcon cause={d.weapon} size={56} className={`shrink-0 ${water ? 'text-[#7cc8ff]' : 'text-white/80'}`} />
          </div>
          {by && room && (
            <div className='flex items-center gap-4'>
              {by.health !== null && <KillerHealth health={by.health} max={by.maxHealth} label={t('death.health')} />}
              {by.streak >= 2 && (
                <span className='flex items-center gap-1.5' title={t('death.streak')}>
                  <KillsIcon size={16} className='text-[#ff6a5a]' />
                  <b className='bf-display text-xl leading-none tabular-nums'>{by.streak}</b>
                  <small className='text-[11px] font-bold uppercase tracking-[0.08em] text-white/70'>{t('death.streak')}</small>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {room && (
        // A solid plate: over a light wall a bare label disappears.
        <div className='bf-death-timer flex min-h-[56px] items-center gap-4 rounded-2xl bg-[#0b1222]/90 px-6 py-1.5 shadow-[inset_0_2px_0_rgba(255,255,255,.12),0_5px_0_rgba(0,0,0,.4)]'>
          <span className='text-base font-bold uppercase tracking-[0.2em] text-white'>{second > 0 ? t('respawnIn') : t('respawning')}</span>
          {second > 0 && (
            <span key={second} className='bf-display bf-pop text-5xl leading-none tabular-nums text-[var(--bf-yellow)]'>
              {second}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The killer's health when they took the player out: a short bar of bricks, ten health each, and the number. */
function KillerHealth({ health, max, label }: { health: number; max: number; label: string }) {
  const cells = Math.max(1, Math.ceil(max / 10));
  const low = health < max * LOW_HEALTH;
  return (
    <span className='flex items-center gap-2' title={label}>
      <span className='flex gap-[2px]' aria-hidden>
        {Array.from({ length: cells }, (_, i) => {
          const part = Math.min(1, Math.max(0, (health - i * 10) / 10));
          return (
            <i key={i} className='relative h-3 w-2 overflow-hidden rounded-[2px] bg-white/15'>
              <i className='absolute inset-y-0 left-0' style={{ width: `${part * 100}%`, background: low ? '#ff4a3d' : '#f4f6fb' }} />
            </i>
          );
        })}
      </span>
      <b className='bf-display text-xl leading-none tabular-nums' style={{ color: low ? '#ff6a5c' : undefined }}>
        {Math.max(0, Math.ceil(health))}
      </b>
      <small className='text-[11px] font-bold uppercase tracking-[0.08em] text-white/70'>{label}</small>
    </span>
  );
}

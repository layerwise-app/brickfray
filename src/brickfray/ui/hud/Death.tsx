import type { SVGProps } from 'react';
import type { KillCause } from '../../sim/types';
import { useHud } from '../App';
import { useT } from '../i18n';
import { SkullIcon, WeaponIcon } from '../icons';

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

/** Who or what took the player out, and the seconds until the host brings them back. */
export function Death() {
  const hud = useHud();
  const { t } = useT();
  const d = hud.death!;
  const water = d.weapon === 'water';
  const second = Math.ceil(hud.respawnLeft);
  return (
    <div className='bf-fade-in absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-2'>
      <div className='flex items-center gap-3 rounded-2xl bg-black/55 px-5 py-3'>
        <SkullIcon size={26} className='text-[var(--bf-red)]' />
        <span className='bf-display text-3xl'>{water ? t('fellInWater') : d.killer ? t('eliminatedBy', { name: d.killer }) : t('eliminatedSelf')}</span>
        <CauseIcon cause={d.weapon} size={56} className={water ? 'text-[#7cc8ff]' : 'text-white/80'} />
      </div>
      {hud.settings?.mode !== 'solo' && (
        // A solid plate: over a light wall a bare label disappears.
        <div className='flex min-h-[64px] items-center gap-4 rounded-2xl bg-[#0b1222]/90 px-6 py-2 shadow-[inset_0_2px_0_rgba(255,255,255,.12),0_5px_0_rgba(0,0,0,.4)]'>
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

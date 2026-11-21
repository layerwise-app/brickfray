import { maxLevel, UPGRADE_IDS, type UpgradeId, type UpgradeLevels } from '../../sim/upgrades';
import { useT } from '../i18n';
import { UPGRADE_LOOK, UpgradeIcon } from './UpgradeIcon';

/** The upgrades held, as small bricks with their level: on the scoreboard during a run and in its summary. */
export function UpgradeList({ levels, order }: { levels: UpgradeLevels; order?: readonly UpgradeId[] }) {
  const { t } = useT();
  const ids = order ? [...new Set(order)] : UPGRADE_IDS.filter((id) => levels[id] > 0);
  if (!ids.length) return <span className='text-sm font-semibold text-[var(--bf-muted)]'>{t('upgrade.none')}</span>;
  return (
    <div className='flex flex-wrap gap-2'>
      {ids.map((id) => {
        const look = UPGRADE_LOOK[id];
        return (
          <div key={id} className='flex items-center gap-2 rounded-[10px] bg-white/[.08] py-1 pl-1 pr-2.5 shadow-[inset_0_-2px_0_rgba(0,0,0,.25)]'>
            <span className='grid h-8 w-8 place-items-center rounded-[7px]' style={{ background: look.color, boxShadow: `inset 0 2px 0 rgba(255,255,255,.3), 0 2px 0 ${look.lip}` }}>
              <UpgradeIcon id={id} size={24} style={{ color: look.ink, ['--bf-upgrade-tile' as string]: look.color }} />
            </span>
            <span className='text-sm font-bold'>{t(`upgrade.name.${id}`)}</span>
            <span className='flex gap-[3px]'>
              {Array.from({ length: maxLevel(id) }, (_, i) => (
                <span key={i} className='h-2 w-2 rounded-full' style={{ background: i < levels[id] ? look.color : 'rgba(255,255,255,.16)' }} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

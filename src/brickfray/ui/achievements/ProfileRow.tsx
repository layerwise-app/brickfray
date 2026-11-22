import type { SVGProps } from 'react';
import { number } from '../board/format';
import { ChevronIcon } from '../board/icons';
import { useT } from '../i18n';
import { useAchievements } from './model';
import './achievements.css';

/** A two-stud brick with a star pressed into it: the achievements. */
export function AchievementsIcon({ size = 24, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden {...rest}>
      <path
        fillRule='evenodd'
        d='M5 2.5h4.4V5h5.2V2.5H19V5h1.2A1.8 1.8 0 0 1 22 6.8v12.4a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 19.2V6.8A1.8 1.8 0 0 1 3.8 5H5zM12 7.6l1.55 3.15 3.45.5-2.5 2.44.6 3.45L12 15.5l-3.1 1.64.6-3.45L7 11.25l3.45-.5z'
      />
    </svg>
  );
}

/** The profile menu's way to the achievements, with how many tiers the player holds. */
export function AchievementsRow({ onOpen }: { onOpen: () => void }) {
  const { t, lang } = useT();
  const query = useAchievements();
  const data = query.data && !('refused' in query.data) ? query.data : null;
  return (
    <button className='bf-me-row bf-ach-row' onClick={onOpen}>
      <AchievementsIcon size={20} />
      <span>{t('ach.title')}</span>
      {data && (
        <b className='bf-ach-row-count'>
          {number(lang, data.unlocked)} / {number(lang, data.total)}
        </b>
      )}
      <ChevronIcon size={16} flip />
    </button>
  );
}

import { useId } from 'react';
import { achievement, type AchievementId } from '../../../lib/achievements/catalogue';
import { EMBLEMS } from './emblems';

/** A tier's plastic: face light/dark, the rim and lip below, the emblem's ink. Locked badges are grey. */
export interface Metal {
  light: string;
  dark: string;
  rim: string;
  ink: string;
}

export const LOCKED: Metal = { light: '#56627a', dark: '#3a4459', rim: '#232a3a', ink: '#8792a8' };

/** Bronze, silver, gold, then emerald, sapphire, ruby, and black with gold lettering for the seventh. */
export const METALS: readonly Metal[] = [
  { light: '#f7b98a', dark: '#c8743c', rim: '#7d4219', ink: '#5a2c0c' },
  { light: '#f4f8ff', dark: '#b9c4d6', rim: '#6f7c92', ink: '#47536a' },
  { light: '#ffe680', dark: '#f0b400', rim: '#a86f00', ink: '#7a4d00' },
  { light: '#9ff2bd', dark: '#25b060', rim: '#0f6633', ink: '#08401f' },
  { light: '#a9cdff', dark: '#3a7bf0', rim: '#1b4396', ink: '#0d2b6b' },
  { light: '#ffa6b4', dark: '#de2f49', rim: '#83122a', ink: '#5a0716' },
  { light: '#3a4664', dark: '#141a2b', rim: '#c99a1c', ink: '#ffd23f' }
];

/** The look of a reached tier (1-based); 0 is locked. An achievement with a single goal wears gold. */
export function metalOf(id: AchievementId, tier: number): Metal {
  if (tier <= 0) return LOCKED;
  if (achievement(id).tiers.length === 1) return METALS[2]!;
  return METALS[Math.min(tier, METALS.length) - 1]!;
}

/**
 * How dressed up a reached badge is, by its metal (1 bronze … 7 black and gold; a single-goal badge counts as gold):
 * silver gains a bright trim and two rivets, gold four rivets and a shine, the gem tiers gem studs and a gold trim.
 */
function trimOf(id: AchievementId, tier: number) {
  if (tier <= 0) return 0;
  return achievement(id).tiers.length === 1 ? 3 : Math.min(tier, METALS.length);
}

const GOLD_TRIM = '#ffd23f';

/**
 * An achievement as a toy brick seen from the front: two studs on top, a plastic face in the tier's colour with a
 * raised inner panel, and the achievement's emblem pressed into it. Higher tiers add trim (see trimOf). `tier` 0 draws
 * it locked.
 */
export function Badge({ id, tier, size = 48, title }: { id: AchievementId; tier: number; size?: number; title?: string }) {
  const uid = useId();
  const m = metalOf(id, tier);
  const locked = tier <= 0;
  const trim = trimOf(id, tier);
  const gem = trim >= 4;
  const band = gem ? GOLD_TRIM : trim >= 2 ? '#fff' : m.rim;
  const rivets = trim >= 3 ? RIVETS : trim === 2 ? RIVETS.slice(0, 2) : [];
  return (
    <svg width={size} height={size} viewBox='0 0 48 48' role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className='bf-ach-badge shrink-0' data-trim={trim}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${uid}f`} x1='0' y1='0' x2='0.35' y2='1'>
          <stop offset='0' stopColor={m.light} />
          <stop offset='1' stopColor={m.dark} />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <rect x='3' y='6' width='42' height='35' rx='7' />
        </clipPath>
      </defs>
      {/* studs: plastic, or cut gems from the fourth tier */}
      {[10, 29].map((x) => (
        <g key={x}>
          <rect x={x} y='2.5' width='9' height='7' rx='2' fill={gem ? GOLD_TRIM : m.rim} />
          <rect x={x} y='2' width='9' height='5.4' rx='2' fill={`url(#${uid}f)`} />
          {gem && <path d={`M${x + 1.6} 4.6l2.9-2.2 2.9 2.2-2.9 2.3z`} fill='#fff' fillOpacity='.75' />}
        </g>
      ))}
      {/* drop shadow, lip, face */}
      <rect x='3' y='9.5' width='42' height='37' rx='7' fill='rgba(0,0,0,.35)' />
      <rect x='3' y='7' width='42' height='38' rx='7' fill={gem ? GOLD_TRIM : m.rim} />
      <rect x='3' y='6' width='42' height='35' rx='7' fill={`url(#${uid}f)`} />
      {trim >= 3 && (
        <path d='M3 30L33 6h9L3 38z' fill='#fff' fillOpacity='.16' clipPath={`url(#${uid}c)`} />
      )}
      <rect x='7.5' y='10.5' width='33' height='26' rx='4.5' fill='none' stroke={band} strokeOpacity={trim >= 2 ? 0.85 : 0.4} strokeWidth={trim >= 2 ? 1.8 : 1.4} />
      {gem && <rect x='5.3' y='8.3' width='37.4' height='30.4' rx='6' fill='none' stroke={GOLD_TRIM} strokeOpacity='.7' strokeWidth='1' />}
      {rivets.map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r='1.7' fill={gem ? GOLD_TRIM : m.light} stroke={m.rim} strokeWidth='.8' />
      ))}
      <path d='M8 14.5V12.5a4 4 0 0 1 4-4h8' stroke='#fff' strokeOpacity={locked ? 0.25 : 0.6} strokeWidth='2' strokeLinecap='round' fill='none' />
      <g transform='translate(12 11.5)' color={m.ink} fill={m.ink} opacity={locked ? 0.75 : 1}>
        {EMBLEMS[id]}
      </g>
    </svg>
  );
}

/** Rivets in the face's corners, outside the inner panel: top pair first. */
const RIVETS: readonly [number, number][] = [
  [5.6, 9.3],
  [42.4, 9.3],
  [5.6, 37.6],
  [42.4, 37.6]
];

/** A tiered achievement's tiers as a row of pips, each reached one in its metal; one goal shows none. */
export function TierPips({ id, tier, className = '' }: { id: AchievementId; tier: number; className?: string }) {
  const tiers = achievement(id).tiers.length;
  if (tiers < 2) return null;
  return (
    <span className={`bf-ach-pips ${className}`} aria-hidden>
      {Array.from({ length: tiers }, (_, i) => (
        <i key={i} data-on={i < tier || undefined} style={i < tier ? { background: metalOf(id, i + 1).dark } : { boxShadow: `inset 0 0 0 1.5px ${metalOf(id, i + 1).dark}` }} />
      ))}
    </span>
  );
}

import type { ReactNode } from 'react';
import type { AchievementId } from '../../../lib/achievements/catalogue';
import { WeaponIcon } from '../icons';
import type { ModelId } from '../../weapons/model';

// The picture on each badge, drawn in the badge's ink on a 24 × 24 grid centred on its face.

/** A weapon silhouette laid across the face: the part of its 64 × 24 icon from `from` to `to` fills `width`. */
function Weapon({ id, from, to, width }: { id: ModelId; from: number; to: number; width: number }) {
  const h = (width * 24) / (to - from);
  return (
    <svg x={12 - width / 2} y={12 - h / 2} width={width} height={h} viewBox={`${from} 0 ${to - from} 24`} overflow='visible'>
      <WeaponIcon weapon={id} size={64} />
    </svg>
  );
}

/** Studs seen from above, as many as the chain is long. */
function Studs({ n }: { n: number }) {
  const at: Record<number, [number, number][]> = {
    2: [[7, 12], [17, 12]],
    3: [[5, 12], [12, 12], [19, 12]],
    4: [[7.5, 7.5], [16.5, 7.5], [7.5, 16.5], [16.5, 16.5]],
    5: [[6, 6], [18, 6], [12, 12], [6, 18], [18, 18]]
  };
  const r = n <= 3 ? 4 : n === 4 ? 4 : 3.3;
  return (
    <g>
      {at[n]!.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} />
          <circle cx={x - r * 0.28} cy={y - r * 0.28} r={r * 0.42} fill='#fff' fillOpacity='.32' />
        </g>
      ))}
    </g>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Wave({ level }: { level: 1 | 2 | 3 }) {
  return (
    <g>
      <path d='M2 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3' {...stroke} strokeWidth={2.6} />
      <path d='M2 20.5c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3' {...stroke} strokeWidth={2} opacity={0.55} />
      {Array.from({ length: level }, (_, i) => (
        <path key={i} d={`M${12 - (level - 1) * 3.2 + i * 6.4 - 2.6} 8.5l2.6-3.4 2.6 3.4`} {...stroke} strokeWidth={2.2} />
      ))}
    </g>
  );
}

function Crown({ y = 0, scale = 1 }: { y?: number; scale?: number }) {
  return <path transform={`translate(${12 - 12 * scale} ${y}) scale(${scale})`} d='M3 9l4.5 3.6L12 5.5l4.5 7.1L21 9l-1.8 9.5H4.8z' />;
}

/** Three small bricks of different heights: a set. */
function HeroSet({ crowned }: { crowned?: boolean }) {
  const top = crowned ? 4 : 0;
  return (
    <g>
      <rect x='2.5' y={11 + top / 2} width='6' height={10 - top / 2} rx='1.2' />
      <rect x='3.7' y={9.4 + top / 2} width='3.6' height='2' rx='.8' />
      <rect x='9' y={7 + top} width='6' height={14 - top} rx='1.2' />
      <rect x='10.2' y={5.4 + top} width='3.6' height='2' rx='.8' />
      <rect x='15.5' y={13 + top / 2} width='6' height={8 - top / 2} rx='1.2' />
      <rect x='16.7' y={11.4 + top / 2} width='3.6' height='2' rx='.8' />
      {crowned && <Crown y={-3.2} scale={0.48} />}
    </g>
  );
}

export const EMBLEMS: Record<AchievementId, ReactNode> = {
  kills: (
    <g {...stroke}>
      <circle cx='12' cy='12' r='6.5' />
      <path d='M12 1.8v4.4M12 17.8v4.4M1.8 12h4.4M17.8 12h4.4' />
      <circle cx='12' cy='12' r='1.6' fill='currentColor' stroke='none' />
    </g>
  ),
  assists: (
    <g {...stroke} strokeWidth={2.6}>
      <circle cx='8.3' cy='12' r='5.6' />
      <circle cx='15.7' cy='12' r='5.6' />
    </g>
  ),
  headshots: (
    <g>
      <circle cx='12' cy='12' r='9.5' {...stroke} />
      <circle cx='12' cy='12' r='5.4' {...stroke} />
      <circle cx='12' cy='12' r='2' />
      <path d='M21.5 2.5l-7.6 7.6' {...stroke} strokeWidth={2.2} />
      <path d='M21.8 2.2l-.6 4.2-3.6-.6zM22 2l-4.2.6.6 3.6z' />
    </g>
  ),
  sidearm: <Weapon id='pistol' from={14} to={48} width={23} />,
  melee: <Weapon id='mallet' from={7} to={55} width={25} />,
  grenade: <Weapon id='grenade' from={21} to={50} width={21} />,
  longshot: (
    <g>
      <Weapon id='sniper' from={0} to={64} width={25} />
      <path d='M3 4.5h4M3 4.5v2M21 4.5h-4M21 4.5v2' {...stroke} strokeWidth={1.8} opacity={0.7} />
    </g>
  ),
  airborne: (
    <g>
      <path d='M12 3l5.2 6.2h-3.2V15h-4V9.2H6.8z' />
      <path d='M4.5 13.5L2 19.5M8.5 17.5L7 21.5M15.5 17.5L17 21.5M19.5 13.5L22 19.5' {...stroke} strokeWidth={2} />
    </g>
  ),
  double: <Studs n={2} />,
  triple: <Studs n={3} />,
  quad: <Studs n={4} />,
  penta: <Studs n={5} />,
  bounty: (
    <g>
      <circle cx='12' cy='12' r='9.6' {...stroke} strokeWidth={2.2} />
      <path d='M12 5.6l1.9 4 4.3.6-3.1 3 .8 4.3L12 15.5l-3.9 2 .8-4.3-3.1-3 4.3-.6z' />
    </g>
  ),
  matches: (
    <g>
      <rect x='3' y='14' width='18' height='7.5' rx='1.4' />
      <rect x='5' y='11.8' width='4' height='2.4' rx='.8' />
      <rect x='15' y='11.8' width='4' height='2.4' rx='.8' />
      <rect x='7' y='5.8' width='14' height='7' rx='1.4' opacity={0.75} />
      <rect x='9' y='3.6' width='4' height='2.4' rx='.8' opacity={0.75} />
      <rect x='15' y='3.6' width='4' height='2.4' rx='.8' opacity={0.75} />
    </g>
  ),
  winFfa: <Crown y={1} />,
  winTdm: (
    <g>
      <path d='M6 21.5V3.5' {...stroke} strokeWidth={2.2} />
      <path d='M18 21.5V3.5' {...stroke} strokeWidth={2.2} />
      <path d='M7 4h9l-2.2 3.3L16 10.6H7z' />
      <path d='M17 6h-9l2.2 3.3L8 12.6h9z' opacity={0.7} />
    </g>
  ),
  flawless: (
    <g>
      <path d='M12 2.5l8 3v6.3c0 4.8-3.4 8.4-8 9.9-4.6-1.5-8-5.1-8-9.9V5.5z' />
      <path d='M8 12.2l2.8 2.8 5.4-5.6' fill='none' stroke='#fff' strokeOpacity='.92' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' />
    </g>
  ),
  medals: (
    <g>
      <path d='M6.5 2h4.4l2.6 7.4-3.6 1.4zM17.5 2h-4.4l-2.6 7.4 3.6 1.4z' opacity={0.7} />
      <circle cx='12' cy='15.2' r='6.8' />
      <path d='M12 11.4l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 17.4l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z' fill='#fff' fillOpacity='.85' />
    </g>
  ),
  waveEasy: <Wave level={1} />,
  waveNormal: <Wave level={2} />,
  waveHard: <Wave level={3} />,
  megabot: (
    <g>
      <rect x='2.5' y='7' width='19' height='14' rx='3.4' />
      <rect x='10.5' y='2' width='3' height='5.4' rx='1' />
      <circle cx='12' cy='14' r='4' fill='#fff' fillOpacity='.9' />
      <circle cx='12' cy='14' r='1.8' />
      <path d='M5 10.5l3 2M19 10.5l-3 2' fill='none' stroke='#fff' strokeOpacity='.9' strokeWidth='1.8' strokeLinecap='round' />
    </g>
  ),
  roster: <HeroSet />,
  rosterWins: <HeroSet crowned />
};

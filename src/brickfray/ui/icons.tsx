import type { SVGProps } from 'react';
import type { WeaponId } from '../weapons/defs';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, viewBox = '0 0 24 24', ...rest }: IconProps & { viewBox?: string }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill='currentColor' aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Side silhouettes, 64×24, barrel to the right. */
export function WeaponIcon({ weapon, size = 64, ...rest }: IconProps & { weapon: WeaponId | 'grenade' | 'mallet' }) {
  const h = (size * 24) / 64;
  const common = { width: size, height: h, viewBox: '0 0 64 24', fill: 'currentColor', 'aria-hidden': true, ...rest };
  switch (weapon) {
    case 'ar':
      return (
        <svg {...common}>
          <path d='M2 9h8l2-2h26l1-2h6v2h11v3h4v3h-4v1H40l-2 1H25l-3 9h-6l2-9h-4l-2 4H6l1-5H2z' />
          <rect x='27' y='3' width='8' height='3' rx='1' />
          <path d='M28 14h6l-1 8h-5z' />
        </svg>
      );
    case 'shotgun':
      return (
        <svg {...common}>
          <path d='M1 10l9-2h12l2-1h38v4H24v3h-8l-4 4H4l1-4H1z' />
          <rect x='27' y='12' width='17' height='4' rx='2' />
          <rect x='46' y='12' width='14' height='2.5' rx='1' />
        </svg>
      );
    case 'sniper':
      return (
        <svg {...common}>
          <path d='M1 11l10-2h14l2-1h36v2.5H30v3H18l-4 4H6l1-4H1z' />
          <rect x='17' y='3' width='17' height='4' rx='2' />
          <rect x='15' y='2' width='3' height='6' rx='1' />
          <rect x='33' y='2' width='3' height='6' rx='1' />
          <path d='M24 14h4l-1 6h-4z' />
        </svg>
      );
    case 'pistol':
      return (
        <svg {...common}>
          <path d='M20 6h26v6H30l-1 2h-4l-3 9h-7l3-10z' />
          <rect x='44' y='5' width='3' height='2' rx='1' />
        </svg>
      );
    case 'grenade':
      return (
        <svg {...common}>
          <rect x='22' y='6' width='20' height='16' rx='4' />
          <rect x='25' y='3' width='5' height='4' rx='1.5' />
          <rect x='34' y='3' width='5' height='4' rx='1.5' />
          <circle cx='46' cy='6' r='3' fill='none' stroke='currentColor' strokeWidth='2' />
        </svg>
      );
    case 'mallet':
      return (
        <svg {...common}>
          <rect x='8' y='11' width='34' height='4' rx='2' />
          <rect x='40' y='4' width='14' height='18' rx='3' />
          <rect x='42' y='1' width='4' height='4' rx='1.5' />
          <rect x='48' y='1' width='4' height='4' rx='1.5' />
        </svg>
      );
  }
}

export const HeadshotIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx='12' cy='12' r='8' fill='none' stroke='currentColor' strokeWidth='2.5' />
    <circle cx='12' cy='12' r='3' />
    <path d='M12 1v5M12 18v5M1 12h5M18 12h5' stroke='currentColor' strokeWidth='2.5' />
  </Svg>
);

export const SkullIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M12 2C6.5 2 3 5.6 3 10.2c0 2.7 1.3 4.7 3 5.9V20a1 1 0 0 0 1 1h2v-2h2v2h2v-2h2v2h2a1 1 0 0 0 1-1v-3.9c1.7-1.2 3-3.2 3-5.9C21 5.6 17.5 2 12 2zm-3.5 11a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zm7 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z' />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.9a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.9a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z' transform='translate(-1 0)' />
  </Svg>
);

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <g stroke='currentColor' strokeWidth='2' fill='none'>
      <circle cx='12' cy='12' r='9' />
      <path d='M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18' />
    </g>
  </Svg>
);

export const FullscreenIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' fill='none' />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z' />
  </Svg>
);

export const BotIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x='4' y='7' width='16' height='12' rx='3' />
    <rect x='10.5' y='2' width='3' height='5' rx='1' />
    <circle cx='12' cy='13' r='3' fill='#0f1a2e' />
    <circle cx='12' cy='13' r='1.4' fill='#ff5a3c' />
  </Svg>
);

export const DoorIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <g stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' fill='none'>
      <path d='M14 4H6v16h8M10 12h11M17 8l4 4-4 4' />
    </g>
  </Svg>
);

export const CopyIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <g stroke='currentColor' strokeWidth='2.2' fill='none'>
      <rect x='8' y='8' width='12' height='12' rx='2.5' />
      <path d='M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8' />
    </g>
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <g stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' fill='none'>
      <path d='M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7' />
    </g>
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p} fill='none'>
    <path d='M15 5l-7 7 7 7' stroke='currentColor' strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' fill='none' />
  </Svg>
);

export const CrownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z' />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx='9' cy='8' r='3.5' />
    <path d='M2.5 20c.5-4 3.2-6 6.5-6s6 2 6.5 6z' />
    <circle cx='17' cy='9' r='2.8' opacity='0.7' />
    <path d='M16 14.2c3 .2 5 2 5.5 5.8H17' opacity='0.7' />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x='5' y='10' width='14' height='11' rx='2.5' />
    <path d='M8 10V7a4 4 0 1 1 8 0v3' fill='none' stroke='currentColor' strokeWidth='2.4' />
  </Svg>
);

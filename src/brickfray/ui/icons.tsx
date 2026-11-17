import type { SVGProps } from 'react';
import type { ModelId } from '../weapons/model';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, viewBox = '0 0 24 24', ...rest }: IconProps & { viewBox?: string }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill='currentColor' aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Side silhouettes, 64×24, barrel to the right. */
export function WeaponIcon({ weapon, size = 64, ...rest }: IconProps & { weapon: ModelId }) {
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
    case 'nailer':
      return (
        <svg {...common}>
          <path d='M13.5 5.5L17 2.7l5.6-.8h9.2l4.8 1h1V9.9H13.5z' />
          <rect x='36' y='2.7' width='10.6' height='6.4' rx='2.2' />
          <rect x='46' y='4.7' width='6' height='2.6' rx='0.6' />
          <rect x='51.5' y='4.3' width='4' height='3.4' rx='0.8' />
          <path d='M24 9.5h-5.2L16.6 19l3.4.5 1.2-.5 1-2.9.9-2.5z' />
          <rect x='9' y='18' width='13.5' height='5.2' rx='1.4' />
          <path fillRule='evenodd' d='M31 9.5h6.2l5.8 13.7h-6.9zM33 11.5l3 7.5h2.6l-3.1-7.5z' />
          <rect x='23.6' y='0.4' width='2.2' height='2' rx='0.4' />
          <rect x='44.2' y='0.5' width='1.3' height='2.6' />
          <rect x='11.6' y='4.6' width='2.4' height='1.6' rx='0.5' />
        </svg>
      );
    case 'pulse':
      return (
        <svg {...common}>
          <path fillRule='evenodd' d='M3.2 7.2H17.8V12L13.9 12.3L6.4 15.4L3.2 15zM6 8.9L14 9.1L12.6 11L7.3 13.2L6 13.1z' />
          <rect x='1.6' y='6.8' width='1.8' height='9' rx='0.6' />
          <path d='M16.6 6.6H36.4V12L35.6 15.2H29.1L28.6 13.4H17.4L16.6 12.2z' />
          <path fillRule='evenodd' d='M35.8 6.9H52.8V11.2H50.6V11.8H39.4V11.2H35.8zM38.4 8.9H50.4V9.8H38.4z' />
          <rect x='52.4' y='6.9' width='6.6' height='0.9' />
          <rect x='52.6' y='8.2' width='6' height='1.8' />
          <rect x='53' y='7.6' width='0.9' height='3' rx='0.3' />
          <rect x='55' y='7.6' width='0.9' height='3' rx='0.3' />
          <rect x='57' y='7.6' width='0.9' height='3' rx='0.3' />
          <rect x='57.8' y='7.4' width='4' height='3.2' rx='0.9' />
          <rect x='17' y='5.7' width='3.2' height='1.2' rx='0.4' />
          <rect x='27.1' y='5.1' width='4.4' height='1.8' rx='0.4' />
          <circle cx='30.6' cy='3.4' r='2' fill='none' stroke='currentColor' strokeWidth='1.1' />
          <path d='M25 13.2H21L19.3 21.5L21.9 22L22.9 21.4L23.7 18.9L24.3 16.7z' />
          <rect x='23' y='15.6' width='6' height='0.8' rx='0.4' />
          <rect x='28.3' y='13.2' width='0.8' height='3.2' />
          <path fillRule='evenodd' d='M29.5 14.5H34.5V20H29.5zM31.6 15.9H32.5V18.6H31.6z' />
          <rect x='29.1' y='19.4' width='5.8' height='1.5' rx='0.5' />
        </svg>
      );
    case 'harpoon':
      return (
        <svg {...common}>
          <path fillRule='evenodd' d='M2 9.6h2.2l9.8.9V16l-9.8 5.2H2zM5.6 12.3h5.6v3l-5.6 2.8z' />
          <path d='M13.5 10.5h12v4.2l-1.4 1.4H13.5z' />
          <path d='M16.6 15.6h5l-1.9 7.6h-4.9z' />
          <path d='M21.6 16.1v3.4h3.3l.9-3.4' fill='none' stroke='currentColor' strokeWidth='1.1' />
          <rect x='13' y='7.8' width='34' height='4.4' rx='2.2' />
          <rect x='26.6' y='7.2' width='1.6' height='5.6' rx='0.5' />
          <rect x='37.6' y='7.2' width='1.6' height='5.6' rx='0.5' />
          <path d='M45.5 7h3l3.6 2.4v1.2L48.5 13h-3z' />
          <rect x='51' y='9.45' width='5' height='1.1' />
          <path d='M55 6.5l8.6 3.5-8.6 3.5 1.7-3.5z' />
          <rect x='26' y='12.6' width='6.4' height='2.8' rx='1.4' />
          <rect x='33.6' y='12' width='7' height='3.6' rx='1' />
          <circle cx='18.6' cy='4.5' r='2.15' fill='none' stroke='currentColor' strokeWidth='1.3' />
          <rect x='18' y='6.4' width='1.2' height='1.6' />
          <rect x='43.4' y='5.4' width='1.1' height='2.6' />
        </svg>
      );
    case 'cannon':
      return (
        <svg {...common}>
          <path d='M16.6 3.6H34v1.3H20.6v7.7H22l-3.2 10.4h-7.4l3.3-10.6.3-4.4z' />
          <path d='M16.4 6.3L12.7 2.9l1.5-1 3.8 3.1z' />
          <rect x='32.7' y='3.6' width='2' height='7.8' rx='0.4' />
          <rect x='21.2' y='5.6' width='11.2' height='8.6' rx='2.4' />
          <rect x='34.4' y='4.3' width='22.6' height='4.6' rx='0.5' />
          <rect x='56.6' y='3.7' width='3.6' height='5.8' rx='0.8' />
          <rect x='34.6' y='9.6' width='9' height='1.3' rx='0.65' />
          <path d='M54.4 4.3l2.8-2.5h1v2.5z' />
          <path d='M22.6 14.2v1.2a3 3 0 0 0 3 3h3.6' fill='none' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' />
          <rect x='24.8' y='14' width='1.1' height='2.4' rx='0.4' />
        </svg>
      );
    case 'buzzer':
      return (
        <svg {...common}>
          <rect x='19.5' y='4.6' width='22' height='6.2' rx='1' />
          <path fillRule='evenodd' d='M42.6 5.2h8.2a1 1 0 0 1 1 1v4.2a1 1 0 0 1-1 1h-8.2zM44.4 6.4v1.6h1.5V6.4zM47.4 6.4v1.6h1.5V6.4z' />
          <path d='M18.5 10.8h33.3v2.4H38.6l-.4 1.2h-8l-.2-1.2h-.4l-1.8 6.4h-6.6l1.8-6.4H18.5z' />
          <path d='M21.4 20.4h6.1l-.7 2.3h1.3V24H19.6v-1.3h1.2z' />
          <path d='M40.8 13.2h3.8l-.4 7.6a.8.8 0 0 1-.8.7h-2.3a.6.6 0 0 1-.6-.7z' />
          <rect x='20.5' y='3.1' width='2.6' height='1.8' rx='0.5' />
          <rect x='38.6' y='3.4' width='1.6' height='1.5' rx='0.4' />
        </svg>
      );
    case 'sword':
      return (
        <svg {...common}>
          <circle cx='4.4' cy='12' r='3' />
          <rect x='6.8' y='9.4' width='1.8' height='5.2' rx='0.6' />
          <rect x='8' y='10.2' width='8' height='3.6' rx='1' />
          <rect x='15.6' y='9.4' width='1.8' height='5.2' rx='0.6' />
          <path d='M17.2 8.2h3.6v7.6h-3.6zM17.6 9.2l1.6-5.8h2l-.6 5.8zM17.6 14.8l1.6 5.8h2l-.6-5.8z' />
          <circle cx='20.6' cy='3.2' r='2' />
          <circle cx='20.6' cy='20.8' r='2' />
          <path fillRule='evenodd' d='M20.6 9.4H51l5.8 1.1 5.6 1.5-5.6 1.5-5.8 1.1H20.6zM23.4 11.45h21.4v1.1H23.4z' />
        </svg>
      );
    case 'knife':
      return (
        <svg {...common}>
          <circle cx='8.6' cy='15.4' r='2.2' fill='none' stroke='currentColor' strokeWidth='1.4' />
          <path d='M12.4 8.2H30v6.6h-1.8a1.7 1.1 0 0 0-3.4 0h-1.4a1.7 1.1 0 0 0-3.4 0h-1.4a1.7 1.1 0 0 0-3.4 0h-1.4q-2.6 0-2.6-2.4V10.6q0-2.4 2.6-2.4z' />
          <circle cx='30.6' cy='11.4' r='3.2' />
          <path d='M31.4 8.6H50q5 .4 8.8 2.8-3.6 3-9.6 3.4H34q-2.2 0-2.6-1.2z' />
        </svg>
      );
    case 'anchor':
      return (
        <svg {...common}>
          <circle cx='4.8' cy='12' r='2.9' fill='none' stroke='currentColor' strokeWidth='1.8' />
          <rect x='7.4' y='10.8' width='50' height='2.4' rx='1' />
          <rect x='9.8' y='9.2' width='12.4' height='5.6' rx='2' />
          <rect x='24.2' y='4.6' width='2.4' height='14.8' rx='1.2' />
          <circle cx='25.4' cy='4.2' r='1.9' />
          <circle cx='25.4' cy='19.8' r='1.9' />
          <path d='M48.65 2.81A9.4 9.4 0 1 1 48.65 21.19' fill='none' stroke='currentColor' strokeWidth='2.6' />
          <path d='M51.4.4L42.6 3.6l7.8 3.4zM51.4 23.6l-8.8-3.2 7.8-3.4z' />
          <rect x='56.6' y='8.6' width='4.6' height='6.8' rx='1' />
        </svg>
      );
    case 'hatchet':
      return (
        <svg {...common}>
          <path d='M5.6 15.6q0-2.8 2.6-2.8h2.2l1.8.6H48v3H12.2l-1.8.6H8.2q-2.6 0-2.6-1.4z' />
          <rect x='12.4' y='12.8' width='12.6' height='4.2' rx='1.6' />
          <path d='M46.4 10.4h7.4v9.4h-7.4zM47.4 10.6L43.8 3.4Q50.4.2 57.6 2.2L53 10.6z' />
          <rect x='53.6' y='12' width='1.8' height='2' rx='0.5' />
          <rect x='53.6' y='15.8' width='1.8' height='2' rx='0.5' />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...common}>
          <path fillRule='evenodd' d='M5 10.2h40v3.6H5a1.8 1.8 0 0 1 0-3.6zM6.6 11.2h1.6v1.6H6.6zM28 11.4h12v1.2H28z' />
          <rect x='9' y='9' width='15' height='6' rx='2' />
          <rect x='43.6' y='8.4' width='3.6' height='7.2' rx='0.8' />
          <path d='M60.16 17.25A8.4 8.4 0 1 1 61.97 11.32L53.93 8.86A3.1 3.1 0 0 0 52.12 14.79Z' />
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

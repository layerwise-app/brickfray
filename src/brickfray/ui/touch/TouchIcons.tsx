import type { ReactNode } from 'react';

function Glyph({ size, children, fill }: { size: number; children: ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={2.6}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** A round standing on its casing: fire. */
export const BulletGlyph = ({ size }: { size: number }) => (
  <Glyph size={size} fill>
    <path d='M8.6 12.2c0-4.3 1.5-7.4 3.4-9.6 1.9 2.2 3.4 5.3 3.4 9.6z' />
    <rect x='8.6' y='13.4' width='6.8' height='6.4' rx='1' />
    <rect x='7.8' y='20.6' width='8.4' height='1.9' rx='.9' />
  </Glyph>
);

export const ScopeGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <circle cx='12' cy='12' r='7.2' />
    <path d='M12 2.2v4.2M12 17.6v4.2M2.2 12h4.2M17.6 12h4.2' />
    <circle cx='12' cy='12' r='1.2' fill='currentColor' stroke='none' />
  </Glyph>
);

export const JumpGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M6 13.5l6-6.5 6 6.5' />
    <path d='M5 20h14' />
  </Glyph>
);

export const CrouchGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M6 8l6 6.5L18 8' />
    <path d='M5 20h14' />
  </Glyph>
);

export const ReloadGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M19.2 12.6a7.2 7.2 0 1 1-2.3-6' />
    <path d='M18.6 3.2v4.4h-4.4' />
  </Glyph>
);

export const BreathGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M3.5 9h10.2a3 3 0 1 0-3-3' />
    <path d='M3.5 15h13.4a3 3 0 1 1-3 3' />
    <path d='M3.5 12h7' />
  </Glyph>
);

export const PauseGlyph = ({ size }: { size: number }) => (
  <Glyph size={size} fill>
    <rect x='6' y='5' width='4.2' height='14' rx='1.4' />
    <rect x='13.8' y='5' width='4.2' height='14' rx='1.4' />
  </Glyph>
);

export const BoardGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M9 6.5h10M9 12h10M9 17.5h10' />
    <path d='M5 6.5h.01M5 12h.01M5 17.5h.01' strokeWidth={3.4} />
  </Glyph>
);

/** Two chevrons up: run, and run locked. */
export const RunGlyph = ({ size }: { size: number }) => (
  <Glyph size={size}>
    <path d='M6.5 12.5l5.5-5.5 5.5 5.5' />
    <path d='M6.5 18.5l5.5-5.5 5.5 5.5' />
  </Glyph>
);

/** The HUD's toy pineapple: body, cap, pin ring. */
export const GrenadeGlyph = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' aria-hidden>
    <g fill='currentColor'>
      <rect x='5.5' y='9.5' width='12' height='13' rx='4.5' />
      <rect x='8.5' y='5.5' width='6' height='4.6' rx='1.2' />
    </g>
    <path d='M6.5 14.4h10M6.5 18h10M11.5 10.6v11' stroke='rgba(0,0,0,.35)' strokeWidth={1.4} />
    <path d='M14.5 6.6h3.2l2 2.6' fill='none' stroke='currentColor' strokeWidth={1.8} strokeLinecap='round' strokeLinejoin='round' />
    <circle cx='19.2' cy='4.6' r='2.4' fill='none' stroke='currentColor' strokeWidth={1.8} />
  </svg>
);

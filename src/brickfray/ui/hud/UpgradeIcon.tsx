import type { ReactElement, SVGProps } from 'react';
import type { UpgradeId } from '../../sim/upgrades';

/** Each upgrade's brick colour and the ink drawn on it. */
export const UPGRADE_LOOK: Record<UpgradeId, { color: string; lip: string; ink: string }> = {
  health: { color: '#e8453a', lip: '#9b2018', ink: '#ffffff' },
  magazine: { color: '#ffcd2e', lip: '#c98f00', ink: '#3a2400' },
  reload: { color: '#8b5cf6', lip: '#5b32b8', ink: '#ffffff' },
  grenades: { color: '#3cc46a', lip: '#1f8445', ink: '#ffffff' },
  grenadeRefill: { color: '#1fa89f', lip: '#0f6d67', ink: '#ffffff' },
  speed: { color: '#2f7dff', lip: '#1a4aa8', ink: '#ffffff' },
  regen: { color: '#ec4f9a', lip: '#a3245f', ink: '#ffffff' },
  damage: { color: '#ff7a1a', lip: '#b44a00', ink: '#ffffff' },
  armor: { color: '#6f86b0', lip: '#3e5378', ink: '#ffffff' }
};

const PLUS = 'M0 -6h4v6h6v4h-6v6h-4v-6h-6v-4h6z';

/** Chunky 64×64 pictograms in `currentColor`; cut-outs show the brick behind them. */
export function UpgradeIcon({ id, size = 64, ...rest }: SVGProps<SVGSVGElement> & { id: UpgradeId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 64 64' fill='currentColor' aria-hidden {...rest}>
      {GLYPHS[id]}
    </svg>
  );
}

const grenade = (x: number, y: number, k: number) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    <rect x={0} y={10} width={26} height={30} rx={9} />
    <path d='M1 21h24M1 30h24M13 11v28' stroke='var(--bf-upgrade-tile)' strokeWidth={2.6} />
    <rect x={7} y={2} width={12} height={10} rx={2.5} />
    <path d='M19 5h6l4 5' fill='none' stroke='currentColor' strokeWidth={3} strokeLinecap='round' />
    <circle cx={31} cy={4} r={4} fill='none' stroke='currentColor' strokeWidth={3} />
  </g>
);

const GLYPHS: Record<UpgradeId, ReactElement> = {
  health: <path fillRule='evenodd' d='M32 57C14 43 5 33 5 21.5A13.5 13.5 0 0 1 32 15a13.5 13.5 0 0 1 27 6.5C59 33 50 43 32 57zM28 18v8h-8v8h8v8h8v-8h8v-8h-8v-8z' />,
  magazine: (
    <>
      <path d='M20 5h12v8H20zM32 5h3q8 0 11 4q-3 4-11 4h-3z' />
      <path d='M18 14h25q1 22 10 36l-21 10q-10-18-14-46z' />
      <path d='M27.5 22h9M28.5 29h9.5M30 36h10M32 43h10' stroke='var(--bf-upgrade-tile)' strokeWidth={3} strokeLinecap='round' />
      <path d='M29 59l26-12 2.5 5-26 12z' />
    </>
  ),
  reload: (
    <>
      <path d='M50.5 36A19 19 0 1 1 45 18.5' fill='none' stroke='currentColor' strokeWidth={6.5} strokeLinecap='round' />
      <path d='M37 9l15 3-4 15z' />
      <path d='M28 46V30l4-8 4 8v16z' />
    </>
  ),
  grenades: (
    <>
      {grenade(20, 14, 1.05)}
      <path transform='translate(12 14)' d={PLUS} />
    </>
  ),
  grenadeRefill: (
    <>
      {grenade(6, 6, 0.95)}
      <circle cx={44} cy={44} r={15} />
      <path d='M44 35v9l6 4' fill='none' stroke='var(--bf-upgrade-tile)' strokeWidth={4} strokeLinecap='round' strokeLinejoin='round' />
    </>
  ),
  speed: (
    <>
      <path d='M28 12l20 20-20 20M42 12l20 20-20 20' fill='none' stroke='currentColor' strokeWidth={8} strokeLinecap='round' strokeLinejoin='round' transform='translate(-6 0)' />
      <path d='M4 24h14M2 32h16M4 40h14' stroke='currentColor' strokeWidth={4.5} strokeLinecap='round' />
    </>
  ),
  regen: (
    <>
      <path d='M24 6h16v18h18v16H40v18H24V40H6V24h18z' />
      <path d='M32 46V22M24 30l8-8 8 8' fill='none' stroke='var(--bf-upgrade-tile)' strokeWidth={5} strokeLinecap='round' strokeLinejoin='round' />
    </>
  ),
  damage: (
    <>
      <path d='M32 2l6 15 15-7-6 16 15 6-15 6 6 16-15-7-6 15-6-15-15 7 6-16-15-6 15-6-6-16 15 7z' />
      <path d='M27 42V30l5-9 5 9v12z' fill='var(--bf-upgrade-tile)' />
    </>
  ),
  armor: (
    <>
      <path fillRule='evenodd' d='M32 4l23 8v17c0 15-9.5 25.5-23 31C18.5 54.5 9 44 9 29V12zM32 13l-14 5v11c0 9.5 5.5 17 14 21z' />
      <circle cx={24} cy={8.5} r={3} />
      <circle cx={40} cy={8.5} r={3} />
    </>
  )
};

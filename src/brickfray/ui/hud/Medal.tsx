import { useId } from 'react';
import type { ScoreRow } from '../../game/hud';

export type MedalKind = 'kills' | 'assists';
export type MedalTier = 1 | 2 | 3;
export interface Medal {
  kind: MedalKind;
  tier: MedalTier;
}

/**
 * Gold, silver and bronze for the top three by kills and by assists. Equal counts share a place and the next place
 * is skipped (10, 10, 8: gold, gold, bronze); nobody earns one for zero.
 */
export function awardMedals(rows: readonly ScoreRow[]): Map<number, Medal[]> {
  const out = new Map<number, Medal[]>();
  for (const kind of ['kills', 'assists'] as const) {
    for (const row of rows) {
      const value = row[kind];
      if (value <= 0) continue;
      const tier = 1 + rows.filter((r) => r[kind] > value).length;
      if (tier > 3) continue;
      out.set(row.id, [...(out.get(row.id) ?? []), { kind, tier: tier as MedalTier }]);
    }
  }
  return out;
}

/** Metal per tier: face light/dark, rim, the ink of the emblem. */
const METAL: Record<MedalTier, { light: string; dark: string; rim: string; ink: string }> = {
  1: { light: '#ffe680', dark: '#f0b400', rim: '#a86f00', ink: '#7a4d00' },
  2: { light: '#f4f8ff', dark: '#b9c4d6', rim: '#6f7c92', ink: '#47536a' },
  3: { light: '#f7b98a', dark: '#c8743c', rim: '#7d4219', ink: '#5a2c0c' }
};
/** The ribbon tells the two kinds apart at a glance: red for kills, blue for assists. */
const RIBBON: Record<MedalKind, { face: string; stripe: string }> = {
  kills: { face: '#e8453a', stripe: '#9b2018' },
  assists: { face: '#2f7dff', stripe: '#1a4aa8' }
};

/**
 * A medal made like a toy: a round two-by-two plate in gold, silver or bronze with a raised rim, hung on two ribbon
 * plates from a one-by-two clasp that carries its place. Kills wear a target, assists two linked rings.
 */
export function MedalIcon({ medal, size = 32, title }: { medal: Medal; size?: number; title?: string }) {
  const id = useId();
  const m = METAL[medal.tier];
  const r = RIBBON[medal.kind];
  return (
    <svg width={size} height={(size * 60) / 48} viewBox='0 0 48 60' role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className='shrink-0'>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}f`} x1='0' y1='0' x2='0.4' y2='1'>
          <stop offset='0' stopColor={m.light} />
          <stop offset='1' stopColor={m.dark} />
        </linearGradient>
      </defs>
      {/* ribbon plates */}
      <path d='M9 1h11l8 23-9 3z' fill={r.face} />
      <path d='M28 1h11l-10 26-9-3z' fill={r.face} />
      <path d='M13.5 1h2.6l7.6 23.8-2.4.8z' fill={r.stripe} />
      <path d='M31.9 1h2.6l-9 25-2.4-.9z' fill={r.stripe} />
      <path d='M9 1h11v2.2H9zM28 1h11v2.2H28z' fill='rgba(255,255,255,.28)' />
      {/* medallion: drop, rim, face, inner step */}
      <circle cx='24' cy='41.5' r='16.5' fill='rgba(0,0,0,.35)' />
      <circle cx='24' cy='40' r='16.5' fill={m.rim} />
      <circle cx='24' cy='39' r='15' fill={`url(#${id}f)`} />
      <circle cx='24' cy='39.6' r='10.8' fill='none' stroke={m.rim} strokeOpacity='.45' strokeWidth='1.6' />
      <path d='M12.4 33.5a13 13 0 0 1 9-7.2' stroke='#fff' strokeOpacity='.75' strokeWidth='2.2' strokeLinecap='round' fill='none' />
      {medal.kind === 'kills' ? (
        <g stroke={m.ink} strokeWidth='2.3' strokeLinecap='round' fill='none'>
          <circle cx='24' cy='39.5' r='5.6' />
          <path d='M24 30.6v3.4M24 45v3.4M15.1 39.5h3.4M29.5 39.5h3.4' />
          <circle cx='24' cy='39.5' r='1.3' fill={m.ink} stroke='none' />
        </g>
      ) : (
        <g stroke={m.ink} strokeWidth='2.4' fill='none'>
          <circle cx='20.6' cy='39.5' r='4.6' />
          <circle cx='27.4' cy='39.5' r='4.6' />
        </g>
      )}
      {/* clasp: a one-by-two brick with its studs, numbered */}
      <rect x='14.5' y='20.5' width='19' height='10' rx='2' fill={m.rim} />
      <rect x='14.5' y='19.5' width='19' height='9' rx='2' fill={`url(#${id}f)`} />
      <rect x='16.5' y='17.2' width='5' height='3' rx='1.2' fill={m.dark} />
      <rect x='26.5' y='17.2' width='5' height='3' rx='1.2' fill={m.dark} />
      <text x='24' y='27' textAnchor='middle' fontSize='8.6' fontWeight='800' fontFamily='Rubik Variable, system-ui, sans-serif' fill={m.ink}>
        {medal.tier}
      </text>
    </svg>
  );
}

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** A cup on a stepped base, in the menu icons' filled style. */
export function TrophyIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden {...rest}>
      <path d='M6 3h12v4.5a6 6 0 0 1-12 0z' />
      <path d='M6 5.5H4.2a1.2 1.2 0 0 0-1.2 1.2v.3a4 4 0 0 0 4 4M18 5.5h1.8A1.2 1.2 0 0 1 21 6.7v.3a4 4 0 0 1-4 4' fill='none' stroke='currentColor' strokeWidth='2' />
      <rect x='10.75' y='12' width='2.5' height='5.5' />
      <rect x='7' y='17' width='10' height='4' rx='1.2' />
    </svg>
  );
}

export function UploadIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden {...rest}>
      <path d='M12 15V4M7 9l5-5 5 5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

export function MailIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden {...rest}>
      <rect x='3' y='5' width='18' height='14' rx='3' stroke='currentColor' strokeWidth='2.2' />
      <path d='M4 7l8 6 8-6' stroke='currentColor' strokeWidth='2.2' strokeLinejoin='round' />
    </svg>
  );
}

export function ChevronIcon({ size = 24, flip, ...rest }: IconProps & { flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined} {...rest}>
      <path d='M15 5l-7 7 7 7' stroke='currentColor' strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

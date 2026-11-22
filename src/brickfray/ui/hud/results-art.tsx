import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden {...rest}>
      {children}
    </svg>
  );
}

/** Kills: a sight, the emblem on the kill medals. */
export const KillsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g stroke='currentColor' strokeWidth='2.6' fill='none' strokeLinecap='round'>
      <circle cx='12' cy='12' r='6.5' />
      <path d='M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5' />
    </g>
    <circle cx='12' cy='12' r='2' />
  </Svg>
);

/** Assists: two linked rings, the emblem on the assist medals. */
export const AssistsIcon = (p: IconProps) => (
  <Svg {...p}>
    <g stroke='currentColor' strokeWidth='2.6' fill='none'>
      <circle cx='8.5' cy='12' r='5.5' />
      <circle cx='15.5' cy='12' r='5.5' />
    </g>
  </Svg>
);

export const ScoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M12 2.2l3 6.1 6.7 1-4.9 4.7 1.2 6.7L12 17.5l-6 3.2 1.2-6.7-4.9-4.7 6.7-1z' strokeLinejoin='round' stroke='currentColor' strokeWidth='1' />
  </Svg>
);

/** A head in a sight. */
export const HeadshotsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx='12' cy='10.2' r='4.6' />
    <path d='M4.6 21.5c.8-4.2 3.8-6.3 7.4-6.3s6.6 2.1 7.4 6.3z' />
    <g stroke='currentColor' strokeWidth='2' strokeLinecap='round' fill='none'>
      <path d='M12 .8v2.6M12 17v1.4M2.6 10.2h2.6M18.8 10.2h2.6' />
    </g>
  </Svg>
);

export const AccuracyIcon = (p: IconProps) => (
  <Svg {...p}>
    <g stroke='currentColor' strokeWidth='2.4' fill='none'>
      <circle cx='12' cy='12' r='9' />
      <circle cx='12' cy='12' r='4.8' />
    </g>
    <circle cx='12' cy='12' r='1.8' />
  </Svg>
);

export const TimeIcon = (p: IconProps) => (
  <Svg {...p}>
    <g stroke='currentColor' strokeWidth='2.4' fill='none' strokeLinecap='round'>
      <circle cx='12' cy='13.5' r='8' />
      <path d='M12 13.5V9.2M9.8 2.5h4.4M18.6 6.2l1.6-1.6' />
    </g>
  </Svg>
);

/** The leaderboard's cup, struck through: this match is not on it. */
export const UnrankedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d='M6 3h12v4.5a6 6 0 0 1-12 0z' opacity='.85' />
    <rect x='10.75' y='12' width='2.5' height='5.5' opacity='.85' />
    <rect x='7' y='17' width='10' height='4' rx='1.2' opacity='.85' />
    <path d='M3.5 3.5l17 17' stroke='#0b1222' strokeWidth='4.5' strokeLinecap='round' />
    <path d='M3.5 3.5l17 17' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
  </Svg>
);

export type RibbonTone = 'gold' | 'silver' | 'bronze' | 'slate' | 'grey' | 'red';

/** The headline as a plastic banner: one or two words on a plate, folded tails behind it. */
export function Ribbon({ tone, icon, children }: { tone: RibbonTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className='bf-ribbon bf-in' data-tone={tone}>
      <span className='bf-ribbon-tail' data-side='l' />
      <h2 className='bf-ribbon-face bf-display'>
        {icon}
        <span>{children}</span>
      </h2>
      <span className='bf-ribbon-tail' data-side='r' />
    </div>
  );
}

const CONFETTI = ['#ffcd2e', '#ea3d32', '#2f7dff', '#3cc46a', '#ff7a1a', '#ffffff', '#b06bff'];

/** Brick confetti falling once over the screen: for a win, and again for a new place in the top 100. */
export function Confetti({ pieces = 34, delay = 0 }: { pieces?: number; delay?: number }) {
  return (
    <div className='bf-confetti' aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
        return (
          <i
            key={i}
            data-long={r(5) > 0.6 || undefined}
            style={{
              ['--x' as string]: `${(i / pieces) * 100 + (r(1) - 0.5) * 6}%`,
              ['--dx' as string]: `${(r(2) - 0.5) * 160}px`,
              ['--r' as string]: `${(r(3) - 0.5) * 900}deg`,
              ['--d' as string]: `${delay + r(4) * 0.7}s`,
              ['--t' as string]: `${1.8 + r(6) * 1.1}s`,
              ['--c' as string]: CONFETTI[i % CONFETTI.length]
            }}
          />
        );
      })}
    </div>
  );
}

/** Words for an icon, on demand: a bubble on hover or keyboard focus, and on touch for a moment after a tap or press. */
export function Tip({ text, children, className = '', style }: { text: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const press = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const release = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 1600);
  };
  return (
    <span
      className={`bf-tip ${className}`}
      style={style}
      data-tip={text}
      data-open={open || undefined}
      tabIndex={0}
      role='img'
      aria-label={text}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </span>
  );
}

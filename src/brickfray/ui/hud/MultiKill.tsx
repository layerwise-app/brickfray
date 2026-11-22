import type { CSSProperties } from 'react';
import { CHAIN_TOP } from '../../sim/streaks';
import { useHud } from '../App';
import { useT } from '../i18n';
import './streaks.css';

type Tier = 2 | 3 | 4 | 5 | 6;

/** The brick a chain builds, warming as it grows: face, the shaded lip below, the lettering. */
export const CHAIN_LOOK: Record<Tier, { face: string; lip: string; ink: string; scale: number }> = {
  2: { face: '#ffcd2e', lip: '#c98f00', ink: '#2a1a00', scale: 1 },
  3: { face: '#ff8a1f', lip: '#b35000', ink: '#2a1000', scale: 1.08 },
  4: { face: '#ea3d32', lip: '#8f1a12', ink: '#ffffff', scale: 1.16 },
  5: { face: '#8a4dff', lip: '#4c1fae', ink: '#ffffff', scale: 1.24 },
  6: { face: '#1b2234', lip: '#04060c', ink: '#ffd23f', scale: 1.32 }
};

/** Languages whose callout falls back from Lilita One to the system's CJK face. */
const CJK: ReadonlySet<string> = new Set(['zh', 'ja', 'ko']);

export function chainTier(count: number): Tier {
  return Math.max(2, Math.min(count, CHAIN_TOP)) as Tier;
}

/**
 * The local player's multi-kill, under the kill confirm (on phones under the top bar): a toy brick with one stud per
 * kill in the chain, bigger and hotter in colour as it grows. Keyed by the chain, so each new kill in it pops again.
 */
export function MultiKill() {
  const hud = useHud();
  const { t, lang } = useT();
  const chain = hud.multikill;
  if (!chain || hud.phase === 'ended') return null;
  const tier = chainTier(chain.count);
  const look = CHAIN_LOOK[tier];
  const style = { '--mk-face': look.face, '--mk-lip': look.lip, '--mk-ink': look.ink, '--mk-scale': look.scale } as CSSProperties;
  return (
    <div key={chain.key} className='bf-multikill' data-tier={tier} style={style}>
      <div className='bf-mk-brick'>
        <span className='bf-mk-studs'>
          {Array.from({ length: tier }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        <span className='bf-display bf-mk-text' data-cjk={CJK.has(lang) || undefined}>
          {t(`streak.${tier}`)}
        </span>
        {chain.count > CHAIN_TOP && <span className='bf-display bf-mk-more'>×{chain.count}</span>}
      </div>
    </div>
  );
}

/** A kill-feed entry's chain: a small brick of the chain's colour with its name. */
export function ChainChip({ count }: { count: number }) {
  const { t } = useT();
  const tier = chainTier(count);
  const look = CHAIN_LOOK[tier];
  return (
    <span className='bf-display bf-mk-chip shrink-0 whitespace-nowrap rounded-md px-1.5 py-px text-[13px] uppercase leading-tight' style={{ background: look.face, color: look.ink, boxShadow: `inset 0 -2px 0 ${look.lip}` }}>
      {t(`streak.${tier}`)}
      {count > CHAIN_TOP && ` ×${count}`}
    </span>
  );
}

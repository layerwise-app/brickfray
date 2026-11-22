import { BOUNTY_GOLD, coinSvg } from './bounty-art';
import { useT } from '../i18n';
import './streaks.css';

export function BountyCoin({ size = 18 }: { size?: number }) {
  // Constant markup from bounty-art.ts: the same mark the name tags put over a player's head.
  return <span className='inline-block shrink-0' dangerouslySetInnerHTML={{ __html: coinSvg(size) }} />;
}

/**
 * A gold chip with the coin: `+N bounty` where a kill collected one (kill confirm, feed), the plain amount where a
 * player carries one (scoreboard).
 */
export function BountyChip({ amount, collected = false, size = 'md' }: { amount: number; collected?: boolean; size?: 'sm' | 'md' }) {
  const { t } = useT();
  const small = size === 'sm';
  return (
    <span
      className={`bf-display bf-bounty-chip inline-flex shrink-0 items-center whitespace-nowrap rounded-full leading-none ${small ? 'gap-1 py-0.5 pl-0.5 pr-2 text-sm' : 'gap-1.5 py-0.5 pl-0.5 pr-2.5 text-lg'}`}
      data-size={size}
      style={{ background: BOUNTY_GOLD.backing, color: BOUNTY_GOLD.light, boxShadow: `inset 0 0 0 1.5px ${BOUNTY_GOLD.dark}, 0 2px 0 rgba(0,0,0,.3)` }}
      title={collected ? undefined : t('bounty.on', { n: amount })}
    >
      <BountyCoin size={small ? 16 : 20} />
      {collected ? t('bounty.collected', { n: amount }) : amount}
    </span>
  );
}

/** Under the room's table: what wins, and how the bounty works. */
export function BountyRule() {
  const { t } = useT();
  return (
    <p className='mt-3 flex items-center gap-2 text-[13px] font-medium leading-snug text-white/70'>
      <BountyCoin size={18} />
      {t('bounty.rule')}
    </p>
  );
}

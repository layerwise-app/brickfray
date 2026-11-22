import type { Outcome } from '../../../lib/board/client/outcome';
import { achievement } from '../../../lib/achievements/catalogue';
import type { NextTier } from '../../../lib/achievements/contract';
import { number } from '../board/format';
import { useT } from '../i18n';
import { Badge, roman } from './Badge';
import { achievementName, useNews } from './model';
import { newTiers } from './showcase';
import './achievements.css';
import './unlocks.css';

/** Unlock badges the strip shows before folding the rest into "+N". */
const BADGES = 4;
const GOALS = 2;

/**
 * The results screen's line about achievements: the tiers this match unlocked (badge and name), then the nearest goals
 * it moved (badge, bar, numbers). A match that cannot count says so in one muted line; while it uploads, nothing.
 * Sizes itself to the width of the box it is put in: a narrow one (a phone's column) gets one row of badges only.
 */
export function UnlockStrip({ outcome }: { outcome: Outcome | null }) {
  const { t, lang } = useT();
  const news = useNews(outcome);
  if (!outcome || outcome.upload === 'sending') return null;
  if (outcome.upload !== 'stored') {
    return (
      <div className='bf-ach-strip-box'>
        <p className='bf-ach-strip bf-ach-strip-quiet' role='status'>
          <Badge id='matches' tier={0} size={22} />
          <span>{t(outcome.upload === 'waiting' ? 'ach.later' : 'ach.notCounted')}</span>
        </p>
      </div>
    );
  }
  if (!news) return null;
  const { lead: unlocked, rest: more } = newTiers(news.unlocks, BADGES);
  const goals = news.next.slice(0, unlocked.length ? 1 : GOALS);
  if (!unlocked.length && !goals.length) return null;
  return (
    <div className='bf-ach-strip-box'>
      <div className='bf-ach-strip' role='status'>
        {unlocked.map((u) => {
          const name = achievementName(t, u.id);
          const tiered = achievement(u.id).tiers.length > 1;
          return (
            <span key={u.id} className='bf-ach-got' title={`${t('ach.unlocked')}: ${name}${tiered ? ` ${roman(u.tier)}` : ''}`}>
              <Badge id={u.id} tier={u.tier} size={40} />
              <span className='bf-ach-got-name'>
                <span className='bf-display'>{name}</span>
                {tiered && <b>{roman(u.tier)}</b>}
              </span>
            </span>
          );
        })}
        {more > 0 && <span className='bf-display bf-ach-strip-more'>{t('ach.more', { n: more })}</span>}
        {goals.map((g) => (
          <Goal key={g.id} goal={g} name={achievementName(t, g.id)} lang={lang} />
        ))}
      </div>
    </div>
  );
}

function Goal({ goal, name, lang }: { goal: NextTier; name: string; lang: Parameters<typeof number>[0] }) {
  const fill = Math.min(1, goal.value / Math.max(1, goal.goal));
  return (
    <span className='bf-ach-goal' title={name}>
      <Badge id={goal.id} tier={goal.tier - 1} size={28} />
      <span className='bf-ach-goal-bar'>
        <i className='bf-ach-bar' aria-hidden>
          <i style={{ width: `${fill * 100}%` }} />
        </i>
        <span className='bf-ach-nums'>
          <b>{number(lang, goal.value)}</b> / {number(lang, goal.goal)}
        </span>
      </span>
    </span>
  );
}

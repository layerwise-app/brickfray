import { useEffect, useState, type CSSProperties } from 'react';
import type { Outcome } from '../../../lib/board/client/outcome';
import { achievement } from '../../../lib/achievements/catalogue';
import type { NextTier, Unlock } from '../../../lib/achievements/contract';
import { useGame } from '../App';
import { number } from '../board/format';
import { Tip } from '../hud/results-art';
import { useT } from '../i18n';
import { Badge, metalOf, TierPips } from './Badge';
import { achievementName, useNews } from './model';
import { newTiers } from './showcase';
import './achievements.css';
import './unlocks.css';

/** Unlock badges the strip reveals before folding the rest into "+N"; goals shown when nothing unlocked. */
const BADGES = 4;
const GOALS = 2;
/** The reveal waits for the results' own entrance (ribbon, podium, counted-up numbers), then a badge every STEP s. */
const START = 1.5;
const STEP = 0.38;

/** When each match's reveal began: a remount (the window resized, a dev reload) neither repeats nor restarts it. */
const revealed = new Map<string, number>();

/**
 * The results screen's one word about achievements. A match that unlocked tiers reveals them here, one badge after
 * another with a shimmer each (at most four, then "+N"); one that unlocked nothing shows the nearest goals it moved.
 * A match that cannot count says so in one muted line; while it uploads, nothing.
 */
export function UnlockStrip({ outcome }: { outcome: Outcome | null }) {
  const { t } = useT();
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
  if (unlocked.length) return <Reveal matchKey={outcome.report.key} unlocked={unlocked} more={more} />;
  const goals = news.next.slice(0, GOALS);
  if (!goals.length) return null;
  return (
    <div className='bf-ach-strip-box'>
      <div className='bf-ach-strip' role='status'>
        {goals.map((g) => (
          <Goal key={g.id} goal={g} />
        ))}
      </div>
    </div>
  );
}

function Reveal({ matchKey, unlocked, more }: { matchKey: string; unlocked: Unlock[]; more: number }) {
  const game = useGame();
  const { t } = useT();
  const [since] = useState(() => (revealed.has(matchKey) ? (Date.now() - revealed.get(matchKey)!) / 1000 : 0));

  // The audio engine is the external system: the shimmers are scheduled once, as the reveal first begins.
  useEffect(() => {
    if (revealed.has(matchKey)) return;
    revealed.set(matchKey, Date.now());
    unlocked.forEach((_, i) => game.audio.play('achievement', { priority: 8, volume: 0.75, delay: START + i * STEP, rate: 2 ** ((i * 2) / 12) }));
  }, [matchKey, unlocked, game]);

  const at = (i: number) => ({ '--at': `${START + i * STEP - since}s` }) as CSSProperties;
  return (
    <div className='bf-ach-strip-box'>
      <div className='bf-ach-strip' role='status' aria-label={unlocked.map((u) => achievementName(t, u.id)).join(', ')}>
        {unlocked.map((u, i) => {
          const name = achievementName(t, u.id);
          const tiers = achievement(u.id).tiers.length;
          return (
            <Tip key={u.id} text={tiers > 1 ? `${name} · ${t('ach.tierOf', { n: u.tier, m: tiers })}` : name} className='bf-ach-got' style={at(i)}>
              <Badge id={u.id} tier={u.tier} size={40} />
              <span className='bf-ach-got-name'>
                <span className='bf-display'>{name}</span>
                <TierPips id={u.id} tier={u.tier} />
              </span>
            </Tip>
          );
        })}
        {more > 0 && (
          <span className='bf-display bf-ach-strip-more' style={at(unlocked.length)}>
            {t('ach.more', { n: more })}
          </span>
        )}
      </div>
    </div>
  );
}

/** The nearest goal a match moved: its badge in the tier it has, a bar toward the next, and the numbers. */
function Goal({ goal }: { goal: NextTier }) {
  const { t, lang } = useT();
  const fill = Math.min(1, goal.value / Math.max(1, goal.goal));
  const tiers = achievement(goal.id).tiers.length;
  const name = achievementName(t, goal.id);
  return (
    <Tip text={tiers > 1 ? `${name} · ${t('ach.toward', { n: goal.tier, m: tiers })}` : name} className='bf-ach-goal'>
      <Badge id={goal.id} tier={goal.tier - 1} size={30} />
      <span className='bf-ach-goal-bar' style={{ '--ach-next': metalOf(goal.id, goal.tier).dark } as CSSProperties}>
        <i className='bf-ach-bar' aria-hidden>
          <i style={{ width: `${fill * 100}%` }} />
        </i>
        <span className='bf-ach-goal-foot'>
          <span className='bf-ach-nums'>
            <b>{number(lang, goal.value)}</b> / {number(lang, goal.goal)}
          </span>
          <TierPips id={goal.id} tier={goal.tier - 1} />
        </span>
      </span>
    </Tip>
  );
}

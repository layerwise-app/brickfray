import { useEffect, useState, type CSSProperties } from 'react';
import type { Outcome } from '../../../lib/board/client/outcome';
import { useGame } from '../App';
import { useT } from '../i18n';
import { Badge, metalOf, roman } from './Badge';
import { achievement } from '../../../lib/achievements/catalogue';
import { achievementName, useNews } from './model';
import { newTiers } from './showcase';
import './achievements.css';
import './unlocks.css';

/** Toasts shown at once; the rest fold into a "+N more" toast under them. */
const SHOWN = 3;
/** Seconds between toasts coming in, and each one's stay. */
const STAGGER = 0.45;
const STAY = 5.5;

/** When each match's toasts first came up: a remount (a dev reload, the results screen redrawn) neither repeats nor restarts them. */
const started = new Map<string, number>();

/**
 * The tiers a match unlocked, as toasts in the top corner once its upload is stored: up to three, newest tier of each
 * achievement only, the rest counted in a last toast. A short box (a phone) shows the first alone, counting the others
 * in it. One shimmer sound for the lot.
 */
export function UnlockToasts({ outcome }: { outcome: Outcome | null }) {
  const game = useGame();
  const { t } = useT();
  const news = useNews(outcome);
  const key = outcome?.report.key ?? null;
  const { lead: shown, rest: more } = news ? newTiers(news.unlocks, SHOWN) : { lead: [], rest: 0 };
  const toasts = shown.length + (more > 0 ? 1 : 0);
  const life = (toasts - 1) * STAGGER + STAY;
  /** The match whose toasts are up, and how many seconds into them this mount came in. */
  const [live, setLive] = useState<{ key: string; since: number } | null>(null);

  // A timer: the toasts leave on their own; the sound plays once, when they first come up.
  useEffect(() => {
    if (!key || !toasts) return;
    const first = !started.has(key);
    const since = first ? 0 : (Date.now() - started.get(key)!) / 1000;
    if (first) started.set(key, Date.now());
    if (since >= life) return;
    if (first) game.audio.play('upgradeOffer', { priority: 8 });
    setLive({ key, since });
    const timer = setTimeout(() => setLive(null), (life - since) * 1000);
    return () => clearTimeout(timer);
  }, [key, toasts, life, game]);

  if (!key || live?.key !== key || !toasts) return null;
  const timing = (i: number) => ({ '--in': `${i * STAGGER - live.since}s`, '--stay': `${STAY}s` }) as CSSProperties;
  return (
    <div className='bf-ach-toasts' role='status' aria-live='polite'>
      {shown.map((u, i) => {
        const metal = metalOf(u.id, u.tier);
        return (
          <div key={u.id} className='bf-ach-toast' style={{ ...timing(i), '--ach-face': metal.dark } as CSSProperties}>
            <Badge id={u.id} tier={u.tier} size={46} />
            <span className='bf-ach-toast-text'>
              <small>{t('ach.unlocked')}</small>
              <b className='bf-display'>
                {achievementName(t, u.id)}
                {achievement(u.id).tiers.length > 1 && <em>{roman(u.tier)}</em>}
              </b>
            </span>
            {i === 0 && shown.length + more > 1 && <span className='bf-display bf-ach-toast-count'>+{shown.length + more - 1}</span>}
          </div>
        );
      })}
      {more > 0 && (
        <div className='bf-ach-toast bf-ach-toast-more' style={timing(shown.length)}>
          <span className='bf-display'>{t('ach.more', { n: more })}</span>
        </div>
      )}
    </div>
  );
}

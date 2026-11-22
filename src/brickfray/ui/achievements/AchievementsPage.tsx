import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { achievement, CATEGORIES, type Category } from '../../../lib/achievements/catalogue';
import type { AchievementState, AchievementsPage as PageData } from '../../../lib/achievements/contract';
import { number } from '../board/format';
import { useAccount } from '../board/me';
import { useT } from '../i18n';
import { BackIcon } from '../icons';
import { Badge, metalOf, TierPips } from './Badge';
import { achievementHow, achievementName, day, useAchievements } from './model';
import './achievements.css';
import './achievements-fit.css';

const SEEN = 'brickfray.achievementsSeen';
/** On a first visit with no record, tiers reached within this long count as new. */
const FIRST_VISIT = 24 * 3600 * 1000;

/** When the player last opened this page; tiers reached after it are new to them. */
function lastSeen() {
  try {
    const at = Number(localStorage.getItem(SEEN));
    return at > 0 ? at : Date.now() - FIRST_VISIT;
  } catch {
    return Infinity;
  }
}

const Seen = createContext(Infinity);

/** Every achievement by category: locked ones show their goal, reached tiers their colour and date, new ones a glow. */
export default function AchievementsPage({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [seen] = useState(lastSeen);
  const query = useAchievements();
  const signedIn = useAccount().data?.signedIn ?? true;
  const panel = useRef<HTMLElement>(null);
  const data = query.data && !('refused' in query.data) ? query.data : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus moves into the dialog so the keyboard (and a screen reader) starts there.
  useEffect(() => panel.current?.focus(), []);

  // Storage is the external system: once the page has been open, what it shows is no longer new.
  useEffect(() => {
    try {
      localStorage.setItem(SEEN, String(Date.now()));
    } catch {
      // Without storage every visit highlights the same tiers; the page still works.
    }
  }, []);

  return (
    <div className='bf-ach-backdrop' onClick={onClose}>
      <section ref={panel} tabIndex={-1} role='dialog' aria-modal aria-labelledby='bf-ach-title' className='bf-panel bf-studs bf-pop bf-ach' onClick={(e) => e.stopPropagation()}>
        <header className='bf-ach-head'>
          <button className='bf-btn bf-btn-ghost bf-icon-btn bf-ach-back' onClick={onClose} aria-label={t('back')}>
            <BackIcon size={20} />
          </button>
          <h2 id='bf-ach-title' className='bf-display bf-ach-title'>
            {t('ach.title')}
          </h2>
          {data && <Total unlocked={data.unlocked} total={data.total} />}
        </header>
        <div className='bf-ach-list bf-scroll' data-fetching={query.isFetching || undefined}>
          {data ? (
            <Seen.Provider value={seen}>
              {CATEGORIES.map((category) => (
                <Section key={category} category={category} items={data.items.filter((a) => achievement(a.id).category === category)} />
              ))}
            </Seen.Provider>
          ) : query.isPending ? (
            <div className='bf-ach-state'>
              <div className='bf-spinner' />
            </div>
          ) : (
            <p className='bf-ach-state'>{t('board.error')}</p>
          )}
          {data && !signedIn && <p className='bf-ach-keep'>{t('ach.keep')}</p>}
        </div>
      </section>
    </div>
  );
}

function Total({ unlocked, total }: Pick<PageData, 'unlocked' | 'total'>) {
  const { lang } = useT();
  return (
    <div className='bf-ach-total' aria-label={`${unlocked} / ${total}`}>
      <span className='bf-display'>
        <b>{number(lang, unlocked)}</b>
        <small> / {number(lang, total)}</small>
      </span>
      <i className='bf-ach-bar' aria-hidden>
        <i style={{ width: `${(100 * unlocked) / Math.max(1, total)}%` }} />
      </i>
    </div>
  );
}

function Section({ category, items }: { category: Category; items: AchievementState[] }) {
  const { t, lang } = useT();
  const done = items.reduce((n, a) => n + a.unlocked.filter((d) => d !== null).length, 0);
  const all = items.reduce((n, a) => n + a.unlocked.length, 0);
  return (
    <section className='bf-ach-section'>
      <h3 className='bf-ach-cat'>
        <span>{t(`ach.cat.${category}`)}</span>
        <small>
          {number(lang, done)} / {number(lang, all)}
        </small>
      </h3>
      <div className='bf-ach-grid'>
        {items.map((a) => (
          <Card key={a.id} item={a} />
        ))}
      </div>
    </section>
  );
}

function Card({ item }: { item: AchievementState }) {
  const { t, lang } = useT();
  const seen = useContext(Seen);
  const def = achievement(item.id);
  const tier = item.unlocked.filter((d) => d !== null).length;
  const complete = tier === def.tiers.length;
  const goal = def.tiers[Math.min(tier, def.tiers.length - 1)]!;
  const fill = complete ? 1 : Math.min(1, item.value / goal);
  const latest = tier ? item.unlocked[tier - 1] : null;
  const fresh = !!latest && latest > seen;
  const metal = metalOf(item.id, tier);
  const next = metalOf(item.id, Math.min(tier + 1, def.tiers.length));
  const name = achievementName(t, item.id);
  const tiers = def.tiers.length;
  return (
    <article
      className='bf-ach-card'
      data-state={complete ? 'done' : tier ? 'some' : 'locked'}
      data-fresh={fresh || undefined}
      style={{ '--ach-face': metal.dark, '--ach-next': next.dark } as React.CSSProperties}
    >
      <Badge id={item.id} tier={tier} size={56} />
      <div className='bf-ach-info'>
        <h4 className='bf-ach-name'>
          <span className='bf-display'>{name}</span>
          {fresh && <span className='bf-ach-new'>{t('ach.new')}</span>}
        </h4>
        <p className='bf-ach-how'>{achievementHow(t, item.id)}</p>
        <div className='bf-ach-progress'>
          <i className='bf-ach-bar' aria-hidden>
            <i style={{ width: `${fill * 100}%` }} />
          </i>
          <span className='bf-ach-nums'>
            {complete ? (
              t('ach.done')
            ) : (
              <>
                <b>{number(lang, Math.min(item.value, goal))}</b> / {number(lang, goal)}
              </>
            )}
          </span>
        </div>
        <div className='bf-ach-foot'>
          {tiers > 1 && (
            <span className='bf-ach-tier'>
              <TierPips id={item.id} tier={tier} />
              <span>{t('ach.tierOf', { n: tier, m: tiers })}</span>
            </span>
          )}
          {latest && <span className='bf-ach-date'>{t('ach.since', { date: day(lang, latest) })}</span>}
        </div>
      </div>
    </article>
  );
}

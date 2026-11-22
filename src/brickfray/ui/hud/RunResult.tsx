import type { ReactNode } from 'react';
import { beats, type Outcome } from '../../../lib/board/client/outcome';
import { maxLevel } from '../../sim/upgrades';
import { useHud } from '../App';
import { mapName } from '../board/format';
import { useT } from '../i18n';
import { SkullIcon } from '../icons';
import { CauseIcon } from './Death';
import { AccuracyIcon, HeadshotsIcon, KillsIcon, ScoreIcon, TimeIcon, Tip } from './results-art';
import { CountUp } from './results-intro';
import { BotFace } from './SoloHud';
import { accuracy, clock } from './standings';
import { UPGRADE_LOOK, UpgradeIcon } from './UpgradeIcon';
import { UpgradeList } from './UpgradeList';

/** What ended a solo run, in words: the snapbot kind that took the player out, the water, or their own grenade. */
export function useCauseText() {
  const hud = useHud();
  const { t } = useT();
  const cause = hud.soloCause;
  if (!cause) return null;
  if (cause.killer) return t('results.cause.bot', { name: t(`kind.${cause.killer}`) });
  if (cause.weapon === 'water') return t('fellInWater');
  if (cause.weapon === 'grenade') return t('results.cause.grenade');
  return t('eliminatedSelf');
}

/**
 * The wave a run reached as a big numeral on a studded plate, stamped when it beats the player's best on this
 * difficulty (or on this map); beside it what ended the run: the snapbot's face over the weapon, or the water.
 */
export function RunHero({ outcome }: { outcome: Outcome | null }) {
  const hud = useHud();
  const { t, lang } = useT();
  const settings = hud.settings!;
  const me = hud.rows.find((r) => r.me);
  const run = { wave: Math.max(1, hud.wave), score: me?.score ?? 0 };
  let stamp: string | null = null;
  let best: number | null = null;
  if (outcome?.best) {
    if (beats(run, outcome.best)) stamp = t('results.newBest');
    else if (beats(run, outcome.bestHere)) stamp = t('results.newBestMap', { map: mapName(lang, settings.map) });
    else best = outcome.best.wave;
  }
  return (
    <div className='bf-run-hero'>
      <div className='bf-wave bf-in' data-difficulty={settings.difficulty}>
        <span className='bf-wave-studs' aria-hidden>
          <i />
          <i />
        </span>
        <span className='bf-wave-label bf-display'>{t('board.col.wave')}</span>
        <span className='bf-wave-num bf-display'>
          <CountUp value={run.wave} from={1} delay={0.3} duration={0.6} />
        </span>
        <span className='bf-wave-diff'>{t(`difficulty.${settings.difficulty}`)}</span>
      </div>
      <div className='bf-run-side'>
        {stamp && <span className='bf-stamp bf-display'>{stamp}</span>}
        <Cause />
        {best !== null && (
          <span className='bf-run-best bf-in' title={t('results.best', { n: best })}>
            {t('results.bestShort', { n: best })}
          </span>
        )}
      </div>
    </div>
  );
}

function Cause() {
  const hud = useHud();
  const text = useCauseText();
  const cause = hud.soloCause;
  if (!cause || !text) return null;
  return (
    <Tip text={text} className='bf-cause bf-in'>
      <SkullIcon size={22} className='bf-cause-skull' />
      {cause.killer && <BotFace kind={cause.killer} size={58} />}
      <CauseIcon cause={cause.weapon} size={cause.killer ? 64 : 84} className={cause.weapon === 'water' ? 'text-[#7cc8ff]' : 'text-white/85'} />
    </Tip>
  );
}

/** A run's numbers as chips in one row (score, kills, headshots, accuracy, time), each with its word, then its upgrades as icons. */
export function RunChips() {
  const hud = useHud();
  const { t } = useT();
  const me = hud.rows.find((r) => r.me);
  const hits = accuracy(hud.shots, hud.shotsHit);
  const ids = [...new Set(hud.upgradesTaken)];
  return (
    <div className='bf-run-chips'>
      <div className='bf-chips'>
        <Chip text={t('col.score')} icon={<ScoreIcon size={26} className='text-[var(--bf-yellow)]' />} delay={0.5}>
          <CountUp value={me?.score ?? 0} delay={0.5} duration={0.9} />
        </Chip>
        <Chip text={t('col.kills')} icon={<KillsIcon size={26} className='text-[#ff6a5a]' />} delay={0.58}>
          <CountUp value={me?.kills ?? 0} delay={0.58} />
        </Chip>
        <Chip text={t('col.headshots')} icon={<HeadshotsIcon size={26} />} delay={0.66}>
          <CountUp value={hud.headshots} delay={0.66} />
        </Chip>
        <Chip text={t('col.accuracy')} icon={<AccuracyIcon size={26} className='text-[#6aa8ff]' />} delay={0.74}>
          {hits === null ? '–' : <CountUp value={hits} delay={0.74} format={(n) => `${n}%`} />}
        </Chip>
        <Chip text={t('col.time')} icon={<TimeIcon size={26} />} delay={0.82}>
          {clock(hud.playTime)}
        </Chip>
      </div>
      {ids.length > 0 && (
        <div className='bf-ups' aria-label={t('run.upgrades')}>
          {ids.map((id, i) => {
            const look = UPGRADE_LOOK[id];
            return (
              <Tip key={id} text={`${t(`upgrade.name.${id}`)} · ${hud.upgrades[id]}/${maxLevel(id)}`} className='bf-up bf-in' style={{ ['--i' as string]: i }}>
                <span className='bf-up-tile' style={{ background: look.color, ['--lip' as string]: look.lip }}>
                  <UpgradeIcon id={id} size={30} style={{ color: look.ink, ['--bf-upgrade-tile' as string]: look.color }} />
                </span>
                <span className='bf-up-pips' aria-hidden>
                  {Array.from({ length: maxLevel(id) }, (_, n) => (
                    <i key={n} style={n < hud.upgrades[id] ? { background: look.color } : undefined} />
                  ))}
                </span>
              </Tip>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ text, icon, delay, children }: { text: string; icon: ReactNode; delay: number; children: ReactNode }) {
  return (
    <span className='bf-chip bf-in' style={{ ['--d' as string]: `${delay}s` }}>
      {icon}
      <b className='bf-display'>{children}</b>
      <small>{text}</small>
    </span>
  );
}

/** The numbers of a solo run and the upgrades it was built from, labelled: the Tab overlay during a run. */
export function RunStats({ compact }: { compact?: boolean }) {
  const hud = useHud();
  const { t } = useT();
  const me = hud.rows.find((r) => r.me);
  const hits = accuracy(hud.shots, hud.shotsHit);
  const stats: [string, string | number, boolean?][] = [
    [compact ? t('board.col.wave') : t('run.wave'), Math.max(1, hud.wave), true],
    [t('score'), me?.score ?? 0],
    [t('run.kills'), me?.kills ?? 0],
    [t('run.headshots'), hud.headshots],
    [t('run.accuracy'), hits === null ? '–' : `${hits}%`],
    [t('run.time'), clock(hud.playTime)]
  ];
  return (
    <div className='bf-run' data-compact={compact || undefined}>
      <div className='bf-run-stats'>
        {stats.map(([label, value, accent]) => (
          <div key={label} className='bf-run-stat'>
            <span className={`bf-display bf-run-value ${accent ? 'text-[var(--bf-yellow)]' : ''}`}>{value}</span>
            <span className='bf-run-label'>{label}</span>
          </div>
        ))}
      </div>
      <div>
        <div className='bf-results-caption'>
          {t('run.upgrades')} · {hud.upgradesTaken.length}
        </div>
        <UpgradeList levels={hud.upgrades} order={hud.upgradesTaken} />
      </div>
    </div>
  );
}

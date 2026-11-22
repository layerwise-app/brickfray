import { beats, type Outcome } from '../../../lib/board/client/outcome';
import { useHud } from '../App';
import { mapName } from '../board/format';
import { useT } from '../i18n';
import { SkullIcon } from '../icons';
import { CauseIcon } from './Death';
import { accuracy, clock } from './standings';
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

/** Under the title of a solo run: where it ended, and how it stands against the player's earlier runs. */
export function RunHeadline({ outcome }: { outcome: Outcome | null }) {
  const hud = useHud();
  const { t, lang } = useT();
  const settings = hud.settings!;
  const cause = useCauseText();
  const water = hud.soloCause?.weapon === 'water';
  const me = hud.rows.find((r) => r.me);
  const run = { wave: Math.max(1, hud.wave), score: me?.score ?? 0 };
  let best: { text: string; fresh: boolean } | null = null;
  if (outcome) {
    if (!outcome.best) best = { text: t('results.firstRun', { difficulty: t(`difficulty.${settings.difficulty}`) }), fresh: false };
    else if (beats(run, outcome.best)) best = { text: t('results.newBest'), fresh: true };
    else if (beats(run, outcome.bestHere)) best = { text: t('results.newBestMap', { map: mapName(lang, settings.map) }), fresh: true };
    else best = { text: t('results.best', { n: outcome.best.wave }), fresh: false };
  }
  return (
    <>
      <p className='bf-results-sub bf-display'>
        {t('reachedWave', { n: run.wave })} · {t(`difficulty.${settings.difficulty}`)} · {mapName(lang, settings.map)}
      </p>
      {cause && (
        <div className='bf-results-cause'>
          <SkullIcon size={20} className='shrink-0 text-[var(--bf-red)]' />
          <span>{cause}</span>
          {hud.soloCause && <CauseIcon cause={hud.soloCause.weapon} size={60} className={water ? 'text-[#7cc8ff]' : 'text-white/80'} />}
        </div>
      )}
      {best && (
        <div className={best.fresh ? 'bf-results-best bf-display' : 'bf-results-best-quiet'} data-fresh={best.fresh || undefined}>
          {best.text}
        </div>
      )}
    </>
  );
}

/** The numbers of a solo run and the upgrades it was built from. */
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

import { useGame, useHud } from './App';
import { mapName } from './board/format';
import { StatIcon, type Stat } from './hud/stat-head';
import { clock } from './hud/standings';
import { useT } from './i18n';
import { DoorIcon, GearIcon, PlayIcon } from './icons';

/** Paused: what is paused (mode, map, the clock or wave), the player's numbers so far, then Resume, Settings, Leave. */
export function PauseMenu({ openSettings }: { openSettings: () => void }) {
  const game = useGame();
  const hud = useHud();
  const { t, lang } = useT();
  const s = hud.settings;
  const me = hud.rows.find((r) => r.me);
  const solo = s?.mode === 'solo';
  const where = s && [solo ? t(`difficulty.${s.difficulty}`) : t(`mode.${s.mode}`), mapName(lang, s.map)].join(' · ');
  const when = !s ? null : solo ? t('wave', { n: Math.max(1, hud.wave) }) : hud.phase === 'playing' && hud.phaseLeft > 0 ? clock(hud.phaseLeft) : null;
  const stats: [Stat, number][] = me ? (solo ? [['score', me.score], ['kills', me.kills], ['headshots', hud.headshots]] : [['kills', me.kills], ['deaths', me.deaths], ['assists', me.assists], ['score', me.score]]) : [];
  return (
    <div className='bf-screen-in absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-[#0b1222]/55 py-3 backdrop-blur-sm'>
      <div className='bf-panel bf-studs bf-pop flex w-[360px] max-w-[calc(100%-32px)] flex-col gap-4 p-6 [@media(max-height:500px)]:gap-2.5 [@media(max-height:500px)]:p-4'>
        <div className='flex flex-col items-center gap-1 text-center'>
          <h2 className='bf-display text-4xl leading-none [@media(max-height:500px)]:text-3xl'>{t('paused.title')}</h2>
          {where && (
            <p className='text-sm font-semibold text-[var(--bf-muted)]'>
              {where}
              {when && (
                <>
                  {' · '}
                  <span className='tabular-nums text-white'>{when}</span>
                </>
              )}
            </p>
          )}
        </div>
        {stats.length > 0 && (
          <div className='grid gap-1.5 rounded-xl bg-black/25 px-2 py-2.5 [@media(max-height:500px)]:py-1.5' style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map(([stat, value]) => (
              <div key={stat} className='flex flex-col items-center gap-1'>
                <StatIcon stat={stat} size={16} className='text-white/70' />
                <b className='bf-display text-2xl leading-none tabular-nums'>{value}</b>
                <small className='text-[10.5px] font-bold leading-none text-[var(--bf-muted)]'>{t(`col.${stat}`)}</small>
              </div>
            ))}
          </div>
        )}
        <button className='bf-btn bf-btn-primary !h-16 [@media(max-height:500px)]:!h-12' onClick={() => game.resume()}>
          <PlayIcon size={26} />
          <span className='bf-display text-3xl'>{t('resume')}</span>
        </button>
        <button className='bf-btn bf-btn-blue' onClick={openSettings}>
          <GearIcon size={20} />
          <span className='font-semibold'>{t('settings')}</span>
        </button>
        <button className='bf-btn bf-btn-red' onClick={() => game.leave()}>
          <DoorIcon size={20} />
          <span className='font-semibold'>{t('leaveMatch')}</span>
        </button>
      </div>
    </div>
  );
}

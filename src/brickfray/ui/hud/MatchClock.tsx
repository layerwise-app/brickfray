import { TEAM_COLORS } from '../../game/remotes';
import { useHud } from '../App';
import { useT } from '../i18n';

/** In the last minute of a timed match the clock turns yellow and grows; over the last ten seconds it turns red. */
const LAST_MINUTE = 60;
/** The last seconds also count down large under the score bar. */
const FINAL = 10;
const CLOCK_KEYFRAMES = `@keyframes bf-clock-tick { 0% { transform: scale(1.22); } 100% { transform: scale(1); } }`;

function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function TopBar() {
  const hud = useHud();
  const { t } = useT();
  const mode = hud.settings?.mode;
  if (!mode) return null;
  const me = hud.rows.find((r) => r.me);
  const leader = hud.rows[0];
  // The wave banner announces the wave; the pill steps aside until it is gone so the number never shows twice.
  const announcing = mode === 'solo' && !!hud.banner;
  const timed = mode !== 'solo' && hud.phase === 'playing' && hud.phaseLeft > 0;
  const second = Math.ceil(hud.phaseLeft);
  const lastMinute = timed && second <= LAST_MINUTE;
  const final = timed && second <= FINAL;
  return (
    <div className='absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1'>
      <style>{CLOCK_KEYFRAMES}</style>
      <div
        className='flex items-stretch overflow-hidden rounded-2xl bg-black/45 shadow-[0_4px_0_rgba(0,0,0,.3)] backdrop-blur-sm'
        style={{ opacity: announcing ? 0 : 1, transition: 'opacity .3s ease', outline: lastMinute ? `2px solid ${final ? 'rgba(255,74,61,.85)' : 'rgba(255,205,46,.7)'}` : undefined, outlineOffset: -2 }}
      >
        {mode === 'tdm' && <Score value={hud.teamScore[0]} color={TEAM_COLORS[0]} highlight={hud.myTeam === 0} />}
        {mode === 'ffa' && <Score value={me?.kills ?? 0} color='#ffcd2e' highlight />}
        <div className='flex min-w-24 items-center justify-center px-4'>
          <span
            key={final ? second : lastMinute ? 'last' : 'clock'}
            className={`bf-display bf-hud-text inline-block tabular-nums ${lastMinute ? 'text-4xl' : 'text-3xl'}`}
            style={{ color: final ? '#ff5a4a' : lastMinute ? 'var(--bf-yellow)' : undefined, animation: lastMinute ? 'bf-clock-tick .45s ease-out' : undefined }}
          >
            {mode === 'solo' ? t('wave', { n: Math.max(1, hud.wave) }) : clock(hud.phase === 'playing' ? hud.phaseLeft : (hud.settings?.minutes ?? 10) * 60)}
          </span>
        </div>
        {mode === 'tdm' && <Score value={hud.teamScore[1]} color={TEAM_COLORS[1]} highlight={hud.myTeam === 1} />}
        {mode === 'ffa' && <Score value={leader && !leader.me ? leader.kills : (hud.rows[1]?.kills ?? 0)} color='#ffffff33' />}
      </div>
      {hud.phase === 'warmup' && hud.phaseLeft > 0 && (
        <div key={Math.ceil(hud.phaseLeft)} className='bf-pop mt-16 flex flex-col items-center'>
          <span className='text-lg font-semibold uppercase tracking-[0.25em] text-white/80'>{t('getReady')}</span>
          <span className='bf-display bf-hud-text text-8xl leading-none text-[var(--bf-yellow)]'>{Math.ceil(hud.phaseLeft)}</span>
        </div>
      )}
      {final && (
        <div key={second} className='bf-pop mt-12 flex flex-col items-center'>
          <span className='bf-hud-text text-lg font-semibold uppercase tracking-[0.25em] text-white/90'>{t('endsIn')}</span>
          <span className='bf-display text-8xl leading-none tabular-nums' style={{ color: second <= 3 ? '#ff5a4a' : '#ffffff', textShadow: '0 3px 0 rgba(0,0,0,.5), 0 0 22px rgba(0,0,0,.45)' }}>
            {second}
          </span>
        </div>
      )}
      {hud.phase === 'intermission' && !hud.offer && (
        <div className='bf-display bf-hud-text bf-pop mt-10 text-5xl text-[var(--bf-yellow)]'>{Math.ceil(hud.phaseLeft)}</div>
      )}
    </div>
  );
}

function Score({ value, color, highlight }: { value: number; color: string; highlight?: boolean }) {
  return (
    <div className='bf-display flex min-w-16 items-center justify-center px-3 text-3xl tabular-nums' style={{ background: color, color: highlight ? '#fff' : '#ffffffcc', textShadow: '0 2px 0 rgba(0,0,0,.35)' }}>
      {value}
    </div>
  );
}

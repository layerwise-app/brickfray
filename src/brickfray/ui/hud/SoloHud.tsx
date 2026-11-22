import { useEffect, useState } from 'react';
import type { BotKind } from '../../characters/types';
import type { MatchSettings } from '../../sim/types';
import { waveRoster, waveTuning, type WaveTheme } from '../../sim/waves';
import { useHud } from '../App';
import { useT } from '../i18n';
import './solo-hud.css';

const BOSS_THEMES: readonly WaveTheme[] = ['boss', 'bossEscort', 'bossPair'];
const KINDS: readonly BotKind[] = ['grunt', 'rusher', 'sniper', 'boss'];
/** Seconds a new kind's card stays up. */
const INTRO_SECONDS = 6;

/** The face of each snapbot kind in its own colours: shell, visor, eye. */
const FACE: Record<BotKind, { shell: string; visor: string; eye: string; trim: string }> = {
  grunt: { shell: '#7d8791', visor: '#2a3036', eye: '#ff3b2f', trim: '#f5a623' },
  rusher: { shell: '#d7322a', visor: '#1c2229', eye: '#ffb020', trim: '#2f363d' },
  sniper: { shell: '#7f90bb', visor: '#2a3036', eye: '#58f0e0', trim: '#e7e1d2' },
  boss: { shell: '#3a424b', visor: '#15191d', eye: '#ffd23a', trim: '#d7322a' }
};

/** A snapbot's head as a flat icon: a boxy shell with a visor, the sniper's lens, the rusher's slanted brow, the boss's crest. */
export function BotFace({ kind, size = 28 }: { kind: BotKind; size?: number }) {
  const f = FACE[kind];
  return (
    <svg width={size} height={size} viewBox='0 0 32 32' aria-hidden className='shrink-0'>
      {kind === 'boss' && <path d='M9 5l3-4h8l3 4z' fill={f.trim} />}
      <rect x='4' y='5' width='24' height='22' rx='5' fill={f.shell} />
      <rect x='4' y='22' width='24' height='5' rx='2.5' fill='rgba(0,0,0,.25)' />
      <rect x='5.5' y='6.2' width='21' height='2' rx='1' fill='rgba(255,255,255,.3)' />
      {kind === 'rusher' ? <path d='M7 12l18-2v8l-18 1z' fill={f.visor} /> : <rect x='7' y='11' width='18' height='8' rx='3' fill={f.visor} />}
      {kind === 'sniper' ? (
        <>
          <circle cx='16' cy='15' r='4.6' fill={f.trim} />
          <circle cx='16' cy='15' r='3' fill={f.eye} />
        </>
      ) : (
        <>
          <rect x='10' y={kind === 'rusher' ? 13 : 13.5} width='4' height='3' rx='1' fill={f.eye} />
          <rect x='18' y={kind === 'rusher' ? 12.4 : 13.5} width='4' height='3' rx='1' fill={f.eye} />
        </>
      )}
      <rect x='12' y='22.5' width='8' height='2' rx='1' fill={f.trim} />
    </svg>
  );
}

/** The wave banner: its number, and what the wave is about (boss waves in red). */
export function WaveBanner({ wave, theme }: { wave: string; theme: WaveTheme | null }) {
  const { t } = useT();
  const boss = !!theme && BOSS_THEMES.includes(theme);
  return (
    <div className='flex flex-col items-center gap-2'>
      <div className='bf-display bf-hud-text text-5xl text-[var(--bf-yellow)]'>{t('wave', { n: wave })}</div>
      {theme && (
        <div className='bf-display rounded-xl px-4 py-1 text-2xl' style={{ background: boss ? '#c8231b' : 'rgba(10,16,30,.78)', color: boss ? '#fff' : 'var(--bf-yellow)', boxShadow: `0 4px 0 ${boss ? '#7a120c' : 'rgba(0,0,0,.4)'}` }}>
          {t(`theme.${theme}`)}
        </div>
      )}
    </div>
  );
}

/** Between waves: a labelled countdown and the next wave's theme and kinds. */
export function NextWave() {
  const hud = useHud();
  const { t } = useT();
  const difficulty = hud.settings!.difficulty;
  const next = Math.max(1, hud.wave) + 1;
  const theme = waveTuning(difficulty, next).theme;
  const counts = new Map<BotKind, number>();
  for (const kind of waveRoster(difficulty, next)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return (
    <div className='bf-pop mt-6 flex flex-col items-center gap-1.5'>
      <div className='flex items-baseline gap-3 rounded-2xl bg-[#0b1222]/80 px-5 py-2 shadow-[0_4px_0_rgba(0,0,0,.35)]'>
        <span className='text-lg font-bold uppercase tracking-[0.18em] text-white/90'>{t('hud.nextWave')}</span>
        <span key={Math.ceil(hud.phaseLeft)} className='bf-display bf-pop text-5xl leading-none tabular-nums text-[var(--bf-yellow)]'>
          {Math.ceil(hud.phaseLeft)}
        </span>
      </div>
      <div className='flex items-center gap-2 rounded-xl bg-black/55 px-3 py-1'>
        <span className='bf-display text-xl' style={{ color: BOSS_THEMES.includes(theme) ? '#ff6a5a' : '#fff' }}>
          {t(`theme.${theme}`)}
        </span>
        {KINDS.filter((k) => counts.has(k)).map((kind) => (
          <span key={kind} className='flex items-center gap-0.5 text-sm font-bold tabular-nums text-white/85'>
            <BotFace kind={kind} size={26} />×{counts.get(kind)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Megabots on the field: one bar each under the wave pill. */
export function BossBars() {
  const hud = useHud();
  const { t } = useT();
  if (!hud.bosses.length || hud.phase !== 'playing') return null;
  return (
    <div className='mt-2 flex w-[min(440px,64vw)] flex-col gap-1.5'>
      {hud.bosses.map((b) => {
        const share = Math.max(0, Math.min(1, b.health / Math.max(1, b.max)));
        return (
          <div key={b.id} className='bf-fade-in flex flex-col gap-0.5'>
            <div className='flex items-center gap-1.5'>
              <BotFace kind='boss' size={18} />
              <span className='bf-display bf-hud-text text-base leading-none text-white'>{t('hud.megabot')}</span>
              <span className='bf-hud-text ml-auto text-xs font-bold tabular-nums text-white/75'>{Math.ceil(b.health)}</span>
            </div>
            <div className='relative h-3.5 overflow-hidden rounded-[5px] bg-black/60 shadow-[0_2px_0_rgba(0,0,0,.4)]'>
              <div className='absolute inset-y-0 left-0 rounded-[5px] transition-[width] duration-300' style={{ width: `${share * 100}%`, background: 'linear-gradient(180deg,#ff7a62 0%,#e0281c 55%,#a3150d 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35)' }} />
              <div className='absolute inset-0' style={{ background: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 2px), rgba(0,0,0,.45) calc(10% - 2px) 10%)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Per run (its settings object): the kinds met so far and the card of the newest. Outside React so a remount keeps it. */
const runs = new WeakMap<MatchSettings, { seen: Set<BotKind>; card: { kind: BotKind; at: number } | null }>();

/** The first time a snapbot kind joins a run, a card says what it is and how to deal with it. */
export function KindIntro() {
  const hud = useHud();
  const { t } = useT();
  const [, redraw] = useState(0);
  const settings = hud.settings;
  let run = settings?.mode === 'solo' ? runs.get(settings) : undefined;
  if (settings?.mode === 'solo' && !run) runs.set(settings, (run = { seen: new Set(), card: null }));
  if (run && hud.phase === 'playing') {
    const fresh = hud.rows.find((r) => r.bot && KINDS.includes(r.character as BotKind) && !run.seen.has(r.character as BotKind));
    if (fresh) {
      run.seen.add(fresh.character as BotKind);
      run.card = { kind: fresh.character as BotKind, at: performance.now() };
    }
  }
  const card = run?.card ?? null;
  const left = card ? INTRO_SECONDS * 1000 - (performance.now() - card.at) : 0;
  const showing = left > 0;

  // A timer: redraw once the card's time is up so it leaves.
  useEffect(() => {
    if (!showing) return;
    const timer = setTimeout(() => redraw((n) => n + 1), left);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one timer per card, not per redraw
  }, [card, showing]);

  const shown = showing && card ? { kind: card.kind, key: card.at } : null;
  if (!shown || hud.phase === 'ended' || (hud.offer && !hud.offer.picked)) return null;
  return (
    <div key={shown.key} className='bf-kind-intro absolute left-4 top-[30%] flex max-w-[min(340px,40vw)] items-center gap-3 rounded-2xl bg-[#0b1222]/85 py-2.5 pl-2.5 pr-4 shadow-[0_5px_0_rgba(0,0,0,.35)]'>
      <span className='grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/10'>
        <BotFace kind={shown.kind} size={46} />
      </span>
      <span className='flex min-w-0 flex-col'>
        <span className='text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--bf-yellow)]'>{t('hud.newKind')}</span>
        <span className='bf-display text-2xl leading-tight'>{t(`kind.${shown.kind}`)}</span>
        <span className='text-sm font-semibold leading-snug text-white/80'>{t(`kindHint.${shown.kind}`)}</span>
      </span>
    </div>
  );
}

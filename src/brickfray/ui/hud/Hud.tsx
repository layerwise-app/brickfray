import { useState } from 'react';
import { GRENADE, WEAPONS } from '../../weapons/defs';
import { TEAM_COLORS } from '../../game/remotes';
import { useApp, useGame, useHud } from '../App';
import { useT } from '../i18n';
import { HeadshotIcon, SkullIcon, WeaponIcon } from '../icons';
import { Crosshair } from './Crosshair';
import { KillConfirm } from './KillConfirm';
import { Results, Scoreboard } from './Scoreboard';

export function Hud() {
  const hud = useHud();
  const app = useApp();
  const game = useGame();
  const { t } = useT();
  const playing = hud.phase === 'playing' || hud.phase === 'warmup' || hud.phase === 'intermission';

  return (
    <div className='pointer-events-none absolute inset-0 select-none'>
      <LowHealth level={hud.alive ? Math.min(1, Math.max(0, (0.45 - hud.health / hud.maxHealth) / 0.35)) : 0} />
      {hud.scoped && <div className='bf-scope' />}
      {hud.alive && playing && <Crosshair hidden={hud.scoped || hud.aiming} />}
      <KillConfirm />
      <TopBar />
      <KillFeed />
      {hud.alive && (
        <>
          <Health health={hud.health} max={hud.maxHealth} />
          <Ammo />
        </>
      )}
      <Banner />
      <Chat />
      {hud.death && hud.phase !== 'ended' && <Death />}
      {hud.scoreboard && hud.phase !== 'ended' && <Scoreboard />}
      {hud.phase === 'ended' && <Results />}
      {hud.hint && (
        <div className='bf-pop absolute left-1/2 top-24 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-sm font-medium'>{t('ctrlHint')}</div>
      )}
      {hud.scoped && <div className='absolute bottom-[18%] left-1/2 -translate-x-1/2 text-sm font-semibold text-white/70'>{t('scopeHint')}</div>}
      {game.settings.showStats && hud.stats && (
        <div className='absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] leading-4 text-white/85'>
          {game.renderer.statsLine()} · {hud.stats.calls} calls · {(hud.stats.triangles / 1000).toFixed(0)}k tris · ping {hud.ping} ms
        </div>
      )}
      {!app.paused && !game.input.active && hud.phase !== 'ended' && <ClickToPlay />}
    </div>
  );
}

function ClickToPlay() {
  const game = useGame();
  const { t } = useT();
  return (
    <button className='pointer-events-auto absolute inset-0 grid place-items-center bg-black/25' onClick={() => game.resume()}>
      <span className='bf-display bf-hud-text bf-pop rounded-2xl bg-black/40 px-6 py-3 text-3xl'>{t('clickToPlay')}</span>
    </button>
  );
}

function Health({ health, max }: { health: number; max: number }) {
  const bricks = 10;
  const per = max / bricks;
  return (
    <div className='absolute bottom-6 left-6 flex items-end gap-3'>
      <div className='bf-display bf-hud-text min-w-[3ch] text-right text-5xl leading-none tabular-nums'>{Math.max(0, Math.ceil(health))}</div>
      <div className='flex gap-1 pb-1'>
        {Array.from({ length: bricks }, (_, i) => {
          const fill = Math.max(0, Math.min(1, (health - i * per) / per));
          return (
            <div key={i} className='relative h-6 w-5 overflow-hidden rounded-[5px] bg-black/45 shadow-[0_2px_0_rgba(0,0,0,.4)]'>
              <div
                className='absolute inset-x-0 bottom-0 rounded-[5px] transition-[height] duration-150'
                style={{ height: `${fill * 100}%`, background: health < 35 ? '#ff4636' : '#ff5a4a', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.25), inset 0 2px 0 rgba(255,255,255,.35)' }}
              />
              <div className='absolute left-1/2 top-[-3px] h-[6px] w-[10px] -translate-x-1/2 rounded-full' style={{ background: fill > 0.95 ? '#ff7a6c' : 'rgba(0,0,0,.35)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ammo() {
  const hud = useHud();
  const def = WEAPONS[hud.weapon];
  const reloading = hud.reload >= 0;
  const lowAmmo = hud.ammo <= Math.ceil(def.mag * 0.25);
  return (
    <div className='absolute bottom-6 right-6 flex flex-col items-end gap-2'>
      <div className='flex items-end gap-1'>
        {Array.from({ length: GRENADE.perLife }, (_, i) => (
          <Grenade key={i} full={i < hud.grenades} />
        ))}
      </div>
      <div className='flex items-end gap-4'>
        <WeaponIcon weapon={hud.weapon} size={92} className='text-white/90 drop-shadow-[0_2px_0_rgba(0,0,0,.5)]' />
        {/* A soft dark plate under the count keeps both numbers legible over bright or red scenery. */}
        <div className='flex items-baseline gap-1.5 rounded-2xl bg-black/35 px-3 pb-1.5 pt-1 shadow-[0_3px_0_rgba(0,0,0,.25)]'>
          <span className={`bf-display bf-hud-text text-6xl leading-none tabular-nums ${lowAmmo ? 'text-[#ff6a5c]' : ''}`}>{hud.ammo}</span>
          <span className='bf-display bf-hud-text text-3xl leading-none text-white/90'>/{def.mag}</span>
        </div>
      </div>
      <div className='h-1.5 w-40 overflow-hidden rounded-full bg-black/40' style={{ opacity: reloading ? 1 : 0, transition: 'opacity .15s' }}>
        <div className='h-full rounded-full bg-[var(--bf-yellow)]' style={{ width: `${Math.max(0, hud.reload) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Below 45% health the screen edges drain of colour and darken, and a deep red rim beats like a pulse in the outer
 * band, both creeping inward with the health lost (`level` 0…1). The middle two thirds of the screen keep their colour
 * and contrast to aim through. Gradient stops are in units of the half-width / half-height, so 100% is an edge.
 */
function LowHealth({ level }: { level: number }) {
  const on = level > 0;
  const clear = Math.round(70 - 14 * level);
  const edge = `radial-gradient(ellipse 50% 50% at center, transparent ${clear}%, black ${Math.round(clear + 26)}%)`;
  const grade = `saturate(${(1 - 0.8 * level).toFixed(3)}) brightness(${(1 - 0.28 * level).toFixed(3)})`;
  const beat = on ? `bf-heartbeat ${(1.15 - level * 0.4).toFixed(2)}s ease-in-out infinite` : undefined;
  return (
    <>
      <style>{`@keyframes bf-heartbeat { 0%, 100% { opacity: .45; } 9% { opacity: 1; } 20% { opacity: .6; } 30% { opacity: .92; } 55% { opacity: .45; } }`}</style>
      <div
        className='absolute inset-0'
        style={{
          backdropFilter: on ? grade : undefined,
          WebkitBackdropFilter: on ? grade : undefined,
          maskImage: on ? edge : undefined,
          WebkitMaskImage: on ? edge : undefined
        }}
      />
      <div className='absolute inset-0' style={{ opacity: on ? 0.5 + 0.5 * level : 0, transition: 'opacity .4s ease' }}>
        <div
          className='absolute inset-0'
          style={{
            background: `radial-gradient(ellipse 50% 50% at center, transparent ${Math.round(clear + 12)}%, rgba(135,0,0,${(0.32 + 0.33 * level).toFixed(2)}) 102%, rgba(70,0,0,.9) 138%)`,
            animation: beat
          }}
        />
      </div>
    </>
  );
}

/** One grenade of the loadout: a toy pineapple with a pin ring, solid while held, an outline once thrown. */
function Grenade({ full }: { full: boolean }) {
  return (
    <svg width={30} height={38} viewBox='0 0 30 38' aria-hidden className={full ? 'drop-shadow-[0_2px_0_rgba(0,0,0,.5)]' : ''}>
      <g fill={full ? 'var(--bf-yellow)' : 'rgba(255,255,255,.14)'} stroke={full ? 'rgba(40,30,0,.55)' : 'rgba(255,255,255,.45)'} strokeWidth={1.5}>
        <rect x={4} y={12} width={20} height={24} rx={7} />
        <rect x={9} y={6} width={10} height={7} rx={2} />
        <path d='M19 8h5l3 4' fill='none' />
        <circle cx={25} cy={5} r={3.5} fill='none' />
      </g>
      {full && <path d='M5 21h18M5 27h18M14 13v22' stroke='rgba(60,40,0,.35)' strokeWidth={1.5} />}
    </svg>
  );
}

function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TopBar() {
  const hud = useHud();
  const { t } = useT();
  const mode = hud.settings?.mode;
  if (!mode) return null;
  const me = hud.rows.find((r) => r.me);
  const leader = hud.rows[0];
  // The wave banner announces the wave; the pill steps aside until it is gone so the number never shows twice.
  const announcing = mode === 'solo' && !!hud.banner;
  return (
    <div className='absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1'>
      <div className='flex items-stretch overflow-hidden rounded-2xl bg-black/45 shadow-[0_4px_0_rgba(0,0,0,.3)] backdrop-blur-sm' style={{ opacity: announcing ? 0 : 1, transition: 'opacity .3s ease' }}>
        {mode === 'tdm' && <Score value={hud.teamScore[0]} color={TEAM_COLORS[0]} highlight={hud.myTeam === 0} />}
        {mode === 'ffa' && <Score value={me?.kills ?? 0} color='#ffcd2e' highlight />}
        <div className='bf-display bf-hud-text flex min-w-24 items-center justify-center px-4 text-3xl tabular-nums'>
          {mode === 'solo' ? t('wave', { n: Math.max(1, hud.wave) }) : clock(hud.phase === 'playing' ? hud.phaseLeft : (hud.settings?.minutes ?? 10) * 60)}
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
      {hud.phase === 'intermission' && (
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

function KillFeed() {
  const hud = useHud();
  return (
    <div className='absolute right-4 top-4 flex flex-col items-end gap-1.5'>
      {hud.feed.map((f) => (
        <div
          key={f.key}
          className='bf-fade-in flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold'
          style={{ background: f.mine ? 'rgba(255,205,46,.85)' : f.victimIsMe ? 'rgba(234,61,50,.85)' : 'rgba(0,0,0,.5)', color: f.mine ? '#2a1a00' : '#fff' }}
        >
          {!f.self && <span style={{ color: !f.mine && f.killerTeam !== -1 ? TEAM_COLORS[f.killerTeam] : undefined }}>{f.killer}</span>}
          <WeaponIcon weapon={f.weapon} size={f.weapon in WEAPONS ? 42 : 30} />
          {f.headshot && <HeadshotIcon size={15} />}
          {f.self && <SkullIcon size={15} />}
          <span style={{ color: !f.mine && f.victimTeam !== -1 ? TEAM_COLORS[f.victimTeam] : undefined }}>{f.victim}</span>
        </div>
      ))}
    </div>
  );
}

function Banner() {
  const hud = useHud();
  const { t } = useT();
  if (!hud.banner) return null;
  return (
    <div key={hud.banner.key} className='bf-pop absolute left-1/2 top-[11%] -translate-x-1/2 text-center'>
      <div className='bf-display bf-hud-text text-5xl text-[var(--bf-yellow)]'>{t('wave', { n: hud.banner.sub ?? '' })}</div>
    </div>
  );
}

function Death() {
  const hud = useHud();
  const { t } = useT();
  const d = hud.death!;
  return (
    <div className='bf-fade-in absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-2'>
      <div className='flex items-center gap-3 rounded-2xl bg-black/55 px-5 py-3'>
        <SkullIcon size={26} className='text-[var(--bf-red)]' />
        <span className='bf-display text-3xl'>{d.killer ? t('eliminatedBy', { name: d.killer }) : t('eliminatedSelf')}</span>
        <WeaponIcon weapon={d.weapon} size={56} className='text-white/80' />
      </div>
      {hud.settings?.mode !== 'solo' && <div className='text-sm font-semibold uppercase tracking-[0.25em] text-white/75'>{t('respawning')}</div>}
    </div>
  );
}

function Chat() {
  const hud = useHud();
  const game = useGame();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  game.input.onChat = () => {
    setOpen(true);
    game.openChat();
  };
  return (
    <div className='absolute bottom-28 left-6 flex w-80 flex-col gap-1'>
      {hud.chat.map((c) => (
        <div key={c.key} className='bf-fade-in bf-hud-text text-sm'>
          <span className='font-bold' style={{ color: c.team !== -1 ? TEAM_COLORS[c.team] : '#ffcd2e' }}>
            {c.name}
          </span>{' '}
          {c.text}
        </div>
      ))}
      {open && (
        <form
          className='pointer-events-auto'
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) game.chat(text.trim());
            setText('');
            setOpen(false);
            game.resume();
          }}
        >
          <input
            autoFocus
            className='bf-input w-full'
            placeholder={t('chatPlaceholder')}
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                game.resume();
              }
            }}
          />
        </form>
      )}
    </div>
  );
}

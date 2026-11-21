import { useState } from 'react';
import { WEAPONS } from '../../weapons/defs';
import { TEAM_COLORS } from '../../game/remotes';
import { useApp, useGame, useHud } from '../App';
import { useT } from '../i18n';
import { HeadshotIcon, SkullIcon } from '../icons';
import { Crosshair } from './Crosshair';
import { CauseIcon, Death } from './Death';
import { KillConfirm } from './KillConfirm';
import { TopBar } from './MatchClock';
import { Results, Scoreboard } from './Scoreboard';
import { UpgradePick } from './UpgradePick';
import { Ammo, Health, LOW_HEALTH } from './Vitals';

export function Hud() {
  const hud = useHud();
  const app = useApp();
  const game = useGame();
  const { t } = useT();
  const playing = hud.phase === 'playing' || hud.phase === 'warmup' || hud.phase === 'intermission';

  return (
    <div className='pointer-events-none absolute inset-0 select-none'>
      <LowHealth level={hud.alive ? Math.min(1, Math.max(0, (LOW_HEALTH - hud.health / hud.maxHealth) / 0.35)) : 0} />
      {hud.scoped && <div className='bf-scope' />}
      {hud.alive && playing && <Crosshair hidden={hud.scoped || hud.aiming || (!!hud.offer && !hud.offer.picked)} />}
      <KillConfirm />
      <TopBar />
      <KillFeed />
      {hud.alive && (
        <>
          <Health health={hud.health} max={hud.maxHealth} armor={hud.armor} />
          <Ammo />
        </>
      )}
      <Banner />
      <Chat />
      {hud.death && hud.phase !== 'ended' && <Death />}
      {hud.scoreboard && hud.phase !== 'ended' && <Scoreboard />}
      <UpgradePick />
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

/**
 * Below LOW_HEALTH the screen edges drain of colour and darken, and a deep red rim beats like a pulse in the outer
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
          <CauseIcon cause={f.weapon} size={f.weapon in WEAPONS || f.weapon === 'water' ? 42 : 30} />
          {f.headshot && <HeadshotIcon size={15} />}
          {f.self && f.weapon !== 'water' && <SkullIcon size={15} />}
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

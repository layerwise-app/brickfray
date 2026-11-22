import { useState } from 'react';
import { WEAPONS } from '../../weapons/defs';
import { waveTuning } from '../../sim/waves';
import { TEAM_COLORS } from '../../game/remotes';
import { useApp, useGame, useHud } from '../App';
import { useT } from '../i18n';
import { HeadshotIcon, SkullIcon } from '../icons';
import { Crosshair } from './Crosshair';
import { CauseIcon, Death } from './Death';
import { BountyChip } from './Bounty';
import { KillConfirm } from './KillConfirm';
import { TopBar } from './MatchClock';
import { ChainChip, MultiKill } from './MultiKill';
import { Results } from './Results';
import { Scoreboard } from './Scoreboard';
import { KindIntro, WaveBanner } from './SoloHud';
import { WarmupTips } from './WarmupTips';
import { UpgradePick } from './UpgradePick';
import { Ammo, Health, LOW_HEALTH } from './Vitals';
import { shownName } from './names';
import { TouchLayer } from '../touch/TouchLayer';
import { useTouchMode } from '../touch/useInputMode';

export function Hud() {
  const hud = useHud();
  const app = useApp();
  const game = useGame();
  const { t } = useT();
  const touch = useTouchMode();
  const playing = hud.phase === 'playing' || hud.phase === 'warmup' || hud.phase === 'intermission';
  /** The upgrade cards take the screen: the feed and the vitals stand aside until they leave. */
  const picking = !!hud.offer;

  return (
    <div className='pointer-events-none absolute inset-0 select-none'>
      <LowHealth level={hud.alive ? Math.min(1, Math.max(0, (LOW_HEALTH - hud.health / hud.maxHealth) / 0.35)) : 0} />
      {hud.alive && playing && <Crosshair hidden={hud.scoped || hud.aiming || (!!hud.offer && !hud.offer.picked)} />}
      <KillConfirm />
      {hud.alive && <MultiKill />}
      {hud.phase !== 'ended' && <TopBar />}
      {hud.phase !== 'ended' && !picking && <KillFeed />}
      {hud.alive && hud.phase !== 'ended' && !picking && (
        <>
          <Health health={hud.health} max={hud.maxHealth} armor={hud.armor} />
          <Ammo />
        </>
      )}
      <Banner />
      <KindIntro />
      <WarmupTips />
      <Chat />
      {hud.death && hud.phase !== 'ended' && <Death />}
      {hud.scoreboard && hud.phase !== 'ended' && <Scoreboard />}
      <UpgradePick />
      {hud.phase === 'ended' && <Results />}
      {hud.hint && (
        <div className='bf-pop absolute left-1/2 top-24 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-sm font-medium'>{t('ctrlHint')}</div>
      )}
      {hud.scoped && <div className='bf-scope-hint absolute bottom-[18%] left-1/2 -translate-x-1/2 text-sm font-semibold text-white/70'>{t(touch ? 'touch.scopeHint' : 'scopeHint')}</div>}
      {game.settings.showStats && hud.stats && (
        <div className='bf-stats absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[11px] leading-4 text-white/85'>
          {game.renderer.statsLine()} · {hud.stats.calls} calls · {(hud.stats.triangles / 1000).toFixed(0)}k tris · ping {hud.ping} ms
        </div>
      )}
      <TouchLayer />
      {!app.paused && !game.input.active && hud.phase !== 'ended' && <ClickToPlay />}
    </div>
  );
}

function ClickToPlay() {
  const game = useGame();
  const { t } = useT();
  const touch = useTouchMode();
  return (
    <button className='pointer-events-auto absolute inset-0 grid place-items-center bg-black/25' onClick={() => game.resume()}>
      <span className='bf-display bf-hud-text bf-pop rounded-2xl bg-black/40 px-6 py-3 text-3xl'>{t(touch ? 'touch.tapToPlay' : 'clickToPlay')}</span>
    </button>
  );
}

/**
 * Below LOW_HEALTH a thin red rim along the screen's edges beats like a pulse, and the outer band of the picture loses
 * some colour, both growing a little with the health lost (`level` 0…1). The rim is the same thickness along every
 * edge (an inset glow, not an ellipse that fills the corners), so the gun in the corner stays clear and readable.
 */
function LowHealth({ level }: { level: number }) {
  const on = level > 0;
  const clear = Math.round(80 - 8 * level);
  const edge = `radial-gradient(ellipse 50% 50% at center, transparent ${clear}%, black ${clear + 24}%)`;
  const grade = `saturate(${(1 - 0.45 * level).toFixed(3)}) brightness(${(1 - 0.06 * level).toFixed(3)})`;
  const beat = on ? `bf-heartbeat ${(1.15 - level * 0.4).toFixed(2)}s ease-in-out infinite` : undefined;
  const rim = `inset 0 0 ${(3 + 5 * level).toFixed(1)}vmin ${(0.4 + 0.8 * level).toFixed(2)}vmin rgba(170,0,0,${(0.55 + 0.35 * level).toFixed(2)})`;
  return (
    <>
      <style>{`@keyframes bf-heartbeat { 0%, 100% { opacity: .4; } 9% { opacity: 1; } 20% { opacity: .55; } 30% { opacity: .9; } 55% { opacity: .4; } }`}</style>
      <div
        className='absolute inset-0'
        style={{
          backdropFilter: on ? grade : undefined,
          WebkitBackdropFilter: on ? grade : undefined,
          maskImage: on ? edge : undefined,
          WebkitMaskImage: on ? edge : undefined
        }}
      />
      <div className='absolute inset-0' style={{ opacity: on ? 1 : 0, transition: 'opacity .4s ease' }}>
        <div className='absolute inset-0' style={{ boxShadow: rim, animation: beat }} />
      </div>
    </>
  );
}

function KillFeed() {
  const hud = useHud();
  const { t } = useT();
  return (
    <div className='bf-killfeed absolute right-4 top-4 flex flex-col items-end gap-1.5'>
      {hud.feed.map((f) => (
        <div
          key={f.key}
          className='bf-fade-in flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold'
          style={{ background: f.mine && !f.self ? 'rgba(255,205,46,.85)' : f.victimIsMe ? 'rgba(234,61,50,.85)' : 'rgba(0,0,0,.5)', color: f.mine && !f.self ? '#2a1a00' : '#fff' }}
        >
          {f.self ? (
            // Nobody else did it: a skull, the player and what happened, then the cause.
            <>
              <SkullIcon size={16} className='shrink-0' style={{ color: f.victimIsMe ? '#ffffff' : '#ff6a5a' }} />
              <FeedName name={shownName(t, f.victim, f.victimLook)} team={f.victimTeam} plain={f.victimIsMe} />
              <span className='font-medium opacity-75'>{t(f.weapon === 'water' ? 'feed.water' : 'feed.self')}</span>
              <CauseIcon cause={f.weapon} size={f.weapon in WEAPONS || f.weapon === 'water' ? 40 : 28} className='shrink-0' />
            </>
          ) : (
            <>
              <FeedName name={shownName(t, f.killer, f.killerLook)} team={f.killerTeam} plain={f.mine || f.victimIsMe} />
              <CauseIcon cause={f.weapon} size={f.weapon in WEAPONS || f.weapon === 'water' ? 48 : 32} className='shrink-0' />
              {f.headshot && <HeadshotIcon size={15} />}
              <FeedName name={shownName(t, f.victim, f.victimLook)} team={f.victimTeam} plain={f.mine || f.victimIsMe} />
            </>
          )}
          {f.bounty > 0 && <BountyChip amount={f.bounty} collected size='sm' />}
          {f.chain > 1 && <ChainChip count={f.chain} />}
        </div>
      ))}
    </div>
  );
}

/**
 * A name in the feed, in its team's colour. On the player's own yellow or red row a team colour would not read, so the
 * name stays the row's ink and a team-coloured brick goes before it.
 */
function FeedName({ name, team, plain }: { name: string; team: number; plain: boolean }) {
  if (team === -1) return <span>{name}</span>;
  if (!plain) return <span style={{ color: TEAM_COLORS[team] }}>{name}</span>;
  return (
    <span className='flex items-center gap-1.5'>
      <i className='h-2.5 w-2.5 shrink-0 rounded-[3px]' style={{ background: TEAM_COLORS[team], boxShadow: '0 0 0 1.5px rgba(255,255,255,.9)' }} />
      {name}
    </span>
  );
}

function Banner() {
  const hud = useHud();
  const { t } = useT();
  if (!hud.banner || hud.phase === 'ended') return null;
  const wave = Number(hud.banner.sub);
  const theme = hud.settings?.mode === 'solo' && wave > 0 ? waveTuning(hud.settings.difficulty, wave).theme : null;
  return (
    <div key={hud.banner.key} className='bf-banner bf-pop absolute left-1/2 top-[11%] -translate-x-1/2 text-center'>
      {theme ? <WaveBanner wave={hud.banner.sub ?? ''} theme={theme} /> : <div className='bf-display bf-hud-text text-5xl text-[var(--bf-yellow)]'>{t('wave', { n: hud.banner.sub ?? '' })}</div>}
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
    <div className='bf-chat absolute bottom-28 left-6 flex w-80 flex-col gap-1'>
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

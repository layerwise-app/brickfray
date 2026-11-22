import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { CharacterId } from '../../characters/types';
import { LOADOUTS } from '../../weapons/loadouts';
import { useApp, useGame, useHud } from '../App';
import { useT, type MessageKey } from '../i18n';
import { LockIcon, WeaponIcon } from '../icons';
import { watchHaptics } from './haptics';
import { RotatePrompt } from './RotatePrompt';
import { TouchCoach } from './TouchCoach';
import { BoardGlyph, BreathGlyph, BulletGlyph, CrouchGlyph, GrenadeGlyph, JumpGlyph, PauseGlyph, ReloadGlyph, RunGlyph, ScopeGlyph } from './TouchIcons';
import { ACTION_SPOTS, FIRE_LEFT_SPOT, STEADY_SPOT, STICK, TOP_BUTTON, type Spot } from './touch-layout';
import { TouchPad } from './touch-pad';
import { useTouchMode } from './useInputMode';
import './touch.css';

/** The on-screen controls while a match is played by touch (labelled in the first matches), and the portrait prompt on phones. */
export function TouchLayer() {
  const touch = useTouchMode();
  const app = useApp();
  const hud = useHud();
  const game = useGame();
  if (!touch) return null;
  const playing = !app.paused && game.input.active && hud.phase !== 'ended';
  return (
    <>
      {playing && <TouchControls />}
      <RotatePrompt />
    </>
  );
}

function TouchControls() {
  const game = useGame();
  const hud = useHud();
  const { t } = useT();
  const root = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const touch = game.input.touch;
  useSyncExternalStore(touch.subscribe, touch.getVersion, touch.getVersion);

  useEffect(() => {
    const pad = new TouchPad(root.current!, { base: base.current!, knob: knob.current! }, game);
    const offHaptics = watchHaptics(game);
    return () => {
      pad.dispose();
      offHaptics();
    };
  }, [game]);

  const { buttonSize: size, leftHanded } = game.settings.input.touch;
  const side = leftHanded ? 'left' : 'right';
  const stickSide = leftHanded ? 'right' : 'left';
  const live = hud.alive && !(hud.offer && !hud.offer.picked);
  const character = (hud.rows.find((r) => r.me)?.character ?? game.settings.character) as CharacterId;
  const loadout = LOADOUTS[character] ?? LOADOUTS.rivet;
  const other = hud.weapon === loadout.secondary ? loadout.primary : loadout.secondary;
  const charging = hud.grenades < hud.grenadeMax && hud.grenadeTimer > 0 ? 1 - hud.grenadeTimer / Math.max(1e-3, hud.grenadeRefill) : 0;
  const lowAmmo = hud.reload < 0 && hud.ammo <= Math.ceil(hud.mag * 0.25);
  const r = STICK.radius * size;

  const button = (spot: Spot, label: MessageKey, glyph: ReactNode, extra?: { on?: boolean; className?: string; style?: CSSProperties; badge?: ReactNode }) => (
    <Button key={spot.id} spot={spot} side={side} size={size} label={t(label)} on={extra?.on} className={extra?.className} style={extra?.style} badge={extra?.badge}>
      {glyph}
    </Button>
  );
  const icon = (spot: Spot) => Math.round(spot.d * size * 0.46);

  return (
    <div ref={root} className='bf-tc' data-live={live} data-board={hud.scoreboard} data-hand={leftHanded ? 'left' : 'right'}>
      <div className='bf-tc-top'>
        <div data-touch='pause' role='button' aria-label={t('touch.button.pause')} className='bf-tc-btn bf-tc-small' style={{ width: TOP_BUTTON, height: TOP_BUTTON }}>
          <PauseGlyph size={20} />
        </div>
        <div data-touch='scoreboard' role='button' aria-label={t('touch.button.scoreboard')} data-on={touch.scoreboard} className='bf-tc-btn bf-tc-small' style={{ width: TOP_BUTTON, height: TOP_BUTTON }}>
          <BoardGlyph size={20} />
        </div>
      </div>
      <div
        ref={base}
        className='bf-tc-stick'
        data-active='false'
        style={{
          ['--r' as string]: `${r}px`,
          [stickSide]: `calc(var(--bf-safe-${stickSide}) + ${STICK.x * size - r}px)`,
          bottom: `calc(var(--bf-safe-bottom) + ${STICK.y * size - r}px)`
        }}
      >
        <div className='bf-tc-run'>
          <RunGlyph size={Math.round(26 * size)} />
        </div>
        <div ref={knob} className='bf-tc-knob' style={{ width: STICK.knob * size, height: STICK.knob * size }} />
        {touch.sprintLock && (
          <div className='bf-tc-locked'>
            <LockIcon size={Math.round(18 * size)} />
          </div>
        )}
      </div>
      {live && (
        <>
          <TouchCoach size={size} side={side} stickSide={stickSide} />
          <Button spot={FIRE_LEFT_SPOT} side={stickSide} size={size} label={t('touch.button.fire')} className='bf-tc-fire'>
            <BulletGlyph size={icon(FIRE_LEFT_SPOT)} />
          </Button>
          {ACTION_SPOTS.map((spot) => {
            switch (spot.id) {
              case 'fire':
                return button(spot, 'touch.button.fire', <BulletGlyph size={icon(spot)} />, { className: 'bf-tc-fire' });
              case 'ads':
                return button(spot, 'touch.button.ads', <ScopeGlyph size={icon(spot)} />, { on: touch.ads });
              case 'crouch':
                return button(spot, 'touch.button.crouch', <CrouchGlyph size={icon(spot)} />, { on: touch.crouch });
              case 'jump':
                return hud.scoped
                  ? button(STEADY_SPOT, 'touch.button.steady', <BreathGlyph size={icon(STEADY_SPOT)} />)
                  : button(spot, 'touch.button.jump', <JumpGlyph size={icon(spot)} />);
              case 'reload':
                return button(spot, 'touch.button.reload', <ReloadGlyph size={icon(spot)} />, {
                  on: lowAmmo,
                  style: hud.reload >= 0 ? { ['--fill' as string]: `${Math.max(0, hud.reload) * 360}deg` } : undefined,
                  className: hud.reload >= 0 ? 'bf-tc-progress' : undefined
                });
              case 'grenade':
                return button(spot, 'touch.button.grenade', <GrenadeGlyph size={Math.round(spot.d * size * 0.5)} />, {
                  className: `${hud.grenades === 0 ? 'bf-tc-empty' : ''} ${charging > 0 ? 'bf-tc-progress' : ''}`,
                  style: charging > 0 ? { ['--fill' as string]: `${charging * 360}deg` } : undefined,
                  badge: <span className='bf-tc-badge'>{hud.grenades}</span>
                });
              case 'melee':
                return button(spot, 'touch.button.melee', <WeaponIcon weapon={loadout.melee} size={Math.round(spot.d * size * 0.7)} />);
              case 'swap':
                return button(spot, 'touch.button.swap', <WeaponIcon weapon={other} size={Math.round(spot.d * size * 0.78)} />);
              default:
                return null;
            }
          })}
        </>
      )}
    </div>
  );
}

function Button({ spot, side, size, label, on, className, style, badge, children }: { spot: Spot; side: 'left' | 'right'; size: number; label: string; on?: boolean; className?: string; style?: CSSProperties; badge?: ReactNode; children: ReactNode }) {
  const d = spot.d * size;
  return (
    <div
      data-touch={spot.id}
      data-on={on || undefined}
      role='button'
      aria-label={label}
      className={`bf-tc-btn ${className ?? ''}`}
      style={{
        width: d,
        height: d,
        [side]: `calc(var(--bf-safe-${side}) + ${spot.x * size - d / 2}px)`,
        bottom: `calc(var(--bf-safe-bottom) + ${spot.y * size - d / 2}px)`,
        ...style
      }}
    >
      {children}
      {badge}
    </div>
  );
}

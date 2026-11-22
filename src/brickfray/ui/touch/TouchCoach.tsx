import { useEffect, type CSSProperties } from 'react';
import type { MatchSettings } from '../../sim/types';
import { useHud } from '../App';
import { useT, type MessageKey } from '../i18n';
import { ACTION_SPOTS, STICK } from './touch-layout';

const KEY = 'brickfray.touchCoach';
/** The first touch matches label the controls; after this many, never again. */
const FIRST_MATCHES = 2;

const spot = (id: string) => ACTION_SPOTS.find((s) => s.id === id)!;
const fire = spot('fire');
const grenade = spot('grenade');
const reload = spot('reload');
const melee = spot('melee');
/** Matches already counted (the controls remount after every pause). */
const counted = new WeakSet<MatchSettings>();

function matchesSeen() {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return FIRST_MATCHES;
  }
}

function countMatch() {
  try {
    localStorage.setItem(KEY, String(matchesSeen() + 1));
  } catch {
    // Blocked storage: the labels show again next time, which is harmless.
  }
}

/**
 * Labels beside the controls through the warm-up of the first touch matches: the stick, where to drag to look, fire
 * (drag to aim) and the grenade (hold to cook). They sit in the gaps between the buttons, take no touches, and leave
 * when the fight starts so the wave banner and the new-snapbot card have the screen.
 */
export function TouchCoach({ size, side, stickSide }: { size: number; side: 'left' | 'right'; stickSide: 'left' | 'right' }) {
  const hud = useHud();
  const { t } = useT();
  const settings = hud.settings;
  const show = !!settings && hud.phase === 'warmup' && (counted.has(settings) || matchesSeen() < FIRST_MATCHES);

  // Storage is the external system: this match counts as one of the first.
  useEffect(() => {
    if (!show || !settings || counted.has(settings)) return;
    counted.add(settings);
    countMatch();
  }, [show, settings]);

  if (!show) return null;
  const at = (edge: 'left' | 'right', x: number, y: number, centred = false): CSSProperties => ({
    [edge]: `calc(var(--bf-safe-${edge}) + ${x * size}px)`,
    bottom: `min(calc(var(--bf-safe-bottom) + ${y * size}px), calc(100% - 64px))`,
    translate: centred ? (edge === 'left' ? '-50% 0' : '50% 0') : undefined
  });
  const chip = (key: MessageKey, style: CSSProperties, maxWidth: string) => (
    <span className='bf-tc-coach' style={{ ...style, maxWidth }}>
      {t(key)}
    </span>
  );
  const r = STICK.radius;
  const inner = grenade.x + grenade.d / 2 + 10;
  return (
    <div className='bf-tc-coaching'>
      {/* Between the stick and the melee button, however narrow the phone. */}
      {chip('touch.coach.move', at(stickSide, STICK.x + r + 12, STICK.y - 14), `min(220px, calc(100% - var(--bf-safe-left) - var(--bf-safe-right) - ${(STICK.x + r + 12 + melee.x + melee.d / 2 + 8) * size}px))`)}
      {chip('touch.coach.look', at(side, fire.x + 30, 292, true), '200px')}
      {chip('touch.coach.fire', at(side, fire.x + 24, fire.y + fire.d / 2 + 10, true), '132px')}
      {/* Inside the grenade, above reload, and clear of the warm-up countdown in the middle. */}
      {chip('touch.coach.grenade', at(side, inner, reload.y + reload.d / 2 + 4), `min(150px, calc(50% - 30px - var(--bf-safe-${side}) - ${inner * size}px))`)}
    </div>
  );
}

import type { WeaponId } from '../weapons/defs';
import type { ViewAction } from '../weapons/types';
import { cycleClip, loadsShells, reloadClip } from '../weapons/view/clips-guns';
import type { Surface } from '../world/types';
import type { AudioEngine } from './types';

/** Seconds an ejected case takes to reach the floor. */
const FALL = 0.48;
/** Auto fire drops at most one audible case per this many seconds. */
const CASE_GAP = 0.11;

/** Guns that throw a case with every shot (CASING in weapons/view/rig.ts); the others eject while the pump or bolt is worked. */
const CASE_ON_FIRE: ReadonlySet<WeaponId> = new Set(['ar', 'pistol', 'buzzer']);

/** When the clip the view model plays for a worked action or reload throws a case out, read from the clip itself. */
function ejection(action: ViewAction, weapon: WeaponId): { id: 'casing' | 'shell'; at: number } | null {
  const clip =
    action.type === 'cycle' ? cycleClip(weapon, action.duration) : action.type === 'reload' && !loadsShells(weapon) ? reloadClip(weapon, action.empty, action.duration) : null;
  const event = clip?.events.find(([, e]) => e === 'eject' || e === 'shellEject');
  return clip && event ? { id: event[1] === 'shellEject' ? 'shell' : 'casing', at: event[0] * clip.duration } : null;
}

/** How a case sounds where it lands: [volume, rate]. Foliage swallows it; water gets a small plip instead. */
const LANDING: Record<Surface, readonly [number, number]> = {
  plastic: [0.5, 1],
  stone: [0.55, 0.96],
  metal: [0.55, 1.08],
  glass: [0.5, 1.12],
  wood: [0.4, 0.88],
  foliage: [0.1, 0.8],
  water: [0.12, 1.6]
};

/** The local player's spent cases and shells, landing on whatever is under the player when they hit the floor. */
export class CaseSounds {
  private readonly pending: { at: number; id: 'casing' | 'shell' }[] = [];
  private last = -Infinity;

  constructor(private readonly audio: AudioEngine) {}

  /** A shot or a worked action of the local player at `clock`. */
  action(action: ViewAction, weapon: WeaponId, clock: number): void {
    if (action.type === 'fire') {
      if (CASE_ON_FIRE.has(weapon)) this.drop('casing', FALL, clock);
      return;
    }
    const eject = ejection(action, weapon);
    if (eject) this.drop(eject.id, eject.at + FALL, clock);
  }

  frame(clock: number, surface: Surface): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.at > clock) continue;
      this.pending.splice(i, 1);
      const [volume, rate] = LANDING[surface];
      if (surface === 'water') this.audio.play('impact:water', { volume, rate, priority: 1 });
      else this.audio.play(p.id, { volume, rate, priority: 2 });
    }
  }

  dispose(): void {
    this.pending.length = 0;
  }

  private drop(id: 'casing' | 'shell', delay: number, clock: number): void {
    if (clock - this.last < CASE_GAP) return;
    this.last = clock;
    this.pending.push({ at: clock + delay + Math.random() * 0.08, id });
  }
}

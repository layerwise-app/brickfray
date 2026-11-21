import type { WeaponId } from '../weapons/defs';
import { handlingSound } from './foley';
import type { AudioEngine, HandlingCue } from './types';

/** A rifle's empty reload reports the charging handle and the carrier running home 6 ms apart: one clack, not two. */
const SAME_MOTION: Partial<Record<HandlingCue, HandlingCue>> = { slideForward: 'boltForward' };
const SAME_WINDOW = 0.06;

/** Weapon-handling sounds for the view model's cues, in the family of the gun in hand. */
export class CueSounds {
  private readonly last = new Map<HandlingCue, number>();

  constructor(
    private readonly audio: AudioEngine,
    private readonly now: () => number = () => performance.now() / 1000
  ) {}

  play(cue: HandlingCue, weapon: WeaponId | null = null): void {
    const t = this.now();
    this.last.set(cue, t);
    const twin = SAME_MOTION[cue];
    if (twin && t - (this.last.get(twin) ?? -Infinity) < SAME_WINDOW) return;
    this.audio.play(handlingSound(cue, weapon), { volume: 0.8, priority: 6 });
  }
}

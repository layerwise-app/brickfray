import type { Bus } from './mixer';
import type { Synth } from './synth';

export type Category =
  | 'gun'
  | 'gunFar'
  | 'boom'
  | 'mech'
  | 'step'
  | 'move'
  | 'impact'
  | 'hit'
  | 'marker'
  | 'debris'
  | 'fx'
  | 'player'
  | 'ambient'
  | 'ui'
  | 'stinger';

export type Falloff = 'loud' | 'carry' | 'boom' | 'normal' | 'impact' | 'step' | 'handling' | 'quiet' | 'far';

export interface SoundSpec {
  category: Category;
  /** Render length per variant in seconds; trailing silence is trimmed afterwards. */
  duration: number;
  variants?: number;
  /** Overrides the category loudness target (LUFS-like, 100 ms window). */
  loudness?: number;
  /** Overrides the category falloff (the sniper carries further than the other guns). */
  falloff?: Falloff;
  render(s: Synth, variant: number): void;
}

export interface CategoryMix {
  /** Target max short-term loudness every variant is normalized to. */
  loudness: number;
  priority: number;
  /**
   * Where the player's own (unpositioned) sound of this category plays. `feedback` skips the low-health muffle: hit
   * and kill markers, the own body, the own weapon and its handling. Positioned sounds are the world and always play
   * on `effects`.
   */
  bus: Bus;
  /** Send level into the map's reverb (unit-energy impulse: 0.3 puts the tail about 10 dB under the dry sound). */
  reverb: number;
  /** Send of the player's own sound into the close reflections around them (mixer `near`): width from the first milliseconds. */
  near?: number;
  falloff: Falloff;
  /** Random playback-rate spread per play (±). */
  jitter: number;
  /** Random level spread per play (± dB), for sounds that repeat many times a second. */
  levelJitter?: number;
  /** Concurrent identical sounds allowed within the rate-limit window. */
  burst: number;
}

export const CATEGORIES: Record<Category, CategoryMix> = {
  gun: { loudness: -17, priority: 8, bus: 'feedback', reverb: 0.3, near: 0.3, falloff: 'loud', jitter: 0.025, levelJitter: 1, burst: 2 },
  gunFar: { loudness: -19, priority: 6, bus: 'effects', reverb: 0.4, falloff: 'loud', jitter: 0.03, levelJitter: 1, burst: 2 },
  boom: { loudness: -10.3, priority: 9, bus: 'effects', reverb: 0.3, falloff: 'boom', jitter: 0.04, burst: 2 },
  mech: { loudness: -23, priority: 6, bus: 'feedback', reverb: 0.04, near: 0.12, falloff: 'handling', jitter: 0.03, burst: 2 },
  step: { loudness: -23, priority: 3, bus: 'effects', reverb: 0.06, falloff: 'step', jitter: 0.06, levelJitter: 1.5, burst: 2 },
  move: { loudness: -22, priority: 4, bus: 'effects', reverb: 0.05, falloff: 'normal', jitter: 0.04, burst: 1 },
  impact: { loudness: -18, priority: 4, bus: 'effects', reverb: 0.1, falloff: 'impact', jitter: 0.06, levelJitter: 1, burst: 2 },
  hit: { loudness: -19, priority: 7, bus: 'feedback', reverb: 0.08, falloff: 'normal', jitter: 0.03, burst: 2 },
  marker: { loudness: -20, priority: 9, bus: 'marker', reverb: 0, falloff: 'normal', jitter: 0.015, burst: 1 },
  debris: { loudness: -27, priority: 2, bus: 'effects', reverb: 0.06, falloff: 'quiet', jitter: 0.08, levelJitter: 1.5, burst: 2 },
  fx: { loudness: -19, priority: 5, bus: 'effects', reverb: 0.12, falloff: 'normal', jitter: 0.03, burst: 2 },
  player: { loudness: -17, priority: 7, bus: 'feedback', reverb: 0.03, falloff: 'normal', jitter: 0.03, burst: 1 },
  ambient: { loudness: -31, priority: 1, bus: 'effects', reverb: 0.1, falloff: 'far', jitter: 0.06, levelJitter: 2, burst: 1 },
  ui: { loudness: -26, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0.01, burst: 1 },
  stinger: { loudness: -19, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0, burst: 1 }
};

/** Carry past the inverse law: from `from` m a sound gains up to `gain` dB (even steps in log distance) by `peak` m, eased back to nothing by `to` m. */
export interface Carry {
  from: number;
  peak: number;
  to: number;
  gain: number;
}

/**
 * Inverse distance model parameters (the panner's), and a carry on top for footsteps. `loud`: a gunshot at 60 m is
 * quiet but clearly audible; `carry`: the sniper, about 1 dB over `loud` at 30 m and 2 dB at 60 m. `boom`: an
 * explosion at 3 m sits 6–8 dB above the player's own rifle. `step`: flatter than the physical law so another player
 * is heard coming: at 3 m their step is as loud as the player's own; its carry leaves steps within 8 m as they are,
 * falls about 2 dB per doubling of distance from there so a step at 25 m stays over every map's bed in a quiet
 * moment, then fades it under the bed by 45 m. `handling`: another player's reload carries a little further than
 * their steps. `impact`: a bullet strike still reads at 15-20 m over the gunfire around it. `quiet`: debris, heard
 * within ~10 m. `far`: scenery heard from tens of metres away.
 */
export const FALLOFF: Record<Falloff, { ref: number; rolloff: number; carry?: Carry }> = {
  loud: { ref: 2, rolloff: 0.45 },
  carry: { ref: 2, rolloff: 0.35 },
  boom: { ref: 2.5, rolloff: 0.35 },
  normal: { ref: 2, rolloff: 1 },
  impact: { ref: 3, rolloff: 0.8 },
  step: { ref: 1.55, rolloff: 0.8, carry: { from: 8, peak: 25, to: 45, gain: 6.2 } },
  handling: { ref: 2.5, rolloff: 1 },
  quiet: { ref: 2, rolloff: 1.1 },
  far: { ref: 30, rolloff: 1 }
};

export const DEFAULT_VARIANTS = 4;

/** How much of its carry (0…1) a sound with this falloff has at `distance` m. */
export function carryAt(falloff: Falloff, distance: number): number {
  const c = FALLOFF[falloff].carry;
  if (!c || distance <= c.from || distance >= c.to) return 0;
  if (distance <= c.peak) return Math.log(distance / c.from) / Math.log(c.peak / c.from);
  const t = (distance - c.peak) / (c.to - c.peak);
  return 1 - t * t * (3 - 2 * t);
}

/** The carry's own gain at `distance` m (the panner applies the inverse law). */
export function carryGain(falloff: Falloff, distance: number): number {
  return 10 ** (((FALLOFF[falloff].carry?.gain ?? 0) * carryAt(falloff, distance)) / 20);
}

/** Distance gain: the inverse law and the carry. */
export function inverseGain(falloff: Falloff, distance: number): number {
  const { ref, rolloff } = FALLOFF[falloff];
  return (ref / (ref + rolloff * (Math.max(distance, ref) - ref))) * carryGain(falloff, distance);
}

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

export type Falloff = 'loud' | 'boom' | 'normal' | 'impact' | 'step' | 'handling' | 'quiet' | 'far';

export interface SoundSpec {
  category: Category;
  /** Render length per variant in seconds; trailing silence is trimmed afterwards. */
  duration: number;
  variants?: number;
  /** Overrides the category loudness target (LUFS-like, 100 ms window). */
  loudness?: number;
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
  marker: { loudness: -20, priority: 9, bus: 'feedback', reverb: 0, falloff: 'normal', jitter: 0.015, burst: 1 },
  debris: { loudness: -27, priority: 2, bus: 'effects', reverb: 0.06, falloff: 'quiet', jitter: 0.08, levelJitter: 1.5, burst: 2 },
  fx: { loudness: -19, priority: 5, bus: 'effects', reverb: 0.12, falloff: 'normal', jitter: 0.03, burst: 2 },
  player: { loudness: -17, priority: 7, bus: 'feedback', reverb: 0.03, falloff: 'normal', jitter: 0.03, burst: 1 },
  ambient: { loudness: -31, priority: 1, bus: 'effects', reverb: 0.1, falloff: 'far', jitter: 0.06, levelJitter: 2, burst: 1 },
  ui: { loudness: -26, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0.01, burst: 1 },
  stinger: { loudness: -19, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0, burst: 1 }
};

/**
 * Inverse distance model parameters. `loud`: a gunshot at 60 m is quiet but clearly audible. `boom`: an explosion
 * at 3 m sits 6–8 dB above the player's own rifle. `step`: flatter than the physical law so another player is heard
 * coming: at 3 m their step is as loud as the player's own, at 15 m still clear of every map's bed, yet ~9 dB under
 * their rifle at any distance. `handling`: another player's reload carries a little further than their steps.
 * `impact`: a bullet strike still reads at 15-20 m over the gunfire around it. `quiet`: debris, heard within ~10 m.
 * `far`: scenery heard from tens of metres away.
 */
export const FALLOFF: Record<Falloff, { ref: number; rolloff: number }> = {
  loud: { ref: 2, rolloff: 0.45 },
  boom: { ref: 2.5, rolloff: 0.35 },
  normal: { ref: 2, rolloff: 1 },
  impact: { ref: 3, rolloff: 0.8 },
  step: { ref: 1.3, rolloff: 0.8 },
  handling: { ref: 2.5, rolloff: 1 },
  quiet: { ref: 2, rolloff: 1.1 },
  far: { ref: 30, rolloff: 1 }
};

export const DEFAULT_VARIANTS = 4;

export function inverseGain(falloff: Falloff, distance: number): number {
  const { ref, rolloff } = FALLOFF[falloff];
  return ref / (ref + rolloff * (Math.max(distance, ref) - ref));
}

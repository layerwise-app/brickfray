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
  | 'ui'
  | 'stinger';

export type Falloff = 'loud' | 'normal' | 'quiet';

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
  bus: 'effects' | 'ui';
  /** Send level into the shared room reverb. */
  reverb: number;
  falloff: Falloff;
  /** Random playback-rate spread per play (±). */
  jitter: number;
  /** Concurrent identical sounds allowed within the rate-limit window. */
  burst: number;
}

export const CATEGORIES: Record<Category, CategoryMix> = {
  gun: { loudness: -9, priority: 8, bus: 'effects', reverb: 0.12, falloff: 'loud', jitter: 0.025, burst: 2 },
  gunFar: { loudness: -11, priority: 6, bus: 'effects', reverb: 0.12, falloff: 'loud', jitter: 0.03, burst: 2 },
  boom: { loudness: -9, priority: 9, bus: 'effects', reverb: 0.18, falloff: 'loud', jitter: 0.04, burst: 2 },
  mech: { loudness: -22, priority: 6, bus: 'effects', reverb: 0.03, falloff: 'quiet', jitter: 0.03, burst: 2 },
  step: { loudness: -24, priority: 3, bus: 'effects', reverb: 0.03, falloff: 'normal', jitter: 0.06, burst: 2 },
  move: { loudness: -22, priority: 4, bus: 'effects', reverb: 0.04, falloff: 'normal', jitter: 0.04, burst: 1 },
  impact: { loudness: -19, priority: 4, bus: 'effects', reverb: 0.08, falloff: 'normal', jitter: 0.06, burst: 2 },
  hit: { loudness: -17, priority: 7, bus: 'effects', reverb: 0.05, falloff: 'normal', jitter: 0.03, burst: 2 },
  marker: { loudness: -19, priority: 9, bus: 'effects', reverb: 0, falloff: 'normal', jitter: 0, burst: 1 },
  debris: { loudness: -27, priority: 2, bus: 'effects', reverb: 0.05, falloff: 'quiet', jitter: 0.08, burst: 2 },
  fx: { loudness: -18, priority: 5, bus: 'effects', reverb: 0.1, falloff: 'normal', jitter: 0.03, burst: 2 },
  player: { loudness: -17, priority: 7, bus: 'effects', reverb: 0.03, falloff: 'normal', jitter: 0.03, burst: 1 },
  ui: { loudness: -27, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0.01, burst: 1 },
  stinger: { loudness: -19, priority: 10, bus: 'ui', reverb: 0, falloff: 'normal', jitter: 0, burst: 1 }
};

/** Inverse distance model parameters; tuned so a gunshot at 60 m is quiet but clearly audible. */
export const FALLOFF: Record<Falloff, { ref: number; rolloff: number }> = {
  loud: { ref: 2, rolloff: 0.45 },
  normal: { ref: 2, rolloff: 1 },
  quiet: { ref: 1.5, rolloff: 1.5 }
};

export const DEFAULT_VARIANTS = 4;

export function inverseGain(falloff: Falloff, distance: number): number {
  const { ref, rolloff } = FALLOFF[falloff];
  return ref / (ref + rolloff * (Math.max(distance, ref) - ref));
}

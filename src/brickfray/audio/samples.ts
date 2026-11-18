import { WEAPON_SAMPLES } from './samples-weapons';
import { WORLD_SAMPLES } from './samples-world';
import type { SoundId } from './types';

/**
 * Recorded one-shots that replace a sound's synthesized recipe: paths under
 * `public/audio/`, one per variant. Loudness, variation, falloff and reverb
 * still come from the sound's category in the catalog.
 */
export type SampleMap = Partial<Record<SoundId, readonly string[]>>;

export const SAMPLES: SampleMap = { ...WEAPON_SAMPLES, ...WORLD_SAMPLES };

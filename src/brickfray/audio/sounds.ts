import type { SoundSpec } from './catalog';
import { FEEDBACK_SOUNDS } from './recipes/feedback';
import { FOLEY_SOUNDS } from './recipes/foley';
import { GUN_SOUNDS } from './recipes/guns';
import { IMPACT_SOUNDS_ALL } from './recipes/impacts';
import type { SoundId } from './types';

export const SOUNDS: Record<SoundId, SoundSpec> = {
  ...GUN_SOUNDS,
  ...FOLEY_SOUNDS,
  ...IMPACT_SOUNDS_ALL,
  ...FEEDBACK_SOUNDS
};

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

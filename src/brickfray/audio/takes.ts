import type { SoundId } from './types';

/**
 * A fixed pitch (cents) per take for families whose takes were recorded alike: the same performance, or the same
 * spectrum and envelope (review 10). Takes given different offsets sit about the width of their category's rate
 * jitter apart, so the jitter does not play one take as another.
 */
export const TAKE_PITCH: Partial<Record<SoundId, readonly number[]>> = {
  headshotMarker: [-100, -33, 33, 100],
  grenadeFuse: [-150, -50, 50, 150],
  'meleeSwing:sword': [0, 100, -100],
  'meleeHit:blade': [0, 0, 0, 100, -100],
  'whiz:spear': [-100, 100, 0],
  'whiz:rifle': [-100, 100, 0, 0, 0],
  'foley:stripOut': [100, 0, -100]
};

/** Playback-rate factor of one take. */
export function takeRate(id: SoundId, take: number): number {
  return 2 ** ((TAKE_PITCH[id]?.[take] ?? 0) / 1200);
}

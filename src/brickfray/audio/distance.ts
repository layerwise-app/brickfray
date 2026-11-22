import type { SoundId } from './types';

interface Blend {
  from: number;
  to: number;
  /** Shape of the take-over: under 1 the distant take comes in early, where the near one still falls off fast. */
  curve: number;
}

/**
 * A gunshot cross-fades from its near to its distant recording over 10-40 m, early in the range: the distant take sounds
 * louder at the ear than the near one at the same distance (it is darker, the head's shadow takes less of it), so it has
 * to come in where the falloff is steep for the level to keep falling about 1 dB every 5 m across the blend. A blast
 * takes over further out.
 */
const FAR_BLEND: Blend = { from: 10, to: 40, curve: 0.7 };
const BOOM_BLEND: Blend = { from: 30, to: 70, curve: 1 };

/** How much of a sound `distance` m away is its distant recording: 0 up to `blend.from`, 1 past `blend.to`. */
export function farShare(distance: number, blend: Blend = FAR_BLEND): number {
  return Math.min(Math.max((distance - blend.from) / (blend.to - blend.from), 0), 1) ** blend.curve;
}

/** The distant recording of a sound that has one, and the distances (m) over which it takes over. */
export function distantOf(id: SoundId): { id: SoundId; blend: Blend } | null {
  if (id.startsWith('fire:')) return { id: id.replace('fire:', 'fireFar:') as SoundId, blend: FAR_BLEND };
  if (id === 'explosion') return { id: 'explosionFar', blend: BOOM_BLEND };
  return null;
}

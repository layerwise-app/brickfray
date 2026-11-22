import type { Masonry } from './blocks';

export const CASTLE_STONE: Masonry = { colors: ['#9ea2a4', '#8e9395', '#adb0b0', '#83888b'], variance: 0.35, lens: [3, 4, 2, 5] };
export const WALK_TILE = '#c9bea6';

/**
 * The old square fortress's ring (courtyard half-size, wall thickness, wall-walk height, corner towers). Only
 * audio/scenery.ts still reads it for its fortress sound spots; FORTRESS_AMBIENCE in map-fortress.ts has the new ones.
 */
export const C = { inner: 30.8, outer: 34.8, walk: 3.84, tower: 27.6 } as const;

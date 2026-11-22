import type { MapId } from '../world/types';
import type { Vec3 } from './bullet-sounds';
import { BUILD, type Spot } from './scenery-anchors';
import type { AmbientSpot } from './types';

export type { Spot } from './scenery-anchors';

/** Scenery one-shots per map, each on the real objects it comes from; a map's list is built the first time it is read. */
export const SPOTS = {} as Record<MapId, readonly Spot[]>;
for (const map of Object.keys(BUILD) as MapId[]) {
  let built: readonly Spot[] | null = null;
  Object.defineProperty(SPOTS, map, { enumerable: true, get: () => (built ??= BUILD[map]()) });
}

/**
 * One scenery sound for `map` and where it comes from, `rng` giving uniform numbers in [0, 1). With `rank`, `tries`
 * places of the chosen kind are drawn and the lowest-ranked one wins (the match ranks by occlusion and distance, so most
 * spots come from something the listener could see).
 */
export function pickSpot(map: MapId, rng: () => number, rank?: (at: Vec3) => number, tries = 1): { spot: AmbientSpot; position: Vec3 } {
  const spots = SPOTS[map];
  let roll = rng() * spots.reduce((sum, s) => sum + s.weight, 0);
  const s = spots.find((x) => (roll -= x.weight) <= 0) ?? spots[0]!;
  let best: Vec3 | null = null;
  let bestRank = Infinity;
  for (let i = 0; i < tries; i++) {
    const position = place(s, rng);
    const r = rank ? rank(position) : 0;
    if (r < bestRank) [best, bestRank] = [position, r];
  }
  return { spot: s.spot, position: best! };
}

function place(s: Spot, rng: () => number): Vec3 {
  const [x, y, z] = s.at[Math.floor(rng() * s.at.length)]!;
  const roam = s.roam ?? 0;
  return { x: x + (rng() * 2 - 1) * roam, y: y + rng() * roam * 0.5, z: z + (rng() * 2 - 1) * roam };
}

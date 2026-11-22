import { templeCore } from './temple-core';
import { eastStrip, edges } from './temple-lanes';
import { doorways, turned, turnedFlight, type Flight, type Piece } from './temple-layout';
import type { Vec3 } from './util';

/** Every structure of the map: the core and the east strip with their half turns, then the four edges. */
export function templeGeometry(): { pieces: Piece[]; flights: Flight[]; doorways: Vec3[] } {
  doorways.length = 0;
  const p: Piece[] = [];
  const f: Flight[] = [];
  templeCore(p, f);
  p.push(...eastStrip());
  const seeds = doorways.flatMap((d): Vec3[] => [d, [-d[0], d[1], -d[2]]]);
  return { pieces: [...p, ...p.map(turned), ...edges()], flights: [...f, ...f.map(turnedFlight)], doorways: seeds };
}

/** Team spawns in the north camp (team 1); the south camp gets their half-turn copies. */
export const CAMP_SPAWNS: [number, number][] = [
  [-24.8, -39.2],
  [-20.0, -37.6],
  [-15.2, -40.0],
  [-10.4, -37.6],
  [-6.4, -40.0],
  [6.4, -40.0],
  [10.4, -37.6],
  [15.2, -40.0],
  [20.0, -37.6],
  [24.8, -39.2]
];

/** Free-for-all spawns (north half; mirrored), on the ground in every district and out of the galleries' sight. */
export const FFA_SPAWNS: [number, number, number][] = [
  [-12.8, 0, -38.4],
  [17.6, 0, -39.6],
  [-34.4, 0, -20.0],
  [-20.8, 0, -27.2],
  [20.0, 0, -9.6],
  [17.6, 0, -18.4],
  [22.4, 0, 4.0],
  [9.6, 0, 4.8],
  [8.0, 0, -14.4],
  [34.4, 0, -15.2]
];

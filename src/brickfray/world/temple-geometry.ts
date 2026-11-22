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
  [24.8, -39.2],
  [-34.4, -32.8],
  [34.4, -32.8],
  [-35.2, -24.0],
  [35.2, -24.0]
];

/**
 * Free-for-all spawns on the ground in every district and out of the galleries' sight, each with the point it faces:
 * [x, z, faceX, faceZ] (the half turn adds the other half).
 */
export const FFA_SPAWNS: [number, number, number, number][] = [
  [-12.8, -38.4, 0, 0],
  [17.6, -39.6, 0, 0],
  [-34.4, -20.0, 0, 0],
  [-20.8, -27.2, 0, 0],
  [20.0, -9.6, 0, 0],
  [17.6, -18.4, 0, 0],
  [22.4, 4.0, 0, 0],
  [8.0, 16.8, 0, 0],
  [7.2, -1.6, 0, 0],
  [34.4, -15.2, 0, 0]
];

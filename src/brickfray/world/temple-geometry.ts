import { templeCore } from './temple-core';
import { templeCover } from './temple-cover';
import { templeLanes } from './temple-lanes';
import { doorways, mirrored, mirroredFlight, type Flight, type Piece } from './temple-layout';
import type { Vec3 } from './util';

/** Every structure of the map: the west half and its mirror, then the pieces that stand across the axis. */
export function templeGeometry(): { pieces: Piece[]; flights: Flight[]; doorways: Vec3[] } {
  doorways.length = 0;
  const p: Piece[] = [];
  const f: Flight[] = [];
  const c: Piece[] = [];
  templeCore(p, f, c);
  templeLanes(p, f, c);
  templeCover(p);
  const seeds = doorways.flatMap((d): Vec3[] => [d, [-d[0], d[1], d[2]]]);
  return { pieces: [...p, ...p.map(mirrored), ...c], flights: [...f, ...f.map(mirroredFlight)], doorways: seeds };
}

/**
 * Team spawns of the west camp (team 0); the east camp gets their mirror. Six in the lee of the guest hall (the camp's
 * north yard, by the gorge path's mouth) and six in the lee of the refectory (its south yard, by the street's mouth).
 */
export const CAMP_SPAWNS: [number, number][] = [
  [-56.0, -24.8],
  [-59.2, -22.4],
  [-56.0, -19.2],
  [-59.2, -16.0],
  [-56.0, -12.8],
  [-59.2, -10.4],
  [-56.0, 24.8],
  [-59.2, 22.4],
  [-56.0, 19.2],
  [-59.2, 16.0],
  [-56.0, 12.8],
  [-59.2, 10.4]
];

/**
 * Free-for-all spawns on the ground in every district, more of them along the two outer lanes, each with the point it
 * faces: [x, z, faceX, faceZ] (the mirror adds the other half).
 */
export const FFA_SPAWNS: [number, number, number, number][] = [
  [-58.4, -40.0, -40, -38],
  [-46.4, -33.6, -30, -34],
  [-30.4, -40.8, -16, -38],
  [-11.2, -43.2, 0, -38],
  [-30.4, -11.2, -18, -4],
  [-30.4, 11.2, -18, 4],
  [-44.0, 3.2, -30, 0],
  [-46.4, 33.6, -30, 34],
  [-23.2, 36.8, -10, 36],
  [-10.4, 41.6, 0, 38]
];

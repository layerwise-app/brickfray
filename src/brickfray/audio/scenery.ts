import { C } from '../world/castle-parts';
import { K } from '../world/keep';
import { TOWER } from '../world/plaza-parts';
import { T } from '../world/temple-layout';
import type { MapId } from '../world/types';
import type { Vec3 } from './bullet-sounds';
import type { AmbientSpot } from './types';

interface Spot {
  spot: AmbientSpot;
  /** Relative odds per scenery slot. */
  weight: number;
  /** Where on the map it comes from: one of these, birds a little off their perch. */
  at: readonly (readonly [number, number, number])[];
  roam?: number;
}

const BELFRY: [number, number, number] = [(TOWER.x0 + TOWER.shaftX1) / 2, TOWER.belfryTop - 1, 0];
/** Plaza: the trees at the square's ends, roof ridges of the four rows of houses, the clock tower. */
const PLAZA_TREES: [number, number, number][] = [[-12.8, 7, -28.4], [4.8, 8, -28.4], [-4.8, 8, 28.4], [12.8, 7, 28.4], [-29.6, 7, 20], [29.6, 7, -20.8]];
const PLAZA_ROOFS: [number, number, number][] = [[-24, 12.5, -33], [8, 14, -33], [-16, 12.5, 33], [14, 14, 33], [-35, 14, -14], [-35, 12.5, 16], [35, 12.5, -24], [35, 14, 6]];
/** Fortress: flags on the four corner towers and the keep, crows on the battlements, birds in the trees outside. */
const TOWER_TOPS: [number, number, number][] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [number, number, number] => [sx * C.tower, C.walk + 3.36 + 6.4, sz * C.tower]));
const KEEP_FLAGS: [number, number, number][] = [[K.half - 0.4, K.roof + 4, K.half - 0.4], [-K.half + 0.4, K.roof + 4, -K.half + 0.4]];
const BATTLEMENTS: [number, number, number][] = [[0, C.walk + 1.5, C.outer - 2], [0, C.walk + 1.5, -C.outer + 2], [C.outer - 2, C.walk + 1.5, 8], [-C.outer + 2, C.walk + 1.5, -8], ...TOWER_TOPS.map(([x, y, z]): [number, number, number] => [x, y - 3, z])];
const FORTRESS_TREES: [number, number, number][] = [[-25.6, 6, -22.4], [25.6, 6, 22.4], [-9.2, 6, 25.2], [9.2, 6, -25.2], [-48, 7, 12], [46, 7, -18], [14, 7, 50], [-20, 7, -50]];
/** Docks: gulls over the harbour, mooring lines at the boat and the pier heads, ships out at sea (+z). */
const HARBOUR_SKY: [number, number, number][] = [[-20, 12, 34], [15, 15, 44], [36, 10, 28], [0, 18, 60], [-42, 14, 22], [0, 10, -21], [28, 9, 16]];
const MOORINGS: [number, number, number][] = [[-8, 1, 23.4], [8, 1, 23.4], [-24, 0.5, 20], [0, 0.5, 20], [24, 0.5, 20]];
const SHIPS: [number, number, number][] = [[-70, 10, 150], [85, 10, 170], [15, 10, 210]];
/**
 * Temple: gongs in the two bell towers, wind chimes and banners on the shrine, jungle birds and bamboo round the
 * ruins, the streams along both banks and the lotus pools' fountains, crows on the rows' roofs.
 */
const GONGS: [number, number, number][] = [[3.2, 9.6, -16], [-3.2, 9.6, 16]];
const BANNERS: [number, number, number][] = [[T.shrine, 6, T.shrine], [-T.shrine, 6, -T.shrine], [T.shrine, 6, -T.shrine], [-T.shrine, 6, T.shrine]];
const JUNGLE: [number, number, number][] = [[-30, 9, -27], [30, 9, 27], [-27, 8, 18], [27, 8, -18], [-8, 10, -33], [8, 10, 33], [-37, 10, -6], [37, 10, 6]];
const TEMPLE_ROOFS: [number, number, number][] = [[-14, T.hallTop, -14], [14, T.hallTop, 14], [13, 7.7, -16], [-13, 7.7, 16]];
const BAMBOO: [number, number, number][] = JUNGLE.map(([x, , z]): [number, number, number] => [x, 4, z]);
const WATER: [number, number, number][] = [
  ...[-1, 1].flatMap((side) => [-22, -8, 8, 22].map((z): [number, number, number] => [side * (T.edge + 1.2), T.water + 0.4, z])),
  [-13.6, 0.4, -5.6],
  [13.6, 0.4, 5.6],
  [0.8, 0.4, -22.4],
  [-0.8, 0.4, 22.4]
];

/** Scenery one-shots per map: what, how often against each other, and from where. */
export const SPOTS: Record<MapId, readonly Spot[]> = {
  plaza: [
    { spot: 'bird', weight: 5, at: [...PLAZA_TREES, ...PLAZA_ROOFS], roam: 2 },
    { spot: 'pigeon', weight: 2, at: [...PLAZA_ROOFS, BELFRY], roam: 1.5 },
    { spot: 'crow', weight: 1, at: PLAZA_ROOFS, roam: 2 },
    { spot: 'bell', weight: 0.5, at: [BELFRY] }
  ],
  fortress: [
    { spot: 'flag', weight: 3, at: [...TOWER_TOPS, ...KEEP_FLAGS] },
    { spot: 'crow', weight: 2, at: BATTLEMENTS, roam: 2 },
    { spot: 'bird', weight: 2, at: FORTRESS_TREES, roam: 2 }
  ],
  docks: [
    { spot: 'gull', weight: 5, at: HARBOUR_SKY, roam: 6 },
    { spot: 'creak', weight: 2, at: MOORINGS },
    { spot: 'horn', weight: 0.5, at: SHIPS }
  ],
  temple: [
    { spot: 'jungle', weight: 4, at: JUNGLE, roam: 3 },
    { spot: 'bird', weight: 1.5, at: JUNGLE, roam: 3 },
    { spot: 'bamboo', weight: 2, at: BAMBOO, roam: 3 },
    { spot: 'water', weight: 1.5, at: WATER, roam: 1 },
    { spot: 'chime', weight: 1, at: BANNERS },
    { spot: 'flag', weight: 1, at: BANNERS },
    { spot: 'crow', weight: 0.5, at: TEMPLE_ROOFS, roam: 2 },
    { spot: 'gong', weight: 0.4, at: GONGS }
  ]
};

/** One scenery sound for `map` and where it comes from, `rng` giving uniform numbers in [0, 1). */
export function pickSpot(map: MapId, rng: () => number): { spot: AmbientSpot; position: Vec3 } {
  const spots = SPOTS[map];
  let roll = rng() * spots.reduce((sum, s) => sum + s.weight, 0);
  const s = spots.find((x) => (roll -= x.weight) <= 0) ?? spots[0]!;
  const [x, y, z] = s.at[Math.floor(rng() * s.at.length)]!;
  const roam = s.roam ?? 0;
  return { spot: s.spot, position: { x: x + (rng() * 2 - 1) * roam, y: y + rng() * roam * 0.5, z: z + (rng() * 2 - 1) * roam } };
}

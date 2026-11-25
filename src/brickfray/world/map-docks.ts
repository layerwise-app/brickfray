import * as THREE from 'three';
import { docksBackdrop } from './backdrop-docks';
import { docksClusters } from './docks-clusters';
import { docksGround } from './docks-ground';
import { ALLEY, BERTH, CENTRAL_ROW, LAND, QUAY, SHED_ROAD, SHIP, SQUARE, YARD_ROAD } from './docks-layout';
import { docksQuay } from './docks-quay';
import { CRANE_Z, docksMasses } from './docks-yard';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { yawToward } from './util';
import { END_DOOR, WAREHOUSE, WH } from './warehouse';
import { warehouseDressing } from './warehouse-dressing';

/**
 * Team spawns in the base road between the lane mouths, behind the customs house and block 1 (never on a mouth's
 * line); free-for-all spawns at the hall's corners, the square's corner by the clock, both ends of the stack alley,
 * the berth's alcove, the quay's far end and the shed road by its fence. All mirrored about x = 0.
 */
function spawns(p: Plan) {
  const north = (SHED_ROAD.z1 + YARD_ROAD.z0) / 2;
  const south = (YARD_ROAD.z1 + QUAY.z0) / 2;
  const team: [number, number][] = [
    [-59.2, north - 5.6], [-61.6, north - 2.4], [-57.2, north], [-60.8, north + 2.8], [-58.0, north + 4.4],
    [-59.2, south - 5.0], [-61.6, south - 2.2], [-57.2, south + 0.2], [-60.8, south + 3.0], [-58.4, south + 5.4]
  ];
  for (const [x, z] of team) p.spawn(x, 0, z, yawToward([x, z], [0, z]), 0);
  for (const [x, z] of team) p.spawn(-x, 0, z, yawToward([-x, z], [0, z]), 1);
  const ffa: [number, number][] = [
    [-19.2, WH.z1 - 5.6], [-21.2, SQUARE.z0 + 2.8], [-(ALLEY.n0 + ALLEY.n1) / 2, YARD_ROAD.z1 + 1.4], [-(ALLEY.s0 + ALLEY.s1) / 2, QUAY.z0 - 1.4],
    [-26.4, (CENTRAL_ROW.z0 + CENTRAL_ROW.z1) / 2], [-50.0, QUAY.z1 - 2.8], [-46.0, SHED_ROAD.z0 + 2.4], [-12.0, WH.z0 + 2.4]
  ];
  for (const [x, z] of ffa) for (const s of [-1, 1]) p.spawn(s * x, 0, z, yawToward([s * x, z], [0, -20]));
}

const Q = QUAY.z0;
export const DOCKS_VIEWS: LabView[] = [
  { name: 'overview', cam: [70, 62, 63], target: [0, 0, -22], fov: 50 },
  { name: 'overview-sea', cam: [-40, 44, 75], target: [0, 0, -22], fov: 50 },
  { name: 'yard-road', cam: [-56, 1.62, -22.8], target: [0, 1.6, -22.8], fov: 70 },
  { name: 'quay', cam: [-56, 1.62, Q + 5.0], target: [-20, 1.6, Q + 3.0], fov: 70 },
  { name: 'berth', cam: [-27, 1.62, BERTH.z0 + 4.8], target: [10, 2.0, BERTH.z0 + 4.8], fov: 70 },
  { name: 'square', cam: [-22, 1.62, SQUARE.z0 + 6], target: [10, 4.0, -20], fov: 75 },
  { name: 'hall', cam: [-22.6, 1.62, (END_DOOR[0] + END_DOOR[1]) / 2], target: [0, 1.6, (END_DOOR[0] + END_DOOR[1]) / 2], fov: 75 },
  { name: 'gallery', cam: [-10, WH.deck + 1.62, WH.z1 - 1.4], target: [6, 1.0, -22], fov: 75 },
  { name: 'shed-road', cam: [-62, 1.62, (SHED_ROAD.z0 + SHED_ROAD.z1) / 2], target: [-20, 2.0, (SHED_ROAD.z0 + SHED_ROAD.z1) / 2], fov: 70 },
  { name: 'card', cam: [-30, 9, Q + 25], target: [0, 3, CRANE_Z + 8.8], fov: 60 }
];

export const DOCKS = defineMap({
  id: 'docks',
  name: 'Golden Wharf',
  atmosphere: {
    zenith: '#5a7cb4',
    horizon: '#ffc98a',
    ground: '#a08a68',
    sunColor: '#ffb469',
    sunIntensity: 2.6,
    sunDirection: new THREE.Vector3(-0.5, 0.42, 0.8).normalize(),
    fogNear: 80
  },
  bounds: { min: [-LAND.x - 0.4, -6, LAND.back - 0.4], max: [LAND.x + 0.4, 40, SHIP.z + SHIP.beam + 0.6] },
  killY: -0.8,
  seed: 41,
  plan() {
    const p = new Plan();
    docksGround(p);
    docksQuay(p);
    p.add(WAREHOUSE, {});
    warehouseDressing(p);
    docksMasses(p);
    docksClusters(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => docksBackdrop(d)
});

import * as THREE from 'three';
import { STAIRS, type Masonry } from './blocks';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { plazaBackdrop } from './plaza-backdrop';
import { townBuildings } from './plaza-buildings';
import { edgeDistrict } from './plaza-edges';
import { EDGE, Layout } from './plaza-layout';
import { middleDistrict } from './plaza-middle';
import { northDistrict } from './plaza-north';
import { plazaGround } from './plaza-ground';
import { plazaProps } from './plaza-props';
import { southDistrict } from './plaza-south';
import { PLAZA_TOWN } from './plaza-town';
import { yawToward } from './util';

const STONE: Masonry = { colors: ['#e3d6bc', '#d6c7a8', '#efe5cf'], variance: 0.3 };

export function plazaLayout() {
  const L = new Layout();
  edgeDistrict(L);
  northDistrict(L);
  middleDistrict(L);
  southDistrict(L);
  return L;
}

/** Team 1 waits at the station and the terminus wings (north), team 0 in the park, the alley and the site road (south); none on the quay, whose 42 m field would put the two sides in sight within 3 s. */
const TEAM1: [number, number][] = [[-41.6, -37.6], [-37.6, -36.0], [-25.6, -38.4], [-17.6, -38.4], [-6.4, -37.6], [6.4, -37.6], [12.0, -38.4], [16.0, -38.4], [24.0, -38.4], [28.8, -38.4]];
const TEAM0: [number, number][] = [[-41.6, 37.6], [-37.6, 36.0], [-28.0, 37.6], [-17.6, 37.6], [-2.4, 37.6], [8.8, 37.6], [17.6, 37.6], [22.4, 38.4], [28.0, 37.6], [-9.6, 38.4]];
/** FFA spawns stand in the open where nobody upstairs sees them: a spawn hidden in a shop or behind a stall looks safe with an enemy a few metres round the corner. */
const FFA: [number, number][] = [
  [-40.0, -24.0], [-36.0, -15.2], [-27.2, -26.4], [0.0, -26.4], [27.2, -26.4], [38.4, -29.6], [-16.0, 9.6], [11.2, 16.0], [32.0, 4.8], [4.8, 11.2],
  [14.4, -14.4], [9.6, -4.8], [22.0, 7.2], [-7.2, -36.0], [7.2, -33.6], [42.4, -16.0], [37.6, -4.8], [35.2, 13.6], [42.4, 9.6], [-40.0, 24.0],
  [-27.2, 26.4], [-12.0, 30.4], [10.4, 30.4], [25.6, 24.0], [38.4, 28.0], [-37.6, 32.0]
];

function spawns(p: Plan) {
  for (const [x, z] of TEAM1) p.spawn(x, 0, z, Math.PI, 1);
  for (const [x, z] of TEAM0) p.spawn(x, 0, z, 0, 0);
  for (const [x, z] of FFA) p.spawn(x, 0, z, yawToward([x, z], [0, 0]));
}

export const PLAZA_VIEWS: LabView[] = [
  { name: 'overview', cam: [52, 66, 70], target: [0, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 120, 0.1], target: [0, 0, 0], fov: 45 },
  { name: 'overview-north', cam: [-44, 58, -68], target: [0, 0, 0], fov: 50 },
  { name: 'square', cam: [-15.2, 1.62, 13.6], target: [6, 3, -8], fov: 70 },
  { name: 'terminus', cam: [-40, 1.62, -26], target: [0, 2, -36], fov: 70 },
  { name: 'station', cam: [-9.2, 1.62, -32.0], target: [9, 1.6, -38], fov: 75 },
  { name: 'hall', cam: [-41.6, 1.62, -10.4], target: [-30, 1.8, 8], fov: 75 },
  { name: 'townhall', cam: [20.8, 1.62, -8.8], target: [20.8, 2, 9], fov: 75 },
  { name: 'quay', cam: [33.6, 1.62, -19.6], target: [40, 1.2, 20], fov: 70 },
  { name: 'canal', cam: [28.0, 1.62, -8.0], target: [44, 1, 2], fov: 70 },
  { name: 'site', cam: [32, 1.62, 12], target: [24, 3, 26], fov: 70 },
  { name: 'park', cam: [-22.4, 1.62, 24.0], target: [-6, 1.5, 36], fov: 70 },
  { name: 'alley', cam: [-38.4, 1.62, 38.4], target: [-38.4, 3, 14], fov: 70 },
  { name: 'loggia', cam: [11.2, 5.46, -7.2], target: [-8, 1, -1], fov: 70 },
  { name: 'edge-north', cam: [-22, 1.62, -38.6], target: [-8, -2.5, -50], fov: 70 },
  { name: 'edge-east', cam: [42.0, 1.62, 8.8], target: [58, -0.5, 18], fov: 70 },
  { name: 'edge-south', cam: [24.0, 1.62, 37.0], target: [30, 0.8, 60], fov: 70 },
  { name: 'edge-west', cam: [-36, 1.62, -26], target: [-62, 3, -32], fov: 70 }
];

export const PLAZA = defineMap({
  id: 'plaza',
  name: 'Sunny Plaza',
  atmosphere: {
    zenith: '#80a8cc',
    horizon: '#efe8da',
    ground: '#c2aa86',
    sunColor: '#ffecd0',
    sunIntensity: 3.0,
    sunDirection: new THREE.Vector3(0.5, 0.62, 0.42).normalize(),
    fogNear: 85,
    clouds: { count: 11, seed: 3 }
  },
  bounds: { min: [-EDGE.x - 0.4, -6, -EDGE.z - 0.4], max: [EDGE.x + 0.4, 40, EDGE.z + 0.4] },
  killY: -4,
  seed: 11,
  plan() {
    const p = new Plan();
    const L = plazaLayout();
    plazaGround(p);
    p.add(PLAZA_TOWN, L);
    townBuildings(p, L);
    plazaProps(p);
    for (const f of L.flights) p.add(STAIRS, { ...f, style: STONE, surface: 'stone' });
    p.navSeeds.push(...L.seeds);
    spawns(p);
    return p;
  },
  backdrop: (d) => plazaBackdrop(d)
});

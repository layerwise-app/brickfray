import * as THREE from 'three';
import { STAIRS, type Masonry } from './blocks';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { plazaBackdrop } from './plaza-backdrop';
import { townBuildings } from './plaza-buildings';
import { CANAL, edgeDistrict } from './plaza-edges';
import { plazaGround } from './plaza-ground';
import { BASE, BLVD, LAND, Layout, QUAY, STREET } from './plaza-layout';
import { middleDistrict, PORTICO } from './plaza-middle';
import { CAFE, northDistrict } from './plaza-north';
import { plazaProps } from './plaza-props';
import { ARCADE, southDistrict } from './plaza-south';
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

/**
 * Team spawns in the base roads (west team 0, east team 1): four by the boulevard mouth, two by Market Street, four by
 * the quay mouth, each behind a corner block so no lane looks down on it (shortest routes then use every lane). Free-for-all spawns spread over every district (never up high), mirrored.
 */
function spawns(p: Plan) {
  const team: [number, number][] = [
    [-61.6, -29.6], [-58.4, -28.0], [-61.6, -25.6], [-58.4, -23.2],
    [-61.6, -13.6], [-58.4, 4.8],
    [-61.6, 17.6], [-58.4, 20.0], [-61.6, 23.2], [-58.4, 25.6]
  ];
  for (const [x, z] of team) {
    p.spawn(x, 0, z, yawToward([x, z], [0, z]), 0);
    p.spawn(-x, 0, z, yawToward([-x, z], [0, z]), 1);
  }
  const ffa: [number, number][] = [
    [-59.2, -38.4], [-59.2, 30.4], [-46.4, -36.0], [-34.4, -22.4], [-50.4, -4.0], [-25.6, -17.2], [-26.4, 14.4],
    [-13.6, -15.2], [-42.4, 10.4], [-46.8, 24.0], [-44.0, 33.6], [-24.0, 37.6], [-11.2, 31.2]
  ];
  for (const [x, z] of ffa) for (const s of [-1, 1]) p.spawn(s * x, 0, z, yawToward([s * x, z], [0, 0]));
}

const MID_BLVD = (BLVD.z0 + BLVD.z1) / 2;
const MID_ST = (STREET.z0 + STREET.z1) / 2;
const MID_QUAY = (QUAY.z0 + QUAY.side) / 2;
export const PLAZA_VIEWS: LabView[] = [
  { name: 'overview', cam: [64, 70, 78], target: [0, 0, -2], fov: 50 },
  { name: 'top', cam: [0, 150, 0.1], target: [0, 0, -2], fov: 50 },
  { name: 'overview-north', cam: [-58, 64, -82], target: [0, 0, -2], fov: 50 },
  { name: 'overview-west', cam: [-96, 56, 30], target: [0, 0, -2], fov: 50 },
  { name: 'boulevard', cam: [-BASE + 2, 1.62, MID_BLVD], target: [0, 1.6, MID_BLVD], fov: 70 },
  { name: 'street', cam: [-BASE + 2, 1.62, MID_ST], target: [-10, 1.6, MID_ST], fov: 70 },
  { name: 'quay', cam: [-BASE + 2, 1.62, MID_QUAY], target: [0, 1.6, MID_QUAY], fov: 70 },
  { name: 'square-w', cam: [-27, 1.62, 14], target: [-12, 2.5, -12], fov: 75 },
  { name: 'square-e', cam: [27, 1.62, -17], target: [12, 2.5, 8], fov: 75 },
  { name: 'tower-street', cam: [-24, 1.62, -17.6], target: [10, 2.5, -15.2], fov: 75 },
  { name: 'portico', cam: [-6, PORTICO.deck + 1.62, 7.2], target: [6, 1.0, 14], fov: 75 },
  { name: 'gallery', cam: [-10, ARCADE.deck + 1.62, 27.6], target: [-30, 1.0, 36], fov: 75 },
  { name: 'balcony', cam: [-10, CAFE.deck + 1.62, (CAFE.z0 + CAFE.z1) / 2], target: [-30, 1.0, -42], fov: 75 },
  { name: 'hall', cam: [-36.8, 1.62, -21.2], target: [-22, 1.8, -29], fov: 75 },
  { name: 'yard', cam: [-37, 1.62, 18.4], target: [-48, 2, 9], fov: 75 },
  { name: 'edge-west', cam: [-56, 1.62, -2], target: [-80, 2, -2], fov: 70 },
  { name: 'edge-east', cam: [56, 1.62, -6], target: [80, 2, -10], fov: 70 },
  { name: 'edge-south', cam: [-20, 1.62, 38], target: [-12, 1.5, 60], fov: 70 },
  { name: 'card', cam: [38, 22, 26], target: [0, 8, -4], fov: 55 }
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
    fogNear: 95,
    clouds: { count: 11, seed: 3 }
  },
  bounds: { min: [-LAND.x - 0.4, -6, LAND.north - BLVD.jog - 0.4], max: [LAND.x + 0.4, 40, LAND.south + 0.4] },
  killY: CANAL.water - 3,
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

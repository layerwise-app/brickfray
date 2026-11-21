import * as THREE from 'three';
import { WATER } from './blocks';
import { templeBackdrop } from './backdrop-temple';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { templeDressing } from './temple-dressing';
import { CAMP_SPAWNS, FFA_SPAWNS, T } from './temple-layout';
import { templeStructures } from './temple-parts';
import { yawToward } from './util';

function streams(p: Plan) {
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -34.4 : 31.2;
    p.add(WATER, { x0, z0: -T.edge, x1: x0 + 3.2, z1: T.edge, y: T.water, color: '#2a7f78' });
  }
}

function spawns(p: Plan) {
  for (const [x, z] of CAMP_SPAWNS) p.spawn(x, 0, z, Math.PI, 1);
  for (const [x, z] of CAMP_SPAWNS) p.spawn(-x, 0, -z, 0, 0);
  for (const [x, y, z] of FFA_SPAWNS) {
    p.spawn(x, y, z, yawToward([x, z], [0, 0]));
    p.spawn(-x, y, -z, yawToward([-x, -z], [0, 0]));
  }
}

const EYE = 1.62;
const HIGH = T.high + EYE;

export const TEMPLE_VIEWS: LabView[] = [
  { name: 'overview', cam: [40, 50, 56], target: [0, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 95, 0.1], target: [0, 0, 0], fov: 45 },
  { name: 'overview-west', cam: [-58, 40, -24], target: [0, 0, 0], fov: 50 },
  { name: 'aerial', cam: [-30, 24, 30], target: [-2, 2, 0], fov: 55 },
  { name: 'card', cam: [-18.8, 5.6, 0.6], target: [0, 6.5, -0.6], fov: 68 },
  { name: 'bridge', cam: [-18.8, HIGH, 0], target: [0, 5, 0], fov: 75 },
  { name: 'shrine-roof', cam: [-4.4, HIGH, -2.4], target: [10, 3, -12], fov: 75 },
  { name: 'court', cam: [-16.8, EYE, -9.4], target: [2, 3, -2], fov: 75 },
  { name: 'altar', cam: [13.6, HIGH, -12], target: [-6, 1, 2], fov: 75 },
  { name: 'lane-west', cam: [-27.6, EYE, -17.6], target: [-27.6, 1.6, 10], fov: 70 },
  { name: 'gallery', cam: [-23.2, EYE, -17.2], target: [-23.2, 1.8, 10], fov: 70 },
  { name: 'camp-north', cam: [-24, EYE, -28.8], target: [6, 3, -20], fov: 75 },
  { name: 'hall', cam: [-20.0, EYE, -16.8], target: [-6, 1.4, -12.4], fov: 75 },
  { name: 'crypt', cam: [-3.6, EYE, -17.6], target: [-3.6, 1.4, 0], fov: 70 },
  { name: 'shrine-inside', cam: [-4.6, EYE, -2.6], target: [3, 1.4, 2.4], fov: 75 }
];

export const TEMPLE = defineMap({
  id: 'temple',
  name: 'Jade Temple',
  atmosphere: {
    zenith: '#4f9ad6',
    horizon: '#d9ead2',
    ground: '#7f9a6a',
    sunColor: '#fff0cc',
    sunIntensity: 2.8,
    sunDirection: new THREE.Vector3(0.62, 0.55, -0.35).normalize(),
    fogNear: 80,
    clouds: { count: 9, seed: 5 }
  },
  bounds: { min: [-34.4, -6, -30.8], max: [34.4, 40, 30.8] },
  killY: -0.8,
  seed: 61,
  plan() {
    const p = new Plan();
    streams(p);
    templeStructures(p);
    templeDressing(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => templeBackdrop(d)
});

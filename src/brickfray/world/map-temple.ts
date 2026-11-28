import * as THREE from 'three';
import { templeBackdrop } from './backdrop-temple';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { templeDressing } from './temple-dressing';
import { CAMP_SPAWNS, FFA_SPAWNS } from './temple-geometry';
import { T } from './temple-layout';
import { templeStructures } from './temple-parts';
import { HAZE } from './temple-scenery';
import { yawToward } from './util';

function spawns(p: Plan) {
  for (const [x, z] of CAMP_SPAWNS) p.spawn(x, 0, z, yawToward([x, z], [0, z * 0.5]), 0);
  for (const [x, z] of CAMP_SPAWNS) p.spawn(-x, 0, z, yawToward([-x, z], [0, z * 0.5]), 1);
  for (const [x, z, fx, fz] of FFA_SPAWNS) {
    p.spawn(x, 0, z, yawToward([x, z], [fx, fz]));
    p.spawn(-x, 0, z, yawToward([-x, z], [-fx, fz]));
  }
}

const EYE = 1.62;
const HIGH = T.high + EYE;

export const TEMPLE_VIEWS: LabView[] = [
  { name: 'overview', cam: [70, 60, 72], target: [0, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 150, 0.1], target: [0, 0, 0], fov: 50 },
  { name: 'nave', cam: [-4.4, EYE, -11.2], target: [3, 2.4, 8], fov: 75 },
  { name: 'gallery', cam: [-9.2, HIGH, -2], target: [6, 1, 2], fov: 75 },
  { name: 'court-west', cam: [-33.2, EYE, -12], target: [-14, 1.8, 6], fov: 75 },
  { name: 'court-east', cam: [33.2, EYE, 12], target: [14, 1.8, -6], fov: 75 },
  { name: 'porch', cam: [-12, EYE, 17.2], target: [12, 1.6, 17.2], fov: 75 },
  { name: 'way', cam: [-50, EYE, 4], target: [-34, 1.6, 0], fov: 75 },
  { name: 'gorge-path', cam: [-43, EYE, -32], target: [0, 1.6, -38], fov: 70 },
  { name: 'bridge', cam: [-12, EYE, -38], target: [12, 1.6, -38], fov: 75 },
  { name: 'pavilion', cam: [-20, T.high + 1.2, -35], target: [10, 1, -39], fov: 75 },
  { name: 'village-street', cam: [-50, EYE, 36], target: [-10, 1.6, 38], fov: 70 },
  { name: 'ghat', cam: [-12, EYE, 36], target: [12, 1.6, 40], fov: 75 },
  { name: 'balcony', cam: [-17.6, T.high + 1.2, 33.6], target: [10, 1, 40], fov: 75 },
  { name: 'camp-west', cam: [-63, EYE, -30], target: [-54, 1.6, 0], fov: 75 },
  { name: 'camp-east', cam: [63, EYE, 30], target: [54, 1.6, 0], fov: 75 },
  { name: 'edge-north', cam: [-30, EYE, -43], target: [-30, -4, -90], fov: 75 },
  { name: 'edge-south', cam: [20, EYE, 43], target: [20, -1, 100], fov: 75 },
  { name: 'edge-west', cam: [-60, EYE, 0], target: [-90, 8, 0], fov: 75 }
];

export const TEMPLE = defineMap({
  id: 'temple',
  name: 'Jade Temple',
  atmosphere: {
    zenith: '#4f9ad6',
    horizon: HAZE,
    ground: '#a48c64',
    sunColor: '#ffe4b0',
    sunIntensity: 2.9,
    sunDirection: new THREE.Vector3(0.5, 0.6, 0.62).normalize(),
    // Clear out to 120 m so the far camp and the gorge's far wall read even on low, where the fog ends at 140 m.
    fogNear: 120,
    clouds: { count: 9, seed: 5 }
  },
  bounds: { min: [-T.edgeX - 0.4, -12, -T.edge - 0.4], max: [T.edgeX + 0.4, 40, T.edge + 0.4] },
  killY: -0.8,
  seed: 61,
  plan() {
    const p = new Plan();
    templeStructures(p);
    templeDressing(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => templeBackdrop(d)
});

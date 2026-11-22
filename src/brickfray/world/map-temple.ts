import * as THREE from 'three';
import { templeBackdrop } from './backdrop-temple';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { templeCover } from './temple-cover';
import { templeDressing } from './temple-dressing';
import { CAMP_SPAWNS, FFA_SPAWNS } from './temple-geometry';
import { T } from './temple-layout';
import { templeStructures } from './temple-parts';
import { HAZE } from './temple-scenery';
import { yawToward } from './util';

function spawns(p: Plan) {
  for (const [x, z] of CAMP_SPAWNS) p.spawn(x, 0, z, Math.PI, 1);
  for (const [x, z] of CAMP_SPAWNS) p.spawn(-x, 0, -z, 0, 0);
  for (const [x, z, fx, fz] of FFA_SPAWNS) {
    p.spawn(x, 0, z, yawToward([x, z], [fx, fz]));
    p.spawn(-x, 0, -z, yawToward([-x, -z], [-fx, -fz]));
  }
}

const EYE = 1.62;
const HIGH = T.high + EYE;

export const TEMPLE_VIEWS: LabView[] = [
  { name: 'overview', cam: [58, 52, 66], target: [0, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 118, 0.1], target: [0, 0, 0], fov: 45 },
  { name: 'nave', cam: [-3.6, EYE, -18.4], target: [2, 2.4, 10], fov: 75 },
  { name: 'gallery', cam: [9.2, HIGH, -4], target: [-6, 1, 6], fov: 75 },
  { name: 'aisle', cam: [9.6, EYE, -18.0], target: [9.2, 1.8, 10], fov: 70 },
  { name: 'court', cam: [24, EYE, -16.4], target: [15, 1.8, 8], fov: 75 },
  { name: 'court-cross', cam: [22.4, EYE, 14.4], target: [-20, 1.6, -4], fov: 75 },
  { name: 'yard-east', cam: [24, EYE, -33.6], target: [4, 1.6, -26], fov: 75 },
  { name: 'yard-west', cam: [-24, EYE, -24], target: [-4, 1.6, -34], fov: 75 },
  { name: 'porch', cam: [11.2, EYE, -23.2], target: [3, 1.6, -27], fov: 75 },
  { name: 'gate', cam: [0, EYE, -35.6], target: [0, 1.6, -22], fov: 70 },
  { name: 'camp-north', cam: [-24, EYE, -40.4], target: [6, 2.5, -34], fov: 75 },
  { name: 'camp-south', cam: [24, EYE, 40.4], target: [-6, 2.5, 34], fov: 75 },
  { name: 'strip-west', cam: [-29.6, EYE, -36], target: [-31, 1.6, 0], fov: 70 },
  { name: 'strip-east', cam: [29.6, EYE, 36], target: [31, 1.6, 0], fov: 70 },
  { name: 'edge-west', cam: [-34.4, EYE, 12], target: [-70, -3, 10], fov: 75 },
  { name: 'edge-east', cam: [33.6, EYE, -17.2], target: [80, 2.5, -17.2], fov: 75 },
  { name: 'edge-south', cam: [6.4, EYE, 38.4], target: [10, -1, 90], fov: 75 },
  { name: 'edge-north', cam: [-9.6, EYE, -39.2], target: [-14, 7, -70], fov: 75 }
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
    // Clear out to 100 m so the rim cliffs read from the far camp even on low, where the fog ends at 140 m.
    fogNear: 100,
    clouds: { count: 9, seed: 5 }
  },
  bounds: { min: [-T.edgeX - 0.4, -12, -T.edge - 0.4], max: [T.edgeX + 0.4, 40, T.edge + 0.4] },
  killY: -0.8,
  seed: 61,
  plan() {
    const p = new Plan();
    templeStructures(p);
    templeCover(p);
    templeDressing(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => templeBackdrop(d)
});

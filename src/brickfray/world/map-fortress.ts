import * as THREE from 'three';
import { castleBackdrop } from './backdrop-castle';
import { FORTRESS_DETAILS } from './fortress-details';
import { fortressDressing } from './fortress-dressing';
import { fortressGround } from './fortress-ground';
import { fortressOutside } from './fortress-outside';
import { fortressRooms } from './fortress-rooms';
import { NAV_SEEDS } from './fortress-nav';
import { fortressWorks, WORKS } from './fortress-works';
import { KEEP } from './keep';
import { KEEP_DRESSING } from './keep-dressing';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { yawToward } from './util';

type Spot = [number, number, number];

/** Sound spots for audio/scenery.ts: flags on their poles, crows on the curtain and gate tops, birds in the orchard trees. */
export const FORTRESS_AMBIENCE: { flags: Spot[]; battlements: Spot[]; trees: Spot[] } = {
  flags: [[16.8, 5.4, -47.2], [-25.0, 5.4, 44.2], [6.0, 15.0, 6.0], [-6.0, 15.0, -6.0]],
  battlements: [[-21.2, 7.8, -38.0], [25.2, 7.8, -42.0], [21.2, 7.8, -6.0], [21.2, 7.8, 14.0], [-17.2, 7.8, 30.8], [9.2, 7.8, 40.0], [-8.8, 8.6, 46.4]],
  trees: [[-45.6, 5.0, -24.8], [-45.2, 5.0, -13.6], [-33.6, 5.0, -24.4], [-43.2, 5.0, -10.6], [-31.2, 5.0, -11.6], [-31.6, 5.0, -30.0]]
};

/**
 * Team 1 in the upper ward (north) with side clusters in the kitchen garden and the postern lane; team 0 in the barbican
 * (south) with side clusters at its sally end and in the lists. Each cluster faces the lane it opens on, so a side
 * spawn starts a side lane.
 */
const TEAM1: [number, number, [number, number]][] = [
  ...([[-17.6, -44.8], [-13.6, -43.2], [-9.6, -46.4], [-3.2, -45.6], [-2.4, -43.6], [5.6, -43.2], [6.4, -46.4], [12.0, -44.0], [14.4, -46.4]] as const).map(([x, z]): [number, number, [number, number]] => [x, z, [2.4, -40.0]]),
  [-32.0, -46.4, [-32.4, -28.0]], [-32.0, -41.6, [-32.4, -28.0]], [-29.6, -38.4, [-32.4, -28.0]], [-32.0, -35.2, [-32.4, -28.0]], [-29.2, -44.8, [-32.4, -28.0]], [-25.6, -40.4, [-24.0, -20.0]], [-23.6, -32.0, [-24.0, -20.0]],
  [28.0, -46.4, [30.4, -28.0]], [30.4, -42.4, [30.4, -28.0]], [28.0, -38.4, [30.4, -28.0]]
];
const TEAM0: [number, number, [number, number]][] = [
  ...([[-16.8, 37.6], [-13.6, 42.4], [-8.8, 42.4], [-4.8, 43.2], [-0.8, 42.4], [-11.2, 36.8]] as const).map(([x, z]): [number, number, [number, number]] => [x, z, [x, 0]]),
  [-23.2, 37.6, [-23.2, 24.0]], [-20.0, 42.4, [-23.2, 24.0]], [-24.8, 41.6, [-23.2, 24.0]], [-22.4, 44.4, [-23.2, 24.0]], [-19.6, 38.8, [-23.2, 24.0]], [-17.6, 44.0, [-23.2, 24.0]],
  [12.8, 32.0, [34.8, 24.0]], [16.0, 36.0, [34.8, 24.0]], [12.8, 39.2, [34.8, 24.0]]
];
/** Free-for-all spawns, all on the ground and spread over every district; each faces the keep unless given a point to face. */
const FFA: [number, number, [number, number]?][] = [
  [-40.0, -24.8], [-32.0, -16.0], [-31.2, -40.0, [-20.0, -43.2]], [-30.4, 13.6], [-6.0, -18.0, [20.0, -18.0]], [4.8, -20.8], [-2.0, 20.0],
  [-12.0, -24.0], [12.0, -16.0, [12.0, -28.0]], [-12.0, 22.4], [9.6, 12.0], [-3.2, -44.0], [-18.4, 40.8],
  [32.0, -2.4, [24.0, 8.0]], [32.0, 16.8], [21.6, 36.8], [19.2, 20.8, [12.4, 24.8]], [29.6, -37.6], [1.6, 42.4],
  [-6.4, -2.4], [-15.6, 0.0], [-45.6, -6.0, [-34.0, -6.0]], [-32.6, 25.6, [-24.0, 18.4]]
];

function spawns(p: Plan) {
  // The ward is shallow: red faces along it, toward the middle of the hall row.
  for (const [x, z, face] of TEAM1) p.spawn(x, 0, z, yawToward([x, z], face), 1);
  for (const [x, z, face] of TEAM0) p.spawn(x, 0, z, yawToward([x, z], face), 0);
  for (const [x, z, face] of FFA) p.spawn(x, 0, z, yawToward([x, z], face ?? [0, 0]));
}

const EYE = 1.62;

export const FORTRESS_VIEWS: LabView[] = [
  { name: 'overview', cam: [58, 70, 78], target: [-2, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 130, 0.1], target: [0, 0, 0], fov: 45 },
  { name: 'overview-west', cam: [-84, 56, -30], target: [0, 0, 0], fov: 50 },
  { name: 'inner-court', cam: [-17.6, EYE, -25.6], target: [4, 3, -12], fov: 75 },
  { name: 'outer-bailey', cam: [10.4, EYE, 16.0], target: [-12, 2.2, 21], fov: 75 },
  { name: 'market', cam: [-4.8, EYE, 14.4], target: [-13, 1.6, 19], fov: 75 },
  { name: 'keep-hall', cam: [-4.4, EYE, 4.4], target: [3, 2, -3], fov: 80 },
  { name: 'great-hall', cam: [-1.6, EYE, -29.6], target: [-14, 2.6, -33], fov: 80 },
  { name: 'chapel', cam: [3.6, EYE, -29.2], target: [15, 2, -32], fov: 80 },
  { name: 'smithy', cam: [18.4, EYE, -6.4], target: [12, 1.6, 2], fov: 80 },
  { name: 'stables', cam: [-36.0, EYE, 6.0], target: [-46, 2, -4], fov: 75 },
  { name: 'stable-yard', cam: [-27.2, EYE, 18.4], target: [-42, 2.5, 20], fov: 75 },
  { name: 'orchard', cam: [-28.0, EYE, -26.0], target: [-40, 3, -14], fov: 75 },
  { name: 'kitchen-garden', cam: [-23.2, EYE, -30.4], target: [-28, 2, -44], fov: 75 },
  { name: 'river-north', cam: [36.0, EYE, -9.6], target: [30, 3, -22], fov: 75 },
  { name: 'river-south', cam: [34.4, EYE, 8.8], target: [36, 1, 26], fov: 75 },
  { name: 'mill', cam: [24.0, EYE, 12.0], target: [36, 2, -2], fov: 75 },
  { name: 'ruin-top', cam: [32.0, 3.84 + EYE, -18.4], target: [8, 0, -18], fov: 75 },
  { name: 'upper-ward', cam: [-16, EYE, -46], target: [8, 3, -38], fov: 75 },
  { name: 'barbican', cam: [-22, EYE, 44], target: [0, 3, 36], fov: 75 },
  { name: 'gate', cam: [-5.6, EYE, 22], target: [-5.6, 2, 34], fov: 70 }
];

/** The fortress's plan: ground, works, keep, details, rooms, dressing and spawns (the backdrop draws the land beyond). */
export function fortressPlan() {
  const p = new Plan();
  fortressGround(p);
  const works = fortressWorks();
  p.add(WORKS, works);
  p.add(KEEP, {});
  p.add(KEEP_DRESSING, {});
  p.add(FORTRESS_DETAILS, works);
  fortressRooms(p, works);
  p.navSeeds.push(...NAV_SEEDS);
  fortressDressing(p);
  spawns(p);
  return p;
}

export const FORTRESS = defineMap({
  id: 'fortress',
  name: 'Sunset Keep',
  atmosphere: {
    zenith: '#5a8fcf',
    horizon: '#f3dcc0',
    ground: '#9c8a6a',
    sunColor: '#ffd8a0',
    sunIntensity: 2.7,
    sunDirection: new THREE.Vector3(-0.55, 0.5, 0.45).normalize(),
    fogNear: 95,
    clouds: { count: 10, seed: 8 }
  },
  bounds: { min: [-50.4, -6, -50.4], max: [47.2, 40, 47.2] },
  killY: -0.8,
  seed: 23,
  plan: fortressPlan,
  backdrop: (d) => {
    fortressOutside(d);
    castleBackdrop(d);
  }
});

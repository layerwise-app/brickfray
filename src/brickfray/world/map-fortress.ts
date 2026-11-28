import * as THREE from 'three';
import { castleBackdrop } from './backdrop-castle';
import { fortressDressing } from './fortress-dressing';
import { fortressOutside } from './fortress-outside';
import { fortressGround } from './fortress-ground';
import { groundAt } from './fortress-cover';
import { GATE, LOFT, MILL } from './fortress-layout';
import { F } from './fortress-plan';
import { fortressWorks, WORKS } from './fortress-works';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { yawToward } from './util';

type Spot = [number, number, number];

/** Sound spots for audio/scenery.ts: flags on their poles, crows on the curtain and tower tops, small birds on the houses' gables. */
export const FORTRESS_AMBIENCE: { flags: Spot[]; battlements: Spot[]; trees: Spot[] } = {
  flags: [[-9.0, 15.4, 9.0], [9.0, 15.4, -9.0], [-36.0, 9.8, 0], [36.0, 9.8, 0]],
  battlements: [[-20.0, 6.8, -29.6], [20.0, 6.8, 29.6], [-36.0, 6.8, -16.0], [36.0, 6.8, 16.0], [-35.6, 8.4, -26.4], [35.6, 8.4, 26.4], [0, 10.0, -32.4]],
  trees: [[-54.4, 6.0, 41.6], [54.4, 6.0, -41.6], [-32.8, 5.6, 39.2], [32.8, 5.6, 39.2]]
};

/** West team's spawns [x, z]: the square's north yard by the barn (3), the middle by the barbican gate (4), the south yard by the granary (5). */
const WEST: [number, number][] = [
  [-52.0, -22.4], [-55.2, -18.4], [-51.2, -14.4],
  [-58.4, -8.0], [-55.2, -9.6], [-58.4, 8.0], [-55.2, 9.6],
  [-56.0, 27.2], [-52.0, 24.8], [-55.2, 21.6], [-51.2, 18.4], [-56.0, 15.2]
];
/** East team's spawns: the farmyard's north yard, the middle by the palisade gate, the south yard (3/4/5 like the west). */
const EAST: [number, number][] = [
  [52.0, -22.4], [57.6, -18.4], [52.0, -14.4],
  [58.4, -8.0], [55.2, -9.6], [58.4, 8.0], [55.2, 9.6],
  [56.0, 27.2], [52.0, 24.8], [57.6, 21.6], [52.0, 18.4], [56.8, 15.2]
];
/**
 * Free-for-all spawns [x, z, face x, face z], each half its own: on the ground, away from the lanes' hubs and chokes
 * (spawns there die within 5 s): the back corners of the square and the farmyard, the pends' bays, the smithy's yard
 * and the solar's fallen end, behind the loft's and the ledge's stairs.
 */
const FFA: [number, number, number, number][] = [
  [-36.0, -43.2, -20, -38],
  [-39.2, 43.2, -20, 38],
  [-30.4, 26.4, -30, 40],
  [-16.0, 25.6, -16, 40],
  [-11.6, -25.6, -11.6, -40],
  [-59.2, -4.8, -40, 0],
  [-59.2, -12.0, -50, -24],
  [-59.2, 12.0, -50, 24],
  [-59.2, -34.4, -40, -38],
  [-59.2, 34.4, -40, 38],
  [44.0, -42.4, 20, -36],
  [42.4, 43.2, 20, 36],
  [29.6, -24.0, 20, -12],
  [16.0, 24.4, 16, 40],
  [8.8, -24.4, 8.8, -40],
  [59.6, -4.8, 40, 0],
  [59.2, -12.0, 50, -24],
  [59.2, 12.0, 50, 24],
  [51.2, -38.4, 40, -36],
  [59.2, 32.0, 40, 36]
];

function spawns(p: Plan) {
  for (const [x, z] of WEST) p.spawn(x, 0, z, yawToward([x, z], [-30, Math.abs(z) < 10 ? 0 : z]), 0);
  for (const [x, z] of EAST) p.spawn(x, 0, z, yawToward([x, z], [30, Math.abs(z) < 10 ? 0 : z]), 1);
  for (const [x, z, fx, fz] of FFA) p.spawn(x, groundAt(x, z), z, yawToward([x, z], [fx, fz]));
}

const EYE = 1.62;

export const FORTRESS_VIEWS: LabView[] = [
  { name: 'overview', cam: [66, 62, 74], target: [0, 0, 0], fov: 50 },
  { name: 'top', cam: [0, 150, 0.1], target: [0, 0, 0], fov: 50 },
  { name: 'overview-west', cam: [-90, 56, -40], target: [-6, 0, 0], fov: 50 },
  { name: 'crag-street', cam: [-44, F.street + EYE, -36], target: [0, 2.4, -38], fov: 70 },
  { name: 'ruin-knoll', cam: [-14, F.street + EYE, -38], target: [10, 2.4, -38], fov: 75 },
  { name: 'loft', cam: [-23, F.loft + EYE, -42.8], target: [-10, 1, -34], fov: 75 },
  { name: 'barbican', cam: [-58, EYE, 0], target: [-36, 2, 0], fov: 75 },
  { name: 'gate-room', cam: [GATE.x0 + 1.6, GATE.floor + EYE, 0], target: [-10, 1.2, 0], fov: 75 },
  { name: 'bailey-north', cam: [-33, EYE, -18], target: [-8, 1.6, -12], fov: 75 },
  { name: 'bailey-south', cam: [-33, EYE, 18], target: [-8, 1.6, 12], fov: 75 },
  { name: 'keep-court', cam: [-12, EYE, -15.2], target: [12, 1.6, -15.2], fov: 75 },
  { name: 'river-path', cam: [-48, EYE, 38], target: [0, 1.6, 40], fov: 70 },
  { name: 'ford', cam: [-14, EYE, 40], target: [10, 1, 40], fov: 75 },
  { name: 'mill-gallery', cam: [-5, F.loft + EYE, 33.6], target: [10, 1, 40], fov: 75 },
  { name: 'camp-west', cam: [-61, EYE, -30], target: [-52, 1.6, 0], fov: 75 },
  { name: 'camp-east', cam: [61, EYE, 30], target: [52, 1.6, 0], fov: 75 },
  { name: 'siege-yard', cam: [58, EYE, 2], target: [36, 3, 0], fov: 75 },
  { name: 'breach-room', cam: [38.4, GATE.floor + EYE, 0], target: [10, 1.2, 0], fov: 75 },
  { name: 'ledge', cam: [23, F.loft + EYE, -42.8], target: [10, 1, -34], fov: 75 },
  { name: 'quay', cam: [44, F.quay + EYE, 34], target: [8, 1.6, 36], fov: 75 },
  { name: 'loft-street', cam: [LOFT.stairE + 4, F.street + EYE, -36], target: [LOFT.x0, 3, -42], fov: 75 },
  { name: 'mill-front', cam: [10, EYE, 42], target: [0, 3, MILL.body], fov: 75 }
];

/** The fortress's plan: ground, works and spawns (the backdrop draws the land beyond). */
export function fortressPlan() {
  const p = new Plan();
  fortressGround(p);
  p.add(WORKS, fortressWorks());
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
    fogNear: 110,
    clouds: { count: 10, seed: 8 }
  },
  bounds: { min: [-F.edgeX - 0.4, -6, -F.edge - 0.4], max: [F.edgeX + 0.4, 40, F.edge + 0.4] },
  killY: -0.8,
  seed: 23,
  plan: fortressPlan,
  backdrop: (d) => {
    fortressOutside(d);
    castleBackdrop(d);
  }
});

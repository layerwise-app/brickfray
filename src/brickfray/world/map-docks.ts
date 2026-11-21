import * as THREE from 'three';
import { DECAL } from './blocks';
import { BOAT, BOAT_EL, BOAT_GANGWAYS } from './boat';
import { docksBackdrop } from './backdrop-docks';
import { docksGround } from './docks-ground';
import { GANGWAY, PIER, QUAY_EDGE, QUAY_WALL, RAILS } from './docks-parts';
import { docksYard } from './docks-yard';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { FENCE } from './props-street';
import { yawToward } from './util';
import { BARREL, crateStack, PALLET } from './props-harbor';
import { FORKLIFT } from './props-vehicles';
import { METAL_STAIRS, RACK, WAREHOUSE, WH } from './warehouse';
import { warehouseDressing } from './warehouse-dressing';

const BOAT_AT = { x: 0, z: 26.4 };
const PIERS: [number, number][] = [[-25.6, -22.4], [-1.6, 1.6], [22.4, 25.6]];
const BOARDWALK = { z0: 20.0, z1: 23.2 } as const;
const EDGE = 36.4;
const BACK = -28.4;

function ground(p: Plan) {
  docksGround(p, EDGE, BACK, QUAY_EDGE);
  const land = '#b5ab98';
  for (const [x0, z0, x1, z1] of [[-160, -160, 160, BACK], [-160, BACK, -EDGE, QUAY_EDGE], [EDGE, BACK, 160, QUAY_EDGE]] as const) p.add(DECAL, { x0, z0, x1, z1, y: 0, color: land, surface: 'stone' });
}

function harbor(p: Plan) {
  p.add(QUAY_WALL, { x0: -160, x1: 160, z: QUAY_EDGE, gaps: PIERS });
  p.add(RAILS, { x0: -EDGE, x1: EDGE, z: [6.0, 9.2] });
  for (const [x0, x1] of PIERS) p.add(PIER, { x0, z0: QUAY_EDGE, x1, z1: BOARDWALK.z0 });
  p.add(PIER, { x0: PIERS[0]![0], z0: BOARDWALK.z0, x1: PIERS[2]![1], z1: BOARDWALK.z1 });
  p.add(BOAT_EL, BOAT_AT);
  for (const [a, b] of BOAT_GANGWAYS) p.add(GANGWAY, { x: BOAT_AT.x + (a + b) / 2, z: BOARDWALK.z1 - 1.6 });
}

function warehouse(p: Plan) {
  p.add(WAREHOUSE, {});
  warehouseDressing(p);
  const style = { colors: ['#8a9096'], variance: 0 };
  for (const s of [-1, 1] as const) {
    p.add(RACK, { x: s * 10.0, z: -27.0, length: 7.2 });
    p.add(RACK, { x: s * 3.2, z: -27.0, length: 3.6 });
    p.add(PALLET, { x: s * 3.2, z: -22.4, load: s < 0 ? 'sacks' : 'boxes' });
    for (const k of crateStack({ x: s * 8.8, z: -20.8 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: s * 1.2, dz: 0, level: 0 }, { dx: 0, dz: 0, level: 1.12 }])) p.add(k.el, k.p);
    p.add(BARREL, { x: s * 12.8, z: -15.6, kind: 'drum', color: '#2f7f7a' });
    p.add(BARREL, { x: s * 12.2, z: -15.4, kind: 'drum', color: '#545c63' });
  }
  p.add(FORKLIFT, { x: -4.4, z: -17.2, turns: 0 });
  p.add(PALLET, { x: -2.0, z: -17.2, load: 'boxes' });
  for (const s of [-1, 1] as const) p.add(METAL_STAIRS, { x: s * 5.6, z: -24.4, y0: 0, dir: s < 0 ? 'w' : 'e', width: 1.6, steps: 7, rise: WH.deck / 7, run: 0.8, style, surface: 'metal' });
}

function bounds(p: Plan) {
  for (const s of [-1, 1]) {
    p.add(FENCE, { x: s * (EDGE + WH.x1) / 2, z: BACK + 0.2, length: EDGE - WH.x1, kind: 'chain', height: 3.0 });
    p.add(FENCE, { x: s * (EDGE - 0.2), z: (BACK + QUAY_EDGE) / 2, turns: 1, length: QUAY_EDGE - BACK, kind: 'chain', height: 3.0 });
  }
}

function spawns(p: Plan) {
  const side: [number, number][] = [[-33.6, -25.6], [-30.4, -22.4], [-33.6, -18.4], [-29.6, -16.0], [-33.6, -9.6], [-30.4, -5.6], [-33.6, -1.6], [-30.4, 1.6], [-33.6, 6.4], [-28.8, 8.0]];
  for (const [x, z] of side) p.spawn(x, 0, z, -Math.PI / 2, 0);
  for (const [x, z] of side) p.spawn(-x, 0, z, Math.PI / 2, 1);
  const ffa: [number, number, number][] = [
    [-8.0, WH.deck, -26.4], [8.0, WH.deck, -26.4], [0, WH.deck, -20.8], [-11.2, 0, -18.0], [11.2, 0, -18.0], [0, 2.56, -4.8],
    [-17.6, 0, -6.8], [17.6, 0, -6.8], [-8.0, 0, 4.8], [8.0, 0, 4.8], [-14.4, 0, 7.6], [14.4, 0, 7.6], [-24.0, 0, 15.2], [24.0, 0, 15.2],
    [-12.0, 0, 21.6], [12.0, 0, 21.6], [5.6, BOAT.deck, BOAT_AT.z], [-5.2, BOAT.roof, BOAT_AT.z + 0.2], [-24.0, 0, -20.8], [24.0, 0, -20.8]
  ];
  for (const [x, y, z] of ffa) p.spawn(x, y, z, yawToward([x, z], [0, 0]));
}

export const DOCKS_VIEWS: LabView[] = [
  { name: 'overview', cam: [46, 46, 56], target: [0, 0, 0], fov: 50 },
  { name: 'overview-sea', cam: [-30, 30, 70], target: [0, 0, -4], fov: 50 },
  { name: 'lane-north', cam: [-30, 1.62, -17.8], target: [0, 2.2, -17.8], fov: 70 },
  { name: 'lane-mid', cam: [-30, 1.62, -6.8], target: [0, 1.6, -4], fov: 70 },
  { name: 'lane-south', cam: [-30, 1.62, 8.0], target: [0, 2.4, 14], fov: 70 },
  { name: 'warehouse', cam: [-12, WH.deck + 1.62, -26.4], target: [8, 1.5, -18], fov: 75 },
  { name: 'boat', cam: [-5.2, BOAT.roof + 1.62, 26.6], target: [10, 1, 10], fov: 75 },
  { name: 'yard-top', cam: [0, 2.56 + 1.62, -2.0], target: [-20, 1.5, -10], fov: 75 },
  { name: 'piers', cam: [24, 1.62, 21.6], target: [0, 1.5, 24], fov: 70 }
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
    fogNear: 75
  },
  bounds: { min: [-EDGE - 0.4, -6, BACK - 0.4], max: [EDGE + 0.4, 40, 30.8] },
  killY: -0.8,
  seed: 41,
  plan() {
    const p = new Plan();
    ground(p);
    harbor(p);
    warehouse(p);
    docksYard(p);
    bounds(p);
    spawns(p);
    return p;
  },
  backdrop: (d) => docksBackdrop(d)
});

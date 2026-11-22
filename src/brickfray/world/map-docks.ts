import * as THREE from 'three';
import { DECAL } from './blocks';
import { BOAT, BOAT_EL, BOAT_GANGWAYS } from './boat';
import { BARGE } from './docks-barge';
import { docksBackdrop } from './backdrop-docks';
import { docksGround } from './docks-ground';
import { EDGE_RAIL, GANGWAY, PIER, QUAY_EDGE, QUAY_WALL, RAILS } from './docks-parts';
import { CRANE_Z, docksYard, QUAY_STACKS } from './docks-yard';
import type { LabView } from './lab-map';
import { defineMap, Plan } from './plan';
import { FENCE } from './props-street';
import { yawToward } from './util';
import { BARREL, CONTAINER_SIZE, crateHeight, crateStack, PALLET } from './props-harbor';
import { FORKLIFT } from './props-vehicles';
import { METAL_STAIRS, RACK, WAREHOUSE, WH } from './warehouse';
import { warehouseDressing } from './warehouse-dressing';

const BOAT_AT = { x: 0, z: 26.4 };
/** The outer piers' outer edges are 48 m apart, so no line along the boardwalk between them runs longer. */
const PIERS: [number, number][] = [[-24.0, -20.8], [-1.6, 1.6], [20.8, 24.0]];
const BOARDWALK = { z0: 20.0, z1: 23.2 } as const;
const EDGE = 36.4;
const BARGE_Z = 13.0;
const BACK = -28.4;

function ground(p: Plan) {
  docksGround(p, EDGE, BACK, QUAY_EDGE);
  const land = '#b5ab98';
  for (const [x0, z0, x1, z1] of [[-160, -160, 160, BACK], [-160, BACK, -EDGE, QUAY_EDGE], [EDGE, BACK, 160, QUAY_EDGE]] as const) p.add(DECAL, { x0, z0, x1, z1, y: 0, color: land, surface: 'stone' });
}

function harbor(p: Plan) {
  p.add(QUAY_WALL, { x0: -160, x1: 160, z: QUAY_EDGE, gaps: PIERS });
  p.add(RAILS, { x0: -EDGE, x1: EDGE, z: [CRANE_Z - 1.6, CRANE_Z + 1.6] });
  for (const [x0, x1] of PIERS) p.add(PIER, { x0, z0: QUAY_EDGE, x1, z1: BOARDWALK.z0 });
  p.add(PIER, { x0: PIERS[0]![0], z0: BOARDWALK.z0, x1: PIERS[2]![1], z1: BOARDWALK.z1 });
  p.add(BOAT_EL, BOAT_AT);
  for (const [a, b] of BOAT_GANGWAYS) p.add(GANGWAY, { x: BOAT_AT.x + (a + b) / 2, z: BOARDWALK.z1 - 1.6 });
  p.add(BARGE, { x: -12.8, z: BARGE_Z, hull: '#3d4a3a', cargo: '#d9b93a' });
  p.add(BARGE, { x: 12.8, z: BARGE_Z, hull: '#4a3b34', cargo: '#16a085' });
  edgeRails(p);
  berthCargo(p);
}

/**
 * Every quay, pier and boardwalk edge over the water is railed; the only gaps are the pier roots and the boat's side.
 * The berth's rails (boardwalk and middle pier) stand higher: out of reach of a hop from the boat's deck or a gangway.
 */
function edgeRails(p: Plan) {
  const T = 0.12;
  const BERTH = 1.5;
  const alongX = (x0: number, x1: number, z: number, height?: number) => p.add(EDGE_RAIL, { x0, z0: z - T / 2, x1, z1: z + T / 2, height });
  const alongZ = (x: number, z0: number, z1: number, height?: number) => p.add(EDGE_RAIL, { x0: x - T / 2, z0, x1: x + T / 2, z1, height });
  const half = CONTAINER_SIZE.length / 2;
  const stacks = QUAY_STACKS.flatMap((x) => [[-x - half, -x + half], [x - half, x + half]] as [number, number][]);
  let a = -EDGE;
  for (const [x0, x1] of [...PIERS, ...stacks].sort((m, n) => m[0] - n[0])) {
    if (x0 > a) alongX(a, x0, QUAY_EDGE - T / 2);
    a = Math.max(a, x1);
  }
  if (EDGE > a) alongX(a, EDGE, QUAY_EDGE - T / 2);
  const [west, mid, east] = PIERS as [[number, number], [number, number], [number, number]];
  alongZ(west[0] + T / 2, QUAY_EDGE, BOARDWALK.z1);
  alongZ(east[1] - T / 2, QUAY_EDGE, BOARDWALK.z1);
  for (const x of [west[1] - T / 2, east[0] + T / 2]) alongZ(x, QUAY_EDGE, BOARDWALK.z0);
  for (const x of [mid[0] + T / 2, mid[1] - T / 2]) alongZ(x, QUAY_EDGE, BOARDWALK.z0, BERTH);
  for (const [x0, x1] of [[west[1], mid[0]], [mid[1], east[0]]] as const) alongX(x0, x1, BOARDWALK.z0 + T / 2, BERTH);
  // Alongside the boat the hull closes the boardwalk edge (the gap to it is narrower than a body) and the gangways board it.
  alongX(west[0], BOAT_AT.x + BOAT.aft - 0.6, BOARDWALK.z1 - T / 2, BERTH);
  alongX(BOAT_AT.x + BOAT.beamEnd, east[1], BOARDWALK.z1 - T / 2, BERTH);
}

/**
 * Cargo staged along the middle pier's west side, two crates high (out of a jump's reach): a stack at its root and a run
 * toward the boardwalk. With the barges it closes every line across the basin between the outer piers. Cargo on the
 * boardwalk or the outer piers pinned bots against the rails, so they stay clear.
 */
function berthCargo(p: Plan) {
  const x = PIERS[1]![0] + 0.72;
  for (const z of [10.6, 15.7, 16.9, 18.1, 19.3]) {
    for (const k of crateStack({ x, z }, [0, crateHeight('large')].map((level) => ({ dx: 0, dz: 0, level, size: 'large' as const })))) p.add(k.el, k.p);
  }
}

function warehouse(p: Plan) {
  p.add(WAREHOUSE, {});
  warehouseDressing(p);
  const style = { colors: ['#8a9096'], variance: 0 };
  for (const s of [-1, 1] as const) {
    p.add(RACK, { x: s * 10.0, z: -27.0, length: 7.2 });
    p.add(RACK, { x: s * 3.2, z: -27.0, length: 3.6 });
    // A tall rack just inside each yard door: the door opens on a short lobby, so no line runs from the quay into the hall;
    // its top is out of a jump's reach from the gallery.
    p.add(RACK, { x: s * 8.0, z: -18.0, length: 6.4, height: 4.0 });
    p.add(PALLET, { x: s * 3.2, z: -22.4, load: s < 0 ? 'sacks' : 'boxes' });
    for (const k of crateStack({ x: s * 8.8, z: -20.4 }, [{ dx: 0, dz: 0, level: 0, size: 'large' }, { dx: s * 1.2, dz: 0, level: 0 }, { dx: 0, dz: 0, level: 1.12 }])) p.add(k.el, k.p);
    p.add(BARREL, { x: s * 13.4, z: -22.4, kind: 'drum', color: '#2f7f7a' });
    p.add(BARREL, { x: s * 13.2, z: -21.7, kind: 'drum', color: '#545c63' });
  }
  p.add(RACK, { x: 0, z: -18.6, length: 6.0, turns: 1 });
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
  // Three pockets per side, each behind a two-high stack: north corner, middle (yard screen), south (quay screen).
  const side: [number, number, number][] = [
    [-29.2, -26.4, Math.PI], [-32.0, -25.6, Math.PI], [-29.2, -21.6, Math.PI],
    [-29.2, -12.8, Math.PI], [-33.2, -10.8, Math.PI], [-29.2, -9.2, Math.PI],
    [-29.2, -2.4, 0], [-33.6, 0.4, 0], [-29.2, 2.8, 0], [-34.4, 6.4, 0]
  ];
  for (const [x, z, yaw] of side) p.spawn(x, 0, z, yaw, 0);
  for (const [x, z, yaw] of side) p.spawn(-x, 0, z, yaw, 1);
  // Free-for-all, mirrored. The hall floor under the gallery is overlooked but lies farthest from the yard fights: without
  // it 10-seat bot FFA spawn deaths rise from 24% to 31%, and the spawn picker passes it over while the gallery is held.
  const hall: [number, number, number][] = [[-2.0, -24.4, Math.PI], [-12.4, -22.0, -Math.PI / 2]];
  for (const [x, z, yaw] of hall) for (const s of [-1, 1]) p.spawn(s * x, 0, z, s * yaw);
  // Everywhere else out of sight of every raised spot: side yards, crane road, outer pier roots and boardwalk.
  const ground: [number, number][] = [[-22.4, -12.8], [-21.6, -27.2], [-26.4, -6.4], [-20.8, 4.8], [-4.8, 3.2], [-22.4, 11.2], [-18.4, 21.6], [-7.2, 22.4]];
  for (const [x, z] of ground) for (const s of [-1, 1]) p.spawn(s * x, 0, z, yawToward([s * x, z], [0, 0]));
}

export const DOCKS_VIEWS: LabView[] = [
  { name: 'overview', cam: [46, 46, 56], target: [0, 0, 0], fov: 50 },
  { name: 'overview-sea', cam: [-30, 30, 70], target: [0, 0, -4], fov: 50 },
  { name: 'lane-north', cam: [-30, 1.62, -17.8], target: [0, 2.2, -17.8], fov: 70 },
  { name: 'lane-mid', cam: [-30, 1.62, -6.8], target: [0, 1.6, -4], fov: 70 },
  { name: 'lane-south', cam: [-23.2, 1.62, 8.4], target: [0, 2.4, 14], fov: 70 },
  { name: 'warehouse', cam: [-12, WH.deck + 1.62, -26.4], target: [8, 1.5, -18], fov: 75 },
  { name: 'boat', cam: [-1.0, BOAT.deck + 1.62, 24.6], target: [10, 1, 10], fov: 75 },
  { name: 'yard-top', cam: [-13.6, 2.56 + 1.62, -3.2], target: [10, 1.5, -6], fov: 75 },
  { name: 'fence-west', cam: [-33.6, 1.62, -16.8], target: [-60, 4, -24], fov: 70 },
  { name: 'piers', cam: [22.4, 1.62, 21.6], target: [0, 1.5, 24], fov: 70 }
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

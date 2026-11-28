import { DECAL, GROUND, type GroundParams } from './blocks';
import { ALLEY, BASE_IN, BERTH, CENTRAL_ROW, CUSTOMS, LAND, NOTCH, PASSAGE, QUAY, RAIL_YARD, SHED_ROAD, SQUARE, YARD_ROAD } from './docks-layout';
import { RAILS } from './docks-parts';
import type { Element, Plan } from './plan';
import { Rng, shade } from './util';
import { END_DOOR, WH } from './warehouse';

const STUD = 0.4;
const CONCRETE = '#c9c0aa';
const PAD = '#bdb4a0';
const ASPHALT = '#857f77';
const BASE_ASPHALT = '#77716a';
const SHED_ASPHALT = '#827b71';
const BALLAST = '#6b655c';
const STEEL = '#6c7178';
const INTERIOR = '#a2a39e';
const YELLOW = '#f6c624';
const WHITE = '#f2f2ee';
const PAINT = 0.004;
const RED = '#c0392b';

/** A walkable ground collider drawn by nothing: its look comes from separate plates so no two layers overlap. */
export const FLOOR: Element<GroundParams> = { colliders: GROUND.colliders, draw() {} };

type Rect = [number, number, number, number];
const mirror = (r: Rect): Rect[] => [r, [-r[2], r[1], -r[0], r[3]]];

/**
 * The road hierarchy on the ground. Main roads are smooth matte asphalt with white or yellow lines (the yard road
 * darkest, with kerbs and centre dashes; the shed road lighter with the siding's rails set in it; the base road with
 * a yellow centre line). The quay and berth are studded pale concrete with crane rails along the water. The crane
 * square is a studded pad; branches are steel plate (the stack alleys) or the hall's floor.
 */
export function docksGround(p: Plan) {
  const floors: Rect[] = [[-WH.x1, LAND.back, WH.x1, SHED_ROAD.z0], [-LAND.x, SHED_ROAD.z0, LAND.x, QUAY.z0], [-LAND.x, QUAY.z0, -NOTCH, QUAY.z1], [NOTCH, QUAY.z0, LAND.x, QUAY.z1]];
  for (const r of floors) {
    p.add(FLOOR, { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y: 0, color: CONCRETE, surface: 'stone' });
  }
  const plate = (r: Rect, color: string, smooth = false, matte = false, y = 0) => p.add(DECAL, { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y, color, surface: 'stone', smooth, matte });
  const paint = (r: Rect, color: string, y = PAINT) => plate(r, color, true, false, y);
  for (const r of mirror([-LAND.x, SHED_ROAD.z0, -BASE_IN, QUAY.z1])) plate(r, BASE_ASPHALT, true, true);
  for (const r of mirror([-BASE_IN, SHED_ROAD.z0, -WH.x1, SHED_ROAD.z1])) plate(r, SHED_ASPHALT, true, true);
  for (const r of mirror([-RAIL_YARD.x1, RAIL_YARD.z0, -RAIL_YARD.x0, RAIL_YARD.z1])) plate(r, BALLAST);
  for (const r of mirror([-BASE_IN, YARD_ROAD.z0, -SQUARE.x, YARD_ROAD.z1])) plate(r, ASPHALT, true, true);
  const alley: Rect[] = [[-ALLEY.n1, YARD_ROAD.z1, -ALLEY.n0, ALLEY.j0], [-ALLEY.s1, ALLEY.j0, -ALLEY.n0, ALLEY.j1], [-ALLEY.s1, ALLEY.j1, -ALLEY.s0, QUAY.z0]];
  for (const r of alley.flatMap(mirror)) plate(r, STEEL, true);
  plate([-WH.x1 + WH.wall, WH.z0 + WH.wall, WH.x1 - WH.wall, WH.z1 - WH.wall], INTERIOR);
  plate([-SQUARE.x, SQUARE.z0, SQUARE.x, SQUARE.z1], PAD);
  quaySlabs(plate);

  // Yard road: kerbs, edge lines and centre dashes.
  const mid = (YARD_ROAD.z0 + YARD_ROAD.z1) / 2;
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [-BASE_IN, -SQUARE.x] : [SQUARE.x, BASE_IN];
    for (const z of [YARD_ROAD.z0, YARD_ROAD.z1 - STUD]) plate([a, z, b, z + STUD], '#d9d4c7', true, false, PAINT);
    for (const z of [YARD_ROAD.z0 + 0.8, YARD_ROAD.z1 - 1.0]) paint([a, z, b, z + 0.2], WHITE);
    for (let x = a + 1.2; x < b - 2; x += 4.0) paint([x, mid - 0.1, x + 2.0, mid + 0.1], WHITE);
    // Base road centre line, yellow, in dashes.
    const cx = s * (LAND.x + BASE_IN) / 2;
    for (let z = SHED_ROAD.z0 + 1; z < QUAY.z1 - 2; z += 3.2) paint([cx - 0.1, z, cx + 0.1, z + 1.6], YELLOW);
    // Shed road: the siding's rails run in through the end door to the buffer stop.
    const railZ = (END_DOOR[0] + END_DOOR[1]) / 2;
    const [r0, r1] = s < 0 ? [-LAND.x, -16.4] : [16.4, LAND.x];
    plate([r0, railZ - 1.0, r1, railZ + 1.0], '#9a9388', true, true, 0.002);
    p.add(RAILS, { x0: r0, x1: r1, z: [railZ - 0.72, railZ + 0.72] });
    const [y0, y1] = s < 0 ? [-RAIL_YARD.x1, -RAIL_YARD.x0] : [RAIL_YARD.x0, RAIL_YARD.x1];
    const yz = (RAIL_YARD.z0 + RAIL_YARD.z1) / 2;
    p.add(RAILS, { x0: y0, x1: y1, z: [yz - 0.72, yz + 0.72] });
  }
  // Quay edges: yellow safety line a stud inside the water edge.
  for (const r of mirror([-BASE_IN, QUAY.z1 - 0.8, -NOTCH - 0.4, QUAY.z1 - 0.4])) paint(r, YELLOW);
  paint([-NOTCH, BERTH.z1 - 0.8, NOTCH, BERTH.z1 - 0.4], YELLOW);
  // Lane mouths: a white stop line across each road where it meets the base road. Kerbs painted red and white along the
  // customs house on the shed road (the clock passage's mouth left plain) and along the central row's foot on the berth.
  for (const s of [-1, 1]) {
    const x = s * (BASE_IN - 1.0);
    for (const [z0, z1] of [[SHED_ROAD.z0 + 0.4, SHED_ROAD.z1 - 0.4], [YARD_ROAD.z0 + 0.4, YARD_ROAD.z1 - 0.4], [QUAY.z0 + 0.4, QUAY.z1 - 1.0]] as const) paint([Math.min(x, x + s * 0.45), z0, Math.max(x, x + s * 0.45), z1], WHITE);
    const kerb = (a: number, b: number, z0: number, z1: number) => {
      paint([Math.min(s * a, s * b), z0, Math.max(s * a, s * b), z1], WHITE);
      for (let u = a; u + 1.2 <= b; u += 2.4) paint([Math.min(s * u, s * (u + 1.2)), z0, Math.max(s * u, s * (u + 1.2)), z1], RED, PAINT * 2);
    };
    kerb(PASSAGE.a1, BASE_IN, CUSTOMS.z0 - 0.3, CUSTOMS.z0);
    kerb(WH.x1, PASSAGE.a0, CUSTOMS.z0 - 0.3, CUSTOMS.z0);
    kerb(0, SQUARE.x, BERTH.z0, BERTH.z0 + 0.3);
  }
  // Crane rails along the quay and the berth, and the crane's own pair along its stack.
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [-BASE_IN, -BERTH.x] : [BERTH.x, BASE_IN];
    p.add(RAILS, { x0: a, x1: b, z: [QUAY.z0 + 3.2, QUAY.z1 - 2.8] });
  }
  p.add(RAILS, { x0: -BERTH.x, x1: BERTH.x, z: [BERTH.z0 + 2.4, BERTH.z1 - 2.8] });
  // Square: hatched box junction where the yard roads meet the crane's stack.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = s * (SQUARE.x - 1.6 - k * 1.6);
      paint([Math.min(x, x + s * 0.8), YARD_ROAD.z0 + 0.4, Math.max(x, x + s * 0.8), YARD_ROAD.z1 - 0.4], YELLOW);
    }
  }
  for (const z of [CENTRAL_ROW.z0 - 0.6, SQUARE.z0 + 0.6]) paint([-SQUARE.x + 0.8, z - 0.1, SQUARE.x - 0.8, z + 0.1], WHITE);
  outside(plate);
}

/** Quay and berth: pale concrete pours, each a little different, in 4.8 m slabs. */
function quaySlabs(plate: (r: Rect, color: string) => void) {
  const rng = new Rng(77);
  const slab = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x < x1 - 0.01; x += 4.8) plate([x, z0, Math.min(x1, x + 4.8), z1], shade(CONCRETE, rng.pick([0.04, 0.01, -0.02, -0.04])));
  };
  for (const s of [-1, 1]) {
    if (s < 0) slab(-BASE_IN, QUAY.z0, -NOTCH, QUAY.z1);
    else slab(NOTCH, QUAY.z0, BASE_IN, QUAY.z1);
    const [a, b] = s < 0 ? [-BERTH.x, -SQUARE.x] : [SQUARE.x, BERTH.x];
    plate([a, CENTRAL_ROW.z0, b, BERTH.z0], CONCRETE);
  }
  slab(-BERTH.x, BERTH.z0, BERTH.x, BERTH.z1);
}

/** Land outside the fences, plain (nobody walks there). */
function outside(plate: (r: Rect, color: string) => void) {
  const land = '#b5ab98';
  for (const r of [[-160, -160, 160, LAND.back], [-160, LAND.back, -LAND.x, QUAY.z1], [LAND.x, LAND.back, 160, QUAY.z1]] as Rect[]) plate(r, land);
}

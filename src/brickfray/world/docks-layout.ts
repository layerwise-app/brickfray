/**
 * The docks plan as numbers, west half (x < 0); the east half mirrors it about x = 0. Three main roads run west to
 * east between solid masses: the shed road into the warehouse (short), the yard road into the crane square (mid) and
 * the quay along the water, bending round the ship's berth (long). Containers are 6.0 x 2.4 x 2.56 m, so block
 * faces are whole containers.
 */
export const LAND = { x: 64.0, back: -63.0 } as const;
/** Inner edge of the base road (|x|): the masses start here. */
export const BASE_IN = 54.4;
export const SHED_ROAD = { z0: -59.0, z1: -49.0 } as const;
export const YARD_ROAD = { z0: -27.6, z1: -18.0 } as const;
export const QUAY = { z0: 5.0, z1: 15.0 } as const;
export const BERTH = { z0: -4.6, z1: QUAY.z0, x: 28.8 } as const;
/** Water notch the ship lies in, |x| < NOTCH south of the berth. */
export const NOTCH = 20.0;
/** The crane square: 48 x 34 m, the hall's front wall on its north side, split by the crane plinth into two yards. */
export const SQUARE = { x: 24.0, z0: -41.0, z1: -7.0 } as const;
/** One row of containers along x, two high, between the square and the berth. */
export const CENTRAL_ROW = { z0: SQUARE.z1, z1: BERTH.z0 } as const;
/** The crane's stack in the square, exactly covering the yard road's band so no line runs base to base. */
export const ISLAND = { x: 3.0, z0: YARD_ROAD.z0, z1: YARD_ROAD.z1 } as const;
/**
 * The crane plinth's ends: the weighbridge office north of the stack and a container set down south of it. With the
 * stack they split the square into the red (west) and blue (east) yards, joined by the weighbridge passage (north)
 * and the crane row (south).
 */
export const WEIGHBRIDGE = { x: 4.8, z0: -31.2, z1: ISLAND.z0, height: 3.4 } as const;
export const SET_DOWN = { x: ISLAND.x, z0: ISLAND.z1, z1: -15.6 } as const;
export const CUSTOMS = { x0: 24.0, x1: BASE_IN, z0: SHED_ROAD.z1, z1: YARD_ROAD.z0, height: 7.2, storey: 3.4 } as const;
/**
 * The clock passage through the customs house, an L under its first floor: leg A runs south from the shed road at
 * |x| a0..a1, leg B east along z b0..b1 into the square under the clock. The hall's only link to the square.
 */
export const PASSAGE = { a0: 28.8, a1: 32.8, b0: -40.4, b1: -36.4 } as const;
/**
 * The stack alley between the yard road and the quay, bent so no line runs through it: the north leg at |x| n0..n1,
 * a jog along z j0..j1, the south leg at |x| s0..s1 out onto the quay.
 */
export const ALLEY = { n0: 36.0, n1: 40.0, s0: 40.8, s1: 44.8, j0: -7.6, j1: -4.2 } as const;
export const BLOCK1A = { x0: ALLEY.n1, x1: BASE_IN, z0: YARD_ROAD.z1, z1: ALLEY.j0 } as const;
export const BLOCK1B = { x0: ALLEY.s1, x1: BASE_IN, z0: ALLEY.j0, z1: QUAY.z0 } as const;
/** Block 2: five containers wide by the square, three wide (and two long) where the berth road ends against it. */
export const BLOCK2_N = { x0: 24.0, x1: ALLEY.n0, z0: YARD_ROAD.z1, z1: CENTRAL_ROW.z0 } as const;
export const BLOCK2_S = { x0: BERTH.x, x1: ALLEY.n0, z0: CENTRAL_ROW.z0, z1: QUAY.z0 } as const;
/** Block 2's quay-side spur, the jog's south wall: the alley's quay mouth sits behind it. */
export const BLOCK2_X = { x0: ALLEY.n0, x1: ALLEY.s0, z0: ALLEY.j1, z1: QUAY.z0 } as const;
/** The siding strip behind the shed road's fence, out of bounds: rails on ballast, so the road looks out, not at a wall. */
export const RAIL_YARD = { x0: 24.0, x1: LAND.x, z0: LAND.back, z1: SHED_ROAD.z0 } as const;
export const STACK_H = 2.56;
/** The red ship lies off the berth across a 2.8 m strip of water; its deck is a raised post reached by two gangways. */
export const SHIP = { length: 34.0, beam: 10.0, z: BERTH.z1 + 2.8, deck: 2.2, rail: 1.3 } as const;
/** Gangway stairs from the berth edge up onto the deck (|x| range). */
export const GANGWAYS = { x0: 8.8, x1: 11.2 } as const;

/** West team colours (warm) and east (cool): every block, house and sign says whose half you are in. */
export const SIDE_COLORS = {
  west: ['#c0392b', '#e67e22', '#d9b93a', '#8e5a9a', '#b5523b'],
  east: ['#2f7fbf', '#16a085', '#2e8b57', '#7f8c8d', '#3f6f9f']
} as const;
export const palette = (s: number) => (s < 0 ? SIDE_COLORS.west : SIDE_COLORS.east);

/** A west-half rectangle [x0, x1] (positive magnitudes) placed on side s (-1 west, 1 east). */
export const span = (s: number, a: number, b: number): [number, number] => (s < 0 ? [-b, -a] : [a, b]);

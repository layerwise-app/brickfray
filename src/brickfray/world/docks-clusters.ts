import { CABLE_DRUM, TIMBER } from './docks-cover';
import { JERSEY } from './docks-blocks';
import { ALLEY, CUSTOMS, PASSAGE, SQUARE, YARD_ROAD } from './docks-layout';
import { BULK_BAGS, FLAT_WAGON, lasting, STEEL_COILS } from './docks-props';
import type { Plan } from './plan';
import { CONTAINER, PALLET } from './props-harbor';
import { FORKLIFT } from './props-vehicles';
import { END_DOOR } from './warehouse';

/**
 * Cover on the land, in clusters (something tall with something low beside it) placed for a fight, west half mirrored
 * east; quay and berth cover lives with the water's edge (docks-quay.ts). Reasons per cluster in PROGRESS (C1-C7).
 * Pieces stand flush against a wall or at least 1.8 m clear of it and of each other: no squeeze gaps.
 */
export function docksClusters(p: Plan) {
  for (const s of [-1, 1] as const) {
    const x = (v: number) => s * v;
    const out = s < 0 ? 0 : 2;
    // C1 red/blue yard, north: timber stack (stops the line along the hall front, the step from the clock passage to
    // the weighbridge) with a pair of bulk bags beside it facing the weighbridge.
    p.add(lasting(TIMBER), { x: x(14.0), z: -34.3, layers: 2 });
    p.add(lasting(BULK_BAGS), { x: x(9.0), z: -34.3 });
    // C2 yard, south: a container set down along the row (stops the line along the central row, the step from the yard
    // mouth to the crane row) with steel coils at its inner end.
    p.add(lasting(CONTAINER), { x: x(14.0), z: -12.2, color: s < 0 ? '#b5523b' : '#3f6f9f', turns: out });
    p.add(lasting(STEEL_COILS), { x: x(8.6), z: -12.2 });
    // C3 the yard road's mouth into the square: bulk bags to hold the mouth from; a pair at the yard's centre, the
    // crouch stop between the mouth and the plinth (the yard's middle was 10 m from any cover).
    p.add(lasting(BULK_BAGS), { x: x(SQUARE.x - 4.5), z: (YARD_ROAD.z0 + YARD_ROAD.z1) / 2, count: 3 });
    p.add(lasting(BULK_BAGS), { x: x(13.0), z: (YARD_ROAD.z0 + YARD_ROAD.z1) / 2 - 0.6, turns: 1, color: '#d9d4c7' });
    // C4 yard road halfway, against block 1 by the alley's mouth: forklift (forks toward the alley) and pallets.
    p.add(lasting(FORKLIFT), { x: x(ALLEY.n1 + 4.1), z: YARD_ROAD.z1 - 0.62, turns: s < 0 ? 0 : 2, color: s < 0 ? '#f6c624' : '#f05a1a' });
    p.add(lasting(PALLET), { x: x(ALLEY.n1 + 7.3), z: YARD_ROAD.z1 - 0.6, turns: 1, load: 'boxes' });
    // C5 yard road at the square's mouth, against block 2N: a cable drum on its rims and a barrier.
    p.add(lasting(CABLE_DRUM), { x: x(SQUARE.x + 3.0), z: YARD_ROAD.z1 - 1.0, cable: s < 0 ? '#c0392b' : '#2f7fbf' });
    p.add(lasting(JERSEY), { x: x(SQUARE.x + 7.4), z: YARD_ROAD.z1 - 0.3 });
    // C6 shed road halfway: a flat wagon of coils on the siding (stops the base gantry -> hall end door line), a coil
    // pair as the crouch stop between it and the base road.
    const railZ = (END_DOOR[0] + END_DOOR[1]) / 2;
    p.add(lasting(FLAT_WAGON), { x: x(41.0), z: railZ });
    p.add(lasting(STEEL_COILS), { x: x(48.4), z: railZ, turns: 1 });
    // C7 shed road at the clock passage: cable drums against the customs wall, a hold for the passage's mouth.
    for (const dx of [4.4, 6.2]) p.add(lasting(CABLE_DRUM), { x: x(PASSAGE.a1 + dx), z: CUSTOMS.z0 - 0.9, upright: true, cable: s < 0 ? '#c0392b' : '#2f7fbf' });
  }
}

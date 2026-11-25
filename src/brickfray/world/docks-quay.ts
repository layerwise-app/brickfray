import { WATER } from './blocks';
import { CABLE_DRUM, TRUCK } from './docks-cover';
import { ALLEY, BERTH, CENTRAL_ROW, CUSTOMS, GANGWAYS, LAND, NOTCH, QUAY, SHIP, YARD_ROAD } from './docks-layout';
import { EDGE_RAIL, QUAY_WALL, WATER_Y } from './docks-parts';
import { BALCONY } from './docks-balcony';
import { BULK_BAGS, lasting, STEEL_COILS } from './docks-props';
import { GANGWAY_STAIR, RED_SHIP } from './docks-ship';


import type { Element, Plan } from './plan';
import { CONTAINER } from './props-harbor';
import { Pen } from './props-kit';
import { LAMP } from './props-street';
import { FORKLIFT } from './props-vehicles';
import { Frame } from './util';

/** Tyre fenders hung on the berth's wall every 4 m, over the water between the wall and the ship. */
const FENDERS: Element<{ x0: number; x1: number; z: number }> = {
  draw(d, p) {
    if (d.detail === 0) return;
    const t = new Pen(d, new Frame(0, 0, 0));
    for (let x = p.x0; x <= p.x1 + 0.01; x += 4.0) t.ringUp(x, -0.45, p.z + 0.16, 0.32, 0.12, '#1b1f23');
  }
};

/** Concrete quay face along z (the notch's ends) down to the water, with its coping. */
const QUAY_SIDE: Element<{ x: number; z0: number; z1: number; s: number }> = {
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    t.span(p.x, WATER_Y - 1.2, p.z0, p.x - p.s * 0.6, -0.02, p.z1, '#8d8f88', undefined, 0);
    t.span(p.x + p.s * 0.02, -0.02, p.z0, p.x - p.s * 0.5, 0.06, p.z1, '#c9c4b5', undefined, 0.01);
  }
};

/**
 * Water's edge: the quay face and its rail along both quays, round the berth notch, the red ship lying off the berth
 * and its two gangway stairs; then the cover on the quay and the berth, each placed for a fight (PROGRESS C8-C11).
 */
export function docksQuay(p: Plan) {
  const T = 0.12;
  p.add(QUAY_WALL, { x0: -160, x1: -NOTCH, z: QUAY.z1, gaps: [] });
  p.add(QUAY_WALL, { x0: NOTCH, x1: 160, z: QUAY.z1, gaps: [] });
  p.add(QUAY_WALL, { x0: -NOTCH, x1: NOTCH, z: BERTH.z1, gaps: [[-GANGWAYS.x1, -GANGWAYS.x0], [GANGWAYS.x0, GANGWAYS.x1]] });
  for (const s of [-1, 1]) p.add(QUAY_SIDE, { x: s * NOTCH, z0: BERTH.z1, z1: QUAY.z1, s });
  p.add(WATER, { x0: -NOTCH, z0: BERTH.z1, x1: NOTCH, z1: QUAY.z1, y: WATER_Y, color: '#2c5866' });
  for (const s of [-1, 1]) {
    const [a, b] = s < 0 ? [-LAND.x, -NOTCH] : [NOTCH, LAND.x];
    p.add(EDGE_RAIL, { x0: a, z0: QUAY.z1 - T, x1: b, z1: QUAY.z1 });
    p.add(EDGE_RAIL, { x0: s < 0 ? -NOTCH : NOTCH - T, z0: BERTH.z1, x1: s < 0 ? -NOTCH + T : NOTCH, z1: QUAY.z1 - T });
  }
  // The berth's edge rail, open where the gangways start.
  for (const [a, b] of [[-NOTCH + T, -GANGWAYS.x1], [-GANGWAYS.x0, GANGWAYS.x0], [GANGWAYS.x1, NOTCH - T]] as const) p.add(EDGE_RAIL, { x0: a, z0: BERTH.z1 - T, x1: b, z1: BERTH.z1 });
  p.add(lasting(RED_SHIP), { x: 0, z: SHIP.z });
  p.add(FENDERS, { x0: -NOTCH + 3, x1: NOTCH - 3, z: BERTH.z1 });
  for (const s of [-1, 1]) p.add(lasting(GANGWAY_STAIR), { x: s * (GANGWAYS.x0 + GANGWAYS.x1) / 2, z0: BERTH.z1 });

  // C11 berth: a container set down against the central row mid-berth: a bay to hold the berth's middle from, out of
  // the ship deck's line (mid-berth it left two 3.6 m lanes, a prop wall either side).
  p.add(lasting(CONTAINER), { x: 0, z: BERTH.z0 + 1.22, color: '#e67e22', turns: 0 });
  for (const s of [-1, 1] as const) {
    const x = (v: number) => s * v;
    const out = s < 0 ? 0 : 2;
    const team = s < 0 ? '#c0392b' : '#2f7fbf';
    // C8 quay, base end, against block 1b by the alley's quay mouth: a cable drum on its rims, a coil pair beside it.
    p.add(lasting(CABLE_DRUM), { x: x(48.0), z: QUAY.z0 + 1.0, cable: team });
    p.add(lasting(STEEL_COILS), { x: x(51.0), z: QUAY.z0 + 1.1 });
    // R3 the quay catwalk on blocks 2s/2x (raised place: its own quay and the bend).
    p.add(lasting(BALCONY), { s, wall: s < 0 ? '#a24a36' : '#46657f' });
    // C9 quay halfway: a container truck under the catwalk, out from the stack (crossing cover on the quay, 2.4 m lane
    // inside it, 3.1 m outside). Its box (3.9 m) is too high to reach from the catwalk's stairs; anything low here would
    // be a step up onto the edge rail.
    p.add(lasting(TRUCK), { x: x(34.0), z: QUAY.z0 + 5.5, turns: out, color: team, box: s < 0 ? '#2e8b57' : '#d9b93a' });
    // C10 bend: bulk bags waiting for the ship at the berth's end, to hold its entry from. (The line along the water's
    // edge from quay to quay is closed by the gangways' screens.)
    p.add(lasting(BULK_BAGS), { x: x(21.6), z: -0.5, count: 3, turns: 1 });
    // C11 berth: cable drums half way between the gangway and the container; the forklift that works the ship, against
    // the central row.
    for (const v of [12.1, 13.9]) p.add(lasting(CABLE_DRUM), { x: x(v), z: -0.6, upright: true, cable: team });
    p.add(lasting(FORKLIFT), { x: x(17.0), z: CENTRAL_ROW.z1 + 1.1, turns: 3, color: s < 0 ? '#f6c624' : '#f05a1a' });
    // Lamps stand flush with the walls of the masses, never free in a road.
    for (const v of [22.0, ALLEY.s1 - 0.6]) p.add(lasting(LAMP), { x: x(v), z: QUAY.z0 + 0.17 });
    for (const v of [28.0, 51.0]) p.add(lasting(LAMP), { x: x(v), z: YARD_ROAD.z0 + 0.17 });
    for (const v of [34.0, 46.0]) p.add(lasting(LAMP), { x: x(v), z: CUSTOMS.z0 - 0.17 });
    for (const v of [10.0, 20.0]) p.add(lasting(LAMP), { x: x(v), z: CENTRAL_ROW.z1 + 0.17 });
  }
}

import type { Element, Plan } from './plan';
import type { At } from './props-kit';
import { BRAZIER, FALLEN_COLUMN, LANTERN, LOTUS_POOL, RUBBLE, URN } from './temple-props';

/** Adds an element and its half-turn copy about the centre. */
export function both<P extends At>(p: Plan, el: Element<P>, at: P) {
  p.add(el, at);
  p.add(el, { ...at, x: -at.x, z: -at.z, turns: (at.turns ?? 0) + 2 });
}

/** Court cover (east court; the west court is its half turn) in clusters, mostly waist high so the court stays open. */
function court(p: Plan) {
  both(p, LOTUS_POOL, { x: 16.0, z: -7.2 });
  both(p, LANTERN, { x: 16.0, z: -14.4 });
  both(p, FALLEN_COLUMN, { x: 20.8, z: -15.6 });
  both(p, RUBBLE, { x: 19.6, z: 8.0 });
  both(p, FALLEN_COLUMN, { x: 15.2, z: 7.2 });
  both(p, LANTERN, { x: 22.4, z: 17.2 });
  both(p, URN, { x: 14.0, z: -19.6, color: '#2f7a8a' });
  both(p, URN, { x: 24.8, z: 20.8, color: '#b8402c' });
}

/** Nave furniture beside the axis: braziers and a fallen column, waist high, every 6-8 m. */
function nave(p: Plan) {
  both(p, BRAZIER, { x: 3.6, z: -14.4 });
  both(p, BRAZIER, { x: 3.6, z: 14.4 });
  both(p, FALLEN_COLUMN, { x: 5.2, z: -1.6, turns: 1 });
}

/**
 * End yards: camp lanterns beside the supply stacks (too tall to climb, so the stacks are not reached from them), a
 * lotus pool in the west yard, lanterns and urns by the east yard's tablet.
 */
function ends(p: Plan) {
  for (const [x, z] of [[-17.6, -36.0], [17.6, -36.4]] as const) both(p, LANTERN, { x, z });
  both(p, LOTUS_POOL, { x: -8.8, z: -31.2 });
  both(p, LANTERN, { x: 17.2, z: -27.2 });
  both(p, URN, { x: 21.6, z: -33.6, color: '#b8402c' });
  both(p, RUBBLE, { x: 22.4, z: -24.8 });
}

export function templeCover(p: Plan) {
  court(p);
  nave(p);
  ends(p);
}

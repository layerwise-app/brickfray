import { CONTAINER_BLOCK, SIGN_GANTRY } from './docks-blocks';
import { customsHouse } from './docks-customs';
import { ALLEY, BASE_IN, BLOCK1A, BLOCK1B, BLOCK2_N, BLOCK2_S, BLOCK2_X, CENTRAL_ROW, ISLAND, LAND, palette, QUAY, RAIL_YARD, SET_DOWN, SHED_ROAD, span, SQUARE, STACK_H, WEIGHBRIDGE, YARD_ROAD } from './docks-layout';
import { CRANE } from './crane';
import type { Element, Plan } from './plan';
import { CONTAINER, CONTAINER_SIZE } from './props-harbor';
import { Pen } from './props-kit';
import { FENCE } from './props-street';
import { box, Frame } from './util';

/** The crane's z: centred on its stack, the boom reaching out over the berth with a box on the hook. */
export const CRANE_Z = (ISLAND.z0 + ISLAND.z1) / 2;

/** Tally clerk's hut, white walls under a red roof; at each bend it closes the slit of view along the quay's edge. */
export const HUT: Element<{ x: number; z: number }> = {
  colliders: (p) => [box([p.x - 1.0, 0, p.z - 0.8], [p.x + 1.0, 2.8, p.z + 0.8], 'wood')],
  draw(d, p) {
    const t = new Pen(d, new Frame(p.x, 0, p.z));
    const glass = '#26323a';
    t.box(0, 0, 0, 2.0, 0.3, 1.6, '#545c63', undefined, 0.01);
    t.box(0, 0.3, 0, 1.9, 2.2, 1.5, '#efe9dc', undefined, 0.02);
    t.box(0, 2.5, 0, 2.3, 0.18, 1.9, '#c0392b', undefined, 0.02);
    t.box(0, 2.68, 0, 2.0, 0.12, 1.6, '#a93226', undefined, 0.01);
    t.box(0, 2.8, 0.3, 1.6, 0.5, 0.08, '#f6c624', undefined, 0.01);
    t.box(-0.45, 0.3, -0.76, 0.7, 1.8, 0.04, '#2f7fbf', undefined, 0.01);
    for (const sx of [-1, 1]) t.box(sx * 0.96, 1.2, 0, 0.04, 0.7, 1.0, glass, undefined, 0.01);
    t.box(0.45, 1.2, -0.76, 0.7, 0.7, 0.04, glass, undefined, 0.01);
    if (d.detail > 0) t.box(-0.45, 2.2, -0.82, 0.3, 0.08, 0.1, '#fff1c4', 'glow', 0);
  }
};

const WB = WEIGHBRIDGE;
const WB_WALL = '#e6dcc0';

/**
 * Weighbridge office at the plinth's north end: a one-storey cream block against the crane's stack, windows on its
 * three open sides, the steel weighbridge plate set in the ground in front of it. Neither team's colour: it stands on
 * the centre line.
 */
const WEIGHBRIDGE_HOUSE: Element<Record<string, never>> = {
  colliders: () => [box([-WB.x, 0, WB.z0], [WB.x, WB.height, WB.z1], 'stone')],
  draw(d) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const H = WB.height;
    t.span(-WB.x, 0, WB.z0, WB.x, H - 0.3, WB.z1, WB_WALL, undefined, 0);
    t.span(-WB.x - 0.05, 0, WB.z0 - 0.05, WB.x + 0.05, 0.6, WB.z1 + 0.05, '#6c7178', undefined, 0);
    t.span(-WB.x - 0.15, H - 0.3, WB.z0 - 0.15, WB.x + 0.15, H, WB.z1 + 0.15, '#545c63', undefined, 0);
    t.span(-WB.x - 0.16, H - 0.62, WB.z0 - 0.16, WB.x + 0.16, H - 0.3, WB.z0 + 0.4, '#f6c624', undefined, 0);
    const glass = '#26323a';
    for (const x of [-3.0, 3.0]) {
      t.span(x - 0.8, 1.0, WB.z0 - 0.06, x + 0.8, 2.4, WB.z0, '#f2f2ee', undefined, 0);
      t.span(x - 0.65, 1.1, WB.z0 - 0.08, x + 0.65, 2.3, WB.z0, glass, undefined, 0);
    }
    t.span(-0.6, 0, WB.z0 - 0.08, 0.6, 2.3, WB.z0, '#2e8b57', undefined, 0);
    for (const s of [-1, 1]) {
      const x = s * (WB.x + 0.04);
      t.box(x, 1.1, (WB.z0 + WB.z1) / 2, 0.08, 1.2, 1.6, '#f2f2ee', undefined, 0);
      t.box(x + s * 0.02, 1.2, (WB.z0 + WB.z1) / 2, 0.06, 1.0, 1.4, glass, undefined, 0);
    }
    // The plate trucks drive onto: steel, a yellow-black edge, the lead-in ramps.
    const p0 = WB.z0 - 7.2;
    d.ground.push({ x0: -3.2, z0: p0, x1: 3.2, z1: WB.z0 - 0.4, y: 0.006, color: '#7c8389', smooth: true });
    for (let z = p0; z < WB.z0 - 0.5; z += 0.8) for (const x of [-3.2, 2.9]) d.ground.push({ x0: x, z0: z, x1: x + 0.3, z1: z + 0.4, y: 0.008, color: '#f6c624', smooth: true });
    if (d.detail > 0) for (let z = p0 + 0.6; z < WB.z0 - 0.6; z += 1.2) d.ground.push({ x0: -2.8, z0: z, x1: 2.8, z1: z + 0.05, y: 0.008, color: '#5d636a', smooth: true });
  }
};

/**
 * The masses that make the three roads, west half mirrored east: the customs house (with the clock passage) between
 * the shed and yard roads; container blocks between the yard road and the quay, the bent stack alley between them (a
 * container across each mouth for an arch); see-through fences along the shed and base roads, a sign gantry over each
 * lane's mouth. In the middle: the crane plinth (weighbridge office, the crane over its stack, a container set down
 * south of it) splitting the square, and the central row between the square and the berth.
 */
export function docksMasses(p: Plan) {
  for (const s of [-1, 1] as const) {
    const pal = palette(s);
    customsHouse(p, s);
    const block = (b: { x0: number; x1: number; z0: number; z1: number }, faces: ('n' | 's' | 'e' | 'w')[], crown?: [number, number][]) => {
      const [x0, x1] = span(s, b.x0, b.x1);
      const mirrored = faces.map((f) => (s > 0 ? f : f === 'e' ? 'w' : f === 'w' ? 'e' : f));
      p.add(CONTAINER_BLOCK, { x0, x1, z0: b.z0, z1: b.z1, levels: 2, along: 'z', colors: pal, faces: mirrored, crown });
    };
    // Faces listed for the east half (x > 0); `block` mirrors them west.
    block(BLOCK1A, ['n', 's', 'w', 'e'], [[3, 0]]);
    block(BLOCK1B, ['s', 'w', 'e'], [[2, 1]]);
    block(BLOCK2_N, ['n', 's', 'w', 'e']);
    block(BLOCK2_S, ['s', 'w', 'e']);
    block(BLOCK2_X, ['n', 's', 'e']);
    const arch = (x: number, z: number, color: string) => p.add(CONTAINER, { x: s * x, z: z + CONTAINER_SIZE.width / 2, y: 2 * STACK_H, color, turns: s < 0 ? 0 : 2 });
    arch((ALLEY.n0 + ALLEY.n1) / 2, YARD_ROAD.z1, pal[2]!);
    arch((ALLEY.s0 + ALLEY.s1) / 2, QUAY.z0 - CONTAINER_SIZE.width, pal[0]!);
    p.add(FENCE, { x: s * (RAIL_YARD.x0 + RAIL_YARD.x1) / 2, z: SHED_ROAD.z0 - 0.1, length: RAIL_YARD.x1 - RAIL_YARD.x0, kind: 'chain', height: 3.0 });
    p.add(FENCE, { x: s * (LAND.x - 0.2), z: (SHED_ROAD.z0 + QUAY.z1) / 2, turns: 1, length: QUAY.z1 - SHED_ROAD.z0, kind: 'chain', height: 3.0 });
    const gx = s * (BASE_IN + 0.15);
    p.add(SIGN_GANTRY, { x: gx, z0: SHED_ROAD.z0, z1: SHED_ROAD.z1, band: '#c0392b' });
    p.add(SIGN_GANTRY, { x: gx, z0: YARD_ROAD.z0, z1: YARD_ROAD.z1, band: '#e0a800' });
    p.add(SIGN_GANTRY, { x: gx, z0: QUAY.z0, z1: QUAY.z1 - 0.6, band: '#2f7fbf' });
  }
  p.add(CONTAINER_BLOCK, { x0: -ISLAND.x, x1: ISLAND.x, z0: ISLAND.z0, z1: ISLAND.z1, levels: 2, along: 'x', colors: ['#d9b93a', '#7f8c8d', '#e9e6dc', '#c0392b', '#2f7fbf'] });
  p.add(WEIGHBRIDGE_HOUSE, {});
  p.add(CONTAINER, { x: 0, z: (SET_DOWN.z0 + SET_DOWN.z1) / 2, color: '#16a085', turns: 0 });
  p.add(CRANE, { x: 0, z: CRANE_Z, load: 9.6, loadColor: '#e67e22' });
  p.add(CONTAINER_BLOCK, { x0: -SQUARE.x, x1: SQUARE.x, z0: CENTRAL_ROW.z0, z1: CENTRAL_ROW.z1, levels: 2, along: 'x', colors: ['#7f8c8d', '#d9b93a', '#2e8b57', '#c0392b', '#2f7fbf', '#8e5a9a'] });
}

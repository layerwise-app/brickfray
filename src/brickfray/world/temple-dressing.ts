import { DECAL, GROUND, type GroundParams } from './blocks';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { VILLAGE_BLOCKS } from './temple-lanes';
import { T } from './temple-layout';
import { prayerFlags, shrubs } from './temple-props';
import { Frame, type Vec3 } from './util';

const GRASS = '#5c9a3e';
const MOSS = '#4f8a3e';
const GOLD = '#e0b040';

/**
 * Ground by district, so each reads at a glance: mossy grass at the cliff camp and along the gorge, a packed-earth
 * village street in the east strip, river-stone paving on the south terrace; sandstone in the great hall, warm ochre
 * flags in the north yards, cool grey in the south yards, rose tiles in the east court and jade-grey in the west.
 */
/** The central floor's walk collider, drawn by nothing: its look comes from the district plates laid over it. */
const FLOOR: Element<GroundParams> = { colliders: GROUND.colliders, draw() {} };

function ground(p: Plan) {
  const X = T.edgeX;
  const Z = T.edge;
  const g = (x0: number, z0: number, x1: number, z1: number, color: string, surface: 'foliage' | 'stone') => p.add(GROUND, { x0, z0, x1, z1, y: 0, color, surface, depth: 2.4 });
  const plate = (x0: number, z0: number, x1: number, z1: number, color: string) => p.add(DECAL, { x0, z0, x1, z1, y: 0, color, surface: 'stone' });
  const C = T.courtOut;
  const R = T.rangeOut;
  const A = T.arcade;
  const W = T.row;
  g(-X, -Z, X, -R, MOSS, 'foliage');
  g(-X, R, X, Z, '#cfc6ae', 'stone');
  g(-X, -R, -C, R, GRASS, 'foliage');
  g(C, -R, X, R, '#bfa27a', 'stone');
  // One collider under the whole middle, as before the districts were painted, so the bot waypoints stay where they were.
  p.add(FLOOR, { x0: -C, z0: -R, x1: C, z1: R, y: 0, color: '#e2c48c', surface: 'stone', depth: 2.4 });
  plate(-A, -W, A, W, '#e2c48c');
  plate(A, -W, C, W, '#e0b29a');
  plate(-C, -W, -A, W, '#c4cdb4');
  plate(-C, -R, C, -W, '#e6bd7e');
  plate(-C, W, C, R, '#d2ccbc');
}

const turn = ([x, y, z]: Vec3): Vec3 => [-x, y, -z];

/** Silk lantern (red unless told) on a cord from `top`, its body centred at y; out of reach. */
function redLantern(t: Pen, d: Drawer, x: number, y: number, z: number, top: number, r: number, body = '#c8231b', tassel = '#e0402c') {
  t.cyl(x, y + r * 1.1, z, 0.025, top - y - r * 1.1, '#3a2a1f', undefined, 0, 4);
  t.cyl(x, y + r * 0.95, z, r * 0.45, r * 0.2, GOLD, 'metal', 0, 8);
  t.ball(x, y, z, r, body, [1, 1.15, 1], 0, 1);
  t.cyl(x, y - r * 1.15, z, r * 0.45, r * 0.2, GOLD, 'metal', 0, 8);
  if (d.detail > 0) t.cyl(x, y - r * 1.75, z, 0.06, r * 0.6, tassel, undefined, 0, 5);
}

/** A string of small paper lanterns from a to b, sagging in the middle (the west half's answer to the prayer flags). */
function lanternString(t: Pen, d: Drawer, a: Vec3, b: Vec3, count: number) {
  const sag = Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.06;
  const at = (u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u];
  for (let i = 0; i < 6; i++) {
    const p = at(i / 6);
    const q = at((i + 1) / 6);
    t.beam(p[0], p[1], p[2], q[0], q[1], q[2], 0.025, '#3a2a1f');
  }
  for (let i = 0; i < count; i++) {
    const [x, y, z] = at((i + 0.5) / count);
    t.ball(x, y - 0.32, z, 0.18, i % 3 === 1 ? '#f6c624' : '#c8231b', [1, 1.25, 1], 0, 1);
    if (d.detail > 0) t.cyl(x, y - 0.56, z, 0.05, 0.08, GOLD, 'metal', 0, 6);
  }
}

/** A tall cream banner with a disc and a tail in a team's colour, hung on a face (normal along x or z) from `top` down. */
function teamBanner(t: Pen, d: Drawer, x: number, top: number, z: number, alongX: boolean, team: string) {
  const w = alongX ? 0.9 : 0.04;
  const dd = alongX ? 0.04 : 0.9;
  t.box(x, top - 0.12, z, alongX ? 1.1 : 0.08, 0.12, alongX ? 0.08 : 1.1, '#5a3424', undefined, 0);
  t.box(x, top - 2.9, z, w, 2.8, dd, '#f2e6c8', undefined, 0);
  t.box(x, top - 3.2, z, w * 0.6 + (alongX ? 0 : 0.02), 0.3, dd * 0.6 + (alongX ? 0.02 : 0), team, undefined, 0);
  if (d.detail > 0) {
    if (alongX) t.cylZ(x, top - 1.3, z, 0.3, 0.08, team, undefined, 0, 10);
    else t.cylX(x - 0.04, top - 1.3, z, 0.3, 0.08, team);
    t.box(x, top - 0.5, z, alongX ? 0.9 : 0.06, 0.08, alongX ? 0.06 : 0.9, GOLD, 'metal', 0);
  }
}

/** A gateway over a wide village lane: red posts, a beam and a small tiled roof, two lanterns. */
function laneGate(t: Pen, d: Drawer, z0: number, z1: number) {
  const x = T.edgeX + 0.1;
  for (const z of [z0 + 0.15, z1 - 0.15]) t.box(x, 0, z, 0.26, 3.6, 0.26, '#a83a2c', undefined, 0.02);
  t.box(x, 3.3, (z0 + z1) / 2, 0.36, 0.3, z1 - z0 + 0.4, '#5a3424', undefined, 0.02);
  t.prism(`lanegate:${(z1 - z0).toFixed(1)}`, [[-0.7, 0], [0.7, 0], [0, 0.55]], z1 - z0 + 1.0, x, 3.6, (z0 + z1) / 2, '#5f6a70', undefined, Math.PI / 2);
  if (d.detail > 0) for (const z of [z0 + 0.6, z1 - 0.6]) redLantern(t, d, x - 0.35, 2.7, z, 3.3, 0.22);
  // The lane beyond: potted flowers and a stone lantern by the house doors.
  for (let k = 0; k < 3; k++) {
    const px = x + 1.6 + k * 2.2;
    for (const z of [z0 + 0.5, z1 - 0.5]) {
      t.cyl(px, 0, z, 0.26, 0.46, '#b5562e', undefined, 0.02, 8);
      t.ball(px, 0.6, z, 0.3, k % 2 ? '#d84a7a' : '#3f8f3a', [1, 0.8, 1], 0.2, k + 1);
    }
  }
}

/**
 * Dressing with no colliders, every piece out of reach or knee high: prayer flags from the bell towers over the east
 * court and yards and paper lanterns from the drum towers over the west, red lanterns down the nave and the gate halls,
 * team banners on the camp watch shrines, gateways over the two village lanes, shrubs along the strips and the edges.
 */
const DRESSING: Element<Record<string, never>> = {
  draw(d) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const tower: Vec3 = [27.6, 6.4, -22.8];
    const strings: [Vec3, Vec3, number][] = [
      [tower, [19.6, 5.2, 0], 22],
      [[19.6, 5.2, 0], [27.6, 6.4, 22.8], 22],
      [[3.2, 5.4, -29.6], tower, 22],
      [[3.2, 5.4, 25.6], [27.6, 6.4, 22.8], 22]
    ];
    for (const [a, b, n] of strings) {
      prayerFlags(d, a, b, n);
      lanternString(t, d, turn(a), turn(b), Math.round(n * 0.6));
    }
    for (const z of [-16.8, -12.0, 12.0, 16.8]) redLantern(t, d, 0, 6.4, z, T.hallTop, 0.55);
    // The river gate hall hangs white paper lanterns with blue tassels, the cliff gate hall red silk ones.
    for (const s of [-1, 1]) for (const z of [26.4, 30.4, 34.4]) redLantern(t, d, 0, 3.9, s * z, T.rangeTop, 0.32, s < 0 ? '#c8231b' : '#f2ead6', s < 0 ? '#e0402c' : '#2f5f9a');
    for (const s of [-1, 1]) {
      const team = s < 0 ? '#e0742c' : '#2f7fd0';
      for (const x of [-1, 1]) {
        teamBanner(t, d, x * 27.12, 4.4, s * 40.0, false, team);
        teamBanner(t, d, x * 29.2, 4.4, s * 38.32, true, team);
      }
    }
    for (let i = 0; i + 1 < VILLAGE_BLOCKS.length; i++) {
      const z0 = VILLAGE_BLOCKS[i]![1];
      const z1 = VILLAGE_BLOCKS[i + 1]![0];
      if (z1 - z0 > 4) laneGate(t, d, z0, z1);
    }
    const strip: [number, number][] = [[-16.8, -13.2], [-7.6, -2.4], [2.4, 5.6], [10.0, 17.2]];
    for (const s of [-1, 1]) for (const [z0, z1] of strip) shrubs(d, [s * (T.courtOut + 0.5), s * z0], [s * (T.courtOut + 0.5), s * z1], Math.round(z0 * 7 + s * 3));
    shrubs(d, [-T.edgeX + 0.6, -34.4], [-T.edgeX + 0.6, 34.4], 71);
    for (const s of [-1, 1]) for (const x of [-1, 1]) shrubs(d, [x * 3.2, s * (T.edge - 0.6)], [x * 26.4, s * (T.edge - 0.6)], 73 + s * 5 + x);
  }
};

export function templeDressing(p: Plan) {
  ground(p);
  p.add(DRESSING, {});
}

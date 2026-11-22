import { GROUND } from './blocks';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { T } from './temple-layout';
import { prayerFlags, shrubs } from './temple-props';
import { Frame, type Vec3 } from './util';

const GRASS = '#5c9a3e';
const PAVING = '#e2c48c';
const GOLD = '#e0b040';

/** Ground: paving inside the temple, grass and earth outside. */
function ground(p: Plan) {
  const X = T.edgeX;
  const Z = T.edge;
  const g = (x0: number, z0: number, x1: number, z1: number, color: string, surface: 'foliage' | 'stone') => p.add(GROUND, { x0, z0, x1, z1, y: 0, color, surface, depth: 2.4 });
  const C = T.courtOut;
  const R = T.rangeOut;
  g(-X, -Z, X, -R, GRASS, 'foliage');
  g(-X, R, X, Z, GRASS, 'foliage');
  g(-X, -R, -C, R, GRASS, 'foliage');
  g(C, -R, X, R, GRASS, 'foliage');
  g(-C, -R, C, R, PAVING, 'stone');
}

const turn = ([x, y, z]: Vec3): Vec3 => [-x, y, -z];

/** Red silk lantern on a cord from `top`, its body centred at y; out of reach. */
function redLantern(t: Pen, d: Drawer, x: number, y: number, z: number, top: number, r: number) {
  t.cyl(x, y + r * 1.1, z, 0.025, top - y - r * 1.1, '#3a2a1f', undefined, 0, 4);
  t.cyl(x, y + r * 0.95, z, r * 0.45, r * 0.2, GOLD, 'metal', 0, 8);
  t.ball(x, y, z, r, '#c8231b', [1, 1.15, 1], 0, 1);
  t.cyl(x, y - r * 1.15, z, r * 0.45, r * 0.2, GOLD, 'metal', 0, 8);
  if (d.detail > 0) t.cyl(x, y - r * 1.75, z, 0.06, r * 0.6, '#e0402c', undefined, 0, 5);
}

/**
 * Dressing with no colliders, every piece out of reach or knee high: prayer flags from the drum towers over each court
 * and end yard, red lanterns hung down the nave and the gate hall, shrubs along the strip walls and the open edges.
 */
const DRESSING: Element<Record<string, never>> = {
  draw(d) {
    const tower: Vec3 = [27.6, 6.4, -22.8];
    const strings: [Vec3, Vec3, number][] = [
      [tower, [19.6, 5.2, 0], 22],
      [[19.6, 5.2, 0], [27.6, 6.4, 22.8], 22],
      [[3.2, 5.4, -29.6], tower, 22]
    ];
    for (const [a, b, n] of strings) {
      prayerFlags(d, a, b, n);
      prayerFlags(d, turn(a), turn(b), n);
    }
    prayerFlags(d, [-3.2, 5.4, -25.6], [-27.6, 6.4, -22.8], 22);
    prayerFlags(d, [3.2, 5.4, 25.6], [27.6, 6.4, 22.8], 22);
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const z of [-16.8, -12.0, 12.0, 16.8]) redLantern(t, d, 0, 6.4, z, T.hallTop, 0.55);
    for (const s of [-1, 1]) for (const z of [26.4, 30.4, 34.4]) redLantern(t, d, 0, 3.9, s * z, T.rangeTop, 0.32);
    const strip: [number, number][] = [[-16.8, -13.2], [-7.6, 1.2], [4.4, 5.6], [10.0, 17.2]];
    for (const s of [-1, 1]) for (const [z0, z1] of strip) shrubs(d, [s * (T.courtOut + 0.5), s * z0], [s * (T.courtOut + 0.5), s * z1], Math.round(z0 * 7 + s * 3));
    shrubs(d, [-T.edgeX + 0.6, -34.4], [-T.edgeX + 0.6, 34.4], 71);
    for (const s of [-1, 1]) for (const x of [-1, 1]) shrubs(d, [x * 3.2, s * (T.edge - 0.6)], [x * 26.4, s * (T.edge - 0.6)], 73 + s * 5 + x);
  }
};

export function templeDressing(p: Plan) {
  ground(p);
  p.add(DRESSING, {});
}

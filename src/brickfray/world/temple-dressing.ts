import { GROUND } from './blocks';
import type { Drawer, Element, Plan } from './plan';
import { Pen } from './props-kit';
import { BAND, CAMP, COURT, RAVINE, T } from './temple-layout';
import { prayerFlags, shrubs } from './temple-props';
import { Frame, type Vec3 } from './util';

/**
 * Ground by district, so each lane reads at a glance: mossy flags along the gorge path, sandstone on the processional
 * way, rose and jade tiles in the two lotus courts, polished stone in the hall, packed earth in the village street,
 * grass in the camps. Tiles meet edge to edge (never two colours over one spot).
 */
const MOSS_FLAGS = '#a9b48c';
const CAMP_GRASS = ['#7fa45a', '#8aa860'] as const;
const WAY = '#e2c48c';
const COURT_W = '#c4cdb4';
const COURT_E = '#e0b29a';
const HALL = '#d8c9a3';
const BLOCKS = '#bfb398';
const EARTH = '#c9a87a';

function ground(p: Plan) {
  const g = (x0: number, z0: number, x1: number, z1: number, color: string, surface: 'foliage' | 'stone' = 'stone') =>
    p.add(GROUND, { x0, z0, x1, z1, y: 0, color, surface, depth: 2.4 });
  const X = T.edgeX;
  const Z = T.edge;
  for (const s of [-1, 1]) {
    const span = (a: number, b: number): [number, number] => (s < 0 ? [-b, -a] : [a, b]);
    const [c0, c1] = span(CAMP, X);
    g(c0, -Z, c1, Z, CAMP_GRASS[s < 0 ? 0 : 1], 'foliage');
    const [n0, n1] = span(RAVINE, CAMP);
    g(n0, -Z, n1, BAND.north, MOSS_FLAGS);
    const [w0, w1] = span(COURT.x1, CAMP);
    g(w0, BAND.north, w1, BAND.south, WAY);
    const [k0, k1] = span(T.arcade, COURT.x1);
    g(k0, BAND.north, k1, BAND.south, s < 0 ? COURT_W : COURT_E);
    const [e0, e1] = span(0, CAMP);
    g(e0, BAND.south, e1, Z, EARTH);
  }
  g(-T.arcade, BAND.midN, T.arcade, BAND.midS, HALL);
  g(-T.arcade, BAND.north, T.arcade, BAND.midN, BLOCKS);
  g(-T.arcade, BAND.midS, T.arcade, BAND.south, BLOCKS);
}

/** Dressing with no colliders, every piece out of reach: prayer flags over the courts, shrubs along the rails. */
const DRESSING: Element<Record<string, never>> = {
  draw(d: Drawer) {
    const t = new Pen(d, new Frame(0, 0, 0));
    void t;
    // Prayer flags from eave to eave over the camp yards' mouths, the gorge path's and the street's mouths.
    const strings: [Vec3, Vec3, number][] = [];
    for (const s of [-1, 1]) {
      strings.push([[s * CAMP, 5.2, -26], [s * (T.edgeX - 0.4), 3.6, -34], 12], [[s * CAMP, 5.2, 26], [s * (T.edgeX - 0.4), 3.6, 34], 12]);
      strings.push([[s * 46, 5.4, BAND.north], [s * 48, 4.6, -37], 8], [[s * 45, 5.4, BAND.south], [s * 45, 5.4, 36.8], 8]);
    }
    for (const [a, b, n] of strings) prayerFlags(d, a, b, n);
    for (const s of [-1, 1]) shrubs(d, [s * (CAMP + 1), -T.edge + 0.6], [s * (RAVINE + 2), -T.edge + 0.6], 71 + s);
  }
};

export function templeDressing(p: Plan) {
  ground(p);
  p.add(DRESSING, {});
}

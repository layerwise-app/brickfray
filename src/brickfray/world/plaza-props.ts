import type { Element, Plan } from './plan';
import { BLVD, LAND } from './plaza-layout';
import { YARD } from './plaza-south';
import { TREE, type TreeKind } from './props-nature';
import { Pen } from './props-kit';
import { Frame, Rng } from './util';

/** Plane trees and limes in the base roads: shade for the spawns, perches for the birds. */
const TREES: [number, number, TreeKind][] = [[-59.6, -40.0, 'oak'], [-59.6, 34.4, 'poplar'], [59.6, -40.0, 'birch'], [59.6, 34.4, 'oak']];

/** Street furniture: trees in the base roads, the tram's overhead wire, washing over the yards. */
export function plazaProps(p: Plan) {
  for (const [x, z, kind] of TREES) p.add(TREE, { x, z, kind, size: 1.1 });
  p.add(DECOR, {});
}

/** Things out of reach: the tram wire on span wires between the house fronts, washing lines over the yards. */
const DECOR: Element<object> = {
  draw(d) {
    const t = new Pen(d, new Frame(0, 0, 0, 0));
    // Tram wire over the rails, hung from span wires every 12 m.
    const { jog: j, mid: m } = BLVD;
    for (const [x0, x1, dz] of [[-LAND.x, -m, 0], [-m, m, -j], [m, LAND.x, 0]] as const) {
      const wz = BLVD.z0 + 1.2 + dz;
      t.span(x0, 5.6, wz - 0.02, x1, 5.64, wz + 0.02, '#23282d', 'metal');
      for (let x = x0 + 6; x <= x1 - 3; x += 12) t.span(x - 0.02, 5.64, BLVD.z0 + dz, x + 0.02, 5.68, BLVD.z1 + dz, '#23282d', 'metal');
    }
    for (const s of [-1, 1]) t.span(s * m - 0.02, 5.6, BLVD.z0 + 1.2 - j, s * m + 0.02, 5.64, BLVD.z0 + 1.2, '#23282d', 'metal');
    const rng = new Rng(7);
    const colors = ['#f2f2ee', '#c8231b', '#1f62c7', '#f6c624', '#f3a6c3', '#5aa83f'];
    for (const s of [-1, 1]) {
      for (const z of [YARD.z0 + 2.4, YARD.z1 - 2.4]) {
        const [a, b] = [s * YARD.x0, s * YARD.x1];
        t.span(Math.min(a, b), 5.2, z - 0.01, Math.max(a, b), 5.22, z + 0.01, '#e7e1d2');
        if (d.detail === 0) continue;
        for (let x = Math.min(a, b) + 0.6; x < Math.max(a, b) - 0.6; x += rng.range(0.6, 0.9)) t.box(x, 4.7, z, rng.range(0.3, 0.5), rng.range(0.4, 0.55), 0.02, rng.pick(colors), undefined, 0);
      }
    }
  }
};

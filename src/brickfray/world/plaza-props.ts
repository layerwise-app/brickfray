import type { Element, Plan } from './plan';
import { BUSH, TREE, type TreeKind } from './props-nature';
import { Pen } from './props-kit';
import { BENCH, BIN, CAFE_TABLE, CONE, LAMP } from './props-street';
import { box, Frame, Rng } from './util';

type Spot = [number, number, number?];

const LAMPS: Spot[] = [
  [-16.55, -4.0], [-16.55, 4.0], [8.0, -4.8], [8.0, 4.8], [-6.4, -29.35], [6.4, -29.35], [43.75, -32.0], [43.75, -12.8],
  [43.75, 12.8], [43.75, 32.0], [-43.75, -24.0], [-43.75, 24.0], [27.2, -15.75], [24.0, 15.2], [-20.0, 37.6], [12.0, 37.6]
];
/** Benches: x, z, quarter turns (the sitter faces local -z). */
const BENCHES: Spot[] = [[-14.4, 29.6, 2], [5.6, 28.2, 2], [14.4, 39.4, 0]];
const BINS: Spot[] = [[22.4, -15.68]];
const TREES: [number, number, TreeKind][] = [[-36.8, 30.4, 'oak'], [-19.2, 29.6, 'blossom'], [-1.6, 31.2, 'oak'], [19.2, 32.8, 'poplar'], [6.4, 24.0, 'birch']];
const BUSHES: Spot[] = [];
const CAFE: Spot[] = [[3.2, 14.4], [5.6, 12.4]];
const CONES: Spot[] = [[33.6, 20.0], [32.0, 16.8], [29.6, 37.6]];

/** Street furniture: lamps, benches, bins, trees, café tables and site cones, then the crane and the hanging washing. */
export function plazaProps(p: Plan) {
  for (const [x, z] of LAMPS) p.add(LAMP, { x, z, color: '#2f5a3a' });
  for (const [x, z, turns] of BENCHES) p.add(BENCH, { x, z, turns });
  for (const [x, z] of BINS) p.add(BIN, { x, z });
  for (const [x, z, kind] of TREES) p.add(TREE, { x, z, kind, size: 1.1 });
  for (const [x, z] of BUSHES) p.add(BUSH, { x, z, flowers: '#f3a6c3' });
  CAFE.forEach(([x, z], i) => p.add(CAFE_TABLE, { x, z, canopy: i % 2 ? '#c8231b' : '#2f8a3e' }));
  for (const [x, z] of CONES) p.add(CONE, { x, z });
  p.add(CRANE, {});
  p.add(DECOR, {});
}

/** Tower crane on the building site's south-east corner column; only the mast is solid, far out of reach. */
const MAST = { x: 29.8, z: 30.6, base: 6.4, top: 26.4, w: 1.2 } as const;
const CRANE: Element<object> = {
  colliders: () => [box([MAST.x - MAST.w / 2, MAST.base, MAST.z - MAST.w / 2], [MAST.x + MAST.w / 2, MAST.top + 1.6, MAST.z + MAST.w / 2], 'metal')],
  draw(d) {
    d.lasting(() => crane(new Pen(d, new Frame(MAST.x, 0, MAST.z, 0)), d.detail));
  }
};

function crane(t: Pen, detail: number) {
  const Y = '#f6c624';
  const h = MAST.w / 2 - 0.06;
  const { base, top } = MAST;
  for (const sx of [-h, h]) for (const sz of [-h, h]) t.box(sx, base, sz, 0.12, top - base, 0.12, Y, 'metal', 0);
  for (let y = base; y < top; y += 2.4) {
    for (const s of [-h, h]) {
      t.box(0, y, s, MAST.w, 0.08, 0.08, Y, 'metal', 0);
      t.box(s, y, 0, 0.08, 0.08, MAST.w, Y, 'metal', 0);
      if (detail > 0 && y + 2.4 <= top) {
        t.beam(-h, y, s, h, y + 2.4, s, 0.06, Y, 'metal');
        t.beam(s, y, -h, s, y + 2.4, h, 0.06, Y, 'metal');
      }
    }
  }
  // Slewing ring, cab, then the jib west over the frame and the counter-jib east over the roofs.
  t.box(0, top, 0, 1.6, 0.5, 1.6, '#2f363d', 'metal', 0.03);
  t.box(-1.1, top - 1.4, 0.4, 1.0, 1.3, 1.0, Y, 'metal', 0.04);
  t.box(-1.62, top - 1.2, 0.4, 0.04, 0.8, 0.8, '#8fb9cf', 'glass', 0);
  const jy = top + 0.5;
  const jib = -18.0;
  t.box(jib / 2, jy, -0.45, -jib, 0.1, 0.1, Y, 'metal', 0);
  t.box(jib / 2, jy, 0.45, -jib, 0.1, 0.1, Y, 'metal', 0);
  t.box(jib / 2 + 0.6, jy + 1.0, 0, -jib - 1.2, 0.1, 0.1, Y, 'metal', 0);
  for (let x = 0; x > jib; x -= 1.5) {
    t.box(x, jy, 0, 0.08, 0.08, 0.98, Y, 'metal', 0);
    if (detail > 0) for (const s of [-0.45, 0.45]) t.beam(x, jy, s, x - 0.75, jy + 1.0, 0, 0.05, Y, 'metal');
  }
  t.box(3.6, jy, 0, 7.2, 0.5, 1.0, Y, 'metal', 0.02);
  t.box(5.6, jy + 0.5, 0, 2.4, 1.6, 1.4, '#9a9fa3', undefined, 0.03);
  t.box(0, jy, 0, 0.9, 4.0, 0.9, Y, 'metal', 0.02);
  t.beam(0, jy + 4.0, 0, jib * 0.7, jy + 1.05, 0, 0.06, '#2f363d', 'metal');
  t.beam(0, jy + 4.0, 0, 6.8, jy + 0.5, 0, 0.06, '#2f363d', 'metal');
  // Trolley and hook with a pallet of bricks, well above anyone's head.
  const hx = -11.0;
  t.box(hx, jy - 0.3, 0, 1.0, 0.3, 0.9, '#2f363d', 'metal', 0.02);
  t.box(hx, 15.6, 0, 0.04, jy - 15.9, 0.04, '#2f363d', 'metal', 0);
  t.box(hx, 15.0, 0, 0.5, 0.6, 0.3, '#c8231b', 'metal', 0.03);
  t.box(hx, 13.4, 0, 1.4, 0.16, 1.2, '#a8774a', undefined, 0.01);
  t.box(hx, 13.56, 0, 1.2, 0.9, 1.0, '#b44a31', undefined, 0.02);
  for (const s of [-1, 1]) t.beam(hx, 15.0, 0, hx + s * 0.7, 14.46, 0, 0.03, '#2f363d', 'metal');
}

/** Things out of reach overhead: the station clock and the washing strung across Laundry Alley. */
const DECOR: Element<object> = {
  draw(d) {
    const t = new Pen(d, new Frame(0, 0, 0, 0));
    // Clock gable over the station cornice.
    const cy = 15.6;
    const [cx, cz] = [0, -29.9];
    t.box(cx, 14.3, cz, 3.6, 2.7, 0.6, '#efe5cf', undefined, 0.03);
    t.prism('clock-pediment', [[-2.0, 0], [2.0, 0], [0, 0.9]], 0.7, cx, 17.1, cz, '#c9b48a', undefined, Math.PI / 2);
    t.box(cx, 16.94, cz, 4.0, 0.16, 0.8, '#c9b48a', undefined, 0.02);
    t.cylZ(cx, cy, cz + 0.4, 1.15, 0.2, '#2f363d', 'metal', 0.04);
    t.cylZ(cx, cy, cz + 0.53, 1.0, 0.06, '#f4f0e4');
    t.box(cx, cy, cz + 0.58, 0.09, 0.75, 0.03, '#2f363d', undefined, 0);
    t.box(cx + 0.28, cy - 0.04, cz + 0.59, 0.6, 0.09, 0.03, '#2f363d', undefined, 0);
    const rng = new Rng(7);
    const colors = ['#f2f2ee', '#c8231b', '#1f62c7', '#f6c624', '#f3a6c3', '#5aa83f'];
    for (const z of [17.6, 20.8]) {
      t.box(-38.4, 5.6, z, 11.2, 0.02, 0.02, '#e7e1d2', undefined, 0);
      if (d.detail === 0) continue;
      for (let x = -43.2; x < -33.6; x += rng.range(0.5, 0.8)) t.box(x, 5.6 - 0.5, z, rng.range(0.3, 0.5), rng.range(0.4, 0.6), 0.02, rng.pick(colors), undefined, 0);
    }
  }
};

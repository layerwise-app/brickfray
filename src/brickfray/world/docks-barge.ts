import { WATER_Y } from './docks-parts';
import type { Element } from './plan';
import { frameOf, pen, type At } from './props-kit';
import { CONTAINER, CONTAINER_SIZE } from './props-harbor';
import { shade } from './util';

/** Gunwale height above the quay: out of reach of a jump from the quay and of a hop off the quay rail. */
const SIDE = 1.8;
const LEN = 9.6;
const BEAM = 4.4;
const HOLD = SIDE - 0.2;

export interface BargeParams extends At {
  hull: string;
  cargo: string;
}

/** Moored lighter with one container in its hold, 9.6 m along local x; its high sides break lines across the basin. */
export const BARGE: Element<BargeParams> = {
  colliders(p) {
    const f = frameOf(p);
    const { length: L, width: W, height: H } = CONTAINER_SIZE;
    return [f.box([-LEN / 2, WATER_Y - 1, -BEAM / 2], [LEN / 2, SIDE, BEAM / 2], 'metal'), f.box([-L / 2, HOLD, -W / 2], [L / 2, HOLD + H, W / 2], 'metal')];
  },
  draw(d, p) {
    const t = pen(d, p);
    const hull = p.hull;
    t.box(0, WATER_Y - 0.4, 0, LEN, SIDE - WATER_Y + 0.4 - 0.16, BEAM, hull, 'metal', 0.02);
    t.box(0, WATER_Y + 0.5, 0, LEN + 0.08, 0.3, BEAM + 0.08, '#1b1f23', 'rubber', 0.02);
    t.box(0, SIDE - 0.16, 0, LEN, 0.16, BEAM, shade(hull, 0.18), 'metal', 0.01);
    t.box(0, SIDE - 0.02, 0, LEN - 0.6, 0.03, BEAM - 0.6, '#3a3f45', 'metal', 0);
    for (const sx of [-1, 1]) t.box(sx * (LEN / 2 - 0.12), WATER_Y + 0.9, 0, 0.24, SIDE - WATER_Y - 1.06, BEAM - 0.4, shade(hull, -0.12), 'metal', 0);
    CONTAINER.draw(d, { x: p.x, z: p.z, y: HOLD, turns: p.turns, color: p.cargo });
    if (d.detail > 0) {
      for (const sz of [-1, 1]) {
        for (const x of [-3.6, -1.2, 1.2, 3.6]) t.box(x, WATER_Y + 0.65, sz * (BEAM / 2 + 0.01), 0.08, SIDE - WATER_Y - 0.85, 0.03, shade(hull, -0.14), 'metal', 0);
        t.box(0, SIDE - 0.42, sz * (BEAM / 2 + 0.01), LEN - 0.4, 0.1, 0.03, shade(hull, 0.12), 'metal', 0);
        for (const x of [-3.2, 0, 3.2]) t.ringUp(x, WATER_Y + 1.2, sz * (BEAM / 2 + 0.1), 0.3, 0.1, '#1b1f23', 'rubber');
        for (const x of [-4.2, 4.2]) t.cyl(x, SIDE, sz * (BEAM / 2 - 0.35), 0.14, 0.32, '#2f363d', 'metal');
      }
    }
    for (const sz of [-1, 1]) {
      const [ax, , az] = t.f.p(-LEN / 2, 0, sz * (BEAM / 2 + 0.02));
      const [bx, , bz] = t.f.p(LEN / 2, 0, sz * (BEAM / 2 + 0.02));
      d.anim.foam.edge(ax, az, bx, bz, WATER_Y, 0, sz, 0.7);
    }
  }
};

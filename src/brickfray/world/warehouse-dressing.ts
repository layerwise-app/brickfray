import { DECAL, VISUAL } from './blocks';
import type { Drawer, Plan } from './plan';
import { PALLET } from './props-harbor';
import { Pen } from './props-kit';
import { FORKLIFT } from './props-vehicles';
import { Frame } from './util';
import { END_DOOR, GALLERY, OFFICE, RACK, WH } from './warehouse';

const YELLOW = '#f6c624';
const WHITE = '#f2f2ee';
const LAMP_LIGHT = '#ffd59a';
const SIDE = WH.x1 - WH.wall;
const BACK = WH.z0 + WH.wall;
const MID = (END_DOOR[0] + END_DOOR[1]) / 2;

/**
 * Inside the hall: the siding rails run in through the end doors, racks stand against the
 * back wall (shelving, not cover), a pallet stack under each gallery stair is the stop between the end door and the
 * stair, a forklift parks against the back wall. Aisle lines run door to door round the office.
 */
export function warehouseDressing(p: Plan) {
  for (const s of [-1, 1] as const) {
    // One rack against the back wall with the forklift parked against its end: no gap a body could squeeze into, and
    // the rest of the back wall stays bare so the hall's sound box (audio/room-defs) still finds its wall.
    p.add(RACK, { x: s * 15.0, z: BACK + 0.55, length: 6.0, height: 3.0 });
    p.add(FORKLIFT, { x: s * 19.1, z: BACK + 0.62, turns: s < 0 ? 2 : 0, color: s < 0 ? '#f6c624' : '#f05a1a' });
    for (const load of ['sacks', 'boxes'] as const) p.add(PALLET, { x: s * (load === 'sacks' ? 14.2 : 15.4), z: GALLERY.z0 - 2.6, load });
  }
  const paint = (x0: number, z0: number, x1: number, z1: number, color: string) => p.add(DECAL, { x0, z0, x1, z1, y: 0.004, color, surface: 'stone', smooth: true });
  for (const z of [OFFICE.z0 - 1.2, OFFICE.z1 + 1.2]) paint(-SIDE + 1.2, z - 0.2, SIDE - 1.2, z + 0.2, YELLOW);

  for (const s of [-1, 1]) {
    const x = s > 0 ? SIDE - 0.4 : -SIDE;
    for (let z = END_DOOR[0]; z < END_DOOR[1] - 0.1; z += 0.8) paint(x, z, x + 0.4, z + 0.4, YELLOW);
  }
  p.add(VISUAL, (d) => {
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const s of [-1, 1]) {
      const x = s * (SIDE - 0.05);
      t.box(x, 5.7, MID, 0.1, 0.3, 0.9, '#1f9d55', 'glow', 0);
      t.box(x, 5.4, MID - 3.4, 0.08, 0.8, 1.6, s < 0 ? '#c0392b' : '#2f7fbf', undefined, 0);
      t.box(x, 5.4, MID + 3.4, 0.08, 0.8, 1.6, s < 0 ? '#c0392b' : '#2f7fbf', undefined, 0);
    }
    for (const x of [-12, -4, 4, 12]) t.box(x, 5.6, BACK + 0.03, 1.0, 1.4, 0.06, '#1f4f8f', undefined, 0.01);
    t.box(0, OFFICE.height + 0.2, OFFICE.z1 + 0.03, 2.4, 0.5, 0.06, WHITE, undefined, 0);
    ceiling(t, d);
    pools(d);
  });
}

function ceiling(t: Pen, d: Drawer) {
  const { x0, x1, wall, height: H } = WH;
  const finish = d.detail === 0 ? 'rubber' : 'metal';
  for (const z of [-60.0, -54.0, -48.0]) t.span(x0 + wall, H - 0.18, z - 0.05, x1 - wall, H, z + 0.05, '#4a5259', finish, 0);
  for (const x of [-18, -10, -2.4, 2.4, 10, 18]) {
    for (const z of [-57.0, -47.0]) {
      t.box(x, H - 0.05, z, 3.2, 0.04, 1.4, '#3a4046', finish, 0);
      t.box(x, H - 0.06, z, 3.0, 0.02, 1.2, '#e4edf2', 'glow', 0);
    }
  }
}

function pools(d: Drawer) {
  const k = d.detail === 0 ? 0.6 : 1;
  for (const x of [-16.0, -8.0, 8.0, 16.0]) for (const z of [-59.0, -50.0]) d.anim.pools.add(x, z, 0.012, 3.2, LAMP_LIGHT, 0.18 * k);
}

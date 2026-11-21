import { drawBlock, slab, STAIRS, type Masonry, type StairParams } from './blocks';
import type { Element } from './plan';
import { ARCADE } from './plaza-parts';
import { Pen } from './props-kit';
import { Frame } from './util';

const STEPS = 8;
const RISE = 0.48;
const RUN = 0.8;
const WIDTH = 2.4;
const CHEEK_W = 0.24;
const RISER: Masonry = { colors: ['#cf6a4a', '#c4553a', '#d97a58'], variance: 0.25 };
const TREAD = '#ead9b8';
const CHEEK = '#f2ede2';
const PLINTH = '#d9d2c1';
const COPING = '#cf6a4a';
const RAIL = '#2f363d';

const stair = (z0: number): StairParams => ({
  x: ARCADE.x0 - STEPS * RUN,
  z: z0 + WIDTH / 2,
  y0: 0,
  dir: 'e',
  width: WIDTH,
  steps: STEPS,
  rise: RISE,
  run: RUN,
  style: RISER,
  surface: 'plastic'
});

/**
 * Staircase from the road up to the arcade deck (`z0` is its north edge): brick risers and cream treads between
 * plastered cheek walls with a coping that follows the steps, newel posts at the foot and a handrail on slim
 * balusters. Colliders and nav are exactly the plain stair's; the railing is drawn only.
 */
export const ARCADE_STAIR: Element<{ z0: number }> = {
  colliders: (p) => STAIRS.colliders!(stair(p.z0)),
  nav: (p) => STAIRS.nav!(stair(p.z0)),
  draw(d, { z0 }) {
    const z1 = z0 + WIDTH;
    const x0 = ARCADE.x0 - STEPS * RUN;
    const sides = [z0 + CHEEK_W / 2, z1 - CHEEK_W / 2];
    for (let i = 0; i < STEPS; i++) {
      const a = x0 + i * RUN;
      const b = a + RUN;
      const top = (i + 1) * RISE;
      drawBlock(d, { min: [a, 0, z0 + CHEEK_W], max: [b, top, z1 - CHEEK_W], surface: 'plastic', style: RISER, faces: ['w'], top: 'tiles', topColor: TREAD });
      for (const [za, zb] of [[z0, z0 + CHEEK_W], [z1 - CHEEK_W, z1]] as const) {
        slab(d, [a, 0, za], [b, 0.24, zb], PLINTH);
        slab(d, [a, 0.24, za], [b, top - 0.12, zb], CHEEK);
        slab(d, [a, top - 0.12, za], [b, top, zb], COPING);
      }
    }
    const t = new Pen(d, new Frame(0, 0, 0));
    const hand = 0.92;
    for (const z of sides) {
      t.box(x0 + RUN / 2, 0, z, 0.3, RISE + hand + 0.1, 0.3, CHEEK, undefined, 0.03);
      t.ball(x0 + RUN / 2, RISE + hand + 0.22, z, 0.13, COPING);
      for (let i = 1; i < STEPS; i++) t.cyl(x0 + (i + 0.5) * RUN, (i + 1) * RISE, z, 0.045, hand, CHEEK, undefined, 0, 8);
      t.beam(x0 + RUN / 2, RISE + hand + 0.02, z, x0 + (STEPS - 0.5) * RUN, STEPS * RISE + hand + 0.02, z, 0.09, RAIL, 'metal');
    }
  }
};

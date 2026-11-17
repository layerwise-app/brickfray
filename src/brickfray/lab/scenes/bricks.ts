import * as THREE from 'three';
import { BrickBuilder } from '../../engine/bricks';
import { buildGround } from '../../engine/ground';
import { PLASTIC } from '../../engine/palette';
import type { LabContext } from '../types';

/** Engine smoke test: ground, every part shape and finish. */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  scene.add(
    buildGround(
      [
        { x0: -12, z0: -12, x1: 12, z1: 12, y: 0, color: PLASTIC.green },
        { x0: -2, z0: -12, x1: 2, z1: 12, y: 0.02, color: PLASTIC.darkGray, smooth: true },
        { x0: 4, z0: 4, x1: 8, z1: 8, y: 0.48, color: PLASTIC.tan }
      ],
      gr.profile
    )
  );
  const b = new BrickBuilder(gr.profile, gr.materials);
  const colors = [PLASTIC.red, PLASTIC.yellow, PLASTIC.blue, PLASTIC.white, PLASTIC.orange, PLASTIC.lime];
  let i = 0;
  for (let layer = 0; layer < 6; layer++) {
    for (let x = 0; x < 4; x++) {
      b.grid({ w: 2, d: 1, h: 3 }, -10 + x * 2 + (layer % 2), layer * 3, -6, { color: colors[i++ % colors.length]! });
    }
  }
  b.grid({ w: 2, d: 3, h: 3, shape: 'slope' }, -4, 0, -6, { color: PLASTIC.red });
  b.grid({ w: 2, d: 3, h: 3, shape: 'inverted-slope' }, -4, 3, -6, { color: PLASTIC.red });
  b.grid({ w: 2, d: 2, h: 3, shape: 'round' }, -1, 0, -8, { color: PLASTIC.azure });
  b.grid({ w: 2, d: 2, h: 6, shape: 'cone' }, 1, 0, -8, { color: PLASTIC.green });
  b.grid({ w: 4, d: 2, h: 1 }, 3, 0, -8, { color: PLASTIC.glass, finish: 'glass' });
  b.grid({ w: 2, d: 2, h: 3 }, 6, 0, -8, { color: PLASTIC.silver, finish: 'metal' });
  b.grid({ w: 2, d: 2, h: 3 }, 8, 0, -8, { color: PLASTIC.pearlGold, finish: 'chrome' });
  b.grid({ w: 1, d: 1, h: 3 }, 10, 0, -8, { color: PLASTIC.orange, finish: 'glow' });
  scene.add(b.build());
  ctx.camera.position.set(2, 3.2, 3);
  ctx.controls.target.set(-2, 0.8, -6);
  return { api: { info: () => ({ parts: i }) } };
}

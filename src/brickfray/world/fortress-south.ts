import { F, type Works } from './fortress-plan';

const H = F.curtain;
const S = F.storey;

/**
 * South: the gatehouse between the outer bailey and the barbican (team 0 spawns), a screen wall the gate passage looks
 * onto, the west sally to the stable yard and the east gate to the lists along the meadow.
 */
export function south(w: Works) {
  w.box('curtain', F.core0, 0, F.bandS, GH.x0, H, F.gate);
  w.box('curtain', GH.x1, 0, F.bandS, 10.4, H, F.gate);
  w.box('curtain', 10.4, 0, F.bandS, F.terrace, H, 29.6);
  w.box('curtain', -28.0, 0, F.gate, -25.6, H, F.barbican);
  w.run('curtain', false, F.gate, F.barbican, 8.0, 10.4, 0, H, [[36.8, 39.2, F.door]]);
  gatehouse(w);
  w.box('screen', -9.6, 0, 38.4, -1.6, 2.88, 39.2);
  w.box('screen', 4.0, 0, 36.8, 4.8, 2.88, 41.6);
}

/** Gatehouse footprint and its passage. */
export const GH = { x0: -14.4, x1: 3.2, z0: F.bandS, z1: F.gate, p0: -7.2, p1: -4.0, vault: 3.36, roof: 7.2 } as const;

/**
 * Gatehouse: the passage under a vault; the west tower holds a turning stair from a door on the bailey side up to the
 * gate room, which looks over the bailey through two windows; an open stair climbs from the barbican to its south door.
 */
function gatehouse(w: Works) {
  const { x0, x1, z0, z1, p0, p1, vault, roof } = GH;
  w.windows('tower', true, x0, x1, z0, z0 + 0.8, 0, S, [[-11.2, -9.6, 0, F.door], [p0, p1, 0, vault]]);
  w.windows('tower', true, x0, x1, z0, z0 + 0.8, S, roof, [[-6.0, -5.2, 4.8, 6.0], [-0.4, 0.4, 4.8, 6.0]]);
  w.windows('tower', true, x0, x1, z1 - 0.8, z1, 0, S, [[p0, p1, 0, vault]]);
  w.windows('tower', true, x0, x1, z1 - 0.8, z1, S, roof, [[-2.4, -0.8, S, 6.72]]);
  w.box('tower', x0, 0, z0 + 0.8, x0 + 0.8, roof, z1 - 0.8);
  w.box('tower', x1 - 0.8, 0, z0 + 0.8, x1, roof, z1 - 0.8);
  w.box('tower', p0 - 0.8, 0, z0 + 0.8, p0, S, z1 - 0.8, { walk: true });
  w.box('slab', p0, vault, z0 + 0.8, p1, S, z1 - 0.8, { walk: true });
  w.box('tower', p1, 0, z0 + 0.8, x1 - 0.8, S, z1 - 0.8, { walk: true });
  w.uStair(-9.6, 28.8, 's', 4, 'tower');
  w.box('parapet', -9.6, S, 28.8, -9.4, S + F.rail, z1 - 0.8, { bulletsPass: true });
  for (const x of [-12.0, -10.4, -8.8]) w.seed(x, S, 28.4);
  w.box('tower', x0 + 0.8, 0, z0 + 0.8, -12.8, S + F.rail, z1 - 0.8);
  w.box('block', -9.6, 0, 28.8, p0 - 0.8, S, z1 - 0.8, { walk: true });
  w.box('slab', x0 + 0.8, vault, z0 + 0.8, p0 - 0.8, S, 28.8, { walk: true });
  w.box('slab', x0, roof, z0, x1, roof + 0.48, z1);
  w.box('block', -3.2, 0, z1, 0.0, S, z1 + 1.6, { walk: true });
  w.stairs({ x: 6.4, z: z1 + 0.8, y0: 0, dir: 'w', width: 1.6, steps: 8 });
  w.box('wall', -4.0, 0, z1 + 1.6, 6.4, S + 1.92, z1 + 2.4);
  w.box('wall', -4.0, 0, z1, -3.2, S + 1.92, z1 + 1.6);
}

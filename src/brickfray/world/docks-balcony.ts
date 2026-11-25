import type { StairParams } from './blocks';
import { BLOCK2_S, QUAY, STACK_H } from './docks-layout';
import type { Element } from './plan';
import { Pen } from './props-kit';
import { box, Frame, shade, type PlanCollider } from './util';
import { METAL_STAIRS } from './warehouse';

/**
 * The quay catwalk (raised place R3, one per side): a lashing walkway on the first container tier along blocks 2s/2x's
 * quay face, |x| 30..36.8, with a stair down at each end along the stack (the east one lands at the alley's quay mouth).
 * It watches its own quay and the bend over a 1 m parapet; the ship's deck, the bend, the truck and the alley mouth
 * answer it. (On the customs' yard-road face it pulled every fight into the mid lane: TDM mid 76%.)
 */
export const BALCONY_AT = { x0: BLOCK2_S.x0 + 1.2, x1: 36.8, depth: 1.8, y: STACK_H, parapet: 1.0, steps: 6, run: 4.0 / 6 } as const;

const B = BALCONY_AT;
const RAIL = 0.6;
const Z0 = QUAY.z0;
const Z1 = QUAY.z0 + B.depth;

function stairs(s: -1 | 1): StairParams[] {
  const len = B.steps * B.run;
  const base = { z: (Z0 + Z1) / 2, y0: 0, width: B.depth, steps: B.steps, rise: B.y / B.steps, run: B.run, style: { colors: ['#8a9096'], variance: 0 }, surface: 'metal' as const };
  return [
    { ...base, x: s * (B.x0 - len), dir: s < 0 ? 'w' : 'e' },
    { ...base, x: s * (B.x1 + len), dir: s < 0 ? 'e' : 'w' }
  ];
}

export const BALCONY: Element<{ s: -1 | 1; wall: string }> = {
  colliders(p) {
    const [xa, xb] = p.s < 0 ? [-B.x1, -B.x0] : [B.x0, B.x1];
    const out: PlanCollider[] = [
      box([xa, B.y - 0.2, Z0], [xb, B.y, Z1], 'metal', { walk: true }),
      box([xa, B.y, Z1 - 0.12], [xb, B.y + B.parapet, Z1], 'metal'),
      // The handrail on the parapet: see-through, and high enough that nobody stands on the parapet.
      box([xa, B.y + B.parapet, Z1 - 0.12], [xb, B.y + B.parapet + RAIL, Z1], 'metal', { bulletsPass: true })
    ];
    for (const st of stairs(p.s)) out.push(...METAL_STAIRS.colliders!(st));
    return out;
  },
  nav: (p) => stairs(p.s).flatMap((st) => METAL_STAIRS.nav!(st)),
  draw(d, p) {
    const t = new Pen(d, new Frame(0, 0, 0));
    const [xa, xb] = p.s < 0 ? [-B.x1, -B.x0] : [B.x0, B.x1];
    const team = p.s < 0 ? '#c0392b' : '#2f7fbf';
    t.span(xa, B.y - 0.2, Z0, xb, B.y, Z1, '#6d767f', 'metal', 0);
    t.span(xa, B.y - 0.01, Z0 + 0.05, xb, B.y + 0.005, Z1 - 0.12, '#8a9096', 'metal', 0);
    // Parapet: steel sheet, a cap and the team's stripe.
    t.span(xa, B.y, Z1 - 0.12, xb, B.y + B.parapet - 0.06, Z1, shade(p.wall, -0.25), 'metal', 0);
    t.span(xa - 0.02, B.y + B.parapet - 0.06, Z1 - 0.15, xb + 0.02, B.y + B.parapet, Z1 + 0.02, '#e9e6dc', 'metal', 0);
    t.span(xa, B.y + 0.45, Z1 - 0.005, xb, B.y + 0.6, Z1 + 0.005, team, undefined, 0);
    const posts = Math.round((xb - xa) / (d.detail > 0 ? 1.1 : 2.2));
    for (let i = 0; i <= posts; i++) t.box(xa + ((xb - xa) * i) / posts, B.y + B.parapet, Z1 - 0.06, 0.05, RAIL, 0.05, '#545c63', 'metal', 0);
    t.span(xa, B.y + B.parapet + RAIL - 0.05, Z1 - 0.09, xb, B.y + B.parapet + RAIL, Z1 - 0.03, '#f6c624', 'metal', 0);
    // Cantilever brackets from the stack (above head height: the strip under the walkway stays open).
    const n = Math.round((xb - xa) / 2.2);
    for (let i = 0; i <= n; i++) {
      const x = xa + ((xb - xa) * i) / n;
      t.beam(x, B.y - 0.6, Z0 + 0.02, x, B.y - 0.2, Z1 - 0.1, 0.07, '#3a4046', 'metal');
    }
    for (const st of stairs(p.s)) METAL_STAIRS.draw(d, st);
  }
};

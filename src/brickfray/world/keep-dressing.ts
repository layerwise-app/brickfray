import { BLUE, RED } from './fortress-dressing';
import { K } from './keep';
import type { Drawer, Element } from './plan';
import { BANNER, FLAGPOLE, TORCH } from './props-castle';
import { Pen } from './props-kit';
import { Frame } from './util';

const CORBEL = '#b3ab98';
const MERLON = ['#d3ccbb', '#c4bdab', '#ddd7c8'];
const SLIT = '#1b1d20';
const DRESSED = '#d8cfba';

/** Four faces of the keep tower, local +z out of each face, origin at the face's middle. */
const FACES = [new Frame(0, 0, K.half, 0), new Frame(0, 0, -K.half, 2), new Frame(K.half, 0, 0, 1), new Frame(-K.half, 0, 0, 3)];

/**
 * The keep's look: a corbelled parapet and merlons round its top, arrow slits and a banner on each face above the rock,
 * fireplaces in all four sides of the hearth column, torches by the inner doors. Nothing here collides except the
 * flagpoles on the roof, which nobody reaches.
 */
export const KEEP_DRESSING: Element<Record<string, never>> = {
  colliders: () => [...FLAGS.flatMap((f) => FLAGPOLE.colliders!(f))],
  draw(d) {
    for (const [i, f] of FACES.entries()) face(d, f, i);
    for (const f of FLAGS) FLAGPOLE.draw(d, f);
    hearthColumn(d);
  }
};

/** On the two corners the ambience already uses for flag sounds (audio/scenery.ts KEEP_FLAGS). */
const FLAGS = [
  { x: K.half - 0.4, y: K.top, z: K.half - 0.4, colors: BLUE, height: 4.0, pattern: 'chevron' as const },
  { x: -K.half + 0.4, y: K.top, z: -K.half + 0.4, colors: RED, height: 4.0, pattern: 'chevron' as const }
];

function face(d: Drawer, f: Frame, i: number) {
  const t = new Pen(d, f);
  const w = K.half * 2;
  t.box(0, K.top - 0.5, 0.12, w + 0.64, 0.5, 0.3, CORBEL, undefined, 0.03);
  if (d.detail > 0) for (let u = -K.half + 0.4; u <= K.half - 0.3; u += 0.8) t.box(u, K.top - 0.9, 0.08, 0.32, 0.4, 0.16, CORBEL, undefined, 0.02);
  for (let k = 0, u = -K.half + 0.4; u <= K.half - 0.3; u += 1.6, k++) t.box(u, K.top, 0.08, 0.8, 0.96, 0.48, MERLON[k % 3]!, undefined, 0.03);
  for (const u of [-3.2, 3.2]) {
    t.box(u, 7.8, 0.02, 0.24, 1.2, 0.06, SLIT, undefined, 0);
    t.box(u, 7.66, 0.06, 0.6, 0.14, 0.14, DRESSED, undefined, 0.02);
  }
  BANNER.draw(d, { x: f.p(0, 0, 0)[0], z: f.p(0, 0, 0)[2], y: 10.2, turns: f.turns, colors: i % 2 ? RED : BLUE, width: 1.6, height: 3.2, pattern: 'border' });
  // Inside: torches flanking each door (the door is off-centre on every side).
  const inner = new Frame(f.p(0, 0, -K.wall)[0], 0, f.p(0, 0, -K.wall)[2], f.turns + 2);
  const door = [K.doorS, K.doorN, K.doorE, K.doorW][i]!;
  const mid = (door[0] + door[1]) / 2;
  const u = i === 0 || i === 3 ? -mid : mid;
  for (const s of [-1, 1]) TORCH.draw(d, { x: inner.p(u + s * 1.75, 0, 0)[0], z: inner.p(u + s * 1.75, 0, 0)[2], y: 2.3, turns: inner.turns });
}

function hearthColumn(d: Drawer) {
  const c = K.column;
  for (const f of [new Frame(0, 0, c, 0), new Frame(0, 0, -c, 2), new Frame(c, 0, 0, 1), new Frame(-c, 0, 0, 3)]) {
    const t = new Pen(d, f);
    t.box(0, 0, 0.01, 1.6, 1.2, 0.05, '#231c18', undefined, 0);
    for (const s of [-1, 1]) t.box(s * 0.96, 0, 0.08, 0.32, 1.32, 0.2, DRESSED, undefined, 0.03);
    t.box(0, 1.2, 0.1, 2.4, 0.26, 0.26, DRESSED, undefined, 0.03);
    t.cylX(-0.55, 0.14, 0.2, 0.1, 1.1, '#5e3f27', undefined, 0.02);
    d.anim.flame(f.p(0, 0.32, 0.26));
    const [x, , z] = f.p(0, 0, 1.2);
    d.anim.pools.add(x, z, 0.006, 2.4, '#ffb060', 0.45);
  }
}

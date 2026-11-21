import { slab } from './blocks';
import { mountainRange } from './mountains';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { T } from './temple-layout';
import { Frame, mix, Rng } from './util';

const HAZE = '#d9ead2';
const CANOPY = ['#2f7a34', '#3f8f3a', '#246b35', '#4f9a3e', '#1f5a32'];
const PLATEAU = '#4f8a3a';

/** Jungle around the temple: a wooded plateau over the cliffs, waterfalls into the streams, far temple towers and hills. */
export function templeBackdrop(d: Drawer) {
  const top = T.cliffTop;
  slab(d, [-160, -2, -160], [160, top - 0.2, -34.4], PLATEAU);
  slab(d, [-160, -2, 34.4], [160, top - 0.2, 160], PLATEAU);
  slab(d, [-160, -2, -34.4], [-38.4, top - 0.2, 34.4], PLATEAU);
  slab(d, [38.4, -2, -34.4], [160, top - 0.2, 34.4], PLATEAU);
  jungle(d);
  for (const s of [-1, 1]) waterfall(d, s * -32.8, s * -30.4, s);
  towers(d);
  mountainRange(d, { count: 12, dist: [95, 135], radius: [24, 40], height: [14, 26], haze: HAZE, seed: 19, rock: ['#5f8a4a'], slope: '#6f9a4a', forest: '#2f6a3a', green: true });
}

/** Broad-leaf canopy trees: a ring hugging the cliff edges, then a deep band behind. */
function jungle(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(41);
  const y = T.cliffTop - 0.2;
  const tree = (x: number, z: number, s: number, fade: number) => {
    const c = mix(rng.pick(CANOPY), HAZE, fade);
    t.cyl(x, y, z, 0.35 * s, 3.4 * s, mix('#6e4a2f', HAZE, fade), undefined, 0, 6);
    t.ball(x, y + 3.6 * s, z, 2.2 * s, c, [1.25, 0.55, 1.25], 0.2, rng.int(1, 5));
    if (d.detail > 0) t.ball(x + rng.range(-1, 1) * s, y + 4.6 * s, z + rng.range(-1, 1) * s, 1.4 * s, mix(rng.pick(CANOPY), HAZE, fade), [1.2, 0.6, 1.2], 0.2, rng.int(1, 5));
  };
  const edge = d.detail === 0 ? 4.8 : 3.2;
  for (let x = -36; x <= 36; x += edge) {
    for (const z of [-36.4, 36.4]) tree(x + rng.range(-0.8, 0.8), z + rng.range(-1, 1.5) * Math.sign(z), rng.range(0.9, 1.4), 0);
  }
  for (let z = -30; z <= 30; z += edge) {
    for (const x of [-40.4, 40.4]) tree(x + rng.range(-1, 1.5) * Math.sign(x), z + rng.range(-0.8, 0.8), rng.range(0.9, 1.4), 0);
  }
  const n = d.detail === 0 ? 45 : 90;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(46, 80);
    tree(Math.cos(a) * r, Math.sin(a) * r, rng.range(1.2, 2.2), Math.min(0.55, (r - 40) / 80));
  }
}

/** Water falling from the cliff into a stream, with churning foam where it lands. */
function waterfall(d: Drawer, x: number, z: number, s: number) {
  const y0 = T.water;
  const y1 = T.cliffTop;
  const w = 2.4;
  const [a, b] = [z + s * 0.05, z + s * 0.6].sort((p, q) => p - q) as [number, number];
  slab(d, [x - w / 2, y0, a], [x + w / 2, y1, b], '#bfe8f0', 'glass');
  const [c, e] = [z - s * 1.2, z + s * 0.7].sort((p, q) => p - q) as [number, number];
  slab(d, [x - w / 2 - 0.2, y1 - 0.3, c], [x + w / 2 + 0.2, y1 + 0.02, e], '#d8f2f6', 'glass');
  if (d.detail > 0) {
    const t = new Pen(d, new Frame(x, 0, z));
    for (const dx of [-0.8, -0.25, 0.35, 0.9]) t.box(dx, y0, s * 0.4, 0.14, y1 - y0 - 0.4, 0.3, '#f4fbfc', undefined, 0);
  }
  d.anim.foam.ring(x, z + s * 1.0, y0, 0.9, 1.4, d.detail === 0 ? 8 : 14);
}

/** Far temple towers: stepped corncob prangs rising out of the canopy. */
function towers(d: Drawer) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(77);
  const spots: [number, number][] = [[-0.6, 105], [0.35, 120], [2.2, 98], [2.9, 125], [4.3, 110], [5.4, 92]];
  for (const [a, r] of spots) {
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const fade = Math.min(0.6, (r - 40) / 110);
    const stone = mix(rng.pick(['#9fb3a0', '#b8b49a', '#8fa394']), HAZE, fade);
    const gold = mix('#e0b040', HAZE, fade);
    const base = rng.range(14, 20);
    let y = T.cliffTop - 2;
    let w = base;
    for (let k = 0; k < 5; k++) {
      const h = w * 0.32;
      t.box(x, y, z, w, h, w, stone, undefined, 0);
      y += h;
      w *= 0.74;
    }
    t.cone(x, y, z, w * 0.6, 0.2, w * 2.2, stone, undefined, 8);
    t.cone(x, y + w * 2.2, z, 0.3, 0.02, w * 0.9, gold, undefined, 6);
  }
}

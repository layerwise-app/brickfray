import type { Drawer } from './plan';
import type { Layout, Piece } from './plaza-layout';
import { HALL, TOWER } from './plaza-middle';
import { STATION } from './plaza-north';
import { Pen } from './props-kit';
import { Frame } from './util';

const LAMP_LIGHT = '#ffd59a';
const BULB = '#fff3c4';
const IRON = '#2f5a3a';
const OAK = '#7a4a2a';
const PLASTER = '#e3d6bc';

/** What hangs under the roofs of the rooms people fight in: trusses, beams and lamps, with the light they throw. */
export function plazaInteriors(d: Drawer, L: Layout) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const k = d.detail === 0 ? 0.6 : 1;
  hall(t, d, k);
  station(t, d, k);
  townHall(t, d, k);
  for (const c of L.pieces) if (c.kind === 'ceiling' && c.min[1] < 4 && ['bakery', 'laundrette', 'florist'].includes(c.tag ?? '')) shop(t, d, k, c);
}

/** Market hall: green iron trusses across the hall, purlins over the columns, enamel pendants over the stalls. */
function hall(t: Pen, d: Drawer, k: number) {
  const { x0, x1, z0, z1, wall: w, top } = HALL;
  const za = z0 + w;
  const zb = z1 - w;
  const lo = top - 0.75;
  const hi = top - 0.12;
  const finish = d.detail === 0 ? undefined : 'metal';
  for (const x of [-40.0, -36.0, -32.0, -28.0, -24.0, -20.0]) {
    t.span(x - 0.08, lo, za, x + 0.08, lo + 0.18, zb, IRON, finish, 0);
    t.span(x - 0.08, hi - 0.14, za, x + 0.08, hi, zb, IRON, finish, 0);
    if (d.detail === 0) continue;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = za + ((zb - za) * i) / n;
      const b = za + ((zb - za) * (i + 1)) / n;
      t.beam(x, i % 2 ? hi - 0.07 : lo + 0.09, a, x, i % 2 ? lo + 0.09 : hi - 0.07, b, 0.08, IRON, finish);
    }
  }
  for (const z of [-4.8, 4.8]) t.span(x0 + w, lo - 0.22, z - 0.1, x1 - w, lo, z + 0.1, IRON, finish, 0);
  for (const x of [-40.0, -32.0, -24.0]) for (const z of [-6.4, 0, 6.4]) pendant(t, d, x, lo, z, 4.9, k, [x0 + w, za, x1 - w, zb]);
}

/** Enamel shade on a cord, a glowing bulb under it and its pool on the floor. */
function pendant(t: Pen, d: Drawer, x: number, from: number, z: number, at: number, k: number, clip: [number, number, number, number]) {
  t.box(x, at + 0.3, z, 0.03, from - at - 0.3, 0.03, '#23282d', undefined, 0);
  t.cone(x, at, z, 0.42, 0.1, 0.3, IRON, undefined, d.detail === 0 ? 6 : 10);
  t.ball(x, at - 0.02, z, 0.13, BULB, [1, 0.8, 1], 0, 1, 'glow');
  d.anim.pools.add(x, z, 0.012, 3.4, LAMP_LIGHT, 0.2 * k, clip);
}

/** Station concourse: plaster beams across the hall and globe lamps on rods along it. */
function station(t: Pen, d: Drawer, k: number) {
  const { x0, x1, z0, z1, wall: w, top } = STATION;
  const za = z0 + w;
  const zb = z1 - w;
  for (const x of [-8.4, -6.0, -3.6, -1.2, 1.2, 3.6, 6.0, 8.4]) t.span(x - 0.15, top - 0.36, za, x + 0.15, top, zb, PLASTER, undefined, 0.02);
  t.span(x0 + w, top - 0.3, za - 0.01, x1 - w, top, za + 0.25, PLASTER, undefined, 0.02);
  t.span(x0 + w, top - 0.3, zb - 0.25, x1 - w, top, zb + 0.01, PLASTER, undefined, 0.02);
  const mid = (za + zb) / 2;
  for (const x of [-7.2, -2.4, 2.4, 7.2]) {
    t.box(x, 4.7, mid, 0.05, top - 4.7, 0.05, '#2f363d', 'metal', 0);
    t.ball(x, 4.5, mid, 0.26, BULB, undefined, 0, 1, 'glow');
    d.anim.pools.add(x, mid, 0.012, 3.6, LAMP_LIGHT, 0.2 * k, [x0 + w, za, x1 - w, zb]);
  }
}

/** Town hall: an oak-beamed coffered ceiling on the columns and three brass chandeliers down the middle. */
function townHall(t: Pen, d: Drawer, k: number) {
  const { x0, x1, hall: h, wall: w, ceiling: top } = TOWER;
  const xa = x0 + w;
  const xb = x1 - w;
  for (const z of [-4.8, 0, 4.8]) t.span(xa, top - 0.4, z - 0.16, xb, top, z + 0.16, OAK, undefined, 0.02);
  for (const x of [18.8, 23.2]) t.span(x - 0.18, top - 0.44, -h + w, x + 0.18, top, h - w, OAK, undefined, 0.02);
  for (const z of [-7.2, 0, 7.2]) {
    const x = 21.0;
    t.box(x, 4.9, z, 0.04, top - 4.9, 0.04, '#c99a3e', 'chrome', 0);
    t.ring(x, 4.9, z, 0.5, 0.04, '#c99a3e', 'chrome');
    if (d.detail > 0) for (let i = 0; i < 6; i++) t.ball(x + 0.5 * Math.cos((i * Math.PI) / 3), 5.0, z + 0.5 * Math.sin((i * Math.PI) / 3), 0.07, BULB, [1, 1.4, 1], 0, 1, 'glow');
    else t.ball(x, 4.95, z, 0.18, BULB, undefined, 0, 1, 'glow');
    d.anim.pools.add(x, z, 0.012, 3.4, LAMP_LIGHT, 0.2 * k, [xa, -h + w, xb, h - w]);
  }
}

/** Shops: timber joists under the low ceiling and one lamp panel over the middle. */
function shop(t: Pen, d: Drawer, k: number, { min, max }: Piece) {
  const top = min[1];
  const xa = min[0] + 0.8;
  const xb = max[0] - 0.8;
  const za = min[2] + 0.8;
  const zb = max[2] - 0.8;
  for (let x = xa + 1.2; x < xb - 0.6; x += 1.6) t.span(x - 0.08, top - 0.22, za, x + 0.08, top, zb, '#a8774a', undefined, 0.01);
  const cx = (xa + xb) / 2;
  const cz = (za + zb) / 2;
  t.box(cx, top - 0.28, cz, 1.2, 0.06, 0.5, '#e9e6dc', undefined, 0);
  t.box(cx, top - 0.3, cz, 1.0, 0.02, 0.36, BULB, 'glow', 0);
  d.anim.pools.add(cx, cz, 0.012, 3.2, LAMP_LIGHT, 0.16 * k, [xa, za, xb, zb]);
}

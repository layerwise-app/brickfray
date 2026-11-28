import type { Drawer } from './plan';
import type { Layout, Piece } from './plaza-layout';
import { TOWER } from './plaza-middle';
import { Pen } from './props-kit';
import { Frame } from './util';

const LAMP_LIGHT = '#ffd59a';
const BULB = '#fff3c4';
const IRON = '#2f5a3a';
const OAK = '#7a4a2a';

/** What hangs under the roofs of the rooms people fight in: trusses, beams and lamps, with the light they throw. */
export function plazaInteriors(d: Drawer, L: Layout) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const k = d.detail === 0 ? 0.6 : 1;
  for (const r of L.pieces) if (r.kind === 'roof' && (r.tag === 'hall' || r.tag === 'station')) hall(t, d, k, r);
  townHall(t, d, k);
  for (const c of L.pieces) if (c.kind === 'ceiling' && c.min[1] < 4 && ['bakery', 'laundrette'].includes(c.tag ?? '')) shop(t, d, k, c);
}

/** Market hall: green iron trusses across it and enamel pendants; the station: white trusses and globe lamps. */
function hall(t: Pen, d: Drawer, k: number, r: Piece) {
  const [x0, top, z0] = r.min;
  const [x1, , z1] = r.max;
  const w = 0.8;
  const za = z0 + w;
  const zb = z1 - w;
  const lo = top - 0.75;
  const hi = top - 0.12;
  const station = r.tag === 'station';
  const color = station ? '#e7e1d2' : IRON;
  const finish = d.detail === 0 || station ? undefined : 'metal';
  for (let x = x0 + 2.4; x < x1 - 1.6; x += 3.2) {
    t.span(x - 0.08, lo, za, x + 0.08, lo + 0.18, zb, color, finish, 0);
    t.span(x - 0.08, hi - 0.14, za, x + 0.08, hi, zb, color, finish, 0);
    if (d.detail === 0) continue;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = za + ((zb - za) * i) / n;
      const b = za + ((zb - za) * (i + 1)) / n;
      t.beam(x, i % 2 ? hi - 0.07 : lo + 0.09, a, x, i % 2 ? lo + 0.09 : hi - 0.07, b, 0.08, color, finish);
    }
  }
  const clip: [number, number, number, number] = [x0 + w, za, x1 - w, zb];
  for (let x = x0 + 3.2; x < x1 - 1.6; x += 5.6) for (const z of [za + 2.6, zb - 2.6]) {
    t.box(x, 4.9 + 0.3, z, 0.03, lo - 5.2, 0.03, '#23282d', undefined, 0);
    if (station) t.ball(x, 4.9, z, 0.26, BULB, undefined, 0, 1, 'glow');
    else {
      t.cone(x, 4.9, z, 0.42, 0.1, 0.3, IRON, undefined, d.detail === 0 ? 6 : 10);
      t.ball(x, 4.88, z, 0.13, BULB, [1, 0.8, 1], 0, 1, 'glow');
    }
    d.anim.pools.add(x, z, 0.012, 3.4, LAMP_LIGHT, 0.2 * k, clip);
  }
}

/** Council hall: oak beams across the ceiling and three brass chandeliers down the middle. */
function townHall(t: Pen, d: Drawer, k: number) {
  const { x0, x1, z0, z1, wall: w, ceiling: top } = TOWER;
  const xa = x0 + w;
  const xb = x1 - w;
  const za = z0 + w;
  const zb = z1 - w;
  for (const z of [-8.0, -3.2, 1.6]) t.span(xa, top - 0.4, z - 0.16, xb, top, z + 0.16, OAK, undefined, 0.02);
  for (const x of [-4.8, 4.8]) t.span(x - 0.18, top - 0.44, za, x + 0.18, top, zb, OAK, undefined, 0.02);
  for (const z of [-7.2, -0.8]) {
    t.box(0, 4.9, z, 0.04, top - 4.9, 0.04, '#c99a3e', 'chrome', 0);
    t.ring(0, 4.9, z, 0.5, 0.04, '#c99a3e', 'chrome');
    if (d.detail > 0) for (let i = 0; i < 6; i++) t.ball(0.5 * Math.cos((i * Math.PI) / 3), 5.0, z + 0.5 * Math.sin((i * Math.PI) / 3), 0.07, BULB, [1, 1.4, 1], 0, 1, 'glow');
    else t.ball(0, 4.95, z, 0.18, BULB, undefined, 0, 1, 'glow');
    d.anim.pools.add(0, z, 0.012, 3.4, LAMP_LIGHT, 0.2 * k, [xa, za, xb, zb]);
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

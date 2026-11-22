import { DECAL, VISUAL } from './blocks';
import { cornerMarks } from './docks-ground';
import type { Drawer, Plan } from './plan';
import { Pen } from './props-kit';
import { Frame } from './util';
import { WH } from './warehouse';

const YELLOW = '#f6c624';
const WHITE = '#f2f2ee';
const LAMP_LIGHT = '#ffd59a';
const BACK = WH.z0 + WH.wall;
const SIDE = WH.x1 - WH.wall;
const SEGMENTS: Record<number, string> = { 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc' };

/** Warehouse dressing: floor markings, bay boards, exit signs, hazard bands, roof purlins, skylights and lamp pools. */
export function warehouseDressing(p: Plan) {
  const paint = (x0: number, z0: number, x1: number, z1: number, color: string) =>
    p.add(DECAL, { x0, z0, x1, z1, y: 0.004, color, surface: 'stone', smooth: true });
  paint(-SIDE, -20.0, SIDE, -19.6, YELLOW);
  paint(-SIDE, -16.8, SIDE, -16.4, YELLOW);
  for (const s of [-1, 1]) {
    for (const [a, b] of [[1.2, 5.2], [6.4, 13.6]] as const) paint(s > 0 ? a : -b, -26.0, s > 0 ? b : -a, -25.6, YELLOW);
    cornerMarks(paint, s > 0 ? 2.0 : -4.4, -23.6, s > 0 ? 4.4 : -2.0, -21.2, 0.8, WHITE);
    for (let i = 0; i < 3; i++) {
      const x = s > 0 ? 3.6 + i * 0.8 : -5.6 + i * 0.8;
      paint(x, -25.2, x + 0.4, -23.6, YELLOW);
    }
    paint(s > 0 ? 11.6 : -13.6, -16.0, s > 0 ? 13.6 : -11.6, -14.8, '#3c4044');
  }
  p.add(VISUAL, (d) => {
    const t = new Pen(d, new Frame(0, 0, 0));
    for (const [i, x] of [-10, -3.2, 3.2, 10].entries()) bayBoard(t, x, i + 1);
    for (const s of [-1, 1]) {
      const x = s * (SIDE - 0.05);
      t.box(x, 4.55, -17.8, 0.1, 0.3, 0.9, '#1f9d55', 'glow', 0);
      t.box(x - s * 0.055, 4.66, -17.8, 0.02, 0.08, 0.5, '#effff4', 'glow', 0);
      t.box(s * (SIDE - 0.04), 1.6, -21.2, 0.08, 0.36, 0.3, '#c8231b', undefined, 0);
      t.cyl(s * (SIDE - 0.14), 0.9, -21.2, 0.09, 0.5, '#c8231b', 'metal', 0.02, 8);
    }
    hazardPosts(t);
    doorSigns(d);
    ceiling(t, d);
    pools(d);
  });
}

function bayBoard(t: Pen, x: number, n: number) {
  t.box(x, 4.2, BACK + 0.03, 1.0, 1.4, 0.06, '#1f4f8f', undefined, 0.01);
  digit(t, x, 4.45, BACK + 0.07, 0.9, n);
}

/** Door numbers outside, in each half's yard colour (1 west, 2 east): over the yard door and over the end door. */
function doorSigns(d: Drawer) {
  for (const s of [-1, 1]) {
    for (const [x, z, turns] of [[s * (WH.x1 + 0.03), -17.8, s < 0 ? 3 : 1], [s * 8.0, WH.z1 + 0.03, 0]] as const) {
      const t = new Pen(d, new Frame(x, 0, z, turns));
      t.box(0, 2.9, 0, 1.6, 1.5, 0.06, s < 0 ? '#c0392b' : '#2f7fbf', undefined, 0.01);
      digit(t, 0, 3.1, 0.04, 1.1, s < 0 ? 1 : 2);
    }
  }
}

/** Seven-segment numeral `h` tall with its foot at y0, on a board face at z. */
function digit(t: Pen, x: number, y0: number, zz: number, h: number, n: number) {
  const w = (h * 5) / 9;
  const s = (h * 2) / 15;
  const seg: Record<string, [number, number, number, number]> = {
    a: [x, y0 + h - s, w, s],
    d: [x, y0, w, s],
    g: [x, y0 + (h - s) / 2, w, s],
    f: [x - (w - s) / 2, y0 + h / 2, s, h / 2],
    b: [x + (w - s) / 2, y0 + h / 2, s, h / 2],
    e: [x - (w - s) / 2, y0, s, h / 2],
    c: [x + (w - s) / 2, y0, s, h / 2]
  };
  for (const k of SEGMENTS[n]!) {
    const [sx, sy, sw, sh] = seg[k]!;
    t.box(sx, sy, zz, sw, sh, 0.02, WHITE, undefined, 0);
  }
}

function hazardPosts(t: Pen) {
  const posts: [number, number, number][] = [
    ...[-9.6, -4.8, 4.8, 9.6].map((x) => [x, -25.3, 0.28] as [number, number, number]),
    ...[-6.4, 6.4].map((x) => [x, -16.5, 0.28] as [number, number, number]),
    ...[-1.0, 1.0].map((x) => [x, -20.8, 0.24] as [number, number, number])
  ];
  for (const [x, z, w] of posts) for (let i = 0; i < 4; i++) t.box(x, i * 0.3, z, w, 0.3, w, i % 2 ? '#23272b' : YELLOW, undefined, 0);
}

function ceiling(t: Pen, d: Drawer) {
  const { x0, x1, wall, height: H } = WH;
  const finish = d.detail === 0 ? 'rubber' : 'metal';
  for (const z of [-26.0, -23.6, -19.2, -16.4]) t.span(x0 + wall, H - 0.18, z - 0.05, x1 - wall, H, z + 0.05, '#4a5259', finish, 0);
  for (const x of [-9.6, -4.8, 0, 4.8, 9.6]) {
    for (const z of [-24.8, -17.6]) {
      t.box(x, H - 0.05, z, 3.2, 0.04, 1.4, '#3a4046', finish, 0);
      t.box(x, H - 0.06, z, 3.0, 0.02, 1.2, '#e4edf2', 'glow', 0);
    }
  }
}

function pools(d: Drawer) {
  const y = 0.012;
  const k = d.detail === 0 ? 0.6 : 1;
  for (const x of [-9.6, 9.6]) for (const z of [-22.4, -18.4]) d.anim.pools.add(x, z, y, 3.0, LAMP_LIGHT, 0.2 * k);
  for (const z of [-22.4, -18.4]) {
    d.anim.pools.add(0, z, WH.deck + 0.02, 2.2, LAMP_LIGHT, 0.2 * k, [-1.2, -25.2, 1.2, -16.4]);
    d.anim.pools.add(0, z, y, 3.0, LAMP_LIGHT, 0.12 * k, [-Infinity, -Infinity, -1.2, Infinity]);
    d.anim.pools.add(0, z, y, 3.0, LAMP_LIGHT, 0.12 * k, [1.2, -Infinity, Infinity, Infinity]);
  }
}

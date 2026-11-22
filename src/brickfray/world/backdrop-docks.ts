import { hills, skyline } from './backdrop';
import { WATER_Y } from './docks-parts';
import type { Drawer } from './plan';
import { CONTAINER, CONTAINER_SIZE } from './props-harbor';
import { Pen } from './props-kit';
import { Frame, mix, Rng, shade } from './util';

const HAZE = '#f4cf9e';
/** The low tier's fog is opaque by 140 m, so its town ring stays inside it to keep the skyline's silhouette. */
const LOW_OUTER = 100;
const BOX_COLORS = ['#c0392b', '#2f7fbf', '#e67e22', '#2e8b57', '#d9b93a', '#7f8c8d', '#16a085', '#8e5a9a'];

/** Harbor surroundings: open sea and far shore to the south, container port and town inland. */
export function docksBackdrop(d: Drawer) {
  d.anim.water(-420, 10, 420, 420, WATER_Y, '#2c5866');
  skyline(d, { inner: [62, 54], outer: d.detail === 0 ? LOW_OUTER : 160, haze: HAZE, colors: ['#e3d9c6', '#b5523b', '#d9a441', '#6f8496', '#3f8f8a', '#a0705a', '#c8b89a'], seed: 11, minH: 10, maxH: 30, skip: ['s'], dusk: 0.12 });
  for (const side of [-1, 1]) shore(d, side);
  hills(d, { count: 10, radius: [40, 70], dist: [190, 240], colors: ['#7d8f6a', '#8a9a74', '#6f8262'], haze: HAZE, seed: 5, arc: [Math.PI * 0.2, Math.PI * 0.8], height: 0.32 });
  const t = new Pen(d, new Frame(0, 0, 0));
  const rng = new Rng(29);
  for (const side of [-1, 1]) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 12; row++) {
        if (rng.chance(d.detail === 0 ? 0.5 : 0.2)) continue;
        const x = side * (42 + col * 7.2);
        const z = -44 + row * 3.2;
        const levels = rng.int(1, 4);
        const fade = Math.min(0.5, (Math.hypot(x, z) - 30) / 90);
        for (let k = 0; k < levels; k++) {
          const color = mix(rng.pick(BOX_COLORS), HAZE, fade);
          if (col === 0) CONTAINER.draw(d, { x, z, y: k * CONTAINER_SIZE.height, turns: side < 0 ? 0 : 2, color });
          else farContainer(d, t, x, k * CONTAINER_SIZE.height, z, color, side);
        }
      }
    }
    for (let i = 0; i < 2; i++) gantry(t, side * (74 + i * 20), 4, side < 0 ? 1 : 0);
  }
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-150, 150);
    const z = rng.range(130, 220);
    ship(t, x, Math.abs(x) > SHORE.x - 12 && z < SHORE.z + 12 ? z + 70 : z, rng.range(18, 34), rng);
  }
  lighthouse(t, 58, 70);
  d.anim.foam.ring(58, 70, WATER_Y, 3.2, 1.4, 16);
  t.span(30, WATER_Y, 66, 66, 0.6, 74, mix('#8d8f88', HAZE, 0.35), undefined, 0);
}

/** Rows behind the first, seen only past it: corrugated sheeting and the door frame on the end toward the map. */
function farContainer(d: Drawer, t: Pen, x: number, y: number, z: number, color: string, side: number) {
  const { length: L, width: W, height: H } = CONTAINER_SIZE;
  d.siding.box([x - L / 2, y, z - W / 2], [x + L / 2, y + H, z + W / 2], color);
  t.box(x - side * (L / 2 + 0.02), y + 0.1, z, 0.04, H - 0.2, W - 0.16, shade(color, -0.22), 'metal', 0);
}

/** The town's waterfront either side of the bay: the skyline stands on it instead of in the sea. */
const SHORE = { x: 62, z: 175, far: 185 } as const;

/** Quay block with a pale coping, a dark wet band and a strip of surf along its foot, hazed with distance. */
function shore(d: Drawer, side: number) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const { x: x0, z: z1, far } = SHORE;
  const z0 = 8;
  const haze = (c: string, k: number) => mix(c, HAZE, k);
  const cx = side * (x0 + far) / 2;
  t.box(cx, WATER_Y - 0.6, (z0 + z1) / 2, far - x0, 0.6 - WATER_Y, z1 - z0, haze('#a39a8a', 0.45), undefined, 0);
  t.box(side * (x0 + 0.5), -0.02, (z0 + z1) / 2, 1.2, 0.16, z1 - z0, haze('#d9d2c1', 0.35), undefined, 0);
  t.box(cx, -0.02, z1 - 0.5, far - x0, 0.16, 1.2, haze('#d9d2c1', 0.45), undefined, 0);
  t.box(side * (x0 - 0.04), WATER_Y, (z0 + z1) / 2, 0.1, 0.4, z1 - z0, haze('#3d4441', 0.35), undefined, 0);
  t.box(cx, WATER_Y, z1 + 0.04, far - x0, 0.4, 0.1, haze('#3d4441', 0.45), undefined, 0);
  t.box(side * (x0 - 0.6), WATER_Y + 0.004, (z0 + z1) / 2, 1.1, 0.01, z1 - z0, haze('#e6ebe6', 0.3), undefined, 0);
  t.box(cx, WATER_Y + 0.004, z1 + 0.6, far - x0 + 1.2, 0.01, 1.1, haze('#e6ebe6', 0.4), undefined, 0);
}

function gantry(t: Pen, x: number, z: number, tint: number) {
  const c = mix(tint ? '#d6452f' : '#2f7fbf', HAZE, 0.5);
  for (const sx of [-4, 4]) for (const sz of [-3, 3]) t.box(x + sx, 0, z + sz, 0.8, 22, 0.8, c, 'metal', 0);
  t.box(x, 22, z, 9.6, 1.6, 7.2, c, 'metal', 0);
  t.box(x, 22.4, z + 18, 1.4, 1.2, 50, c, 'metal', 0);
  t.box(x, 23.6, z - 2, 4, 2.4, 3, mix('#e9e6dc', HAZE, 0.35), 'metal', 0);
}

function ship(t: Pen, x: number, z: number, len: number, rng: Rng) {
  const fade = Math.min(0.7, (z - 60) / 200);
  const hull = mix(rng.pick(['#1f3f5f', '#7a2a24', '#2f4f3f', '#3a3f45']), HAZE, fade);
  const w = len * 0.16;
  t.box(x, WATER_Y - 0.2, z, len, len * 0.11, w, hull, 'metal', 0);
  t.box(x - len * 0.35, WATER_Y + len * 0.09, z, len * 0.14, len * 0.12, w * 0.8, mix('#e9e6dc', HAZE, fade), 'metal', 0);
  for (let i = 0; i < 4; i++) t.box(x - len * 0.18 + i * len * 0.13, WATER_Y + len * 0.09, z, len * 0.12, len * 0.05, w * 0.9, mix(rng.pick(BOX_COLORS), HAZE, fade), 'metal', 0);
}

function lighthouse(t: Pen, x: number, z: number) {
  t.cyl(x, WATER_Y, z, 3.2, 2.4, mix('#8d8f88', HAZE, 0.3), undefined, 0, 10);
  for (let i = 0; i < 5; i++) t.cyl(x, WATER_Y + 2.4 + i * 3, z, 1.8 - i * 0.12, 3, mix(i % 2 ? '#c0392b' : '#f2f2ee', HAZE, 0.3), undefined, 0, 10);
  t.cyl(x, WATER_Y + 17.4, z, 1.1, 1.6, '#fff1b0', 'glow', 0, 10);
  t.cone(x, WATER_Y + 19, z, 1.4, 0, 1.4, mix('#2f363d', HAZE, 0.3), undefined, 10);
}

/**
 * The top of each ship's bridge at sea on every tier above low, where audio/scenery.ts sounds the ship horns:
 * docksBackdrop's rng replayed (containers, then ships), so it must change with that loop (audio/scenery.test.ts
 * checks it against the drawn hulls).
 */
export const DOCKS_SHIPS: [number, number, number][] = (() => {
  const rng = new Rng(29);
  for (let i = 0; i < 2 * 4 * 12; i++) {
    if (rng.chance(0.2)) continue;
    const levels = rng.int(1, 4);
    for (let k = 0; k < levels; k++) rng.next();
  }
  const out: [number, number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-150, 150);
    const z = rng.range(130, 220);
    const len = rng.range(18, 34);
    for (let k = 0; k < 5; k++) rng.next();
    out.push([x - len * 0.35, WATER_Y + len * 0.21, Math.abs(x) > SHORE.x - 12 && z < SHORE.z + 12 ? z + 70 : z]);
  }
  return out;
})();

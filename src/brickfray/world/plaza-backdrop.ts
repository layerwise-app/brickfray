import { hills } from './backdrop';
import type { Drawer } from './plan';
import { CANAL } from './plaza-edges';
import { LAND } from './plaza-layout';
import { Pen } from './props-kit';
import { skyline } from './skyline';
import { Frame, mix, Rng, shade } from './util';

const HAZE = '#cfe2f1';
const WARM = ['#f2c94c', '#efe5cf', '#d98c5f', '#c4553a', '#f3a6c3', '#f58a1f', '#e3d6bc'];
const COOL = ['#7fc8e8', '#f2f2ee', '#3b82c4', '#1fa7a0', '#b07ac2', '#5aa83f', '#dfe9ef'];
const ROOFS = ['#a8321f', '#7a1712', '#3f5a6e', '#2f6a5a', '#b44a31'];
const GLASS = '#3f5f78';
const IRON = '#23282d';
const X = LAND.x;

type Box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string) => void;

/**
 * What lies past each edge, all out of reach and drawn cheap (d.flat: one matte mesh, one draw, no shadows), tinted
 * toward the haze with distance: the town behind the north houses with the church spire, the canal's far bank and its
 * narrowboats to the south, the moat and fields with a windmill past the west wall, the tram depot and the station
 * quarter past the east fence; then the city ring and the hills.
 */
export function plazaBackdrop(d: Drawer) {
  const reach = d.detail === 0 ? 150 : 230;
  const box: Box = (x0, y0, z0, x1, y1, z1, color) => {
    const x = (x0 + x1) / 2;
    const z = (z0 + z1) / 2;
    if (Math.hypot(x, z) > reach) return;
    d.flat.box([Math.min(x0, x1), y0, Math.min(z0, z1)], [Math.max(x0, x1), y1, Math.max(z0, z1)], mix(color, HAZE, Math.min(0.6, Math.max(0, (Math.hypot(x, z) - 60) / 200))));
  };
  const rng = new Rng(29);
  north(box, rng, d.detail);
  south(box, rng, d.detail);
  west(box, rng);
  east(box, rng);
  landmarks(d, box);
  skyline(d, { inner: [110, 96], outer: 190, haze: HAZE, colors: ['#e7e1d2', '#d9d2c1', '#c9b48a', '#a6abaf', '#d98c5f', '#8fb3c9', '#e8c547'], seed: 5, minH: 14, maxH: 30 });
  hills(d, { count: d.detail === 0 ? 5 : 9, radius: [40, 70], dist: [170, 220], colors: ['#7fae8a', '#8fb8a0', '#9cbfb2'], haze: HAZE, seed: 9, height: 0.35 });
}

/** A town house as boxes: walls, a band of windows per floor on the face toward the town, a cornice and a roof block. */
function house(box: Box, rng: Rng, x0: number, z0: number, x1: number, z1: number, h: number, face: 'n' | 's' | 'e' | 'w', colors: string[], detail: number) {
  const wall = rng.pick(colors);
  box(x0, 0, z0, x1, h, z1, wall);
  box(x0 - 0.1, h - 0.3, z0 - 0.1, x1 + 0.1, h, z1 + 0.1, shade(wall, -0.2));
  const roof = rng.pick(ROOFS);
  const inset = 0.6;
  box(x0 + inset, h, z0 + inset, x1 - inset, h + 1.4, z1 - inset, roof);
  box(x0 + inset * 2.4, h + 1.4, z0 + inset * 2.4, x1 - inset * 2.4, h + 2.4, z1 - inset * 2.4, shade(roof, -0.1));
  if (detail === 0) return;
  const floors = Math.max(1, Math.floor((h - 0.6) / 3.36));
  for (let f = 0; f < floors; f++) {
    const y = f * 3.36 + (f ? 0.9 : 0.3);
    const top = y + (f ? 1.5 : 2.2);
    const c = f ? GLASS : '#2b3a45';
    if (face === 'n') box(x0 + 0.5, y, z0 - 0.06, x1 - 0.5, top, z0, c);
    else if (face === 's') box(x0 + 0.5, y, z1, x1 - 0.5, top, z1 + 0.06, c);
    else if (face === 'e') box(x1, y, z0 + 0.5, x1 + 0.06, top, z1 - 0.5, c);
    else box(x0 - 0.06, y, z0 + 0.5, x0, top, z1 - 0.5, c);
  }
}

/** Behind the north house fronts: two more rows of roofs climbing away from the boulevard. */
function north(box: Box, rng: Rng, detail: number) {
  for (const [z0, z1, lo, hi] of [[-62.4, -51.2, 12, 18], [-76.8, -63.2, 14, 22]] as const) {
    for (let x = -96; x < 96; ) {
      const w = rng.pick([6.4, 7.2, 8.0, 9.6]);
      house(box, rng, x, z0, x + w, z1, rng.range(lo, hi), 's', x < 0 ? WARM : COOL, z0 > -63 ? detail : 0);
      x += w;
    }
  }
}

/** The canal's far bank: a towpath, bollards, house fronts looking back over the water, narrowboats moored along it. */
function south(box: Box, rng: Rng, detail: number) {
  const bank = CANAL.z1;
  box(-110, CANAL.water - 1.2, bank, 110, 0.24, bank + 6.4, '#c9c6bd');
  box(-110, 0.24, bank, 110, 0.36, bank + 0.4, '#e3d6bc');
  for (let x = -96; x < 96; ) {
    const w = rng.pick([6.4, 7.2, 8.0, 9.6]);
    house(box, rng, x, bank + 6.4, x + w, bank + 16.0, rng.range(8.4, 12.4), 'n', x < 0 ? WARM : COOL, detail);
    x += w;
  }
  for (let x = -96; x < 96; x += 12.8) {
    if (detail > 0) box(x, 0.24, bank + 0.6, x + 0.3, 0.84, bank + 0.9, IRON);
  }
  for (const [x, len, color] of [[-46, 14, '#2f6a5a'], [-8, 16, '#c8231b'], [30, 12, '#1f62c7'], [52, 14, '#f6c624']] as const) {
    const z = bank - 1.6;
    box(x, CANAL.water - 0.3, z - 1.0, x + len, 0.3, z + 1.0, color);
    box(x + 1.2, 0.3, z - 0.8, x + len - 2.4, 1.6, z + 0.8, '#efe5cf');
    box(x + 1.0, 1.6, z - 0.9, x + len - 2.2, 1.75, z + 0.9, shade(color, -0.2));
  }
}

/** Past the west wall: towers along it, the moat, fields with hedgerows and a farm. */
function west(box: Box, rng: Rng) {
  const w = -X - 1.6;
  for (const z of [-40, -14, 12, 38]) {
    box(w - 3.2, 0, z - 2.4, w, 9.6, z + 2.4, '#b9ae98');
    box(w - 3.4, 9.6, z - 2.6, w + 0.2, 10.4, z + 2.6, '#a89e88');
  }
  box(w - 10, -1.2, -60, w, -0.6, 60, '#3f8f8a');
  box(w - 10.4, -1.6, -60, w - 10, 0.2, 60, '#b9ae98');
  for (let x = w - 12; x > -170; x -= 22) for (let z = -90; z < 90; z += 26) {
    box(x - 20, -0.05, z, x, 0.02, z + 24, rng.pick(['#9cc06a', '#c9b06a', '#7fae5a', '#b8c97a']));
    box(x - 20, 0, z + 24, x, 1.4, z + 25, '#3f7f3a');
  }
  box(-120, 0, -24, -108, 6.4, -14, '#efe5cf');
  box(-120.4, 6.4, -24.4, -107.6, 9.6, -13.6, '#a8321f');
}

/** Past the east fence: the railway (sleepers and rails), the tram depot with a tram in its door, the station quarter. */
function east(box: Box, rng: Rng) {
  const e = X + 0.4;
  box(e, -0.8, -70, e + 18, -0.02, 70, '#8a857c');
  for (const x of [e + 4, e + 9, e + 14]) for (const s of [-0.72, 0.72]) box(x + s - 0.05, -0.02, -70, x + s + 0.05, 0.14, 70, '#8d9196');
  box(e + 20, 0, -36, e + 44, 9.6, 12, '#c4553a');
  for (let z = -36; z < 12; z += 6) box(e + 20, 9.6, z, e + 44, 11.2, z + 3, '#3f5a6e');
  box(e + 19.9, 0, -20, e + 20, 5.6, -4, '#2b3a45');
  box(e + 14, 0, -18.8, e + 22, 3.2, -16.4, '#c8231b');
  box(e + 14, 1.3, -18.85, e + 22, 2.4, -16.35, '#f3e6b8');
  for (let z = -90; z < 90; ) {
    const w = rng.pick([7.2, 8.0, 9.6]);
    box(e + 48, 0, z, e + 60, rng.range(12, 20), z + w, rng.pick(COOL));
    z += w;
  }
}

/** Landmarks to steer by from anywhere: the church spire north-west, the windmill west, the gasholder and the station clock east. */
function landmarks(d: Drawer, box: Box) {
  const t = new Pen(d, new Frame(0, 0, 0));
  const [cx, cz] = [-30, -70];
  box(cx - 9.6, 0, cz - 6, cx + 9.6, 16, cz + 6, '#e3d6bc');
  box(cx - 3.2, 0, cz + 6, cx + 3.2, 30, cz + 12.4, '#e3d6bc');
  box(cx - 3.6, 30, cz + 5.6, cx + 3.6, 31, cz + 12.8, '#c9b48a');
  t.cone(cx, 31, cz + 9.2, 3.6, 0.1, 16, mix('#4f9a8a', HAZE, 0.3), undefined, 4, Math.PI / 4);
  box(cx - 10, 16, cz - 6.4, cx + 10, 18, cz + 6.4, '#a8321f');
  const [mx, mz] = [-96, 30];
  t.cyl(mx, 0, mz, 3.2, 10, mix('#efe5cf', HAZE, 0.3));
  t.cone(mx, 10, mz, 3.4, 0.4, 3.2, mix('#7a1712', HAZE, 0.3));
  box(mx + 3.3, 6.6, mz - 0.4, mx + 3.5, 16.4, mz + 0.4, '#efe5cf');
  box(mx + 3.3, 11.1, mz - 4.9, mx + 3.5, 11.9, mz + 4.9, '#efe5cf');
  t.cyl(118, 0, -46, 12, 18, mix('#8a8f94', HAZE, 0.35));
  box(X + 30, 9.6, -12, X + 34, 16, -8, '#efe5cf');
}

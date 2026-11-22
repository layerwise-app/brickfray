import { BUILDING, type BuildingParams, type ShopIcon } from './facade';
import type { Drawer, Plan } from './plan';
import type { Block, Layout } from './plaza-layout';
import { IRON } from './plaza-style';
import { Pen } from './props-kit';
import { faceFrame, hashString, shade, type Face } from './util';

/** Wall colours per district: each part of town reads as its own place. */
const WALLS: Record<string, string[][]> = {
  terminus: [['#f2c94c', '#e8bd3c'], ['#f2f2ee', '#e7e1d2'], ['#1fa7a0', '#1b9590']],
  station: [['#efe5cf', '#e3d6bc', '#f5eedc']],
  lane: [['#f58a1f', '#e87d16'], ['#f6c624', '#ecb91a'], ['#efe5cf', '#e3d6bc']],
  nw: [['#f3a6c3', '#e898b6'], ['#b07ac2', '#a26db4']],
  'row-n': [['#3b82c4', '#3274b2'], ['#f58a1f', '#e87d16'], ['#f2f2ee', '#e7e1d2'], ['#5aa83f', '#4f9837'], ['#f6c624', '#ecb91a']],
  quay: [['#2f6a8a', '#285d7a'], ['#f2f2ee', '#e7e1d2'], ['#7fc8e8', '#71b9d8']],
  'corner-ne': [['#e3d6bc', '#d6c7a8'], ['#8fbf6a', '#82b05e']],
  'corner-se': [['#e3d6bc', '#d6c7a8'], ['#d98c5f', '#cc7f53']],
  hall: [['#b44a31', '#a8452e', '#c4553a']],
  'canal-end': [['#7fc8e8', '#71b9d8'], ['#efe5cf', '#e3d6bc']],
  sw: [['#c43a85', '#b53279'], ['#f3a6c3', '#e898b6']],
  alley: [['#b07ac2', '#a26db4'], ['#f2f2ee', '#e7e1d2'], ['#f3a6c3', '#e898b6']],
  'row-s': [['#c8231b', '#b81f18'], ['#f2f2ee', '#e7e1d2'], ['#2f8a3e', '#287a35'], ['#f6c624', '#ecb91a']],
  'site-road': [['#a6abaf', '#9a9fa3'], ['#d9c7a8', '#cdb994']],
  site: [['#a6abaf', '#9a9fa3']],
  west: [['#f3a6c3', '#e898b6'], ['#b07ac2', '#a26db4'], ['#f58a1f', '#e87d16'], ['#f2f2ee', '#e7e1d2']]
};
const TRIMS = ['#f2f2ee', '#efe5cf', '#2f363d', '#f6c624'];
const ROOFS = ['#a8321f', '#7a1712', '#3f5a6e', '#2f6a5a'];
const SHOPS: Record<string, { icon: ShopIcon; awning: [string, string]; sign: string }[]> = {
  terminus: [{ icon: 'cup', awning: ['#2f8a3e', '#f2f2ee'], sign: '#2f8a3e' }, { icon: 'book', awning: ['#1f62c7', '#f2f2ee'], sign: '#1f62c7' }],
  lane: [{ icon: 'bread', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }],
  'row-n': [{ icon: 'flower', awning: ['#c43a85', '#f2f2ee'], sign: '#c43a85' }, { icon: 'gem', awning: ['#1fa7a0', '#f2f2ee'], sign: '#1fa7a0' }, { icon: 'key', awning: ['#f58a1f', '#f2f2ee'], sign: '#f58a1f' }],
  quay: [{ icon: 'fish', awning: ['#1f62c7', '#f2f2ee'], sign: '#1f62c7' }],
  'row-s': [{ icon: 'cup', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }, { icon: 'flower', awning: ['#2f8a3e', '#f6c624'], sign: '#2f8a3e' }],
  alley: [{ icon: 'key', awning: ['#7b4fd6', '#f2f2ee'], sign: '#7b4fd6' }],
  west: [{ icon: 'bread', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }, { icon: 'key', awning: ['#7b4fd6', '#f2f2ee'], sign: '#7b4fd6' }, { icon: 'cup', awning: ['#2f8a3e', '#f2f2ee'], sign: '#2f8a3e' }]
};

/** Street-front buildings: every outer block dressed on the faces that look into the town, with roofs over them. */
export function townBuildings(p: Plan, L: Layout) {
  for (const b of L.blocks) p.add(BUILDING, building(b));
}

function building(b: Block): BuildingParams {
  const tag = b.tag ?? 'row-n';
  const h = hashString(`${b.x0},${b.z0},${b.x1},${b.z1}`);
  const walls = WALLS[tag] ?? WALLS['row-n']!;
  const wall = walls[h % walls.length]!;
  const face = b.faces[0]!;
  const depth = face === 'n' || face === 's' ? b.z1 - b.z0 : b.x1 - b.x0;
  const length = face === 'n' || face === 's' ? b.x1 - b.x0 : b.z1 - b.z0;
  const shops = SHOPS[tag];
  const shop = shops && length >= 4.8 && h % 3 !== 2 ? shops[h % shops.length]! : undefined;
  return {
    x0: b.x0,
    z0: b.z0,
    x1: b.x1,
    z1: b.z1,
    height: b.h + 0.16,
    face,
    faces: b.faces.slice(1),
    wall,
    trim: tag === 'station' ? '#c9b48a' : TRIMS[h % TRIMS.length]!,
    roof: depth <= 10.4 && length <= 24 ? 'gable' : 'flat',
    roofColor: ROOFS[(h >>> 2) % ROOFS.length]!,
    shop: shop ? { ...shop, door: shade(shop.sign, -0.2) } : undefined,
    windows: tag === 'station' || tag === 'hall' ? 'arched' : (['tall', 'square', 'arched'] as const)[h % 3],
    shutters: h % 4 === 1 ? shade(wall[0]!, -0.35) : undefined,
    seed: h
  };
}

/** Upper floors over the rooms whose ground floor is open to play: shops, the Town Gate, the station, the town hall. */
export function passageFronts(d: Drawer, L: Layout) {
  for (const c of L.pieces.filter((x) => x.kind === 'ceiling')) {
    const [x0, base, z0] = c.min;
    const [x1, top, z1] = c.max;
    const faces: Face[] = x1 - x0 < z1 - z0 ? ['e', 'w'] : ['n', 's'];
    const civic = c.tag === 'station' || c.tag === 'townhall';
    const wall = c.tag === 'bakery' ? ['#f6c624', '#ecb91a'] : c.tag === 'laundrette' ? ['#7fc8e8', '#71b9d8'] : civic ? ['#efe5cf', '#e3d6bc', '#f5eedc'] : ['#efe5cf', '#e3d6bc'];
    const all: Face[] = ['n', 's', 'e', 'w'];
    BUILDING.draw(d, {
      x0, z0, x1, z1, height: top + 0.16, base, face: faces[0]!, faces: civic ? all.filter((f) => f !== faces[0]) : [faces[1]!], wall,
      trim: civic ? '#c9b48a' : '#f2f2ee', roof: civic ? 'flat' : 'gable', roofColor: c.tag === 'station' ? '#3f5a6e' : '#a8321f',
      windows: civic ? 'arched' : 'square', seed: Math.round(x0 * 9)
    });
    if (!civic) for (const face of faces) shopSign(d, c.tag ?? '', x0, z0, x1, z1, face, base);
  }
}

function shopSign(d: Drawer, tag: string, x0: number, z0: number, x1: number, z1: number, face: Face, base: number) {
  const { f, length } = faceFrame(face, x0, z0, x1, z1);
  const t = new Pen(d, f);
  if (tag === 'gate') {
    t.box(length / 2, base - 0.2, 0.08, length + 0.4, 0.5, 0.2, '#c9b48a', undefined, 0.03);
    t.box(length / 2, base + 0.3, 0.12, 1.2, 1.2, 0.12, '#c9b48a', undefined, 0.04);
    t.cylZ(length / 2, base + 0.9, 0.2, 0.4, 0.06, '#c99a3e', 'chrome', 0.02);
    return;
  }
  const color = tag === 'bakery' ? '#c8231b' : '#1f62c7';
  t.box(length / 2, base - 0.9, 0.06, length - 1.2, 0.6, 0.12, color, undefined, 0.03);
  t.box(length / 2, base - 0.95, 0.04, length - 1.0, 0.7, 0.08, shade(color, -0.3), undefined, 0.02);
  if (d.detail > 0) for (let k = 0; k < 3; k++) t.ball(length / 2 - 0.5 + k * 0.5, base - 0.6, 0.15, 0.14, tag === 'bakery' ? '#e0b46a' : '#f2f2ee', [1.3, 0.8, 0.6]);
  t.box(length / 2, base - 1.6, 0.03, length - 0.6, 0.08, 0.5, IRON, 'metal', 0);
}

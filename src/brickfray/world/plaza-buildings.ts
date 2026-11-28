import { BUILDING, type BuildingParams, type ShopIcon } from './facade';
import type { Drawer, Plan } from './plan';
import type { Block, Layout } from './plaza-layout';
import { IRON } from './plaza-style';
import { Pen } from './props-kit';
import { faceFrame, hashString, shade, type Face } from './util';

/**
 * Wall colours per district: the Old Quarter (west) is ochre, terracotta and cream, the Station Quarter (east) blue,
 * teal and white, the canal fronts pastel; the Grand Café, the arcade and the lock house have their own.
 */
const WALLS: Record<string, string[][]> = {
  old: [['#f2c94c', '#e8bd3c'], ['#d98c5f', '#cc7f53'], ['#efe5cf', '#e3d6bc'], ['#c8231b', '#b81f18'], ['#f58a1f', '#e87d16']],
  stn: [['#3b82c4', '#3274b2'], ['#f2f2ee', '#e7e1d2'], ['#1fa7a0', '#1b9590'], ['#7fc8e8', '#71b9d8'], ['#2f6a8a', '#285d7a']],
  'north-w': [['#f6c624', '#ecb91a'], ['#efe5cf', '#e3d6bc'], ['#d98c5f', '#cc7f53'], ['#f3a6c3', '#e898b6'], ['#c4553a', '#b44a31']],
  'north-e': [['#7fc8e8', '#71b9d8'], ['#f2f2ee', '#e7e1d2'], ['#5aa83f', '#4f9837'], ['#3b82c4', '#3274b2'], ['#b07ac2', '#a26db4']],
  'row-s': [['#c43a85', '#b53279'], ['#f2f2ee', '#e7e1d2'], ['#f6c624', '#ecb91a']],
  'row-e': [['#2f8a3e', '#287a35'], ['#f2f2ee', '#e7e1d2'], ['#1fa7a0', '#1b9590']],
  quay: [['#f3a6c3', '#e898b6'], ['#f6c624', '#ecb91a'], ['#efe5cf', '#e3d6bc']],
  'quay-e': [['#7fc8e8', '#71b9d8'], ['#b07ac2', '#a26db4'], ['#f2f2ee', '#e7e1d2']],
  cafe: [['#f5eedc', '#efe5cf', '#e3d6bc']],
  'cafe-w': [['#d98c5f', '#cc7f53'], ['#f2c94c', '#e8bd3c']],
  'cafe-e': [['#7fc8e8', '#71b9d8'], ['#1fa7a0', '#1b9590']],
  arcade: [['#e3d6bc', '#d6c7a8', '#efe5cf']],
  lock: [['#a6abaf', '#9a9fa3']]
};
const TRIMS = ['#f2f2ee', '#efe5cf', '#2f363d', '#f6c624'];
const ROOFS: Record<string, string[]> = { west: ['#a8321f', '#7a1712', '#b44a31'], east: ['#3f5a6e', '#2f6a5a', '#7a1712'] };
const SHOPS: Record<string, { icon: ShopIcon; awning: [string, string]; sign: string }[]> = {
  old: [{ icon: 'bread', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }, { icon: 'cup', awning: ['#2f8a3e', '#f2f2ee'], sign: '#2f8a3e' }, { icon: 'key', awning: ['#7b4fd6', '#f2f2ee'], sign: '#7b4fd6' }],
  stn: [{ icon: 'book', awning: ['#1f62c7', '#f2f2ee'], sign: '#1f62c7' }, { icon: 'gem', awning: ['#1fa7a0', '#f2f2ee'], sign: '#1fa7a0' }, { icon: 'cup', awning: ['#2f6a8a', '#f2f2ee'], sign: '#2f6a8a' }],
  'north-w': [{ icon: 'flower', awning: ['#c43a85', '#f2f2ee'], sign: '#c43a85' }, { icon: 'bread', awning: ['#f58a1f', '#f2f2ee'], sign: '#f58a1f' }],
  'north-e': [{ icon: 'key', awning: ['#3b82c4', '#f2f2ee'], sign: '#3b82c4' }, { icon: 'gem', awning: ['#5aa83f', '#f2f2ee'], sign: '#5aa83f' }],
  'row-s': [{ icon: 'cup', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }, { icon: 'flower', awning: ['#2f8a3e', '#f6c624'], sign: '#2f8a3e' }],
  'row-e': [{ icon: 'book', awning: ['#2f6a8a', '#f2f2ee'], sign: '#2f6a8a' }],
  quay: [{ icon: 'fish', awning: ['#1f62c7', '#f2f2ee'], sign: '#1f62c7' }],
  'quay-e': [{ icon: 'fish', awning: ['#2f8a3e', '#f2f2ee'], sign: '#2f8a3e' }],
  arcade: [{ icon: 'gem', awning: ['#c8231b', '#f2f2ee'], sign: '#c8231b' }]
};

/** Street-front buildings: every block dressed on the faces that look into the town, with roofs over them. */
export function townBuildings(p: Plan, L: Layout) {
  for (const b of L.blocks) p.add(BUILDING, building(b));
}

function building(b: Block): BuildingParams {
  const tag = b.tag ?? 'old';
  const h = hashString(`${b.x0},${b.z0},${b.x1},${b.z1}`);
  const walls = WALLS[tag] ?? WALLS.old!;
  const wall = walls[h % walls.length]!;
  const face = b.faces[0]!;
  const depth = face === 'n' || face === 's' ? b.z1 - b.z0 : b.x1 - b.x0;
  const length = face === 'n' || face === 's' ? b.x1 - b.x0 : b.z1 - b.z0;
  const shops = SHOPS[tag];
  const shop = shops && length >= 4.8 && h % 3 !== 2 ? shops[h % shops.length]! : undefined;
  const roofs = ROOFS[(b.x0 + b.x1) / 2 < 0 ? 'west' : 'east']!;
  const civic = tag === 'cafe' || tag === 'arcade';
  return {
    x0: b.x0,
    z0: b.z0,
    x1: b.x1,
    z1: b.z1,
    height: b.h + 0.16,
    face,
    faces: b.faces.slice(1),
    wall,
    trim: civic ? '#c9b48a' : TRIMS[h % TRIMS.length]!,
    roof: tag === 'lock' || (depth <= 10.4 && length <= 24 && !civic) ? 'gable' : 'flat',
    roofColor: roofs[(h >>> 2) % roofs.length]!,
    shop: shop ? { ...shop, door: shade(shop.sign, -0.2) } : undefined,
    windows: civic ? 'arched' : (['tall', 'square', 'arched'] as const)[h % 3],
    shutters: h % 4 === 1 ? shade(wall[0]!, -0.35) : undefined,
    seed: h
  };
}

/** Upper floors over the rooms whose ground floor is open to play: the shops, the gate houses, the town hall. */
export function passageFronts(d: Drawer, L: Layout) {
  for (const c of L.pieces.filter((x) => x.kind === 'ceiling')) {
    const [x0, base, z0] = c.min;
    const [x1, top, z1] = c.max;
    const tag = c.tag ?? '';
    const civic = tag === 'townhall';
    const faces: Face[] = ['n', 's'];
    const wall = tag === 'bakery' ? ['#f6c624', '#ecb91a'] : tag === 'laundrette' ? ['#7fc8e8', '#71b9d8'] : tag === 'gate-e' ? ['#f2f2ee', '#e7e1d2'] : civic ? ['#efe5cf', '#e3d6bc', '#f5eedc'] : ['#e3d6bc', '#d6c7a8'];
    const all: Face[] = ['n', 's', 'e', 'w'];
    BUILDING.draw(d, {
      x0, z0, x1, z1, height: top + 0.16, base, face: faces[0]!, faces: civic ? all.filter((f) => f !== faces[0]) : [faces[1]!], wall,
      trim: civic || tag.startsWith('gate') ? '#c9b48a' : '#f2f2ee', roof: civic ? 'flat' : 'gable', roofColor: (x0 + x1) / 2 < 0 ? '#a8321f' : '#3f5a6e',
      windows: civic ? 'arched' : 'square', seed: Math.round(x0 * 9)
    });
    if (!civic) for (const face of faces) shopSign(d, tag, x0, z0, x1, z1, face, base);
  }
}

function shopSign(d: Drawer, tag: string, x0: number, z0: number, x1: number, z1: number, face: Face, base: number) {
  const { f, length } = faceFrame(face, x0, z0, x1, z1);
  const t = new Pen(d, f);
  if (tag.startsWith('gate')) {
    t.box(length / 2, base - 0.2, 0.08, length + 0.4, 0.5, 0.2, '#c9b48a', undefined, 0.03);
    t.box(length / 2, base + 0.3, 0.12, 1.2, 1.2, 0.12, '#c9b48a', undefined, 0.04);
    t.cylZ(length / 2, base + 0.9, 0.2, 0.4, 0.06, tag === 'gate' ? '#c99a3e' : '#4f9a8a', 'chrome', 0.02);
    return;
  }
  const color = tag === 'bakery' ? '#c8231b' : '#1f62c7';
  t.box(length / 2, base - 0.9, 0.06, length - 1.2, 0.6, 0.12, color, undefined, 0.03);
  t.box(length / 2, base - 0.95, 0.04, length - 1.0, 0.7, 0.08, shade(color, -0.3), undefined, 0.02);
  const bead = tag === 'bakery' ? ['#e0b46a'] : ['#f2f2ee'];
  if (d.detail > 0) for (let k = 0; k < 3; k++) t.ball(length / 2 - 0.5 + k * 0.5, base - 0.6, 0.15, 0.14, bead[k % bead.length]!, [1.3, 0.8, 0.6]);
  t.box(length / 2, base - 1.6, 0.03, length - 0.6, 0.08, 0.5, IRON, 'metal', 0);
}

import { slab } from './blocks';
import { BUILDING } from './facade';
import type { Drawer } from './plan';
import { Pen } from './props-kit';
import { bellTower, riverShrine, ROOF_BLUE } from './temple-landmarks';
import { pavilionRoof, ROOF_CLAY, ROOF_JADE } from './temple-ornament';
import { GUARDIAN } from './temple-props';
import type { Piece } from './temple-layout';
import { RAIL_POST_STEP } from './temple-solids';
import { Frame, mix, Rng, shade, type Face } from './util';

const GOLD = '#e0b040';
const BRONZE = '#6f5a3a';
const JADE = '#5f9a7e';
const RED = '#a83a2c';
const SAND = '#e0c48e';
const TIMBER = '#5a3424';

const centre = (q: Piece) => [(q.min[0] + q.max[0]) / 2, (q.min[2] + q.max[2]) / 2] as const;
const size = (q: Piece) => [q.max[0] - q.min[0], q.max[1] - q.min[1], q.max[2] - q.min[2]] as const;

/** The great statue's plinth under its throne: too tall to jump onto. */
export const STATUE_PLINTH = 0.9;

/**
 * The great statue on the nave's axis: a seated jade guardian on a gold lotus throne, a flame halo behind its head
 * so it reads from both ends of the nave.
 */
export function greatStatue(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const W = size(q)[0];
  new Pen(d, new Frame(cx, q.min[1], cz)).box(0, 0, 0, W, STATUE_PLINTH, W, shade(SAND, -0.08), undefined, 0.06);
  const t = new Pen(d, new Frame(cx, q.min[1] + STATUE_PLINTH, cz));
  t.box(0, 0, 0, W, 0.4, W, SAND, undefined, 0.04);
  t.cyl(0, 0.4, 0, W * 0.46, 0.5, GOLD, 'metal', 0.04, d.detail === 0 ? 8 : 16);
  if (d.detail > 0) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    t.cone(Math.cos(a) * W * 0.44, 0.5, Math.sin(a) * W * 0.44, 0.34, 0.04, 0.5, '#f0c8d0', undefined, 5);
  }
  t.box(0, 0.9, 0.2, W * 0.86, 0.8, W * 0.6, JADE, undefined, 0.1);
  t.box(0, 1.7, 0, W * 0.5, 1.5, W * 0.36, JADE, undefined, 0.12);
  t.box(0, 1.7, W * 0.19, W * 0.42, 0.9, 0.06, GOLD, 'metal', 0);
  for (const s of [-1, 1]) {
    t.box(s * W * 0.3, 1.9, 0.05, 0.5, 1.1, 0.6, JADE, undefined, 0.1);
    t.box(s * 0.2, 1.75, W * 0.3, 0.42, 0.3, 0.5, shade(JADE, 0.08), undefined, 0.06);
  }
  t.box(0, 3.2, 0, 0.7, 0.3, 0.6, JADE, undefined, 0.05);
  t.ball(0, 3.85, 0, 0.62, shade(JADE, 0.06), [1, 1.1, 1], 0, 1);
  t.cone(0, 4.3, 0, 0.3, 0.06, 0.6, GOLD, 'metal', 8);
  if (d.detail > 0) {
    for (const s of [-1, 1]) t.box(s * 0.22, 3.92, 0.56, 0.18, 0.06, 0.04, '#2f3a34', undefined, 0);
    for (const s of [-1, 1]) t.box(s * 0.64, 3.5, 0, 0.12, 0.6, 0.2, shade(JADE, -0.1), undefined, 0.03);
  }
  t.cylZ(0, 3.6, -0.5, 1.5, 0.12, GOLD, 'metal', 0.02, d.detail === 0 ? 10 : 18);
  if (d.detail > 0) t.cylZ(0, 3.6, -0.56, 1.25, 0.06, '#c8231b', undefined, 0, 18);
}

/** Bronze incense burner: a lidded cauldron on lion feet under a small roof, with smoke rising. */
export function burner(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const t = new Pen(d, new Frame(cx, 0, cz));
  t.box(0, 0, 0, w, 0.3, dd, SAND, undefined, 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.4), 0.3, sz * (dd / 2 - 0.4), 0.36, 0.7, 0.36, BRONZE, 'metal', 0.06);
  t.box(0, 1.0, 0, w - 0.3, 0.9, dd - 0.3, BRONZE, 'metal', 0.12);
  t.box(0, 1.9, 0, w - 0.1, 0.14, dd - 0.1, shade(BRONZE, 0.15), 'metal', 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.3), 2.04, sz * (dd / 2 - 0.3), 0.12, h - 2.6, 0.12, BRONZE, 'metal', 0);
  pavilionRoof(d, cx, h - 0.4, cz, w - 0.4, dd - 0.4, { tile: shade(BRONZE, 0.1), ridge: BRONZE, end: BRONZE }, 1);
  if (d.detail > 0) for (const sx of [-1, 1]) t.ring(sx * (w / 2 - 0.1), 1.5, 0, 0.22, 0.05, GOLD, 'metal');
  t.box(0, 2.04, 0, w - 0.8, 0.2, dd - 0.8, '#ffb54a', 'glow', 0);
  d.anim.flame([cx, 2.1, cz]);
  d.anim.pools.add(cx, cz, 0.006, 4.0, '#ffb060', 0.4);
}

/** Guardian plinth before an aisle door: a carved base with a temple lion at each end facing the door. */
export function guardians(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const t = new Pen(d, new Frame(cx, 0, cz));
  t.box(0, 0, 0, w, h - 1.6, dd, SAND, undefined, 0.04);
  t.box(0, h - 1.6, 0, w + 0.1, 0.12, dd + 0.1, '#c8231b', undefined, 0);
  const turns = cz < 0 ? 0 : 2;
  for (const s of [-1, 1]) GUARDIAN.draw?.(d, { x: cx + s * (w / 2 - 0.7), y: h - 1.6, z: cz, turns });
}

/** Stone tablet on a turtle: weathered grey in the strips, sandstone and red in the courts and forecourts. */
export function stele(d: Drawer, q: Piece, strip: boolean) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const along = w >= dd;
  const t = new Pen(d, new Frame(cx, 0, cz, along ? 0 : 1));
  const L = Math.max(w, dd);
  const D = Math.min(w, dd);
  // Under the cliff the steles are capped in red lacquer, on the river terrace in blue-grey slate.
  const south = cz > 0;
  const stone = strip ? '#9a9d8e' : south ? '#e4e0d4' : SAND;
  t.box(0, 0, 0, L, 0.5, D, shade(stone, -0.12), undefined, 0.06);
  t.box(0, 0.5, 0, L - 0.3, h - 1.1, Math.max(0.3, D - 0.3), stone, undefined, 0.04);
  t.box(0, h - 0.6, 0, L, 0.6, D + 0.1, strip ? '#7f8577' : south ? '#3f5f78' : RED, undefined, 0.08);
  if (d.detail > 0) {
    for (const s of [-1, 1]) t.box(0, 0.9, s * (D / 2 - 0.13), L - 0.9, h - 2.0, 0.04, strip ? '#6a7064' : south ? '#2f4f6a' : '#8a3f22', undefined, 0);
    if (strip) for (let i = 0; i < 3; i++) t.box(-L / 2 + 0.4 + i * (L / 3), h - 0.1, 0, 0.6, 0.12, D + 0.12, '#4f8a3a', undefined, 0.02);
  }
}

/** Kiosks by where they stand: drum towers at the court corners, the court's shrine pavilion, watch shrines in the camps, the bridge shrine. */
export function kiosk(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const [x0, , z0] = q.min;
  const [x1, , z1] = q.max;
  const grotto = Math.abs(cx) < 0.1;
  if (grotto && cz > 0) return riverShrine(d, q);
  if (h > 5 && cx > 0) return bellTower(d, q);
  const tower = h > 5;
  const base = tower ? 2.4 : 1.0;
  slab(d, [x0, 0, z0], [x1, base, z1], shade(SAND, -0.08));
  // The camp watch shrines take their team's colour; the west court's shrine is whitewashed under blue tiles.
  const camp = Math.abs(cz) > 37 && !grotto;
  const westShrine = !tower && !camp && cx < 0;
  const body = tower ? RED : camp ? (cz < 0 ? '#d0622c' : '#3f6f9a') : westShrine ? '#efe8d8' : RED;
  slab(d, [x0 + 0.1, base, z0 + 0.1], [x1 - 0.1, h, z1 - 0.1], body);
  slab(d, [x0, h - 0.3, z0], [x1, h, z1], GOLD, 'metal');
  if (d.detail > 0) {
    const t = new Pen(d, new Frame(cx, 0, cz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box(sx * (w / 2 - 0.12), base, sz * (dd / 2 - 0.12), 0.32, h - base, 0.32, TIMBER, undefined, 0.02);
    if (tower) for (const s of [-1, 1]) t.cylX(s * (w / 2 + 0.05), base + 1.8, 0, 0.7, 0.3, '#c8231b', undefined, 0.04);
    t.box(0, base + 0.6, 0, w + 0.06, 0.9, 0.9, '#2f5f48', undefined, 0);
  }
  pavilionRoof(d, cx, h, cz, w, dd, westShrine || (camp && cz > 0) ? ROOF_BLUE : tower || camp ? ROOF_CLAY : ROOF_JADE, tower ? 2 : 1);
}

/** Camp supply stack in the team's colour: crates under a tarp, a barrel and a coil of rope. */
export function stack(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const team = cz < 0 ? '#e0742c' : '#2f7fd0';
  const t = new Pen(d, new Frame(cx, 0, cz));
  const rng = new Rng(Math.round(cx * 3 + cz));
  t.box(0, 0, 0, w, 0.16, dd, TIMBER, undefined, 0);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) t.box((i - 0.5) * (w / 2), 0.16, (j - 0.5) * (dd / 2), w / 2 - 0.08, h * 0.45, dd / 2 - 0.08, shade('#b8874f', rng.range(-0.12, 0.08)), undefined, 0.03);
  t.box(0, 0.16 + h * 0.45, 0, w - 0.2, h * 0.5, dd - 0.2, shade('#b8874f', -0.06), undefined, 0.03);
  t.box(0, h - 0.4, 0, w + 0.1, 0.42, dd + 0.1, team, undefined, 0.05);
  if (d.detail > 0) t.box(0, h * 0.5, dd / 2 + 0.01, w * 0.6, h * 0.3, 0.04, team, undefined, 0);
}

/** Balustrade along the gorge and river: stone posts with gold knobs and a carved rail between them. */
export function rail(d: Drawer, q: Piece) {
  const [x0, , z0] = q.min;
  const [x1, h, z1] = q.max;
  const along = x1 - x0 > z1 - z0;
  const len = along ? x1 - x0 : z1 - z0;
  const t = new Pen(d, new Frame(0, 0, 0));
  const c = (along ? z0 + z1 : x0 + x1) / 2;
  slab(d, [x0, 0, z0], [x1, 0.24, z1], '#7f8577');
  slab(d, [along ? x0 : x0 + 0.06, h - 0.2, along ? z0 + 0.06 : z0], [along ? x1 : x1 - 0.06, h, along ? z1 - 0.06 : z1], '#d6c69c');
  for (let a = (along ? x0 : z0) + 0.2; a <= (along ? x1 : z1); a += RAIL_POST_STEP) {
    const [x, z] = along ? [a, c] : [c, a];
    t.box(x, 0.24, z, 0.3, h - 0.24, 0.3, '#c8b98f', undefined, 0.03);
    if (d.detail > 0) t.ball(x, h + 0.08, z, 0.1, GOLD, undefined, 0, 1, 'metal');
  }
  slab(d, [along ? x0 : x0 + 0.1, 0.5, along ? z0 + 0.1 : z0], [along ? x1 : x1 - 0.1, 0.62, along ? z1 - 0.1 : z1], '#b8a882');
}

/** Bamboo fence between village houses: poles, two rails and a gate in the middle; bullets pass through. */
export function fence(d: Drawer, q: Piece) {
  const [x0, , z0] = q.min;
  const [x1, h, z1] = q.max;
  const t = new Pen(d, new Frame(0, 0, 0));
  const x = (x0 + x1) / 2;
  const rng = new Rng(Math.round(z0 * 11));
  const step = d.detail === 0 ? 0.5 : 0.22;
  for (let z = z0 + 0.1; z < z1; z += step) t.cyl(x, 0, z, 0.07, h - rng.range(0, 0.3), mix('#b9a35a', '#8a7a3a', rng.range(0, 1)), undefined, 0, 6);
  for (const y of [0.6, h - 0.5]) t.cylZ(x - 0.1, y, (z0 + z1) / 2, 0.05, z1 - z0, '#7a5a2a');
}

/** Village house front facing the play area: plaster, shutters, a door and a tiled roof (facade's building, drawn only). */
export function house(d: Drawer, q: Piece, i: number, face: Face = 'w') {
  const walls = [['#ece4d2', '#e3d9c4'], ['#e8c89a', '#dcbb8a'], ['#d9a89a', '#cf9a8c'], ['#cfe0d0', '#c2d4c3']][i % 4]!;
  BUILDING.draw?.(d, {
    x0: q.min[0],
    z0: q.min[2],
    x1: q.max[0],
    z1: q.max[2],
    height: q.max[1],
    face,
    wall: walls,
    trim: '#7a4a2a',
    roof: 'gable',
    roofColor: i % 2 ? '#8a3f22' : '#5f6a70',
    windows: 'square',
    shutters: ['#2f7a6a', '#a83a2c', '#2f5f9a', '#7a5a2a'][i % 4],
    balcony: i % 3 === 1,
    shop: i % 3 === 0 ? { awning: ['#c8231b', '#f2e6c8'], sign: '#2f5f48', icon: (['cup', 'bread', 'flower', 'fish'] as const)[i % 4], door: TIMBER } : undefined,
    seed: 30 + i
  });
}

/** Fallen masonry in the strips: weathered grey blocks with moss and a broken column drum. */
export function ruin(d: Drawer, q: Piece) {
  const [cx, cz] = centre(q);
  const [w, h, dd] = size(q);
  const t = new Pen(d, new Frame(cx, 0, cz));
  const rng = new Rng(Math.round(cx * 7 + cz * 3));
  t.box(0, 0, 0, w, h * 0.55, dd, '#8c9082', undefined, 0.06);
  t.box(rng.range(-0.2, 0.2) * w, h * 0.55, 0, w * 0.7, h * 0.45, dd * 0.9, '#9a9d8e', undefined, 0.06, rng.range(-0.1, 0.1));
  if (d.detail > 0) t.box(0, h - 0.04, 0, w * 0.5, 0.1, dd * 0.7, '#4f8a3a', undefined, 0.02);
}

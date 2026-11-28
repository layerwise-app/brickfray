import { drawBlock } from './blocks';
import type { Element } from './plan';
import { passageFronts } from './plaza-buildings';
import { plazaInteriors } from './plaza-interiors';
import { basin, bridge, canalBed, canopy, fountainColumn, hallGables, hallRoof, plinth, stage, stationRoof, townHall, tram, well } from './plaza-landmarks';
import type { Layout, Piece } from './plaza-layout';
import { CONCRETE, masonryBox, sidesOf, STONE, styleOf, TIMBER, TRIM } from './plaza-style';
import { counter, garden, hoarding, kiosk, pieceFrame, railing, shelf, stack } from './plaza-things';
import { Pen } from './props-kit';
import type { Surface } from './types';
import { box, Frame, Rng, shade, type PlanCollider } from './util';
import type { Drawer } from './plan';

/** The town's own pieces: what players bump into is what they see. Outer blocks are BUILDING elements. */
export const PLAZA_TOWN: Element<Layout> = {
  colliders(L) {
    const out: PlanCollider[] = [];
    for (const p of L.pieces) out.push(box(p.min, p.max, p.surface ?? surfaceOf(p), { walk: p.walk, bulletsPass: p.pass }));
    return out;
  },
  draw(d, L) {
    for (const p of L.pieces) piece(d, p);
    townHall(d);
    lanterns(d, L);
    passageFronts(d, L);
    plazaInteriors(d, L);
    for (const r of L.pieces) if (r.kind === 'roof' && (r.tag === 'hall' || r.tag === 'station')) for (const s of [-1, 1] as const) hallGables(d, r.min[0], r.max[0], s < 0 ? r.min[2] : r.max[2], s, r.min[1]);
  }
};

/** What a hit finds under the paint: hedges are leaves, kiosks, counters, shelves and hoardings timber, iron is metal. */
function surfaceOf(p: Piece): Surface {
  switch (p.kind) {
    case 'garden':
      return 'foliage';
    case 'kiosk':
      return p.tag === 'site-office' ? 'metal' : 'wood';
    case 'shelf':
      return p.tag === 'laundrette' ? 'metal' : 'wood';
    case 'counter':
    case 'hoarding':
      return 'wood';
    case 'pillar':
      return p.tag === 'hall' && p.max[0] - p.min[0] < 0.9 ? 'metal' : 'stone';
    case 'stack':
      return p.tag === 'skip' ? 'metal' : 'stone';
    default:
      return 'stone';
  }
}

function piece(d: Drawer, p: Piece) {
  switch (p.kind) {
    case 'wall':
    case 'lintel':
      return wall(d, p);
    case 'parapet':
      return masonryBox(d, p.min, p.max, p.tag === 'shed' || p.surface === 'wood' ? TIMBER : styleOf(p), sidesOf(p.min, p.max), 'tiles', TRIM);
    case 'slab':
    case 'landing':
      return floor(d, p);
    case 'roof':
      return roof(d, p);
    case 'pillar':
      return pillar(d, p);
    case 'frame':
      return column(d, p);
    case 'kiosk':
      return p.tag === 'site-office' ? cabin(d, p) : p.tag === 'well' || p.tag === 'pump' ? well(d, p) : kiosk(d, p);
    case 'counter':
      return counter(d, p);
    case 'shelf':
      return shelf(d, p);
    case 'tram':
      return tram(d, p);
    case 'shelter':
      return shelter(d, p);
    case 'plinth':
      return plinth(d, p);
    case 'rail':
      return railing(d, p);
    case 'bed':
      return canalBed(d, p);
    case 'deck':
      return bridge(d, p);
    case 'hoarding':
      return hoarding(d, p);
    case 'stack':
      return stack(d, p);
    case 'garden':
      return garden(d, p);
    case 'stage':
      return stage(d, p);
    case 'basin':
      return basin(d, p);
    case 'ceiling':
    case 'tower':
      return;
    default:
      return masonryBox(d, p.min, p.max, STONE);
  }
}

function wall(d: Drawer, p: Piece) {
  const style = styleOf(p);
  masonryBox(d, p.min, p.max, style, sidesOf(p.min, p.max), 'tiles', p.tag === 'hall' ? '#e3d6bc' : shade(style.colors[0]!, -0.12));
  if (p.tag === 'stalls' && p.min[1] < 0.1 && p.max[1] > 3) stallRow(d, p);
}

/** The hall's tall stall row: shelves of goods and a striped valance on both faces. */
function stallRow(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  const rng = new Rng(Math.round(p.min[2] * 10));
  for (const s of [-1, 1]) {
    const z = s * (wid / 2 + 0.02);
    for (const y of [0.5, 1.1, 1.7]) {
      t.box(0, y, z + s * 0.12, len - 0.2, 0.05, 0.26, '#b98a5a', undefined, 0.01);
      if (d.detail === 0) {
        t.box(0, y + 0.05, z + s * 0.12, len - 0.4, 0.28, 0.2, rng.pick(['#c8231b', '#f6c624', '#5aa83f', '#f58a1f', '#1fa7a0']), undefined, 0.01);
        continue;
      }
      for (let u = -len / 2 + 0.3; u < len / 2 - 0.2; u += 0.42) t.box(u, y + 0.05, z + s * 0.12, 0.32, rng.range(0.16, 0.36), 0.2, rng.pick(['#c8231b', '#f6c624', '#5aa83f', '#f58a1f', '#f2f2ee', '#1fa7a0']), undefined, 0.01);
    }
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i < n; i++) t.box(-len / 2 + (len / n) * (i + 0.5), h - 0.9, z + s * 0.03, len / n, 0.5, 0.06, i % 2 ? '#f2f2ee' : '#2f8a3e', undefined, 0.01);
  }
}

function floor(d: Drawer, p: Piece) {
  const wood = p.surface === 'wood';
  const style = wood ? TIMBER : p.tag === 'site' ? CONCRETE : STONE;
  const top = wood ? '#a8774a' : p.tag === 'site' ? '#b9b8b1' : p.tag === 'arcade' ? '#c9774f' : '#e7e1d2';
  drawBlock(d, { min: p.min, max: p.max, surface: 'stone', style, top: 'tiles', topColor: top });
}

function roof(d: Drawer, p: Piece) {
  if (p.tag === 'hall') return hallRoof(d, p);
  if (p.tag === 'station') return stationRoof(d, p);
  if (p.tag === 'square' || p.tag === 'park') return canopy(d, p);
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  if (p.tag === 'shelter') {
    t.span(x0, y0, z0, x1, y1, z1, '#8fb9cf', 'glass');
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) t.span(x - 0.05, y0 - 0.02, z0, x + 0.05, y1 + 0.02, z1, '#2f363d');
    return;
  }
  const color = p.tag === 'arcade' ? '#a8321f' : p.tag === 'portico' ? '#4f9a8a' : '#7a1712';
  t.span(x0, y0, z0, x1, y1, z1, color, undefined, 0.03);
  t.span(x0 - 0.1, y0 - 0.02, z0 - 0.1, x1 + 0.1, y0 + 0.16, z1 + 0.1, TRIM, undefined, 0.02);
  if (p.tag === 'arcade' && d.detail > 0) for (let x = x0 + 0.4; x < x1; x += 0.8) t.span(x, y1, z0 + 0.2, x + 0.4, y1 + 0.5, z1 - 0.2, shade(color, -0.08), undefined, 0.02);
}

function pillar(d: Drawer, p: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const dd = z1 - z0;
  if (p.tag === 'fountain') return fountainColumn(d, p);
  if (p.tag === 'poster') return posterColumn(t, cx, y0, cz, Math.min(w, dd) / 2, y1 - y0, d.detail);
  const iron = p.tag === 'hall' && w < 0.9 && y1 - y0 > 6;
  const color = iron ? '#2f5a3a' : p.tag === 'square' || p.tag === 'park' ? '#f2f2ee' : '#efe5cf';
  t.box(cx, y0, cz, w * 0.84, y1 - y0, dd * 0.84, color, iron ? 'metal' : undefined, 0.03);
  t.box(cx, y0, cz, w, Math.min(0.32, (y1 - y0) / 6), dd, shade(color, -0.12), undefined, 0.02);
  t.box(cx, y1 - Math.min(0.3, (y1 - y0) / 6), cz, w, Math.min(0.3, (y1 - y0) / 6), dd, shade(color, -0.12), undefined, 0.02);
  if (iron && d.detail > 0) for (const s of [-1, 1]) t.box(cx + s * w * 0.6, y1 - 1.6, cz, w * 0.4, 0.12, 0.12, color, 'metal', 0);
}

/** Advertising column: a green drum pasted with posters under a domed cap. */
function posterColumn(t: Pen, cx: number, y0: number, cz: number, r: number, h: number, detail: number) {
  t.cyl(cx, y0, cz, r, 0.3, '#2f5a3a', 'metal');
  t.cyl(cx, y0 + 0.3, cz, r - 0.06, h - 0.62, '#efe5cf');
  const posters = ['#c8231b', '#f6c624', '#1f62c7', '#2f8a3e', '#c43a85', '#f58a1f'];
  for (let i = 0; i < (detail === 0 ? 3 : 6); i++) {
    const a = (i / (detail === 0 ? 3 : 6)) * Math.PI * 2;
    t.box(cx + Math.sin(a) * (r - 0.04), y0 + 0.6, cz + Math.cos(a) * (r - 0.04), 0.42, 1.1, 0.03, posters[i]!, undefined, 0, a);
  }
  t.cyl(cx, y0 + h - 0.32, cz, r + 0.04, 0.12, '#2f5a3a', 'metal');
  t.cone(cx, y0 + h - 0.2, cz, r, 0.08, 0.2, '#2f5a3a', 'metal');
}

/** Bare concrete frame column with starter bars poking out of the top. */
function column(d: Drawer, p: Piece) {
  const t = new Pen(d, new Frame(0, 0, 0, 0));
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  t.span(x0, y0, z0, x1, y1, z1, '#b9b8b1', undefined, 0.02);
  if (d.detail === 0) return;
  for (const sx of [0.2, 0.6]) for (const sz of [0.2, 0.6]) t.box(x0 + sx, y1, z0 + sz, 0.04, 0.6, 0.04, '#8a5a3a', 'metal', 0);
}

/** Site cabin (two stacked when tall): blue or green ribbed walls, windows and a door, a flat roof. */
function cabin(d: Drawer, p: Piece) {
  const { f, len, wid, h: total } = pieceFrame(p);
  const t = new Pen(d, f);
  const levels = total > 4 ? 2 : 1;
  const h = total / levels;
  for (let k = 0; k < levels; k++) {
    const y = k * h;
    const [wall, rib] = k ? ['#2f8a3e', '#287a35'] : ['#2a5fa8', '#244f8a'];
    t.box(0, y, 0, len, h - 0.2, wid, wall, undefined, 0.02);
    t.box(0, y + h - 0.2, 0, len + 0.1, 0.2, wid + 0.1, '#e9e6dc', undefined, 0.02);
    for (const s of [-1, 1]) {
      for (let u = -len / 2 + 0.8; u < len / 2 - 0.4; u += 1.6) t.box(u, y + 1.1, s * (wid / 2 + 0.01), 0.9, 0.8, 0.04, '#2c3c4a', undefined, 0);
      if (d.detail > 0) for (let u = -len / 2 + 0.1; u < len / 2; u += 0.3) t.box(u, y + 0.1, s * (wid / 2 + 0.005), 0.06, h - 0.4, 0.02, rib, undefined, 0);
    }
    t.box(len / 2 - 0.02, y + 0.1, 0, 0.06, 2.1, 0.9, '#e9e6dc', undefined, 0.01);
  }
}

/** Tram shelter: a lit advert panel between posts (the glass roof is a roof piece). */
function shelter(d: Drawer, p: Piece) {
  const { f, len, wid, h } = pieceFrame(p);
  const t = new Pen(d, f);
  for (const u of [-len / 2 + 0.1, 0, len / 2 - 0.1]) t.box(u, 0, 0, 0.12, h, wid, '#2f363d', 'metal', 0.01);
  t.box(0, 0.1, 0, len - 0.2, h - 0.2, wid * 0.3, '#2f363d', 'metal', 0.01);
  for (const s of [-1, 1]) {
    t.box(-len / 4, 0.4, s * (wid * 0.15 + 0.01), len / 2 - 0.4, h - 0.9, 0.02, s > 0 ? '#f6c624' : '#c43a85', undefined, 0);
    t.box(len / 4, 0.4, s * (wid * 0.15 + 0.01), len / 2 - 0.4, h - 0.9, 0.02, s > 0 ? '#1fa7a0' : '#f58a1f', undefined, 0);
  }
}

/** Wall lanterns on brackets by the house doors (drawn only: nothing to bump into). */
function lanterns(d: Drawer, L: Layout) {
  for (const [x, z, turns] of L.lamps) {
    const t = new Pen(d, new Frame(x, 0, z, turns));
    t.box(0, 3.0, 0.2, 0.06, 0.06, 0.4, '#2f363d', 'metal', 0);
    t.box(0, 2.62, 0.38, 0.26, 0.36, 0.26, '#fff3d0', 'glass', 0.01);
    t.box(0, 2.7, 0.38, 0.12, 0.2, 0.12, '#ffe2a0', 'glow', 0);
    t.cone(0, 2.98, 0.38, 0.2, 0.04, 0.14, '#2f363d', 'metal');
  }
}

import { PLATE } from '../engine/geometry';
import { masonryFaces, slab, type Opening } from './blocks';
import type { Drawer, Element } from './plan';
import { Pen } from './props-kit';
import { faceFrame, Rng, shade, type Face, type PlanCollider } from './util';
import { drawRoof, roofHeight, type RoofKind } from './roofs';

export type ShopIcon = 'cup' | 'bread' | 'book' | 'flower' | 'fish' | 'key' | 'gem';

export interface BuildingParams {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Top of the walls. */
  height: number;
  /** The face that looks into the play area. */
  face: Face;
  wall: string[];
  trim: string;
  roof: RoofKind;
  roofColor: string;
  shop?: { awning: [string, string]; sign: string; icon: ShopIcon; door: string };
  /** Ground floor is an open colonnade (the arcade covers it). */
  noGroundFloor?: boolean;
  windows?: 'tall' | 'arched' | 'square';
  shutters?: string;
  balcony?: boolean;
  seed?: number;
}

export const STOREY = 3.36;
const BAY = 2.4;

interface Hole {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  kind: 'window' | 'shop' | 'door';
}

function holes(p: BuildingParams, length: number): Hole[] {
  const out: Hole[] = [];
  const bays = Math.max(1, Math.floor(length / BAY));
  const margin = (length - bays * BAY) / 2;
  const floors = Math.floor((p.height - 0.6) / STOREY);
  const ww = p.windows === 'square' ? 1.2 : 0.8;
  const wh = p.windows === 'square' ? 1.44 : 1.92;
  for (let f = 1; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const c = margin + (b + 0.5) * BAY;
      out.push({ u0: c - ww / 2, u1: c + ww / 2, y0: f * STOREY + 0.96, y1: f * STOREY + 0.96 + wh, kind: 'window' });
    }
  }
  if (p.noGroundFloor) return out;
  const doorBay = Math.floor(bays / 2);
  for (let b = 0; b < bays; b++) {
    const c = margin + (b + 0.5) * BAY;
    if (b === doorBay) out.push({ u0: c - 0.6, u1: c + 0.6, y0: 0.16, y1: 2.56, kind: 'door' });
    else if (p.shop) out.push({ u0: c - 0.8, u1: c + 0.8, y0: 0.64, y1: 2.56, kind: 'shop' });
    else out.push({ u0: c - ww / 2, u1: c + ww / 2, y0: 0.96, y1: 0.96 + wh, kind: 'window' });
  }
  return out;
}

function awningSpan(p: BuildingParams, length: number) {
  return { u0: 0.4, u1: length - 0.4, y0: 2.72, y1: 3.2, out: 1.2 };
}

export const BUILDING: Element<BuildingParams> = {
  colliders(p) {
    const { f, length } = faceFrame(p.face, p.x0, p.z0, p.x1, p.z1);
    const top = p.height + roofHeight(p.roof, p);
    const out: PlanCollider[] = [{ min: [p.x0, 0, p.z0], max: [p.x1, top, p.z1], surface: 'stone' }];
    if (p.shop) {
      const a = awningSpan(p, length);
      out.push(f.box([a.u0, a.y0, 0], [a.u1, a.y1, a.out], 'plastic', { bulletsPass: true }));
    }
    for (const h of holes(p, length)) {
      if (h.kind === 'window' && p.balcony && h.y0 > STOREY && h.y0 < STOREY * 2) {
        out.push(f.box([h.u0 - 0.5, h.y0 - 0.96, 0], [h.u1 + 0.5, h.y0 + 0.1, 0.8], 'metal'));
      }
    }
    return out;
  },
  draw(d, p) {
    const { f, length, along } = faceFrame(p.face, p.x0, p.z0, p.x1, p.z1);
    const t = new Pen(d, f);
    const rng = new Rng(p.seed ?? Math.round(p.x0 * 3 + p.z0 * 7));
    const hs = holes(p, length);
    const main = p.wall[0]!;
    const style = { colors: p.wall, variance: 0.26, lens: [4, 6, 3, 8] };
    const openings: Opening[] = hs.map((h) => ({ from: along(h.u0), to: along(h.u1), y0: h.y0, y1: h.y1 }));
    const depth = masonryFaces(d, [p.x0, 0.48, p.z0], [p.x1, p.height, p.z1], style, [p.face], { [p.face]: openings.map((o) => ({ ...o, y0: Math.max(o.y0, 0.48) })) });
    const inset = (side: Face) => (side === p.face ? depth : 0);
    slab(d, [p.x0 + inset('w'), 0, p.z0 + inset('n')], [p.x1 - inset('e'), p.height, p.z1 - inset('s')], shade(main, -0.3));
    let u = 0;
    for (const h of [...hs.filter((x) => x.kind === 'door').sort((a, b) => a.u0 - b.u0), { u0: length, u1: length }]) {
      if (h.u0 - u > 0.05) t.box((u + h.u0) / 2, 0, 0.02, h.u0 - u, 0.48, 0.08, shade(p.trim, -0.15), undefined, 0.02);
      u = h.u1;
    }
    const floors = Math.floor((p.height - 0.6) / STOREY);
    for (let k = 1; k < floors; k++) t.box(length / 2, k * STOREY - 0.08, 0.03, length, PLATE, 0.1, p.trim, undefined, 0.02);
    t.box(length / 2, p.height - 0.32, 0.08, length + 0.2, 0.32, 0.24, p.trim, undefined, 0.03);
    if (d.detail > 0) t.box(length / 2, p.height - 0.48, 0.04, length + 0.1, PLATE, 0.14, shade(p.trim, -0.1), undefined, 0.02);
    for (const h of hs) drawHole(t, d, p, h, rng);
    if (p.shop) drawShop(t, d, p, length);
    drawRoof(d, p);
  }
};

function drawHole(t: Pen, d: Drawer, p: BuildingParams, h: Hole, rng: Rng) {
  const w = h.u1 - h.u0;
  const hh = h.y1 - h.y0;
  const c = (h.u0 + h.u1) / 2;
  const frame = p.trim;
  if (d.detail === 0) {
    flatHole(t, p, h);
    return;
  }
  d.distant(() => flatHole(t, p, h));
  // The wall core stands just behind the brick fronts, so everything in an opening is layered in front of it.
  if (h.kind === 'door') {
    const door = p.shop?.door ?? '#6e4a2f';
    t.box(c, h.y0, -0.004, w - 0.08, hh - 0.04, 0.03, door, undefined, 0.008);
    if (d.detail >= 2) for (const y of [0.18, 0.56]) t.frame(c, h.y0 + hh * y * 0.62, 0.012, w - 0.34, hh * 0.24, 0.035, 0.012, shade(door, 0.12));
    t.box(c, h.y0 + hh * 0.5, 0.012, w - 0.4, hh * 0.38, 0.008, '#22303c', undefined, 0);
    t.box(c, h.y0 + hh * 0.5, 0.018, w - 0.4, hh * 0.38, 0.004, GLASS, 'glass', 0);
    t.ball(c + w / 2 - 0.18, h.y0 + 1.05, 0.03, 0.04, '#c99a3e', undefined, 0, 1, 'chrome');
    t.box(c, h.y0 - 0.16, 0.12, w + 0.3, PLATE, 0.36, shade(p.trim, -0.1), undefined, 0.01);
  } else {
    windowInside(t, d, h, rng);
    t.box(c, h.y0, 0.016, w, hh, 0.004, GLASS, 'glass', 0);
  }
  t.frame(c, h.y0, -0.02, w, hh, 0.08, 0.1, frame);
  if (h.kind !== 'door') {
    t.box(c, h.y0, 0.012, 0.05, hh, 0.03, frame, undefined, 0);
    if (h.kind === 'window' && d.detail >= 2) t.box(c, h.y0 + hh * 0.62, 0.012, w, 0.05, 0.03, frame, undefined, 0);
    t.box(c, h.y0 - 0.1, 0.06, w + 0.24, 0.1, 0.18, shade(p.trim, -0.08), undefined, 0.015);
  }
  if (h.kind === 'window') {
    if (p.windows === 'arched' && d.detail > 0) {
      t.box(c, h.y1, 0.02, w + 0.24, 0.16, 0.12, shade(p.trim, -0.05), undefined, 0.015);
      t.box(c, h.y1 + 0.16, 0.02, w * 0.5, 0.1, 0.12, shade(p.trim, -0.05), undefined, 0.015);
    } else t.box(c, h.y1, 0.02, w + 0.2, 0.14, 0.1, shade(p.trim, -0.12), undefined, 0.015);
    if (p.shutters) {
      const shutters = p.shutters;
      for (const s of [-1, 1]) {
        const sx = c + s * (w / 2 + 0.24);
        d.lasting(() => t.box(sx, h.y0, 0.04, 0.4, hh, 0.05, shutters, undefined, 0));
        if (d.detail >= 2) t.frame(sx, h.y0 + 0.06, 0.08, 0.34, hh - 0.12, 0.05, 0.04, shade(shutters, -0.12));
      }
    }
    if (p.balcony && h.y0 > STOREY && h.y0 < STOREY * 2) {
      const y = h.y0 - 0.96;
      d.lasting(() => {
        t.box(c, y, 0.4, w + 1.0, 0.12, 0.8, p.trim, undefined, 0.02);
        t.box(c, y - 0.16, 0.3, w + 0.6, 0.16, 0.5, shade(p.trim, -0.1), undefined, 0.02);
        t.box(c, y + 1.0, 0.78, w + 1.0, 0.06, 0.06, '#2f363d', 'metal', 0);
      });
      const bars = d.detail >= 2 ? 7 : 4;
      for (let k = 0; k <= bars; k++) t.box(h.u0 - 0.5 + (k * (w + 1.0)) / bars, y + 0.12, 0.78, 0.035, 0.88, 0.035, '#2f363d', 'metal', 0);
      for (const s of [-1, 1]) t.box(c + s * (w / 2 + 0.48), y + 0.12, 0.4, 0.035, 0.88, 0.76, '#2f363d', 'metal', 0);
    } else if (d.detail >= 2 && rng.chance(0.3) && h.y0 > STOREY) {
      t.box(c, h.y0 - 0.3, 0.18, w + 0.1, 0.22, 0.26, '#8a5f3a', undefined, 0.01);
      for (let k = 0; k < 4; k++) t.ball(c - w / 2 + 0.1 + k * ((w - 0.2) / 3), h.y0 - 0.02, 0.18, 0.1, rng.pick(['#c8231b', '#f6c624', '#f3a6c3', '#f2f2ee', '#c43a85']));
    }
  }
}

/**
 * An opaque room with a lit ceiling band, a frame, a mullion and a sill instead of see-through glass: the flat
 * tier's opening, and the far stand-in on the others.
 */
function flatHole(t: Pen, p: BuildingParams, h: Hole) {
  const w = h.u1 - h.u0;
  const hh = h.y1 - h.y0;
  const c = (h.u0 + h.u1) / 2;
  if (h.kind === 'door') t.box(c, h.y0, 0.01, w - 0.06, hh - 0.03, 0.04, p.shop?.door ?? '#6e4a2f', undefined, 0);
  else {
    t.box(c, h.y0, 0.01, w, hh, 0.04, '#2c3c4a', undefined, 0);
    t.box(c, h.y1 - hh * 0.22, 0.032, w, hh * 0.22, 0.004, '#4f6476', undefined, 0);
    t.box(c, h.y0, 0.045, 0.05, hh, 0.02, p.trim, undefined, 0);
    t.box(c, h.y0 - 0.08, 0.06, w + 0.2, 0.08, 0.14, shade(p.trim, -0.08), undefined, 0);
  }
  t.frame(c, h.y0, 0.03, w, hh, 0.08, 0.06, p.trim);
}

const GLASS = '#8fb9cf';
const CURTAINS = ['#f3e6b8', '#c8231b', '#2f6a8a', '#e8b84a', '#f2f2ee', '#7a9a4a'] as const;

/** A room seen through the glass: dark inside with a lit ceiling band, then drapes, a blind or shop goods. */
function windowInside(t: Pen, d: Drawer, h: Hole, rng: Rng) {
  const w = h.u1 - h.u0;
  const hh = h.y1 - h.y0;
  const c = (h.u0 + h.u1) / 2;
  t.box(c, h.y0, -0.006, w, hh, 0.016, '#23303b', undefined, 0);
  t.box(c, h.y1 - hh * 0.2, 0.0, w, hh * 0.2, 0.006, '#3b4f60', undefined, 0);
  if (h.kind === 'shop') {
    for (const y of [0.3, 0.78]) {
      t.box(c, h.y0 + y, 0.002, w - 0.06, 0.03, 0.01, '#d8cfbf', undefined, 0);
      for (let k = 0; k < 4; k++) t.box(c - w / 2 + 0.2 + k * ((w - 0.4) / 3), h.y0 + y + 0.03, 0.004, 0.16, rng.range(0.1, 0.24), 0.008, rng.pick(CURTAINS), undefined, 0);
    }
    return;
  }
  const look = rng.next();
  const cloth = rng.pick(CURTAINS);
  if (look < 0.55) {
    const drape = w * rng.range(0.2, 0.3);
    for (const s of [-1, 1]) t.box(c + s * (w - drape) / 2, h.y0 + 0.02, 0.006, drape, hh - 0.04, 0.006, cloth, undefined, 0);
    if (d.detail >= 2) t.box(c, h.y1 - 0.16, 0.009, w, 0.14, 0.006, shade(cloth, -0.12), undefined, 0);
  } else if (look < 0.85) {
    const down = hh * rng.range(0.3, 0.65);
    t.box(c, h.y1 - down, 0.006, w - 0.04, down, 0.006, '#e9e2d0', undefined, 0);
    t.box(c, h.y1 - down - 0.03, 0.009, w - 0.04, 0.03, 0.008, '#b8ad96', undefined, 0);
  }
}

function drawShop(t: Pen, d: Drawer, p: BuildingParams, length: number) {
  const shop = p.shop!;
  const a = awningSpan(p, length);
  const stripes = d.detail === 0 ? 1 : Math.max(2, Math.round((a.u1 - a.u0) / 0.4));
  const sw = (a.u1 - a.u0) / stripes;
  for (let i = 0; i < stripes; i++) {
    const color = d.detail === 0 ? shop.awning[0] : shop.awning[i % 2];
    t.prism('awn', [[0, 3.2], [1.2, 2.78], [1.2, 2.72], [0, 3.12]], sw, a.u0 + sw * (i + 0.5), 0, 0, color!);
    if (d.detail > 0) t.box(a.u0 + sw * (i + 0.5), 2.5, 1.18, sw - 0.01, 0.24, 0.04, shop.awning[(i + 1) % 2]!, undefined, 0.01);
  }
  const sx = length / 2;
  t.box(sx, 3.28, 0.06, Math.min(4.0, length - 1.2), 0.62, 0.12, shop.sign, undefined, 0.03);
  if (d.detail === 0) return;
  t.box(sx, 3.24, 0.04, Math.min(4.0, length - 1.2) + 0.12, 0.7, 0.08, shade(shop.sign, -0.3), undefined, 0.02);
  drawIcon(t, shop.icon, sx, 3.59, 0.14);
}

/** Simple pictogram plates on a shop sign (no lettering). */
function drawIcon(t: Pen, icon: ShopIcon, x: number, y: number, z: number) {
  const W = '#f2f2ee';
  const Y = '#f6c624';
  switch (icon) {
    case 'cup':
      t.box(x, y - 0.22, z, 0.32, 0.26, 0.04, W, undefined, 0.01);
      t.box(x + 0.21, y - 0.16, z, 0.1, 0.14, 0.04, W, undefined, 0.01);
      t.box(x, y - 0.27, z, 0.44, 0.04, 0.04, W, undefined, 0);
      break;
    case 'bread':
      t.box(x, y - 0.2, z, 0.5, 0.2, 0.04, Y, undefined, 0.04);
      for (const k of [-0.12, 0, 0.12]) t.box(x + k, y - 0.1, z + 0.02, 0.04, 0.08, 0.03, '#c99a3e', undefined, 0);
      break;
    case 'book':
      t.box(x - 0.13, y - 0.25, z, 0.24, 0.34, 0.04, W, undefined, 0.01);
      t.box(x + 0.13, y - 0.25, z, 0.24, 0.34, 0.04, W, undefined, 0.01);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) t.ball(x + Math.cos((i / 5) * Math.PI * 2) * 0.1, y - 0.12 + Math.sin((i / 5) * Math.PI * 2) * 0.1, z, 0.07, '#f3a6c3');
      t.ball(x, y - 0.12, z + 0.02, 0.06, Y);
      break;
    case 'fish':
      t.box(x, y - 0.18, z, 0.36, 0.16, 0.04, '#a7d8ef', undefined, 0.05);
      t.box(x - 0.24, y - 0.18, z, 0.1, 0.2, 0.04, '#a7d8ef', undefined, 0.02);
      break;
    case 'key':
      t.cylZ(x - 0.14, y - 0.12, z, 0.1, 0.04, Y);
      t.box(x + 0.06, y - 0.15, z, 0.32, 0.06, 0.04, Y, undefined, 0);
      t.box(x + 0.18, y - 0.22, z, 0.05, 0.08, 0.04, Y, undefined, 0);
      break;
    case 'gem':
      t.box(x, y - 0.3, z, 0.3, 0.12, 0.04, '#a7d8ef', undefined, 0.02);
      t.box(x, y - 0.18, z, 0.2, 0.1, 0.04, '#a7d8ef', undefined, 0.02);
      break;
  }
}


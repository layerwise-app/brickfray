import { T, type ModelBuilder } from '../builder';
import { box, slab, stud, tube, type Outline } from '../shapes';
import type { Surface } from '../surface';

/** Darker shade of a hex color for seams, slots and recesses. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Accessory rail on top (+Y) of a surface at (x, y, z) running along Z:
 * a base strip with crosswise ridges on detailed tiers.
 */
export function railTop(b: ModelBuilder, x: number, y: number, z0: number, z1: number, width: number, color: string) {
  const len = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  b.add(box(width, 0.004, len, b.lod.bevel * 0.5), color, 'satin', T(x, y + 0.002, zc));
  if (b.lod.third) return;
  const pitch = 0.0095;
  const n = Math.floor(len / pitch);
  const ridge = box(width * 1.14, 0.0035, pitch * 0.55);
  for (let i = 0; i < n; i++) {
    b.add(ridge, color, 'satin', T(x, y + 0.0055, zc - ((n - 1) / 2 - i) * pitch));
  }
}

/** Same rail on a side face; `side` +1 = right (+X), -1 = left. */
export function railSide(b: ModelBuilder, side: 1 | -1, x: number, y: number, z0: number, z1: number, height: number, color: string) {
  const len = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  b.add(box(0.004, height, len, b.lod.bevel * 0.5), color, 'satin', T(x + side * 0.002, y, zc));
  if (b.lod.third) return;
  const pitch = 0.0095;
  const n = Math.floor(len / pitch);
  const ridge = box(0.0035, height * 1.14, pitch * 0.55);
  for (let i = 0; i < n; i++) b.add(ridge, color, 'satin', T(x + side * 0.0055, y, zc - ((n - 1) / 2 - i) * pitch));
}

/**
 * A separate panel on both sides of a part `width` across, given by its side profile [z, y]: it stands `proud` of each
 * face with chamfered edges, so it reads as its own piece where a painted inset reads flat.
 */
export function sidePanel(b: ModelBuilder, outline: Outline, width: number, color: string, surface: Surface = 'rubber', proud = 0.0015) {
  b.add(slab(outline, width + proud * 2, b.lod, 0.003, [], b.detail >= 1 ? 0.0012 : 0), color, surface);
}

/** Grid of toy studs on an upward face, centered on (x, y, z). */
export function studGrid(b: ModelBuilder, x: number, y: number, z: number, nx: number, nz: number, pitch: number, r: number, color: string, surface: Surface = 'plastic') {
  const g = studShape(b, r);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      b.add(g, color, surface, T(x + (i - (nx - 1) / 2) * pitch, y, z + (j - (nz - 1) / 2) * pitch));
    }
  }
}

/** Studs on a side face (pointing ±X). */
export function studSide(b: ModelBuilder, side: 1 | -1, x: number, y: number, z: number, nz: number, pitch: number, r: number, color: string) {
  const g = studShape(b, r);
  for (let j = 0; j < nz; j++) b.add(g, color, 'plastic', T(x, y, z + (j - (nz - 1) / 2) * pitch, 0, 0, -side * Math.PI / 2));
}

function studShape(b: ModelBuilder, r: number) {
  const micro = r < 0.004;
  return stud(r, r * 0.62, micro ? Math.min(6, b.lod.segSmall) : b.lod.segSmall, !micro && b.detail >= 1);
}

/** Slotted screw head on a face whose normal is `axis`; only on the detailed tier. */
export function screw(b: ModelBuilder, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', r = 0.0028, color = '#9aa1a8') {
  if (b.detail < 2) return;
  const rot: [number, number, number] = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  b.add(tube(r, 0.0016, 8), color, 'metal', T(x, y, z, ...rot));
  const slot = axis === 'x' ? box(0.0022, r * 1.6, 0.0006) : axis === 'y' ? box(r * 1.6, 0.0022, 0.0006) : box(r * 1.6, 0.0006, 0.0022);
  b.add(slot, '#1c2229', 'dark', T(x, y, z));
}

/**
 * Worn edge: a hairline of bare, lighter material along an edge at (x, y) running from z0 to z1, where hands and holsters
 * rub the finish off; only on the detailed tiers.
 */
export function wear(b: ModelBuilder, x: number, y: number, z0: number, z1: number, color: string, k = 1.75, surface: Surface = 'metal') {
  if (b.detail < 1) return;
  b.add(box(0.0013, 0.0013, Math.abs(z1 - z0)), shade(color, k), surface, T(x, y, (z0 + z1) / 2));
}

/** A dark recessed-looking slot: a thin dark plate standing proud of a face. */
export function slot(b: ModelBuilder, x: number, y: number, z: number, w: number, h: number, d: number, color = '#20262c') {
  b.add(box(w, h, d), color, 'dark', T(x, y, z));
}

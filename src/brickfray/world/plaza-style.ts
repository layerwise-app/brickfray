import { drawBlock, type Masonry, type Top } from './blocks';
import type { Drawer } from './plan';
import type { Piece } from './plaza-layout';
import { shade, type Face, type Vec3 } from './util';

export const STONE: Masonry = { colors: ['#e3d6bc', '#d6c7a8', '#efe5cf'], variance: 0.3 };
export const BRICK: Masonry = { colors: ['#b44a31', '#c4553a', '#a8452e'], variance: 0.25 };
export const DARK_BRICK: Masonry = { colors: ['#8a3b2a', '#7a3324', '#96442f'], variance: 0.22 };
export const CONCRETE: Masonry = { colors: ['#b9b8b1', '#aaa9a2', '#c5c4bc'], variance: 0.16, lens: [6, 8] };
export const BLOCKWORK: Masonry = { colors: ['#cfcabd', '#c0bbad', '#d8d3c6'], variance: 0.12, lens: [6] };
export const TIMBER: Masonry = { colors: ['#9a6a3f', '#8a5f3a', '#a8774a'], variance: 0.18, lens: [8, 12], course: 0.32 };
export const QUAY: Masonry = { colors: ['#a6abaf', '#9a9fa3', '#b3b8bb'], variance: 0.2, lens: [4, 6] };

export const plaster = (c: string): Masonry => ({ colors: [c, shade(c, 0.05), shade(c, -0.05)], variance: 0.12, lens: [6, 8] });

export const ROOF_RED = '#a8321f';
export const TRIM = '#efe5cf';
export const IRON = '#2f363d';
export const WOOD = '#8a5f3a';
export const BLOOMS = ['#c8231b', '#f6c624', '#f3a6c3', '#f2f2ee', '#c43a85', '#f58a1f'];

/** Masonry for a wall-like piece by district. */
export function styleOf(p: Piece): Masonry {
  if (p.surface === 'wood') return TIMBER;
  switch (p.tag) {
    case 'hall':
    case 'shed':
    case 'park':
      return BRICK;
    case 'bakery':
      return plaster('#f2c94c');
    case 'laundrette':
      return plaster('#7fc8e8');
    case 'site':
      return BLOCKWORK;
    case 'canal':
      return QUAY;
    case 'stalls':
      return TIMBER;
    default:
      return STONE;
  }
}

/** A masonry box: brick faces on the given sides, a plate cap when it is low enough to look down on. */
export function masonryBox(d: Drawer, min: Vec3, max: Vec3, style: Masonry, faces?: Face[], top: Top = 'none', topColor?: string) {
  drawBlock(d, { min, max, surface: 'stone', style, faces, top, topColor });
}

/** Faces worth dressing on a thin piece: the long sides, plus the ends when it is not paper thin. */
export function sidesOf(min: Vec3, max: Vec3): Face[] {
  const w = max[0] - min[0];
  const dd = max[2] - min[2];
  const long: Face[] = w >= dd ? ['n', 's'] : ['e', 'w'];
  const ends: Face[] = w >= dd ? ['e', 'w'] : ['n', 's'];
  return Math.min(w, dd) >= 0.3 ? [...long, ...ends] : long;
}

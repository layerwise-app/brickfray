import * as THREE from 'three';
import { PITCH, PLATE } from '../engine/geometry';
import type { Finish } from '../engine/materials';
import { partGeo, unitBox } from './geo';
import { brickFace, type FaceRect } from './masonry';
import type { Drawer, Element } from './plan';
import type { Surface } from './types';
import { box, Frame, hashString, shade, type Face, type PlanCollider, type Vec3 } from './util';

export type { Face };
export const ALL_FACES: Face[] = ['n', 's', 'e', 'w'];

export interface Masonry {
  /** Main color first; the rest are occasional variants. */
  colors: string[];
  variance?: number;
  finish?: Finish;
  lens?: number[];
  course?: number;
  /** Color showing in the seams (the wall core). */
  seam?: string;
}

/** Hole in a face: `from`/`to` along the face axis (x for n/s, z for e/w), y in world meters. */
export interface Opening {
  from: number;
  to: number;
  y0: number;
  y1: number;
}

export type Top = 'ground' | 'studs' | 'tiles' | 'none';

export interface BlockParams {
  min: Vec3;
  max: Vec3;
  surface: Surface;
  style: Masonry;
  faces?: Face[];
  top?: Top;
  topColor?: string;
  openings?: Partial<Record<Face, Opening[]>>;
  walk?: boolean;
  /** false draws it without a collider (only for parts players can never touch). */
  solid?: boolean;
  bulletsPass?: boolean;
}

/** Plain colored box: low tier stand-in for anything, or trims and panels on every tier. */
export function slab(d: Drawer, min: Vec3, max: Vec3, color: string, finish: Finish = 'plastic') {
  const w = max[0] - min[0];
  const h = max[1] - min[1];
  const dd = max[2] - min[2];
  if (w <= 0 || h <= 0 || dd <= 0) return;
  d.b.custom('ubox', unitBox, (min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2, { color, finish, scale: new THREE.Vector3(w, h, dd) });
}

/** Plates covering a rectangle at height y (bottom), studded or smooth. */
export function plates(d: Drawer, x0: number, z0: number, x1: number, z1: number, y: number, color: string, studs: boolean, finish: Finish = 'plastic') {
  const W = Math.round((x1 - x0) / PITCH);
  const D = Math.round((z1 - z0) / PITCH);
  const snapped = Math.abs(W * PITCH - (x1 - x0)) < 0.01 && Math.abs(D * PITCH - (z1 - z0)) < 0.01;
  if (d.detail === 0 || !snapped || W * D > 900) {
    slab(d, [x0, y, z0], [x1, y + PLATE, z1], color, finish);
    return;
  }
  const alongX = W >= D;
  const across = alongX ? D : W;
  const along = alongX ? W : D;
  const rowW = across <= 4 ? across : 4;
  let row = 0;
  for (let a0 = 0; a0 < across; a0 += rowW, row++) {
    const aw = Math.min(rowW, across - a0);
    let pos = row % 2 ? -2 : 0;
    while (pos < along) {
      const start = Math.max(0, pos);
      const end = Math.min(along, pos + 6);
      const len = end - start;
      if (len > 0) {
        const pw = alongX ? len : aw;
        const pd = alongX ? aw : len;
        const cx = alongX ? x0 + (start + len / 2) * PITCH : x0 + (a0 + aw / 2) * PITCH;
        const cz = alongX ? z0 + (a0 + aw / 2) * PITCH : z0 + (start + len / 2) * PITCH;
        d.b.custom(`part:${pw}:${pd}:1:${studs}`, () => partGeo(pw, pd, 1, studs, d.profile), cx, y, cz, { color, finish });
      }
      pos += 6;
    }
  }
}

interface FacePlacement {
  frame: Frame;
  length: number;
  toU: (a: number) => number;
}

function facePlacement(face: Face, x0: number, y0: number, z0: number, x1: number, z1: number, depth: number): FacePlacement {
  switch (face) {
    case 's':
      return { frame: new Frame(x0, y0, z1 - depth, 0), length: x1 - x0, toU: (a) => a - x0 };
    case 'n':
      return { frame: new Frame(x1, y0, z0 + depth, 2), length: x1 - x0, toU: (a) => x1 - a };
    case 'e':
      return { frame: new Frame(x1 - depth, y0, z1, 1), length: z1 - z0, toU: (a) => z1 - a };
    case 'w':
      return { frame: new Frame(x0 + depth, y0, z0, 3), length: z1 - z0, toU: (a) => a - z0 };
  }
}

/** Brick-coursed faces of a box (no core, no top); used by blocks and façades. */
export function masonryFaces(d: Drawer, min: Vec3, max: Vec3, style: Masonry, faces: Face[], openings: Partial<Record<Face, Opening[]>> = {}) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const depth = Math.max(d.profile.bevel * 1.6, 0.018);
  const course = style.course ?? 0.48;
  const flat = d.detail === 0;
  const colors = flat ? [...style.colors, ...style.colors.map((c) => shade(c, -0.07))] : style.colors;
  const seedBase = hashString(`${x0},${y0},${z0},${x1},${y1},${z1}`);
  for (const face of faces) {
    const fp = facePlacement(face, x0, y0, z0, x1, z1, depth);
    const holes: FaceRect[] = (openings[face] ?? []).map((o) => {
      const a = fp.toU(o.from);
      const b = fp.toU(o.to);
      return { u0: Math.min(a, b), u1: Math.max(a, b), v0: o.y0 - y0, v1: o.y1 - y0 };
    });
    const groups = brickFace({
      length: fp.length,
      height: y1 - y0,
      depth,
      course,
      lens: style.lens,
      openings: holes,
      seed: seedBase + face.charCodeAt(0),
      groups: style.colors.length,
      variance: style.variance ?? 0.22,
      firstCourse: Math.round(y0 / course),
      flat
    });
    groups.forEach((g, i) => {
      if (!g) return;
      const key = d.uid('face');
      d.put(fp.frame, key, () => g, 0, 0, 0, { color: colors[i]!, finish: style.finish });
    });
  }
  return depth;
}

export function drawBlock(d: Drawer, p: BlockParams) {
  const [x0, y0, z0] = p.min;
  const [x1, y1, z1] = p.max;
  const main = p.style.colors[0]!;
  const top = p.top === 'ground' && y0 > 0.01 ? 'tiles' : (p.top ?? 'none');
  const plateTop = top === 'studs' || top === 'tiles';
  const bodyTop = y1 - (plateTop ? PLATE : 0) - (top === 'ground' ? 0.012 : 0);
  const faces = p.faces ?? ALL_FACES;
  if (faces.length === 0) {
    slab(d, [x0, y0, z0], [x1, bodyTop, z1], main, p.style.finish);
  } else {
    const depth = masonryFaces(d, p.min, [x1, bodyTop, z1], p.style, faces, p.openings);
    const inset = (f: Face) => (faces.includes(f) ? depth : 0);
    slab(d, [x0 + inset('w'), y0, z0 + inset('n')], [x1 - inset('e'), bodyTop, z1 - inset('s')], p.style.seam ?? shade(main, -0.28), p.style.finish);
  }
  const topColor = p.topColor ?? main;
  if (top === 'ground') d.ground.push({ x0: x0 + 0.02, z0: z0 + 0.02, x1: x1 - 0.02, z1: z1 - 0.02, y: y1, color: topColor });
  else if (plateTop) plates(d, x0, z0, x1, z1, bodyTop, topColor, top === 'studs' && d.detail > 0);
}

/** Studded floor in a two-colour checker of `cell`-metre squares (on the stud grid), raised to `y` with no side walls. */
export function checkerFloor(d: Drawer, x0: number, z0: number, x1: number, z1: number, y: number, colors: [string, string], cell: number) {
  for (let i = 0, x = x0; x < x1 - 0.01; i++, x += cell) {
    for (let j = 0, z = z0; z < z1 - 0.01; j++, z += cell) {
      d.ground.push({ x0: x, z0: z, x1: Math.min(x1, x + cell), z1: Math.min(z1, z + cell), y, base: y, color: colors[(i + j) % 2]! });
    }
  }
}

export const BLOCK: Element<BlockParams> = {
  colliders: (p) => (p.solid === false ? [] : [box(p.min, p.max, p.surface, { walk: p.walk, bulletsPass: p.bulletsPass })]),
  draw: drawBlock
};

export interface StairParams {
  /** Center of the bottom edge of the first step. */
  x: number;
  z: number;
  y0: number;
  /** Direction of travel going up. */
  dir: Face;
  width: number;
  steps: number;
  rise: number;
  run: number;
  style: Masonry;
  surface: Surface;
  top?: Top;
  topColor?: string;
}

const DIRS: Record<Face, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const BACK: Record<Face, Face> = { n: 's', s: 'n', e: 'w', w: 'e' };

function stepBox(p: StairParams, i: number): [Vec3, Vec3] {
  const [dx, dz] = DIRS[p.dir];
  const a = i * p.run;
  const b = (i + 1) * p.run;
  const hw = p.width / 2;
  const xa = p.x + dx * a + (dz !== 0 ? -hw : 0);
  const xb = p.x + dx * b + (dz !== 0 ? hw : 0);
  const za = p.z + dz * a + (dx !== 0 ? -hw : 0);
  const zb = p.z + dz * b + (dx !== 0 ? hw : 0);
  return [
    [Math.min(xa, xb), p.y0, Math.min(za, zb)],
    [Math.max(xa, xb), p.y0 + (i + 1) * p.rise, Math.max(za, zb)]
  ];
}

export const STAIRS: Element<StairParams> = {
  colliders(p) {
    const out: PlanCollider[] = [];
    for (let i = 0; i < p.steps; i++) {
      const [min, max] = stepBox(p, i);
      out.push(box(min, max, p.surface));
    }
    return out;
  },
  draw(d, p) {
    const sides: Face[] = p.dir === 'n' || p.dir === 's' ? ['e', 'w'] : ['n', 's'];
    for (let i = 0; i < p.steps; i++) {
      const [min, max] = stepBox(p, i);
      drawBlock(d, { min, max, surface: p.surface, style: p.style, faces: [BACK[p.dir], ...sides], top: p.top ?? 'tiles', topColor: p.topColor });
    }
  },
  nav(p) {
    const [dx, dz] = DIRS[p.dir];
    const len = p.steps * p.run;
    const out: Vec3[] = [[p.x - dx * 0.7, p.y0, p.z - dz * 0.7]];
    const n = Math.max(1, Math.ceil(len / 2.8));
    for (let k = 1; k <= n; k++) {
      const t = Math.min(len - p.run / 2, (k / n) * len);
      const i = Math.floor(t / p.run);
      out.push([p.x + dx * t, p.y0 + (i + 1) * p.rise, p.z + dz * t]);
    }
    out.push([p.x + dx * (len + 0.7), p.y0 + p.steps * p.rise, p.z + dz * (len + 0.7)]);
    return out;
  }
};

export interface GroundParams {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  color: string;
  surface: Surface;
  smooth?: boolean;
  /** Collider thickness below the surface. */
  depth?: number;
  walk?: boolean;
}

export const GROUND: Element<GroundParams> = {
  colliders: (p) => [box([p.x0, p.y - (p.depth ?? 2), p.z0], [p.x1, p.y, p.z1], p.surface, { walk: p.walk ?? true })],
  draw: (d, p) => d.ground.push({ x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, y: p.y, color: p.color, smooth: p.smooth })
};

/** Ground paint that adds no collider (it sits on another ground tile). */
export const DECAL: Element<GroundParams> = {
  draw: (d, p) => d.ground.push({ x0: p.x0, z0: p.z0, x1: p.x1, z1: p.z1, y: p.y, color: p.color, smooth: p.smooth })
};

export const WATER: Element<{ x0: number; z0: number; x1: number; z1: number; y: number; color: string }> = {
  draw: (d, p) => d.anim.water(p.x0, p.z0, p.x1, p.z1, p.y, p.color)
};

/** Purely visual one-off drawing (never something players can touch). */
export const VISUAL: Element<(d: Drawer) => void> = {
  draw: (d, fn) => fn(d)
};

import type * as THREE from 'three';
import { BRICK, PITCH } from '../engine/geometry';
import { Mesher, V } from './geo';
import { Rng } from './util';

/** Rectangle on a wall face: u along the face, v up from its bottom, meters. */
export interface FaceRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface FaceSpec {
  length: number;
  height: number;
  /** Relief of each brick in front of the wall core, also its bevel. */
  depth: number;
  course?: number;
  /** Brick lengths to pick from, in studs. */
  lens?: number[];
  openings?: FaceRect[];
  seed: number;
  /** Color groups; bricks pick a non-zero group with probability `variance`. */
  groups: number;
  variance: number;
  /** Course index of v = 0, so faces stacked on each other keep the bond. */
  firstCourse?: number;
}

const GAP = 0.003;
const HEAD = 0.012;

function subtract(rects: FaceRect[], hole: FaceRect): FaceRect[] {
  const out: FaceRect[] = [];
  for (const r of rects) {
    if (hole.u1 <= r.u0 || hole.u0 >= r.u1 || hole.v1 <= r.v0 || hole.v0 >= r.v1) {
      out.push(r);
      continue;
    }
    if (hole.u0 > r.u0) out.push({ u0: r.u0, v0: r.v0, u1: hole.u0, v1: r.v1 });
    if (hole.u1 < r.u1) out.push({ u0: hole.u1, v0: r.v0, u1: r.u1, v1: r.v1 });
    const cu0 = Math.max(r.u0, hole.u0);
    const cu1 = Math.min(r.u1, hole.u1);
    if (hole.v0 > r.v0) out.push({ u0: cu0, v0: r.v0, u1: cu1, v1: hole.v0 });
    if (hole.v1 < r.v1) out.push({ u0: cu0, v0: hole.v1, u1: cu1, v1: r.v1 });
  }
  return out;
}

/** One brick front: a face with bevelled bed joints; head joints are plain gaps showing the core. */
function brick(m: Mesher, r: FaceRect, depth: number) {
  const u0 = r.u0 + HEAD;
  const u1 = r.u1 - HEAD;
  const v0 = r.v0 + GAP;
  const v1 = r.v1 - GAP;
  const b = Math.min(depth, (v1 - v0) * 0.3);
  const center = V((u0 + u1) / 2, (v0 + v1) / 2, -1);
  const f = [V(u0, v0 + b, depth), V(u1, v0 + b, depth), V(u1, v1 - b, depth), V(u0, v1 - b, depth)];
  m.poly(f, center);
  m.poly([V(u0, v0, 0), V(u1, v0, 0), f[1]!, f[0]!], center);
  m.poly([f[3]!, f[2]!, V(u1, v1, 0), V(u0, v1, 0)], center);
}

/**
 * Running-bond brick fronts for one wall face, split into color groups.
 * Local frame: u = +x, v = +y, the face looks along +z from z = 0 to `depth`.
 */
export function brickFace(spec: FaceSpec): (THREE.BufferGeometry | null)[] {
  const course = spec.course ?? BRICK;
  const lens = spec.lens ?? [4, 4, 6, 3, 8];
  const rng = new Rng(spec.seed);
  const meshers = Array.from({ length: spec.groups }, () => new Mesher());
  const L = spec.length / PITCH;
  let prev = new Set<number>();
  const courses = Math.ceil(spec.height / course - 1e-3);
  for (let k = 0; k < courses; k++) {
    const v0 = k * course;
    const v1 = Math.min(spec.height, v0 + course);
    if (v1 - v0 < 0.04) break;
    const joints = new Set<number>();
    let pos = 0;
    let first = true;
    const odd = ((spec.firstCourse ?? 0) + k) % 2 === 1;
    while (pos < L - 1e-3) {
      let len = first && odd ? rng.pick([1, 2]) : rng.pick(lens);
      first = false;
      let end = Math.min(L, pos + len);
      if (end < L - 1e-3 && prev.has(Math.round(end))) end = Math.min(L, end + 1);
      if (L - end > 0 && L - end < 1) end = L;
      len = end - pos;
      joints.add(Math.round(end));
      let rects: FaceRect[] = [{ u0: pos * PITCH, v0, u1: end * PITCH, v1 }];
      for (const hole of spec.openings ?? []) rects = subtract(rects, hole);
      const group = spec.groups > 1 && rng.chance(spec.variance) ? 1 + Math.floor(rng.next() * (spec.groups - 1)) : 0;
      for (const r of rects) if (r.u1 - r.u0 > 0.06 && r.v1 - r.v0 > 0.06) brick(meshers[group]!, r, spec.depth);
      pos = end;
    }
    prev = joints;
  }
  return meshers.map((m) => (m.pos.length ? m.build() : null));
}

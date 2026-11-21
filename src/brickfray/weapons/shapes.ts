import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { chamferBox, normalizeGeometry } from '../engine/geometry';

/** Geometry detail for one model build; derived from the quality tier and view. */
export interface Lod {
  /** 0 = clean low-poly, 1 = extra parts, 2 = bevels, screws, seams, knurling. */
  detail: 0 | 1 | 2;
  bevel: number;
  /** Radial segments for barrels and tubes, and for small round parts. */
  seg: number;
  segSmall: number;
  /** Subdivisions per rounded corner of an extruded outline. */
  curve: number;
  /** Real glass lenses (first person) or opaque tinted lenses (third person). */
  glass: boolean;
  /** Small functional parts (pins, buttons, knobs) that vanish at third-person distance. */
  minor: boolean;
  /** Third-person build: moving parts other than the magazine and pin are baked in. */
  third: boolean;
}

const cache = new Map<string, THREE.BufferGeometry>();

let active: Lod | null = null;

/** Builders run synchronously; shapes made meanwhile drop bevels and segments the tier can't afford. */
export function useLod(lod: Lod | null) {
  active = lod;
}

/** Runs `make` with the tier's segment budget raised to at least `seg`: for the few round parts that fill the screen. */
export function rounder<T>(seg: number, make: () => T): T {
  const was = active;
  if (was && was.seg < seg) active = { ...was, seg };
  const made = make();
  active = was;
  return made;
}

function segs(seg: number) {
  return active ? Math.max(4, Math.min(seg, active.seg)) : seg;
}

function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = dropDegenerate(normalizeGeometry(make()));
    cache.set(key, g);
  }
  return g;
}

const ta = new THREE.Vector3();
const tb = new THREE.Vector3();
const tc = new THREE.Vector3();

/** Lathes and caps produce zero-area triangles at the axis; they only cost vertex work. */
function dropDegenerate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const keep: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    ta.fromBufferAttribute(pos, i);
    tb.fromBufferAttribute(pos, i + 1).sub(ta);
    tc.fromBufferAttribute(pos, i + 2).sub(ta);
    if (tb.cross(tc).lengthSq() > 1e-16) keep.push(i);
  }
  if (keep.length * 3 === pos.count) return g;
  const p = new Float32Array(keep.length * 9);
  const n = new Float32Array(keep.length * 9);
  keep.forEach((start, k) => {
    for (let j = 0; j < 9; j++) {
      p[k * 9 + j] = (pos.array as Float32Array)[start * 3 + j]!;
      n[k * 9 + j] = (nor.array as Float32Array)[start * 3 + j]!;
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.dispose();
  return out;
}

export function box(w: number, h: number, d: number, bevel = 0): THREE.BufferGeometry {
  if (active && active.bevel === 0 && active.detail === 0) bevel = 0;
  return cached(`box:${w}:${h}:${d}:${bevel}`, () => chamferBox(w, h, d, bevel));
}

/**
 * A solid of revolution around Z. `profile` is [radius, z] in either winding;
 * faces always point out of the solid. Corners sharper than the crease stay crisp.
 */
export function latheZ(profile: readonly (readonly [number, number])[], seg: number): THREE.BufferGeometry {
  seg = segs(seg);
  const key = `lathe:${seg}:${profile.map((p) => p.join(',')).join(';')}`;
  return cached(key, () => {
    // LatheGeometry faces point outward only for a counter-clockwise (r, z) outline.
    const area = profile.reduce((sum, [r, z], i) => {
      const [r2, z2] = profile[(i + 1) % profile.length]!;
      return sum + r * z2 - r2 * z;
    }, 0);
    const ordered = area < 0 ? [...profile].reverse() : profile;
    const pts = ordered.map(([r, z]) => new THREE.Vector2(Math.max(r, 0), z));
    const g = new THREE.LatheGeometry(pts, Math.max(4, seg));
    g.rotateX(Math.PI / 2);
    return toCreasedNormals(g, Math.min(1.2, Math.max(0.5, ((Math.PI * 2) / seg) * 1.25)));
  });
}

/** Closed cylinder along Z centered on the origin, with optional rounded rims. */
export function tube(r: number, length: number, seg: number, edge = 0, r2 = r): THREE.BufferGeometry {
  seg = segs(seg);
  const h = length / 2;
  const e = seg >= 12 ? Math.min(edge, r * 0.45, r2 * 0.45, length * 0.3) : 0;
  const profile: [number, number][] = [[0, h]];
  if (e > 0) {
    profile.push([r - e, h], [r - e * 0.3, h - e * 0.3], [r, h - e], [r2, -h + e], [r2 - e * 0.3, -h + e * 0.3], [r2 - e, -h]);
  } else {
    profile.push([r, h], [r2, -h]);
  }
  profile.push([0, -h]);
  return latheZ(profile, seg);
}

/** A hollow pipe along Z (barrels with a visible bore). */
export function pipe(rOuter: number, rInner: number, length: number, seg: number): THREE.BufferGeometry {
  const h = length / 2;
  return latheZ(
    [
      [rInner, -h + 0.002],
      [rInner, h],
      [rOuter, h],
      [rOuter, -h],
      [rInner, -h]
    ],
    seg
  );
}

/** Ridged cylinder along Z: knurled knobs, fluting and grip rings. */
export function gear(rInner: number, rOuter: number, teeth: number, length: number): THREE.BufferGeometry {
  return cached(`gear:${rInner}:${rOuter}:${teeth}:${length}`, () => {
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOuter : rInner;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -length / 2);
    return toCreasedNormals(g, 0.3);
  });
}

export function torus(radius: number, thickness: number, seg: number, arc = Math.PI * 2): THREE.BufferGeometry {
  seg = segs(seg);
  return cached(`torus:${radius}:${thickness}:${seg}:${arc}`, () =>
    new THREE.TorusGeometry(radius, thickness, Math.max(4, Math.round(seg / 2)), seg, arc)
  );
}

export function ball(r: number, seg: number): THREE.BufferGeometry {
  seg = segs(seg);
  return cached(`ball:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(3, Math.round(seg * 0.6))));
}

/** Toy stud standing on the origin along +Y, rounded top rim on detailed tiers. */
export function stud(r: number, h: number, seg: number, rounded: boolean): THREE.BufferGeometry {
  return cached(`stud:${r}:${h}:${seg}:${rounded}`, () => {
    const e = rounded ? Math.min(r * 0.25, h * 0.4) : 0;
    const pts = [new THREE.Vector2(r, 0)];
    if (e > 0) pts.push(new THREE.Vector2(r, h - e), new THREE.Vector2(r - e * 0.35, h - e * 0.35), new THREE.Vector2(r - e, h));
    else pts.push(new THREE.Vector2(r, h));
    pts.push(new THREE.Vector2(0, h));
    return toCreasedNormals(new THREE.LatheGeometry(pts, seg), 0.9);
  });
}

export type Outline = readonly (readonly [number, number])[];

/**
 * A side profile extruded across X (centered). Outline points are [z, y] in
 * model space; `round` rounds every corner (or per corner) by that distance.
 * `chamfer` cuts every edge of both faces at 45° by at least that much (the tier's bevel otherwise).
 */
export function slab(outline: Outline, width: number, lod: Lod, round: number | readonly number[] = 0, holes: Outline[] = [], chamfer = 0): THREE.BufferGeometry {
  const key = `slab:${width}:${lod.bevel}:${lod.curve}:${chamfer}:${JSON.stringify(round)}:${JSON.stringify(outline)}:${JSON.stringify(holes)}`;
  return cached(key, () => {
    const g = extrude(outline, width, lod, round, holes, chamfer);
    g.rotateY(-Math.PI / 2);
    return toCreasedNormals(g, lod.curve >= 6 ? 0.36 : 0.44);
  });
}

/** Same as `slab` but extruded along Z (a front cross-section [x, y]). */
export function prism(outline: Outline, length: number, lod: Lod, round: number | readonly number[] = 0, holes: Outline[] = [], chamfer = 0): THREE.BufferGeometry {
  const key = `prism:${length}:${lod.bevel}:${lod.curve}:${chamfer}:${JSON.stringify(round)}:${JSON.stringify(outline)}:${JSON.stringify(holes)}`;
  return cached(key, () => toCreasedNormals(extrude(outline, length, lod, round, holes, chamfer), lod.curve >= 6 ? 0.36 : 0.44));
}

function extrude(outline: Outline, depth: number, lod: Lod, round: number | readonly number[], holes: Outline[], chamfer: number) {
  const shape = roundedShape(outline, lod.curve <= 1 ? 0 : round);
  for (const hole of holes) shape.holes.push(roundedShape(hole, lod.curve <= 1 ? 0 : round));
  const b = Math.min(Math.max(lod.bevel, chamfer), depth * 0.3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - b * 2,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: 1,
    curveSegments: Math.max(1, lod.curve)
  });
  g.translate(0, 0, -(depth - b * 2) / 2);
  return g;
}

function roundedShape(points: Outline, round: number | readonly number[]) {
  const shape = new THREE.Shape();
  const n = points.length;
  const P = new THREE.Vector2();
  const A = new THREE.Vector2();
  const B = new THREE.Vector2();
  for (let i = 0; i < n; i++) {
    P.set(points[i]![0], points[i]![1]);
    A.set(points[(i + n - 1) % n]![0], points[(i + n - 1) % n]![1]);
    B.set(points[(i + 1) % n]![0], points[(i + 1) % n]![1]);
    const want = typeof round === 'number' ? round : (round[i] ?? 0);
    const r = Math.min(want, P.distanceTo(A) * 0.5, P.distanceTo(B) * 0.5);
    const a = A.clone().sub(P).normalize().multiplyScalar(r).add(P);
    const b = B.clone().sub(P).normalize().multiplyScalar(r).add(P);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    if (r > 0) shape.quadraticCurveTo(P.x, P.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

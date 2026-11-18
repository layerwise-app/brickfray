import * as THREE from 'three';
import { normalizeGeometry } from '../../engine/geometry';
import type { PartOptions, PartSet } from '../parts';
import * as S from '../shapes';
import type { BoneName, V3 } from '../skeleton';

export type Surface = (u: number, v: number) => V3;

export const TAU = Math.PI * 2;
const a = new THREE.Vector3();
const c = new THREE.Vector3();
const n = new THREE.Vector3();

/** A count for the medium, high and showroom tiers. */
export const pick = (b: PartSet, medium: number, high: number, hero: number) => (b.hero ? hero : b.detail > 1 ? high : medium);

/** n+1 samples over 0…1; `edge` adds a tight pair at each end so a cloth border comes out round. */
export function samples(count: number, edge = 0) {
  const out = Array.from({ length: count + 1 }, (_, i) => i / count);
  if (edge > 0) out.push(edge * 0.3, edge, 1 - edge, 1 - edge * 0.3);
  return [...new Set(out)].sort((x, y) => x - y);
}

/** Samples around a closed loop: 0 up to, not including, 1. */
export function loop(count: number) {
  return Array.from({ length: count }, (_, i) => i / count);
}

/** Smooth grid surface through f(u, v); its face looks along du × dv unless flipped. */
export function surface(us: number[], vs: number[], f: Surface, closed = false, flip = false) {
  const nv = vs.length;
  const pos: number[] = [];
  for (const u of us) for (const v of vs) pos.push(...f(u, v));
  const index: number[] = [];
  for (let i = 0; i < (closed ? us.length : us.length - 1); i++) {
    for (let j = 0; j < nv - 1; j++) {
      const p = i * nv + j;
      const q = ((i + 1) % us.length) * nv + j;
      if (flip) index.push(p, p + 1, q, q, p + 1, q + 1);
      else index.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return normalizeGeometry(g);
}

export interface ClothOptions {
  /** The surface closes on itself around u. */
  closed?: boolean;
  flip?: boolean;
  /** Border width in u and v over which the two faces meet in a rounded edge. */
  round?: [number, number];
  /** The v range that gets an inner face (the rest is never seen from behind). */
  lined?: [number, number];
}

/**
 * Cloth with thickness: the outer face follows f, the inner face (for a
 * lining color) sits `thick` behind it and meets it at the open borders.
 */
export function cloth(us: number[], vs: number[], f: Surface, thick: number, o: ClothOptions = {}) {
  const [ru, rv] = o.round ?? [0.04, 0.04];
  const h = 1e-3;
  const wrap = (u: number) => (o.closed ? (u + 1) % 1 : Math.min(1, Math.max(0, u)));
  const inner: Surface = (u, v) => {
    const p = f(u, v);
    a.set(...f(wrap(u + h), v)).sub(c.set(...f(wrap(u - h), v)));
    n.set(...f(u, Math.min(1, v + h))).sub(c.set(...f(u, Math.max(0, v - h))));
    n.crossVectors(a, n);
    if (n.lengthSq() < 1e-16) return p;
    const edge = Math.min(v / rv, (1 - v) / rv, o.closed ? 1 : u / ru, o.closed ? 1 : (1 - u) / ru, 1);
    n.normalize().multiplyScalar((o.flip ? 1 : -1) * thick * Math.sqrt(1 - (1 - edge) ** 2));
    return [p[0] + n.x, p[1] + n.y, p[2] + n.z];
  };
  const [from, to] = o.lined ?? [0, 1];
  return { outer: surface(us, vs, f, o.closed, o.flip), inner: surface(us, vs.filter((v) => v >= from && v <= to), inner, o.closed, !o.flip) };
}

/** Rounded lump with its own segment count (the showroom's automatic count is too fine for small parts). */
export function lump(b: PartSet, bone: BoneName, size: V3, color: string, seg: number, o: PartOptions & { e?: number; taper?: number } = {}) {
  b.add(bone, S.blob(size[0], size[1], size[2], o.e ?? 0.5, seg, o.taper ?? 0), color, o);
}

export const sgnPow = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e;

/** Tube swept along a smooth path through the points; `radius(t)` varies along it for ribs and tapers. */
export function sweep(points: V3[], radius: (t: number) => number, along: number, around: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(along, false);
  const centers = curve.getSpacedPoints(along);
  const f: Surface = (u, v) => {
    const i = Math.round(v * along);
    const r = radius(v);
    const co = Math.cos(u * TAU) * r;
    const si = Math.sin(u * TAU) * r;
    const o = centers[i]!;
    const p = frames.normals[i]!;
    const q = frames.binormals[i]!;
    return [o.x + co * p.x + si * q.x, o.y + co * p.y + si * q.y, o.z + co * p.z + si * q.z];
  };
  return surface(loop(around), samples(along), f, true);
}

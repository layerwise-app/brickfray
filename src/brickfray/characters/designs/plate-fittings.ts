import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { V3 } from '../skeleton';
import { bare, surface, type Spot } from './plate-forms';

export interface SweepOptions {
  seg?: number;
  radial?: number;
  /** Direction the first radius of a flattened section faces. */
  up?: V3;
  /** Round the ends off; otherwise the radius function should taper them. */
  caps?: boolean;
  loop?: boolean;
}

/**
 * Tube swept through points, its radius (or [across, along `up`] radii)
 * changing along the way: hoses, plume locks, straps, trim, rope.
 */
export function sweep(points: V3[], radius: number | ((t: number) => number | [number, number]), o: SweepOptions = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    o.loop ?? false,
    'centripetal'
  );
  const seg = o.seg ?? 12;
  const radial = o.radial ?? 8;
  const frames: { c: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3; t: THREE.Vector3 }[] = [];
  const n = new THREE.Vector3(...(o.up ?? [0, 1, 0]));
  for (let k = 0; k <= seg; k++) {
    const u = k / seg;
    const t = curve.getTangent(u).normalize();
    n.addScaledVector(t, -n.dot(t));
    if (n.lengthSq() < 1e-8) n.set(Math.abs(t.x) < 0.9 ? 1 : 0, Math.abs(t.x) < 0.9 ? 0 : 1, 0).addScaledVector(t, -(Math.abs(t.x) < 0.9 ? t.x : t.y));
    n.normalize();
    frames.push({ c: curve.getPoint(u), n: n.clone(), b: new THREE.Vector3().crossVectors(t, n), t });
  }
  const radii = (u: number): [number, number] => {
    const r = typeof radius === 'function' ? radius(u) : radius;
    return typeof r === 'number' ? [r, r] : r;
  };
  const cap = o.caps ? 2 : 0;
  return surface(
    radial,
    seg + cap * 2,
    (u, v, out) => {
      const row = Math.round(v * (seg + cap * 2)) - cap;
      const k = THREE.MathUtils.clamp(row, 0, seg);
      const fr = frames[k]!;
      const [ra, rb] = radii(k / seg);
      const over = row < 0 ? -row : row > seg ? row - seg : 0;
      const shrink = over === 0 ? 1 : over === 1 ? 0.72 : 0;
      const push = over === 0 ? 0 : (over === 1 ? 0.55 : 0.8) * Math.min(ra, rb) * (row < 0 ? -1 : 1);
      const a = u * Math.PI * 2;
      out.copy(fr.c).addScaledVector(fr.t, push).addScaledVector(fr.b, Math.cos(a) * ra * shrink).addScaledVector(fr.n, Math.sin(a) * rb * shrink);
    },
    { closed: true, inward: true }
  );
}

/** Flat shape cut from an outline in the XY plane, `depth` thick toward +Z from z = 0, with a beveled face. */
export function cutout(outline: [number, number][], depth: number, bevel = 0, holes: [number, number][][] = []) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
    curveSegments: 1
  });
  g.translate(0, 0, bevel);
  return bare(g);
}

/** Copies of a part seated on the given spots, as one geometry: its +Y leaves the surface, its +Z runs up it. */
export function mounted(spots: Spot[], part: THREE.BufferGeometry, up: V3 = [0, 1, 0]) {
  const src = bare(part);
  const m = new THREE.Matrix4();
  const hint = new THREE.Vector3(...up);
  const x = new THREE.Vector3();
  const z = new THREE.Vector3();
  return mergeGeometries(
    spots.map(([p, n]) => {
      z.copy(hint).addScaledVector(n, -hint.dot(n));
      if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(n, -n.x);
      z.normalize();
      x.crossVectors(n, z);
      return src.clone().applyMatrix4(m.makeBasis(x, n, z).setPosition(p));
    })
  )!;
}

/** Domed rivet heads on the given spots, as one geometry. */
export function rivets(spots: Spot[], r: number, seg = 6, flat = 0.6) {
  const head = new THREE.SphereGeometry(r, seg, Math.max(2, Math.round(seg / 3)), 0, Math.PI * 2, 0, Math.PI / 2);
  return mounted(spots, head.scale(1, flat, 1));
}

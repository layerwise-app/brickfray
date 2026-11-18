import * as THREE from 'three';
import { chamferBox, normalizeGeometry } from '../engine/geometry';

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export function clearShapeCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const k = (...parts: (number | string)[]) => parts.map((p) => (typeof p === 'number' ? r4(p) : p)).join(':');

export function box(w: number, h: number, d: number, bevel: number) {
  return cached(k('box', w, h, d, bevel), () => chamferBox(w, h, d, bevel));
}

/**
 * Chamfered box whose bottom face is w0×d0 and top face w1×d1, centered on the
 * origin; `shiftZ` slides the top face forward/back (sloped fronts, hoods).
 */
export function taper(w0: number, d0: number, w1: number, d1: number, h: number, bevel: number, shiftZ = 0) {
  return cached(k('taper', w0, d0, w1, d1, h, bevel, shiftZ), () => {
    const w = Math.max(w0, w1);
    const d = Math.max(d0, d1);
    const g = chamferBox(w, h, d, bevel).clone();
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / h + 0.5;
      pos.setX(i, (pos.getX(i) * THREE.MathUtils.lerp(w0, w1, t)) / w);
      pos.setZ(i, (pos.getZ(i) * THREE.MathUtils.lerp(d0, d1, t)) / d + shiftZ * t);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Cylinder along Y centered on the origin. */
export function cylinder(rTop: number, rBottom: number, h: number, segments: number, open = false) {
  return cached(k('cyl', rTop, rBottom, h, segments, open ? 1 : 0), () =>
    normalizeGeometry(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open))
  );
}

export function sphere(r: number, w: number, h: number) {
  return cached(k('sph', r, w, h), () => normalizeGeometry(new THREE.SphereGeometry(r, w, h)));
}

/** Half sphere (dome) opening downward, base on the origin. */
export function dome(r: number, w: number, h: number) {
  return cached(k('dome', r, w, h), () => normalizeGeometry(new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2)));
}

/**
 * Rounded box (superellipsoid): `e` near 1 is a sphere, smaller is boxier.
 * `taperBottom` narrows the lower half in x (chins, boots).
 */
export function blob(w: number, h: number, d: number, e: number, segments: number, taperBottom = 0) {
  return cached(k('blob', w, h, d, e, segments, taperBottom), () => {
    const g = new THREE.SphereGeometry(1, segments, Math.max(4, Math.round(segments * 0.75)));
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const tb = vy < 0 ? 1 - taperBottom * -vy : 1;
      pos.setXYZ(i, (f(vx) * w * tb) / 2, (f(vy) * h) / 2, (f(vz) * d) / 2);
    }
    g.computeVertexNormals();
    return normalizeGeometry(g);
  });
}

export function torus(radius: number, tube: number, radial: number, tubular: number, arc = Math.PI * 2) {
  return cached(k('torus', radius, tube, radial, tubular, arc), () => normalizeGeometry(new THREE.TorusGeometry(radius, tube, radial, tubular, arc)));
}

/** Tube through points (model units), with rounded-ish closed ends. */
export function tube(points: [number, number, number][], radius: number, tubular: number, radial: number) {
  return cached(k('tube', JSON.stringify(points), radius, tubular, radial), () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return normalizeGeometry(new THREE.TubeGeometry(curve, tubular, radius, radial, false));
  });
}

/** Lathe from [radius, y] pairs around Y. */
export function lathe(profile: [number, number][], segments: number) {
  return cached(k('lathe', JSON.stringify(profile), segments), () =>
    normalizeGeometry(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments))
  );
}

/** Capsule along Y centered on the origin; total height = len + 2r. */
export function capsule(r: number, len: number, segments: number) {
  return cached(k('cap', r, len, segments), () =>
    normalizeGeometry(new THREE.CapsuleGeometry(r, len, Math.max(2, Math.round(segments / 4)), segments))
  );
}

/** Limb segment hanging down from the origin: tapered, with domed ends on detailed tiers. */
export function limb(rTop: number, rBottom: number, len: number, segments: number, rounded: boolean) {
  return cached(k('limb', rTop, rBottom, len, segments, rounded ? 1 : 0), () => {
    if (!rounded) {
      const g = normalizeGeometry(new THREE.CylinderGeometry(rTop, rBottom, len, segments));
      g.translate(0, -len / 2, 0);
      return g;
    }
    const e = Math.min(rTop, rBottom) * 0.45;
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * (Math.PI / 2);
      pts.push(new THREE.Vector2(rBottom - e + Math.sin(a) * e, -len + e - Math.cos(a) * e));
    }
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * (Math.PI / 2);
      pts.push(new THREE.Vector2(rTop - e + Math.cos(a) * e, -e + Math.sin(a) * e));
    }
    pts.push(new THREE.Vector2(0, 0));
    return normalizeGeometry(new THREE.LatheGeometry(pts, segments));
  });
}

/** Part of a sphere around -Z (visors, portholes): `wide`/`tall` are angular spans in radians. */
export function section(r: number, wide: number, tall: number, w: number, h: number) {
  return cached(k('sect', r, wide, tall, w, h), () => {
    const g = new THREE.SphereGeometry(r, w, h, Math.PI / 2 - wide / 2 + Math.PI, wide, Math.PI / 2 - tall / 2, tall);
    return normalizeGeometry(g);
  });
}

export interface LoftRing {
  y: number;
  /** Half width (x) and half depth toward the front (-z); `back` is the half depth toward +z when it differs. */
  rx: number;
  rz: number;
  back?: number;
  cx?: number;
  cz?: number;
  /** Superellipse exponent of the cross-section: 2 is an ellipse, higher is boxier. */
  e?: number;
}

export interface LoftEnds {
  /** Dome heights closing each end; 0 is a flat cap with a hard edge. */
  bottom?: number;
  top?: number;
  /** Rings stay as given; otherwise `steps` smooth rings are added between each pair. */
  steps?: number;
  /** Rings in each dome; by default it follows `radial`. */
  domes?: number;
}

type Ring = Required<LoftRing>;
const RING_KEYS = ['y', 'rx', 'rz', 'back', 'cx', 'cz', 'e'] as const;

function fullRing(r: LoftRing): Ring {
  return { y: r.y, rx: r.rx, rz: r.rz, back: r.back ?? r.rz, cx: r.cx ?? 0, cz: r.cz ?? 0, e: r.e ?? 2 };
}

function ringBetween(rings: Ring[], i: number, t: number): Ring {
  const p0 = rings[Math.max(0, i - 1)]!;
  const p1 = rings[i]!;
  const p2 = rings[Math.min(rings.length - 1, i + 1)]!;
  const p3 = rings[Math.min(rings.length - 1, i + 2)]!;
  const out = { ...p1 };
  const t2 = t * t;
  const t3 = t2 * t;
  for (const key of RING_KEYS) {
    const v = 0.5 * (2 * p1[key] + (p2[key] - p0[key]) * t + (2 * p0[key] - 5 * p1[key] + 4 * p2[key] - p3[key]) * t2 + (3 * p1[key] - p0[key] - 3 * p2[key] + p3[key]) * t3);
    const lo = Math.min(p1[key], p2[key]);
    const hi = Math.max(p1[key], p2[key]);
    out[key] = key === 'y' ? p1.y + (p2.y - p1.y) * t : Math.min(hi + (hi - lo) * 0.15, Math.max(lo - (hi - lo) * 0.15, v));
  }
  return out;
}

/** The smoothed cross-section of a loft at height y (clamped to its ends). */
export function loftRingAt(rings: LoftRing[], y: number): Required<LoftRing> {
  const full = rings.map(fullRing);
  if (y <= full[0]!.y) return full[0]!;
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i]!;
    const b = full[i + 1]!;
    if (y <= b.y) return ringBetween(full, i, (y - a.y) / Math.max(1e-9, b.y - a.y));
  }
  return full[full.length - 1]!;
}

/** Front (-z) surface of a loft at (x, y): where to seat a part on a curved face or chest. */
export function loftFrontZ(rings: LoftRing[], x: number, y: number) {
  const r = loftRingAt(rings, y);
  const u = Math.min(1, Math.abs(x - r.cx) / r.rx);
  return r.cz - r.rz * Math.pow(1 - Math.pow(u, r.e), 1 / r.e);
}

/**
 * Smooth-skinned solid through superellipse cross-sections stacked along Y
 * (rings in rising y): torsos, limbs with muscle volume, heads, fingers, soles.
 */
export function loft(rings: LoftRing[], radial: number, ends: LoftEnds = {}) {
  const steps = Math.max(1, ends.steps ?? 1);
  const bottom = ends.bottom ?? 0;
  const top = ends.top ?? 0;
  const domeRings = ends.domes ?? Math.max(1, Math.round(radial / 6));
  return cached(k('loft', JSON.stringify(rings), radial, steps, bottom, top, domeRings), () => {
    const keys = rings.map(fullRing);
    const body: Ring[] = [];
    for (let i = 0; i < keys.length - 1; i++) for (let s = 0; s < steps; s++) body.push(ringBetween(keys, i, s / steps));
    body.push(keys[keys.length - 1]!);
    const dome = (from: Ring, h: number, sign: number) => {
      const out: Ring[] = [];
      for (let j = 1; j <= domeRings; j++) {
        const a = (j / (domeRings + 1)) * (Math.PI / 2);
        out.push({ ...from, y: from.y + sign * h * Math.sin(a), rx: from.rx * Math.cos(a), rz: from.rz * Math.cos(a), back: from.back * Math.cos(a) });
      }
      return out;
    };
    const first = body[0]!;
    const last = body[body.length - 1]!;
    const stack = [...(bottom > 0 ? dome(first, bottom, -1).reverse() : []), ...body, ...(top > 0 ? dome(last, top, 1) : [])];
    const grid = stack.map((r) => {
      const p = 2 / r.e;
      const ring: THREE.Vector3[] = [];
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ring.push(new THREE.Vector3(r.cx + r.rx * Math.sign(c) * Math.pow(Math.abs(c), p), r.y, r.cz + (s < 0 ? r.rz : r.back) * Math.sign(s) * Math.pow(Math.abs(s), p)));
      }
      return ring;
    });
    const low = new THREE.Vector3(first.cx, first.y - bottom, first.cz);
    const high = new THREE.Vector3(last.cx, last.y + top, last.cz);
    // Normals from the grid itself, so shading does not follow the triangle diagonals.
    const tu = new THREE.Vector3();
    const tv = new THREE.Vector3();
    const normals = grid.map((ring, i) =>
      ring.map((_, j) => {
        tu.subVectors(ring[(j + 1) % radial]!, ring[(j + radial - 1) % radial]!);
        const below = i > 0 ? grid[i - 1]![j]! : bottom > 0 ? low : ring[j]!;
        const above = i < grid.length - 1 ? grid[i + 1]![j]! : top > 0 ? high : ring[j]!;
        return new THREE.Vector3().crossVectors(tv.subVectors(above, below), tu).normalize();
      })
    );
    const pos: number[] = [];
    const nrm: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const down = new THREE.Vector3(0, -1, 0);
    const vertex = (p: THREE.Vector3, n: THREE.Vector3) => {
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
    };
    for (let i = 0; i < grid.length - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const j1 = (j + 1) % radial;
        const a = grid[i]!;
        const b = grid[i + 1]!;
        const na = normals[i]!;
        const nb = normals[i + 1]!;
        vertex(a[j]!, na[j]!);
        vertex(b[j]!, nb[j]!);
        vertex(a[j1]!, na[j1]!);
        vertex(a[j1]!, na[j1]!);
        vertex(b[j]!, nb[j]!);
        vertex(b[j1]!, nb[j1]!);
      }
    }
    const cap = (i: number, center: THREE.Vector3, n: THREE.Vector3, smooth: boolean, top: boolean) => {
      const ring = grid[i]!;
      for (let j = 0; j < radial; j++) {
        const j1 = (j + 1) % radial;
        const order = top ? [ring[j]!, center, ring[j1]!] : [ring[j]!, ring[j1]!, center];
        const ns = top ? [normals[i]![j]!, n, normals[i]![j1]!] : [normals[i]![j]!, normals[i]![j1]!, n];
        order.forEach((v, q) => vertex(v, smooth && v !== center ? ns[q]! : n));
      }
    };
    cap(0, low, down, bottom > 0, false);
    cap(grid.length - 1, high, up, top > 0, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  });
}

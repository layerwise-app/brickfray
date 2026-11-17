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

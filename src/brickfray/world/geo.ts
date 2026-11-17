import * as THREE from 'three';
import { chamferBox, normalizeGeometry, PITCH, PLATE, STUD_HEIGHT, STUD_RADIUS } from '../engine/geometry';
import type { QualityProfile } from '../engine/quality';

/** Scenery geometry cache; keys must include everything that shapes the mesh (quality too). */
const cache = new Map<string, THREE.BufferGeometry>();

export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    cache.set(key, g);
  }
  return g;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Accumulates flat-shaded triangles; polygons are wound to face away from `center` when given. */
export class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private n = new THREE.Vector3();

  poly(points: THREE.Vector3[], center?: THREE.Vector3) {
    this.a.subVectors(points[1]!, points[0]!);
    this.b.subVectors(points[2]!, points[0]!);
    this.n.crossVectors(this.a, this.b).normalize();
    let flip = false;
    if (center) {
      this.a.copy(points[0]!).sub(center);
      flip = this.n.dot(this.a) < 0;
      if (flip) this.n.negate();
    }
    for (let i = 1; i < points.length - 1; i++) {
      const tri = flip ? [points[0]!, points[i + 1]!, points[i]!] : [points[0]!, points[i]!, points[i + 1]!];
      for (const p of tri) {
        this.pos.push(p.x, p.y, p.z);
        this.nor.push(this.n.x, this.n.y, this.n.z);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    return g;
  }
}

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Chamfered box with its bottom center on the origin. */
export function boxGeo(w: number, h: number, d: number, bevel: number) {
  return geo(`box:${r3(w)}:${r3(h)}:${r3(d)}:${r3(bevel)}`, () => {
    const g = chamferBox(w, h, d, bevel);
    g.translate(0, h / 2, 0);
    return g;
  });
}

/** 1 m cube on the origin's bottom center, meant to be scaled (plain low-tier blocks). */
export function unitBox() {
  return boxGeo(1, 1, 1, 0);
}

/**
 * Cylinder standing on the origin: side, a one-facet chamfer when `edge` > 0
 * and a fan top. No bottom cap (scenery always sits on something).
 */
/** Cylinder standing on y = 0; `capped` closes the bottom for cylinders lying on their side. */
export function cylGeo(radius: number, height: number, segments: number, edge = 0, capped = false) {
  return geo(`cyl:${r3(radius)}:${r3(height)}:${segments}:${r3(edge)}${capped ? ':c' : ''}`, () => {
    const e = Math.min(edge, radius * 0.4, height * 0.4);
    const pos: number[] = [];
    const nor: number[] = [];
    const ring = (r: number, y: number) => Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return [Math.sin(a) * r, y, Math.cos(a) * r] as const;
    });
    const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], n0: number[], n1: number[]) => {
      for (const [p, n] of [[a, n0], [b, n1], [c, n1], [a, n0], [c, n1], [d, n0]] as const) {
        pos.push(p[0]!, p[1]!, p[2]!);
        nor.push(n[0]!, n[1]!, n[2]!);
      }
    };
    const bottom = ring(radius, 0);
    const side = ring(radius, height - e);
    const top = ring(radius - e, height);
    const sideN = (i: number) => {
      const a = (i / segments) * Math.PI * 2;
      return [Math.sin(a), 0, Math.cos(a)];
    };
    const bevelN = (i: number) => {
      const a = (i / segments) * Math.PI * 2;
      return [Math.sin(a) * 0.7071, 0.7071, Math.cos(a) * 0.7071];
    };
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      quad(bottom[i]!, bottom[j]!, side[j]!, side[i]!, sideN(i), sideN(j));
      if (e > 0) quad(side[i]!, side[j]!, top[j]!, top[i]!, bevelN(i), bevelN(j));
      for (const p of [top[i]!, top[j]!, [0, height, 0] as const]) {
        pos.push(p[0]!, p[1]!, p[2]!);
        nor.push(0, 1, 0);
      }
      if (capped) {
        for (const p of [bottom[j]!, bottom[i]!, [0, 0, 0] as const]) {
          pos.push(p[0]!, p[1]!, p[2]!);
          nor.push(0, -1, 0);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  });
}

/** Frustum standing on the origin. */
export function coneGeo(rBottom: number, rTop: number, height: number, segments: number) {
  return geo(`cone:${r3(rBottom)}:${r3(rTop)}:${r3(height)}:${segments}`, () => {
    const g = normalizeGeometry(new THREE.CylinderGeometry(rTop, rBottom, height, segments, 1, rTop <= 0));
    g.translate(0, height / 2, 0);
    return g;
  });
}

/** Faceted ball (toy foliage, rocks); centered on the origin. `jitter` dents it deterministically. */
export function ballGeo(radius: number, detail: number, jitter = 0, seed = 1) {
  return geo(`ball:${r3(radius)}:${detail}:${r3(jitter)}:${seed}`, () => {
    const src = new THREE.IcosahedronGeometry(radius, detail);
    if (jitter > 0) {
      const p = src.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const k = Math.sin(v.x * 12.9898 * seed + v.y * 78.233 + v.z * 37.719) * 43758.5453;
        v.multiplyScalar(1 + (k - Math.floor(k) - 0.5) * jitter);
        p.setXYZ(i, v.x, v.y, v.z);
      }
    }
    const g = normalizeGeometry(src);
    g.computeVertexNormals();
    return g;
  });
}

export function torusGeo(radius: number, tube: number, radial: number, tubular: number) {
  return geo(`torus:${r3(radius)}:${r3(tube)}:${radial}:${tubular}`, () => {
    const g = normalizeGeometry(new THREE.TorusGeometry(radius, tube, radial, tubular));
    g.rotateX(Math.PI / 2);
    g.translate(0, tube, 0);
    return g;
  });
}

/** Convex (z, y) profile extruded along x, centered on x. */
export function prismGeo(key: string, profile: [number, number][], width: number) {
  return geo(`prism:${key}:${r3(width)}`, () => {
    const m = new Mesher();
    const hw = width / 2;
    let cz = 0;
    let cy = 0;
    for (const [z, y] of profile) {
      cz += z / profile.length;
      cy += y / profile.length;
    }
    const center = V(0, cy, cz);
    const left = profile.map(([z, y]) => V(-hw, y, z));
    const right = profile.map(([z, y]) => V(hw, y, z));
    m.poly(left, center);
    m.poly(right, center);
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      m.poly([left[i]!, left[j]!, right[j]!, right[i]!], center);
    }
    return m.build();
  });
}

/** Cheap scenery stud: open-bottom cylinder. */
function studGeo(profile: QualityProfile) {
  return cylGeo(STUD_RADIUS, STUD_HEIGHT, profile.detail >= 2 ? 10 : 8);
}

/**
 * A brick or plate `w`×`d` studs and `h` plates tall, bottom center on the
 * origin, with studs when asked and the tier allows.
 */
export function partGeo(w: number, d: number, h: number, studs: boolean, profile: QualityProfile) {
  const withStuds = studs && profile.detail > 0;
  return geo(`part:${w}:${d}:${h}:${withStuds ? 1 : 0}:${profile.level}`, () => {
    const gap = 0.0025;
    const height = h * PLATE - gap;
    const body = chamferBox(w * PITCH - gap * 2, height, d * PITCH - gap * 2, profile.bevel);
    body.translate(0, height / 2, 0);
    if (!withStuds) return body;
    const stud = studGeo(profile);
    const parts = [body];
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const s = stud.clone();
        s.translate((x - (w - 1) / 2) * PITCH, height, (z - (d - 1) / 2) * PITCH);
        parts.push(s);
      }
    }
    return mergeAll(parts);
  });
}

export function mergeAll(parts: THREE.BufferGeometry[]) {
  let count = 0;
  for (const p of parts) count += p.getAttribute('position').count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.getAttribute('position').array as Float32Array, o * 3);
    nor.set(p.getAttribute('normal').array as Float32Array, o * 3);
    o += p.getAttribute('position').count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Bake transformed copies of geometries into one (position + normal only). */
export function bake(items: { g: THREE.BufferGeometry; m: THREE.Matrix4 }[]) {
  return mergeAll(
    items.map(({ g, m }) => {
      const c = g.clone();
      c.applyMatrix4(m);
      return c;
    })
  );
}

export function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) {
  const scale = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), scale);
}

/**
 * Window/door frame: a rectangular ring `bar` wide, bottom center on the
 * origin, front at z = depth/2. Front, reveals and outer edges only.
 */
export function frameGeo(w: number, h: number, bar: number, depth: number) {
  return geo(`frame:${r3(w)}:${r3(h)}:${r3(bar)}:${r3(depth)}`, () => {
    const pos: number[] = [];
    const nor: number[] = [];
    const zf = depth / 2;
    const zb = -depth / 2;
    const quad = (pts: number[][], n: number[]) => {
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(...pts[i]!);
        nor.push(...n);
      }
    };
    const x0 = -w / 2;
    const x1 = w / 2;
    const i0 = x0 + bar;
    const i1 = x1 - bar;
    const y1 = h;
    const j0 = bar;
    const j1 = h - bar;
    const F = [0, 0, 1];
    quad([[x0, 0, zf], [x1, 0, zf], [x1, j0, zf], [x0, j0, zf]], F);
    quad([[x0, j1, zf], [x1, j1, zf], [x1, y1, zf], [x0, y1, zf]], F);
    quad([[x0, j0, zf], [i0, j0, zf], [i0, j1, zf], [x0, j1, zf]], F);
    quad([[i1, j0, zf], [x1, j0, zf], [x1, j1, zf], [i1, j1, zf]], F);
    quad([[i0, j0, zb], [i1, j0, zb], [i1, j0, zf], [i0, j0, zf]], [0, 1, 0]);
    quad([[i1, j1, zb], [i0, j1, zb], [i0, j1, zf], [i1, j1, zf]], [0, -1, 0]);
    quad([[i0, j1, zb], [i0, j0, zb], [i0, j0, zf], [i0, j1, zf]], [1, 0, 0]);
    quad([[i1, j0, zb], [i1, j1, zb], [i1, j1, zf], [i1, j0, zf]], [-1, 0, 0]);
    quad([[x1, 0, zb], [x0, 0, zb], [x0, 0, zf], [x1, 0, zf]], [0, -1, 0]);
    quad([[x0, y1, zb], [x1, y1, zb], [x1, y1, zf], [x0, y1, zf]], [0, 1, 0]);
    quad([[x0, 0, zb], [x0, y1, zb], [x0, y1, zf], [x0, 0, zf]], [-1, 0, 0]);
    quad([[x1, y1, zb], [x1, 0, zb], [x1, 0, zf], [x1, y1, zf]], [1, 0, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  });
}

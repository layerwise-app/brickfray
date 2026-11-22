import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PartSet } from '../parts';
import type { V3 } from '../skeleton';

/** Costume tier: 1 medium, 2 high, 3 showroom. */
export const tier = (b: PartSet) => (b.hero ? 3 : b.detail);
/** A count for the medium, high and showroom tiers. */
export const pick = (b: PartSet, medium: number, high: number, hero: number) => [b.cut(medium), b.cut(medium), high, hero][tier(b)]!;

/**
 * One cross-section of a lofted plate: half width `w`, half depths toward the
 * front (-Z) and back, at height `y`. `e` squares the outline (1 = ellipse,
 * lower is boxier), `keel` pulls the front centerline out into a ridge.
 */
export interface Section {
  y: number;
  w: number;
  f: number;
  b?: number;
  e?: number;
  keel?: number;
  x?: number;
  z?: number;
}

export interface MeshOptions {
  /** Angle range around the loft: 0 is the front, π/2 the character's right, π the back. */
  from?: number;
  to?: number;
  /** Section range, in section indices (1.5 is halfway between the second and third). */
  t0?: number;
  t1?: number;
  cols: number;
  /** Rows per section span. */
  rows?: number;
  /** Plate thickness; 0 leaves a bare surface. */
  thick?: number;
  /** Build the inside face too (only seen from below or behind). */
  back?: boolean;
  /** Offset along the surface normal (cloth or trim lying on the plate). */
  lift?: number;
  /** Add the same piece on the other side of the centerline, keeping the front ridge crisp. */
  mirror?: boolean;
  /** Narrows the angle range per row (t runs 0…1 bottom to top) to cut pointed or scalloped edges. */
  cut?: (t: number) => [number, number];
}

export interface SurfaceOptions {
  thick?: number;
  back?: boolean;
  /** u wraps around (tubes, full rings). */
  closed?: boolean;
  /** Normals point along dv × du instead of du × dv. */
  inward?: boolean;
  /** Skip the rim on the u = 0 / u = 1 edge (where another piece butts against it). */
  butt?: [boolean, boolean];
}

export type Spot = [position: THREE.Vector3, normal: THREE.Vector3];

const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const vd = new THREE.Vector3();

/** Grid surface from f(u, v) with smooth normals, optionally thickened into a plate with flat rims. */
export function surface(nu: number, nv: number, f: (u: number, v: number, out: THREE.Vector3) => void, o: SurfaceOptions = {}) {
  const cols = nu + 1;
  const rows = nv + 1;
  const count = cols * rows;
  const P = new Float32Array(count * 3);
  const point = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      f(i / nu, j / nv, point);
      P.set([point.x, point.y, point.z], (j * cols + i) * 3);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (o.inward) idx.push(a, d, b, a, c, d);
      else idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const N = (g.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
  const get = (A: Float32Array, k: number, out: THREE.Vector3) => out.set(A[k * 3]!, A[k * 3 + 1]!, A[k * 3 + 2]!);
  const put = (A: Float32Array, k: number, v: THREE.Vector3) => A.set([v.x, v.y, v.z], k * 3);
  const pole = (j: number) => get(P, j * cols, va).distanceToSquared(get(P, j * cols + nu, vb)) < 1e-12 && get(P, j * cols + (nu >> 1), vc).distanceToSquared(va) < 1e-12;
  for (let j = 0; j < rows; j++) {
    if (pole(j)) {
      vd.set(0, 0, 0);
      for (let i = 0; i < cols; i++) vd.add(get(N, j * cols + i, va));
      vd.normalize();
      for (let i = 0; i < cols; i++) put(N, j * cols + i, vd);
    } else if (o.closed) {
      vd.copy(get(N, j * cols, va)).add(get(N, j * cols + nu, vb)).normalize();
      put(N, j * cols, vd);
      put(N, j * cols + nu, vd);
    }
  }
  const thick = o.thick ?? 0;
  const pos: number[] = [];
  const nrm: number[] = [];
  const corner = (A: Float32Array, B: Float32Array, k: number, sign: number) => {
    pos.push(A[k * 3]!, A[k * 3 + 1]!, A[k * 3 + 2]!);
    nrm.push(sign * B[k * 3]!, sign * B[k * 3 + 1]!, sign * B[k * 3 + 2]!);
  };
  for (let t = 0; t < idx.length; t += 3) for (let n = 0; n < 3; n++) corner(P, N, idx[t + n]!, 1);
  if (thick > 0) {
    const Q = new Float32Array(count * 3);
    for (let k = 0; k < count * 3; k++) Q[k] = P[k]! - N[k]! * thick;
    if (o.back ?? true) for (let t = 0; t < idx.length; t += 3) for (const n of [0, 2, 1]) corner(Q, N, idx[t + n]!, -1);
    const rim = (k0: number, k1: number, inside: number) => {
      get(P, k0, va);
      get(P, k1, vb);
      if (va.distanceToSquared(vb) < 1e-12) return;
      get(Q, k1, vc);
      const n = new THREE.Vector3().subVectors(vb, va).cross(vd.subVectors(vc, va)).normalize();
      const flip = n.dot(vd.subVectors(va, get(P, inside, vd))) < 0;
      if (flip) n.negate();
      for (const [A, k] of flip ? ([[P, k0], [Q, k1], [P, k1], [P, k0], [Q, k0], [Q, k1]] as const) : ([[P, k0], [P, k1], [Q, k1], [P, k0], [Q, k1], [Q, k0]] as const)) {
        pos.push(A[k * 3]!, A[k * 3 + 1]!, A[k * 3 + 2]!);
        nrm.push(n.x, n.y, n.z);
      }
    };
    for (let i = 0; i < nu; i++) {
      rim(i, i + 1, cols + i);
      rim(nv * cols + i, nv * cols + i + 1, (nv - 1) * cols + i);
    }
    if (!o.closed) {
      for (let j = 0; j < nv; j++) {
        if (!o.butt?.[0]) rim(j * cols, (j + 1) * cols, j * cols + 1);
        if (!o.butt?.[1]) rim(j * cols + nu, (j + 1) * cols + nu, j * cols + nu - 1);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}

const CHANNELS = ['y', 'w', 'f', 'b', 'e', 'keel', 'x', 'z'] as const;
type Full = Required<Section>;

/**
 * Armor and hull plates lofted through cross-sections stacked along Y. The
 * same loft hands out whole shells, cut panels, points for rivets and paths
 * for trim, so every layer sits flush on the one below.
 */
export class Loft {
  private readonly s: Full[];

  /** `keelWidth` is how far the front ridge spreads, as a fraction of the half width. */
  constructor(
    sections: Section[],
    private readonly keelWidth = 0.6
  ) {
    this.s = sections.map((s) => ({ y: s.y, w: s.w, f: s.f, b: s.b ?? s.f, e: s.e ?? 1, keel: s.keel ?? 0, x: s.x ?? 0, z: s.z ?? 0 }));
  }

  get spans() {
    return this.s.length - 1;
  }

  /** Section parameter at height y (sections must rise in y). */
  tAt(y: number) {
    const s = this.s;
    for (let i = 0; i < s.length - 1; i++) {
      if (y <= s[i + 1]!.y) return i + THREE.MathUtils.clamp((y - s[i]!.y) / (s[i + 1]!.y - s[i]!.y), 0, 1);
    }
    return s.length - 1;
  }

  private at(t: number): Full {
    const s = this.s;
    const i = Math.min(s.length - 2, Math.max(0, Math.floor(t)));
    const u = THREE.MathUtils.clamp(t - i, 0, 1);
    const p0 = s[Math.max(0, i - 1)]!;
    const p1 = s[i]!;
    const p2 = s[i + 1]!;
    const p3 = s[Math.min(s.length - 1, i + 2)]!;
    const out = { ...p1 };
    for (const key of CHANNELS) {
      const m1 = (p2[key] - p0[key]) / 2;
      const m2 = (p3[key] - p1[key]) / 2;
      const u2 = u * u;
      const u3 = u2 * u;
      out[key] = (2 * u3 - 3 * u2 + 1) * p1[key] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[key] + (u3 - u2) * m2;
    }
    return out;
  }

  point(a: number, t: number, out: THREE.Vector3, lift = 0) {
    const r = this.at(t);
    const s = Math.sin(a);
    const c = Math.cos(a);
    const x = (r.w + lift) * Math.sign(s) * Math.abs(s) ** r.e;
    let z = -((c >= 0 ? r.f : r.b) + lift) * Math.sign(c) * Math.abs(c) ** r.e;
    if (c > 0 && r.keel > 0) z -= r.keel * Math.max(0, 1 - Math.abs(x) / (this.keelWidth * r.w)) ** 2;
    return out.set(r.x + x, r.y, r.z + z);
  }

  /** Outward surface normal at (a, t). */
  normal(a: number, t: number, out: THREE.Vector3) {
    const h = 0.003;
    // Centered around the angle: a one-sided step tilts the normal at the centerline, and halves lifted along it part there.
    const da = [a - h, a + h];
    const dt = t < h ? [t, t + h] : [t - h, t];
    out.subVectors(this.point(da[1]!, t, va), this.point(da[0]!, t, vb));
    out.cross(vc.subVectors(this.point(a, dt[0]!, va), this.point(a, dt[1]!, vb))).normalize();
    return out;
  }

  /** Points on the surface with their normals, for rivets and mounted parts. */
  spots(list: [a: number, t: number][], lift = 0): Spot[] {
    return list.map(([a, t]) => [this.point(a, t, new THREE.Vector3(), lift), this.normal(a, t, new THREE.Vector3())]);
  }

  /** A run of `n` evenly spaced spots from (a0, t0) to (a1, t1). */
  row(a0: number, t0: number, a1: number, t1: number, n: number, lift = 0) {
    return this.spots(
      Array.from({ length: n }, (_, i) => [a0 + ((a1 - a0) * i) / Math.max(1, n - 1), t0 + ((t1 - t0) * i) / Math.max(1, n - 1)] as [number, number]),
      lift
    );
  }

  /** Points along a line on the surface (for trim swept along an edge). */
  path(list: [a: number, t: number][], lift = 0, steps = 1): V3[] {
    const out: V3[] = [];
    for (let i = 0; i < list.length - 1; i++) {
      for (let k = 0; k < steps; k++) {
        const u = k / steps;
        this.point(list[i]![0] + (list[i + 1]![0] - list[i]![0]) * u, list[i]![1] + (list[i + 1]![1] - list[i]![1]) * u, va, lift);
        out.push([va.x, va.y, va.z]);
      }
    }
    const last = list[list.length - 1]!;
    this.point(last[0], last[1], va, lift);
    out.push([va.x, va.y, va.z]);
    return out;
  }

  mesh(o: MeshOptions) {
    const from = o.from ?? 0;
    const to = o.to ?? Math.PI * 2;
    const t0 = o.t0 ?? 0;
    const t1 = o.t1 ?? this.spans;
    const closed = !o.mirror && !o.cut && to - from > Math.PI * 2 - 1e-6;
    const nv = Math.max(1, Math.round((t1 - t0) * (o.rows ?? 1)));
    const lift = o.lift ?? 0;
    const n = new THREE.Vector3();
    const edge = o.cut ? o.cut(0.5) : [from, to];
    const half = surface(
      o.cols,
      nv,
      (u, v, out) => {
        const [a0, a1] = o.cut ? o.cut(v) : [from, to];
        const a = a0 + (a1 - a0) * u;
        const t = t0 + (t1 - t0) * v;
        this.point(a, t, out);
        if (lift) out.addScaledVector(this.normal(a, t, n), lift);
      },
      { thick: o.thick, back: o.back, closed, inward: true, butt: o.mirror ? [Math.abs(Math.sin(edge[0])) < 1e-6, Math.abs(Math.sin(edge[1])) < 1e-6] : undefined }
    );
    if (!o.mirror) return half;
    return symmetric(half, (y) => this.at(this.tAt(y)).keel > 1e-4);
  }

  /** Front ridge depth at height y. */
  keelAt(y: number) {
    return this.at(this.tAt(y)).keel;
  }
}

/**
 * A half built on one side of the centerline plus its mirror image. Normals on
 * the centerline are straightened so the halves blend, except on the front
 * where `ridge(y)` says the crease is wanted.
 */
export function symmetric(half: THREE.BufferGeometry, ridge: (y: number) => boolean = () => false) {
  const nrm = half.getAttribute('normal') as THREE.BufferAttribute;
  const pos = half.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) > 1e-6 || Math.abs(nrm.getX(i)) > 0.9) continue;
    if (pos.getZ(i) < 0 && ridge(pos.getY(i))) continue;
    va.set(0, nrm.getY(i), nrm.getZ(i)).normalize();
    nrm.setXYZ(i, va.x, va.y, va.z);
  }
  return join(half, mirrored(half));
}

/** The same geometry reflected across the YZ plane. */
export function mirrored(g: THREE.BufferGeometry) {
  const out = g.clone();
  const pos = out.getAttribute('position') as THREE.BufferAttribute;
  const nrm = out.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    for (const attr of [pos, nrm]) {
      const a = [attr.getX(i + 1), attr.getY(i + 1), attr.getZ(i + 1)];
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
      attr.setXYZ(i + 2, a[0]!, a[1]!, a[2]!);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
    nrm.setX(i, -nrm.getX(i));
  }
  return out;
}

export function join(...parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts.map(bare))!;
}

/** The geometry reduced to non-indexed position + normal, so any two parts can be joined. */
export function bare(g: THREE.BufferGeometry) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  return out;
}

/** The geometry moved, turned (YXZ euler) and scaled, ready to join with others. */
export function placed(g: THREE.BufferGeometry, at: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(...scale));
  return bare(g).clone().applyMatrix4(m);
}

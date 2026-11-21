import * as THREE from 'three';
import { normalizeGeometry } from '../../engine/geometry';
import { HEAD } from '../body-head';
import { limbRings, type LimbPart } from '../body-limbs';
import type { PartOptions, PartSet } from '../parts';
import * as S from '../shapes';
import type { BoneName, V3 } from '../skeleton';

/** A count for the tiers a costume is built on: medium, high, showroom. */
export const tier = (b: PartSet, medium: number, high: number, hero: number) => (b.hero ? hero : b.detail >= 2 ? high : medium);

/** Rounded box with its own segment count, for the many small soft shapes a costume is made of. */
export function lump(b: PartSet, bone: BoneName, size: V3, seg: number, color: string, o: PartOptions & { e?: number; taper?: number } = {}) {
  return b.add(bone, S.blob(size[0], size[1], size[2], o.e ?? 0.45, seg, o.taper ?? 0), color, o);
}

/** One cross-section of a garment in bone space: `w` wide and `d` deep at height `y`, centered on `z`. */
export type Ring = [y: number, w: number, d: number, z?: number];

export interface PanelOptions {
  y: [number, number];
  /** Angle range around the body: 0 is the front, π/2 the character's right, π the back. May change with height (t runs 0…1 bottom to top); either order. */
  a: [number, number] | ((t: number) => [number, number]);
  /** Gap between the garment's rings and the panel's underside, and the panel's thickness. */
  lift?: number;
  thick?: number;
  /** Segments around and up. */
  seg?: [number, number];
}

const p = new THREE.Vector3();
const p2 = new THREE.Vector3();
const p3 = new THREE.Vector3();
const nx = new THREE.Vector3();
const ny = new THREE.Vector3();
const nz = new THREE.Vector3();
const basis = new THREE.Matrix4();
const euler = new THREE.Euler();

/**
 * A garment wrapped around the body: rounded-rectangle rings lofted bottom to
 * top. Panels, tape, hems, pockets and trims are all cut from the same loft,
 * so they sit flush on each other.
 */
export class Garment {
  private readonly e: number;

  /** `squareness` 2 is an ellipse; higher is boxier. */
  constructor(
    readonly rings: Ring[],
    squareness = 3
  ) {
    this.e = 2 / squareness;
  }

  point(y: number, a: number, lift: number, out: THREE.Vector3) {
    const r = this.rings;
    let i = 0;
    while (i < r.length - 2 && y > r[i + 1]![0]) i++;
    const r0 = r[i]!;
    const r1 = r[i + 1]!;
    const t = THREE.MathUtils.clamp((y - r0[0]) / (r1[0] - r0[0]), 0, 1);
    const w = THREE.MathUtils.lerp(r0[1], r1[1], t) / 2 + lift;
    const d = THREE.MathUtils.lerp(r0[2], r1[2], t) / 2 + lift;
    const z = THREE.MathUtils.lerp(r0[3] ?? 0, r1[3] ?? 0, t);
    const s = Math.sin(a);
    const c = Math.cos(a);
    return out.set(w * Math.sign(s) * Math.abs(s) ** this.e, y, z - d * Math.sign(c) * Math.abs(c) ** this.e);
  }

  /** Angle on the front where the surface is `x` from the middle at height `y` (positive toward the character's right). */
  front(y: number, x: number) {
    this.point(y, Math.PI / 2, 0, p);
    return Math.sign(x) * Math.asin(Math.min(1, Math.abs(x) / p.x) ** (1 / this.e));
  }

  back(y: number, x: number) {
    return Math.PI - this.front(y, x);
  }

  /** Position and rotation for a part sitting on the surface: its -Z faces out, +Y runs up the garment. */
  place(y: number, a: number, lift = 0, spin = 0): { at: V3; rot: V3 } {
    this.frame(y, a, lift);
    basis.makeBasis(nx, ny, nz);
    if (spin) basis.multiply(new THREE.Matrix4().makeRotationZ(spin));
    euler.setFromRotationMatrix(basis, 'YXZ');
    return { at: [p.x, p.y, p.z], rot: [euler.x, euler.y, euler.z] };
  }

  /** Like `place`, for a disc or cylinder whose axis (+Y) should point out of the surface: snaps, buttons, lenses. */
  stud(y: number, a: number, lift = 0): { at: V3; rot: V3 } {
    this.frame(y, a, lift);
    basis.makeBasis(nx, p2.copy(nz).negate(), ny);
    euler.setFromRotationMatrix(basis, 'YXZ');
    return { at: [p.x, p.y, p.z], rot: [euler.x, euler.y, euler.z] };
  }

  /** Unit direction running around the garment at a point: the wide side of a strand that hangs or climbs there. */
  around(y: number, a: number): V3 {
    this.frame(y, a, 0);
    return [nx.x, nx.y, nx.z];
  }

  /** Points on the surface from [height, angle, lift] triples: the path of a strap, lock of hair or cord. */
  path(stops: [number, number, number][]): V3[] {
    return stops.map(([y, a, lift]) => this.point(y, a, lift, p).toArray() as V3);
  }

  /** Leaves the point in `p` and the frame in nx (around), ny (up), nz (inward). */
  private frame(y: number, a: number, lift: number) {
    const h = 0.004;
    this.point(y, a + h, lift, p2);
    this.point(y, a - h, lift, p3);
    nx.subVectors(p2, p3).normalize();
    this.point(y + h, a, lift, p2);
    this.point(y - h, a, lift, p3);
    ny.subVectors(p2, p3).normalize();
    nz.crossVectors(nx, ny).normalize();
    ny.crossVectors(nz, nx).normalize();
    this.point(y, a, lift, p);
  }

  /** A piece of the garment with a rim, so its edge reads as cloth thickness. */
  panel(o: PanelOptions) {
    const lift = o.lift ?? 0.003;
    const thick = o.thick ?? 0.006;
    const [y0, y1] = o.y;
    const [na, nyy] = o.seg ?? [8, 4];
    const ys = this.heights(y0, y1, nyy);
    const range = (j: number) => {
      const [a0, a1] = typeof o.a === 'function' ? o.a((ys[j]! - y0) / (y1 - y0)) : o.a;
      return a0 < a1 ? [a0, a1] : [a1, a0];
    };
    const cols = na + 1;
    const outer: THREE.Vector3[] = [];
    const inner: THREE.Vector3[] = [];
    const normal: THREE.Vector3[] = [];
    for (let j = 0; j < ys.length; j++) {
      const [a0, a1] = range(j);
      for (let i = 0; i < cols; i++) {
        const a = a0 + ((a1 - a0) * i) / na;
        outer.push(this.point(ys[j]!, a, lift + thick, new THREE.Vector3()));
        inner.push(this.point(ys[j]!, a, lift, new THREE.Vector3()));
        this.frame(ys[j]!, a, lift + thick);
        normal.push(nz.clone().negate());
      }
    }
    const out = new Mesher();
    const at = (i: number, j: number) => j * cols + i;
    for (let j = 0; j < ys.length - 1; j++) {
      for (let i = 0; i < na; i++) {
        const [a, b, c, d] = [at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1)];
        out.tri(outer[a]!, outer[b]!, outer[c]!, normal[a]!, normal[b]!, normal[c]!);
        out.tri(outer[c]!, outer[b]!, outer[d]!, normal[c]!, normal[b]!, normal[d]!);
      }
    }
    const top = ys.length - 1;
    for (let i = 0; i < na; i++) {
      out.quad(outer[at(i, 0)]!, outer[at(i + 1, 0)]!, inner[at(i + 1, 0)]!, inner[at(i, 0)]!, p.set(0, -1, 0));
      out.quad(outer[at(i, top)]!, outer[at(i + 1, top)]!, inner[at(i + 1, top)]!, inner[at(i, top)]!, p.set(0, 1, 0));
    }
    for (let j = 0; j < top; j++) {
      out.quad(outer[at(0, j)]!, outer[at(0, j + 1)]!, inner[at(0, j + 1)]!, inner[at(0, j)]!, p.subVectors(outer[at(0, j)]!, outer[at(1, j)]!));
      out.quad(outer[at(na, j)]!, outer[at(na, j + 1)]!, inner[at(na, j + 1)]!, inner[at(na, j)]!, p.subVectors(outer[at(na, j)]!, outer[at(na - 1, j)]!));
    }
    return out.build();
  }

  /** Heights from y0 to y1 that include every ring between them, so the panel follows the loft's kinks. */
  private heights(y0: number, y1: number, segments: number) {
    const stops = [y0, ...this.rings.map((r) => r[0]).filter((y) => y > y0 + 1e-4 && y < y1 - 1e-4), y1];
    const ys = [y0];
    for (let i = 0; i < stops.length - 1; i++) {
      const span = stops[i + 1]! - stops[i]!;
      const n = Math.max(1, Math.round((segments * span) / (y1 - y0)));
      for (let k = 1; k <= n; k++) ys.push(stops[i]! + (span * k) / n);
    }
    return ys;
  }
}

/** The shared head's surface, for hair and headgear that hug it. */
export const SKULL = new Garment(
  HEAD.map((r): Ring => [r.y, 2 * r.rx, r.rz + (r.back ?? r.rz), ((r.back ?? r.rz) - r.rz) / 2]),
  2.6
);

/** A thigh of the shared legs at a limb thickness, for seams, piping and patches. */
export const thigh = (limbs: number) => limbGarment('thigh', limbs);

/** One of the shared limbs (body-limbs.ts) as a garment to cut panels, seams and pockets from. */
export const limbGarment = (part: LimbPart, limbs: number) => new Garment(limbRings(part, limbs).map((r): Ring => [r.y, 2 * r.rx, 2 * r.rz, r.cz ?? 0]), 2.15);

export interface StrandOptions {
  /** Thickness across the flat side, as a fraction of the radius (1 = round). */
  flat?: number;
  /** Direction the wide side of a flat strand faces across. */
  side?: V3;
  seg?: number;
  radial?: number;
  /** A ring with no ends: the last point runs on into the first. */
  closed?: boolean;
}

/**
 * A tube through points whose radius changes along its length (t 0…1), round
 * or flattened into a band: hair locks, scarf folds, straps, cables.
 */
export function strand(points: V3[], radius: number | ((t: number) => number), o: StrandOptions = {}) {
  const closed = o.closed ?? false;
  const curve = new THREE.CatmullRomCurve3(
    points.map((q) => new THREE.Vector3(...q)),
    closed
  );
  const seg = o.seg ?? 8;
  const radial = o.radial ?? 6;
  const flat = o.flat ?? 1;
  const side = new THREE.Vector3(...(o.side ?? [1, 0, 0]));
  const rings: THREE.Vector3[][] = [];
  const normals: THREE.Vector3[][] = [];
  const centers: THREE.Vector3[] = [];
  const tangent = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const nor = new THREE.Vector3();
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const c = curve.getPoint(t);
    curve.getTangent(t, tangent);
    bin.copy(side).addScaledVector(tangent, -side.dot(tangent));
    if (bin.lengthSq() < 1e-6) bin.set(0, 0, 1).addScaledVector(tangent, -tangent.z);
    bin.normalize();
    nor.crossVectors(tangent, bin);
    const r = Math.max(0.0004, typeof radius === 'function' ? radius(t) : radius);
    const ring: THREE.Vector3[] = [];
    const ringN: THREE.Vector3[] = [];
    for (let f = 0; f < radial; f++) {
      const phi = (f / radial) * Math.PI * 2;
      const cs = Math.cos(phi);
      const sn = Math.sin(phi);
      ring.push(new THREE.Vector3().copy(c).addScaledVector(bin, cs * r).addScaledVector(nor, sn * r * flat));
      ringN.push(new THREE.Vector3().addScaledVector(bin, cs * flat).addScaledVector(nor, sn).normalize());
    }
    rings.push(ring);
    normals.push(ringN);
    centers.push(c);
  }
  const out = new Mesher();
  if (closed) {
    rings[seg] = rings[0]!;
    normals[seg] = normals[0]!;
  }
  for (let k = 0; k < seg; k++) {
    for (let f = 0; f < radial; f++) {
      const g = (f + 1) % radial;
      out.tri(rings[k]![f]!, rings[k]![g]!, rings[k + 1]![f]!, normals[k]![f]!, normals[k]![g]!, normals[k + 1]![f]!);
      out.tri(rings[k]![g]!, rings[k + 1]![g]!, rings[k + 1]![f]!, normals[k]![g]!, normals[k + 1]![g]!, normals[k + 1]![f]!);
    }
  }
  if (closed) return out.build();
  for (const [k, sign] of [
    [0, -1],
    [seg, 1]
  ] as const) {
    curve.getTangent(k / seg, tangent).multiplyScalar(sign);
    for (let f = 0; f < radial; f++) {
      const g = (f + 1) % radial;
      const [a, b] = sign > 0 ? [rings[k]![f]!, rings[k]![g]!] : [rings[k]![g]!, rings[k]![f]!];
      out.tri(centers[k]!, a, b, tangent, tangent, tangent);
    }
  }
  return out.build();
}

/** Radius profile of a lock or tail: slim at the root, full by `swell`, tapering to `tip` × r at the end. */
export function tapering(r: number, tip = 0.12, swell = 0.18) {
  return (t: number) => r * (t < swell ? 0.62 + (0.38 * t) / swell : 1 - (1 - tip) * ((t - swell) / (1 - swell)) ** 1.7);
}

/** Flat plate cut from an outline in the XY plane, `depth` thick along Z and centered on it, with a soft edge. */
export function plate(outline: [number, number][], depth: number, bevel = 0) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
    curveSegments: 1
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return normalizeGeometry(g);
}

class Mesher {
  private pos: number[] = [];
  private nrm: number[] = [];

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, na: THREE.Vector3, nb: THREE.Vector3, nc: THREE.Vector3) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.nrm.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
  }

  /** Flat quad a-b-c-d, wound to face along `toward`. */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, toward: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(p2.subVectors(d, a));
    if (n.lengthSq() < 1e-14) n.subVectors(c, b).cross(p2.subVectors(d, b));
    n.normalize();
    if (n.dot(toward) < 0) {
      n.negate();
      this.tri(a, c, b, n, n, n);
      this.tri(a, d, c, n, n, n);
    } else {
      this.tri(a, b, c, n, n, n);
      this.tri(a, c, d, n, n, n);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    return g;
  }
}

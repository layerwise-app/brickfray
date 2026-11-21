import * as THREE from 'three';
import type { Finish } from '../engine/materials';
import { ballGeo, boxGeo, coneGeo, cylGeo, frameGeo, partGeo, prismGeo, torusGeo } from './geo';
import type { Drawer } from './plan';
import { Frame } from './util';

/** Where a prop stands: base center, quarter turns around Y. */
export interface At {
  x: number;
  z: number;
  y?: number;
  turns?: number;
}

export const frameOf = (a: At) => new Frame(a.x, a.y ?? 0, a.z, a.turns ?? 0);

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const SIDE = new THREE.Euler(0, 0, Math.PI / 2);
const ALONG_Z = new THREE.Euler(Math.PI / 2, 0, 0);
const UPRIGHT = new THREE.Euler(0, 0, Math.PI / 2);

/**
 * Drawing helpers in a prop's local frame (meters, bottom-center origins).
 * Segment counts and bevels follow the quality tier.
 */
export class Pen {
  readonly segs: number;
  readonly bevel: number;
  constructor(
    readonly d: Drawer,
    readonly f: Frame
  ) {
    this.segs = [8, 12, 14][d.detail]!;
    this.bevel = d.profile.bevel;
  }

  get detail() {
    return this.d.detail;
  }

  /** Thin cylinders get fewer sides; the tier sets the count for thick ones. */
  segsFor(r: number) {
    if (r < 0.1) return 6;
    if (r < 0.3) return [6, 8, 10][this.detail]!;
    return this.segs;
  }

  at(f: Frame) {
    return new Pen(this.d, f);
  }

  /** Chamfered box; `bevel` overrides the tier bevel (0 keeps it sharp). */
  box(x: number, y: number, z: number, w: number, h: number, dd: number, color: string, finish?: Finish, bevel?: number, yaw = 0) {
    const thin = Math.min(w, h, dd) < 0.1;
    const b = this.detail === 0 || thin ? 0 : Math.min(bevel ?? this.bevel, w / 3, h / 3, dd / 3);
    this.d.put(this.f, `box:${r3(w)}:${r3(h)}:${r3(dd)}:${r3(b)}`, () => boxGeo(w, h, dd, b), x, y, z, { color, finish, yaw });
  }

  /** Rectangular frame ring (windows, doors) facing local +z, bottom center at (x, y, z). */
  frame(x: number, y: number, z: number, w: number, h: number, bar: number, depth: number, color: string, finish?: Finish) {
    this.d.put(this.f, `frame:${r3(w)}:${r3(h)}:${r3(bar)}:${r3(depth)}`, () => frameGeo(w, h, bar, depth), x, y, z, { color, finish });
  }

  /** Square-section beam from point a to point b (lattices, braces, stays). */
  beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, size: number, color: string, finish?: Finish) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    const pitch = Math.acos(Math.max(-1, Math.min(1, dy / len)));
    const yaw = Math.atan2(dx, dz);
    this.d.put(this.f, `box:${r3(size)}:${r3(len)}:${r3(size)}:0`, () => boxGeo(size, len, size, 0), ax, ay, az, { color, finish, yaw, tilt: new THREE.Euler(pitch, 0, 0) });
  }

  /** Convex plan-view (x, z) profile extruded upward by `height` from (x, y, z). */
  prismUp(key: string, plan: [number, number][], height: number, x: number, y: number, z: number, color: string, finish?: Finish) {
    const profile = plan.map(([px, pz]) => [pz, -px] as [number, number]);
    this.d.put(this.f, `prism:${key}:${r3(height)}`, () => prismGeo(key, profile, height), x, y + height / 2, z, { color, finish, tilt: UPRIGHT });
  }

  /** Box given by two corners. */
  span(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, finish?: Finish, bevel?: number) {
    this.box((x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, finish, bevel);
  }

  /** Upright cylinder; `edge` rounds the top rim. */
  cyl(x: number, y: number, z: number, r: number, h: number, color: string, finish?: Finish, edge = 0, segs = this.segsFor(r)) {
    const e = this.detail === 0 ? 0 : edge;
    this.d.put(this.f, `cyl:${r3(r)}:${r3(h)}:${segs}:${r3(e)}`, () => cylGeo(r, h, segs, e), x, y, z, { color, finish });
  }

  /** Cylinder lying along local x (wheels, logs, pipes), centered at (x, y, z). */
  cylX(x: number, y: number, z: number, r: number, len: number, color: string, finish?: Finish, edge = 0) {
    const e = this.detail === 0 ? 0 : edge;
    const s = this.segsFor(r);
    this.d.put(this.f, `cyl:${r3(r)}:${r3(len)}:${s}:${r3(e)}:c`, () => cylGeo(r, len, s, e, true), x + len / 2, y, z, { color, finish, tilt: SIDE });
  }

  /** Cylinder lying along local z, centered at (x, y, z). */
  cylZ(x: number, y: number, z: number, r: number, len: number, color: string, finish?: Finish, edge = 0, s = this.segsFor(r)) {
    const e = this.detail === 0 ? 0 : edge;
    this.d.put(this.f, `cyl:${r3(r)}:${r3(len)}:${s}:${r3(e)}:c`, () => cylGeo(r, len, s, e, true), x, y, z - len / 2, { color, finish, tilt: ALONG_Z });
  }

  cone(x: number, y: number, z: number, r0: number, r1: number, h: number, color: string, finish?: Finish, segs = this.segs, yaw = 0) {
    this.d.put(this.f, `cone:${r3(r0)}:${r3(r1)}:${r3(h)}:${segs}`, () => coneGeo(r0, r1, h, segs), x, y, z, { color, finish, yaw });
  }

  /** Faceted ball centered at (x, y, z), optionally squashed. */
  ball(x: number, y: number, z: number, r: number, color: string, scale?: [number, number, number], jitter = 0, seed = 1, finish?: Finish) {
    const det = this.detail === 0 || r < 0.2 ? 0 : 1;
    this.d.put(this.f, `ball:${r3(r)}:${det}:${r3(jitter)}:${seed}`, () => ballGeo(r, det, jitter, seed), x, y, z, { color, finish, scale });
  }

  /** Toy brick/plate: w×dd studs, h plates, with studs on top when asked. */
  part(x: number, y: number, z: number, w: number, dd: number, h: number, color: string, studs = true, finish?: Finish, yaw = 0) {
    const s = studs && this.detail > 0;
    this.d.put(this.f, `part:${w}:${dd}:${h}:${s}`, () => partGeo(w, dd, h, s, this.d.profile), x, y, z, { color, finish, yaw });
  }

  /** Extruded convex (z, y) profile along x; `key` names the profile. */
  prism(key: string, profile: [number, number][], width: number, x: number, y: number, z: number, color: string, finish?: Finish, yaw = 0) {
    this.d.put(this.f, `prism:${key}:${r3(width)}`, () => prismGeo(key, profile, width), x, y, z, { color, finish, yaw });
  }

  ring(x: number, y: number, z: number, radius: number, tube: number, color: string, finish?: Finish) {
    const radial = this.detail === 0 ? 4 : 6;
    const tubular = this.segs;
    this.d.put(this.f, `torus:${r3(radius)}:${r3(tube)}:${radial}:${tubular}`, () => torusGeo(radius, tube, radial, tubular), x, y, z, { color, finish });
  }

  /** Ring standing upright facing local z (lifebuoys, tyres on walls). */
  ringUp(x: number, y: number, z: number, radius: number, tube: number, color: string, finish?: Finish) {
    const radial = this.detail === 0 ? 4 : 6;
    const tubular = this.segs;
    this.d.put(this.f, `torus:${r3(radius)}:${r3(tube)}:${radial}:${tubular}`, () => torusGeo(radius, tube, radial, tubular), x, y, z, { color, finish, tilt: ALONG_Z });
  }
}

export const pen = (d: Drawer, a: At) => new Pen(d, frameOf(a));

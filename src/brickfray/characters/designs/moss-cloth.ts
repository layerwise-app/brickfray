import * as THREE from 'three';
import type { PartSet } from '../parts';
import { cloth, loop, pick, samples, sgnPow, surface, TAU, type Surface } from './sheet';

const bump = (x: number, from: number, to: number) => (x <= from || x >= to ? 0 : Math.sin(((x - from) / (to - from)) * Math.PI));

/** Smooth curve through evenly weighted [x, y] keys (Catmull-Rom). */
function spline(keys: [number, number][]) {
  const y = (i: number) => keys[Math.min(keys.length - 1, Math.max(0, i))]![1];
  return (x: number) => {
    let i = 0;
    while (i < keys.length - 2 && x > keys[i + 1]![0]) i++;
    const t = Math.min(1, Math.max(0, (x - keys[i]![0]) / (keys[i + 1]![0] - keys[i]![0])));
    const [p0, p1, p2, p3] = [y(i - 1), y(i), y(i + 1), y(i + 2)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  };
}

/** The hood's rings from the brim (v = 0) to the tail's tip (v = 1): depth, half width, top and bottom. */
const HOOD = {
  z: spline([[0, -0.12], [0.12, -0.075], [0.3, 0.0], [0.5, 0.09], [0.65, 0.165], [0.8, 0.25], [0.92, 0.32], [1, 0.36]]),
  w: spline([[0, 0.137], [0.12, 0.157], [0.3, 0.164], [0.5, 0.149], [0.65, 0.108], [0.8, 0.062], [0.92, 0.027], [1, 0]]),
  top: spline([[0, 0.222], [0.12, 0.268], [0.3, 0.282], [0.5, 0.27], [0.65, 0.235], [0.8, 0.162], [0.92, 0.078], [1, 0.0]]),
  bottom: spline([[0, -0.062], [0.12, -0.068], [0.3, -0.066], [0.5, -0.05], [0.65, 0.0], [0.8, 0.03], [0.92, 0.02], [1, 0.0]])
};

/** The hood's outer face in head space: u around the opening from the crown, v from the brim back to the tail's tip. */
export const hoodAt =
  (grow = 0): Surface =>
  (u, v) => {
    const phi = u * TAU;
    const s = Math.sin(phi);
    const co = Math.cos(phi);
    const front = Math.max(0, 1 - v / 0.3) ** 2;
    const gather = 1 + 0.05 * Math.sin(phi * 7) * Math.max(0, -co) * bump(v, 0.1, 0.7);
    const top = HOOD.top(v);
    const bottom = HOOD.bottom(v);
    const w = v >= 1 ? 0 : (Math.max(0, HOOD.w(v)) + grow) * gather;
    const half = v >= 1 ? 0 : ((top - bottom) / 2 + grow) * gather;
    const z = HOOD.z(v) - 0.06 * Math.max(0, co) ** 1.5 * front + 0.09 * Math.max(0, -co) ** 1.3 * front;
    return [w * sgnPow(s, 0.8) * (1 - 0.2 * Math.max(0, co) ** 2), (top + bottom) / 2 + half * sgnPow(co, 0.8), z];
  };

/** Pointed hood on the head bone: brim over the brow, gathered under the chin, tail drooping behind. */
export function hood(b: PartSet, color: string, lining: string, trim: string) {
  const us = loop(pick(b, 12, 20, 44));
  const body = cloth(us, samples(pick(b, 6, 9, 18), b.detail > 1 ? 0.03 : 0), hoodAt(), 0.016, { closed: true, flip: true, round: [1, 0.05], lined: [0, 0.4] });
  b.add('head', body.outer, color, { look: 'cloth' });
  b.add('head', body.inner, lining, { look: 'cloth' });
  if (!b.hero) return;
  b.add('head', surface(us, [0.014, 0.05, 0.085], hoodAt(0.0035), true, true), trim, { look: 'cloth' });
  // Seam along the crown.
  b.add('head', surface([-0.012, 0, 0.012], samples(10).map((i) => 0.1 + i * 0.85), (u, v) => hoodAt(u ? 0.001 : 0.006)(u, v), false, true), trim, { look: 'cloth' });
}

/** Gathered cowl around the neck where the hood meets the mantle, on the chest bone. */
export function cowl(b: PartSet, color: string) {
  const f: Surface = (u, v) => {
    const al = u * TAU;
    const psi = v * TAU;
    const rt = 0.034 * (1 + 0.16 * Math.sin(al * 7 + psi * 2)) * (1 - 0.12 * Math.cos(al));
    const out = rt * Math.cos(psi);
    return [Math.sin(al) * (0.11 + out), 0.245 - 0.04 * Math.cos(al) + rt * 1.15 * Math.sin(psi), -Math.cos(al) * (0.09 + out) + 0.004];
  };
  b.add('chest', surface(loop(pick(b, 12, 18, 30)), samples(pick(b, 4, 5, 9)), f, true, true), color, { look: 'cloth' });
}

/** Pointed dag k of n around a loop: 0 at the notches, 1 at the tip. */
const dag = (u: number, count: number) => 1 - Math.abs(((u * count) % 1) - 0.5) * 2;

/** The mantle's outer face in chest space: u around from the front, v from the neck out to the dagged edge. */
export const mantleAt: Surface = (u, v) => {
  const al = u * TAU;
  const s = v * (1 + 0.24 * dag(u + 0.05, 10) ** 0.75);
  const k = s ** 0.9;
  const rx = 0.092 + (0.205 - 0.092) * k;
  const rz = 0.08 + ((Math.cos(al) > 0 ? 0.143 : 0.15) - 0.08) * k;
  const edge = 0.24 - 0.135 * (1 - Math.abs(Math.sin(al))) ** 0.8;
  return [Math.sin(al) * rx, 0.272 - (0.272 - edge) * s ** 1.9, -Math.cos(al) * rz];
};

/** Short dagged cape over chest and back, on the chest bone; the shoulder caps carry it over the arms. */
export function mantle(b: PartSet, color: string, lining: string) {
  const piece = cloth(loop(10 * pick(b, 2, 4, 8)), samples(pick(b, 3, 4, 7), b.hero ? 0.06 : 0), mantleAt, 0.012, { closed: true, round: [1, 0.1], lined: [0.3, 1] });
  b.add('chest', piece.outer, color, { look: 'cloth' });
  b.add('chest', piece.inner, lining, { look: 'cloth' });
}

/** Cloth cap over a shoulder with a dagged skirt, on an upper-arm bone; shorter toward the body. */
export function shoulderCap(b: PartSet, bone: 'upperArmL' | 'upperArmR', sign: number, color: string, lining: string) {
  const dags = 6;
  const f: Surface = (u, v) => {
    const al = u * TAU;
    const outward = (Math.cos(al) * sign + 1) / 2;
    const drop = (0.05 + 0.065 * outward) * (1 + 0.3 * dag(u, dags) ** 0.75);
    const ang = Math.min(1, v / 0.5) * (Math.PI / 2);
    const skirt = Math.max(0, (v - 0.5) / 0.5);
    const r = 0.088 * Math.sin(ang) + 0.016 * skirt;
    return [Math.cos(al) * r + sign * 0.006, 0.008 + 0.082 * Math.cos(ang) - skirt * drop, Math.sin(al) * r * 1.08];
  };
  const piece = cloth(loop(dags * pick(b, 2, 2, 4)), samples(pick(b, 4, 5, 8), b.hero ? 0.05 : 0), f, 0.011, { closed: true, round: [1, 0.08], lined: [0.4, 1] });
  b.add(bone, piece.outer, color, { look: 'cloth' });
  b.add(bone, piece.inner, lining, { look: 'cloth' });
}

/** Where the cloak's outer face is, in dangleBack space: u across, v down; `lift` raises a patch off the cloth. */
export const cloakAt =
  (lift = 0): Surface =>
  (u, v) => {
    const x = u * 2 - 1;
    const pleat = Math.cos(x * Math.PI * 4.5 + 0.5 * Math.sin(v * 3));
    const w = 0.18 + 0.125 * v ** 0.8;
    const y = -0.07 - v * 0.8 * (1 - 0.06 * x * x) + 0.02 * pleat * v;
    return [x * w, y, -0.014 - 0.07 * x * x * (1 - 0.35 * v) + 0.05 * v + (0.003 + 0.03 * v ** 1.4) * pleat + lift];
  };

/** Long cloak with pleats deepening toward the hem, on the swinging back bone. */
export function cloak(b: PartSet, color: string, lining: string, trim: string, thread: string) {
  const us = samples(pick(b, 12, 22, 54), b.hero ? 0.012 : 0);
  const piece = cloth(us, samples(pick(b, 4, 7, 16), b.hero ? 0.012 : 0), cloakAt(), 0.012, { flip: true, round: [0.03, 0.03] });
  b.add('dangleBack', piece.outer, color, { look: 'cloth' });
  b.add('dangleBack', piece.inner, lining, { look: 'cloth' });
  if (b.detail > 1) b.add('dangleBack', surface(us, [0.9, 0.94, 0.975], cloakAt(0.003), false, true), trim, { look: 'cloth' });
  if (!b.hero) return;
  // Stitching above the hem band.
  for (let i = 0; i < 46; i++) {
    const u = 0.03 + (i / 45) * 0.94;
    const [x0, y0, z0] = cloakAt(0.004)(u - 0.006, 0.885);
    const [x1, y1, z1] = cloakAt(0.004)(u + 0.006, 0.885);
    b.box('dangleBack', [Math.hypot(x1 - x0, z1 - z0), 0.004, 0.004], thread, { at: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], rot: [0, Math.atan2(z0 - z1, x1 - x0), 0], look: 'cloth', bevel: 0 });
  }
}

/** Tunic skirt flaring out from under the belt, on the pelvis bone. */
export function skirt(b: PartSet, color: string, lining: string) {
  const f: Surface = (u, v) => {
    const al = u * TAU;
    const co = Math.cos(al);
    const si = Math.sin(al);
    const grow = 1 + (0.02 + 0.045 * (1 + co) + 0.02 * Math.sin(al * 9)) * v;
    return [0.165 * sgnPow(si, 0.62) * grow, 0.012 - 0.1 * v - 0.012 * v * Math.abs(si) ** 3, -0.108 * sgnPow(co, 0.62) * grow];
  };
  const piece = cloth(loop(pick(b, 16, 20, 36)), samples(pick(b, 2, 3, 4), b.hero ? 0.08 : 0), f, 0.01, { closed: true, round: [1, 0.12], lined: [0.3, 1] });
  b.add('pelvis', piece.outer, color, { look: 'cloth' });
  if (b.detail > 1) b.add('pelvis', piece.inner, lining, { look: 'cloth' });
}

/** Leaf lying in the XY plane, tip toward +Y, face toward +Z, creased along its midrib. */
export function leaf(len: number, wide: number, seg: number, curl = 0.12) {
  const f: Surface = (u, v) => {
    const x = u * 2 - 1;
    const w = (wide / 2) * Math.sin(Math.PI * (0.04 + 0.96 * v)) ** 0.7 * (1 - 0.35 * v);
    return [x * w, (v - 0.5) * len, 0.3 * Math.abs(x) * w + curl * len * v * v];
  };
  const piece = cloth(samples(4), samples(seg), f, Math.min(0.006, wide * 0.12), { round: [0.3, 0.12] });
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal'] as const) {
    const o = piece.outer.getAttribute(name).array;
    const i = piece.inner.getAttribute(name).array;
    const merged = new Float32Array(o.length + i.length);
    merged.set(o);
    merged.set(i, o.length);
    g.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  return g;
}

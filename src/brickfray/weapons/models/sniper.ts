import * as THREE from 'three';
import { aim, T, type ModelBuilder } from '../builder';
import { ball, box, gear, latheZ, pipe, prism, slab, tube } from '../shapes';
import { railTop, screw, shade, slot, studSide } from './details';

const C = {
  stock: '#5d7543',
  metal: '#3b4148',
  barrel: '#454b52',
  dark: '#1f252b',
  scope: '#262b31',
  accent: '#f58a1f',
  bolt: '#c9cdd2',
  lens: '#9fc8ff',
  deep: '#0b1622'
};
const BORE = 0.088;
const SCOPE_Y = 0.146;

/** Longstud: olive chassis, long fluted barrel, big scope, working bolt and folded bipod. */
export function buildSniper(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Receiver tube and ejection port.
  b.add(tube(0.0172, 0.25, lod.seg, 0.003), C.metal, 'metal', T(0, BORE, -0.075));
  if (b.minor) {
    slot(b, 0.0165, BORE + 0.004, -0.02, 0.003, 0.014, 0.06);
    railTop(b, 0, BORE + 0.0165, 0.04, -0.19, 0.02, C.dark);
  }

  // Chassis stock: fore-end, grip, butt and cheek rest.
  b.add(slab([[-0.47, 0.082], [-0.2, 0.082], [-0.2, 0.076], [0.07, 0.076], [0.07, 0.04], [-0.12, 0.04], [-0.2, 0.046], [-0.47, 0.05]], 0.05, lod, [0.012, 0.004, 0.002, 0.004, 0.006, 0.01, 0.01, 0.012]), C.stock, 'plastic');
  if (b.minor) b.add(slab([[-0.075, 0.05], [-0.01, 0.05], [-0.012, 0.012], [-0.075, 0.016]], 0.0095, lod, 0.006, [[[-0.068, 0.048], [-0.019, 0.048], [-0.02, 0.02], [-0.068, 0.022]]]), C.dark, 'satin');
  else b.add(box(0.0095, 0.006, 0.065), C.dark, 'satin', T(0, 0.015, -0.043));
  if (b.minor) b.add(slab([[-0.046, 0.05], [-0.038, 0.05], [-0.039, 0.036], [-0.043, 0.027], [-0.05, 0.025], [-0.047, 0.035]], 0.005, lod, 0.002), C.accent, 'plastic');
  const grip: [number, number][] = [[-0.02, 0.05], [0.03, 0.05], [0.046, -0.06], [0.012, -0.066], [0.0, -0.058], [-0.006, -0.024], [-0.012, 0.008]];
  b.add(slab(grip, 0.032, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.stock, 'plastic');
  const butt: [number, number][] = [[0.06, 0.078], [0.34, 0.09], [0.352, 0.08], [0.352, -0.03], [0.336, -0.04], [0.29, -0.03], [0.17, -0.006], [0.12, 0.0], [0.08, -0.04], [0.04, -0.045], [0.06, 0.04]];
  b.add(slab(butt, 0.046, lod, d >= 1 ? [0.01, 0.008, 0.008, 0.008, 0.01, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01] : [0, 0, 0, 0, 0, 0.03, 0.02, 0.02, 0, 0, 0]), C.stock, 'plastic');
  b.add(slab([[0.13, 0.078], [0.31, 0.088], [0.31, 0.118], [0.29, 0.124], [0.16, 0.116], [0.13, 0.098]], 0.04, lod, d >= 1 ? [0.004, 0.004, 0.006, 0.012, 0.012, 0.006] : 0), shade(C.stock, 0.82), 'plastic');
  b.add(slab([[0.35, 0.095], [0.366, 0.095], [0.366, -0.044], [0.35, -0.044]], 0.05, lod, 0.004), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      studSide(b, s, s * 0.023, 0.025, 0.235, 4, 0.02, 0.0056, C.stock);
      for (const z of [-0.26, -0.31, -0.36, -0.41]) slot(b, s * 0.0251, 0.066, z, 0.0016, 0.012, 0.03);
    }
    b.add(gear(0.0055, 0.0066, 10, 0.05), C.accent, 'plastic', T(0, 0.103, 0.215, 0, Math.PI / 2));
  }
  if (d >= 2) {
    for (let i = 0; i < 6; i++) b.add(box(0.052, 0.003, 0.0026, 0.0006), shade(C.dark, 1.4), 'rubber', T(0, -0.03 + i * 0.022, 0.3665));
    for (const s of [1, -1]) for (const z of [-0.08, -0.17, 0.05]) screw(b, s * 0.0252, 0.058, z, 'x', 0.0026);
  }

  // Long fluted barrel and muzzle brake.
  if (!b.minor) b.add(tube(0.0122, 0.56, lod.seg), C.barrel, 'metal', T(0, BORE, -0.48));
  else {
    b.add(tube(0.0128, 0.1, lod.seg, 0.001), C.barrel, 'metal', T(0, BORE, -0.25));
    b.add(d >= 1 ? gear(0.0095, 0.0118, 8, 0.4) : tube(0.011, 0.4, lod.seg), C.barrel, 'metal', T(0, BORE, -0.5));
    b.add(tube(0.0112, 0.06, lod.seg, 0.001, 0.0118), C.barrel, 'metal', T(0, BORE, -0.73));
  }
  if (d >= 1) b.add(tube(0.0098, 0.4, lod.seg), C.dark, 'metal', T(0, BORE, -0.5));
  if (!b.minor) b.add(tube(0.0148, 0.06, lod.seg), C.dark, 'metal', T(0, BORE, -0.79));
  else b.add(latheZ([[0, -0.03], [0.0058, -0.03], [0.0058, -0.028], [0.0135, -0.028], [0.0148, -0.025], [0.0148, 0.026], [0.0128, 0.03], [0, 0.03]], lod.seg), C.dark, 'metal', T(0, BORE, -0.79));
  if (b.minor) b.add(tube(0.006, 0.0016, lod.segSmall), '#0b0d10', 'dark', T(0, BORE, -0.8202));
  if (d >= 1) for (const s of [1, -1]) for (const z of [-0.774, -0.79, -0.806]) slot(b, s * 0.0145, BORE, z, 0.003, 0.009, 0.0085, '#0d1014');

  // Folded bipod under the fore-end.
  if (b.minor) b.add(box(0.03, 0.012, 0.024, lod.bevel), C.dark, 'metal', T(0, 0.043, -0.445));
  for (const s of b.minor ? [1, -1] : []) {
    b.add(tube(0.0042, 0.2, lod.segSmall, 0.001), C.metal, 'metal', T(s * 0.011, 0.034, -0.35));
    b.add(tube(0.0055, 0.03, lod.segSmall, 0.002), C.dark, 'rubber', T(s * 0.011, 0.034, -0.24));
  }

  // Scope: rings, tube, bells, turrets and glass.
  for (const z of [-0.125, 0.0]) {
    b.add(box(0.026, 0.016, 0.016, lod.bevel), C.dark, 'satin', T(0, BORE + 0.026, z));
    if (d >= 1) b.add(pipe(0.0185, 0.0144, 0.016, lod.seg), C.dark, 'satin', T(0, SCOPE_Y, z));
    if (d >= 2) for (const s of [1, -1]) screw(b, s * 0.0135, BORE + 0.026, z, 'x', 0.0022);
  }
  const scopeProfile: [number, number][] =
    d >= 1
      ? [[0, 0.105], [0.0175, 0.105], [0.019, 0.1], [0.019, 0.07], [0.0145, 0.055], [0.0145, -0.15], [0.025, -0.2], [0.0262, -0.205], [0.0262, -0.258], [0.0245, -0.262], [0, -0.262]]
      : [[0, 0.105], [0.019, 0.105], [0.019, 0.07], [0.0145, 0.055], [0.0145, -0.15], [0.0262, -0.205], [0.0262, -0.262], [0, -0.262]];
  b.add(latheZ(scopeProfile, lod.seg), C.scope, 'satin', T(0, SCOPE_Y, 0));
  if (b.minor) {
    b.add(tube(0.0236, 0.002, lod.seg), C.deep, 'chrome', T(0, SCOPE_Y, -0.2625));
    b.add(tube(0.0168, 0.002, lod.seg), C.deep, 'chrome', T(0, SCOPE_Y, 0.1052));
  }
  if (lod.glass) {
    b.glass(tube(0.0236, 0.0016, lod.seg), C.lens, T(0, SCOPE_Y, -0.2638));
    b.glass(tube(0.0168, 0.0014, lod.seg), C.lens, T(0, SCOPE_Y, 0.1062));
  }
  b.add(tube(0.0182, 0.032, lod.seg), C.scope, 'satin', T(0, SCOPE_Y, -0.065));
  b.add(b.minor ? gear(0.0098, 0.0112, d >= 2 ? 18 : 10, 0.016) : tube(0.0105, 0.016, lod.seg), C.dark, 'satin', T(0, SCOPE_Y + 0.024, -0.065, Math.PI / 2));
  if (b.minor) b.add(tube(0.0102, 0.006, lod.segSmall, 0.002), C.accent, 'plastic', T(0, SCOPE_Y + 0.035, -0.065, Math.PI / 2));
  if (b.minor) {
    b.add(gear(0.0092, 0.0104, d >= 2 ? 16 : 10, 0.014), C.dark, 'satin', T(0.023, SCOPE_Y, -0.065, 0, Math.PI / 2));
    b.add(tube(0.0094, 0.005, lod.segSmall, 0.002), C.accent, 'plastic', T(0.032, SCOPE_Y, -0.065, 0, Math.PI / 2));
  }
  if (d >= 1) {
    b.add(tube(0.0112, 0.012, lod.segSmall, 0.002), C.dark, 'satin', T(-0.022, SCOPE_Y, -0.065, 0, Math.PI / 2));
    b.add(gear(0.0182, 0.02, 20, 0.014), C.dark, 'rubber', T(0, SCOPE_Y, 0.082));
  }
  if (d >= 2) {
    for (let i = 0; i < 5; i++) b.add(box(0.0014, 0.0008, 0.0026), '#e8e8e8', 'satin', T(-0.004 + i * 0.002, SCOPE_Y + 0.031, -0.0555));
    b.add(box(0.0012, 0.006, 0.0014), C.accent, 'plastic', T(0, SCOPE_Y + 0.016, -0.055));
  }

  // Bolt (animated): body, handle arm and ball knob, pivoting on the bore axis.
  b.part('bolt', new THREE.Vector3(0, BORE, 0.03));
  b.add(tube(0.0108, 0.11, lod.seg, 0.002), C.bolt, 'chrome', T(0, BORE, -0.005));
  if (b.minor) b.add(latheZ([[0, 0.0], [0.0128, 0.0], [0.0136, 0.008], [0.0128, 0.03], [0, 0.03]], lod.seg), C.metal, 'metal', T(0, BORE, 0.048));
  b.add(tube(0.0034, 0.05, lod.segSmall, 0.001), C.bolt, 'chrome', aim(0.027, BORE - 0.012, 0.05, 0.9, -0.42, 0));
  b.add(ball(0.0095, lod.segSmall + 2), C.accent, 'plastic', T(0.05, BORE - 0.024, 0.05));
  b.node('boltKnob', 0.05, BORE - 0.024, 0.05);

  // Box magazine (animated).
  b.part('magazine', new THREE.Vector3(0, 0.046, -0.105));
  b.add(slab([[-0.135, 0.07], [-0.08, 0.07], [-0.08, 0.008], [-0.135, 0.008]], 0.03, lod, 0.004), C.dark, 'satin');
  b.add(slab([[-0.077, 0.012], [-0.138, 0.012], [-0.138, 0.0], [-0.077, 0.0]], 0.034, lod, 0.003), C.accent, 'plastic');
  b.node('magHold', 0, 0.0, -0.11);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.822);
  b.node('eject', 0.019, BORE + 0.006, -0.02);
  b.node('support', 0, 0.066, -0.33);
  b.node('sight', 0, SCOPE_Y, 0.105);
  b.node('grip', 0, 0, 0, -0.22);
}

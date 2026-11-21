import * as THREE from 'three';
import { aim, T, type ModelBuilder } from '../builder';
import { ball, box, gear, latheZ, pipe, prism, slab, torus, tube } from '../shapes';
import { railTop, screw, shade, sidePanel, slot, studSide } from './details';

const C = {
  stock: '#5d7543',
  metal: '#3b4148',
  barrel: '#454b52',
  dark: '#1f252b',
  scope: '#262b31',
  accent: '#f58a1f',
  bolt: '#c9cdd2',
  lens: '#9fc8ff',
  deep: '#0b1622',
  coat: '#2a2466',
  bloom: '#6a2f8c',
  glint: '#d9f2ff',
  mag: '#5b626b'
};
const BORE = 0.088;
const SCOPE_Y = 0.146;
/** Where the eyepiece and objective glass sit, recessed from the rims at 0.105 and -0.262. */
const EYE_LENS = 0.089;
const FRONT_LENS = -0.24;

/** A convex lens bulging toward +Z, so the sky slides across it as the rifle moves. */
const lens = (r: number, bulge: number, seg: number) => latheZ([[0, bulge], [r * 0.4, bulge * 0.86], [r * 0.75, bulge * 0.46], [r, 0], [0, 0]], seg);

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

  // Chassis stock: fore-end, grip, butt and cheek rest, dull painted polymer so the olive holds at a glancing angle.
  // Vent slots cut right through the fore-end under the barrel.
  const vents: [number, number][][] = d >= 1 ? [-0.26, -0.31, -0.36, -0.41].map((z) => [[z + 0.015, 0.0715], [z - 0.015, 0.0715], [z - 0.015, 0.0595], [z + 0.015, 0.0595]]) : [];
  b.add(slab([[-0.47, 0.082], [-0.2, 0.082], [-0.2, 0.076], [0.07, 0.076], [0.07, 0.04], [-0.12, 0.04], [-0.2, 0.046], [-0.47, 0.05]], 0.05, lod, [0.006, 0.004, 0.002, 0.004, 0.006, 0.01, 0.01, 0.012], vents, d >= 1 ? 0.003 : 0), C.stock, 'dark');
  if (b.minor) b.add(slab([[-0.075, 0.05], [-0.01, 0.05], [-0.012, 0.012], [-0.075, 0.016]], 0.0095, lod, 0.006, [[[-0.068, 0.048], [-0.019, 0.048], [-0.02, 0.02], [-0.068, 0.022]]]), C.dark, 'satin');
  else b.add(box(0.0095, 0.006, 0.065), C.dark, 'satin', T(0, 0.015, -0.043));
  if (b.minor) b.add(slab([[-0.046, 0.05], [-0.038, 0.05], [-0.039, 0.036], [-0.043, 0.027], [-0.05, 0.025], [-0.047, 0.035]], 0.005, lod, 0.002), C.accent, 'plastic');
  const grip: [number, number][] = [[-0.02, 0.05], [0.03, 0.05], [0.046, -0.06], [0.012, -0.066], [0.0, -0.058], [-0.006, -0.024], [-0.012, 0.008]];
  b.add(slab(grip, 0.032, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.stock, 'dark');
  if (d >= 1) b.add(slab([[-0.01, 0.032], [0.026, 0.032], [0.04, -0.05], [0.014, -0.057], [0.003, -0.05], [-0.004, -0.02]], 0.035, lod, 0.006), C.dark, 'rubber');
  const butt: [number, number][] = [[0.06, 0.078], [0.34, 0.09], [0.352, 0.08], [0.352, -0.03], [0.336, -0.04], [0.29, -0.03], [0.17, -0.006], [0.12, 0.0], [0.08, -0.04], [0.04, -0.045], [0.06, 0.04]];
  // Skeleton butt: the lightening cut leaves a frame, not a flat side, and the cheek riser stands on two satin posts.
  const cut: [number, number][] = [[0.17, 0.064], [0.31, 0.07], [0.31, 0.002], [0.29, -0.012], [0.19, 0.012], [0.17, 0.03]];
  b.add(slab(butt, 0.046, lod, d >= 1 ? [0.01, 0.008, 0.008, 0.008, 0.01, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01] : [0, 0, 0, 0, 0, 0.03, 0.02, 0.02, 0, 0, 0], d >= 1 ? [cut] : []), C.stock, 'dark');
  b.add(slab([[0.13, 0.088], [0.31, 0.096], [0.31, 0.118], [0.29, 0.124], [0.16, 0.116], [0.13, 0.104]], 0.04, lod, d >= 1 ? [0.004, 0.004, 0.006, 0.012, 0.012, 0.006] : 0), C.dark, 'rubber');
  for (const z of [0.165, 0.275]) b.add(tube(0.0042, 0.016, lod.segSmall), C.metal, 'satin', T(0, 0.088, z, Math.PI / 2));
  b.add(slab([[0.35, 0.095], [0.366, 0.095], [0.366, -0.044], [0.35, -0.044]], 0.05, lod, 0.004), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      studSide(b, s, s * 0.023, 0.038, 0.331, 1, 0.02, 0.0056, C.stock);
    }
    b.add(gear(0.0055, 0.0066, 10, 0.05), C.accent, 'plastic', T(0, 0.103, 0.215, 0, Math.PI / 2));
    // Rubber grip panels standing proud of the fore-end and the butt frame, and sling studs.
    sidePanel(b, [[-0.06, 0.07], [-0.19, 0.07], [-0.19, 0.048], [-0.06, 0.048]], 0.05, shade(C.stock, 0.72));
    sidePanel(b, [[0.16, 0.0605], [0.07, 0.065], [0.07, 0.049], [0.16, 0.0445]], 0.046, shade(C.stock, 0.72));
    for (const z of [-0.42, 0.3]) b.add(tube(0.0035, 0.008, lod.segSmall), C.metal, 'satin', T(0, z < 0 ? 0.046 : -0.036, z, Math.PI / 2));
  }
  if (d >= 2) {
    for (let i = 0; i < 6; i++) b.add(box(0.052, 0.003, 0.0026, 0.0006), shade(C.dark, 1.4), 'rubber', T(0, -0.03 + i * 0.022, 0.3665));
    for (const s of [1, -1]) for (const z of [-0.08, -0.17, 0.05]) screw(b, s * (z < -0.06 ? 0.0267 : 0.0252), 0.058, z, 'x', 0.0026);
    for (const s of [1, -1]) for (const [z, y] of [[0.155, 0.072], [0.325, 0.078], [0.325, -0.022]]) screw(b, s * 0.0232, y, z, 'x', 0.0024);
  }

  // Long fluted barrel and muzzle brake.
  if (!b.minor) b.add(tube(0.0122, 0.56, lod.seg), C.barrel, 'satin', T(0, BORE, -0.48));
  else {
    b.add(tube(0.0128, 0.1, lod.seg, 0.001), C.barrel, 'satin', T(0, BORE, -0.25));
    b.add(d >= 1 ? gear(0.0106, 0.0118, 6, 0.4) : tube(0.011, 0.4, lod.seg), C.barrel, 'satin', T(0, BORE, -0.5));
    b.add(tube(0.0112, 0.06, lod.seg, 0.001, 0.0118), C.barrel, 'satin', T(0, BORE, -0.73));
  }
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
  // Both bells are hollow: each lens sits down its tube, so the eye looks into depth, not at a painted disc.
  const scopeProfile: [number, number][] =
    d >= 1
      ? [[0, EYE_LENS], [0.0152, EYE_LENS], [0.0166, 0.105], [0.0175, 0.105], [0.019, 0.1], [0.019, 0.07], [0.0145, 0.055], [0.0145, -0.15], [0.025, -0.2], [0.0262, -0.205], [0.0262, -0.258], [0.0245, -0.262], [0.0238, -0.262], [0.0222, FRONT_LENS], [0, FRONT_LENS]]
      : [[0, 0.105], [0.019, 0.105], [0.019, 0.07], [0.0145, 0.055], [0.0145, -0.15], [0.0262, -0.205], [0.0262, -0.262], [0, -0.262]];
  b.add(latheZ(scopeProfile, lod.seg), C.scope, 'satin', T(0, SCOPE_Y, 0));
  if (d >= 1) {
    b.add(pipe(0.0166, 0.0153, 0.018, lod.seg), '#0a0d11', 'dark', T(0, SCOPE_Y, 0.0955));
    b.add(pipe(0.0238, 0.0223, 0.022, lod.seg), '#0a0d11', 'dark', T(0, SCOPE_Y, -0.2505));
  }
  if (b.minor) {
    // Coated glass: a dark mirror with a violet bloom toward the middle and a sky glint across the top.
    const coat = (r: number, z: number, dir: 1 | -1) => {
      b.add(tube(r, 0.0012, lod.seg), C.deep, 'chrome', T(0, SCOPE_Y, z));
      if (!lod.glass) return;
      b.add(tube(r * 0.7, 0.0006, lod.seg), C.coat, 'chrome', T(0, SCOPE_Y, z + dir * 0.0008));
      b.add(tube(r * 0.36, 0.0006, lod.seg), C.bloom, 'chrome', T(0, SCOPE_Y, z + dir * 0.0012));
      b.add(torus(r * 0.74, r * 0.045, lod.seg, 1.25), C.glint, 'glow', T(0, SCOPE_Y, z + dir * 0.0018, 0, 0, 1.2));
      b.add(torus(r * 0.5, r * 0.03, lod.seg, 0.7), C.glint, 'glow', T(0, SCOPE_Y, z + dir * 0.0018, 0, 0, 4.5));
    };
    coat(0.0224, FRONT_LENS - 0.0006, -1);
    coat(0.0153, EYE_LENS + 0.0006, 1);
  }
  if (lod.glass) {
    b.glass(lens(0.0222, 0.0042, lod.seg), C.lens, T(0, SCOPE_Y, FRONT_LENS - 0.0026, Math.PI));
    b.glass(lens(0.0152, 0.003, lod.seg), C.lens, T(0, SCOPE_Y, EYE_LENS + 0.0026));
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
  b.add(ball(0.0125, lod.segSmall + 4), C.accent, 'plastic', T(0.053, BORE - 0.0255, 0.05));
  b.node('boltKnob', 0.053, BORE - 0.0255, 0.05);

  // Box magazine (animated).
  b.part('magazine', new THREE.Vector3(0, 0.046, -0.105));
  b.add(slab([[-0.139, 0.07], [-0.078, 0.07], [-0.076, -0.022], [-0.137, -0.03]], 0.032, lod, 0.004), C.mag, 'metal');
  b.add(slab([[-0.072, -0.017], [-0.141, -0.026], [-0.142, -0.04], [-0.072, -0.031]], 0.037, lod, 0.004), C.accent, 'plastic');
  if (d >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) b.add(box(0.0014, 0.05, 0.0045, 0.0005), shade(C.mag, 0.62), 'dark', T(s * 0.0162, 0.004, -0.124 + i * 0.016, 0.06));
      b.add(box(0.0014, 0.007, 0.03, 0.0005), C.bolt, 'chrome', T(s * 0.0163, 0.031, -0.108));
    }
    b.add(box(0.022, 0.058, 0.0022, 0.0006), shade(C.mag, 1.3), 'metal', T(0, 0.004, -0.1395, 0.06));
  }
  b.node('magHold', 0, -0.012, -0.108);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.822);
  b.node('eject', 0.019, BORE + 0.006, -0.02);
  b.node('support', 0, 0.066, -0.33);
  b.node('sight', 0, SCOPE_Y, 0.105);
  b.node('grip', 0, 0, 0, -0.22);
}

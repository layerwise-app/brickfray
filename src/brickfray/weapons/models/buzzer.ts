import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { box, prism, slab, tube } from '../shapes';
import { screw, shade, sidePanel, slot, studSide } from './details';

const C = {
  frame: '#33383e',
  slide: '#5a6448',
  sleeve: '#2c3136',
  comp: '#2a2e33',
  barrel: '#6b7279',
  dark: '#1b1f23',
  brass: '#c99a3e',
  orange: '#f07c1e',
  rear: '#7dff6a',
  front: '#ffb21a'
};
const BORE = 0.06;
const SIGHT_Y = 0.0872;
const MUZZLE = -0.142;
/** Grip panel side profile [z, y], inside the grip's edges. */
const GRIP_PANEL: [number, number][] = [[-0.006, 0.022], [0.033, 0.022], [0.051, -0.062], [0.018, -0.067], [0.005, -0.061], [-0.003, -0.022]];

/** Buzzer: stubby olive machine pistol on a charcoal frame, ported brass-trimmed compensator, folding foregrip and a long 20-round mag. */
export function buildBuzzer(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Frame: long dust cover under the compensator, trigger guard, stippled grip.
  b.add(slab([[-0.14, 0.0446], [0.044, 0.0446], [0.058, 0.035], [0.046, 0.026], [-0.06, 0.029], [-0.128, 0.029], [-0.14, 0.034]], 0.026, lod, [0.003, 0.004, 0.008, 0.004, 0.004, 0.006, 0.004], [], d >= 1 ? 0.0022 : 0), C.frame, 'satin');
  b.add(slab([[-0.08, 0.034], [-0.012, 0.034], [-0.013, -0.002], [-0.07, -0.004], [-0.081, 0.006]], 0.009, lod, [0.002, 0.004, 0.008, 0.004, 0.004], [[[-0.072, 0.032], [-0.02, 0.032], [-0.021, 0.005], [-0.066, 0.004], [-0.073, 0.01]]]), C.frame, 'satin');
  b.add(slab([[-0.045, 0.034], [-0.037, 0.034], [-0.038, 0.022], [-0.042, 0.013], [-0.049, 0.011], [-0.046, 0.021]], 0.006, lod, 0.002), C.orange, 'plastic');
  const grip: [number, number][] = [[-0.022, 0.032], [0.036, 0.032], [0.056, -0.068], [0.02, -0.075], [0.001, -0.068], [-0.01, -0.02]];
  b.add(slab(grip, 0.03, lod, [0.004, 0.012, 0.01, 0.008, 0.01, 0.012], [], d >= 1 ? 0.0025 : 0), C.frame, 'satin');
  if (d >= 1) {
    // Rubber grip panels stand proud of the frame, stippled along the rake of the grip.
    sidePanel(b, GRIP_PANEL, 0.03, shade(C.frame, 1.3));
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 4; row++) studSide(b, s, s * 0.0163, -0.05 + row * 0.019, 0.032 - row * 0.004, 2, 0.012, 0.0028, shade(C.frame, 0.75));
    }
    for (let i = 0; i < 3; i++) slot(b, 0, 0.0285, -0.098 - i * 0.012, 0.016, 0.0016, 0.006);
    b.add(box(0.004, 0.006, 0.006, 0.0012), C.dark, 'satin', T(-0.0145, 0.026, -0.008));
  }
  // Fire selector: orange lever on the left.
  if (b.minor) {
    b.add(tube(0.0042, 0.003, lod.segSmall), C.dark, 'satin', T(-0.0145, 0.038, 0.016, 0, Math.PI / 2));
    b.add(box(0.003, 0.004, 0.014, 0.001), C.orange, 'plastic', T(-0.0165, 0.038, 0.009, -0.5));
  }
  if (d >= 2) screw(b, -0.0133, 0.037, -0.05, 'x', 0.0022);

  // Folding foregrip, deployed, hinged under the dust cover.
  b.add(box(0.02, 0.008, 0.02, lod.bevel), C.dark, 'satin', T(0, 0.026, -0.102));
  b.add(slab([[-0.093, 0.026], [-0.111, 0.026], [-0.12, -0.03], [-0.113, -0.037], [-0.097, -0.037], [-0.091, -0.03]], 0.017, lod, [0.003, 0.003, 0.006, 0.004, 0.004, 0.006]), C.slide, 'satin');
  b.add(slab([[-0.096, -0.031], [-0.117, -0.031], [-0.115, -0.041], [-0.098, -0.041]], 0.019, lod, 0.003), C.orange, 'plastic');
  if (d >= 1) for (const s of [1, -1] as const) studSide(b, s, s * 0.0083, -0.008, -0.104, 2, 0.011, 0.0026, shade(C.slide, 1.2));
  if (b.minor) b.add(tube(0.0028, 0.022, lod.segSmall), C.brass, 'metal', T(0, 0.026, -0.098, 0, Math.PI / 2));

  // Barrel between the slide and the compensator.
  b.add(tube(0.0064, 0.02, lod.segSmall + 2, 0.0008), C.barrel, 'metal', T(0, BORE, -0.088));

  // Compensator: charcoal block with top ports, brass collar and face.
  const compSection: [number, number][] = [[-0.0125, 0.0446], [0.0125, 0.0446], [0.0125, 0.0715], [0.009, 0.0775], [-0.009, 0.0775], [-0.0125, 0.0715]];
  b.add(prism(compSection, 0.042, lod, [0.001, 0.001, 0.003, 0.002, 0.002, 0.003]), C.comp, 'satin', T(0, 0, -0.119));
  b.add(prism(compSection.map(([x, y]) => [x * 1.06, BORE + (y - BORE) * 1.08] as [number, number]), 0.005, lod, 0.002), C.brass, 'metal', T(0, 0, -0.098));
  b.add(prism(compSection.map(([x, y]) => [x * 1.04, BORE + (y - BORE) * 1.05] as [number, number]), 0.004, lod, 0.002), C.brass, 'metal', T(0, 0, MUZZLE + 0.002));
  b.add(tube(0.0052, 0.0016, lod.segSmall), '#0a0c0e', 'dark', T(0, BORE, MUZZLE - 0.0004));
  const ports = d >= 1 ? 3 : 2;
  for (let i = 0; i < ports; i++) {
    const z = -0.107 - i * (0.026 / Math.max(1, ports - 1));
    b.add(box(0.0096, 0.0016, 0.0062), '#0a0c0e', 'dark', T(0, 0.0776, z));
    if (b.minor) for (const s of [1, -1]) b.add(box(0.0016, 0.0062, 0.0062), '#0a0c0e', 'dark', T(s * 0.0126, 0.066, z));
  }

  // Stubby slide (animated): serrations, ejection port and glow sights.
  b.part('slide', new THREE.Vector3(0, BORE, 0));
  const slideSection: [number, number][] = [[-0.0135, 0.0445], [0.0135, 0.0445], [0.0135, 0.0735], [0.0095, 0.081], [-0.0095, 0.081], [-0.0135, 0.0735]];
  b.add(prism(slideSection, 0.122, lod, [0.001, 0.001, 0.003, 0.002, 0.002, 0.003]), C.slide, 'satin', T(0, 0, -0.02));
  slot(b, 0.0064, 0.0798, -0.026, 0.009, 0.0024, 0.03);
  b.add(box(0.008, 0.003, 0.026, 0.0008), C.brass, 'metal', T(0.0034, 0.0796, -0.026));
  const grooves = d >= 1 ? 6 : 3;
  for (const s of b.minor ? [1, -1] : []) {
    for (let i = 0; i < grooves; i++) b.add(box(0.0012, 0.024, 0.0022), shade(C.slide, 0.45), 'dark', T(s * 0.0136, 0.061, 0.016 + i * (0.022 / (grooves - 1)), 0.18));
  }
  if (d >= 1) for (const s of [1, -1]) b.add(box(0.0012, 0.004, 0.06), C.orange, 'plastic', T(s * 0.0136, 0.0485, -0.045));
  // Rear sight: two posts with green dots; front post with an orange dot.
  b.add(box(0.024, 0.0035, 0.012, 0.0008), C.dark, 'satin', T(0, 0.0825, 0.034));
  for (const s of [1, -1]) {
    b.add(box(0.0074, 0.0072, 0.01, 0.0008), C.dark, 'satin', T(s * 0.0059, SIGHT_Y - 0.0008, 0.034));
    if (b.minor) b.add(tube(0.0014, 0.0008, 8), C.rear, 'glow', T(s * 0.0059, SIGHT_Y - 0.001, 0.0394));
  }
  b.add(box(0.0036, 0.0072, 0.0065, 0.0006), C.dark, 'satin', T(0, SIGHT_Y - 0.0034, -0.074));
  b.add(tube(0.0013, 0.0008, 8), C.front, 'glow', T(0, SIGHT_Y - 0.0014, -0.0704));
  b.node('slideRear', 0, 0.071, 0.034);

  // Extended magazine (animated): ribbed sleeve out of the grip, orange base plate with a charcoal stripe.
  b.part('magazine', new THREE.Vector3(0, -0.07, 0.03));
  b.add(slab([[-0.007, 0.028], [0.028, 0.028], [0.046, -0.068], [0.008, -0.07]], 0.022, lod, 0.003), C.dark, 'satin');
  const sleeve: [number, number][] = [[0.004, -0.066], [0.053, -0.066], [0.064, -0.124], [0.016, -0.128]];
  b.add(slab(sleeve, 0.027, lod, [0.002, 0.002, 0.005, 0.005]), C.sleeve, 'satin');
  if (d >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) b.add(box(0.0012, 0.0022, 0.03), shade(C.sleeve, 0.6), 'dark', T(s * 0.0136, -0.08 - i * 0.011, 0.036 + i * 0.002, -0.19));
      if (b.minor) for (let i = 0; i < 3; i++) b.add(tube(0.0016, 0.0008, 8), C.brass, 'metal', T(s * 0.0137, -0.083 - i * 0.012, 0.052 + i * 0.002, 0, Math.PI / 2));
    }
  }
  b.add(slab([[0.012, -0.124], [0.068, -0.12], [0.07, -0.13], [0.012, -0.135]], 0.031, lod, 0.003), C.orange, 'plastic');
  if (d >= 1) b.add(box(0.0316, 0.0024, 0.03), C.dark, 'satin', T(0, -0.128, 0.041, -0.08));
  b.node('magHold', 0, -0.135, 0.042);

  b.part('body');
  b.node('muzzle', 0, BORE, MUZZLE);
  b.node('eject', 0.012, 0.08, -0.026);
  b.node('support', 0, 0, -0.105);
  b.node('sight', 0, SIGHT_Y, 0.034);
  b.node('grip', 0, 0, 0, -0.2);
}

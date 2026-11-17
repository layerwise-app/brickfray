import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { box, prism, slab, tube } from '../shapes';
import { screw, shade, slot, studSide } from './details';

const C = {
  frame: '#2f363d',
  slide: '#b9bec4',
  barrel: '#6b7279',
  dark: '#1d2328',
  accent: '#f58a1f',
  rear: '#7dff6a',
  front: '#ffb21a'
};
const BORE = 0.062;
const SIGHT_Y = 0.089;

/** Peg Pistol: silver slide with serrations and glow sights on a stippled polymer frame. */
export function buildPistol(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Frame with dust-cover rail, trigger guard and a raked, stud-stippled grip.
  b.add(slab([[-0.122, 0.0446], [0.044, 0.0446], [0.058, 0.035], [0.046, 0.026], [-0.06, 0.03], [-0.122, 0.031]], 0.026, lod, [0.003, 0.004, 0.008, 0.004, 0.004, 0.003]), C.frame, 'satin');
  b.add(slab([[-0.078, 0.034], [-0.012, 0.034], [-0.013, -0.002], [-0.066, -0.004], [-0.079, 0.008]], 0.009, lod, [0.002, 0.004, 0.008, 0.006, 0.006], [[[-0.07, 0.032], [-0.02, 0.032], [-0.021, 0.005], [-0.064, 0.004], [-0.071, 0.012]]]), C.frame, 'satin');
  b.add(slab([[-0.045, 0.034], [-0.037, 0.034], [-0.038, 0.022], [-0.042, 0.013], [-0.049, 0.011], [-0.046, 0.021]], 0.006, lod, 0.002), C.accent, 'plastic');
  const grip: [number, number][] = [[-0.022, 0.032], [0.036, 0.032], [0.056, -0.068], [0.02, -0.075], [0.001, -0.068], [-0.01, -0.02]];
  b.add(slab(grip, 0.03, lod, [0.004, 0.012, 0.01, 0.008, 0.01, 0.012]), C.frame, 'satin');
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 4; row++) studSide(b, s, s * 0.0148, -0.05 + row * 0.019, 0.026 + row * 0.0035, 2, 0.012, 0.0028, shade(C.frame, 1.25));
    }
    for (let i = 0; i < 4; i++) b.add(box(0.016, 0.003, 0.0045, 0.0006), shade(C.frame, 1.2), 'satin', T(0, 0.0285, -0.112 + i * 0.009));
    b.add(box(0.004, 0.005, 0.012, 0.0012), C.accent, 'plastic', T(-0.0145, 0.04, -0.012));
    b.add(box(0.004, 0.006, 0.006, 0.0012), C.dark, 'satin', T(-0.0145, 0.026, -0.008));
  }
  if (d >= 2) screw(b, -0.0133, 0.037, -0.05, 'x', 0.0022);

  // Barrel crown peeking out of the slide.
  b.add(tube(0.0064, 0.012, lod.segSmall + 2, 0.0008), C.barrel, 'metal', T(0, BORE, -0.127));
  b.add(tube(0.0046, 0.0014, lod.segSmall), '#0a0c0e', 'dark', T(0, BORE, -0.1334));

  // Slide (animated): tapered top, serrations, ejection port and glow sights.
  b.part('slide', new THREE.Vector3(0, BORE, 0));
  const slideSection: [number, number][] = [[-0.013, 0.0445], [0.013, 0.0445], [0.013, 0.074], [0.0085, 0.082], [-0.0085, 0.082], [-0.013, 0.074]];
  b.add(prism(slideSection, 0.176, lod, [0.001, 0.001, 0.003, 0.002, 0.002, 0.003]), C.slide, 'metal', T(0, 0, -0.04));
  slot(b, 0.0062, 0.081, -0.024, 0.009, 0.0024, 0.034);
  b.add(box(0.008, 0.003, 0.03, 0.0008), C.barrel, 'metal', T(0.003, 0.0808, -0.024));
  const grooves = d >= 1 ? 7 : 3;
  for (const s of b.minor ? [1, -1] : []) {
    for (let i = 0; i < grooves; i++) b.add(box(0.0012, 0.026, 0.0022), shade(C.slide, 0.42), 'dark', T(s * 0.0131, 0.061, 0.014 + i * (0.028 / (grooves - 1)), 0.18));
    if (d >= 2) for (let i = 0; i < 4; i++) b.add(box(0.0012, 0.02, 0.002), shade(C.slide, 0.42), 'dark', T(s * 0.0131, 0.064, -0.112 + i * 0.006, 0.18));
  }
  // Rear sight: two posts with green dots, a notch between them.
  b.add(box(0.024, 0.0035, 0.014, 0.0008), C.dark, 'satin', T(0, 0.0835, 0.037));
  for (const s of [1, -1]) {
    b.add(box(0.0074, 0.0072, 0.012, 0.0008), C.dark, 'satin', T(s * 0.0059, 0.0854, 0.037));
    if (b.minor) b.add(tube(0.0014, 0.0008, 8), C.rear, 'glow', T(s * 0.0059, 0.0852, 0.0432));
  }
  // Front post with an orange dot.
  b.add(box(0.0036, 0.0072, 0.0065, 0.0006), C.dark, 'satin', T(0, 0.0854, -0.114));
  b.add(tube(0.0013, 0.0008, 8), C.front, 'glow', T(0, 0.0856, -0.1104));
  b.node('slideRear', 0, 0.073, 0.03);

  // Magazine (animated): body hidden in the grip, extended base plate.
  b.part('magazine', new THREE.Vector3(0, -0.07, 0.028));
  b.add(slab([[-0.007, 0.028], [0.028, 0.028], [0.046, -0.068], [0.008, -0.07]], 0.022, lod, 0.003), C.dark, 'satin');
  b.add(box(0.032, 0.008, 0.05, lod.bevel), C.accent, 'plastic', T(0, -0.0755, 0.028, -0.18));
  b.node('magHold', 0, -0.085, 0.028);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.135);
  b.node('eject', 0.012, 0.081, -0.024);
  b.node('support', 0, -0.006, -0.006);
  b.node('sight', 0, SIGHT_Y, 0.037);
  b.node('grip', 0, 0, 0, -0.2);
}

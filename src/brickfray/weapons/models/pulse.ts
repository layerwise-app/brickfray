import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { ball, box, latheZ, pipe, prism, rounder, slab, torus, tube } from '../shapes';
import { screw, shade, slot, studGrid, studSide } from './details';

const C = {
  shell: '#eef0f4',
  lower: '#d4d8df',
  guard: '#5b6273',
  purple: '#7b4fd6',
  graphite: '#2e323d',
  dark: '#1b1f27',
  cell: '#2d2a45',
  core: '#4a5160',
  lens: '#b8d4ff',
  gold: '#e0a83a',
  energy: '#3fd9ff',
  reticle: '#ff4fc8',
  lights: ['#58f0a0', '#ff5ab0', '#5ab8ff']
};
const BORE = 0.108;
const SIGHT_Y = 0.178;
const SIGHT_Z = -0.1022;
/** Where a shot sets the hot cell off from, relative to its rest at the coil pack: the back of the capacitor strips. */
export const SPARK_RUN = [0, 0, 0.126] as const;

/** Pulse Carbine: white shell over a gunmetal shroud, capacitor strips, coil emitter, holo ring sight and a boxy energy cell. */
export function buildPulse(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Upper receiver (white) over the off-white lower with its flared cell well.
  b.add(slab([[0.088, 0.094], [0.088, 0.128], [0.074, 0.141], [-0.176, 0.141], [-0.176, 0.094]], 0.036, lod, [0.004, 0.006, 0.006, 0.006, 0.004]), C.shell, 'plastic');
  b.add(
    slab([[0.08, 0.096], [-0.17, 0.096], [-0.17, 0.07], [-0.162, 0.03], [-0.074, 0.03], [-0.068, 0.05], [0.07, 0.05], [0.08, 0.066]], 0.034, lod, [0.003, 0.003, 0.006, 0.004, 0.004, 0.004, 0.01, 0.006]),
    C.lower,
    'plastic'
  );
  for (const s of [1, -1] as const) {
    b.add(box(0.0016, 0.005, 0.252), C.purple, 'plastic', T(s * 0.0183, 0.0955, -0.044));
    b.add(box(0.0016, 0.028, 0.068, lod.bevel * 0.5), C.purple, 'plastic', T(s * 0.0174, 0.057, -0.118));
  }
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      // Status display: Nova's three pack lights on a dark strip.
      b.add(box(0.0016, 0.013, 0.04, 0.0005), C.dark, 'dark', T(s * 0.0185, 0.119, 0.044));
      C.lights.forEach((c, i) => b.add(ball(0.0023, lod.segSmall), c, 'glow', T(s * 0.0193, 0.119, 0.032 + i * 0.012)));
      for (let i = 0; i < 3; i++) slot(b, s * 0.0175, 0.068 + i * 0.008, 0.035, 0.0014, 0.0028, 0.04, shade(C.lower, 0.55));
    }
    // Heat vent where a rifle's ejection port would be.
    slot(b, 0.0184, 0.118, -0.045, 0.0016, 0.017, 0.046);
    for (let i = 0; i < 3; i++) b.add(box(0.002, 0.0026, 0.044, 0.0004), C.graphite, 'satin', T(0.0188, 0.1125 + i * 0.0055, -0.045));
  }
  if (b.minor) {
    b.add(box(0.004, 0.006, 0.016, 0.001), C.purple, 'plastic', T(-0.0178, 0.077, 0.024, 0.4));
    b.add(tube(0.0042, 0.004, lod.segSmall), C.purple, 'plastic', T(0.0178, 0.076, -0.066, 0, Math.PI / 2));
  }
  if (d >= 2) {
    for (const s of [1, -1]) for (const z of [0.062, -0.16]) screw(b, s * 0.0182, 0.083, z, 'x', 0.0024);
    for (const s of [1, -1]) screw(b, s * 0.0181, 0.131, -0.16, 'x', 0.0022);
  }

  // Trigger guard, trigger blade and a graphite grip with purple stud panels.
  b.add(slab([[-0.08, 0.052], [-0.012, 0.052], [-0.014, 0.014], [-0.08, 0.017]], 0.009, lod, 0.006, [[[-0.073, 0.05], [-0.021, 0.05], [-0.022, 0.022], [-0.073, 0.024]]]), C.graphite, 'satin');
  b.add(slab([[-0.049, 0.052], [-0.04, 0.052], [-0.041, 0.038], [-0.045, 0.027], [-0.052, 0.025], [-0.049, 0.037]], 0.0055, lod, 0.002), C.purple, 'plastic');
  const grip: [number, number][] = [[-0.022, 0.052], [0.03, 0.052], [0.052, -0.058], [0.018, -0.064], [0.006, -0.058], [-0.004, -0.024], [-0.013, 0.006]];
  b.add(slab(grip, 0.03, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.graphite, 'satin');
  b.add(box(0.032, 0.006, 0.038, lod.bevel), C.purple, 'plastic', T(0, -0.0605, 0.031, -0.12));
  if (d >= 1) {
    for (const s of [1, -1]) b.add(box(0.0014, 0.06, 0.018, 0.0005), C.purple, 'plastic', T(s * 0.0151, -0.008, 0.018, -0.28));
  }
  if (d >= 2) {
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 3; row++) studSide(b, s, s * 0.0158, -0.03 + row * 0.019, 0.012 + row * 0.0055, 1, 0.011, 0.0026, shade(C.purple, 1.15));
    }
  }

  // Barrel shroud: chamfered gunmetal block, studded top, capacitor strips and a purple fore-grip.
  const shroud: [number, number][] = [[-0.021, 0.08], [0.021, 0.08], [0.0235, 0.1], [0.0235, 0.124], [0.0165, 0.137], [-0.0165, 0.137], [-0.0235, 0.124], [-0.0235, 0.1]];
  b.add(prism(shroud, 0.226, lod, [0.006, 0.006, 0.002, 0.004, 0.004, 0.004, 0.002, 0.006]), C.guard, 'satin', T(0, 0, -0.283));
  b.add(prism([[-0.017, 0.073], [0.017, 0.073], [0.0195, 0.084], [-0.0195, 0.084]], 0.15, lod, 0.004), C.purple, 'plastic', T(0, 0, -0.29));
  if (b.minor) studGrid(b, 0, 0.137, -0.29, 2, d >= 1 ? 7 : 4, d >= 1 ? 0.0165 : 0.033, d >= 1 ? 0.0056 : 0.0064, C.guard);
  for (const s of [1, -1] as const) {
    b.add(box(0.002, 0.013, 0.17, 0.0005), C.dark, 'dark', T(s * 0.0236, 0.111, -0.286));
    if (d >= 1) for (let i = 0; i < 7; i++) b.add(box(0.0016, 0.0074, 0.017), C.energy, 'glow', T(s * 0.0242, 0.111, -0.223 - i * 0.021));
    else b.add(box(0.0016, 0.0064, 0.156), C.energy, 'glow', T(s * 0.0242, 0.111, -0.286));
  }
  if (d >= 1) {
    for (let i = 0; i < 7; i++) b.add(box(0.036, 0.0034, 0.005, 0.0008), shade(C.purple, 0.78), 'plastic', T(0, 0.0727, -0.236 - i * 0.018));
    for (const s of [1, -1]) b.add(box(0.0016, 0.0035, 0.226), shade(C.guard, 0.6), 'dark', T(s * 0.0236, 0.0955, -0.283));
  }
  if (d >= 2) for (const s of [1, -1]) for (const z of [-0.18, -0.387]) screw(b, s * 0.0238, 0.0905, z, 'x', 0.0022);

  // Stubby raked hand stop under the fore-grip rail: the support hand's vertical grip.
  b.add(slab([[-0.316, 0.075], [-0.274, 0.075], [-0.248, 0.008], [-0.255, 0.0], [-0.277, 0.0], [-0.287, 0.008]], 0.027, lod, [0.003, 0.003, 0.008, 0.006, 0.006, 0.008]), C.graphite, 'satin');
  b.add(slab([[-0.29, 0.012], [-0.246, 0.012], [-0.244, 0.002], [-0.252, -0.006], [-0.279, -0.006], [-0.289, 0.002]], 0.0295, lod, 0.004), C.purple, 'plastic');
  if (d >= 1) for (const s of [1, -1] as const) for (let i = 0; i < 3; i++) b.add(box(0.0014, 0.0032, 0.022, 0.0005), shade(C.graphite, 1.5), 'satin', T(s * 0.0138, 0.026 + i * 0.013, -0.2735 - i * 0.0052, -0.38));

  // Coil accelerator: glowing core wrapped in purple rings under a white top spine.
  b.add(tube(0.0085, 0.13, lod.seg), C.core, 'metal', T(0, BORE, -0.455));
  b.add(tube(0.0128, 0.07, lod.seg), C.energy, 'glow', T(0, BORE, -0.432));
  b.add(box(0.014, 0.011, 0.09, lod.bevel), C.shell, 'plastic', T(0, 0.1305, -0.437));
  if (d >= 1) b.add(box(0.008, 0.0016, 0.07), C.purple, 'plastic', T(0, 0.1366, -0.437));
  // Coil pack (animated, recoils along the core on every shot).
  b.part('slide', new THREE.Vector3(0, BORE, -0.4315));
  const ring = latheZ([[0.0126, -0.0055], [0.0171, -0.0055], [0.0178, -0.0048], [0.0178, 0.0048], [0.0171, 0.0055], [0.0126, 0.0055]], lod.seg);
  for (const z of [-0.405, -0.4315, -0.458]) b.add(ring, C.purple, 'satin', T(0, BORE, z));
  if (d >= 1) for (const z of [-0.405, -0.4315, -0.458]) b.add(torus(0.0181, 0.0012, lod.seg), shade(C.purple, 0.7), 'satin', T(0, BORE, z));
  // The hot cell (animated): a shot sets it at the back of each capacitor strip and it runs forward into the coil pack.
  b.part('spark', new THREE.Vector3(0, 0.111, -0.349));
  if (!lod.third) for (const s of [1, -1]) b.add(box(0.0018, 0.0082, 0.018, 0.0004), '#f4fdff', 'glow', T(s * 0.0246, 0.111, -0.349));
  b.part('body');

  // Emitter: flared white muzzle ring around a glowing bore.
  b.add(
    latheZ(
      [
        [0, -0.014],
        [0.0108, -0.014],
        [0.0118, -0.026],
        [0.0188, -0.026],
        [0.0205, -0.021],
        [0.0205, -0.008],
        [0.0172, 0.002],
        [0.0172, 0.021],
        [0.0158, 0.026],
        [0, 0.026]
      ],
      lod.seg
    ),
    C.shell,
    'plastic',
    T(0, BORE, -0.49)
  );
  b.add(tube(0.0104, 0.0012, lod.seg), C.energy, 'glow', T(0, BORE, -0.5042));
  if (b.minor) b.add(tube(0.0178, 0.006, lod.seg, d >= 1 ? 0.0012 : 0), C.purple, 'plastic', T(0, BORE, -0.475));
  if (d >= 1) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      b.add(box(0.0012, 0.0042, 0.009), C.dark, 'dark', T(Math.cos(a) * 0.0203, BORE + Math.sin(a) * 0.0203, -0.4955, 0, 0, a));
    }
  }

  // Compact stock with a thumbhole cut-out and purple butt pad.
  const stock: [number, number][] = [[0.07, 0.13], [0.256, 0.134], [0.268, 0.124], [0.268, 0.03], [0.256, 0.02], [0.222, 0.024], [0.122, 0.066], [0.078, 0.07], [0.07, 0.08]];
  const hole: [number, number][] = [[0.108, 0.113], [0.236, 0.116], [0.236, 0.046], [0.214, 0.044], [0.13, 0.08]];
  b.add(slab(stock, 0.04, lod, [0.006, 0.01, 0.008, 0.008, 0.01, 0.03, 0.02, 0.008, 0.006], [hole]), C.shell, 'plastic');
  b.add(slab([[0.266, 0.138], [0.281, 0.138], [0.281, 0.016], [0.266, 0.016]], 0.044, lod, 0.004), C.purple, 'rubber');
  if (d >= 1) {
    b.add(slab([[0.1, 0.1325], [0.236, 0.1365], [0.236, 0.142], [0.11, 0.139]], 0.03, lod, 0.003), C.purple, 'plastic');
    for (const s of [1, -1] as const) studSide(b, s, s * 0.02, 0.031, 0.247, 2, 0.014, 0.0048, C.shell);
  }
  if (d >= 2) for (let i = 0; i < 6; i++) b.add(box(0.045, 0.003, 0.0026, 0.0006), shade(C.purple, 1.25), 'rubber', T(0, 0.028 + i * 0.019, 0.2812));

  // Ring sight: graphite projector housing, purple hoop with a glass window, glowing ring reticle and dot.
  b.add(box(0.022, 0.006, 0.054, lod.bevel), C.graphite, 'satin', T(0, 0.144, -0.082));
  b.add(box(0.027, 0.012, 0.048, lod.bevel), C.graphite, 'satin', T(0, 0.153, -0.08));
  b.add(box(0.012, 0.006, 0.012, lod.bevel * 0.5), C.graphite, 'satin', T(0, 0.157, -0.097));
  // The hoop frames the target at ADS: rounder than the rest of the gun, so it never shows its facets.
  const hoop = lod.third ? lod.seg : Math.max(24, lod.seg * 2);
  rounder(hoop, () => {
    b.add(b.minor ? pipe(0.0205, 0.0172, 0.012, hoop) : tube(0.0205, 0.012, hoop), C.purple, 'plastic', T(0, SIGHT_Y, -0.098));
    b.glass(tube(0.0172, 0.0012, hoop), C.lens, T(0, SIGHT_Y, SIGHT_Z - 0.0012));
    if (b.minor) {
      b.add(torus(0.0042, 0.00042, 24), C.reticle, 'glow', T(0, SIGHT_Y, SIGHT_Z));
      b.add(tube(0.00075, 0.0006, 10), C.reticle, 'glow', T(0, SIGHT_Y, SIGHT_Z));
    }
  });
  if (b.minor) {
    b.add(box(0.014, 0.005, 0.014, lod.bevel * 0.5), C.graphite, 'satin', T(0, 0.1595, -0.066));
  }
  if (d >= 1) {
    b.add(pipe(0.0212, 0.0198, 0.003, lod.seg), C.gold, 'metal', T(0, SIGHT_Y, -0.1048));
    for (const s of [1, -1]) b.add(box(0.0012, 0.0006, 0.0006), C.reticle, 'glow', T(s * 0.0058, SIGHT_Y, SIGHT_Z));
    b.add(box(0.0006, 0.0012, 0.0006), C.reticle, 'glow', T(0, SIGHT_Y - 0.0058, SIGHT_Z));
    b.add(tube(0.0016, 0.0012, 10), C.reticle, 'glow', T(0, 0.1595, -0.0732));
    for (const z of [-0.07, -0.083]) b.add(box(0.003, 0.005, 0.008, 0.001), C.purple, 'plastic', T(0.0148, 0.153, z));
  }
  if (d >= 2) {
    for (const z of [-0.064, -0.096]) screw(b, -0.0137, 0.153, z, 'x', 0.002);
    b.add(box(0.014, 0.0012, 0.03), shade(C.graphite, 1.6), 'satin', T(0, 0.1593, -0.075));
  }

  // Priming handle (animated): slider and purple T-bar on the rear of the receiver.
  slot(b, 0, 0.1414, 0.04, 0.0056, 0.0012, 0.08, shade(C.shell, 0.5));
  b.part('bolt', new THREE.Vector3(0, 0.1445, 0.072));
  b.add(box(0.012, 0.0075, 0.03, 0.0015), C.graphite, 'satin', T(0, 0.1445, 0.058));
  b.add(box(0.044, 0.0085, 0.011, 0.002), C.purple, 'plastic', T(0, 0.145, 0.074));
  for (const s of [1, -1]) b.add(box(0.008, 0.0095, 0.012, 0.002), C.shell, 'plastic', T(s * 0.023, 0.145, 0.074));
  b.node('charge', 0, 0.145, 0.08);

  // Energy cell (animated): straight box, purple base cap, glowing charge gauge.
  b.part('magazine', new THREE.Vector3(0, 0.05, -0.118));
  b.add(slab([[-0.084, 0.07], [-0.152, 0.07], [-0.152, -0.036], [-0.084, -0.036]], 0.025, lod, 0.004), C.cell, 'satin');
  b.add(slab([[-0.079, -0.034], [-0.157, -0.034], [-0.157, -0.05], [-0.079, -0.05]], 0.03, lod, 0.004), C.purple, 'plastic');
  b.add(box(0.027, 0.004, 0.07, lod.bevel * 0.5), C.lower, 'plastic', T(0, 0.024, -0.118));
  for (const s of [1, -1] as const) {
    b.add(box(0.0016, 0.05, 0.02, 0.0005), C.dark, 'dark', T(s * 0.0126, -0.006, -0.118));
    if (d >= 1) for (let i = 0; i < 4; i++) b.add(box(0.0014, 0.0085, 0.014), C.energy, 'glow', T(s * 0.0132, -0.0245 + i * 0.0122, -0.118));
    else b.add(box(0.0014, 0.042, 0.012), C.energy, 'glow', T(s * 0.0132, -0.006, -0.118));
  }
  if (d >= 1) for (let i = 0; i < 4; i++) b.add(box(0.02, 0.003, 0.0026, 0.0006), shade(C.cell, 1.6), 'satin', T(0, -0.026 + i * 0.012, -0.1528));
  b.node('magHold', 0, -0.012, -0.12);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.516);
  b.node('eject', 0.02, 0.118, -0.045);
  b.node('support', 0, BORE, -0.288);
  b.node('sight', 0, SIGHT_Y, SIGHT_Z);
  b.node('grip', 0, 0, 0, -0.28);
}


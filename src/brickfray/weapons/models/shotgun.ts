import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { ball, box, gear, latheZ, pipe, prism, slab, torus, tube } from '../shapes';
import { screw, shade, slot, studSide } from './details';

const C = {
  receiver: '#31373e',
  wood: '#b65a2c',
  barrel: '#4a5056',
  dark: '#20262c',
  accent: '#f6c624',
  hull: '#d3302a',
  hull2: '#2f6fd0',
  brass: '#d4a443',
  bead: '#ffcf4a'
};
const BORE = 0.104;
const TUBE_Y = 0.073;
const SIGHT_Y = 0.142;

/** Snapgun: chunky pump shotgun with a ribbed toy-wood forend and a side shell carrier. */
export function buildShotgun(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Receiver block with a sloped rear and the loading port underneath.
  b.add(slab([[0.062, 0.122], [0.03, 0.128], [-0.165, 0.128], [-0.165, 0.046], [0.062, 0.046]], 0.04, lod, [0.012, 0.004, 0.006, 0.006, 0.006]), C.receiver, 'satin');
  slot(b, 0.0198, 0.106, -0.085, 0.0016, 0.02, 0.06);
  slot(b, 0, 0.0452, -0.095, 0.026, 0.0016, 0.07);
  if (d >= 1) {
    b.add(box(0.0016, 0.004, 0.2, 0.0006), shade(C.receiver, 0.55), 'dark', T(-0.0201, 0.068, -0.05));
    b.add(box(0.004, 0.006, 0.018, 0.0012), C.accent, 'plastic', T(-0.02, 0.06, -0.02));
    b.add(tube(0.004, 0.044, lod.segSmall, 0.001), C.barrel, 'metal', T(0, 0.062, -0.03, 0, Math.PI / 2));
  }
  if (d >= 1) {
    b.add(box(0.0016, 0.034, 0.1, 0.0006), shade(C.receiver, 1.45), 'satin', T(0.0204, 0.075, -0.04));
    b.add(box(0.0012, 0.0024, 0.226), '#15191d', 'dark', T(-0.0202, 0.112, -0.05));
    b.add(box(0.0012, 0.0024, 0.226), '#15191d', 'dark', T(0.0202, 0.122, -0.05));
  }
  if (d >= 2) for (const s of [1, -1]) for (const z of [0.035, -0.145]) screw(b, s * 0.0202, 0.085, z, 'x', 0.0026);
  // Ghost-ring rear sight on the receiver; the eye looks through it at the bead.
  b.add(box(0.02, 0.006, 0.022, lod.bevel), C.dark, 'satin', T(0, 0.131, 0.02));
  if (b.minor) {
    for (const s of [1, -1]) b.add(box(0.0045, 0.014, 0.01, lod.bevel * 0.5), C.dark, 'satin', T(s * 0.0098, 0.139, 0.02));
    b.add(torus(0.0068, 0.0019, lod.segSmall + 6), C.dark, 'satin', T(0, SIGHT_Y, 0.02));
  }

  // Trigger guard, trigger and pistol grip.
  b.add(slab([[-0.075, 0.048], [-0.008, 0.048], [-0.01, 0.012], [-0.075, 0.015]], 0.0095, lod, 0.006, [[[-0.068, 0.046], [-0.017, 0.046], [-0.018, 0.02], [-0.068, 0.022]]]), C.receiver, 'satin');
  b.add(slab([[-0.046, 0.048], [-0.037, 0.048], [-0.038, 0.035], [-0.042, 0.025], [-0.049, 0.023], [-0.046, 0.034]], 0.0055, lod, 0.002), C.accent, 'plastic');
  const grip: [number, number][] = [[-0.022, 0.05], [0.032, 0.05], [0.054, -0.058], [0.02, -0.065], [0.007, -0.058], [-0.003, -0.024], [-0.013, 0.006]];
  b.add(slab(grip, 0.032, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.wood, 'plastic');
  if (d >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) b.add(box(0.0012, 0.0022, 0.03), shade(C.wood, 0.6), 'dark', T(s * 0.0163, -0.04 + i * 0.02, 0.022 + i * 0.006, -0.28));
    }
  }

  // Fixed stock with a rubber pad.
  const stock: [number, number][] = [[0.055, 0.124], [0.312, 0.118], [0.327, 0.106], [0.327, -0.002], [0.307, -0.013], [0.2, 0.03], [0.12, 0.058], [0.055, 0.064]];
  b.add(slab(stock, 0.042, lod, [0.01, 0.01, 0.01, 0.01, 0.02, 0.03, 0.02, 0.01]), C.wood, 'plastic');
  b.add(slab([[0.325, 0.122], [0.342, 0.122], [0.342, -0.016], [0.325, -0.016]], 0.045, lod, 0.004), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1] as const) studSide(b, s, s * 0.021, 0.075, 0.2, 3, 0.022, 0.0058, C.wood);
    b.add(box(0.0014, 0.05, 0.11, 0.0006), shade(C.wood, 0.7), 'dark', T(-0.0212, 0.07, 0.22, 0.2));
  }
  if (d >= 2) for (let i = 0; i < 6; i++) b.add(box(0.047, 0.003, 0.0026, 0.0006), shade(C.dark, 1.4), 'rubber', T(0, 0.0 + i * 0.022, 0.3425));

  // Barrel with a vent rib, bead sight, tube magazine and barrel clamp.
  b.add(pipe(0.0118, 0.0088, 0.52, lod.seg), C.barrel, 'metal', T(0, BORE, -0.425));
  b.add(tube(0.0115, 0.47, lod.seg, 0.0015), C.barrel, 'metal', T(0, TUBE_Y, -0.4));
  b.add(b.minor ? latheZ([[0, -0.009], [0.0108, -0.009], [0.0124, -0.007], [0.0124, 0.007], [0.0108, 0.009], [0, 0.009]], lod.seg) : tube(0.0124, 0.018, lod.seg), C.accent, 'plastic', T(0, TUBE_Y, -0.638));
  if (d >= 1) b.add(gear(0.0118, 0.0128, 14, 0.012), C.accent, 'plastic', T(0, TUBE_Y, -0.638));
  b.add(prism([[-0.014, 0.06], [0.014, 0.06], [0.014, 0.116], [-0.014, 0.116]], 0.016, lod, 0.004), C.receiver, 'satin', T(0, 0, -0.598));
  b.add(box(0.008, 0.0035, 0.5, lod.bevel * 0.5), C.dark, 'satin', T(0, 0.1235, -0.415));
  if (d >= 1) {
    for (let i = 0; i < 9; i++) b.add(box(0.005, 0.0055, 0.008), C.dark, 'satin', T(0, 0.119, -0.2 - i * 0.055));
  }
  b.add(box(0.0032, 0.014, 0.007, lod.bevel * 0.4), C.dark, 'satin', T(0, 0.132, -0.66));
  b.add(ball(0.0028, 10), C.bead, 'glow', T(0, SIGHT_Y - 0.0028, -0.66));

  // Side shell carrier on the left of the receiver.
  b.add(box(0.006, 0.046, 0.074, lod.bevel), C.dark, 'satin', T(-0.023, 0.088, -0.09));
  const shells = d >= 1 ? 4 : b.minor ? 3 : 2;
  for (let i = 0; i < shells; i++) {
    const z = -0.06 - i * (0.064 / Math.max(1, shells - 1));
    const hull = i % 2 === 0 ? C.hull : C.hull2;
    b.add(tube(0.0098, 0.044, lod.segSmall, 0.0015), hull, 'plastic', T(-0.0355, 0.088, z, Math.PI / 2));
    b.add(tube(0.0102, 0.012, lod.segSmall, 0.001), C.brass, 'metal', T(-0.0355, 0.116, z, Math.PI / 2));
    if (d >= 2) b.add(tube(0.0028, 0.002, 8), shade(C.brass, 0.7), 'metal', T(-0.0355, 0.1225, z, Math.PI / 2));
  }
  if (d >= 1) b.add(box(0.004, 0.008, 0.08, 0.001), C.receiver, 'satin', T(-0.0255, 0.066, -0.09));

  // Ribbed pump forend (animated) with its action bars.
  b.part('pump', new THREE.Vector3(0, TUBE_Y, -0.335));
  const pumpLen = 0.17;
  b.add(prism([[-0.024, 0.048], [0.024, 0.048], [0.026, 0.09], [-0.026, 0.09]], pumpLen, lod, 0.011), C.wood, 'plastic', T(0, 0, -0.335));
  const ribs = d >= 1 ? 8 : b.minor ? 4 : 2;
  for (let i = 0; i < ribs; i++) {
    const z = -0.335 + (i - (ribs - 1) / 2) * (pumpLen * 0.82 / (ribs - 1));
    b.add(prism([[-0.0262, 0.045], [0.0262, 0.045], [0.0282, 0.084], [-0.0282, 0.084]], 0.006, lod, 0.004), shade(C.wood, 0.86), 'plastic', T(0, 0, z));
  }
  if (d >= 1) {
    for (const s of [1, -1]) b.add(box(0.0025, 0.005, 0.15, 0.0006), C.barrel, 'metal', T(s * 0.0135, 0.066, -0.2));
  }
  b.node('support', 0, TUBE_Y, -0.34);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.69);
  b.node('eject', 0.021, 0.106, -0.085);
  b.node('port', 0, 0.044, -0.095);
  b.node('sight', 0, SIGHT_Y, -0.66);
  b.node('grip', 0, 0, 0, -0.28);
}

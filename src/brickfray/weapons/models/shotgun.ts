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
const RING_Z = -0.06;
/** Ejection port on the right of the receiver, and the raised frame round it ([z, y] side profiles). */
const PORT: [number, number][] = [[-0.058, 0.1165], [-0.112, 0.1165], [-0.112, 0.0955], [-0.058, 0.0955]];
const PORT_FRAME: [number, number][] = [[-0.048, 0.1225], [-0.122, 0.1225], [-0.122, 0.0895], [-0.048, 0.0895]];

/** The side carrier's shells: their column, and the turn of each slot about the shell's own axis (how a hand meets it). */
const SADDLE_X = -0.0355;
const SADDLE_SPIN = 0;
const saddleZ = (i: number, n: number) => -0.06 - i * (0.064 / Math.max(1, n - 1));

/** Snapgun: chunky pump shotgun with a ribbed toy-wood forend and a side shell carrier. */
export function buildShotgun(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Receiver block with a sloped rear and the loading port underneath; a raised frame stands round the ejection port, open onto the bolt.
  b.add(slab([[0.062, 0.122], [0.03, 0.128], [-0.165, 0.128], [-0.165, 0.046], [0.062, 0.046]], 0.04, lod, [0.012, 0.004, 0.006, 0.006, 0.006], [], d >= 1 ? 0.004 : 0), C.receiver, 'satin');
  b.add(slab(PORT_FRAME, 0.005, lod, 0.004, [PORT], d >= 1 ? 0.0012 : 0), shade(C.receiver, 1.18), 'metal', T(0.0222, 0, 0));
  slot(b, 0, 0.0452, -0.117, 0.026, 0.0016, 0.062);
  if (d >= 1) {
    b.add(box(0.0016, 0.004, 0.2, 0.0006), shade(C.receiver, 0.55), 'dark', T(-0.0201, 0.068, -0.05));
    b.add(box(0.004, 0.006, 0.018, 0.0012), C.accent, 'plastic', T(-0.02, 0.06, -0.02));
    b.add(tube(0.004, 0.044, lod.segSmall, 0.001), C.barrel, 'metal', T(0, 0.062, -0.03, 0, Math.PI / 2));
  }
  if (d >= 1) {
    b.add(slab([[0.01, 0.0915], [-0.09, 0.0915], [-0.09, 0.0625], [0.01, 0.0625]], 0.004, lod, 0.004, [], 0.0012), shade(C.receiver, 1.3), 'satin', T(0.0215, 0, 0));
    b.add(box(0.0012, 0.0024, 0.226), '#15191d', 'dark', T(-0.0202, 0.112, -0.05));
    b.add(box(0.0012, 0.0024, 0.226), '#15191d', 'dark', T(0.0202, 0.122, -0.05));
  }
  // Bevelled side plates: a satin metal panel on the receiver and a darker frame plate under it.
  if (d >= 1) {
    for (const s of [-1] as const) {
      b.add(box(0.0042, 0.03, 0.15, 0.0019), shade(C.receiver, 1.18), 'metal', T(s * 0.0196, 0.1, -0.05));
      b.add(box(0.004, 0.014, 0.1, 0.0016), shade(C.receiver, 0.82), 'satin', T(s * 0.0196, 0.064, -0.04));
    }
  }
  if (d >= 1) for (const s of [1, -1]) for (const z of [0.035, -0.145]) screw(b, s * 0.0202, 0.085, z, 'x', 0.0026);
  if (d >= 1) {
    // The bolt shows down in the ejection port, its face cut across, and a groove frames the side plate.
    b.add(box(0.003, 0.013, 0.04, 0.001), C.barrel, 'metal', T(0.0205, 0.106, -0.087));
    b.add(box(0.0008, 0.013, 0.0016), C.dark, 'dark', T(0.0221, 0.106, -0.075));
    for (const s of [1, -1]) for (const y of [0.0545, 0.1215]) b.add(box(0.0012, 0.0016, 0.2, 0.0004), shade(C.receiver, 0.55), 'dark', T(s * 0.0201, y, -0.05));
  }
  if (d >= 2) for (const [y, z] of [[0.112, 0.014], [0.112, -0.114], [0.088, 0.014], [0.088, -0.114]] as const) screw(b, -0.0219, y, z, 'x', 0.002);
  // Receiver top as the aiming eye sees it: a matte serrated rib between two polished flats, leading to the barrel rib.
  b.add(box(0.0135, 0.0026, 0.186, lod.bevel * 0.5), C.dark, 'rubber', T(0, 0.1291, -0.07));
  if (d >= 1) {
    for (let i = 0; i < 22; i++) b.add(box(0.0118, 0.001, 0.0034), shade(C.receiver, 1.7), 'satin', T(0, 0.1306, 0.014 - i * 0.008));
    for (const s of [1, -1]) b.add(box(0.0016, 0.0012, 0.186), shade(C.receiver, 1.9), 'metal', T(s * 0.0082, 0.1286, -0.07));
  }
  if (d >= 2) for (const s of [1, -1]) for (const z of [0.012, -0.15]) screw(b, s * 0.0138, 0.1282, z, 'y', 0.0022);
  // Ghost-ring rear sight on the receiver; the eye looks through it at the bead.
  b.add(box(0.022, 0.0055, 0.02, lod.bevel), C.dark, 'satin', T(0, 0.1322, RING_Z));
  if (b.minor) {
    for (const s of [1, -1]) b.add(box(0.0034, 0.0165, 0.012, lod.bevel * 0.5), C.dark, 'satin', T(s * 0.0128, 0.1405, RING_Z));
    b.add(torus(0.0082, 0.0014, lod.segSmall + 10), C.dark, 'satin', T(0, SIGHT_Y, RING_Z));
    b.add(gear(0.0042, 0.005, 10, 0.005), C.accent, 'plastic', T(0.0162, 0.1365, RING_Z, 0, Math.PI / 2));
  }

  // Trigger guard, trigger and pistol grip.
  b.add(slab([[-0.075, 0.048], [-0.008, 0.048], [-0.01, 0.012], [-0.075, 0.015]], 0.0095, lod, 0.006, [[[-0.068, 0.046], [-0.017, 0.046], [-0.018, 0.02], [-0.068, 0.022]]]), C.receiver, 'satin');
  b.add(slab([[-0.046, 0.048], [-0.037, 0.048], [-0.038, 0.035], [-0.042, 0.025], [-0.049, 0.023], [-0.046, 0.034]], 0.0055, lod, 0.002), C.accent, 'plastic');
  const grip: [number, number][] = [[-0.022, 0.05], [0.032, 0.05], [0.054, -0.058], [0.02, -0.065], [0.007, -0.058], [-0.003, -0.024], [-0.013, 0.006]];
  b.add(slab(grip, 0.032, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.wood, 'satin');
  if (d >= 1) b.add(slab([[-0.012, 0.032], [0.026, 0.032], [0.043, -0.05], [0.014, -0.056], [0.003, -0.03]], 0.0342, lod, 0.006), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 4; i++) b.add(box(0.0012, 0.0022, 0.02), shade(C.dark, 0.5), 'dark', T(s * 0.0174, -0.04 + i * 0.02, 0.024 - i * 0.0048, -0.28));
    }
  }

  // Fixed stock with a rubber pad; its comb drops well under the sight line, so the aiming eye looks over it.
  const stock: [number, number][] = [[0.055, 0.114], [0.105, 0.1], [0.312, 0.094], [0.327, 0.084], [0.327, -0.002], [0.307, -0.013], [0.2, 0.03], [0.12, 0.058], [0.055, 0.064]];
  b.add(slab(stock, 0.042, lod, [0.006, 0.02, 0.01, 0.01, 0.01, 0.02, 0.03, 0.02, 0.01], [], 0.011), C.wood, 'satin');
  // Rubber cheek pad on the comb.
  if (d >= 1) b.add(slab([[0.13, 0.083], [0.27, 0.087], [0.27, 0.1], [0.255, 0.104], [0.145, 0.1], [0.13, 0.094]], 0.044, lod, 0.004), C.dark, 'rubber');
  b.add(slab([[0.325, 0.098], [0.342, 0.098], [0.342, -0.016], [0.325, -0.016]], 0.045, lod, 0.004), C.dark, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1] as const) studSide(b, s, s * 0.021, 0.075, 0.2, 3, 0.022, 0.0058, C.wood);
    b.add(box(0.0014, 0.038, 0.11, 0.0006), shade(C.wood, 0.7), 'dark', T(-0.0212, 0.06, 0.22, 0.2));
  }
  if (d >= 2) for (let i = 0; i < 5; i++) b.add(box(0.047, 0.003, 0.0026, 0.0006), shade(C.dark, 1.4), 'rubber', T(0, 0.0 + i * 0.022, 0.3425));

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
  if (d >= 1) b.add(box(0.004, 0.008, 0.08, 0.001), C.receiver, 'satin', T(-0.0255, 0.066, -0.09));
  // Its shells are parts of their own (a reload in first person takes them out one by one); slot nodes mark where each sits.
  const shells = d >= 1 ? 4 : b.minor ? 3 : 2;
  for (let i = 0; i < shells; i++) {
    const z = saddleZ(i, shells);
    b.part(`saddle${i}`, new THREE.Vector3(SADDLE_X, 0.094, z));
    const hull = i % 2 === 0 ? C.hull : C.hull2;
    b.add(tube(0.0098, 0.044, lod.segSmall, 0.0015), hull, 'plastic', T(SADDLE_X, 0.088, z, Math.PI / 2));
    b.add(tube(0.0102, 0.012, lod.segSmall, 0.001), C.brass, 'metal', T(SADDLE_X, 0.116, z, Math.PI / 2));
    if (d >= 2) b.add(tube(0.0028, 0.002, 8), shade(C.brass, 0.7), 'metal', T(SADDLE_X, 0.1225, z, Math.PI / 2));
  }
  b.part('body');
  for (let i = 0; i < shells; i++) b.node(`saddle${i}`, SADDLE_X, 0.094, saddleZ(i, shells), -Math.PI / 2, 0, SADDLE_SPIN);

  // Ribbed pump forend (animated) with its action bars.
  b.part('pump', new THREE.Vector3(0, TUBE_Y, -0.335));
  const pumpLen = 0.17;
  b.add(prism([[-0.024, 0.048], [0.024, 0.048], [0.026, 0.09], [-0.026, 0.09]], pumpLen, lod, 0.011), C.wood, 'satin', T(0, 0, -0.335));
  const ribs = d >= 1 ? 8 : b.minor ? 4 : 2;
  for (let i = 0; i < ribs; i++) {
    const z = -0.335 + (i - (ribs - 1) / 2) * (pumpLen * 0.82 / (ribs - 1));
    b.add(prism([[-0.0262, 0.045], [0.0262, 0.045], [0.0282, 0.084], [-0.0282, 0.084]], 0.006, lod, 0.004), shade(C.wood, 0.86), 'satin', T(0, 0, z));
  }
  if (d >= 1) {
    for (const s of [1, -1]) b.add(box(0.0025, 0.005, 0.15, 0.0006), C.barrel, 'metal', T(s * 0.0135, 0.066, -0.2));
  }
  b.node('support', 0, TUBE_Y, -0.34);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.69);
  b.node('eject', 0.021, 0.106, -0.085);
  b.node('port', 0, 0.044, -0.118);
  b.node('sight', 0, SIGHT_Y, RING_Z);
  b.node('grip', 0, 0, 0, -0.28);
}

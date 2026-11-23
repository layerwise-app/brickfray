import * as THREE from 'three';
import { aim, T, type ModelBuilder } from '../builder';
import { ball, box, gear, latheZ, prism, slab, torus, tube } from '../shapes';
import { screw, shade, slot, studSide } from './details';

const C = {
  coral: '#f26b5b',
  seam: '#c9493c',
  brass: '#c99a3e',
  copper: '#b8733a',
  teal: '#2b8e8a',
  rubber: '#3a3f47',
  dark: '#1d2328',
  steel: '#d3d8dc',
  dial: '#f3eee0',
  can: '#2f3a44',
  needle: '#d3302a',
  lens: '#bfe8f2',
  bead: '#ffcf4a'
};
const BORE = 0.1;
const TUBE_R = 0.021;
/** Barrel mouth; the loaded spear's head sticks out past it. */
const MZ = -0.545;
const SIGHT_Y = 0.153;
const REAR_Z = 0.012;
const FRONT_Z = -0.448;
/** The spear standing ready in the mouth of the spare-spear canister, as an offset from the loaded spear's seat. */
export const READY_SPEAR = [-0.045, -0.026, 0.436] as const;
/** The canister's mouth and closed back along the gun. */
const CAN_MOUTH = -0.13;
const CAN_BACK = 0.04;

/** Harpooner: pneumatic speargun with a teal air tube, brass fittings, porthole peep sight and a barbed spear. */
export function buildHarpoon(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Handle housing cradling the rear of the air tube.
  b.add(slab([[0.074, 0.106], [-0.098, 0.106], [-0.114, 0.094], [-0.114, 0.074], [-0.098, 0.05], [0.074, 0.05]], 0.05, lod, [0.01, 0.008, 0.008, 0.012, 0.008, 0.008]), C.coral, 'plastic');
  if (d >= 1) {
    for (const s of [1, -1] as const) {
      b.add(box(0.0012, 0.0022, 0.17), C.seam, 'dark', T(s * 0.0252, 0.068, -0.02));
      studSide(b, s, s * 0.025, 0.088, 0.03, 3, 0.019, 0.0052, C.coral);
    }
  }
  if (d >= 2) for (const s of [1, -1]) for (const z of [0.05, -0.085]) screw(b, s * 0.0252, 0.062, z, 'x', 0.0024, C.brass);

  // Charging valve on the back of the tube.
  b.add(tube(0.0205, 0.012, lod.seg, 0.002), C.brass, 'metal', T(0, BORE, 0.08));
  b.add(b.minor ? gear(0.0078, 0.0094, d >= 2 ? 14 : 8, 0.012) : tube(0.009, 0.012, lod.segSmall), C.brass, 'metal', T(0, BORE, 0.092));
  if (b.minor) b.add(tube(0.0062, 0.004, lod.segSmall, 0.0012), C.needle, 'plastic', T(0, BORE, 0.1));

  // Skeleton stock with a rubber butt pad.
  const stock: [number, number][] = [[0.07, 0.104], [0.11, 0.092], [0.232, 0.094], [0.246, 0.082], [0.246, -0.004], [0.232, -0.016], [0.17, 0.008], [0.1, 0.034], [0.07, 0.046]];
  const hole: [number, number][] = [[0.124, 0.074], [0.204, 0.072], [0.204, 0.028], [0.17, 0.034], [0.13, 0.05]];
  b.add(slab(stock, 0.044, lod, [0.006, 0.02, 0.01, 0.01, 0.01, 0.02, 0.03, 0.02, 0.006], b.minor ? [hole] : []), C.coral, 'plastic');
  b.add(slab([[0.243, 0.09], [0.258, 0.09], [0.258, -0.012], [0.243, -0.012]], 0.047, lod, 0.004), C.rubber, 'rubber');
  if (d >= 1) {
    for (const s of [1, -1] as const) studSide(b, s, s * 0.022, 0.083, 0.166, 3, 0.024, 0.0048, C.coral);
  }
  if (d >= 2) for (let i = 0; i < 4; i++) b.add(box(0.049, 0.003, 0.0026, 0.0006), shade(C.rubber, 1.4), 'rubber', T(0, 0.008 + i * 0.022, 0.2585));

  // Trigger guard, brass trigger and the pistol grip with rubber panels.
  b.add(slab([[-0.075, 0.05], [-0.008, 0.05], [-0.01, 0.012], [-0.075, 0.015]], 0.0095, lod, 0.006, [[[-0.068, 0.048], [-0.017, 0.048], [-0.018, 0.02], [-0.068, 0.022]]]), C.brass, 'metal');
  b.add(slab([[-0.046, 0.05], [-0.037, 0.05], [-0.038, 0.035], [-0.042, 0.025], [-0.049, 0.023], [-0.046, 0.034]], 0.0055, lod, 0.002), C.brass, 'metal');
  const grip: [number, number][] = [[-0.022, 0.052], [0.032, 0.052], [0.054, -0.058], [0.02, -0.065], [0.007, -0.058], [-0.003, -0.024], [-0.013, 0.006]];
  b.add(slab(grip, 0.032, lod, [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01]), C.coral, 'plastic');
  if (d >= 1) {
    b.add(slab([[-0.004, 0.034], [0.03, 0.034], [0.046, -0.046], [0.02, -0.052], [0.008, -0.046], [0.0, -0.018]], 0.0336, lod, 0.006), C.rubber, 'rubber');
  }
  if (d >= 2) {
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 3; row++) studSide(b, s, s * 0.0168, -0.034 + row * 0.022, 0.022 + row * 0.006, 2, 0.011, 0.0027, shade(C.rubber, 1.3));
    }
  }

  // Air tube with brass bands.
  b.add(tube(TUBE_R, 0.538, lod.seg, 0.002), C.teal, 'satin', T(0, BORE, -0.195));
  for (const z of b.minor ? [-0.124, -0.252, -0.392] : [-0.124, -0.392]) b.add(tube(TUBE_R + 0.0022, 0.01, lod.seg, 0.0012), C.brass, 'metal', T(0, BORE, z));

  // Brass muzzle head with the spear port.
  if (b.minor) {
    b.add(latheZ([[0, -0.464], [0.0222, -0.464], [0.0245, -0.47], [0.0245, -0.49], [0.0145, -0.528], [0.0145, -0.537], [0.0128, -0.545], [0.0076, -0.545], [0.0076, -0.534], [0, -0.534]], lod.seg), C.brass, 'metal', T(0, BORE, 0));
    b.add(tube(0.0075, 0.0016, lod.segSmall), '#0b0d10', 'dark', T(0, BORE, -0.5345));
  } else b.add(latheZ([[0, -0.464], [0.0245, -0.464], [0.0245, -0.49], [0.014, -0.528], [0.014, -0.545], [0, -0.545]], lod.seg), C.brass, 'metal', T(0, BORE, 0));
  if (d >= 1) for (const s of [1, -1]) slot(b, s * 0.0246, BORE, -0.479, 0.0018, 0.008, 0.016, '#14181c');

  // Air bottle under the tube, strapped on, with its valve knob.
  const BOT_Y = 0.058;
  b.add(latheZ([[0, -0.1], [0.008, -0.1], [0.0135, -0.106], [0.0155, -0.116], [0.0155, -0.222], [0.0135, -0.232], [0.008, -0.238], [0, -0.238]], lod.seg), C.copper, 'metal', T(0, BOT_Y, 0));
  b.add(box(0.012, 0.008, 0.1, lod.bevel), C.dark, 'satin', T(0, 0.076, -0.168));
  if (b.minor) {
    for (const z of [-0.134, -0.204]) b.add(torus(0.0162, 0.0016, lod.segSmall + 6), C.rubber, 'rubber', T(0, BOT_Y, z));
    b.add(tube(0.0052, 0.012, lod.segSmall), C.brass, 'metal', T(0, BOT_Y, -0.243));
    b.add(gear(0.0062, 0.0078, 8, 0.008), C.needle, 'plastic', T(0, BOT_Y, -0.252));
  }

  // Ribbed coral fore grip.
  const foreLen = 0.11;
  b.add(prism([[-0.019, 0.046], [0.019, 0.046], [0.0235, 0.084], [-0.0235, 0.084]], foreLen, lod, 0.009), C.coral, 'plastic', T(0, 0, -0.325));
  const ribs = d >= 1 ? 6 : b.minor ? 3 : 0;
  for (let i = 0; i < ribs; i++) {
    const z = -0.325 + (i - (ribs - 1) / 2) * ((foreLen * 0.8) / (ribs - 1));
    b.add(prism([[-0.0205, 0.0435], [0.0205, 0.0435], [0.025, 0.08], [-0.025, 0.08]], 0.006, lod, 0.004), C.seam, 'plastic', T(0, 0, z));
  }
  b.add(prism([[-0.021, 0.04], [0.021, 0.04], [0.025, 0.084], [-0.025, 0.084]], 0.01, lod, 0.008), C.coral, 'plastic', T(0, 0, -0.385));

  // Pressure gauge on the left shoulder of the housing, tilted toward the eye.
  const gx = -0.031;
  const gy = 0.108;
  const gz = -0.058;
  const face = aim(gx, gy, gz, -0.5, 0.62, 0.6);
  const on = (m: THREE.Matrix4) => face.clone().multiply(m);
  b.add(tube(0.0048, 0.018, lod.segSmall), C.brass, 'metal', aim(gx + 0.007, gy - 0.009, gz - 0.008, -0.5, 0.62, 0.6));
  b.add(tube(0.0128, 0.008, lod.segSmall + 6, 0.0018), C.brass, 'metal', face);
  if (b.minor) {
    b.add(tube(0.0103, 0.0008, lod.segSmall + 6), C.dial, 'plastic', on(T(0, 0, 0.0041)));
    if (d >= 1) b.add(torus(0.0078, 0.0009, lod.segSmall + 4, 1.1), C.needle, 'plastic', on(T(0, 0, 0.0047, 0, 0, -0.35)));
    if (d >= 2) for (let i = 0; i < 7; i++) b.add(box(0.0008, 0.0022, 0.0006), C.dark, 'dark', on(T(0, 0, 0.0047, 0, 0, -2.2 + i * 0.73).multiply(T(0, 0.0082, 0))));
    b.add(box(0.0012, 0.0085, 0.0008), C.needle, 'plastic', on(T(0, 0, 0.005, 0, 0, -0.6).multiply(T(0, 0.0034, 0))));
    b.add(ball(0.0014, 8), C.dark, 'satin', on(T(0, 0, 0.005)));
    b.glass(tube(0.0104, 0.0012, lod.segSmall + 6), C.lens, on(T(0, 0, 0.0056)));
  }

  // Porthole peep sight at the rear, hooded bead at the front.
  b.add(tube(TUBE_R + 0.0025, 0.024, lod.seg, 0.0015), C.brass, 'metal', T(0, BORE, REAR_Z));
  b.add(box(0.038, 0.007, 0.016, lod.bevel), C.brass, 'metal', T(0, 0.1255, REAR_Z));
  b.add(box(0.006, 0.014, 0.008, lod.bevel * 0.5), C.brass, 'metal', T(0, 0.135, REAR_Z));
  b.add(torus(0.0098, 0.0027, lod.segSmall + 8), C.brass, 'metal', T(0, SIGHT_Y, REAR_Z));
  if (b.minor) {
    for (const s of [1, -1]) b.add(box(0.0042, 0.026, 0.012, lod.bevel * 0.5), C.coral, 'plastic', T(s * 0.0158, 0.141, REAR_Z));
  }
  if (d >= 2) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      b.add(ball(0.0011, 6), shade(C.brass, 0.8), 'metal', T(Math.cos(a) * 0.0098, SIGHT_Y + Math.sin(a) * 0.0098, REAR_Z - 0.0024));
    }
  }
  b.add(tube(TUBE_R + 0.0025, 0.016, lod.seg, 0.0015), C.brass, 'metal', T(0, BORE, FRONT_Z));
  b.add(prism([[-0.008, 0.119], [0.008, 0.119], [0.004, 0.134], [-0.004, 0.134]], 0.008, lod, 0.002), C.brass, 'metal', T(0, 0, FRONT_Z));
  b.add(box(0.0034, SIGHT_Y - 0.132, 0.005), C.brass, 'metal', T(0, (SIGHT_Y + 0.132) / 2 - 0.002, FRONT_Z));
  b.add(ball(0.0026, 10), C.bead, 'glow', T(0, SIGHT_Y - 0.0026, FRONT_Z));
  if (b.minor) {
    b.add(torus(0.0085, 0.0013, lod.segSmall + 6), C.brass, 'metal', T(0, SIGHT_Y - 0.001, FRONT_Z));
    for (const s of [1, -1]) b.add(box(0.0022, 0.012, 0.004), C.brass, 'metal', T(s * 0.0064, 0.1385, FRONT_Z));
  }

  // Spare-spear canister strapped along the left of the housing, mouth forward, where the eye sees it; a spring feeds the next spear up into its mouth.
  const qx = READY_SPEAR[0];
  const qy = BORE + READY_SPEAR[1];
  const readyMz = MZ + READY_SPEAR[2];
  const [m, back] = [CAN_MOUTH, CAN_BACK];
  b.add(latheZ([[0, back], [0.008, back], [0.0118, back - 0.005], [0.013, back - 0.014], [0.013, m + 0.005], [0.0121, m], [0.0098, m], [0.0098, m + 0.004], [0, m + 0.004]], lod.seg), C.can, 'satin', T(qx, qy, 0));
  b.add(tube(0.0097, 0.002, lod.seg), '#0b0d10', 'dark', T(qx, qy, m + 0.005));
  b.add(torus(0.0118, 0.002, lod.seg), C.brass, 'metal', T(qx, qy, m + 0.001));
  b.add(torus(0.0122, 0.0018, lod.seg), C.brass, 'metal', T(qx, qy, back - 0.012));
  for (const z of b.minor ? [0.005, -0.09] : [-0.04]) b.add(torus(0.0134, 0.0016, lod.segSmall + 6), C.coral, 'plastic', T(qx, qy, z));
  for (const z of [0.005, -0.09]) b.add(box(0.008, 0.01, 0.012, 0.002), C.brass, 'metal', T(-0.0285, qy, z));
  if (d >= 1) {
    // A window down the outer side shows the spares' shafts stacked inside.
    b.add(box(0.0022, 0.0062, 0.07, 0.001), '#14181c', 'dark', T(qx - 0.0123, qy, -0.042));
    for (const dy of [-0.0016, 0.0016]) b.add(box(0.002, 0.0016, 0.064), C.steel, 'chrome', T(qx - 0.0126, qy + dy, -0.042));
  }
  b.part('ready', new THREE.Vector3(qx, qy, readyMz));
  spearHead(b, qx, qy, readyMz);
  b.add(tube(0.0054, 0.04, lod.segSmall + 2, 0.001), C.steel, 'chrome', T(qx, qy, readyMz - 0.01));
  b.node('readyHead', qx, qy, readyMz - 0.036);

  // Loaded spear (animated): shaft hidden in the tube, barbed head out of the muzzle.
  b.part('spear', new THREE.Vector3(0, BORE, MZ));
  b.add(tube(0.0054, 0.215, lod.segSmall + 2, 0.001), C.steel, 'chrome', T(0, BORE, MZ + 0.0745));
  spearHead(b, 0, BORE, MZ);
  b.node('spearHold', 0, BORE, MZ + 0.11);
  b.node('spearHead', 0, BORE, MZ - 0.036);

  b.part('body');
  b.node('muzzle', 0, BORE, MZ - 0.003);
  b.node('eject', 0.026, BORE, -0.02);
  b.node('support', 0, 0.068, -0.325);
  b.node('sight', 0, SIGHT_Y, FRONT_Z);
  b.node('grip', 0, 0, 0, -0.28);
}

/** A spear's brass collar and barbed head, for a spear on the axis (x, y) whose head end (the muzzle, loaded) is at z `mz`. */
function spearHead(b: ModelBuilder, x: number, y: number, mz: number) {
  const { lod } = b;
  b.add(tube(0.0078, 0.012, lod.segSmall + 2, 0.0015), C.brass, 'metal', T(x, y, mz - 0.036));
  b.add(latheZ([[0, mz - 0.042], [0.0085, mz - 0.042], [0.0085, mz - 0.054], [0.0058, mz - 0.09], [0.0024, mz - 0.118], [0, mz - 0.134]], lod.segSmall + 2), C.steel, 'chrome', T(x, y, 0));
  const barb = slab([[mz - 0.104, 0.004], [mz - 0.056, 0.0185], [mz - 0.049, 0.0155], [mz - 0.08, 0.0035]], 0.003, lod, 0.001);
  for (const rz of [0, Math.PI / 2, -Math.PI / 2]) b.add(barb, C.coral, 'plastic', T(x, y, 0, 0, 0, rz));
}


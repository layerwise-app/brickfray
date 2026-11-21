import * as THREE from 'three';
import { T, type ModelBuilder } from '../builder';
import { box, gear, latheZ, pipe, prism, slab, torus, tube } from '../shapes';
import { screw, shade, slot, studGrid, studSide } from './details';

const C = {
  body: '#f4b51b',
  rubber: '#2a2e33',
  dark: '#1a1e23',
  orange: '#f58a1f',
  steel: '#a3aab1',
  bright: '#d0d5da',
  mag: '#3b4148',
  nail: '#c6cbd0',
  strip: '#e8541e',
  battery: '#30353b',
  led: '#6dff5e',
  dot: '#7dff6a',
  lamp: '#fff4d0'
};
const BORE = 0.098;
const SIGHT_Y = 0.157;
const FRONT_Z = -0.2258;
const REAR_Z = -0.03;
/** Nail strip magazine: top edge, rear (nail heads) and front (points) edges, raked forward. */
const MAG_TOP = 0.064;
const MAG_BOTTOM = -0.098;
const MAG_REAR = -0.088;
const MAG_FRONT = -0.148;
const RAKE = 0.32;
const magZ = (y: number, edge: number) => edge - (MAG_TOP - y) * Math.tan(RAKE);
/** Spacing of the collated nails up the strip. */
const PITCH = 0.0068;

/** One nail's step down the raked strip, in the magazine's frame: a shot starts the strip this far back and feeds it up. */
export const NAIL_STEP = [0, -PITCH, -PITCH * Math.tan(RAKE)] as const;

/** Nailer: safety-yellow power-tool SMG with a drum cylinder head, sprung contact nose, nail-strip mag and a slide-on battery. */
export function buildNailer(b: ModelBuilder) {
  const { lod } = b;
  const d = b.detail;

  // Clamshell housing: a raised hump over the grip, sloping into the cylinder head.
  const housing: [number, number][] = [
    [0.072, 0.116],
    [0.048, 0.136],
    [-0.008, 0.146],
    [-0.1, 0.146],
    [-0.148, 0.134],
    [-0.158, 0.134],
    [-0.158, 0.062],
    [-0.15, 0.05],
    [-0.082, 0.05],
    [-0.022, 0.052],
    [0.04, 0.052],
    [0.072, 0.074]
  ];
  b.add(slab(housing, 0.044, lod, [0.016, 0.02, 0.02, 0.01, 0.004, 0.003, 0.004, 0.004, 0.004, 0.004, 0.012, 0.012]), C.body, 'plastic');
  // Black overmold swoosh along the lower rear and a rubber bumper on the back.
  b.add(
    slab([[0.068, 0.106], [0.046, 0.1], [-0.03, 0.095], [-0.078, 0.084], [-0.09, 0.05], [-0.022, 0.0505], [0.04, 0.0505], [0.068, 0.072]], 0.0466, lod, [0.006, 0.02, 0.02, 0.01, 0.003, 0.003, 0.01, 0.006]),
    C.rubber,
    'rubber'
  );
  b.add(slab([[0.082, 0.104], [0.072, 0.116], [0.058, 0.126], [0.058, 0.066], [0.066, 0.066], [0.082, 0.08]], 0.048, lod, [0.008, 0.008, 0, 0, 0.006, 0.012]), C.rubber, 'rubber');
  slot(b, 0, 0.104, 0.0815, 0.03, 0.006, 0.002);
  if (d >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < 5; i++) b.add(box(0.0014, 0.02, 0.0036, 0.0005), C.dark, 'dark', T(s * 0.0222, 0.122, -0.012 + i * 0.0085, 0.38));
      b.add(box(0.0012, 0.0022, 0.21), shade(C.body, 0.62), 'dark', T(s * 0.0222, 0.0985, -0.052));
    }
  }
  if (d >= 2) for (const [y, z] of [[0.112, -0.135], [0.07, -0.13], [0.128, 0.04], [0.072, 0.02]] as const) screw(b, -0.0224, y, z, 'x', 0.0024, '#4a5056');
  if (b.minor) studGrid(b, 0, 0.146, -0.078, 2, 3, 0.0165, 0.0052, C.body);

  // Rear open sight: twin posts with a square notch.
  b.add(box(0.026, 0.005, 0.016, lod.bevel * 0.6), C.dark, 'satin', T(0, 0.1485, REAR_Z));
  for (const s of [1, -1]) b.add(box(0.0048, 0.0105, 0.009, lod.bevel * 0.4), C.dark, 'satin', T(s * 0.0071, 0.1555, REAR_Z));
  if (b.minor) for (const s of [1, -1]) b.add(box(0.0016, 0.0016, 0.0008), C.dot, 'glow', T(s * 0.0071, 0.1575, REAR_Z + 0.0047));

  // Cylinder head drum in a rubber boot, ribbed saddle underneath for the support hand, bumper cap in front.
  const drumZ = -0.194;
  b.add(
    latheZ([[0, 0.044], [0.03, 0.044], [0.035, 0.04], [0.036, 0.032], [0.036, -0.03], [0.0345, -0.038], [0.029, -0.044], [0, -0.044]], lod.seg),
    C.rubber,
    'rubber',
    T(0, BORE, drumZ)
  );
  const arc = Math.max(4, lod.curve * 2 + 2);
  const saddle: [number, number][] = [];
  for (let i = 0; i <= arc; i++) {
    const a = Math.PI * (1.1 + (0.8 * i) / arc);
    saddle.push([Math.cos(a) * 0.0384, Math.sin(a) * 0.0384]);
  }
  for (let i = arc; i >= 0; i--) {
    const a = Math.PI * (1.1 + (0.8 * i) / arc);
    saddle.push([Math.cos(a) * 0.033, Math.sin(a) * 0.033]);
  }
  b.add(prism(saddle, 0.054, lod, 0.002), C.rubber, 'rubber', T(0, BORE, drumZ + 0.002));
  for (const z of [0.038, -0.034]) b.add(tube(0.0368, 0.006, lod.seg, 0.0015), C.rubber, 'rubber', T(0, BORE, drumZ + z));
  if (d >= 1) for (let i = 0; i < 5; i++) b.add(torus(0.0384, 0.0016, 10, Math.PI * 0.8), shade(C.rubber, 1.6), 'rubber', T(0, BORE, drumZ + 0.002 + (i - 2) * 0.0105, 0, 0, Math.PI * 1.1));
  b.add(tube(0.03, 0.01, lod.seg, 0.003, 0.026), C.rubber, 'rubber', T(0, BORE, -0.242));
  b.add(tube(0.021, 0.006, lod.seg, 0.001), C.steel, 'metal', T(0, BORE, -0.249));
  if (d >= 2) for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    screw(b, Math.cos(a) * 0.0165, BORE + Math.sin(a) * 0.0165, -0.2522, 'z', 0.002, '#5a6066');
  }
  if (d >= 1) b.add(box(0.012, 0.005, 0.006, 0.0015), C.dark, 'satin', T(0, BORE - 0.031, -0.236, -0.6));
  if (b.minor && !lod.third) b.add(tube(0.0032, 0.0012, 10), C.lamp, 'glow', T(0, BORE - 0.0325, -0.2395, -0.6));

  // Front post on the drum lip, hooded by two ears.
  b.add(box(0.014, 0.006, 0.014, lod.bevel * 0.5), C.dark, 'satin', T(0, 0.1355, FRONT_Z - 0.003));
  b.add(box(0.0032, 0.022, 0.006, lod.bevel * 0.3), C.dark, 'satin', T(0, 0.148, FRONT_Z - 0.0032));
  if (b.minor) {
    for (const s of [1, -1]) b.add(box(0.0024, 0.017, 0.011, lod.bevel * 0.3), C.dark, 'satin', T(s * 0.0072, 0.1445, FRONT_Z - 0.003));
    b.add(tube(0.0016, 0.0016, 10), C.dot, 'glow', T(0, SIGHT_Y, FRONT_Z + 0.0004));
  }

  // Driver (animated, punches back on every shot): the sprung nose, and a flag in a track on the left of the housing.
  slot(b, -0.0222, 0.117, -0.088, 0.0014, 0.0085, 0.07);
  b.part('slide', new THREE.Vector3(0, BORE, -0.29));
  b.add(box(0.0018, 0.005, 0.026, 0.0005), C.bright, 'metal', T(-0.0226, 0.117, -0.1));
  b.add(box(0.0065, 0.0105, 0.012, 0.002), C.orange, 'plastic', T(-0.0255, 0.117, -0.113));
  // Steel nose, coil spring and the contact trip sleeve with teeth.
  b.add(latheZ([[0, -0.248], [0.0185, -0.248], [0.0185, -0.252], [0.0135, -0.272], [0.0122, -0.3], [0, -0.3]], lod.seg), C.steel, 'metal', T(0, BORE, 0));
  b.add(box(0.006, 0.0032, 0.062, 0.0006), C.steel, 'metal', T(0, BORE - 0.0148, -0.284));
  const coils = lod.third ? 0 : d >= 1 ? 5 : 3;
  for (let i = 0; i < coils; i++) b.add(torus(0.0138, 0.0012, 14), C.bright, 'metal', T(0, BORE, -0.2755 - i * (0.022 / Math.max(1, coils - 1)), 0.14));
  b.add(b.minor ? pipe(0.0128, 0.0086, 0.03, lod.seg) : tube(0.0128, 0.03, lod.seg), C.bright, 'metal', T(0, BORE, -0.315));
  if (b.minor) b.add(tube(0.0088, 0.0012, lod.segSmall), '#0b0d10', 'dark', T(0, BORE, -0.3018));
  if (d >= 1) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(box(0.0036, 0.0036, 0.0036), C.bright, 'metal', T(Math.cos(a) * 0.0108, BORE + Math.sin(a) * 0.0108, -0.3315, 0, 0, a));
    }
    b.add(gear(0.0068, 0.008, d >= 2 ? 14 : 9, 0.006), C.orange, 'plastic', T(-0.0175, BORE - 0.004, -0.264, 0, Math.PI / 2));
    b.add(tube(0.0034, 0.003, lod.segSmall), C.steel, 'metal', T(-0.0212, BORE - 0.004, -0.264, 0, Math.PI / 2));
  }

  b.part('body');

  // Trigger guard, long power-tool trigger, mode switch (left) and mag release (right).
  b.add(slab([[-0.088, 0.052], [-0.012, 0.052], [-0.014, 0.012], [-0.086, 0.017]], 0.0095, lod, 0.006, [[[-0.079, 0.05], [-0.021, 0.05], [-0.022, 0.021], [-0.078, 0.025]]]), C.rubber, 'rubber');
  b.add(slab([[-0.053, 0.052], [-0.038, 0.052], [-0.039, 0.036], [-0.044, 0.026], [-0.056, 0.024], [-0.052, 0.038]], 0.0075, lod, 0.0025), C.orange, 'plastic');
  if (b.minor) {
    b.add(box(0.004, 0.007, 0.016, 0.0012), C.orange, 'plastic', T(-0.0235, 0.08, 0.004, 0.3));
    b.add(box(0.006, 0.006, 0.006, 0.0012), C.orange, 'plastic', T(0.0235, 0.064, -0.096));
  }

  // Pistol grip: yellow core with a stud-textured rubber overmold, the core showing along the back strap.
  const grip: [number, number][] = [[-0.022, 0.054], [0.03, 0.054], [0.052, -0.058], [0.018, -0.064], [0.006, -0.058], [-0.004, -0.024], [-0.013, 0.006]];
  const round = [0.004, 0.01, 0.012, 0.01, 0.01, 0.012, 0.01];
  b.add(slab(grip, 0.03, lod, round), C.body, 'plastic');
  b.add(slab([[-0.0225, 0.0545], [0.021, 0.0545], [0.042, -0.0585], [0.018, -0.0645], [0.0055, -0.0585], [-0.0045, -0.024], [-0.0135, 0.006]], 0.033, lod, round), C.rubber, 'rubber');
  if (d >= 2) {
    for (const s of [1, -1] as const) {
      for (let row = 0; row < 3; row++) studSide(b, s, s * 0.0158, -0.04 + row * 0.022, 0.006 + row * 0.006, 2, 0.01, 0.0026, shade(C.rubber, 1.45));
    }
  }

  // Slide-on battery under the grip: orange collar, fuel gauge and release tab on the back.
  const pack: [number, number][] = [[-0.002, -0.06], [0.07, -0.053], [0.118, -0.05], [0.124, -0.058], [0.124, -0.098], [0.116, -0.106], [0.006, -0.106], [-0.004, -0.096]];
  b.add(slab(pack, 0.05, lod, [0.006, 0.01, 0.006, 0.006, 0.006, 0.008, 0.008, 0.006]), C.battery, 'satin');
  b.add(slab([[-0.004, -0.058], [0.07, -0.0515], [0.12, -0.0485], [0.1255, -0.058], [0.1255, -0.069], [-0.004, -0.069]], 0.0515, lod, [0.004, 0.01, 0.004, 0.004, 0.003, 0.003]), C.orange, 'plastic');
  if (b.minor) {
    for (let i = 0; i < 3; i++) b.add(box(0.008, 0.004, 0.0018), i < 2 ? C.led : shade(C.led, 0.25), i < 2 ? 'glow' : 'dark', T(0.011 * (i - 1), -0.08, 0.1248));
    b.add(box(0.02, 0.007, 0.006, 0.0015), C.dark, 'satin', T(0, -0.0495, 0.108, 0.12));
  }
  if (d >= 1) {
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) b.add(box(0.0012, 0.0024, 0.09), shade(C.battery, 0.6), 'dark', T(s * 0.0252, -0.078 - i * 0.008, 0.062));
  }

  // Belt hook folded along the left side.
  if (b.minor) {
    b.add(box(0.006, 0.014, 0.014, 0.002), C.rubber, 'rubber', T(-0.024, 0.1, 0.04));
    b.add(box(0.0028, 0.008, 0.07, 0.001), C.steel, 'metal', T(-0.0275, 0.1, 0.008));
    b.add(box(0.0028, 0.022, 0.008, 0.001), C.steel, 'metal', T(-0.0275, 0.091, -0.0255, -0.15));
  }

  // Mag well collar under the housing.
  const ring = (y: number, grow: number): [number, number][] => [
    [magZ(y, MAG_REAR) + grow, y],
    [magZ(y, MAG_FRONT) - grow, y]
  ];
  const collarTop = ring(0.056, 0.006);
  const collarBottom = ring(0.036, 0.005);
  b.add(slab([collarTop[0]!, collarTop[1]!, collarBottom[1]!, collarBottom[0]!], 0.03, lod, 0.003), C.rubber, 'rubber');

  // Driver reset handle (animated), pulled back to re-cock on an empty reload.
  b.part('bolt', new THREE.Vector3(0, 0.104, 0.086));
  b.add(tube(0.004, 0.08, lod.segSmall), C.steel, 'metal', T(0, 0.104, 0.044));
  b.add(box(0.044, 0.009, 0.011, 0.002), C.dark, 'satin', T(0, 0.104, 0.0875));
  for (const s of [1, -1]) b.add(box(0.01, 0.011, 0.013, 0.0025), C.orange, 'plastic', T(s * 0.024, 0.104, 0.0875));
  b.node('charge', 0, 0.104, 0.09);

  // Nail strip magazine (animated): open channel, collated nails, orange pusher base.
  b.part('magazine', new THREE.Vector3(0, 0.05, -0.118));
  const outline: [number, number][] = [ring(MAG_TOP, 0)[0]!, ring(MAG_TOP, 0)[1]!, ring(MAG_BOTTOM, 0)[1]!, ring(MAG_BOTTOM, 0)[0]!];
  const winTop = 0.038;
  const winBottom = -0.082;
  const win: [number, number][] = [
    [magZ(winTop, MAG_REAR) - 0.0065, winTop],
    [magZ(winTop, MAG_FRONT) + 0.009, winTop],
    [magZ(winBottom, MAG_FRONT) + 0.009, winBottom],
    [magZ(winBottom, MAG_REAR) - 0.0065, winBottom]
  ];
  const open = !lod.third;
  b.add(slab(outline, 0.022, lod, 0.004, open ? [win] : []), C.mag, 'satin');
  if (open) {
    // The collated strip (animated): fed up a nail on every shot.
    b.part('strip', new THREE.Vector3(0, 0.05, -0.118));
    const pitch = PITCH;
    const count = Math.floor((0.036 - winBottom) / pitch) + 1;
    const seg = Math.min(8, lod.segSmall);
    const shankR = 0.0017;
    for (let i = 0; i < count; i++) {
      const y = 0.036 - i * pitch;
      const head = magZ(y, MAG_REAR) - 0.0095;
      const tip = magZ(y, MAG_FRONT) + 0.0105;
      const shankEnd = tip + 0.006;
      if (d === 0) {
        b.add(box(shankR * 2, shankR * 2, head - shankEnd), C.nail, 'metal', T(0, y, (head + shankEnd) / 2));
        b.add(box(0.0068, 0.0068, 0.0012), C.nail, 'metal', T(0, y, head + 0.0006));
        continue;
      }
      b.add(tube(shankR, head - shankEnd, seg), C.nail, 'metal', T(0, y, (head + shankEnd) / 2));
      b.add(tube(0.0037, 0.0012, seg), C.nail, 'metal', T(0, y, head + 0.0006));
      b.add(latheZ([[0, 0], [shankR, 0], [0, -0.006]], seg), C.nail, 'metal', T(0, y, shankEnd));
    }
    // Plastic collation bands across the shanks, raked with the strip.
    const yMid = (0.036 + (0.036 - (count - 1) * pitch)) / 2;
    const span = ((count - 1) * pitch + 0.008) / Math.cos(RAKE);
    for (const f of [0.32, 0.66]) {
      const z = magZ(yMid, MAG_REAR) - 0.0095 - f * (0.06 - 0.02);
      for (const s of [1, -1]) b.add(box(0.0012, span, 0.0042), C.strip, 'plastic', T(s * 0.0023, yMid, z, RAKE));
    }
    b.part('magazine');
  } else if (b.minor) {
    const yMid = (winTop + winBottom) / 2;
    for (const s of [1, -1]) b.add(box(0.0014, (winTop - winBottom) / Math.cos(RAKE), 0.006), C.strip, 'plastic', T(s * 0.0114, yMid, magZ(yMid, MAG_REAR) - 0.022, RAKE));
  }
  if (d >= 1) {
    for (const s of [1, -1]) b.add(box(0.0014, 0.11 / Math.cos(RAKE), 0.0024, 0.0005), shade(C.mag, 1.5), 'satin', T(s * 0.0114, -0.022, magZ(-0.022, MAG_REAR) - 0.0032, RAKE));
  }
  const base: [number, number][] = [
    [magZ(MAG_BOTTOM + 0.004, MAG_REAR) + 0.004, MAG_BOTTOM + 0.004],
    [magZ(MAG_BOTTOM + 0.004, MAG_FRONT) - 0.004, MAG_BOTTOM + 0.004],
    [magZ(MAG_BOTTOM - 0.01, MAG_FRONT) - 0.006, MAG_BOTTOM - 0.01],
    [magZ(MAG_BOTTOM - 0.01, MAG_REAR) + 0.002, MAG_BOTTOM - 0.01]
  ];
  b.add(slab(base, 0.028, lod, 0.004), C.orange, 'plastic');
  if (b.minor) b.add(box(0.016, 0.01, 0.008, 0.002), C.dark, 'satin', T(0, MAG_BOTTOM - 0.004, magZ(MAG_BOTTOM - 0.004, MAG_FRONT) - 0.009, -RAKE));
  b.node('magHold', 0, -0.072, (magZ(-0.072, MAG_REAR) + magZ(-0.072, MAG_FRONT)) / 2);

  b.part('body');
  b.node('muzzle', 0, BORE, -0.333);
  b.node('eject', 0.023, 0.122, 0.0);
  b.node('support', 0, BORE, -0.176);
  b.node('sight', 0, SIGHT_Y, FRONT_Z);
  b.node('grip', 0, 0, 0, -0.28);
}

import * as THREE from 'three';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { V3 } from '../skeleton';
import { Garment, lump, plate, strand, thigh, tier } from './tailor';
import { C } from './vega-hair';

const HALF = Math.PI / 2;
const { lerp, smoothstep } = THREE.MathUtils;
/** The jacket's shape over the shared torso (body-torso.ts at bulk 0.92), on the chest and waist bones. */
const CHEST = new Garment(
  [
    [-0.05, 0.288, 0.198],
    [0.05, 0.316, 0.208],
    [0.13, 0.343, 0.217],
    [0.19, 0.362, 0.221],
    [0.228, 0.288, 0.186],
    [0.26, 0.19, 0.146]
  ],
  3
);
const WAIST = new Garment(
  [
    [-0.036, 0.262, 0.186],
    [0.04, 0.256, 0.182],
    [0.15, 0.274, 0.188]
  ],
  3
);
const LIFT = 0.002;
const CLOTH = 0.006;
const ON = LIFT + CLOTH + 0.0004;
const TOP = 0.26;
const HEM = -0.036;
const ZIP_X = -0.03;
const L = 0.93;
const THIGH = thigh(L);
/** Raglan seam: from the armpit up to the collar. */
const raglan = (y: number) => lerp(0.2, 0.05, smoothstep(y, 0.085, 0.25));
const span = (y0: number, y1: number, f: (y: number) => [number, number]) => ({ y: [y0, y1] as [number, number], a: (t: number) => f(lerp(y0, y1, t)) });

/** Scout jacket: teal body with white raglan shoulders, dark side panels, an off-centre zip, zipped chest pocket, hem band. */
export function jacket(b: PartSet) {
  const hi = b.detail >= 2;
  const hero = b.hero;
  const around = tier(b, 16, 22, 44);
  const ny = tier(b, 2, 3, 6);
  const seam = CHEST.front(0.1, ZIP_X);
  b.add('chest', CHEST.panel({ y: [-0.05, TOP], a: [seam, seam + Math.PI * 2], lift: LIFT, thick: CLOTH, seg: [around, ny] }), C.teal, { look: 'cloth' });
  b.add('spine', WAIST.panel({ y: [HEM, 0.15], a: [seam, seam + Math.PI * 2], lift: LIFT, thick: CLOTH, seg: [around, tier(b, 1, 2, 3)] }), C.teal, { look: 'cloth' });
  b.mirror((side, sign) => {
    for (const back of [false, true]) {
      const at = (y: number, x: number) => (back ? CHEST.back(y, sign * x) : CHEST.front(y, sign * x));
      const edge = back ? Math.PI - sign * HALF : sign * HALF;
      b.add('chest', CHEST.panel({ ...span(0.085, TOP, (y) => [at(y, raglan(y)), edge]), lift: ON - 0.0002, thick: 0.0022, seg: [tier(b, 2, 4, 9), ny] }), C.white, { look: 'cloth' });
      if (hero) b.add('chest', CHEST.panel({ ...span(0.09, TOP, (y) => [at(y, raglan(y) - 0.006), at(y, raglan(y) + 0.002)]), lift: ON + 0.002, thick: 0.0012, seg: [1, ny] }), C.tealDark, { look: 'cloth' });
    }
    if (!hi) return;
    b.add(`upperArm${side}`, S.sphere(0.06 * L + 0.002, tier(b, 8, 10, 20), tier(b, 6, 7, 14)), C.white, { look: 'cloth' });
    // Dark panels under the arms and a slanted welt pocket on each side of the waist.
    b.add('chest', CHEST.panel({ y: [-0.05, 0.08], a: [sign * (HALF - 0.36), sign * (HALF + 0.36)], lift: ON - 0.0002, thick: 0.0016, seg: [tier(b, 3, 3, 8), 1] }), C.tealDark, { look: 'cloth' });
    b.add('spine', WAIST.panel({ y: [HEM + 0.026, 0.15], a: [sign * (HALF - 0.36), sign * (HALF + 0.36)], lift: ON - 0.0002, thick: 0.0016, seg: [tier(b, 3, 3, 8), 1] }), C.tealDark, { look: 'cloth' });
    b.box('spine', [0.058, 0.007, 0.004], C.tealDark, { ...WAIST.place(0.05, WAIST.front(0.05, sign * 0.082), ON, sign * 1.05), look: 'cloth', bevel: 0 });
  });
  const hem = WAIST.front(0, ZIP_X + 0.012);
  b.add('spine', WAIST.panel({ y: [HEM, HEM + 0.026], a: [hem, hem + Math.PI * 2 - 0.02], lift: ON, thick: 0.003, seg: [around, 1] }), C.tealDark, { look: 'cloth' });
  zip(b);
  if (!hi) return;

  // Zipped pocket and a stitched scout chevron on her right chest.
  b.box('chest', [0.008, 0.075, 0.005], C.steel, { ...CHEST.place(0.03, CHEST.front(0.03, 0.09), ON, -0.22), look: 'metal', bevel: 0 });
  b.box('chest', [0.012, 0.016, 0.007], C.steel, { ...CHEST.place(0.064, CHEST.front(0.064, 0.082), ON + 0.001, -0.22), look: 'chrome', bevel: 0 });
  const patch = CHEST.place(0.128, CHEST.front(0.128, 0.098), ON);
  b.box('chest', [0.05, 0.05, 0.004], C.white, { ...patch, look: 'rubber', bevel: hero ? 0.0015 : 0 });
  const chevron = plate(
    [
      [-0.017, -0.012],
      [0, 0.006],
      [0.017, -0.012],
      [0.017, -0.002],
      [0, 0.016],
      [-0.017, -0.002]
    ],
    0.003
  );
  b.add('chest', chevron, C.teal, { at: [patch.at[0], patch.at[1] + 0.006, patch.at[2] - 0.003], rot: patch.rot, look: 'gloss' });
  b.add('chest', chevron, C.scarf, { at: [patch.at[0], patch.at[1] - 0.008, patch.at[2] - 0.003], rot: patch.rot, look: 'gloss' });
  if (!hero) return;
  // Drawcord toggles on the hem and a strap with a snap on each shoulder.
  b.mirror((_, sign) => {
    const cord = WAIST.place(-0.03, WAIST.front(-0.03, sign * 0.105), ON + 0.004);
    b.cyl('spine', 0.005, 0.005, 0.016, C.white, { ...cord, look: 'gloss', seg: 8 });
    b.add(
      'spine',
      strand(
        [
          [cord.at[0], cord.at[1] - 0.006, cord.at[2]],
          [cord.at[0] + sign * 0.006, cord.at[1] - 0.03, cord.at[2] - 0.004],
          [cord.at[0] + sign * 0.002, cord.at[1] - 0.05, cord.at[2] + 0.002]
        ],
        0.0022,
        { seg: 5, radial: 5 }
      ),
      C.white,
      { look: 'cloth' }
    );
    b.add('chest', CHEST.panel({ y: [0.2, 0.245], a: [CHEST.front(0.22, sign * 0.105), CHEST.front(0.22, sign * 0.135)], lift: ON + 0.002, thick: 0.003, seg: [1, 3] }), C.tealDark, { look: 'cloth' });
    b.cyl('chest', 0.0055, 0.0055, 0.003, C.steel, { ...CHEST.stud(0.212, CHEST.front(0.212, sign * 0.12), ON + 0.005), look: 'chrome', seg: 8 });
  });
}

function zip(b: PartSet) {
  const x = (y: number) => ZIP_X + smoothstep(y, 0.1, 0.25) * 0.012;
  if (!b.hero) {
    b.box('chest', [0.009, 0.3, 0.005], C.steel, { ...CHEST.place(0.1, CHEST.front(0.1, ZIP_X), ON), look: 'metal', bevel: 0 });
    b.box('spine', [0.009, 0.18, 0.005], C.steel, { ...WAIST.place(0.055, WAIST.front(0.055, ZIP_X), ON), look: 'metal', bevel: 0 });
    return;
  }
  for (const [bone, g, y0, y1] of [
    ['chest', CHEST, -0.05, 0.245],
    ['spine', WAIST, HEM, 0.15]
  ] as const) {
    const at = (y: number) => (bone === 'chest' ? x(y) : ZIP_X);
    b.add(bone, g.panel({ ...span(y0, y1, (y) => [g.front(y, at(y) - 0.011), g.front(y, at(y) + 0.011)]), lift: ON, thick: 0.0012, seg: [1, 4] }), C.tealDark, { look: 'cloth' });
    for (let y = y0 + 0.006; y < (bone === 'chest' ? y1 : 0.112); y += 0.0085) b.box(bone, [0.0075, 0.0045, 0.0045], C.steel, { ...g.place(y, g.front(y, at(y)), ON + 0.001), look: 'metal', bevel: 0 });
  }
  b.box('chest', [0.015, 0.018, 0.008], C.steel, { ...CHEST.place(0.2, CHEST.front(0.2, x(0.2)), ON + 0.001), look: 'chrome', bevel: 0.003 });
  b.box('chest', [0.009, 0.034, 0.004], C.scarf, { ...CHEST.place(0.176, CHEST.front(0.176, x(0.176)), ON + 0.007, 0.3), look: 'rubber', bevel: 0.0015 });
}

/** Sleeve bands, elbow patches and the compass strapped to her left wrist. */
export function sleeves(b: PartSet) {
  const hi = b.detail >= 2;
  const round = tier(b, 8, 10, 20);
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    b.cyl(ua, 0.057 * L, 0.0585 * L, 0.066, C.white, { at: [0, -0.04, 0], look: 'cloth', seg: round });
    b.cyl(fa, 0.0425, 0.0412, 0.026, C.white, { at: [0, -0.168, 0], look: 'cloth', seg: round });
    if (!hi) return;
    b.cyl(ua, 0.0595 * L, 0.0595 * L, 0.008, C.tealDark, { at: [0, -0.079, 0], look: 'cloth', seg: round });
    if (b.hero) {
      lump(b, fa, [0.07 * L, 0.1, 0.05], 12, C.tealDark, { at: [0, -0.03, 0.03 * L], look: 'cloth', e: 0.6 });
      b.cyl(fa, 0.0438, 0.0434, 0.004, C.tealDark, { at: [0, -0.153, 0], look: 'cloth', seg: round });
    }
    if (sign > 0) return;
    b.cyl(fa, 0.0445, 0.0435, 0.02, C.dark, { at: [0, -0.134, 0], look: 'rubber', seg: round });
    b.cyl(fa, 0.021, 0.021, 0.012, C.steel, { at: [-0.044, -0.134, 0], rot: [0, 0, HALF], look: 'chrome', seg: round });
    b.cyl(fa, 0.017, 0.017, 0.014, '#f7f4ea', { at: [-0.044, -0.134, 0], rot: [0, 0, HALF], look: 'gloss', seg: round });
    b.box(fa, [0.0162, 0.004, 0.022], '#d8342c', { at: [-0.044, -0.134, 0], rot: [0.6, 0, 0], look: 'gloss', bevel: 0 });
  });
}

/** Scarf: wraps around the neck, a knot with a short end at her left collarbone, and two tails on the swinging bone. */
export function scarf(b: PartSet) {
  const hi = b.detail >= 2;
  const hero = b.hero;
  const seg = tier(b, 10, 12, 24);
  const radial = tier(b, 5, 6, 10);
  const loop = (y: number, rx: number, rz: number, r: number, tilt: number, lean: number, from: number, to: number) => {
    const pts: V3[] = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const a = lerp(from, to, i / n);
      pts.push([Math.sin(a) * rx, y + Math.cos(a) * tilt + Math.sin(a) * lean, 0.004 - Math.cos(a) * rz]);
    }
    return strand(pts, r, { flat: 0.78, side: [0, 1, 0], seg, radial });
  };
  b.add('chest', loop(0.258, 0.088, 0.082, 0.034, -0.012, 0.004, Math.PI, Math.PI * 3), C.scarf, { look: 'cloth' });
  b.add('chest', loop(0.292, 0.078, 0.074, 0.028, 0.008, -0.008, Math.PI - 0.4, Math.PI * 3 - 0.1), C.scarfDark, { look: 'cloth' });
  if (hero) b.add('chest', loop(0.274, 0.097, 0.088, 0.016, -0.02, 0.012, 1.2, 5.4), '#ffbd45', { look: 'cloth' });

  // Knot and the short end over her left collarbone.
  lump(b, 'chest', [0.066, 0.06, 0.052], tier(b, 6, 8, 14), C.scarf, { at: [-0.058, 0.232, -0.088], rot: [0.2, 0.3, 0.3], look: 'cloth', e: 0.8 });
  const end = strand(
    [
      [-0.06, 0.226, -0.098],
      [-0.076, 0.18, -0.126],
      [-0.092, 0.125, -0.126],
      [-0.092, 0.085, -0.12]
    ],
    (t) => 0.03 + t * 0.008,
    { flat: 0.2, side: [1, 0, 0.25], seg: tier(b, 3, 4, 8), radial }
  );
  b.add('chest', end, C.scarf, { look: 'cloth' });
  if (hi) b.box('chest', [0.076, 0.012, 0.014], C.scarfDark, { at: [-0.092, 0.104, -0.123], rot: [0.06, -0.3, 0.05], look: 'cloth', bevel: hero ? 0.003 : 0 });
  if (hero) for (let i = 0; i < 6; i++) b.cyl('chest', 0.0035, 0.002, 0.024, C.scarfDark, { at: [-0.123 + i * 0.012, 0.067, -0.11 - i * 0.003], rot: [0.05, 0, 0.1 - i * 0.03], look: 'cloth', seg: 5 });

  // Two tails down the back: a long one that kicks out at the end and a shorter one beside it.
  const tail = (points: V3[], half: number) => strand(points, (t) => half * (0.8 + 0.3 * t), { flat: 0.2, side: [1, 0, 0.15], seg: tier(b, 5, 6, 12), radial });
  const long: V3[] = [
    [0.01, 0.05, -0.035],
    [0.016, 0.0, 0.014],
    [0.034, -0.13, 0.034],
    [0.03, -0.29, 0.03],
    [0.06, -0.43, 0.062]
  ];
  b.add('dangleBack', tail(long, 0.043), C.scarf, { look: 'cloth' });
  const short: V3[] = [
    [-0.016, 0.05, -0.035],
    [-0.03, 0.0, 0.012],
    [-0.052, -0.11, 0.022],
    [-0.064, -0.25, 0.034]
  ];
  if (hi) b.add('dangleBack', tail(short, 0.036), C.scarfDark, { look: 'cloth' });
  for (const y of hi ? [-0.35, -0.385] : [-0.37]) {
    const t = (y + 0.29) / -0.14;
    b.box('dangleBack', [0.104, 0.014, 0.022], C.scarfDark, { at: [lerp(0.03, 0.06, t), y, lerp(0.03, 0.062, t)], rot: [-0.24, -0.15, -0.2], look: 'cloth', bevel: hero ? 0.004 : 0 });
  }
  if (hero) for (let i = 0; i < 8; i++) b.cyl('dangleBack', 0.004, 0.0022, 0.03, C.scarfDark, { at: [0.016 + i * 0.0125, -0.44 - Math.abs(i - 3.5) * 0.001, 0.07 + (i - 3.5) * 0.002], rot: [-0.25, 0, -0.2 + (i - 3.5) * 0.03], look: 'cloth', seg: 5 });
}

/** Binoculars on a neck strap. */
export function binoculars(b: PartSet) {
  const y = 0.04;
  const z = CHEST.place(y, 0.001, ON + 0.024).at[2];
  const seg = tier(b, 8, 8, 18);
  const onChest = (h: number, x: number): V3 => [x, h, CHEST.place(h, CHEST.front(h, x), ON + 0.004).at[2]];
  b.mirror((_, sign) => {
    const x = sign * 0.025;
    b.cyl('chest', 0.022, 0.025, 0.064, C.dark, { at: [x, y, z], look: 'rubber', seg });
    b.cyl('chest', 0.0165, 0.0165, 0.02, C.dark, { at: [x, y + 0.04, z], look: 'rubber', seg });
    b.cyl('chest', 0.0262, 0.0262, 0.008, C.teal, { at: [x, y - 0.024, z], look: 'gloss', seg });
    if (b.hero) {
      b.cyl('chest', 0.0185, 0.0185, 0.005, C.steel, { at: [x, y + 0.051, z], look: 'chrome', seg });
      b.cyl('chest', 0.021, 0.021, 0.003, '#9fd8ff', { at: [x, y - 0.0325, z], look: 'glass', seg });
    }
    const path: V3[] = [[sign * 0.046, y + 0.02, z + 0.004], onChest(0.13, sign * 0.058), onChest(0.21, sign * 0.066), [sign * 0.07, 0.25, -0.05]];
    b.add('chest', strand(path, 0.007, { flat: 0.3, side: [1, 0, 0], seg: tier(b, 3, 3, 8), radial: tier(b, 4, 4, 6) }), C.dark, { look: 'rubber' });
  });
  b.box('chest', [0.03, 0.034, 0.022], C.dark, { at: [0, y + 0.006, z], look: 'rubber', bevel: b.hero ? 0.005 : 0 });
  b.cyl('chest', 0.008, 0.008, 0.026, C.teal, { at: [0, y + 0.03, z], rot: [0, 0, HALF], look: 'gloss', seg: 8 });
}

const BELT = new Garment(
  [
    [0.006, 0.301, 0.217],
    [0.064, 0.301, 0.217]
  ],
  3.2
);

/** Webbing belt with a clip buckle, pouches, a lumbar roll, the drop-leg pouch and the knife's empty sheath. */
export function fieldKit(b: PartSet) {
  const hi = b.detail >= 2;
  const hero = b.hero;
  const round = tier(b, 8, 10, 20);
  const bevel = (v: number) => (hero ? v : 0);
  const r = 0.0755 * L;
  b.box('pelvis', [0.064, 0.052, 0.014], C.teal, { ...BELT.place(0.035, 0, 0.004), look: 'gloss', bevel: hi ? 0.005 : 0 });
  b.box('pelvis', [0.066, 0.07, 0.05], C.teal, { ...BELT.place(0.022, BELT.front(0.022, 0.112), 0.024), look: 'cloth', bevel: hi ? 0.01 : 0 });
  if (!hi) {
    b.box('thighL', [0.05, 0.11, 0.1], C.dark, { at: [-r - 0.012, -0.2, -0.004], look: 'rubber', bevel: 0 });
    return;
  }
  b.box('pelvis', [0.07, 0.03, 0.054], C.tealDark, { ...BELT.place(0.046, BELT.front(0.046, 0.112), 0.025), look: 'cloth', bevel: bevel(0.008) });
  b.cyl('pelvis', 0.006, 0.006, 0.004, C.steel, { ...BELT.stud(0.038, BELT.front(0.038, 0.112), 0.052), look: 'chrome', seg: 8 });
  b.box('pelvis', [0.024, 0.036, 0.016], C.dark, { ...BELT.place(0.035, 0, 0.006), look: 'rubber', bevel: bevel(0.004) });
  // Lumbar roll: a sleeping mat strapped across the back of the belt.
  b.cyl('pelvis', 0.04, 0.04, 0.2, C.white, { at: [0, 0.03, 0.15], rot: [0, 0, HALF], look: 'cloth', seg: round });
  b.mirror((_, sign) => {
    b.cyl('pelvis', 0.0425, 0.0425, 0.02, C.dark, { at: [sign * 0.055, 0.03, 0.15], rot: [0, 0, HALF], look: 'rubber', seg: round });
    if (hero) b.cyl('pelvis', 0.03, 0.03, 0.004, C.tealDark, { at: [sign * 0.101, 0.03, 0.15], rot: [0, 0, HALF], look: 'cloth', seg: round });
  });
  // Carabiner with a whistle on her left hip.
  const clip = BELT.place(-0.004, BELT.front(0, -0.118), 0.008);
  if (hero) b.torus('pelvis', 0.017, 0.0035, C.steel, { ...clip, scale: [0.8, 1.35, 1], look: 'chrome' });
  else b.box('pelvis', [0.028, 0.046, 0.005], C.steel, { ...clip, look: 'chrome', bevel: 0 });
  b.cyl('pelvis', 0.0075, 0.0075, 0.034, C.scarf, { ...BELT.place(-0.04, BELT.front(0, -0.118), 0.012, 0.2), look: 'gloss', seg: 8 });

  // Drop-leg pouch on her left thigh.
  lump(b, 'thighL', [0.05, 0.11, 0.1], tier(b, 6, 8, 16), C.dark, { at: [-r - 0.012, -0.2, -0.004], look: 'rubber', e: 0.35 });
  b.box('thighL', [0.03, 0.04, 0.104], C.slate, { at: [-r - 0.027, -0.162, -0.004], look: 'rubber', bevel: bevel(0.006) });
  b.box('thighL', [0.008, 0.02, 0.024], C.teal, { at: [-r - 0.043, -0.176, -0.004], look: 'gloss', bevel: bevel(0.003) });
  for (const y of [-0.165, -0.235]) b.cyl('thighL', r + 0.004, r + 0.001, 0.02, C.dark, { at: [0, y, 0], look: 'rubber', seg: round });
  b.box('thighL', [0.008, 0.16, 0.03], C.dark, { at: [-r - 0.0, -0.075, -0.004], rot: [0, 0, 0.05], look: 'rubber', bevel: 0 });
  // Sheath for her knife on the right thigh.
  b.box('thighR', [0.022, 0.16, 0.046], C.dark, { at: [r + 0.008, -0.19, 0.006], rot: [0, 0, -0.04], look: 'rubber', bevel: bevel(0.006) });
  b.box('thighR', [0.026, 0.02, 0.05], C.teal, { at: [r + 0.011, -0.118, 0.006], rot: [0, 0, -0.04], look: 'gloss', bevel: bevel(0.004) });
  for (const y of [-0.15, -0.23]) b.cyl('thighR', r + 0.003, r + 0.001, 0.016, C.dark, { at: [0, y, 0], look: 'rubber', seg: round });
  if (hero) b.ball('thighR', 0.006, C.steel, { at: [r + 0.0205, -0.262, 0.006], look: 'chrome' });
}

/** Knee shells on padded straps and the bands at the top of her boots. */
export function legKit(b: PartSet) {
  const soft = tier(b, 6, 8, 16);
  const round = tier(b, 8, 10, 20);
  b.mirror((side, sign) => {
    const sh = `shin${side}` as const;
    lump(b, sh, [0.098, 0.112, 0.05], soft, C.dark, { at: [0, -0.012, -0.046], look: 'rubber', e: 0.5 });
    lump(b, sh, [0.076, 0.086, 0.034], soft, C.white, { at: [0, -0.008, -0.068], look: 'gloss', e: 0.6 });
    b.cyl(sh, 0.0555, 0.0545, 0.02, C.dark, { at: [0, -0.066, 0.003], look: 'rubber', seg: round });
    b.cyl(`thigh${side}`, 0.0625, 0.061, 0.02, C.dark, { at: [0, -0.37, 0], look: 'rubber', seg: round });
    b.cyl(sh, 0.0458, 0.0448, 0.022, C.teal, { at: [0, -0.3, 0.001], look: 'cloth', seg: round });
    if (!b.hero) return;
    // Piping down the outside of the thigh.
    b.add(`thigh${side}`, THIGH.panel({ y: [-0.35, -0.03], a: [sign * (HALF - 0.04), sign * (HALF + 0.04)], lift: 0.0008, thick: 0.0014, seg: [1, 3] }), C.teal, { look: 'cloth' });
    b.box(sh, [0.04, 0.008, 0.006], C.teal, { at: [0, -0.008, -0.086], look: 'gloss', bevel: 0.002 });
    b.box(sh, [0.012, 0.026, 0.018], C.steel, { at: [sign * 0.0555, -0.066, 0.003], look: 'metal', bevel: 0.003 });
  });
}

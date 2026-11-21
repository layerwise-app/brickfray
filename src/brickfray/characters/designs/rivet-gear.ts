import { limbBand } from '../body-limbs';
import type { PartSet } from '../parts';
import type { V3 } from '../skeleton';
import { C } from './rivet-vest';
import { Garment, limbGarment, lump, plate, SKULL, strand, thigh, tier } from './tailor';

const HALF = Math.PI / 2;
const SHELL: [number, number][] = [
  [0.139, -0.052],
  [0.141, -0.022],
  [0.137, 0.008],
  [0.127, 0.036],
  [0.109, 0.059],
  [0.083, 0.075],
  [0.05, 0.085],
  [0.018, 0.089],
  [0, 0.09]
];
const HAT: V3 = [1.04, 1, 1.13];

/** Height of the shell above the hat bone at a point seen from above. */
function crown(x: number, z: number) {
  const r = Math.hypot(x / HAT[0], z / HAT[2]);
  for (let i = 0; i < SHELL.length - 1; i++) {
    const [r0, y0] = SHELL[i]!;
    const [r1, y1] = SHELL[i + 1]!;
    if (r <= r0 && r >= r1) return y0 + ((y1 - y0) * (r0 - r)) / (r0 - r1);
  }
  return SHELL[0]![1];
}

/** Hard hat: ribbed shell, rolled brim with a peak, headlamp on an elastic strap, ratchet band at the nape. */
export function hardHat(b: PartSet) {
  const hi = b.detail >= 2;
  const round = tier(b, 12, 18, 36);
  b.lathe('hat', SHELL, C.yellow, { look: 'gloss', scale: HAT, seg: round });
  b.lathe(
    'hat',
    [
      [0.128, -0.06],
      [0.156, -0.062],
      [0.162, -0.055],
      [0.156, -0.048],
      [0.139, -0.045]
    ],
    C.yellow,
    { look: 'gloss', scale: HAT, seg: round }
  );
  b.lathe(
    'hat',
    [
      [0, -0.008],
      [0.086, -0.008],
      [0.097, -0.003],
      [0.086, 0.003],
      [0, 0.004]
    ],
    C.yellow,
    { at: [0, -0.05, -0.109], rot: [-0.17, 0, 0], scale: [1.5, 1, 1.02], look: 'gloss', seg: tier(b, 10, 14, 28) }
  );

  // Crown ribs running front to back.
  const rib = (x: number, half: number, lift: number) => {
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const z = -0.138 + (0.276 * i) / 8;
      pts.push([x, crown(x, z) + lift, z]);
    }
    return strand(pts, half, { flat: 0.42, side: [1, 0, 0], seg: tier(b, 5, 6, 14), radial: tier(b, 4, 6, 10) });
  };
  b.add('hat', rib(0, 0.019, 0.003), C.yellow, { look: 'gloss' });
  if (!hi) return;
  b.mirror((_, sign) => b.add('hat', rib(sign * 0.058, 0.009, 0.001), '#e9b616', { look: 'gloss' }));

  // Headlamp strap, lamp and its battery at the back.
  const lens = tier(b, 8, 10, 20);
  b.lathe(
    'hat',
    [
      [0.14, -0.034],
      [0.1475, -0.03],
      [0.1475, -0.018],
      [0.14, -0.014]
    ],
    '#3a4047',
    { look: 'cloth', scale: HAT, seg: round }
  );
  lump(b, 'hat', [0.066, 0.05, 0.04], tier(b, 6, 8, 14), C.dark, { at: [0, -0.016, -0.168], rot: [-0.12, 0, 0], look: 'rubber', e: 0.35 });
  b.cyl('hat', 0.024, 0.026, 0.02, C.steel, { at: [0, -0.014, -0.19], rot: [HALF - 0.12, 0, 0], look: 'chrome', seg: lens });
  b.cyl('hat', 0.019, 0.019, 0.006, '#fff3c4', { at: [0, -0.0125, -0.2], rot: [HALF - 0.12, 0, 0], look: 'glow', seg: lens });
  if (!b.hero) return;
  b.box('hat', [0.03, 0.01, 0.012], C.orange, { at: [0, 0.011, -0.172], rot: [-0.12, 0, 0], look: 'gloss', bevel: 0.003 });
  b.mirror((_, sign) => b.box('hat', [0.012, 0.022, 0.02], C.dark, { at: [sign * 0.15, -0.024, 0], look: 'rubber', bevel: 0.003 }));
  b.box('hat', [0.06, 0.034, 0.024], C.dark, { at: [0, -0.022, 0.166], look: 'rubber', bevel: 0.006 });
  b.box('hat', [0.03, 0.008, 0.004], C.orange, { at: [0, -0.02, 0.179], look: 'gloss' });
  // Suspension band under the brim with its ratchet knob.
  b.add('head', SKULL.panel({ y: [0.132, 0.15], a: [0.5, Math.PI * 2 - 0.5], lift: 0.0085, thick: 0.004, seg: [28, 1] }), C.dark, { look: 'rubber' });
  b.cyl('head', 0.02, 0.02, 0.016, C.dark, { at: [0, 0.128, 0.142], rot: [HALF, 0, 0], look: 'rubber', seg: 12 });
  b.cyl('head', 0.011, 0.011, 0.02, C.orange, { at: [0, 0.128, 0.144], rot: [HALF, 0, 0], look: 'gloss', seg: 8 });
}

const BELT = new Garment(
  [
    [0.004, 0.343, 0.217],
    [0.066, 0.343, 0.217]
  ],
  3.2
);
const ON = 0.009;

/** Leather tool belt: hip pouch with screwdrivers and pliers, tape measure, hammer in its loop, level, rag. */
export function toolBelt(b: PartSet) {
  const hi = b.detail >= 2;
  const hero = b.hero;
  const leather = 'skin' as const;
  const soft = tier(b, 6, 8, 16);
  const round = tier(b, 6, 8, 14);
  const bevel = (v: number) => (hero ? v : 0);
  b.add('pelvis', BELT.panel({ y: [0.004, 0.066], a: [BELT.front(0, 0.04), Math.PI * 2 - BELT.front(0, 0.04)], lift: 0.002, thick: 0.007, seg: [tier(b, 14, 20, 44), 1] }), C.leather, { look: leather });
  b.box('pelvis', [0.076, 0.064, 0.012], C.steel, { ...BELT.place(0.034, 0, ON + 0.001), look: 'metal', bevel: 0.004 });
  b.box('pelvis', [0.05, 0.04, 0.014], C.leather, { ...BELT.place(0.034, 0, ON + 0.001), look: leather, bevel: 0 });
  if (hi) b.box('pelvis', [0.04, 0.008, 0.016], C.steel, { ...BELT.place(0.034, BELT.front(0.034, 0.012), ON + 0.002), look: 'chrome', bevel: 0 });
  if (hero) {
    for (const y of [0.009, 0.061]) {
      const a0 = BELT.front(0, 0.05);
      b.add('pelvis', BELT.panel({ y: [y - 0.0012, y + 0.0012], a: [a0, Math.PI * 2 - a0], lift: ON, thick: 0.0008, seg: [40, 1] }), C.stitch, { look: 'cloth' });
    }
    for (const x of [-0.062, -0.074, -0.086]) b.cyl('pelvis', 0.0032, 0.0032, 0.002, '#3d2413', { ...BELT.stud(0.034, BELT.front(0.034, x), ON), look: 'rubber', seg: 6 });
    b.box('pelvis', [0.014, 0.076, 0.006], C.tan, { ...BELT.place(0.034, BELT.front(0.034, 0.058), ON), look: leather, bevel: 0.002 });
  }

  // Hip pouch on his left: bag, front pocket, flap and the tool handles.
  const px = -0.207;
  lump(b, 'pelvis', [0.06, 0.15, 0.13], soft, C.leather, { at: [px, -0.04, -0.004], look: leather, e: 0.32, taper: 0.12 });
  b.box('pelvis', [0.02, 0.06, 0.05], C.leather, { at: [px + 0.022, 0.035, 0.0], look: leather, bevel: 0 });
  if (hi) {
    lump(b, 'pelvis', [0.04, 0.085, 0.1], soft, C.tan, { at: [px - 0.022, -0.062, -0.006], look: leather, e: 0.32, taper: 0.1 });
    b.box('pelvis', [0.008, 0.034, 0.104], C.leather, { at: [px - 0.042, -0.03, -0.006], rot: [0, 0, 0.08], look: leather, bevel: bevel(0.003) });
    b.cyl('pelvis', 0.0075, 0.0075, 0.006, C.steel, { at: [px - 0.047, -0.036, -0.006], rot: [0, 0, HALF], look: 'chrome', seg: 8 });
    // Screwdrivers and pliers.
    b.cyl('pelvis', 0.0125, 0.011, 0.07, C.red, { at: [px + 0.004, 0.064, -0.034], rot: [0.1, 0, 0.06], look: 'gloss', seg: round });
    b.cyl('pelvis', 0.011, 0.01, 0.055, C.blue, { at: [px + 0.002, 0.056, 0.0], rot: [-0.05, 0, 0.1], look: 'gloss', seg: round });
    b.mirror((_, sign) =>
      b.add(
        'pelvis',
        strand(
          [
            [px + 0.004, 0.02, 0.036 + sign * 0.006],
            [px + 0.002, 0.06, 0.036 + sign * 0.01],
            [px - 0.004, 0.098, 0.036 + sign * 0.017]
          ],
          0.0058,
          { seg: tier(b, 3, 3, 6), radial: tier(b, 5, 5, 8) }
        ),
        '#e0a020',
        { look: 'rubber' }
      )
    );
  }
  if (hero) {
    b.cyl('pelvis', 0.0128, 0.0128, 0.008, C.dark, { at: [px + 0.0062, 0.102, -0.0375], rot: [0.1, 0, 0.06], look: 'rubber', seg: round });
    b.cyl('pelvis', 0.0112, 0.0112, 0.008, '#f4f1e8', { at: [px + 0.0048, 0.086, -0.0014], rot: [-0.05, 0, 0.1], look: 'gloss', seg: round });
    for (const z of [-0.055, 0.045]) b.ball('pelvis', 0.005, C.steel, { at: [px - 0.03, 0.018, z - 0.004], look: 'chrome' });
    for (const z of [-0.05, 0.04]) b.box('pelvis', [0.002, 0.07, 0.002], C.stitch, { at: [px - 0.0425, -0.066, z - 0.006], look: 'cloth' });
  }

  // Tape measure clipped at the front left.
  const tape = BELT.place(0.026, BELT.front(0.026, -0.108), ON + 0.016);
  lump(b, 'pelvis', [0.062, 0.062, 0.034], soft, C.yellow, { ...tape, look: 'gloss', e: 0.4 });
  if (hi) {
    lump(b, 'pelvis', [0.066, 0.03, 0.036], soft, C.dark, { ...tape, at: [tape.at[0], tape.at[1] - 0.02, tape.at[2]], look: 'rubber', e: 0.4 });
    b.cyl('pelvis', 0.014, 0.014, 0.005, C.dark, { ...BELT.stud(0.03, BELT.front(0.03, -0.108), ON + 0.033), look: 'rubber', seg: tier(b, 8, 8, 14) });
    b.box('pelvis', [0.012, 0.012, 0.006], C.steel, { at: [tape.at[0] - 0.036, tape.at[1] - 0.012, tape.at[2] - 0.004], look: 'chrome', bevel: bevel(0.002) });
  }

  // Roll of duct tape on a carabiner at the front right.
  if (hero) {
    const roll = BELT.place(-0.03, BELT.front(0, 0.112), ON + 0.014, 0.12);
    b.torus('pelvis', 0.026, 0.013, '#9aa1a8', { ...roll, scale: [1, 1, 1.5], look: 'gloss' });
    b.torus('pelvis', 0.014, 0.004, '#c9a06a', { ...roll, scale: [1, 1, 4.6], look: 'cloth' });
    b.torus('pelvis', 0.016, 0.003, C.steel, { ...BELT.place(0.006, BELT.front(0, 0.112), ON + 0.004), scale: [0.75, 1.4, 1], look: 'chrome' });
  }

  // Claw hammer hanging in a steel loop at the back right.
  const hx = 0.196;
  const hz = 0.062;
  b.cyl('pelvis', 0.012, 0.0135, 0.25, C.wood, { at: [hx, -0.1, hz], rot: [0.06, 0, 0.05], look: 'cloth', seg: tier(b, 6, 6, 10) });
  b.box('pelvis', [0.032, 0.034, 0.066], C.steel, { at: [hx - 0.006, 0.036, hz - 0.012], look: 'metal', bevel: hi ? 0.006 : 0 });
  if (!hi) return;
  b.cyl('pelvis', 0.019, 0.019, 0.022, C.steel, { at: [hx - 0.006, 0.036, hz - 0.054], rot: [HALF, 0, 0], look: 'metal', seg: tier(b, 8, 8, 14) });
  const claw = plate(
    [
      [0, 0.014],
      [0.03, 0.012],
      [0.052, -0.002],
      [0.06, -0.022],
      [0.046, -0.012],
      [0.026, -0.006],
      [0, -0.012]
    ],
    0.026,
    bevel(0.003)
  );
  b.add('pelvis', claw, C.steel, { at: [hx - 0.006, 0.038, hz + 0.018], rot: [0, -HALF, 0], look: 'metal' });
  b.cyl('pelvis', 0.0145, 0.015, 0.09, C.dark, { at: [hx + 0.0045, -0.18, hz - 0.005], rot: [0.06, 0, 0.05], look: 'rubber', seg: tier(b, 6, 6, 10) });
  if (hero) b.torus('pelvis', 0.021, 0.0035, C.steel, { at: [hx - 0.002, 0.008, hz], rot: [HALF, 0, 0], scale: [1, 1.3, 1], look: 'chrome' });
  else b.box('pelvis', [0.05, 0.007, 0.05], C.steel, { at: [hx - 0.002, 0.008, hz], look: 'chrome', bevel: 0 });

  // Torpedo level across the back of the belt.
  b.box('pelvis', [0.19, 0.036, 0.022], C.yellow, { at: [-0.012, 0.034, 0.131], look: 'gloss', bevel: bevel(0.004) });
  b.mirror((_, sign) => b.box('pelvis', [0.014, 0.04, 0.026], C.dark, { at: [-0.012 + sign * 0.092, 0.034, 0.131], look: 'rubber', bevel: bevel(0.004) }));
  for (const x of [-0.06, 0.036]) {
    b.box('pelvis', [0.036, 0.016, 0.004], '#baf7a0', { at: [x, 0.034, 0.1425], look: 'glow', bevel: 0 });
    if (hero) b.box('pelvis', [0.004, 0.018, 0.005], C.dark, { at: [x, 0.034, 0.143], look: 'rubber', bevel: 0 });
  }
  // Rag tucked in the back pocket.
  const rag = plate(
    [
      [-0.034, 0.02],
      [0.03, 0.022],
      [0.04, -0.07],
      [0.012, -0.1],
      [-0.006, -0.078],
      [-0.03, -0.092]
    ],
    0.008,
    bevel(0.002)
  );
  b.add('pelvis', rag, '#c8372d', { at: [0.085, -0.018, 0.103], rot: [0.12, 0, -0.08], look: 'cloth' });
  if (hero) b.add('pelvis', rag, '#e8e2d2', { at: [0.079, -0.024, 0.099], rot: [0.1, 0, 0.1], scale: [0.8, 0.9, 1], look: 'cloth' });
}

const LIMBS = 1.08;
/** Leg thickness: a stocky builder stands on thick legs. */
export const LEGS = 1.2;
const THIGH = thigh(LEGS);
const SHIN = limbGarment('shin', LEGS);

/** Work trousers: double fronts, cargo pocket, rule pocket, knee pads on straps, turned-up hems. */
export function legKit(b: PartSet) {
  const hero = b.hero;
  const soft = tier(b, 6, 8, 16);
  const bevel = (v: number) => (hero ? v : 0);
  b.mirror((side, sign) => {
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    // Knee pad: foam cup, hard shell, straps above and below the knee.
    lump(b, sh, [0.122, 0.13, 0.06], soft, C.dark, { at: [0, -0.012, -0.059], look: 'rubber', e: 0.5 });
    lump(b, sh, [0.094, 0.096, 0.036], soft, '#555c63', { at: [0, -0.01, -0.086], look: 'gloss', e: 0.6 });
    b.add(sh, limbBand(b, 'shin', LEGS, -0.084, -0.06, 0.003), C.dark, { look: 'rubber' });
    b.add(th, limbBand(b, 'thigh', LEGS, -0.384, -0.36, 0.0035), C.dark, { look: 'rubber' });
    b.add(sh, limbBand(b, 'shin', LEGS, -0.325, -0.285, 0.005), '#8f7b59', { look: 'cloth' });
    b.add(th, THIGH.panel({ y: [-0.355, -0.09], a: [-1.05, 1.05], lift: 0.0012, thick: 0.004, seg: [tier(b, 4, 4, 10), 1] }), C.duck, { look: 'cloth' });
    // The trouser leg stacks in folds over the boot.
    for (const [y, grow] of [
      [-0.262, 0.0042],
      [-0.236, 0.0034]
    ] as const) {
      b.add(sh, limbBand(b, 'shin', LEGS, y - 0.007, y + 0.007, grow), C.khaki, { look: 'cloth' });
    }
    if (!hero) return;
    // Lower leg: the side seam runs on down, and a kick patch of doubled duck guards the inside of the ankle.
    b.add(sh, SHIN.panel({ y: [-0.283, -0.1], a: [sign * (HALF - 0.04), sign * (HALF + 0.04)], lift: 0.0008, thick: 0.0014, seg: [1, 4] }), C.khakiDark, { look: 'cloth' });
    b.add(sh, SHIN.panel({ y: [-0.283, -0.17], a: [-sign * (HALF + 0.75), -sign * (HALF - 0.75)], lift: 0.0046, thick: 0.003, seg: [6, 2] }), C.duck, { look: 'cloth' });
    b.add(sh, SHIN.panel({ y: [-0.176, -0.173], a: [-sign * (HALF + 0.68), -sign * (HALF - 0.68)], lift: 0.0077, thick: 0.0008, seg: [6, 1] }), C.stitch, { look: 'cloth' });
    // Topstitching inside the double front's edges.
    for (const a of [-0.97, 0.97]) b.add(th, THIGH.panel({ y: [-0.35, -0.098], a: [a - 0.012, a + 0.012], lift: 0.0052, thick: 0.0008, seg: [1, 3] }), C.stitch, { look: 'cloth' });
    b.add(th, THIGH.panel({ y: [-0.1, -0.097], a: [-0.97, 0.97], lift: 0.0052, thick: 0.0008, seg: [8, 1] }), C.stitch, { look: 'cloth' });
    for (const y of [0.014, -0.01, -0.034]) b.box(sh, [0.064, 0.006, 0.006], C.dark, { at: [0, y, -0.104 + Math.abs(y + 0.01) * 0.12], look: 'rubber', bevel: 0.002 });
    b.box(sh, [0.012, 0.03, 0.02], C.steel, { at: [sign * 0.0705, -0.072, 0.003], look: 'metal', bevel: 0.003 });
    b.add(th, THIGH.panel({ y: [-0.36, -0.03], a: [sign * (HALF - 0.035), sign * (HALF + 0.035)], lift: 0.0008, thick: 0.0014, seg: [1, 3] }), C.khakiDark, { look: 'cloth' });
    b.add(sh, limbBand(b, 'shin', LEGS, -0.2895, -0.2865, 0.0058), C.khakiDark, { look: 'cloth' });
  });
  // Cargo pocket on his left thigh, folding rule in a slim pocket on the right.
  lump(b, 'thighL', [0.03, 0.115, 0.105], soft, C.khaki, { at: [-0.089, -0.21, 0.0], rot: [0, 0, 0.04], look: 'cloth', e: 0.3 });
  b.box('thighL', [0.034, 0.04, 0.112], C.khakiDark, { at: [-0.09, -0.165, 0.0], rot: [0, 0, 0.04], look: 'cloth', bevel: bevel(0.004) });
  b.box('thighR', [0.02, 0.15, 0.05], C.khaki, { at: [0.092, -0.2, 0.02], rot: [0, 0, -0.04], look: 'cloth', bevel: bevel(0.004) });
  b.box('thighR', [0.012, 0.06, 0.036], '#f4f1e8', { at: [0.096, -0.105, 0.02], rot: [0, 0, -0.04], look: 'gloss', bevel: 0 });
  if (!hero) return;
  b.cyl('thighL', 0.007, 0.007, 0.004, C.steel, { at: [-0.108, -0.172, 0.0], rot: [0, 0, HALF], look: 'chrome', seg: 8 });
  for (const y of [-0.085, -0.1, -0.115]) b.box('thighR', [0.013, 0.002, 0.037], C.red, { at: [0.0965, y, 0.02], rot: [0, 0, -0.04], look: 'plastic', bevel: 0 });
}

/** Rolled sleeves, the gloves' wrist tabs and a wristwatch. */
export function armKit(b: PartSet) {
  const hi = b.detail >= 2;
  const round = tier(b, 8, 10, 20);
  b.mirror((side) => {
    b.add(`upperArm${side}`, limbBand(b, 'upperArm', LIMBS, -0.237, -0.193, 0.006), C.collar, { look: 'cloth' });
    if (hi) b.add(`upperArm${side}`, limbBand(b, 'upperArm', LIMBS, -0.205, -0.193, 0.0075), C.navy, { look: 'cloth' });
  });
  if (!hi) return;
  if (b.hero) b.mirror((side, sign) => b.box(`forearm${side}`, [0.008, 0.034, 0.03], C.dark, { at: [sign * 0.0525, -0.232, 0], look: 'rubber', bevel: 0.002 }));
  b.add('forearmL', limbBand(b, 'forearm', LIMBS, -0.195, -0.177, 0.003), C.dark, { look: 'rubber' });
  b.cyl('forearmL', 0.021, 0.021, 0.014, '#555c63', { at: [-0.047, -0.186, 0], rot: [0, 0, HALF], look: 'metal', seg: round });
  b.cyl('forearmL', 0.0165, 0.0165, 0.016, '#dff3ea', { at: [-0.0475, -0.186, 0], rot: [0, 0, HALF], look: 'gloss', seg: round });
}

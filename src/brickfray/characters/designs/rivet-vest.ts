import * as THREE from 'three';
import type { PartSet } from '../parts';
import { Garment, lump, tier, type Ring } from './tailor';

export const C = {
  orange: '#f58a1f',
  hem: '#d9700f',
  navy: '#2b3a55',
  collar: '#34476a',
  skin: '#c98d62',
  yellow: '#f6c624',
  lime: '#e9e23a',
  tape: '#e4ebee',
  leather: '#7a4a2a',
  tan: '#a8703f',
  stitch: '#d9b27c',
  khaki: '#7d6a4c',
  khakiDark: '#6a5940',
  duck: '#5b4a34',
  hair: '#3b2a1e',
  steel: '#aeb5bc',
  dark: '#2a2e33',
  wood: '#b98a52',
  red: '#d8452e',
  blue: '#2f6fd0'
};

const { lerp, smoothstep } = THREE.MathUtils;
/**
 * The vest's one profile over the shared torso (body-torso.ts at bulk 1.12), in chest-bone space from the hem up.
 * It is cut at SEAM into a piece on the chest bone and one on the waist bone; Rivet's stance turns them as one (`waist: 1`).
 */
const PROFILE: Ring[] = [
  [-0.18, 0.306, 0.19],
  [-0.12, 0.313, 0.188],
  [-0.075, 0.325, 0.19],
  [-0.03, 0.344, 0.198],
  [0.05, 0.384, 0.212],
  [0.13, 0.417, 0.221],
  [0.19, 0.44, 0.225],
  [0.228, 0.35, 0.19],
  [0.26, 0.2, 0.15]
];
/** Height of the chest bone above the waist bone (skeleton.ts). */
const RISE = 0.16;
const CHEST = new Garment(PROFILE, 3);
const WAIST = new Garment(PROFILE.map(([y, w, d]): Ring => [y + RISE, w, d]), 3);
const SEAM = -0.03;
const LIFT = 0.002;
const CLOTH = 0.007;
const ON = LIFT + CLOTH + 0.0004;
const ZIP = 0.005;
const TOP = 0.26;
const HEM = -0.02;
const BAND: [number, number] = [0.044, 0.076];
const LOW_BAND: [number, number] = [0.058, 0.09];

/** Edge of the neck opening, the armhole's edge angle and the shoulder tape's centre, by height on the chest. */
const neckX = (y: number) => lerp(ZIP, 0.046, smoothstep(y, 0.1, 0.24));
const armhole = (y: number) => lerp(Math.PI / 2, CHEST.front(y, lerp(0.168, 0.094, smoothstep(y, 0.19, TOP))), smoothstep(y, 0.085, 0.19));
const stripe = (y: number) => lerp(0.1, 0.07, smoothstep(y, 0.19, TOP));
const span = (y0: number, y1: number, f: (y: number) => [number, number]) => ({ y: [y0, y1] as [number, number], a: (t: number) => f(lerp(y0, y1, t)) });

/** Hi-vis vest: front panels and a back cut around the armholes, zip, reflective tape with lime edging, pockets. */
export function vest(b: PartSet) {
  const hi = b.detail >= 2;
  const na = tier(b, 4, 6, 12);
  const ny = tier(b, 2, 3, 6);
  const around = tier(b, 14, 22, 44);
  const trim = hi ? 0.0012 : 0;

  b.mirror((_, sign) => {
    const side = (lo: number, hiA: number): [number, number] => (sign > 0 ? [lo, hiA] : [-hiA, -lo]);
    b.add('chest', CHEST.panel({ ...span(SEAM, TOP, (y) => side(CHEST.front(y, neckX(y)), armhole(y))), lift: LIFT, thick: CLOTH, seg: [na, ny] }), C.orange, { look: 'cloth' });
    b.add('spine', WAIST.panel({ ...span(HEM, SEAM + RISE, (y) => side(WAIST.front(y, ZIP), Math.PI / 2)), lift: LIFT, thick: CLOTH, seg: [na, 1] }), C.orange, { look: 'cloth' });

    // Tape up the front, over the shoulder and down the back.
    for (const back of [false, true]) {
      const at = (y: number, x: number) => (back ? CHEST.back(y, sign * x) : CHEST.front(y, sign * x));
      const strip = (half: number, lift: number, thick: number, color: string, look: 'cloth' | 'gloss') =>
        b.add('chest', CHEST.panel({ ...span(BAND[1] - 0.004, TOP, (y) => [at(y, stripe(y) - half), at(y, stripe(y) + half)]), lift, thick, seg: [tier(b, 1, 2, 4), ny] }), color, { look });
      if (hi) strip(0.022, ON, trim, C.lime, 'cloth');
      strip(0.015, ON + trim, 0.0024, C.tape, 'gloss');
    }
  });
  b.add('chest', CHEST.panel({ ...span(SEAM, TOP, (y) => [Math.PI - armhole(y), Math.PI + armhole(y)]), lift: LIFT, thick: CLOTH, seg: [na * 2, ny] }), C.orange, { look: 'cloth' });
  b.add('spine', WAIST.panel({ y: [HEM, SEAM + RISE], a: [Math.PI / 2, Math.PI * 1.5], lift: LIFT, thick: CLOTH, seg: [na * 2, 1] }), C.orange, { look: 'cloth' });
  // In a match the waist still bends against the chest: a lining under the seam keeps the opening orange.
  if (!b.hero) b.add('spine', WAIST.panel({ y: [SEAM + RISE - 0.01, SEAM + RISE + 0.035], a: [0, Math.PI * 2], lift: LIFT - 0.006, thick: 0.005, seg: [around, 1] }), C.orange, { look: 'cloth' });

  // Tape around the chest and the waist, split at the zip.
  const wrap = (bone: 'chest' | 'spine', g: Garment, y: [number, number], lift: number, thick: number, color: string, look: 'cloth' | 'gloss') => {
    const a0 = g.front(y[0], ZIP + 0.008);
    b.add(bone, g.panel({ y, a: [a0, Math.PI * 2 - a0], lift, thick, seg: [around, 1] }), color, { look });
  };
  for (const [bone, g, y] of [
    ['chest', CHEST, BAND],
    ['spine', WAIST, LOW_BAND]
  ] as const) {
    if (hi) wrap(bone, g, [y[0] - 0.008, y[1] + 0.008], ON, trim, C.lime, 'cloth');
    wrap(bone, g, y, ON + trim, 0.0024, C.tape, 'gloss');
  }

  zip(b);
  if (!hi) return;
  wrap('spine', WAIST, [HEM, HEM + 0.012], ON - 0.0002, 0.001, C.hem, 'cloth');
  pockets(b);
  chestKit(b);
  if (!b.hero) return;
  // Yoke seam and hanging loop on the back, side seams under the arms.
  b.add('chest', CHEST.panel({ y: [0.158, 0.162], a: [Math.PI - armhole(0.16) + 0.03, Math.PI + armhole(0.16) - 0.03], lift: ON, thick: 0.0008, seg: [16, 1] }), C.hem, { look: 'cloth' });
  b.box('chest', [0.03, 0.012, 0.004], C.hem, { ...CHEST.place(0.236, Math.PI, ON), look: 'cloth', bevel: 0.0015 });
  b.mirror((_, sign) => b.add('spine', WAIST.panel({ y: [HEM, 0.11], a: [sign * (Math.PI / 2 - 0.012), sign * (Math.PI / 2 + 0.012)], lift: ON, thick: 0.0008, seg: [1, 1] }), C.hem, { look: 'cloth' }));
}

function zip(b: PartSet) {
  const metal = '#8d949b';
  if (!b.hero) {
    b.box('chest', [0.009, 0.15, 0.006], metal, { ...CHEST.place(0.025, 0, ON), look: 'metal', bevel: 0 });
    b.box('spine', [0.009, 0.16, 0.006], metal, { ...WAIST.place(0.068, 0, ON), look: 'metal', bevel: 0 });
    return;
  }
  b.mirror((_, sign) => {
    const tape = (g: Garment, y: number) => [g.front(y, sign * 0.003), g.front(y, sign * 0.016)] as [number, number];
    b.add('chest', CHEST.panel({ ...span(SEAM, 0.1, (y) => tape(CHEST, y)), lift: ON, thick: 0.001, seg: [1, 4] }), C.dark, { look: 'cloth' });
    b.add('spine', WAIST.panel({ ...span(HEM, SEAM + RISE, (y) => tape(WAIST, y)), lift: ON, thick: 0.001, seg: [1, 1] }), C.dark, { look: 'cloth' });
  });
  // One run of teeth from the hem to the pull, each on the piece it sits on.
  for (let y = HEM + 0.004; y < 0.094 + RISE; y += 0.0085) {
    if (y < SEAM + RISE - 0.002) b.box('spine', [0.0075, 0.0045, 0.005], metal, { ...WAIST.place(y, 0, ON), look: 'metal', bevel: 0 });
    else b.box('chest', [0.0075, 0.0045, 0.005], metal, { ...CHEST.place(y - RISE, 0, ON), look: 'metal', bevel: 0 });
  }
  b.box('chest', [0.016, 0.02, 0.009], metal, { ...CHEST.place(0.1, 0, ON), look: 'metal', bevel: 0.003 });
  b.box('chest', [0.009, 0.03, 0.004], C.orange, { ...CHEST.place(0.079, 0, ON + 0.007, 0.25), look: 'rubber', bevel: 0.0015 });
}

/** Two flap pockets under the waist tape. */
function pockets(b: PartSet) {
  b.mirror((_, sign) => {
    const a = (x0: number, x1: number, y: number): [number, number] => [WAIST.front(y, sign * x0), WAIST.front(y, sign * x1)];
    b.add('spine', WAIST.panel({ y: [-0.008, 0.05], a: a(0.04, 0.132, 0.02), lift: ON, thick: 0.005, seg: [2, 1] }), C.orange, { look: 'cloth' });
    b.add('spine', WAIST.panel({ y: [0.03, 0.054], a: a(0.036, 0.136, 0.04), lift: ON + 0.005, thick: 0.003, seg: [2, 1] }), C.hem, { look: 'cloth' });
    if (b.hero) b.cyl('spine', 0.0055, 0.0055, 0.003, C.steel, { ...WAIST.stud(0.04, WAIST.front(0.04, sign * 0.086), ON + 0.0085), look: 'chrome', seg: 8 });
  });
}

/** Shirt collar, pen pocket, name badge and the radio on the shoulder strap. */
function chestKit(b: PartSet) {
  const hero = b.hero;
  // Polo collar spread over the vest, and the shirt's placket. It lies over the shoulder tape: finely cut and lifted
  // clear of it, or the tape's corners poke through its flat facets.
  b.mirror((_, sign) => {
    const wing = (y: number): [number, number] => [CHEST.front(y, sign * (neckX(y) - 0.004)), CHEST.front(y, sign * (neckX(y) + lerp(0.003, 0.036, (y - 0.168) / (TOP - 0.168))))];
    b.add('chest', CHEST.panel({ ...span(0.168, TOP, wing), lift: ON + (hero ? 0.0048 : 0.0034), thick: 0.004, seg: [tier(b, 1, 2, 6), tier(b, 2, 2, 8)] }), C.collar, { look: 'cloth' });
  });
  if (hero) for (const y of [0.15, 0.186]) b.cyl('chest', 0.0055, 0.0055, 0.004, '#c9d2dc', { at: [0, y, -0.107], rot: [Math.PI / 2, 0, 0], look: 'gloss', seg: 8 });

  // Pen pocket on his left: pencil, marker and a pen.
  const px = -0.045;
  const slot = (y: number, lift: number) => CHEST.place(y, CHEST.front(y, px), lift);
  b.box('chest', [0.058, 0.07, 0.006], C.orange, { ...slot(0.125, ON), look: 'cloth', bevel: hero ? 0.002 : 0 });
  b.box('chest', [0.062, 0.012, 0.008], C.hem, { ...slot(0.155, ON), look: 'cloth', bevel: hero ? 0.002 : 0 });
  for (const [dx, h, r, color] of [
    [-0.018, 0.045, 0.0048, C.yellow],
    [0, 0.036, 0.006, C.red],
    [0.018, 0.03, 0.0045, C.blue]
  ] as const) {
    const p = CHEST.place(0.16 + h / 2, CHEST.front(0.16, px + dx), ON + 0.006);
    b.cyl('chest', r, r, h, color, { ...p, look: 'gloss', seg: 6 });
    if (hero) b.cyl('chest', r * 0.8, r * 0.3, 0.01, dx < 0 ? '#e9c9a0' : C.dark, { ...p, at: [p.at[0], p.at[1] + h / 2 + 0.005, p.at[2]], look: 'plastic', seg: 6 });
  }

  // Name badge clipped to his right.
  const badge = (dx: number, dy: number, lift: number) => CHEST.place(0.118 + dy, CHEST.front(0.118, 0.045 + dx), ON + lift, -0.06);
  b.box('chest', [0.05, 0.062, 0.004], '#f4f1e8', { ...badge(0, 0, 0.003), look: 'gloss', bevel: hero ? 0.0015 : 0 });
  b.box('chest', [0.05, 0.014, 0.002], C.blue, { ...badge(0, 0.022, 0.0055), look: 'plastic', bevel: 0 });
  b.box('chest', [0.018, 0.022, 0.002], C.skin, { ...badge(-0.012, -0.004, 0.0055), look: 'plastic', bevel: 0 });
  if (hero) {
    for (const [dx, dy, w] of [
      [0.01, 0.002, 0.02],
      [0.01, -0.008, 0.02],
      [0, -0.022, 0.036]
    ] as const) {
      b.box('chest', [w, 0.004, 0.002], '#8b9299', { ...badge(dx, dy, 0.0055), look: 'plastic', bevel: 0 });
    }
  }
  b.box('chest', [0.016, 0.014, 0.008], C.steel, { ...CHEST.place(0.153, CHEST.front(0.153, 0.045), ON + 0.003), look: 'chrome', bevel: hero ? 0.002 : 0 });

  // Two-way radio on the right strap, antenna up past the shoulder.
  const r = CHEST.place(0.165, CHEST.front(0.165, 0.128), ON + 0.014);
  lump(b, 'chest', [0.05, 0.088, 0.03], tier(b, 6, 8, 14), C.dark, { ...r, look: 'rubber', e: 0.3 });
  b.cyl('chest', 0.005, 0.0065, 0.1, C.dark, { at: [r.at[0] + 0.014, r.at[1] + 0.09, r.at[2] + 0.004], look: 'rubber', seg: 6 });
  b.cyl('chest', 0.0075, 0.0075, 0.014, '#555c63', { at: [r.at[0] - 0.012, r.at[1] + 0.05, r.at[2] + 0.002], look: 'metal', seg: 6 });
  b.box('chest', [0.024, 0.016, 0.003], '#9fe6c4', { at: [r.at[0], r.at[1] - 0.024, r.at[2] - 0.0155], rot: r.rot, look: 'glow', bevel: 0 });
  if (!hero) return;
  for (let i = 0; i < 4; i++) b.box('chest', [0.03, 0.003, 0.003], '#14171a', { at: [r.at[0], r.at[1] + 0.022 - i * 0.009, r.at[2] - 0.0155], rot: r.rot, look: 'rubber', bevel: 0 });
  b.box('chest', [0.006, 0.024, 0.008], C.orange, { at: [r.at[0] - 0.026, r.at[1] + 0.01, r.at[2]], rot: r.rot, look: 'gloss', bevel: 0.002 });
}

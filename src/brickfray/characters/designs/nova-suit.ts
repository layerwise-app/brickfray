import * as THREE from 'three';
import type { Look, PartOptions, PartSet } from '../parts';
import { instep } from '../body-boots';
import { limbBand, limbRings, type LimbPart } from '../body-limbs';
import * as S from '../shapes';
import type { LoftRing } from '../shapes';
import type { BoneName, V3 } from '../skeleton';
import { loop, lump, pick, surface, sweep, TAU, type Surface } from './sheet';

export const C = {
  suit: '#eef0f4',
  shade: '#d4d8df',
  joint: '#aab1be',
  purple: '#7b4fd6',
  purpleDark: '#5a37a8',
  visor: '#e0a83a',
  dark: '#2e323d',
  chrome: '#e9edf1',
  cyan: '#7fe3ff',
  lamp: '#eef8ff',
  thrust: '#b48cff',
  lights: ['#58f0a0', '#ff5ab0', '#5ab8ff']
};

/** Bright satin metal: a mirror finish shows the studio's dark walls and reads near-black. */
const SHINE: Look = 'metal';
const HELMET: V3 = [0, 0.1, 0.002];
const HELMET_R = 0.176;
const ACROSS: V3 = [0, 0, Math.PI / 2];
const FACING: V3 = [Math.PI / 2, 0, 0];

function ring(b: PartSet, bone: BoneName, radius: number, tube: number, color: string, seg: number, o: PartOptions & { arc?: number } = {}) {
  b.add(bone, S.torus(radius, tube, tube < 0.006 ? pick(b, 4, 4, 6) : pick(b, 4, 4, 8), seg, o.arc), color, o);
}

/** Ribbed soft joint around a limb from y0 up to y1; `per` is the rings each rib is drawn with. */
export function bellows(b: PartSet, bone: BoneName, y0: number, y1: number, r0: number, r1: number, ribs: number, o: PartOptions & { depth?: number; seg?: number; per?: number } = {}) {
  const per = o.per ?? (b.hero ? 6 : 2);
  const profile: [number, number][] = [[r0 - 0.006, y0]];
  for (let i = 0; i <= ribs * per; i++) {
    const t = i / (ribs * per);
    profile.push([r0 + (r1 - r0) * t + (o.depth ?? 0.0075) * (0.5 - 0.5 * Math.cos(t * ribs * TAU)), y0 + (y1 - y0) * (0.04 + 0.92 * t)]);
  }
  profile.push([r1 - 0.006, y1]);
  b.lathe(bone, profile, C.joint, { look: 'rubber', seg: pick(b, 10, 10, 24), ...o });
}

/** Ribbed soft joint that follows one of the shared limbs' cross-sections from y0 up to y1, so it closes round the limb as a band. */
function limbBellows(b: PartSet, bone: BoneName, part: LimbPart, L: number, y0: number, y1: number, ribs: number, grow = 0.004) {
  const per = b.hero ? 6 : 2;
  const limb = limbRings(part, L);
  const at = (y: number, out: number): LoftRing => {
    const r = S.loftRingAt(limb, y);
    return { ...r, y, rx: r.rx + out, rz: r.rz + out, back: r.back + out };
  };
  const rings = [at(y0, -0.006)];
  for (let i = 0; i <= ribs * per; i++) {
    const t = i / (ribs * per);
    rings.push(at(y0 + (y1 - y0) * (0.04 + 0.92 * t), grow + 0.0075 * (0.5 - 0.5 * Math.cos(t * ribs * TAU))));
  }
  rings.push(at(y1, -0.006));
  const radial = pick(b, 10, 10, 24);
  b.add(bone, uncapped(S.loft(rings, radial), radial), C.joint, { look: 'rubber' });
}

/** A loft without the discs that close its ends: tucked inside the limb they only cost triangles. */
function uncapped(g: THREE.BufferGeometry, radial: number) {
  const keep = (g.getAttribute('position').count - radial * 6) * 3;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) out.setAttribute(name, new THREE.Float32BufferAttribute((g.getAttribute(name).array as Float32Array).slice(0, keep), 3));
  return out;
}

/** Part of a sphere with a rounded-rectangle outline, facing -Z, with a rim turned in toward the helmet. */
function visorPatch(radius: number, wide: number, tall: number, lift: number, around: number, rings: number, from = 0) {
  const f: Surface = (u, v) => {
    const t = Math.min(1, v);
    return inOutline(radius - (v - t) * 0.012, wide, tall, lift, u, t);
  };
  return surface(loop(around), [...Array.from({ length: rings + 1 }, (_, i) => from + ((1 - from) * i) / rings), 1.6], f, true);
}

/** Point on a sphere about the helmet's centre inside a rounded-rectangle outline: u turns around it, t runs from its middle to its edge. */
function inOutline(r: number, wide: number, tall: number, lift: number, u: number, t: number): V3 {
  const co = Math.cos(u * TAU);
  const si = Math.sin(u * TAU);
  const reach = t * (Math.abs(co / wide) ** 3.6 + Math.abs(si / tall) ** 3.6) ** (-1 / 3.6);
  const ax = reach * co;
  const ay = reach * si + lift;
  return [HELMET[0] + r * Math.sin(ax) * Math.cos(ay), HELMET[1] + r * Math.sin(ay), HELMET[2] - r * Math.cos(ax) * Math.cos(ay)];
}

/** Point on the gold visor, `out` proud of it: u turns around it from the character's right, t runs from its middle to its rim. */
export const onVisor = (u: number, t: number, out = 0) => inOutline(HELMET_R + 0.0055 + out, 0.98, 0.6, 0.03, u, t);

/** Point on the helmet at `ax` radians around and `ay` up from straight ahead, `out` off the shell. */
export function onHelmet(ax: number, ay: number, out: number): V3 {
  const r = HELMET_R + out;
  return [HELMET[0] + r * Math.sin(ax) * Math.cos(ay), HELMET[1] + r * Math.sin(ay), HELMET[2] - r * Math.cos(ax) * Math.cos(ay)];
}

/** Close up the visor is a sharp mirror; soft gold smears the studio's lights into blotches. */
export const VISOR = (b: PartSet): Look => (b.hero ? 'chrome' : 'gold');

/** Bubble helmet on the head bone: gold visor in a dark bezel, crest, ear modules with lamps, neck ring. */
export function helmet(b: PartSet) {
  const hi = b.detail > 1;
  // The bubble is the figure's silhouette: the lean low tier keeps the medium tier's shell and visor.
  const steps = b.lean ? 8 : pick(b, 8, 12, 28);
  const shell: [number, number][] = Array.from({ length: steps + 1 }, (_, i) => {
    const th = (i / steps) * Math.PI;
    return [Math.max(0, HELMET_R * Math.sin(th)), -HELMET_R * Math.cos(th)];
  });
  b.lathe('head', shell, C.suit, { at: HELMET, look: 'gloss', seg: b.lean ? 14 : pick(b, 14, 20, 56) });
  if (hi) b.add('head', visorPatch(HELMET_R + 0.0025, 1.06, 0.68, 0.03, pick(b, 16, 28, 64), 2, 0.84), C.dark, { look: 'gloss' });
  b.add('head', visorPatch(HELMET_R + (hi ? 0.0055 : 0.003), 0.98, 0.6, 0.03, b.lean ? 16 : pick(b, 16, 28, 64), pick(b, 3, 4, 10)), C.visor, { look: VISOR(b) });

  // Neck ring and its locking collar.
  b.lathe('neck', [[0.07, -0.034], [0.104, -0.03], [0.108, -0.012], [0.098, -0.004], [0.098, 0.02], [0.104, 0.026], [0.104, 0.04], [0.09, 0.05], [0.07, 0.05]], C.purple, { look: 'gloss', seg: pick(b, 12, 16, 40) });
  if (b.hero) ring(b, 'neck', 0.101, 0.006, C.chrome, 36, { at: [0, 0.008, 0], rot: FACING, look: SHINE });

  // Ear modules, each with a lamp looking forward.
  b.mirror((_, sign) => {
    const x = sign * (HELMET_R - 0.006);
    b.lathe('head', [[0, 0], [0.05, 0], [0.054, 0.006], [0.054, 0.02], [0.044, 0.03], [0, 0.03]], C.shade, { at: [x, 0.092, 0.012], rot: [0, 0, -sign * Math.PI / 2], look: 'plastic', seg: pick(b, 10, 14, 24) });
    if (!hi) return;
    b.cyl('head', 0.026, 0.03, 0.012, C.purple, { at: [x + sign * 0.034, 0.092, 0.012], rot: ACROSS, look: 'gloss', seg: pick(b, 8, 12, 20) });
    ring(b, 'head', 0.037, 0.004, C.cyan, pick(b, 10, 14, 24), { at: [x + sign * 0.031, 0.092, 0.012], rot: [0, Math.PI / 2, 0], look: 'glow' });
    b.cyl('head', 0.019, 0.022, 0.05, C.shade, { at: [x + sign * 0.012, 0.15, -0.03], rot: FACING, look: 'plastic', seg: pick(b, 8, 10, 16) });
    b.cyl('head', 0.015, 0.015, 0.006, C.lamp, { at: [x + sign * 0.012, 0.15, -0.057], rot: FACING, look: 'glow', seg: pick(b, 8, 10, 16) });
    if (b.hero) ring(b, 'head', 0.018, 0.0035, C.chrome, 16, { at: [x + sign * 0.012, 0.15, -0.056], look: SHINE });
  });

  if (!hi) return;
  // Crest over the crown and the vent block at the back.
  b.add('head', S.torus(HELMET_R + 0.001, 0.009, pick(b, 4, 5, 8), pick(b, 10, 14, 26), 2.05), C.purple, { at: HELMET, rot: [0, Math.PI / 2, 0.9], scale: [1, 1, 3.4], look: 'gloss' });
  lump(b, 'head', [0.12, 0.07, 0.05], C.shade, pick(b, 8, 8, 12), { at: [0, 0.03, 0.158], rot: [0.45, 0, 0], look: 'plastic', e: 0.4 });
  if (!b.hero) return;
  for (const x of [-0.035, 0, 0.035]) b.box('head', [0.022, 0.008, 0.006], C.dark, { at: [x, 0.036, 0.184], rot: [0.45, 0, 0], look: 'rubber', bevel: 0.001 });
  b.box('head', [0.03, 0.012, 0.008], C.purpleDark, { at: [0, 0.2, -0.141], rot: [-0.6, 0, 0], look: 'gloss', bevel: 0.002 });
  for (const [ax, ay] of [[-0.75, 0.62], [0, 0.72], [0.75, 0.62], [-0.75, -0.56], [0.75, -0.56]] as const) {
    b.add('head', S.sphere(0.0045, 6, 4), C.chrome, { at: onHelmet(ax, ay, 0.003), look: SHINE });
  }
  for (const ax of [-0.1, 0, 0.1]) b.box('head', [0.012, 0.03, 0.006], C.dark, { at: onHelmet(ax, -0.78, 0.001), rot: [0.78, -ax, 0], look: 'rubber', bevel: 0.002 });
}

/** Springy antenna on the swinging head bone and its socket on the helmet. */
export function antenna(b: PartSet) {
  const seg = pick(b, 6, 8, 12);
  b.cyl('dangleHead', 0.0045, 0.006, 0.2, C.chrome, { at: [0, 0.105, 0], look: SHINE, seg });
  b.add('dangleHead', S.sphere(0.017, pick(b, 8, 10, 16), pick(b, 6, 7, 12)), '#ff5ab0', { at: [0, 0.215, 0], look: 'glow' });
  b.cyl('dangleHead', 0.014, 0.019, 0.022, C.purple, { at: [0, 0.004, 0], look: 'gloss', seg: pick(b, 8, 10, 16) });
  if (b.detail < 2) return;
  for (const y of b.hero ? [0.022, 0.032, 0.042] : [0.024, 0.036]) ring(b, 'dangleHead', 0.009, 0.0035, C.chrome, pick(b, 8, 8, 14), { at: [0, y, 0], rot: FACING, look: SHINE });
  b.cyl('dangleHead', 0.007, 0.007, 0.008, C.chrome, { at: [0, 0.196, 0], look: SHINE, seg });
}

/** Chest control unit: display, dials, status lights, switches, and two hoses over the shoulders to the pack. */
export function chestUnit(b: PartSet) {
  const hi = b.detail > 1;
  const face = -0.152;
  b.box('chest', [0.2, 0.125, 0.056], C.shade, { at: [0, 0.07, -0.124], look: 'plastic', bevel: hi ? 0.012 : undefined });
  C.lights.forEach((color, i) => b.add('chest', S.sphere(0.0085, pick(b, 6, 6, 12), pick(b, 4, 4, 8)), color, { at: [-0.07 + i * 0.027, 0.066, face], look: 'glow' }));
  b.box('chest', [0.076, 0.034, 0.006], C.cyan, { at: [-0.045, 0.102, face], look: 'glow', bevel: 0 });
  if (!hi) return;
  b.box('chest', [0.088, 0.046, 0.006], C.dark, { at: [-0.045, 0.102, face + 0.0015], look: 'gloss', bevel: 0.003 });
  b.box('chest', [0.19, 0.012, 0.06], C.purple, { at: [0, 0.132, -0.124], look: 'gloss', bevel: 0.004 });
  const knob = pick(b, 8, 10, 18);
  for (const x of [0.036, 0.074]) {
    b.cyl('chest', 0.0155, 0.0155, 0.014, C.chrome, { at: [x, 0.1, face - 0.004], rot: FACING, look: SHINE, seg: knob });
    b.box('chest', [0.004, 0.016, 0.004], C.purple, { at: [x + (x > 0.05 ? 0.004 : -0.003), 0.104, face - 0.012], rot: [0, 0, x > 0.05 ? -0.6 : 0.5], look: 'gloss', bevel: 0 });
  }
  b.cyl('chest', 0.017, 0.019, 0.016, C.purple, { at: [-0.062, 0.032, face - 0.004], rot: FACING, look: 'gloss', seg: knob });
  for (const x of b.hero ? [0.02, 0.046, 0.072] : []) {
    b.box('chest', [0.014, 0.022, 0.006], C.dark, { at: [x, 0.058, face - 0.001], look: 'rubber', bevel: 0.002 });
    b.cyl('chest', 0.003, 0.004, 0.018, C.chrome, { at: [x, 0.062 + (x > 0.03 && x < 0.06 ? -0.008 : 0), face - 0.008], rot: [x > 0.03 && x < 0.06 ? 2.0 : 1.1, 0, 0], look: SHINE, seg: 6 });
  }
  b.box('chest', [0.07, b.hero ? 0.016 : 0.04, 0.006], C.suit, { at: [0.046, b.hero ? 0.03 : 0.044, face], look: 'plastic', bevel: 0.002 });

  // Hoses from the unit's top corners over the shoulders into the pack.
  b.mirror((_, sign) => {
    const path: V3[] = [
      [sign * 0.074, 0.128, -0.132],
      [sign * 0.094, 0.19, -0.128],
      [sign * 0.124, 0.258, -0.07],
      [sign * 0.127, 0.282, 0.02],
      [sign * 0.12, 0.262, 0.105],
      [sign * 0.11, 0.22, 0.135]
    ];
    // Corrugated: round between narrow grooves, sampled finely enough that the ribs do not turn into lumps.
    const along = pick(b, 10, 16, 132);
    const ribs = b.hero ? (t: number) => 0.0136 - 0.0018 * Math.max(0, Math.cos(t * 70)) ** 4 : () => 0.0125;
    b.add('chest', sweep(path, ribs, along, pick(b, 6, 6, 16)), sign < 0 ? C.purple : C.joint, { look: 'rubber' });
    b.cyl('chest', 0.017, 0.017, 0.022, C.chrome, { at: [sign * 0.076, 0.136, -0.132], rot: [0, 0, -sign * 0.3], look: SHINE, seg: knob });
  });
  if (!b.hero) return;
  for (let i = 0; i < 4; i++) b.box('chest', [0.006, 0.006 + i * 0.004, 0.004], C.dark, { at: [-0.066 + i * 0.012, 0.094 + i * 0.002, face - 0.0032], look: 'rubber', bevel: 0 });
  for (const [x, y] of [[-0.092, 0.122], [0.092, 0.122], [-0.092, 0.016], [0.092, 0.016]] as const) b.add('chest', S.sphere(0.0045, 6, 4), C.chrome, { at: [x, y, face + 0.002], look: SHINE });
}

/** Round mission patch: a ringed planet and a star on a purple field. */
function missionPatch(b: PartSet, bone: BoneName, at: V3, out: V3, radius: number) {
  const seg = pick(b, 10, 10, 24);
  const turn: V3 = [0, Math.atan2(out[0], out[2]), 0];
  const lift = (d: number, dx = 0, dy = 0): V3 => [at[0] + out[0] * d + out[2] * dx, at[1] + dy, at[2] + out[2] * d - out[0] * dx];
  b.cyl(bone, radius, radius, 0.014, C.purple, { at: lift(-0.004), rot: [Math.PI / 2, turn[1], 0], look: 'gloss', seg });
  ring(b, bone, radius, 0.0035, C.visor, seg, { at: lift(0.003), rot: turn, look: 'gold' });
  b.add(bone, S.sphere(radius * 0.36, pick(b, 6, 6, 12), pick(b, 4, 4, 8)), C.suit, { at: lift(0.003, -radius * 0.1, -radius * 0.08), scale: [1, 1, 1], look: 'gloss' });
  ring(b, bone, radius * 0.56, 0.0028, C.visor, seg, { at: lift(0.005, -radius * 0.1, -radius * 0.08), rot: [turn[0] + 1.15, turn[1], 0.35], look: 'gold' });
  if (b.hero) b.add(bone, S.sphere(radius * 0.11, 6, 4), C.lamp, { at: lift(0.005, radius * 0.5, radius * 0.45), look: 'glow' });
}

/** Life-support pack on the back: shell, panel with vents and lights, side tanks, thrusters, handle and beacon. */
export function pack(b: PartSet) {
  const hi = b.detail > 1;
  const back = 0.252;
  if (hi) lump(b, 'chest', [0.34, 0.43, 0.16], C.suit, pick(b, 10, 12, 20), { at: [0, 0.095, 0.172], look: 'plastic', e: 0.32 });
  else b.box('chest', [0.33, 0.42, 0.15], C.suit, { at: [0, 0.095, 0.172], look: 'plastic' });
  b.box('chest', [0.2, 0.13, 0.014], C.purple, { at: [0, 0.19, back - 0.002], look: 'gloss', bevel: hi ? 0.005 : undefined });
  C.lights.forEach((color, i) => b.add('chest', S.sphere(0.011, pick(b, 6, 6, 12), pick(b, 4, 4, 8)), color, { at: [-0.05 + i * 0.05, 0.095, back], look: 'glow' }));

  // Side tanks.
  b.mirror((_, sign) => {
    const x = sign * 0.192;
    const r = 0.042;
    const half = 0.115;
    const cap = pick(b, 2, 3, 6);
    const tank: [number, number][] = [];
    for (let i = 0; i <= cap; i++) tank.push([Math.max(0, r * Math.sin((i / cap) * (Math.PI / 2))), -half - r * Math.cos((i / cap) * (Math.PI / 2))]);
    for (let i = 0; i <= cap; i++) tank.push([Math.max(0, r * Math.cos((i / cap) * (Math.PI / 2))), half + r * Math.sin((i / cap) * (Math.PI / 2))]);
    b.lathe('chest', tank, C.shade, { at: [x, 0.075, 0.165], look: 'gloss', seg: pick(b, 8, 12, 22) });
    if (!hi) return;
    for (const y of [-0.01, 0.16]) b.cyl('chest', r + 0.003, r + 0.003, 0.02, C.purple, { at: [x, y, 0.165], look: 'gloss', seg: pick(b, 8, 12, 22), open: true });
    b.cyl('chest', 0.013, 0.016, 0.03, C.chrome, { at: [x, 0.245, 0.165], look: SHINE, seg: pick(b, 6, 8, 12) });
    if (b.hero) b.cyl('chest', 0.02, 0.02, 0.008, C.purple, { at: [x, 0.262, 0.165], look: 'gloss', seg: 12 });
  });
  if (!hi) return;

  lump(b, 'chest', [0.25, 0.05, 0.12], C.purple, pick(b, 8, 8, 14), { at: [0, 0.31, 0.168], look: 'gloss', e: 0.4 });
  for (let i = 0; i < (b.hero ? 5 : 3); i++) b.box('chest', [0.15, 0.008, 0.006], C.dark, { at: [0, 0.165 + i * (b.hero ? 0.016 : 0.028), back + 0.006], look: 'rubber', bevel: 0 });
  missionPatch(b, 'chest', [0, 0.005, back], [0, 0, 1], 0.045);
  if (b.hero) {
    for (const x of [-0.088, 0.088]) for (const y of [0.137, 0.243]) b.add('chest', S.sphere(0.005, 6, 4), C.chrome, { at: [x, y, back + 0.006], look: SHINE });
    b.cyl('chest', 0.02, 0.02, 0.008, C.dark, { at: [0.105, 0.03, back], rot: FACING, look: 'gloss', seg: 16 });
    b.cyl('chest', 0.015, 0.015, 0.01, C.cyan, { at: [0.105, 0.03, back + 0.001], rot: FACING, look: 'glow', seg: 14 });
    b.box('chest', [0.003, 0.014, 0.004], C.dark, { at: [0.108, 0.034, back + 0.006], rot: [0, 0, -0.7], look: 'rubber', bevel: 0 });
  }

  // Thrusters under the pack.
  b.mirror((_, sign) => {
    const at: V3 = [sign * 0.085, -0.118, 0.185];
    const seg = pick(b, 8, 10, 20);
    b.lathe('chest', [[0.04, -0.056], [0.038, -0.046], [0.024, -0.008], [0.02, 0.004], [0, 0.004]], C.dark, { at, look: 'metal', seg });
    b.lathe('chest', [[0, -0.014], [0.018, -0.016], [0.034, -0.05], [0.04, -0.056]], C.dark, { at, look: 'metal', seg });
    b.cyl('chest', 0.022, 0.022, 0.004, C.thrust, { at: [at[0], at[1] - 0.022, at[2]], look: 'glow', seg });
    if (b.hero) ring(b, 'chest', 0.04, 0.004, C.purple, 20, { at: [at[0], at[1] - 0.054, at[2]], rot: FACING, look: 'gloss' });
  });

  // Carry handle and a beacon.
  ring(b, 'chest', 0.045, 0.007, C.chrome, pick(b, 8, 10, 18), { at: [0, 0.328, 0.18], arc: Math.PI, look: SHINE });
  b.cyl('chest', 0.005, 0.007, 0.07, C.chrome, { at: [-0.1, 0.36, 0.2], look: SHINE, seg: 6 });
  b.add('chest', S.sphere(0.011, 8, 5), '#ff5a5a', { at: [-0.1, 0.4, 0.2], look: 'glow' });
}

/** Arm furniture: shoulder bearing on the chest, band, elbow bellows, wrist ring; a patch per arm and the wrist computer. */
export function arm(b: PartSet, side: 'L' | 'R', sign: number, L: number) {
  const hi = b.detail > 1;
  const ua = `upperArm${side}` as const;
  const fa = `forearm${side}` as const;
  const seg = pick(b, 10, 12, 22);
  if (hi) ring(b, 'chest', 0.079 * L * 0.9, 0.011, C.purple, pick(b, 12, 16, 28), { at: [sign * 0.168, 0.19, 0], rot: [0, Math.PI / 2, 0], look: 'gloss' });
  else b.cyl(ua, 0.066 * L, 0.066 * L, 0.03, C.purple, { at: [0, -0.02, 0], look: 'gloss', seg, open: true });
  b.add(fa, limbBand(b, 'forearm', L, -0.199, -0.173, 0.0032), C.purple, { look: 'gloss' });
  if (!hi) return;
  limbBellows(b, ua, 'upperArm', L, -0.268, -0.196, 3);
  limbBellows(b, fa, 'forearm', L, -0.092, -0.03, 2);
  b.lathe(fa, [[0.041 * L, -0.214], [0.0475 * L, -0.211], [0.0475 * L, -0.2], [0.041 * L, -0.197]], C.chrome, { look: SHINE, seg });
  if (side === 'L') {
    missionPatch(b, ua, [-0.058 * L, -0.078, 0], [-1, 0, 0], 0.027);
    // Wrist computer.
    const x = -0.052 * L;
    b.box(fa, [0.016, 0.078, 0.056], C.shade, { at: [x, -0.135, -0.004], look: 'plastic', bevel: 0.005 });
    b.box(fa, [0.004, 0.044, 0.04], C.cyan, { at: [x - 0.008, -0.126, -0.004], look: 'glow', bevel: 0 });
    for (const z of [-0.016, -0.004, 0.008]) b.box(fa, [0.006, 0.008, 0.008], z ? C.purple : '#ff5ab0', { at: [x - 0.008, -0.163, z], look: 'gloss', bevel: 0.001 });
  } else {
    // Three-stripe flash on the right shoulder.
    [C.purple, C.suit, C.visor].forEach((color, i) => b.box(ua, [0.006, 0.012, 0.05], color, { at: [0.062 * L, -0.045 - i * 0.014, 0], look: i === 2 ? 'gold' : 'gloss', bevel: 0.002 }));
  }
}

/** Leg furniture: thigh pocket, knee bellows and pad, shin band and the boot's locking ring. */
export function leg(b: PartSet, side: 'L' | 'R', sign: number, L: number) {
  const hi = b.detail > 1;
  const th = `thigh${side}` as const;
  const sh = `shin${side}` as const;
  const ft = `foot${side}` as const;
  const seg = pick(b, 10, 12, 22);
  lump(b, sh, [0.1 * L, 0.1, 0.05], C.purple, pick(b, 8, 10, 16), { at: [0, 0.002, -0.052 * L], look: 'gloss', e: 0.55 });
  if (!hi) {
    b.lathe(ft, [[0.062 * L, 0.05], [0.07 * L, 0.054], [0.0715 * L, 0.078], [0.066 * L, 0.086], [0.058 * L, 0.086]], C.purple, { at: [0, 0, 0.003], look: 'gloss', seg });
    return;
  }
  sealedBoot(b, ft, L, seg);
  limbBellows(b, th, 'thigh', L, -0.418, -0.345, 3);
  b.add(th, limbBand(b, 'thigh', L, -0.321, -0.299, 0.0045), C.purple, { look: 'gloss' });
  limbBellows(b, sh, 'shin', L, -0.1, -0.036, 2);
  b.box(th, [0.02, 0.1, 0.085], C.suit, { at: [sign * 0.08 * L, -0.2, 0], look: 'plastic', bevel: 0.006 });
  b.box(th, [0.022, 0.03, 0.089], C.purple, { at: [sign * 0.081 * L, -0.16, 0], look: 'gloss', bevel: 0.004 });
  b.add(th, S.sphere(0.006, 6, 4), C.chrome, { at: [sign * 0.093 * L, -0.166, 0], look: SHINE });
  if (!b.hero) return;
  for (const x of [-0.03, 0.03]) b.add(sh, S.sphere(0.006, 6, 4), C.chrome, { at: [x * L, 0.026, -0.076 * L], look: SHINE });
  b.box(sh, [0.05, 0.01, 0.006], C.thrust, { at: [0, -0.018, -0.079 * L], look: 'glow', bevel: 0 });
}

/** What seals the boot to the suit leg: a two-part locking ring with latches, and a ribbed flex panel over the instep. */
function sealedBoot(b: PartSet, ft: 'footL' | 'footR', L: number, seg: number) {
  const r = 0.0715 * L;
  const collar: [number, number][] = b.hero
    ? [[0.06 * L, 0.046], [r - 0.002, 0.048], [r, 0.052], [r, 0.061], [r - 0.0045, 0.063], [r - 0.0045, 0.069], [r + 0.001, 0.071], [r + 0.001, 0.082], [r - 0.004, 0.088], [0.058 * L, 0.088]]
    : [[0.062 * L, 0.05], [r - 0.0015, 0.054], [r, 0.078], [r - 0.0055, 0.086], [0.058 * L, 0.086]];
  b.lathe(ft, collar, C.purple, { at: [0, 0, 0.003], look: 'gloss', seg });
  ring(b, ft, b.hero ? r - 0.003 : r - 0.001, b.hero ? 0.0036 : 0.005, C.chrome, pick(b, 12, 14, 26), { at: [0, 0.066, 0.003], rot: FACING, look: 'metal' });
  for (const forward of b.hero ? [0.04, 0.059, 0.078, 0.097] : [0.046, 0.08]) {
    const { y, pitch } = instep(forward);
    lump(b, ft, [0.092, 0.017, b.hero ? 0.023 : 0.038], C.joint, pick(b, 6, 6, 10), { at: [0, y - 0.0045, -forward], rot: [pitch, 0, 0], look: 'rubber', e: 0.5 });
  }
  if (!b.hero) return;
  for (const a of [0.7, -0.7, Math.PI]) {
    const out: V3 = [Math.sin(a), 0, -Math.cos(a)];
    b.box(ft, [0.02, 0.03, 0.009], C.shade, { at: [out[0] * (r + 0.003), 0.066, 0.003 + out[2] * (r + 0.003)], rot: [0, -a, 0], look: 'plastic', bevel: 0.003 });
    b.box(ft, [0.01, 0.008, 0.006], a === Math.PI ? C.thrust : C.purpleDark, { at: [out[0] * (r + 0.0075), 0.07, 0.003 + out[2] * (r + 0.0075)], rot: [0, -a, 0], look: a === Math.PI ? 'glow' : 'gloss', bevel: 0.002 });
  }
}

/** Ribbed waist in place of the body's abdomen, and belt hardware: D-rings, a tool pouch and a tether reel. */
export function waist(b: PartSet, bulk: number) {
  const r = 0.139 * bulk;
  bellows(b, 'spine', -0.062, 0.142, r, r + 0.008, b.detail > 1 ? 5 : 4, { depth: 0.014, scale: [1, 1, 0.63], seg: pick(b, 12, 16, 32), per: pick(b, 2, 3, 6) });
  if (b.detail < 2) return;
  b.mirror((_, sign) => ring(b, 'pelvis', 0.014, 0.004, C.chrome, pick(b, 8, 10, 16), { at: [sign * 0.09, 0.012, -0.113], rot: [0.2, 0, 0], look: SHINE }));
  b.box('pelvis', [0.03, 0.08, 0.075], C.suit, { at: [0.185, -0.012, 0.01], look: 'plastic', bevel: 0.006 });
  b.box('pelvis', [0.034, 0.028, 0.079], C.purple, { at: [0.186, 0.02, 0.01], look: 'gloss', bevel: 0.004 });
  b.cyl('pelvis', 0.032, 0.032, 0.026, C.shade, { at: [-0.184, 0.004, 0.02], rot: ACROSS, look: 'plastic', seg: pick(b, 10, 12, 20) });
  b.cyl('pelvis', 0.014, 0.014, 0.032, C.purple, { at: [-0.186, 0.004, 0.02], rot: ACROSS, look: 'gloss', seg: pick(b, 6, 8, 12) });
}

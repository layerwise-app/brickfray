import * as THREE from 'three';
import type { Look, PartSet } from '../parts';
import * as S from '../shapes';
import type { BoneName, V3 } from '../skeleton';
import { cloakAt, hoodAt, leaf, mantleAt } from './moss-cloth';
import { buildHatchet } from '../../weapons/models/hatchet';
import { sweep } from './plate-fittings';
import { lump, pick } from './sheet';
import { stow } from './stowed';

export const C = {
  cloak: '#4f7a3a',
  cloakDark: '#3d6230',
  lining: '#273b21',
  hoodLining: '#4b6f41',
  tunic: '#6b6e3a',
  tunicDark: '#55582d',
  leaf: '#8aa13f',
  leaf2: '#a6c629',
  beard: '#8a5a32',
  beardLight: '#a36e3d',
  leather: '#6e4a2f',
  leatherLight: '#8a6340',
  leatherDark: '#4a3220',
  tan: '#b09a72',
  tanDark: '#8f7a56',
  brass: '#c9a24a',
  copper: '#b5683a',
  steel: '#a0a6ab',
  thread: '#dccba0',
  sash: '#c68c2b',
  sashDark: '#9c6c1d',
  pantsDark: '#333c2b',
  feather: '#ece2c8',
  featherTip: '#5b4630'
};

/** Leather has a soft sheen; a fully matte look veils it grey-pink under the studio key. */
export const HIDE: Look = 'skin';

const STRAP_TILT = -0.62;
/** The chest's front leans out toward the top; the strap lies on it. */
const STRAP_LEAN = 0.1;
const m = new THREE.Matrix4();
const e = new THREE.Euler();
const x = new THREE.Vector3();
const y = new THREE.Vector3();
const z = new THREE.Vector3();

/** Rotation that points a part's +Y along `up` with its +Z face toward `face`. */
function aim(up: V3, face: V3): V3 {
  y.set(...up).normalize();
  z.set(...face);
  z.addScaledVector(y, -z.dot(y)).normalize();
  x.crossVectors(y, z);
  e.setFromRotationMatrix(m.makeBasis(x, y, z), 'YXZ');
  return [e.x, e.y, e.z];
}

const along = (from: V3, dir: V3, d: number): V3 => [from[0] + dir[0] * d, from[1] + dir[1] * d, from[2] + dir[2] * d];

/** Row of stitches from one point to another. */
function stitches(b: PartSet, bone: BoneName, from: V3, to: V3, count: number) {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(...d);
  const rot: V3 = [-Math.asin(d[1] / len), Math.atan2(d[0], d[2]), 0];
  for (let i = 0; i < count; i++) b.box(bone, [0.0034, 0.0034, (len / count) * 0.55], C.thread, { at: along(from, d, (i + 0.5) / count), rot, look: 'cloth', bevel: 0 });
}

/** Stitches around a limb at height y. */
function stitchRing(b: PartSet, bone: BoneName, radius: number, at: number, count: number) {
  for (let i = 0; i < count; i++) {
    const al = (i / count) * Math.PI * 2;
    b.box(bone, [0.0034, 0.0034, 0.012], C.thread, { at: [Math.sin(al) * radius, at, Math.cos(al) * radius], rot: [0, al + Math.PI / 2, 0], look: 'cloth', bevel: 0 });
  }
}

/** Point on the chest strap: `s` along it from the chest's middle, `off` across it. */
function onStrap(s: number, off: number, out = 0): V3 {
  const dx = -Math.sin(STRAP_TILT);
  const dy = Math.cos(STRAP_TILT);
  const up = dy * s - dx * off;
  return [dx * s + dy * off, 0.07 + up, -0.112 - out - STRAP_LEAN * up];
}

/** Chest strap from under the mantle to the satchel, with rifle rounds in loops. */
export function bandolier(b: PartSet) {
  b.box('chest', [0.042, 0.34, 0.012], C.leather, { at: onStrap(-0.06, 0), rot: [-STRAP_LEAN, 0, STRAP_TILT], look: HIDE });
  b.box('chest', [0.042, 0.3, 0.01], C.leather, { at: [0.035, 0.03, 0.104], rot: [0, 0, -STRAP_TILT], look: HIDE });
  // The strap's run from the chest round the waist to the satchel on the hip.
  const run: V3[] = [
    [-0.112, 0.092, -0.1],
    [-0.147, 0.04, -0.088],
    [-0.168, -0.004, -0.05],
    [-0.178, -0.04, 0.004]
  ];
  b.add('spine', sweep(run, () => [0.021, 0.0055], { seg: pick(b, 3, 4, 8), radial: pick(b, 4, 4, 8), up: [-0.75, 0, -0.66], caps: b.hero }), C.leather, { look: HIDE });
  if (b.detail < 2) return;
  const across: V3 = [-STRAP_LEAN, 0, STRAP_TILT + Math.PI / 2];
  const seg = pick(b, 5, 6, 10);
  for (const s of b.hero ? [-0.03, -0.068, -0.106, -0.144] : [-0.04, -0.085, -0.13]) {
    b.cyl('chest', 0.0078, 0.0078, 0.048, C.brass, { at: onStrap(s, 0.003, 0.014), rot: across, look: 'gold', seg });
    if (b.hero) b.cyl('chest', 0.002, 0.0074, 0.014, C.copper, { at: onStrap(s, -0.027, 0.014), rot: across, look: 'metal', seg });
    b.box('chest', [0.024, 0.022, 0.02], C.leatherDark, { at: onStrap(s, 0.003, 0.012), rot: [-STRAP_LEAN, 0, STRAP_TILT], look: HIDE, bevel: b.hero ? 0.004 : 0 });
  }
  // Buckle where the strap is let out.
  b.box('chest', [0.054, 0.036, 0.008], C.steel, { at: onStrap(-0.192, 0, 0.007), rot: [-STRAP_LEAN, 0, STRAP_TILT], look: 'metal', bevel: 0.004 });
  if (!b.hero) return;
  b.box('chest', [0.036, 0.02, 0.01], C.leather, { at: onStrap(-0.192, 0, 0.008), rot: [-STRAP_LEAN, 0, STRAP_TILT], look: HIDE, bevel: 0.002 });
  b.box('chest', [0.005, 0.03, 0.006], C.steel, { at: onStrap(-0.192, 0, 0.014), rot: across, look: 'metal', bevel: 0.001 });
  for (const off of [-0.016, 0.016]) stitches(b, 'chest', onStrap(-0.17, off, 0.0068), onStrap(0.0, off, 0.0068), 20);
}

/** Satchel on the left hip with a buckled flap, hanging from the chest strap. */
export function satchel(b: PartSet) {
  const sx = -0.214;
  const sz = 0.014;
  if (b.detail < 2) {
    b.box('pelvis', [0.072, 0.15, 0.19], C.leather, { at: [sx, -0.05, sz], look: HIDE });
    b.box('pelvis', [0.03, 0.085, 0.196], C.leatherLight, { at: [sx - 0.028, -0.014, sz], look: HIDE });
    return;
  }
  const seg = pick(b, 8, 8, 14);
  lump(b, 'pelvis', [0.078, 0.15, 0.2], C.leather, seg, { at: [sx, -0.05, sz], look: HIDE, e: 0.38 });
  lump(b, 'pelvis', [0.034, 0.1, 0.208], C.leatherLight, seg, { at: [sx - 0.03, -0.012, sz], look: HIDE, e: 0.42, taper: 0.15 });
  b.box('pelvis', [0.016, 0.11, 0.04], C.leather, { at: [sx + 0.03, 0.07, sz], rot: [0, 0, 0.3], look: HIDE });
  b.box('pelvis', [0.01, 0.075, 0.03], C.leatherDark, { at: [sx - 0.049, -0.045, sz], look: HIDE, bevel: 0.003 });
  b.box('pelvis', [0.012, 0.024, 0.04], C.steel, { at: [sx - 0.052, -0.058, sz], look: 'metal', bevel: 0.004 });
  if (!b.hero) return;
  for (const dz of [-0.097, 0.097]) stitches(b, 'pelvis', [sx - 0.046, 0.03, sz + dz], [sx - 0.046, -0.05, sz + dz], 8);
  for (const dz of [-0.058, 0.058]) stitches(b, 'pelvis', [sx - 0.0475, -0.057, sz + dz - 0.034], [sx - 0.0475, -0.057, sz + dz + 0.034], 6);
  b.box('pelvis', [0.006, 0.008, 0.02], C.steel, { at: [sx - 0.058, -0.058, sz], look: 'metal', bevel: 0.001 });
}

/** Belt pouches on the right hip. */
export function pouches(b: PartSet) {
  const spots: [number, number, number][] = [
    [0.176, -0.012, 0.08],
    [0.15, -0.085, 0.062]
  ];
  const seg = pick(b, 6, 6, 10);
  for (const [px, pz, size] of b.hero ? spots : spots.slice(0, 1)) {
    const turn = Math.atan2(px, pz * 1.6);
    const out: V3 = [Math.sin(turn), 0, Math.cos(turn)];
    lump(b, 'pelvis', [size, 0.085, 0.05], C.leather, seg, { at: [px, -0.014, pz], rot: [0, turn, 0], look: HIDE, e: 0.42 });
    lump(b, 'pelvis', [size + 0.006, 0.05, 0.056], C.leatherLight, seg, { at: [px, 0.006, pz], rot: [0, turn, 0], look: HIDE, e: 0.42, taper: 0.25 });
    b.add('pelvis', S.sphere(0.007, 6, 4), C.brass, { at: along([px, -0.01, pz], out, 0.029), look: 'gold' });
  }
}

/** Rolled blanket strapped across the shoulders, over the cloak's top edge. */
export function bedroll(b: PartSet) {
  const at: V3 = [0, 0.165, 0.17];
  const across: V3 = [0, 0, Math.PI / 2];
  const seg = pick(b, 10, 12, 22);
  b.cyl('chest', 0.052, 0.052, 0.4, C.tan, { at, rot: across, look: 'cloth', seg });
  for (const bx of [-0.115, 0.115]) {
    b.cyl('chest', 0.0545, 0.0545, 0.026, C.leatherDark, { at: [bx, at[1], at[2]], rot: across, look: HIDE, seg, open: true });
    if (b.hero) b.box('chest', [0.03, 0.022, 0.008], C.steel, { at: [bx, at[1] + 0.012, at[2] + 0.055], rot: [0.25, 0, 0], look: 'metal', bevel: 0.003 });
  }
  b.mirror((_, sign) => {
    b.cyl('chest', 0.036, 0.036, 0.01, C.tanDark, { at: [sign * 0.2, at[1], at[2]], rot: across, look: 'cloth', seg: pick(b, 8, 8, 16) });
    if (!b.hero) return;
    b.cyl('chest', 0.022, 0.022, 0.01, C.tan, { at: [sign * 0.204, at[1], at[2]], rot: across, look: 'cloth', seg: 12 });
    b.cyl('chest', 0.009, 0.009, 0.01, C.tanDark, { at: [sign * 0.208, at[1], at[2]], rot: across, look: 'cloth', seg: 8 });
  });
  if (b.hero) b.box('chest', [0.39, 0.006, 0.012], C.tanDark, { at: [0, at[1] - 0.02, at[2] + 0.049], rot: [0.4, 0, 0], look: 'cloth', bevel: 0.002 });
}

/** The hatchet riding on top of the bedroll, head out past his left shoulder with the bit hanging down, under a loop off each strap. */
export function hatchetOnPack(b: PartSet) {
  const at: V3 = [0.03, 0.229, 0.2];
  stow(b, 'chest', buildHatchet, at, [-Math.PI / 2, 0, Math.PI / 2]);
  for (const [x, r] of [[-0.115, 0.0185], [0.115, 0.0215]] as const) b.cyl('chest', r, r, 0.022, C.leatherDark, { at: [x, at[1], at[2]], rot: [0, 0, Math.PI / 2], look: HIDE, seg: 12, open: true });
}

/** Leather bracer on a forearm: flared cuff, two buckled straps, lacing. */
export function bracer(b: PartSet, side: 'L' | 'R', sign: number) {
  const bone = `forearm${side}` as const;
  const seg = pick(b, 10, 12, 20);
  const r = (at: number) => 0.0575 + (at + 0.09) * 0.045;
  b.lathe(bone, [[0.044, -0.216], [0.05, -0.212], [r(-0.2), -0.2], [r(-0.09), -0.09], [r(-0.09) - 0.003, -0.078], [0.049, -0.075]], C.leather, { look: HIDE, seg });
  if (b.detail < 2) return;
  for (const at of [-0.108, -0.182]) {
    b.cyl(bone, r(at) + 0.003, r(at) + 0.0022, 0.018, C.leatherDark, { at: [0, at, 0], look: HIDE, seg, open: true });
    b.box(bone, [0.008, 0.024, 0.026], C.steel, { at: [sign * (r(at) + 0.0035), at, 0], look: 'metal', bevel: b.hero ? 0.003 : 0 });
  }
  if (!b.hero) return;
  for (let i = 0; i < 4; i++) {
    const at = -0.126 - i * 0.013;
    b.box(bone, [0.028, 0.004, 0.005], C.thread, { at: [0, at, -r(at) - 0.001], rot: [0, 0, i % 2 ? 0.5 : -0.5], look: 'cloth', bevel: 0 });
  }
  stitchRing(b, bone, r(-0.2) + 0.0006, -0.203, 12);
  stitchRing(b, bone, r(-0.09) + 0.0006, -0.087, 12);
}

/** Knee patch, cloth leg wraps and a folded boot cuff on a shin. */
export function legWraps(b: PartSet, side: 'L' | 'R') {
  const bone = `shin${side}` as const;
  const seg = pick(b, 10, 12, 18);
  const r = (at: number) => 0.049 + (at + 0.26) * (at < -0.26 ? 0.04 : 0.081) + 0.003;
  const h = b.detail > 1 ? 0.034 : 0.05;
  (b.detail > 1 ? [-0.277, -0.247, -0.217, -0.187] : [-0.266, -0.218]).forEach((at, i) => {
    b.cyl(bone, r(at + h / 2), r(at - h / 2) + 0.002, h, i % 2 ? C.tanDark : C.tan, { at: [0, at, 0.003], scale: [1, 1, 1.04], look: 'cloth', seg, open: true });
  });
  b.lathe(bone, [[0.056, -0.347], [0.0695, -0.34], [0.073, -0.308], [0.068, -0.291], [0.056, -0.295]], C.leatherLight, { look: HIDE, seg });
  if (b.detail < 2) return;
  lump(b, bone, [0.098, 0.1, 0.05], C.leather, pick(b, 8, 8, 12), { at: [0, -0.004, -0.045], look: HIDE, e: 0.55 });
  if (!b.hero) return;
  stitchRing(b, bone, 0.0735, -0.314, 12);
  for (const sx of [-0.03, 0.03]) stitches(b, bone, [sx, 0.03, -0.0665], [sx, -0.04, -0.0665], 6);
  // Thong crossed over the wraps.
  for (const lean of [-1, 1]) b.add(bone, S.torus(0.0565, 0.003, 5, 22), C.leatherDark, { at: [0, -0.232, 0.003], rot: [Math.PI / 2 + lean * 0.3, Math.PI / 2, 0], scale: [1, 1.04, 1], look: HIDE });
}

/** Bronze leaf clasp at the throat with two cords and acorn beads. */
export function clasp(b: PartSet) {
  const [, cy, cz] = mantleAt(0, 0.42);
  b.add('chest', S.torus(0.021, 0.0065, pick(b, 4, 4, 6), pick(b, 10, 10, 18)), C.brass, { at: [0, cy, cz - 0.006], rot: [0.5, 0, 0], look: 'gold' });
  b.add('chest', S.sphere(0.0085, pick(b, 6, 6, 10), pick(b, 4, 4, 7)), '#3fae62', { at: [0, cy, cz - 0.011], look: 'gloss' });
  b.mirror((_, sign) => {
    const from: V3 = [sign * 0.014, cy - 0.014, cz - 0.008];
    const to: V3 = [sign * 0.034, cy - 0.1, cz - 0.03];
    const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    b.cyl('chest', 0.0038, 0.0038, Math.hypot(...d), C.leatherDark, { at: along(from, d, 0.5), rot: aim(d, [0, 0, -1]), look: HIDE, seg: 6 });
    lump(b, 'chest', [0.017, 0.026, 0.017], C.brass, pick(b, 6, 6, 8), { at: [to[0], to[1] - 0.01, to[2]], look: 'gold', e: 0.9, taper: 0.3 });
    if (b.hero) b.add('chest', S.dome(0.0095, 8, 3), C.leather, { at: [to[0], to[1] - 0.004, to[2]], look: HIDE });
  });
}

/** Stitching inside the mantle's dagged edge. */
export function mantleStitches(b: PartSet) {
  const at = (u: number): V3 => {
    const [px, py, pz] = mantleAt(u, 0.84);
    return [px * 1.014, py + 0.0035, pz * 1.014];
  };
  for (let i = 0; i < 52; i++) stitches(b, 'chest', at((i + 0.2) / 52), at((i + 0.75) / 52), 1);
}

/** Sewn-on leaves down the cloak's pleats. */
export function cloakLeaves(b: PartSet) {
  const spots: [number, number, number, string][] = [
    [0.5, 0.22, 0.5, C.leaf],
    [0.72, 0.42, -0.6, C.leaf2],
    [0.28, 0.5, 0.9, C.leaf],
    [0.55, 0.7, -0.3, C.leaf2],
    [0.83, 0.74, 0.4, C.leaf],
    [0.17, 0.8, -0.8, C.leaf2]
  ];
  for (const [u, v, turn, color] of spots.slice(0, pick(b, 3, 4, 6))) {
    b.add('dangleBack', leaf(0.1, 0.06, pick(b, 2, 3, 5)), color, { at: cloakAt(0.007)(u, v), rot: [-0.06, 0, Math.PI + turn], look: 'cloth' });
  }
}

/** A feather and a sprig of leaves tucked into the hood on the left. */
export function hoodSprig(b: PartSet) {
  const at = hoodAt(0.003)(0.79, 0.24);
  const out: V3 = [-1, 0.25, 0.1];
  const up: V3 = [-0.18, 0.72, 0.67];
  const quill = aim(up, out);
  b.add('head', leaf(0.2, 0.046, pick(b, 4, 4, 8), 0.2), C.feather, { at: along(at, up, 0.1), rot: quill, look: 'cloth' });
  b.add('head', leaf(0.07, 0.04, 3, 0.1), C.featherTip, { at: along(along(at, up, 0.168), out, 0.006), rot: quill, look: 'cloth' });
  b.add('head', leaf(0.09, 0.055, pick(b, 3, 3, 5)), C.leaf2, { at: along(at, [0.1, 0.5, -0.85], 0.04), rot: aim([0.1, 0.5, -0.85], out), look: 'cloth' });
  b.add('head', leaf(0.08, 0.05, pick(b, 3, 3, 5)), C.leaf, { at: along(at, [0, -0.35, -0.9], 0.036), rot: aim([0, -0.35, -0.9], out), look: 'cloth' });
  b.add('head', S.sphere(0.011, 8, 5), C.brass, { at: along(at, out, 0.004), look: 'gold' });
}

import { buildBody } from '../body';
import { HEAD } from '../body-head';
import type { PartSet } from '../parts';
import { loftFrontZ } from '../shapes';
import type { V3 } from '../skeleton';
import type { Stance } from '../stance';
import { lowBeard, lowBlob, kneePads, lowTaper } from '../body-low';
import { heroDrape } from '../hero-assets';
import { cloak, cowl, hood, mantle, shoulderCap, skirt } from './moss-cloth';
import { bandolier, bedroll, bracer, C, clasp, HIDE, cloakLeaves, hatchetOnPack, hoodSprig, hoodStitches, legWraps, mantleStitches, pouches, satchel } from './moss-gear';
import { sweep } from './plate-fittings';
import { strand, tapering } from './tailor';
import { lump, pick } from './sheet';
import { sleevesAndLegs, tunic } from './moss-tunic';

/** Half turned to the viewer behind the long rifle, stock in the shoulder and the muzzle lifted, head up over the scope scanning ahead, chest turned with the head so the neck is not wrung, feet spread wide along the line of fire. */
export const stance: Stance = {
  pelvis: { at: [0.02, -0.09, 0], rot: [0.65, 0, 0] },
  chest: [0.55, -0.06, 0],
  head: [-0.1, 0.02, -0.07],
  feet: {
    R: { at: [0.378, 0, 0.141], heading: 1.2 },
    L: { at: [-0.279, 0, -0.28], heading: -0.05, knee: 0.1 }
  },
  arms: {
    R: { wrist: [-0.104, 0.235, -0.299], hand: [-0.706, 0.146, 0.132], elbow: [0.641, -0.102, 0.76], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.344, 0.32, -0.487], hand: [0.434, 0.451, 1.626], elbow: [-0.777, -0.622, -0.072], space: 'chest', shape: 'hold' }
  },
  life: { breath: 0.6, sway: 0.3, look: 0 }
};

/** Moss: forest ranger in a pointed hood and dagged mantle over a long cloak, bushy beard, bandolier, satchel and wrapped boots. */
export function moss(b: PartSet) {
  buildBody(b, {
    skin: '#d9a27a',
    shirt: C.tunic,
    sleeve: C.tunic,
    glove: '#5b4630',
    gloveLook: 'cloth',
    fore: { half: [0.017, 0.025], corner: 0.01, yaw: 0.45, roll: 0.3, over: { r: 0.0128, at: 0.023 }, seat: 0.004, sink: 0.011, arch: 3.2, fan: 0.35, thumbTip: 0.45 },
    pants: '#3f4a35',
    boot: '#5b4630',
    bootLook: b.detail === 0 ? 'rubber' : HIDE,
    beltLook: HIDE,
    belt: C.leather,
    buckle: C.steel,
    bulk: 1.02,
    eyes: '#20242a',
    iris: '#5f7a3c',
    brow: '#6a4a2a',
    browTilt: 0.03,
    mouth: 'none',
    nose: 1.4,
    blush: '#d58f6c',
    expression: { open: 0.86, squint: 0.2, lidTilt: 0, brows: [-0.003, -0.003] }
  });
  if (b.detail === 0) return plain(b);
  const hi = b.detail > 1;

  hood(b, C.cloak, C.hoodLining, C.cloakDark, C.sash);
  cowl(b, C.cloak);
  mantle(b, C.cloak, C.lining);
  b.mirror((side, sign) => shoulderCap(b, `upperArm${side}`, sign, C.cloak, C.lining));
  const draped = b.hero ? heroDrape('moss-cloak') : undefined;
  if (draped) {
    b.add('dangleBack', draped.outer!, C.cloak, { look: 'cloth' });
    b.add('dangleBack', draped.lining!, C.lining, { look: 'cloth' });
    b.add('dangleBack', draped.trim!, C.sash, { look: 'cloth' });
  } else {
    cloak(b, C.cloak, C.lining, C.sash, C.thread);
    cloakLeaves(b);
  }
  beard(b);
  skirt(b, C.tunic, C.tunicDark);
  tunic(b);
  bandolier(b);
  satchel(b);
  b.mirror((side, sign) => {
    bracer(b, side, sign);
    legWraps(b, side);
    sleevesAndLegs(b, side, sign);
  });
  hoodSprig(b);
  if (!hi) return kneePads(b, 1, C.leather, HIDE);
  pouches(b);
  bedroll(b);
  clasp(b);
  if (!b.hero) return;
  mantleStitches(b);
  hoodStitches(b);
  if (!stance.melee) hatchetOnPack(b);
}

/** Sculpted beard: chin mass, sideburns, a row of locks, a drooping mustache and a fringe under the hood. */
function beard(b: PartSet) {
  lump(b, 'head', [0.2, 0.19, 0.115], C.beard, pick(b, 10, 12, 18), { at: [0, -0.05, -0.096], look: 'cloth', e: 0.72, taper: 0.45 });
  b.mirror((_, sign) => lump(b, 'head', [0.054, 0.12, 0.09], C.beard, pick(b, 6, 8, 12), { at: [sign * 0.084, 0.0, -0.074], look: 'cloth', e: 0.85 }));
  lump(b, 'head', [0.19, 0.05, 0.07], C.beard, pick(b, 6, 8, 12), { at: [0, 0.196, -0.078], rot: [0.5, 0, 0], look: 'cloth', e: 0.7 });
  // Locks of the fringe falling from under the hood, combed to his left, each its own length; [x, drift, length, width].
  if (b.detail > 1) {
    const front = (x: number, y: number, out: number): V3 => [x, y, loftFrontZ(HEAD, x, y) - out];
    const top = 0.212;
    if (b.hero) {
      // Rounded locks that narrow to a point and lift off the brow at the tip; their roots are under the hood.
      const locks: [number, number, number, number][] = [[-0.088, 0.016, 0.046, 0.048], [-0.064, 0.026, 0.064, 0.058], [-0.038, 0.036, 0.078, 0.062], [-0.012, 0.042, 0.07, 0.062], [0.014, 0.044, 0.082, 0.06], [0.04, 0.04, 0.072, 0.058], [0.064, 0.03, 0.058, 0.052], [0.086, 0.02, 0.046, 0.046]];
      locks.forEach(([x, drift, length, width], i) => {
        const path = [front(x, top, -0.004), front(x + drift * 0.25, top - length * 0.35, 0.008), front(x + drift * 0.7, top - length * 0.75, 0.011), front(x + drift, top - length, 0.016)];
        b.add('head', sweep(path, (t) => [(width / 2) * (1 - 0.8 * t ** 1.5), 0.0105 * (1 - 0.55 * t)], { seg: 8, radial: 10, up: [0, 0, -1] }), i % 2 ? C.beardLight : C.beard, { look: 'cloth' });
      });
    } else {
      const locks: [number, number, number, number][] = [[-0.054, 0.03, 0.06, 0.08], [0.0, 0.042, 0.072, 0.084], [0.054, 0.032, 0.058, 0.078]];
      locks.forEach(([x, drift, length, width], i) => {
        const path = [front(x, top, -0.004), front(x + drift * 0.35, top - length * 0.45, 0.009), front(x + drift, top - length, 0.012)];
        b.add('head', sweep(path, (t) => [(width / 2) * (1 - 0.62 * t ** 1.6), 0.0095 * (1 - 0.4 * t)], { seg: 4, radial: 5, up: [0, 0, -1], caps: true }), i % 2 ? C.beardLight : C.beard, { look: 'cloth' });
      });
    }
  }
  if (b.detail < 2) {
    lump(b, 'head', [0.13, 0.035, 0.04], C.beardLight, 8, { at: [0, 0.014, -0.132], look: 'cloth', e: 0.7 });
    return;
  }
  if (b.hero) return beardLocks(b);
  [-0.07, -0.036, 0, 0.036, 0.07].forEach((x, i) => {
    const mid = 1 - Math.abs(x) / 0.07;
    lump(b, 'head', [0.054, 0.1 + 0.05 * mid, 0.054], i % 2 ? C.beard : C.beardLight, pick(b, 6, 6, 10), { at: [x, -0.088 - 0.03 * mid, -0.136 + 0.026 * (1 - mid)], rot: [0.2, 0, -x * 2.6], look: 'cloth', e: 0.85, taper: 0.6 });
  });
  b.mirror((_, sign) => lump(b, 'head', [0.08, 0.036, 0.042], C.beardLight, pick(b, 6, 6, 12), { at: [sign * 0.034, 0.01, -0.134], rot: [0, sign * -0.25, sign * -0.38], look: 'cloth', e: 0.8 }));
}

/** The chin mass of beard() as a surface: around (a, 0 = front) and up (lat), lifted off it by `lift`. */
function beardPoint(a: number, lat: number, lift: number): V3 {
  const f = (v: number) => Math.sign(v) * Math.abs(v) ** 0.72;
  const [vx, vy, vz] = [Math.cos(lat) * Math.sin(a), Math.sin(lat), -Math.cos(lat) * Math.cos(a)];
  const tb = vy < 0 ? 1 - 0.45 * -vy : 1;
  const q = [f(vx) * 0.1 * tb, f(vy) * 0.095, f(vz) * 0.0575];
  const k = 1 + lift / Math.hypot(q[0]!, q[1]!, q[2]!);
  return [q[0]! * k, -0.05 + q[1]! * k, -0.096 + q[2]! * k];
}

/** Close up the beard is combed into locks over the chin mass, each tapering to its own point, under a mustache of two swept strands. */
function beardLocks(b: PartSet) {
  // [around, top latitude, length past the bottom, radius]
  const locks: [number, number, number, number][] = [
    [-1.25, 0.62, 0.0, 0.017],
    [-1.02, 0.5, 0.012, 0.019],
    [-0.8, 0.36, 0.02, 0.02],
    [-0.58, 0.26, 0.03, 0.021],
    [-0.37, 0.18, 0.036, 0.022],
    [-0.16, 0.14, 0.044, 0.022],
    [0.05, 0.14, 0.048, 0.023],
    [0.26, 0.16, 0.04, 0.022],
    [0.47, 0.22, 0.034, 0.021],
    [0.68, 0.32, 0.024, 0.02],
    [0.9, 0.44, 0.014, 0.019],
    [1.12, 0.56, 0.006, 0.018],
    [1.32, 0.66, 0.0, 0.016]
  ];
  const tones = [C.beard, C.beardLight, C.beard, C.beard, C.beardLight, C.beard, C.beardLight, C.beard, C.beardLight, C.beard, C.beard, C.beardLight, C.beard];
  locks.forEach(([a, top, past, r], i) => {
    const drift = 0.06 * Math.sin(i * 1.7);
    const path = [beardPoint(a, top, -0.002), beardPoint(a + drift * 0.3, top * 0.35 - 0.2, 0.002), beardPoint(a + drift * 0.7, -0.7, 0.003), beardPoint(a + drift, -1.05, 0.002)];
    const [x, y, z] = path[3]!;
    path.push([x * 0.85, y - past, z - 0.006]);
    const relief = (t: number, phi: number) => 0.09 * Math.sin(phi * 3 + i) * Math.min(1, t * 5);
    b.add('head', strand(path, tapering(r, 0.12, 0.25), { flat: 0.5, side: [Math.cos(a), 0, Math.sin(a)], seg: 14, radial: 14, relief }), tones[i]!, { look: 'cloth' });
  });
  // Locks combed down over each sideburn, so it reads as hair rather than a ball on the cheek.
  b.mirror((_, sign) => {
    for (const [k, [dz, r]] of ([[0, 0.017], [0.026, 0.016], [-0.022, 0.015]] as const).entries()) {
      const path: V3[] = [
        [sign * 0.098, 0.058, -0.068 + dz],
        [sign * 0.111, 0.015, -0.074 + dz],
        [sign * 0.108, -0.035, -0.086 + dz * 0.6],
        [sign * 0.094, -0.075, -0.104 + dz * 0.3]
      ];
      const relief = (t: number, phi: number) => 0.09 * Math.sin(phi * 3 + k * 2 + sign) * Math.min(1, t * 5);
      b.add('head', strand(path, tapering(r, 0.2, 0.25), { flat: 0.5, side: [0, 0, 1], seg: 12, radial: 14, relief }), k === 1 ? C.beardLight : C.beard, { look: 'cloth' });
    }
  });
  b.mirror((_, sign) => {
    const path: V3[] = [
      [sign * 0.004, 0.022, -0.146],
      [sign * 0.03, 0.016, -0.146],
      [sign * 0.056, 0.0, -0.132],
      [sign * 0.074, -0.026, -0.114],
      [sign * 0.078, -0.05, -0.104]
    ];
    const relief = (_: number, phi: number) => 0.08 * Math.sin(phi * 3 + sign);
    b.add('head', strand(path, tapering(0.019, 0.15, 0.3), { flat: 0.55, side: [0, 1, 0], seg: 16, radial: 14, relief }), C.beardLight, { look: 'cloth' });
  });
}

/** The low tier's costume: the hood and cloak at the medium tier's cut, the rest a handful of flat parts. */
function plain(b: PartSet) {
  lowTaper(b, 'chest', [0.42, 0.25], [0.3, 0.2], 0.13, C.cloak, { at: [0, 0.19, 0.0], look: 'cloth', caps: 'top' });
  b.mirror((side, sign) => b.dome(`upperArm${side}`, 0.085, C.cloak, { at: [sign * 0.005, -0.01, 0], rot: [0, 0, sign * -0.25], scale: [1.05, 1.1, 1.15], look: 'cloth' }));
  cloak(b, C.cloak, C.lining, C.sash, C.thread);
  b.box('chest', [0.06, 0.06, 0.03], C.leaf2, { at: [-0.14, 0.2, -0.08], rot: [0.5, 0, Math.PI / 4], look: 'cloth' });
  hood(b, C.cloak, C.hoodLining, C.cloakDark, C.sash);
  lowBlob(b, 'head', [0.2, 0.05, 0.06], C.beard, { at: [0, 0.205, -0.1], rot: [0.35, 0, 0], look: 'cloth', e: 0.7, seg: 6 });
  lowBeard(b, C.beard, C.beardLight);
  b.box('pelvis', [0.07, 0.15, 0.19], C.leather, { at: [-0.2, -0.03, 0.0], look: 'rubber' });
  for (const z of [-0.118, 0.118]) b.box('chest', [0.035, 0.46, 0.014], C.leather, { at: [0, 0.07, z], rot: [0, 0, z < 0 ? -0.62 : 0.62], look: 'rubber' });
  b.mirror((side) => b.cyl(`shin${side}`, 0.056, 0.054, 0.022, C.tan, { at: [0, -0.27, 0], rot: [0.12, 0, 0], look: 'cloth' }));
  kneePads(b, 1, C.leather, 'cloth');
}

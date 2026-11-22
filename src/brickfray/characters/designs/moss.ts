import { buildBody } from '../body';
import { HEAD } from '../body-head';
import type { PartSet } from '../parts';
import { loftFrontZ } from '../shapes';
import type { V3 } from '../skeleton';
import type { Stance } from '../stance';
import { lowBeard, lowBlob, kneePads, lowTaper } from '../body-low';
import { heroDrape } from '../hero-assets';
import { cloak, cowl, hood, mantle, shoulderCap, skirt } from './moss-cloth';
import { bandolier, bedroll, bracer, C, clasp, HIDE, cloakLeaves, hatchetOnPack, hoodSprig, legWraps, mantleStitches, pouches, satchel } from './moss-gear';
import { sweep } from './plate-fittings';
import { lump, pick } from './sheet';
import { sleevesAndLegs, tunic } from './moss-tunic';

/** Half turned to the viewer behind the long rifle, stock in the shoulder and cheek to the scope, chest turned with the head so the neck is not wrung, feet spread wide along the line of fire. */
export const stance: Stance = {
  pelvis: { at: [0.02, -0.09, 0], rot: [0.65, 0, 0] },
  chest: [0.55, -0.06, 0],
  head: [-0.12, -0.22, -0.15],
  feet: {
    R: { at: [0.378, 0, 0.141], heading: 1.2 },
    L: { at: [-0.279, 0, -0.28], heading: -0.05, knee: 0.1 }
  },
  arms: {
    R: { wrist: [-0.105, 0.186, -0.304], hand: [-0.701, 0.026, 0.132], elbow: [0.642, 0, 0.766], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.35, 0.235, -0.5], hand: [0.39, 0.398, 1.744], elbow: [-0.766, -0.64, 0.003], space: 'chest', shape: 'hold' }
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
    fore: { half: [0.017, 0.025], corner: 0.01, yaw: 0.45, roll: 0.3, over: { r: 0.0128, at: 0.023 }, seat: 0.004, sink: 0.004, arch: 3.2, fan: 0.35 },
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
  [-0.07, -0.036, 0, 0.036, 0.07].forEach((x, i) => {
    const mid = 1 - Math.abs(x) / 0.07;
    lump(b, 'head', [0.054, 0.1 + 0.05 * mid, 0.054], i % 2 ? C.beard : C.beardLight, pick(b, 6, 6, 10), { at: [x, -0.088 - 0.03 * mid, -0.136 + 0.026 * (1 - mid)], rot: [0.2, 0, -x * 2.6], look: 'cloth', e: 0.85, taper: 0.6 });
  });
  b.mirror((_, sign) => {
    lump(b, 'head', [0.08, 0.036, 0.042], C.beardLight, pick(b, 6, 6, 12), { at: [sign * 0.034, 0.01, -0.134], rot: [0, sign * -0.25, sign * -0.38], look: 'cloth', e: 0.8 });
    if (b.hero) lump(b, 'head', [0.03, 0.042, 0.032], C.beardLight, 8, { at: [sign * 0.072, -0.01, -0.125], rot: [0, 0, sign * -0.9], look: 'cloth', e: 0.9, taper: 0.5 });
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

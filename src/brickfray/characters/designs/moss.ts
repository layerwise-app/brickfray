import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { cloak, cowl, hood, mantle, shoulderCap, skirt } from './moss-cloth';
import { bandolier, bedroll, bracer, C, clasp, cloakLeaves, hoodSprig, legWraps, mantleStitches, pouches, satchel } from './moss-gear';
import { lump, pick } from './sheet';

/** Signature showroom pose. */
export const stance: Stance = {
  pelvis: { at: [-0.05, -0.02, 0.02], rot: [0.22, 0, 0.06] },
  chest: [-0.14, 0.07, -0.05],
  head: [-0.44, -0.1, 0.06],
  feet: {
    L: { at: [-0.1, 0, 0.07], heading: -0.4 },
    R: { at: [0.19, 0, -0.2], heading: 0.45, knee: 0.1 }
  },
  arms: {
    R: { wrist: [0.31, 0.264, -0.229], hand: [0.5, 1.05, 0.0], elbow: [0.9, -0.2, 0.5], space: 'pelvis', shape: 'grip' },
    L: { wrist: [-0.36, -0.17, 0.02], hand: [-2.05, -0.94, 0.1], elbow: [-0.8, -0.1, 0.6], space: 'pelvis', shape: 'fist' }
  },
  melee: true,
  life: { breath: 1, sway: 0.8, look: 0.7 }
};

/** Moss: forest ranger in a pointed hood and dagged mantle over a long cloak, bushy beard, bandolier, satchel and wrapped boots. */
export function moss(b: PartSet) {
  buildBody(b, {
    skin: '#d9a27a',
    shirt: C.tunic,
    sleeve: C.tunic,
    glove: '#5b4630',
    gloveLook: 'cloth',
    pants: '#3f4a35',
    boot: '#5b4630',
    bootLook: 'rubber',
    belt: C.leather,
    buckle: C.steel,
    bulk: 1.02,
    eyes: '#20242a',
    iris: '#5f7a3c',
    brow: '#6a4a2a',
    browTilt: -0.12,
    mouth: 'none'
  });
  if (b.detail === 0) return plain(b);
  const hi = b.detail > 1;

  hood(b, C.cloak, C.lining, C.cloakDark);
  cowl(b, C.cloak);
  mantle(b, C.cloak, C.lining);
  b.mirror((side, sign) => shoulderCap(b, `upperArm${side}`, sign, C.cloak, C.lining));
  cloak(b, C.cloak, C.lining, C.cloakDark, C.thread);
  cloakLeaves(b);
  beard(b);
  skirt(b, C.tunic, C.tunicDark);
  bandolier(b);
  satchel(b);
  b.mirror((side, sign) => {
    bracer(b, side, sign);
    legWraps(b, side);
  });
  if (!hi) return;
  pouches(b);
  bedroll(b);
  clasp(b);
  hoodSprig(b);
  if (b.hero) mantleStitches(b);
}

/** Sculpted beard: chin mass, sideburns, a row of locks, a drooping mustache and a fringe under the hood. */
function beard(b: PartSet) {
  lump(b, 'head', [0.2, 0.19, 0.115], C.beard, pick(b, 10, 12, 18), { at: [0, -0.05, -0.096], look: 'cloth', e: 0.72, taper: 0.45 });
  b.mirror((_, sign) => lump(b, 'head', [0.054, 0.12, 0.09], C.beard, pick(b, 6, 8, 12), { at: [sign * 0.084, 0.0, -0.074], look: 'cloth', e: 0.85 }));
  lump(b, 'head', [0.19, 0.05, 0.07], C.beard, pick(b, 6, 8, 12), { at: [0, 0.196, -0.078], rot: [0.5, 0, 0], look: 'cloth', e: 0.7 });
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

/** The low tier's costume: a handful of flat parts. */
function plain(b: PartSet) {
  b.taper('chest', [0.42, 0.25], [0.3, 0.2], 0.13, C.cloak, { at: [0, 0.19, 0.0], look: 'cloth' });
  b.mirror((side, sign) => b.dome(`upperArm${side}`, 0.085, C.cloak, { at: [sign * 0.005, -0.01, 0], rot: [0, 0, sign * -0.25], scale: [1.05, 1.1, 1.15], look: 'cloth' }));
  b.taper('dangleBack', [0.44, 0.03], [0.36, 0.03], 0.66, C.cloak, { at: [0, -0.3, 0.01], look: 'cloth' });
  for (const [x, y, color] of [[-0.1, -0.12, C.leaf], [0.09, -0.3, C.leaf2]] as const) b.box('dangleBack', [0.07, 0.07, 0.04], color, { at: [x, y, 0.012], rot: [0, 0, Math.PI / 4], look: 'cloth' });
  b.box('chest', [0.06, 0.06, 0.03], C.leaf2, { at: [-0.14, 0.2, -0.08], rot: [0.5, 0, Math.PI / 4], look: 'cloth' });
  b.blob('head', [0.285, 0.305, 0.27], C.cloak, { at: [0, 0.118, 0.055], look: 'cloth', e: 0.62, taper: 0.1 });
  b.blob('head', [0.1, 0.12, 0.12], C.cloak, { at: [0, 0.24, 0.12], rot: [-0.9, 0, 0], look: 'cloth', e: 0.8, taper: 0.5 });
  b.blob('head', [0.21, 0.16, 0.11], C.beard, { at: [0, -0.02, -0.095], look: 'cloth', e: 0.75, taper: 0.35 });
  b.blob('head', [0.13, 0.035, 0.04], C.beard, { at: [0, 0.018, -0.13], look: 'cloth', e: 0.7 });
  b.mirror((_, sign) => b.blob('head', [0.05, 0.1, 0.06], C.beard, { at: [sign * 0.1, 0.03, -0.06], look: 'cloth', e: 0.7 }));
  b.box('pelvis', [0.07, 0.15, 0.19], C.leather, { at: [-0.2, -0.03, 0.0], look: 'rubber' });
  for (const z of [-0.118, 0.118]) b.box('chest', [0.035, 0.46, 0.014], C.leather, { at: [0, 0.07, z], rot: [0, 0, z < 0 ? -0.62 : 0.62], look: 'rubber' });
  b.mirror((side) => b.cyl(`shin${side}`, 0.056, 0.054, 0.022, C.tan, { at: [0, -0.27, 0], rot: [0.12, 0, 0], look: 'cloth' }));
}

import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { antenna, arm, C, chestUnit, helmet, leg, pack, waist } from './nova-suit';

const BULK = 1.08;
const LIMBS = 1.13;

/** Signature showroom pose. */
export const stance: Stance = {
  pelvis: { at: [0.04, 0.0, 0], rot: [0.2, 0, -0.06] },
  chest: [-0.12, 0.1, 0.05],
  head: [-0.5, 0.18, 0.06],
  feet: {
    L: { at: [-0.19, 0, 0.1], heading: -0.55, pitch: -0.6, knee: 0.1 },
    R: { at: [0.1, 0, -0.02], heading: 0.2 }
  },
  arms: {
    R: { wrist: [0.25, 0.06, -0.19], hand: [0.3, 1.42, 0.0], elbow: [0.8, -0.7, 0.3], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.5, -0.1, -0.1], hand: [-1.2, -0.3, -0.9], elbow: [-0.6, -0.4, 0.8], space: 'chest', shape: 'open' }
  },
  life: { breath: 1, sway: 1.3, look: 0.6 }
};

/** Nova: astronaut in a white suit with purple trim: bubble helmet with a gold visor, chest controls, ribbed joints and a life-support pack. */
export function nova(b: PartSet) {
  const low = b.detail === 0;
  buildBody(b, {
    skin: '#f0c9a8',
    shirt: C.suit,
    shirtLook: 'plastic',
    elbow: low ? undefined : C.joint,
    glove: C.shade,
    gloveLook: 'rubber',
    pants: C.suit,
    pantsLook: 'plastic',
    boot: C.suit,
    sole: C.purple,
    belt: C.purple,
    buckle: C.chrome,
    bulk: BULK,
    limbs: LIMBS,
    omit: low ? ['head'] : ['head', 'neck', 'abdomen']
  });
  if (low) return plain(b);
  helmet(b);
  antenna(b);
  chestUnit(b);
  pack(b);
  waist(b, BULK);
  b.mirror((side, sign) => {
    arm(b, side, sign, LIMBS);
    leg(b, side, sign, LIMBS);
  });
}

/** The low tier's costume: a handful of flat parts. */
function plain(b: PartSet) {
  b.cyl('neck', 0.09, 0.1, 0.07, C.purple, { look: 'gloss' });
  b.ball('head', 0.17, C.suit, { at: [0, 0.095, 0.005], look: 'gloss' });
  b.section('head', 0.174, 2.1, 1.35, C.visor, { at: [0, 0.095, 0.005], look: 'gold' });
  b.mirror((_, sign) => b.cyl('head', 0.04, 0.045, 0.03, C.shade, { at: [sign * 0.165, 0.09, 0.0], rot: [0, 0, Math.PI / 2], look: 'plastic' }));
  b.cyl('dangleHead', 0.006, 0.008, 0.22, C.chrome, { at: [0, 0.11, 0], look: 'chrome' });
  b.ball('dangleHead', 0.018, '#ff5ab0', { at: [0, 0.23, 0], look: 'glow' });
  b.box('chest', [0.32, 0.36, 0.14], C.suit, { at: [0, 0.07, 0.17], look: 'plastic' });
  b.box('chest', [0.22, 0.12, 0.02], C.purple, { at: [0, 0.14, 0.245], look: 'gloss' });
  C.lights.forEach((c, i) => b.ball('chest', 0.014, c, { at: [-0.06 + i * 0.06, 0.0, 0.245], look: 'glow' }));
  b.mirror((_, sign) => b.cyl('chest', 0.03, 0.03, 0.3, C.shade, { at: [sign * 0.175, 0.07, 0.17], look: 'plastic' }));
  b.box('chest', [0.17, 0.1, 0.05], C.shade, { at: [0, 0.03, -0.12], look: 'plastic' });
  C.lights.forEach((c, i) => b.box('chest', [0.022, 0.018, 0.01], c, { at: [-0.045 + i * 0.045, 0.04, -0.147], look: 'glow' }));
  b.mirror((side) => {
    b.cyl(`upperArm${side}`, 0.07, 0.07, 0.03, C.purple, { at: [0, -0.02, 0], look: 'gloss' });
    b.cyl(`forearm${side}`, 0.058, 0.058, 0.03, C.purple, { at: [0, -0.2, 0], look: 'gloss' });
    b.blob(`shin${side}`, [0.11, 0.1, 0.05], C.purple, { at: [0, -0.0, -0.06], look: 'gloss' });
    b.cyl(`foot${side}`, 0.075, 0.075, 0.03, C.purple, { at: [0, 0.07, 0], look: 'gloss' });
  });
}

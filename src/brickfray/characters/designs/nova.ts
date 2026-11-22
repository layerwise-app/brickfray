import { buildBody } from '../body';
import { lowBall, kneePads, lowSection } from '../body-low';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { antenna, arm, C, chestUnit, helmet, leg, pack, waist } from './nova-suit';
import { panels, visorDepth } from './nova-trim';

const BULK = 1.08;
const LIMBS = 1.13;

/** A big wave with the open left hand, carbine angled up in the right, weight on the right leg and the left leg stretched out to the side on its toes. */
export const stance: Stance = {
  pelvis: { at: [0.085, -0.035, 0], rot: [0.08, 0, 0.14] },
  chest: [-0.15, 0.05, -0.12],
  head: [-0.45, 0.1, -0.1],
  feet: {
    R: { at: [0.12, 0, 0.03], heading: 0.3, knee: 0.08 },
    L: { at: [-0.24, 0, -0.14], heading: -0.6, knee: 0.14, pitch: -0.6 }
  },
  arms: {
    R: { wrist: [0.31, 0.19, -0.2], hand: [0.6, 1.05, -0.05], elbow: [0.75, -0.62, 0.2], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.46, 0.56, -0.07], hand: [-2.285, 1.389, 0.209], elbow: [-0.8, -0.6, 0.2], space: 'chest', shape: 'open', wave: 0.2 }
  },
  life: { breath: 1, sway: 1, look: 0.6 }
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
    bootClosure: 'sealed',
    belt: C.purple,
    buckle: C.chrome,
    bulk: BULK,
    limbs: LIMBS,
    cuff: 0.86,
    joints: 'hinge',
    omit: low ? ['head'] : ['head', 'neck', 'abdomen']
  });
  if (low) return plain(b);
  helmet(b);
  antenna(b);
  chestUnit(b);
  pack(b);
  waist(b, BULK);
  visorDepth(b);
  panels(b, BULK, LIMBS);
  b.mirror((side, sign) => {
    arm(b, side, sign, LIMBS);
    leg(b, side, sign, LIMBS);
  });
}

/** The low tier's costume: a handful of flat parts. */
function plain(b: PartSet) {
  b.cyl('neck', 0.09, 0.1, 0.07, C.purple, { look: 'gloss' });
  lowBall(b, 'head', 0.17, C.suit, { at: [0, 0.095, 0.005], look: 'gloss', seg: 13 });
  lowSection(b, 'head', 0.174, 2.1, 1.35, C.visor, { at: [0, 0.095, 0.005], look: 'gold', seg: 12 });
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
    b.cyl(`foot${side}`, 0.075, 0.075, 0.03, C.purple, { at: [0, 0.07, 0], look: 'gloss' });
  });
  kneePads(b, 1, C.purple, 'gloss');
}

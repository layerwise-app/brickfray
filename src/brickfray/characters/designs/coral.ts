import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { belt, boots, BRASS, COPPER, fittings, RUBBER, SEAM, SUIT, suit, tank } from './coral-gear';
import { corselet, helmet } from './coral-helmet';

/** Coral: deep-sea diver in a coral canvas suit, brass standard-dress helmet, copper corselet and tank, heavy brass boots. */
export function coral(b: PartSet) {
  const low = b.detail === 0;
  buildBody(b, {
    skin: '#e8b48f',
    shirt: SUIT,
    shirtLook: 'rubber',
    glove: RUBBER,
    pants: SUIT,
    pantsLook: 'rubber',
    boot: BRASS,
    bootLook: 'metal',
    sole: '#2b2f33',
    belt: low ? '#4a4f57' : undefined,
    buckle: BRASS,
    bulk: 1.1,
    limbs: 1.12,
    omit: low ? ['head'] : ['head', 'neck', 'chest', 'abdomen', 'boots']
  });
  if (low) return blocky(b);
  suit(b);
  tank(b);
  corselet(b);
  belt(b);
  fittings(b);
  boots(b);
  helmet(b);
}

/** The low tier: the same diver in a handful of blocks. */
function blocky(b: PartSet) {
  const bulk = 1.1;
  b.cyl('neck', 0.07, 0.08, 0.08, BRASS, { at: [0, 0.0, 0], look: 'metal' });
  b.ball('head', 0.168, BRASS, { at: [0, 0.1, 0], look: 'metal' });
  b.cyl('head', 0.088, 0.088, 0.02, '#101820', { at: [0, 0.09, -0.152], rot: [Math.PI / 2, 0, 0], look: 'rubber' });
  b.mirror((_, sign) => b.ball('head', 0.016, '#e9f3ff', { at: [sign * 0.032, 0.1, -0.162], scale: [1, 1.3, 0.6], look: 'glow' }));
  b.cyl('head', 0.088, 0.088, 0.008, '#9fd4e8', { at: [0, 0.09, -0.168], rot: [Math.PI / 2, 0, 0], look: 'glass' });
  b.torus('head', 0.092, 0.018, BRASS, { at: [0, 0.09, -0.162], look: 'metal' });
  b.cyl('head', 0.007, 0.007, 0.17, BRASS, { at: [0, 0.09, -0.176], look: 'metal' });
  b.mirror((_, sign) => {
    b.torus('head', 0.045, 0.012, BRASS, { at: [sign * 0.16, 0.1, 0], rot: [0, Math.PI / 2, 0], look: 'metal' });
    b.cyl('head', 0.042, 0.042, 0.008, '#9fd4e8', { at: [sign * 0.164, 0.1, 0], rot: [0, 0, Math.PI / 2], look: 'glass' });
  });
  b.cyl('head', 0.035, 0.045, 0.04, BRASS, { at: [0, 0.27, 0.02], look: 'metal' });
  b.taper('chest', [0.44 * bulk, 0.3], [0.26, 0.2], 0.08, BRASS, { at: [0, 0.215, 0], look: 'metal' });
  b.cyl('chest', 0.075, 0.075, 0.32, COPPER, { at: [0, 0.03, 0.19], look: 'metal' });
  b.ball('chest', 0.075, COPPER, { at: [0, 0.19, 0.19], scale: [1, 0.6, 1], look: 'metal' });
  b.ball('chest', 0.075, COPPER, { at: [0, -0.13, 0.19], scale: [1, 0.6, 1], look: 'metal' });
  b.cyl('chest', 0.025, 0.03, 0.05, BRASS, { at: [0, 0.235, 0.19], look: 'metal' });
  b.mirror((side, sign) => {
    b.box('chest', [0.04, 0.26, 0.012], RUBBER, { at: [sign * 0.1, 0.06, -0.122], look: 'rubber' });
    b.box('chest', [0.04, 0.26, 0.012], RUBBER, { at: [sign * 0.1, 0.06, 0.13], look: 'rubber' });
    b.tube(
      'chest',
      [
        [sign * 0.03, 0.25, 0.19],
        [sign * 0.11, 0.33, 0.13],
        [sign * 0.15, 0.3, 0.0],
        [sign * 0.12, 0.23, -0.1]
      ],
      0.018,
      RUBBER,
      { look: 'rubber' }
    );
    b.blob(`shin${side}`, [0.11, 0.1, 0.05], SEAM, { at: [0, -0.02, -0.06], look: 'rubber' });
    b.cyl(`forearm${side}`, 0.056, 0.056, 0.025, BRASS, { at: [0, -0.205, 0], look: 'metal' });
    b.box('pelvis', [0.07, 0.07, 0.05], '#5d646c', { at: [sign * 0.1, 0.03, -0.12], look: 'metal' });
    b.box('pelvis', [0.07, 0.07, 0.05], '#5d646c', { at: [sign * 0.1, 0.03, 0.12], look: 'metal' });
    b.cyl(`foot${side}`, 0.072, 0.072, 0.03, BRASS, { at: [0, 0.07, 0], look: 'metal' });
  });
}

/** Signature showroom pose: harpoon gun held upright like a trident, the other fist planted on the hip. */
export const stance: Stance = {
  pelvis: { at: [0.05, -0.02, -0.03], rot: [0.06, 0, -0.07] },
  chest: [-0.15, 0.03, 0.045],
  head: [-0.42, 0.04, -0.1],
  feet: {
    L: { at: [-0.23, 0, -0.12], heading: -0.55, knee: 0.1 },
    R: { at: [0.13, 0, 0.03], heading: 0.25 }
  },
  arms: {
    R: { wrist: [0.4, 0.06, -0.2], hand: [0.5, Math.PI / 2, 0], elbow: [0.6, -1, 0.4], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.255, 0.095, 0], hand: [1.57, -0.15, 0], elbow: [-1, 0, 0.5], space: 'pelvis', shape: 'fist' }
  },
  life: { breath: 1, sway: 0.7, look: 0.8 }
};

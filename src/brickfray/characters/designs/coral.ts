import { buildBody } from '../body';
import type { PartSet } from '../parts';

const SUIT = '#f26b5b';
const SEAM = '#c9493c';
const BRASS = '#c99a3e';
const COPPER = '#b8733a';
const RUBBER = '#3a3f47';

/** Coral: retro deep-sea diver: coral canvas suit, brass helmet with a porthole, air tank and hoses, brass boots. */
export function coral(b: PartSet) {
  const bulk = 1.1;
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
    belt: '#4a4f57',
    buckle: BRASS,
    bulk,
    limbs: 1.12,
    omit: ['head']
  });
  const d1 = b.detail > 0;
  const hi = b.detail > 1;

  // Brass helmet: dome, front porthole with grill and eyes in the dark, side ports, top vent.
  b.cyl('neck', 0.07, 0.08, 0.08, BRASS, { at: [0, 0.0, 0], look: 'metal' });
  b.ball('head', 0.168, BRASS, { at: [0, 0.1, 0], look: 'metal' });
  b.cyl('head', 0.088, 0.088, 0.02, '#101820', { at: [0, 0.09, -0.152], rot: [Math.PI / 2, 0, 0], look: 'rubber' });
  b.mirror((_, sign) => b.ball('head', 0.016, '#e9f3ff', { at: [sign * 0.032, 0.1, -0.162], scale: [1, 1.3, 0.6], look: 'glow' }));
  b.cyl('head', 0.088, 0.088, 0.008, '#9fd4e8', { at: [0, 0.09, -0.168], rot: [Math.PI / 2, 0, 0], look: 'glass' });
  b.torus('head', 0.092, 0.018, BRASS, { at: [0, 0.09, -0.162], look: 'metal' });
  for (const x of d1 ? [-0.045, 0, 0.045] : [0]) b.cyl('head', 0.007, 0.007, 0.17, BRASS, { at: [x, 0.09, -0.176], look: 'metal' });
  b.mirror((_, sign) => {
    b.torus('head', 0.045, 0.012, BRASS, { at: [sign * 0.16, 0.1, 0], rot: [0, Math.PI / 2, 0], look: 'metal' });
    b.cyl('head', 0.042, 0.042, 0.008, '#9fd4e8', { at: [sign * 0.164, 0.1, 0], rot: [0, 0, Math.PI / 2], look: 'glass' });
  });
  b.cyl('head', 0.035, 0.045, 0.04, BRASS, { at: [0, 0.27, 0.02], look: 'metal' });
  if (d1) b.cyl('head', 0.03, 0.03, 0.05, COPPER, { at: [0, 0.14, 0.16], rot: [Math.PI / 2, 0, 0], look: 'metal' });

  // Corselet collar with bolts.
  b.taper('chest', [0.44 * bulk, 0.3], [0.26, 0.2], 0.08, BRASS, { at: [0, 0.215, 0], look: 'metal' });
  if (hi) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.ball('chest', 0.011, '#8a6a2a', { at: [Math.sin(a) * 0.19, 0.2, -Math.cos(a) * 0.135], look: 'metal' });
    }
  }

  // Air tank with caps, straps and hoses looping over the shoulders to the collar.
  b.cyl('chest', 0.075, 0.075, 0.32, COPPER, { at: [0, 0.03, 0.19], look: 'metal' });
  b.ball('chest', 0.075, COPPER, { at: [0, 0.19, 0.19], scale: [1, 0.6, 1], look: 'metal' });
  b.ball('chest', 0.075, COPPER, { at: [0, -0.13, 0.19], scale: [1, 0.6, 1], look: 'metal' });
  b.cyl('chest', 0.025, 0.03, 0.05, BRASS, { at: [0, 0.235, 0.19], look: 'metal' });
  b.mirror((_, sign) => {
    b.box('chest', [0.04, 0.26, 0.012], RUBBER, { at: [sign * 0.1, 0.06, -0.122], look: 'rubber' });
    b.box('chest', [0.04, 0.26, 0.012], RUBBER, { at: [sign * 0.1, 0.06, 0.13], look: 'rubber' });
  });
  b.mirror((_, sign) =>
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
    )
  );

  // Seams, knee patches, brass cuffs, lead weights.
  if (d1) b.box('chest', [0.014, 0.2, 0.012], SEAM, { at: [0, 0.06, -0.122], look: 'rubber' });
  b.mirror((side, sign) => {
    b.blob(`shin${side}`, [0.11, 0.1, 0.05], SEAM, { at: [0, -0.02, -0.06], look: 'rubber' });
    b.cyl(`forearm${side}`, 0.056, 0.056, 0.025, BRASS, { at: [0, -0.205, 0], look: 'metal' });
    b.box('pelvis', [0.07, 0.07, 0.05], '#5d646c', { at: [sign * 0.1, 0.03, -0.12], look: 'metal' });
    b.box('pelvis', [0.07, 0.07, 0.05], '#5d646c', { at: [sign * 0.1, 0.03, 0.12], look: 'metal' });
    b.cyl(`foot${side}`, 0.072, 0.072, 0.03, BRASS, { at: [0, 0.07, 0], look: 'metal' });
  });
}

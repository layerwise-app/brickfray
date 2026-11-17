import { buildBody } from '../body';
import type { PartSet } from '../parts';

const TEAL = '#1fa7a0';
const WHITE = '#f2f2ee';
const SKIN = '#f1c7a1';
const HAIR = '#b5502a';
const SCARF = '#f5a623';
const DARK = '#2a2f38';

/** Vega: lean scout in a teal/white jacket, goggles up, long trailing scarf, high ponytail, fingerless gloves. */
export function vega(b: PartSet) {
  const bulk = 0.92;
  buildBody(b, {
    skin: SKIN,
    shirt: TEAL,
    sleeve: TEAL,
    glove: DARK,
    fingers: SKIN,
    pants: '#39424e',
    boot: '#e4e7ea',
    sole: TEAL,
    belt: DARK,
    bulk,
    limbs: 0.93,
    brow: HAIR,
    browTilt: 0.05,
    mouth: 'smile'
  });
  const hi = b.detail > 1;

  // Jacket: white yoke and sleeve stripes, raised collar, zip.
  b.taper('chest', [0.36 * bulk, 0.2], [0.4 * bulk, 0.225], 0.09, WHITE, { at: [0, 0.165, 0], look: 'cloth' });
  b.mirror((side) => b.cyl(`upperArm${side}`, 0.0565, 0.055, 0.07, WHITE, { at: [0, -0.04, 0], look: 'cloth' }));
  b.mirror((side) => b.cyl(`forearm${side}`, 0.049, 0.047, 0.03, WHITE, { at: [0, -0.15, 0], look: 'cloth' }));
  b.cyl('chest', 0.075, 0.085, 0.07, TEAL, { at: [0, 0.255, 0.0], look: 'cloth' });
  if (b.detail > 0) b.box('chest', [0.012, 0.24, 0.01], '#cfd6da', { at: [0.02, 0.08, -0.112], look: 'metal' });
  b.taper('spine', [0.29, 0.19], [0.29 * bulk + 0.02, 0.2], 0.05, TEAL, { at: [0, 0.0, 0], look: 'cloth' });

  // Scarf knot at the throat and its tail on the swinging back bone.
  b.torus('chest', 0.08, 0.03, SCARF, { at: [0, 0.245, 0], rot: [Math.PI / 2, 0, 0], look: 'cloth' });
  b.blob('chest', [0.07, 0.06, 0.05], SCARF, { at: [-0.045, 0.22, -0.09], look: 'cloth' });
  b.box('dangleBack', [0.08, 0.5, 0.02], SCARF, { at: [0.0, -0.23, 0.0], rot: [0.05, 0, 0.04], look: 'cloth' });
  if (b.detail > 0) b.box('dangleBack', [0.082, 0.025, 0.024], '#d98a1a', { at: [0, -0.43, 0.0], look: 'cloth' });

  // Hair cap, bangs and the high ponytail on the head's swinging bone.
  b.blob('head', [0.25, 0.14, 0.265], HAIR, { at: [0, 0.178, 0.012], look: 'cloth', e: 0.55 });
  b.box('head', [0.2, 0.045, 0.03], HAIR, { at: [0.02, 0.19, -0.12], rot: [0, 0, -0.12], look: 'cloth' });
  b.blob('head', [0.25, 0.13, 0.1], HAIR, { at: [0, 0.1, 0.09], look: 'cloth', e: 0.6 });
  b.cyl('dangleHead', 0.03, 0.03, 0.035, TEAL, { at: [0, 0.0, 0.0], rot: [0.5, 0, 0], look: 'gloss' });
  b.blob('dangleHead', [0.075, 0.2, 0.07], HAIR, { at: [0, -0.1, 0.03], look: 'cloth', e: 0.7, taper: 0.4 });
  if (b.detail > 0) b.blob('dangleHead', [0.05, 0.12, 0.05], HAIR, { at: [0, -0.23, 0.05], look: 'cloth', e: 0.8, taper: 0.5 });

  // Goggles pushed up on the forehead.
  b.torus('head', 0.128, 0.012, DARK, { at: [0, 0.185, 0.0], rot: [Math.PI / 2 - 0.2, 0, 0], scale: [1, 1.05, 1], look: 'rubber' });
  b.mirror((_, sign) => {
    b.cyl('head', 0.033, 0.035, 0.03, '#3a3f45', { at: [sign * 0.045, 0.205, -0.12], rot: [Math.PI / 2 - 0.5, 0, 0], look: 'metal' });
    b.cyl('head', 0.027, 0.027, 0.01, '#ffb347', { at: [sign * 0.045, 0.214, -0.135], rot: [Math.PI / 2 - 0.5, 0, 0], look: 'glass' });
  });

  // Lashes.
  if (b.detail > 0) b.mirror((_, sign) => b.box('head', [0.03, 0.009, 0.012], '#1d2026', { at: [sign * 0.058, 0.1, -0.124], rot: [0, 0, sign * -0.35], look: 'gloss' }));

  // Scout kit: thigh pouch, belt pouch, knee pads.
  b.box('thighL', [0.06, 0.1, 0.11], DARK, { at: [-0.06, -0.2, -0.0], look: 'rubber' });
  b.box('pelvis', [0.06, 0.06, 0.05], TEAL, { at: [0.13, 0.03, -0.1], look: 'cloth' });
  if (hi) b.mirror((side) => b.blob(`shin${side}`, [0.08, 0.08, 0.04], DARK, { at: [0, -0.03, -0.055], look: 'rubber' }));
}

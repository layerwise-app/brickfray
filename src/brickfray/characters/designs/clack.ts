import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { cuirass, DARK_STEEL, GOLD, LEATHER, MAIL, RED, STEEL, swordBelt } from './clack-armor';
import { arms, legs, sabatons } from './clack-limbs';
import { helm, plume } from './clack-helm';

/** Sir Clack: polished plate under a red tabard with a gold tower, prowed armet with a red plume, sword belt. */
export function clack(b: PartSet) {
  const low = b.detail === 0;
  buildBody(b, {
    skin: '#d9a582',
    shirt: STEEL,
    shirtLook: 'metal',
    sleeve: MAIL,
    glove: DARK_STEEL,
    gloveLook: 'metal',
    pants: MAIL,
    pantsLook: 'metal',
    boot: STEEL,
    bootLook: 'metal',
    sole: '#3a3f45',
    belt: low ? LEATHER : undefined,
    buckle: GOLD,
    bulk: 1.06,
    omit: low ? ['head', 'shins'] : ['head', 'neck', 'chest', 'abdomen', 'hips', 'shins', 'boots']
  });
  if (low) return blocky(b);
  cuirass(b);
  swordBelt(b, b.hero && stance.melee === true);
  arms(b);
  legs(b);
  sabatons(b);
  helm(b);
  plume(b);
}

/** The low tier: the same knight in a handful of blocks. */
function blocky(b: PartSet) {
  const bulk = 1.06;
  b.taper('chest', [0.33 * bulk, 0.215], [0.42 * bulk, 0.24], 0.26, STEEL, { at: [0, 0.08, 0], look: 'metal' });
  b.cyl('chest', 0.09, 0.105, 0.06, STEEL, { at: [0, 0.235, 0], look: 'metal' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, -0.124], look: 'cloth' });
  b.taper('spine', [0.19, 0.012], [0.2, 0.012], 0.16, RED, { at: [0, 0.06, -0.106], look: 'cloth' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, 0.124], look: 'cloth' });
  b.torus('chest', 0.045, 0.011, GOLD, { at: [0, 0.1, -0.132], look: 'gold' });
  b.box('chest', [0.018, 0.075, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });
  b.box('chest', [0.075, 0.018, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });
  b.taper('pelvis', [0.3, 0.2], [0.33, 0.215], 0.07, STEEL, { at: [0, -0.02, 0], look: 'metal' });
  b.box('pelvis', [0.2, 0.17, 0.014], RED, { at: [0, -0.13, -0.112], look: 'cloth' });
  b.box('pelvis', [0.22, 0.17, 0.014], RED, { at: [0, -0.13, 0.112], look: 'cloth' });
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    b.taper(`thigh${side}`, [0.15, 0.15], [0.17, 0.17], 0.13, STEEL, { at: [sign * 0.01, -0.09, 0], look: 'metal' });
    b.limb(`shin${side}`, 0.064, 0.056, 0.26, STEEL, { at: [0, -0.04, 0], look: 'metal' });
    b.ball(`shin${side}`, 0.064, STEEL, { look: 'metal' });
    b.blob(ua, [0.2, 0.09, 0.2], STEEL, { at: [sign * 0.02, 0.03, 0], rot: [0, 0, sign * -0.35], look: 'metal', e: 0.6 });
    b.blob(ua, [0.17, 0.06, 0.18], STEEL, { at: [sign * 0.04, -0.035, 0], rot: [0, 0, sign * -0.5], look: 'metal', e: 0.6 });
    b.ball(`forearm${side}`, 0.054, STEEL, { look: 'metal' });
    b.cyl(`forearm${side}`, 0.066, 0.05, 0.08, STEEL, { at: [0, -0.21, 0], look: 'metal' });
  });
  b.cyl('neck', 0.05, 0.055, 0.1, MAIL, { at: [0, 0.03, 0], look: 'metal' });
  b.blob('head', [0.265, 0.315, 0.28], STEEL, { at: [0, 0.098, 0], look: 'metal', e: 0.72, keep: true });
  b.cyl('head', 0.137, 0.137, 0.035, DARK_STEEL, { at: [0, 0.125, 0], scale: [1, 1, 1.04], look: 'metal' });
  b.box('head', [0.2, 0.02, 0.03], '#15181c', { at: [0, 0.085, -0.135], look: 'rubber' });
  b.box('head', [0.02, 0.17, 0.02], STEEL, { at: [0, 0.02, -0.14], look: 'metal' });
  b.cyl('dangleHead', 0.018, 0.024, 0.04, GOLD, { look: 'gold' });
  b.blob('dangleHead', [0.05, 0.2, 0.17], RED, { at: [0, 0.1, 0.05], rot: [0.3, 0, 0], look: 'cloth', e: 0.8 });
}

/** Signature showroom pose: at ease like a statue, shotgun on the shoulder, sword lowered in the off hand. */
export const stance: Stance = {
  pelvis: { at: [-0.07, -0.012, 0], rot: [0.12, 0, 0.07] },
  chest: [-0.1, 0.05, -0.035],
  head: [-0.42, 0.03, -0.03],
  feet: {
    L: { at: [-0.135, 0, 0.03], heading: -0.3 },
    R: { at: [0.19, 0, -0.1], heading: 0.6 }
  },
  arms: {
    R: { wrist: [0.22, 0.06, -0.357], hand: [0, 2.0, 0], elbow: [0.5, -1, 0.1], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.42, 0.98, -0.14], hand: [-0.85, -1.12, -1.57], elbow: [-0.8, -0.2, 1], shape: 'cup' }
  },
  melee: true,
  life: { breath: 0.8, sway: 0.5, look: 0.6 }
};

import { lowBlob, kneePads, lowLimb, lowTaper, lowVisor } from '../body-low';
import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { cuirass, DARK_STEEL, GOLD, LEATHER, MAIL, MAIL_LOOK, RED, STEEL, swordBelt } from './clack-armor';
import { arms, legs, sabatons } from './clack-limbs';
import { helm, plume } from './clack-helm';

/** Sir Clack: polished plate under a red tabard with a gold tower, prowed armet with a red plume, sword belt. */
export function clack(b: PartSet) {
  const low = b.detail === 0;
  buildBody(b, {
    skin: '#d9a582',
    shirt: STEEL,
    shirtLook: low ? 'metal' : MAIL_LOOK,
    sleeve: MAIL,
    glove: DARK_STEEL,
    gloveLook: 'metal',
    fingerGirth: 1.3,
    joints: 'hinge',
    pants: MAIL,
    pantsLook: low ? 'metal' : MAIL_LOOK,
    boot: STEEL,
    bootLook: 'metal',
    sole: '#3a3f45',
    belt: low ? LEATHER : undefined,
    buckle: GOLD,
    bulk: 1.06,
    omit: low ? ['head', 'shins'] : ['head', 'neck', 'chest', 'abdomen', 'hips', 'thighs', 'shins', 'boots']
  });
  if (low) return blocky(b);
  cuirass(b);
  swordBelt(b, b.hero && !!stance.melee);
  arms(b);
  legs(b);
  sabatons(b);
  helm(b);
  plume(b);
}

/** The low tier: the same knight in a handful of blocks. */
function blocky(b: PartSet) {
  const bulk = 1.06;
  lowTaper(b, 'chest', [0.33 * bulk, 0.215], [0.42 * bulk, 0.24], 0.26, STEEL, { at: [0, 0.08, 0], look: 'metal', caps: 'top' });
  b.cyl('chest', 0.09, 0.105, 0.06, STEEL, { at: [0, 0.235, 0], look: 'metal' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, -0.124], look: 'cloth' });
  b.taper('spine', [0.19, 0.012], [0.2, 0.012], 0.16, RED, { at: [0, 0.06, -0.106], look: 'cloth' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, 0.124], look: 'cloth' });
  b.torus('chest', 0.045, 0.011, GOLD, { at: [0, 0.1, -0.132], look: 'gold' });
  b.box('chest', [0.018, 0.075, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });
  b.box('chest', [0.075, 0.018, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });
  b.taper('pelvis', [0.3, 0.2], [0.33, 0.215], 0.07, STEEL, { at: [0, -0.02, 0], look: 'metal' });
  b.taper('pelvis', [0.24, 0.016], [0.2, 0.016], 0.19, RED, { at: [0, -0.135, -0.118], rot: [0.1, 0, 0], look: 'cloth' });
  b.taper('pelvis', [0.26, 0.016], [0.22, 0.016], 0.19, RED, { at: [0, -0.135, 0.118], rot: [-0.1, 0, 0], look: 'cloth' });
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    lowTaper(b, `thigh${side}`, [0.15, 0.15], [0.17, 0.17], 0.13, STEEL, { at: [sign * 0.01, -0.09, 0], look: 'metal' });
    lowLimb(b, `shin${side}`, 0.064, 0.064, 0.056, 0.26, -0.04, STEEL, 'metal', 6, 3);
    lowBlob(b, ua, [0.2, 0.1, 0.2], STEEL, { at: [sign * 0.02, 0.03, 0], rot: [0, 0, sign * -0.35], look: 'metal', e: 0.68, seg: 6 });
    lowBlob(b, ua, [0.17, 0.065, 0.18], STEEL, { at: [sign * 0.04, -0.035, 0], rot: [0, 0, sign * -0.5], look: 'metal', e: 0.68, seg: 6 });
    b.ball(`forearm${side}`, 0.054, STEEL, { look: 'metal' });
    b.cyl(`forearm${side}`, 0.066, 0.05, 0.08, STEEL, { at: [0, -0.21, 0], look: 'metal' });
    // Sabatons: a lame across the instep, so the steel boots read as plate.
    b.box(`foot${side}`, [0.118, 0.012, 0.05], DARK_STEEL, { at: [0, 0.012, -0.045], rot: [-0.42, 0, 0], look: 'metal' });
  });
  kneePads(b, 1.1, STEEL, 'metal');
  b.cyl('neck', 0.05, 0.055, 0.1, MAIL, { at: [0, 0.03, 0], look: 'metal' });
  lowBlob(b, 'head', [0.265, 0.315, 0.28], STEEL, { at: [0, 0.098, 0], look: 'metal', e: 0.8, seg: 11 });
  b.cyl('head', 0.135, 0.135, 0.035, DARK_STEEL, { at: [0, 0.125, 0], scale: [1, 1, 1.04], look: 'metal', seg: 10 });
  lowVisor(b, STEEL);
  b.cyl('dangleHead', 0.018, 0.024, 0.04, GOLD, { look: 'gold' });
  lowBlob(b, 'dangleHead', [0.05, 0.2, 0.17], RED, { at: [0, 0.1, 0.05], rot: [0.3, 0, 0], look: 'cloth', e: 0.8, seg: 5 });
}

/** Planted low like a brawler: sword raised in the left gauntlet, shotgun at the right hip angled down past the viewer, visor squared to the viewer. */
export const stance: Stance = {
  pelvis: { at: [0.045, -0.075, 0.02], rot: [-0.55, 0.1, 0.07] },
  chest: [-0.4, -0.1, 0],
  head: [-0.55, 0.12, 0],
  feet: {
    L: { at: [-0.29, 0, 0.15], heading: -1.2, knee: -0.02 },
    R: { at: [0.2, 0, -0.17], heading: 0.1, knee: 0.2 }
  },
  arms: {
    R: { wrist: [0.27, -0.1, -0.16], hand: [0.8, -0.12, -0.15], elbow: [0.068, -0.777, 0.625], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.324, 0.143, -0.108], hand: [0.085, 0.576, 0.43], elbow: [-0.229, -0.881, 0.415], space: 'chest', shape: 'hold' }
  },
  melee: { head: 'thumb' },
  life: { breath: 0.8, sway: 0.4, look: 0.5 }
};

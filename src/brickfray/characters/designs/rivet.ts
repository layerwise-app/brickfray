import { buildBody } from '../body';
import { lowBand, lowBlob, kneePads, lowTaper } from '../body-low';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { armKit, hardHat, legKit, LEGS, toolBelt } from './rivet-gear';
import { headKit } from './rivet-hair';
import { C, vest } from './rivet-vest';

const { orange: ORANGE, navy: NAVY, skin: SKIN, yellow: YELLOW, tape: REFLECT, leather: LEATHER, khaki: KHAKI } = C;

/** Rivet: stocky builder in a hi-vis vest, hard hat, tool belt, rolled sleeves and chunky boots. */
export function rivet(b: PartSet) {
  const bulk = 1.12;
  buildBody(b, {
    skin: SKIN,
    shirt: NAVY,
    sleeve: NAVY,
    forearm: SKIN,
    forearmLook: 'skin',
    elbow: SKIN,
    glove: YELLOW,
    gloveLook: 'cloth',
    pants: KHAKI,
    boot: '#6b4428',
    sole: '#262a2e',
    belt: LEATHER,
    buckle: '#c0c4c8',
    bulk,
    limbs: 1.08,
    legs: LEGS,
    nose: 1.3,
    brow: '#3b2a1e',
    browTilt: -0.12,
    mouth: 'grin',
    expression: { open: 0.96, squint: 0.42, brows: [0.006, 0.006] }
  });
  if (b.detail === 0) return blockCostume(b, bulk);
  vest(b);
  armKit(b);
  toolBelt(b);
  hardHat(b);
  headKit(b);
  if (b.detail >= 2) legKit(b);
  else kneePads(b, LEGS, C.dark, 'rubber', '#555c63');
}

/** Mallet resting on top of the left shoulder (fist up by the collarbone, handle over the deltoid, head behind), nailer up and ready in the right fist, hips cocked onto the right leg, grinning at the viewer. */
export const stance: Stance = {
  pelvis: { at: [0.1, -0.03, 0], rot: [0.12, 0, 0.17] },
  chest: [-0.1, 0.08, -0.13],
  waist: 1,
  head: [-0.45, 0.06, 0.02],
  feet: {
    R: { at: [0.14, 0, 0.03], heading: 0.3 },
    L: { at: [-0.26, 0, -0.16], heading: -0.6, knee: 0.15 }
  },
  arms: {
    R: { wrist: [0.25, -0.12, -0.19], hand: [0.75, 0.45, 0.05], elbow: [0.1, -0.95, 0.3], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.2, 0.125, -0.16], hand: [0, 1.135, 0], elbow: [-0.6, -1, 0.1], space: 'chest', shape: 'hold' }
  },
  melee: { head: 'thumb', slide: -0.035, twist: 0.9 },
  life: { breath: 1, sway: 0.6, look: 0.5 }
};

/** The low tier's costume: a few boxes that keep the silhouette and colours. */
function blockCostume(b: PartSet, bulk: number) {
  // Hi-vis vest over chest and waist, with a zip line and reflective bands.
  lowTaper(b, 'chest', [0.33 * bulk, 0.21], [0.41 * bulk, 0.235], 0.24, ORANGE, { at: [0, 0.08, 0], look: 'cloth', caps: 'top' });
  lowTaper(b, 'spine', [0.3, 0.2], [0.32 * bulk, 0.21], 0.15, ORANGE, { at: [0, 0.07, 0], look: 'cloth' });
  for (const [bone, y, w, d] of [
    ['chest', 0.03, 0.375 * bulk, 0.228],
    ['spine', 0.07, 0.32 * bulk, 0.212]
  ] as const) {
    lowTaper(b, bone, [w + 0.006, d + 0.006], [w + 0.006, d + 0.006], 0.028, REFLECT, { at: [0, y, 0], look: 'gloss' });
  }
  b.mirror((_, sign) => {
    b.box('chest', [0.03, 0.2, 0.012], REFLECT, { at: [sign * 0.085, 0.11, -0.118], look: 'gloss' });
    b.box('chest', [0.03, 0.2, 0.012], REFLECT, { at: [sign * 0.085, 0.11, 0.118], look: 'gloss' });
  });
  b.box('chest', [0.07, 0.17, 0.01], NAVY, { at: [0, 0.13, -0.116], look: 'cloth' });

  // Rolled sleeve cuffs.
  b.mirror((side) => lowBand(b, `upperArm${side}`, 'upperArm', 1.08, -0.235, -0.195, 0.006, '#34476a', 'cloth'));

  // Knee pads: foam cups with hard shells.
  kneePads(b, LEGS, C.dark, 'rubber', '#555c63');

  // Tool belt: pouches, tape measure, hammer.
  b.mirror((_, sign) => b.box('pelvis', [0.06, 0.1, 0.11], LEATHER, { at: [sign * 0.175, -0.03, -0.02], look: 'rubber' }));
  b.box('pelvis', [0.055, 0.06, 0.035], YELLOW, { at: [-0.1, 0.0, -0.125], look: 'gloss' });

  // Hard hat with brim, peak and crown ridge.
  b.lathe(
    'hat',
    [
      [0, -0.056],
      [0.166, -0.056],
      [0.17, -0.048],
      [0.162, -0.042],
      [0.138, -0.038],
      [0.136, 0.0],
      [0.12, 0.04],
      [0.088, 0.066],
      [0.04, 0.079],
      [0, 0.082]
    ],
    YELLOW,
    { look: 'gloss', scale: [1.04, 1, 1.12] }
  );
  b.box('hat', [0.17, 0.012, 0.07], YELLOW, { at: [0, -0.05, -0.17], rot: [-0.12, 0, 0], look: 'gloss' });

  // Short hair under the hat, sideburns, stubble.
  lowBlob(b, 'head', [0.235, 0.1, 0.12], '#3b2a1e', { at: [0, 0.15, 0.075], look: 'cloth', e: 0.75, seg: 6 });
  b.mirror((_, sign) => b.box('head', [0.016, 0.06, 0.04], '#3b2a1e', { at: [sign * 0.117, 0.09, -0.03], look: 'cloth' }));
  b.box('head', [0.085, 0.022, 0.024], '#3b2a1e', { at: [0, 0.013, -0.128], look: 'cloth', bevel: 0.006 });
}

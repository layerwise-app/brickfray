import { buildBody } from '../body';
import type { PartSet } from '../parts';

const ORANGE = '#f58a1f';
const NAVY = '#2b3a55';
const SKIN = '#c98d62';
const YELLOW = '#f6c624';
const REFLECT = '#e4ebee';
const LEATHER = '#7a4a2a';
const KHAKI = '#7d6a4c';

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
    brow: '#3b2a1e',
    browTilt: -0.12,
    mouth: 'grin'
  });
  const hi = b.detail === 2;

  // Hi-vis vest over chest and waist, with a zip line and reflective bands.
  b.taper('chest', [0.33 * bulk, 0.21], [0.41 * bulk, 0.235], 0.24, ORANGE, { at: [0, 0.08, 0], look: 'cloth' });
  b.taper('spine', [0.3, 0.2], [0.32 * bulk, 0.21], 0.15, ORANGE, { at: [0, 0.07, 0], look: 'cloth' });
  for (const [bone, y, w, d] of [
    ['chest', 0.03, 0.375 * bulk, 0.228],
    ['spine', 0.07, 0.32 * bulk, 0.212]
  ] as const) {
    b.box(bone, [w + 0.006, 0.028, d + 0.006], REFLECT, { at: [0, y, 0], look: 'gloss' });
  }
  b.mirror((_, sign) => {
    b.box('chest', [0.03, 0.2, 0.012], REFLECT, { at: [sign * 0.085, 0.11, -0.118], look: 'gloss' });
    b.box('chest', [0.03, 0.2, 0.012], REFLECT, { at: [sign * 0.085, 0.11, 0.118], look: 'gloss' });
  });
  b.box('chest', [0.07, 0.17, 0.01], NAVY, { at: [0, 0.13, -0.116], look: 'cloth' });
  if (b.detail > 0) b.box('chest', [0.008, 0.24, 0.012], '#3a3f45', { at: [0.038, 0.08, -0.12], look: 'metal' });
  if (hi) b.box('chest', [0.07, 0.05, 0.016], ORANGE, { at: [-0.1, 0.12, -0.125], look: 'cloth' });

  // Rolled sleeve cuffs.
  b.mirror((side) => b.cyl(`upperArm${side}`, 0.062, 0.06, 0.04, '#34476a', { at: [0, -0.215, 0], look: 'cloth' }));

  // Tool belt: pouches, tape measure, hammer.
  b.mirror((_, sign) => {
    b.box('pelvis', [0.06, 0.1, 0.11], LEATHER, { at: [sign * 0.175, -0.03, -0.02], look: 'rubber' });
    if (b.detail > 0) b.box('pelvis', [0.066, 0.03, 0.115], '#8d5a33', { at: [sign * 0.177, 0.025, -0.02], look: 'rubber' });
  });
  b.box('pelvis', [0.055, 0.06, 0.035], YELLOW, { at: [-0.1, 0.0, -0.125], look: 'gloss' });
  if (b.detail > 0) {
    b.cyl('pelvis', 0.012, 0.012, 0.2, '#9a6a3a', { at: [0.19, -0.1, 0.07], rot: [0, 0, 0.15], look: 'cloth' });
    b.box('pelvis', [0.035, 0.035, 0.11], '#8c949b', { at: [0.2, 0.0, 0.07], look: 'metal' });
  }

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
  if (b.detail > 0) b.box('hat', [0.03, 0.022, 0.2], YELLOW, { at: [0, 0.078, 0.0], look: 'gloss', bevel: 0.008 });
  if (hi) b.mirror((_, sign) => b.box('hat', [0.014, 0.018, 0.16], '#e5b51c', { at: [sign * 0.05, 0.07, 0.0], look: 'gloss' }));

  // Short hair under the hat, sideburns, stubble.
  b.box('head', [0.23, 0.08, 0.1], '#3b2a1e', { at: [0, 0.16, 0.08], look: 'cloth' });
  b.mirror((_, sign) => b.box('head', [0.016, 0.06, 0.04], '#3b2a1e', { at: [sign * 0.117, 0.09, -0.03], look: 'cloth' }));
  b.box('head', [0.085, 0.022, 0.024], '#3b2a1e', { at: [0, 0.013, -0.128], look: 'cloth', bevel: 0.006 });
}

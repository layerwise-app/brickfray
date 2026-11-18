import { buildBody } from '../body';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { armKit, hardHat, headKit, legKit, toolBelt } from './rivet-gear';
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
    brow: '#3b2a1e',
    browTilt: -0.12,
    mouth: 'grin'
  });
  if (b.detail === 0) return blockCostume(b, bulk);
  vest(b);
  armKit(b);
  toolBelt(b);
  hardHat(b);
  headKit(b);
  if (b.detail >= 2) legKit(b);
}

/** Mallet over the left shoulder, nailer hanging in the right hand, weight on the right leg, grinning at the viewer. */
export const stance: Stance = {
  pelvis: { at: [0.03, 0, 0], rot: [0.12, 0, -0.05] },
  chest: [-0.24, 0.07, 0.05],
  head: [-0.5, 0.08, -0.05],
  feet: {
    R: { at: [0.205, 0, 0.05], heading: 0.38 },
    L: { at: [-0.235, 0, -0.07], heading: -0.5, knee: 0.1 }
  },
  arms: {
    R: { wrist: [0.27, -0.26, -0.07], hand: [0.3, -1.15, 0], elbow: [0.6, -0.2, 1], space: 'chest', shape: 'grip' },
    L: { wrist: [-0.198, 0.179, -0.243], hand: [-2.972, 0.583, 3.048], elbow: [-0.5, -1, 0.1], space: 'chest', shape: 'fist' }
  },
  melee: true,
  life: { breath: 1, sway: 0.6, look: 0.5 }
};

/** The low tier's costume: a few boxes that keep the silhouette and colours. */
function blockCostume(b: PartSet, bulk: number) {
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

  // Rolled sleeve cuffs.
  b.mirror((side) => b.cyl(`upperArm${side}`, 0.062, 0.06, 0.04, '#34476a', { at: [0, -0.215, 0], look: 'cloth' }));

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
  b.box('head', [0.23, 0.08, 0.1], '#3b2a1e', { at: [0, 0.16, 0.08], look: 'cloth' });
  b.mirror((_, sign) => b.box('head', [0.016, 0.06, 0.04], '#3b2a1e', { at: [sign * 0.117, 0.09, -0.03], look: 'cloth' }));
  b.box('head', [0.085, 0.022, 0.024], '#3b2a1e', { at: [0, 0.013, -0.128], look: 'cloth', bevel: 0.006 });
}

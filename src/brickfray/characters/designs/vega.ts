import { buildBody } from '../body';
import { tone } from '../body-kit';
import { heroDrape } from '../hero-assets';
import { lowBand, lowBlob, kneePads, lowTaper } from '../body-low';
import type { PartSet } from '../parts';
import type { Stance } from '../stance';
import { C, freckles, goggles, hair, smirk } from './vega-hair';
import { binoculars, fieldKit, jacket, legKit, scarf, sleeves } from './vega-kit';
import { jacketBack, scarfTails, trousers } from './vega-trim';

const { teal: TEAL, white: WHITE, skin: SKIN, hair: HAIR, scarf: SCARF, dark: DARK } = C;

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
    fore: { half: [0.025, 0.024], corner: 0.009, yaw: 0.45, roll: 0.3, seat: 0.004, sink: 0.004 },
    brow: HAIR,
    browTilt: 0.05,
    mouth: b.detail >= 1 ? 'none' : 'smirk',
    lashes: true,
    blush: '#f0a78f',
    expression: { open: 0.93, squint: 0.22, lidTilt: -0.03, brows: [-0.002, 0.008], gaze: [0.2, 0.15] },
    omit: b.detail >= 2 ? ['upperArms'] : []
  });
  if (b.detail === 0) return blockCostume(b, bulk);
  smirk(b);
  jacket(b);
  sleeves(b);
  scarf(b);
  const draped = b.hero ? heroDrape('vega-scarf') : undefined;
  if (draped) {
    b.add('dangleBack', draped.long!, C.scarf, { look: 'cloth' });
    b.add('dangleBack', draped.longInner!, tone(C.scarf, 0.82), { look: 'cloth' });
    b.add('dangleBack', draped.stripe!, C.scarfDark, { look: 'cloth' });
    b.add('dangleBack', draped.short!, C.scarfDark, { look: 'cloth' });
    b.add('dangleBack', draped.shortInner!, tone(C.scarfDark, 0.82), { look: 'cloth' });
    if (draped.shortStripe) b.add('dangleBack', draped.shortStripe, C.scarf, { look: 'cloth' });
  } else scarfTails(b);
  hair(b);
  goggles(b);
  fieldKit(b);
  binoculars(b);
  if (b.detail >= 2) {
    legKit(b);
    jacketBack(b);
    trousers(b);
  } else kneePads(b, 0.93, DARK, 'rubber', WHITE);
  if (b.hero) freckles(b);
}

/** Rifle at a high ready in both hands, muzzle up past the right shoulder; feet planted wide on straight legs, the back foot turned out where the menu camera sees it, chin up to the viewer. */
export const stance: Stance = {
  pelvis: { at: [0.06, -0.04, 0.06], rot: [0.45, -0.04, 0.06] },
  chest: [0.2, -0.06, -0.02],
  head: [-0.38, 0.14, 0.06],
  feet: {
    L: { at: [-0.21, 0, -0.14], heading: -0.55, knee: 0.15 },
    R: { at: [0.29, 0, 0.27], heading: 0.85, knee: 0.1 }
  },
  arms: {
    R: { wrist: [0.17, 0.053, -0.184], hand: [0.298, 0.88, -0.446], elbow: [-0.037, -0.996, 0.079], space: 'chest', shape: 'grip' },
    L: { wrist: [0.193, 0.342, -0.288], hand: [1.467, 0.254, 0.71], elbow: [-0.59, -0.64, -0.49], space: 'chest', shape: 'hold' }
  },
  life: { breath: 1, sway: 0.5, look: 0.5 }
};

/** The low tier's costume: a few boxes that keep the silhouette and colours. */
function blockCostume(b: PartSet, bulk: number) {
  // Jacket: white yoke and sleeve stripes, raised collar, zip.
  lowTaper(b, 'chest', [0.36 * bulk, 0.2], [0.4 * bulk, 0.225], 0.09, WHITE, { at: [0, 0.165, 0], look: 'cloth', caps: 'top' });
  b.mirror((side) => lowBand(b, `upperArm${side}`, 'upperArm', 0.93, -0.075, -0.005, 0.003, WHITE, 'cloth'));
  b.mirror((side) => lowBand(b, `forearm${side}`, 'forearm', 0.93, -0.165, -0.135, 0.003, WHITE, 'cloth'));
  b.cyl('chest', 0.075, 0.085, 0.07, TEAL, { at: [0, 0.255, 0.0], look: 'cloth' });
  lowTaper(b, 'spine', [0.29, 0.19], [0.29 * bulk + 0.02, 0.2], 0.05, TEAL, { at: [0, 0.0, 0], look: 'cloth' });

  // Scarf round the neck, its knot behind her left shoulder and its tail on the swinging back bone.
  b.torus('chest', 0.08, 0.03, SCARF, { at: [0, 0.245, 0], rot: [Math.PI / 2, 0, 0], look: 'cloth' });
  b.blob('chest', [0.06, 0.06, 0.05], SCARF, { at: [-0.07, 0.236, 0.1], look: 'cloth' });
  b.box('dangleBack', [0.075, 0.46, 0.02], SCARF, { at: [-0.045, -0.215, 0.0], rot: [0.05, 0, 0.04], look: 'cloth' });

  // Hair cap, bangs and the high ponytail on the head's swinging bone.
  lowBlob(b, 'head', [0.255, 0.15, 0.27], HAIR, { at: [0, 0.176, 0.012], look: 'cloth', e: 0.72, seg: 8 });
  b.box('head', [0.2, 0.045, 0.03], HAIR, { at: [0.02, 0.19, -0.12], rot: [0, 0, -0.12], look: 'cloth' });
  // The back of the head is covered down to the nape, narrowing so none of it shows beside the jaw from the front;
  // the ponytail stands off it and falls to the shoulders.
  lowBlob(b, 'head', [0.215, 0.2, 0.14], HAIR, { at: [0, 0.08, 0.09], look: 'cloth', e: 0.62, taper: 0.4, seg: 6 });
  b.cyl('dangleHead', 0.034, 0.034, 0.04, TEAL, { at: [0, -0.01, 0.045], rot: [0.5, 0, 0], look: 'gloss' });
  lowBlob(b, 'dangleHead', [0.11, 0.38, 0.1], HAIR, { at: [0, -0.18, 0.085], rot: [-0.18, 0, 0], look: 'cloth', e: 0.8, taper: 0.5, seg: 6 });

  // Goggles pushed up on the forehead.
  b.torus('head', 0.128, 0.012, DARK, { at: [0, 0.185, 0.0], rot: [Math.PI / 2 - 0.2, 0, 0], scale: [1, 1.05, 1], look: 'rubber' });
  b.mirror((_, sign) => {
    b.cyl('head', 0.033, 0.035, 0.03, '#3a3f45', { at: [sign * 0.045, 0.205, -0.12], rot: [Math.PI / 2 - 0.5, 0, 0], look: 'metal', seg: 5 });
    b.cyl('head', 0.027, 0.027, 0.01, '#ffb347', { at: [sign * 0.045, 0.214, -0.135], rot: [Math.PI / 2 - 0.5, 0, 0], look: 'glass', seg: 5 });
  });

  // Scout kit: thigh pouch, belt pouch, knee pads.
  b.box('thighL', [0.06, 0.1, 0.11], DARK, { at: [-0.06, -0.2, -0.0], look: 'rubber' });
  b.box('pelvis', [0.06, 0.06, 0.05], TEAL, { at: [0.13, 0.03, -0.1], look: 'cloth' });
  kneePads(b, 0.93, DARK, 'rubber', WHITE);
}

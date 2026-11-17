import { buildBody } from '../body';
import type { PartSet } from '../parts';

const STEEL = '#b9c0c8';
const DARK_STEEL = '#7d848c';
const RED = '#c8231b';
const GOLD = '#d4a640';
const MAIL = '#6b737b';

/** Sir Clack: plate armor under a red tabard, visored great helm with a red plume, layered pauldrons, gauntlets. */
export function clack(b: PartSet) {
  const bulk = 1.06;
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
    belt: '#5b3a24',
    buckle: GOLD,
    bulk,
    omit: ['head', 'shins']
  });
  const d1 = b.detail > 0;
  const hi = b.detail > 1;

  // Breastplate with a center ridge, gorget, red tabard and emblem.
  b.taper('chest', [0.33 * bulk, 0.215], [0.42 * bulk, 0.24], 0.26, STEEL, { at: [0, 0.08, 0], look: 'metal' });
  b.cyl('chest', 0.09, 0.105, 0.06, STEEL, { at: [0, 0.235, 0], look: 'metal' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, -0.124], look: 'cloth' });
  b.taper('spine', [0.19, 0.012], [0.2, 0.012], 0.16, RED, { at: [0, 0.06, -0.106], look: 'cloth' });
  b.taper('chest', [0.2, 0.012], [0.25, 0.012], 0.26, RED, { at: [0, 0.07, 0.124], look: 'cloth' });
  b.torus('chest', 0.045, 0.011, GOLD, { at: [0, 0.1, -0.132], look: 'gold' });
  b.box('chest', [0.018, 0.075, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });
  b.box('chest', [0.075, 0.018, 0.012], GOLD, { at: [0, 0.1, -0.133], look: 'gold' });

  // Faulds and a short tabard skirt; tassets ride on the thighs so legs never clip them.
  b.taper('pelvis', [0.3, 0.2], [0.33, 0.215], 0.07, STEEL, { at: [0, -0.02, 0], look: 'metal' });
  b.box('pelvis', [0.2, 0.17, 0.014], RED, { at: [0, -0.13, -0.112], look: 'cloth' });
  b.box('pelvis', [0.22, 0.17, 0.014], RED, { at: [0, -0.13, 0.112], look: 'cloth' });
  b.mirror((side, sign) => {
    b.taper(`thigh${side}`, [0.15, 0.15], [0.17, 0.17], 0.13, STEEL, { at: [sign * 0.01, -0.09, 0], look: 'metal' });
    b.limb(`shin${side}`, 0.064, 0.056, 0.26, STEEL, { at: [0, -0.04, 0], look: 'metal' });
    b.ball(`shin${side}`, 0.064, STEEL, { look: 'metal' });
    if (d1) b.blob(`shin${side}`, [0.1, 0.06, 0.03], STEEL, { at: [0, 0.0, -0.06], look: 'metal' });
  });

  // Layered pauldrons, couters and flared gauntlet cuffs.
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    b.blob(ua, [0.2, 0.09, 0.2], STEEL, { at: [sign * 0.02, 0.03, 0], rot: [0, 0, sign * -0.35], look: 'metal', e: 0.6 });
    b.blob(ua, [0.17, 0.06, 0.18], STEEL, { at: [sign * 0.04, -0.035, 0], rot: [0, 0, sign * -0.5], look: 'metal', e: 0.6 });
    if (d1) b.blob(ua, [0.15, 0.05, 0.16], STEEL, { at: [sign * 0.05, -0.085, 0], rot: [0, 0, sign * -0.6], look: 'metal', e: 0.6 });
    if (hi) b.ball(ua, 0.008, GOLD, { at: [sign * 0.05, 0.06, -0.06], look: 'gold' });
    b.ball(`forearm${side}`, 0.054, STEEL, { look: 'metal' });
    if (d1) b.blob(`forearm${side}`, [0.03, 0.08, 0.08], STEEL, { at: [sign * 0.05, 0.0, 0.01], look: 'metal' });
    b.cyl(`forearm${side}`, 0.066, 0.05, 0.08, STEEL, { at: [0, -0.21, 0], look: 'metal' });
  });

  // Great helm: rounded barrel, brow band with rivets, visor slit, breaths and a ridge.
  b.cyl('neck', 0.05, 0.055, 0.1, MAIL, { at: [0, 0.03, 0], look: 'metal' });
  b.blob('head', [0.265, 0.315, 0.28], STEEL, { at: [0, 0.098, 0], look: 'metal', e: 0.72, keep: true });
  b.cyl('head', 0.137, 0.137, 0.035, DARK_STEEL, { at: [0, 0.125, 0], scale: [1, 1, 1.04], look: 'metal' });
  b.box('head', [0.2, 0.02, 0.03], '#15181c', { at: [0, 0.085, -0.135], look: 'rubber' });
  b.box('head', [0.02, 0.17, 0.02], STEEL, { at: [0, 0.02, -0.14], look: 'metal' });
  if (d1) b.torus('head', 0.142, 0.012, STEEL, { at: [0, 0.1, 0], rot: [0, Math.PI / 2, 0], arc: Math.PI, look: 'metal' });
  if (hi) {
    for (let j = 0; j < 3; j++) b.box('head', [0.01, 0.05, 0.01], '#15181c', { at: [0.035 + j * 0.022, 0.0, -0.138], look: 'rubber' });
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * Math.PI * 2;
      b.ball('head', 0.009, GOLD, { at: [Math.sin(a) * 0.139, 0.125, -Math.cos(a) * 0.144], look: 'gold' });
    }
  }
  b.cyl('dangleHead', 0.018, 0.024, 0.04, GOLD, { look: 'gold' });
  b.blob('dangleHead', [0.05, 0.2, 0.17], RED, { at: [0, 0.1, 0.05], rot: [0.3, 0, 0], look: 'cloth', e: 0.8 });
  if (d1) b.blob('dangleHead', [0.04, 0.16, 0.12], '#e0402f', { at: [0, 0.06, 0.15], rot: [0.9, 0, 0], look: 'cloth', e: 0.8 });
}


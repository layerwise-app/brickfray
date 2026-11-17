import { buildBody } from '../body';
import type { PartSet } from '../parts';

const SUIT = '#eef0f4';
const SHADE = '#d4d8df';
const PURPLE = '#7b4fd6';
const VISOR = '#e0a83a';

/** Nova: astronaut in a white suit with purple accents, gold visor, life-support pack with lights, antenna. */
export function nova(b: PartSet) {
  const bulk = 1.08;
  buildBody(b, {
    skin: '#f0c9a8',
    shirt: SUIT,
    shirtLook: 'plastic',
    glove: SHADE,
    gloveLook: 'rubber',
    pants: SUIT,
    pantsLook: 'plastic',
    boot: SUIT,
    sole: PURPLE,
    belt: PURPLE,
    buckle: '#c9ced3',
    bulk,
    limbs: 1.13,
    omit: ['head']
  });
  const d1 = b.detail > 0;
  const hi = b.detail > 1;

  // Round helmet, gold visor, purple neck ring.
  b.cyl('neck', 0.09, 0.1, 0.07, PURPLE, { at: [0, 0.0, 0], look: 'gloss' });
  b.ball('head', 0.17, SUIT, { at: [0, 0.095, 0.005], look: 'gloss' });
  b.section('head', 0.174, 2.1, 1.35, VISOR, { at: [0, 0.095, 0.005], look: 'gold' });
  b.mirror((_, sign) => b.cyl('head', 0.04, 0.045, 0.03, SHADE, { at: [sign * 0.165, 0.09, 0.0], rot: [0, 0, Math.PI / 2], look: 'plastic' }));
  if (hi) b.box('head', [0.05, 0.03, 0.04], PURPLE, { at: [0.0, 0.25, 0.06], look: 'gloss' });
  b.cyl('dangleHead', 0.006, 0.008, 0.22, '#c9ced3', { at: [0, 0.11, 0], look: 'chrome' });
  b.ball('dangleHead', 0.018, '#ff5ab0', { at: [0, 0.23, 0], look: 'glow' });

  // Life-support pack with glowing lights and a purple panel.
  b.box('chest', [0.32, 0.36, 0.14], SUIT, { at: [0, 0.07, 0.17], look: 'plastic' });
  b.box('chest', [0.22, 0.12, 0.02], PURPLE, { at: [0, 0.14, 0.245], look: 'gloss' });
  const lights = ['#58f0a0', '#ff5ab0', '#5ab8ff'];
  lights.forEach((c, i) => b.ball('chest', 0.014, c, { at: [-0.06 + i * 0.06, 0.0, 0.245], look: 'glow' }));
  b.mirror((_, sign) => b.cyl('chest', 0.03, 0.03, 0.3, SHADE, { at: [sign * 0.175, 0.07, 0.17], look: 'plastic' }));

  // Chest control box, purple accents on shoulders, knees and cuffs.
  b.box('chest', [0.17, 0.1, 0.05], SHADE, { at: [0, 0.03, -0.12], look: 'plastic' });
  lights.forEach((c, i) => b.box('chest', [0.022, 0.018, 0.01], c, { at: [-0.045 + i * 0.045, 0.04, -0.147], look: 'glow' }));
  b.mirror((side) => {
    b.cyl(`upperArm${side}`, 0.07, 0.07, 0.03, PURPLE, { at: [0, -0.02, 0], look: 'gloss' });
    b.cyl(`forearm${side}`, 0.058, 0.058, 0.03, PURPLE, { at: [0, -0.2, 0], look: 'gloss' });
    b.blob(`shin${side}`, [0.11, 0.1, 0.05], PURPLE, { at: [0, -0.0, -0.06], look: 'gloss' });
    b.cyl(`foot${side}`, 0.075, 0.075, 0.03, PURPLE, { at: [0, 0.07, 0], look: 'gloss' });
  });
  if (d1) b.box('spine', [0.012, 0.15, 0.01], PURPLE, { at: [0.06, 0.06, -0.106], look: 'gloss' });
}


import { buildBody } from '../body';
import type { PartSet } from '../parts';

const CLOAK = '#4f7a3a';
const CLOAK_DARK = '#3d6230';
const LEAF = '#8aa13f';
const LEAF2 = '#a6c629';
const BEARD = '#8a5a32';
const LEATHER = '#6e4a2f';

/** Moss: forest ranger in a green hooded cloak with leaf patches, bushy beard, satchel and wrapped boots. */
export function moss(b: PartSet) {
  buildBody(b, {
    skin: '#d9a27a',
    shirt: '#6b6e3a',
    sleeve: '#6b6e3a',
    glove: '#5b4630',
    gloveLook: 'cloth',
    pants: '#3f4a35',
    boot: '#5b4630',
    bootLook: 'rubber',
    belt: LEATHER,
    buckle: '#a0a6ab',
    bulk: 1.02,
    eyes: '#20242a',
    brow: '#6a4a2a',
    browTilt: -0.12,
    mouth: 'none'
  });
  const d1 = b.detail > 0;
  const hi = b.detail > 1;

  // Mantle over the shoulders and the long back panel on the swinging bone.
  b.taper('chest', [0.42, 0.25], [0.3, 0.2], 0.13, CLOAK, { at: [0, 0.19, 0.0], look: 'cloth' });
  b.mirror((side, sign) => b.dome(`upperArm${side}`, 0.085, CLOAK, { at: [sign * 0.005, -0.01, 0], rot: [0, 0, sign * -0.25], scale: [1.05, 1.1, 1.15], look: 'cloth' }));
  b.taper('dangleBack', [0.44, 0.03], [0.36, 0.03], 0.66, CLOAK, { at: [0, -0.3, 0.01], look: 'cloth' });
  if (d1) b.taper('dangleBack', [0.45, 0.02], [0.44, 0.02], 0.04, CLOAK_DARK, { at: [0, -0.61, 0.012], look: 'cloth' });

  // Leaf patches.
  const leaves: [number, number, string][] = [
    [-0.1, -0.12, LEAF],
    [0.09, -0.3, LEAF2],
    [-0.06, -0.45, LEAF],
    [0.12, -0.08, LEAF2]
  ];
  for (const [x, y, c] of d1 ? leaves : leaves.slice(0, 2)) b.box('dangleBack', [0.07, 0.07, 0.04], c, { at: [x, y, 0.012], rot: [0, 0, Math.PI / 4], look: 'cloth' });
  b.box('chest', [0.06, 0.06, 0.03], LEAF2, { at: [-0.14, 0.2, -0.08], rot: [0.5, 0, Math.PI / 4], look: 'cloth' });
  if (hi) b.box('chest', [0.05, 0.05, 0.03], LEAF, { at: [0.12, 0.22, 0.1], rot: [-0.5, 0, Math.PI / 4], look: 'cloth' });

  // Hood with a pointed tip, framing the face.
  b.blob('head', [0.285, 0.305, 0.27], CLOAK, { at: [0, 0.118, 0.055], look: 'cloth', e: 0.62, taper: 0.1 });
  b.blob('head', [0.1, 0.12, 0.12], CLOAK, { at: [0, 0.24, 0.12], rot: [-0.9, 0, 0], look: 'cloth', e: 0.8, taper: 0.5 });
  if (d1) b.torus('head', 0.135, 0.02, CLOAK_DARK, { at: [0, 0.105, -0.08], rot: [-0.15, 0, 0], scale: [1, 1.12, 1], look: 'cloth' });

  // Bushy beard, mustache, nose bridge.
  b.blob('head', [0.21, 0.16, 0.11], BEARD, { at: [0, -0.02, -0.095], look: 'cloth', e: 0.75, taper: 0.35 });
  b.blob('head', [0.13, 0.035, 0.04], BEARD, { at: [0, 0.018, -0.13], look: 'cloth', e: 0.7 });
  b.mirror((_, sign) => b.blob('head', [0.05, 0.1, 0.06], BEARD, { at: [sign * 0.1, 0.03, -0.06], look: 'cloth', e: 0.7 }));

  // Satchel with its strap, wrapped boots.
  b.box('pelvis', [0.07, 0.15, 0.19], LEATHER, { at: [-0.2, -0.03, 0.0], look: 'rubber' });
  if (d1) b.box('pelvis', [0.075, 0.05, 0.195], '#86603d', { at: [-0.202, 0.03, 0.0], look: 'rubber' });
  b.box('chest', [0.035, 0.46, 0.014], LEATHER, { at: [0.0, 0.07, -0.118], rot: [0, 0, -0.62], look: 'rubber' });
  b.box('chest', [0.035, 0.46, 0.014], LEATHER, { at: [0.0, 0.07, 0.118], rot: [0, 0, 0.62], look: 'rubber' });
  b.mirror((side) => {
    for (const y of d1 ? [-0.24, -0.29] : [-0.27]) b.cyl(`shin${side}`, 0.056, 0.054, 0.022, '#b09a72', { at: [0, y, 0], rot: [0.12, 0, 0], look: 'cloth' });
  });
}

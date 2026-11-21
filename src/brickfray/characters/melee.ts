import type { MeleeId } from '../weapons/defs';
import type { PartSet } from './parts';
import type { V3 } from './skeleton';

const ALONG: V3 = [Math.PI / 2, 0, 0];
const ACROSS: V3 = [0, 0, Math.PI / 2];
/** The anchor's arms stop this far short of horizontal, so the flukes flare out. */
const FLARE = 0.22;
const ARM_END = Math.PI / 2 - FLARE;

/**
 * The character's own melee weapon on the 'mallet' bone (scaled to zero until
 * a swing): grip at the origin, head along -Z, the striking side toward -Y.
 */
export function meleeProp(b: PartSet, id: MeleeId, bot: boolean) {
  const d1 = b.detail > 0;
  const seg = b.seg(5, 8, 10);
  switch (id) {
    case 'mallet':
      if (bot) {
        b.cyl('mallet', 0.014, 0.014, 0.34, '#8c949b', { at: [0, 0, -0.08], rot: ALONG, look: 'metal' });
        b.box('mallet', [0.15, 0.09, 0.09], '#f5a623', { at: [0, 0, -0.27], look: 'gloss' });
        return;
      }
      // A barrel head with its rubber striking pads toward ±Y, so a pad leads the swing.
      b.cyl('mallet', 0.014, 0.014, 0.34, '#f6c624', { at: [0, 0, -0.08], rot: ALONG, look: 'plastic', seg: 6 });
      b.cyl('mallet', 0.055, 0.055, 0.15, '#c4261d', { at: [0, 0, -0.27], look: 'gloss', seg });
      if (d1) b.mirror((_, sign) => b.cyl('mallet', 0.05, 0.05, 0.026, '#2b3036', { at: [0, sign * 0.086, -0.27], look: 'rubber', seg }));
      return;
    case 'sword':
      b.cyl('mallet', 0.017, 0.017, 0.12, '#c8231b', { at: [0, 0, 0.005], rot: ALONG, look: 'cloth', seg: 6 });
      b.ball('mallet', 0.026, '#d4a640', { at: [0, 0, 0.08], scale: [0.75, 1, 1], look: 'gold' });
      b.box('mallet', [0.036, 0.17, 0.034], '#d4a640', { at: [0, 0, -0.07], look: 'gold' });
      if (d1) b.mirror((_, sign) => b.ball('mallet', 0.02, '#d4a640', { at: [0, sign * 0.09, -0.07], look: 'gold' }));
      b.taper('mallet', [0.016, 0.066], [0.012, 0.054], 0.4, '#d3d8de', { at: [0, 0, -0.287], rot: [-Math.PI / 2, 0, 0], look: 'metal' });
      b.taper('mallet', [0.012, 0.054], [0.003, 0.004], 0.075, '#d3d8de', { at: [0, 0, -0.524], rot: [-Math.PI / 2, 0, 0], look: 'metal' });
      return;
    case 'knife':
      b.box('mallet', [0.028, 0.038, 0.12], '#1fa7a0', { at: [0, 0, 0.01], look: 'plastic' });
      if (d1) b.mirror((_, sign) => b.box('mallet', [0.004, 0.026, 0.09], '#f2f2ee', { at: [sign * 0.015, 0, 0.012], look: 'plastic' }));
      b.cyl('mallet', 0.016, 0.016, 0.034, '#f2f2ee', { at: [0, 0, -0.054], rot: ACROSS, look: 'plastic', seg: 8 });
      b.taper('mallet', [0.008, 0.042], [0.006, 0.034], 0.11, '#d3d8de', { at: [0, 0.002, -0.12], rot: [-Math.PI / 2, 0, 0], look: 'metal' });
      b.taper('mallet', [0.006, 0.034], [0.002, 0.004], 0.045, '#d3d8de', { at: [0, 0.006, -0.1975], rot: [-Math.PI / 2, 0, 0], look: 'metal' });
      if (d1) b.torus('mallet', 0.012, 0.004, '#f5a623', { at: [0, 0, 0.078], rot: [0, Math.PI / 2, 0], look: 'rubber' });
      return;
    case 'anchor':
      b.cyl('mallet', 0.016, 0.016, 0.47, '#5f666d', { at: [0, 0, -0.165], rot: ALONG, look: 'plastic', seg: 6 });
      b.cyl('mallet', 0.021, 0.021, 0.13, '#d8b77c', { at: [0, 0, 0], rot: ALONG, look: 'cloth', seg: 8 });
      b.torus('mallet', 0.026, 0.007, '#c99a3e', { at: [0, 0, 0.096], rot: [0, Math.PI / 2, 0], look: 'gold' });
      b.cyl('mallet', 0.008, 0.008, 0.16, '#c99a3e', { at: [0, 0, -0.1], rot: ACROSS, look: 'gold', seg: 6 });
      if (d1) b.mirror((_, sign) => b.ball('mallet', 0.014, '#c99a3e', { at: [sign * 0.082, 0, -0.1], look: 'gold' }));
      // Arms arc in the Y-Z plane from the crown at -0.4, flaring back toward the hand.
      b.torus('mallet', 0.16, 0.017, '#5f666d', { at: [0, 0, -0.24], rot: [0, Math.PI / 2, -ARM_END], arc: 2 * ARM_END, look: 'plastic' });
      b.mirror((_, sign) =>
        b.taper('mallet', [0.022, 0.08], [0.012, 0.006], 0.075, '#f26b5b', {
          at: [0, sign * (Math.sin(ARM_END) * 0.16 + Math.cos(ARM_END) * 0.037), -0.24 - Math.cos(ARM_END) * 0.16 + Math.sin(ARM_END) * 0.037],
          rot: [Math.PI / 2 - sign * FLARE, 0, 0],
          look: 'gloss'
        })
      );
      b.box('mallet', [0.04, 0.04, 0.05], '#c99a3e', { at: [0, 0, -0.4], look: 'gold' });
      return;
    case 'hatchet':
      b.cyl('mallet', 0.016, 0.016, 0.36, '#8f6440', { at: [0, 0, -0.09], rot: ALONG, look: 'cloth', seg: 6 });
      b.cyl('mallet', 0.019, 0.019, 0.12, '#4f7a3a', { at: [0, 0, 0], rot: ALONG, look: 'cloth', seg: 6 });
      if (d1) b.ball('mallet', 0.022, '#8f6440', { at: [0, 0, 0.09], scale: [1, 1, 0.8], look: 'cloth' });
      b.box('mallet', [0.046, 0.07, 0.07], '#a3acb5', { at: [0, 0.012, -0.25], look: 'metal' });
      b.taper('mallet', [0.03, 0.065], [0.008, 0.12], 0.1, '#c9cfd5', { at: [0, -0.07, -0.25], rot: [Math.PI, 0, 0], look: 'metal' });
      return;
    case 'wrench':
      b.box('mallet', [0.026, 0.044, 0.33], '#eef0f4', { at: [0, 0, -0.08], look: 'plastic' });
      b.cyl('mallet', 0.023, 0.023, 0.13, '#7b4fd6', { at: [0, 0, 0], rot: ALONG, look: 'rubber', seg: 8 });
      b.box('mallet', [0.03, 0.012, 0.12], '#b48cff', { at: [0, 0, -0.16], look: 'glow' });
      b.box('mallet', [0.034, 0.056, 0.03], '#7b4fd6', { at: [0, 0, -0.245], look: 'gloss' });
      // Open jaw: a C-shaped ring, its gap facing away from the hand and tilted to the striking side.
      b.torus('mallet', 0.052, 0.025, '#eef0f4', { at: [0, 0, -0.31], rot: [0, Math.PI / 2, -0.3 + 0.75], arc: Math.PI * 2 - 1.5, scale: [1, 1, 0.55], look: 'plastic' });
      return;
  }
}

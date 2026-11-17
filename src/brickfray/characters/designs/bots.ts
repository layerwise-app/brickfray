import { gripHand, supportHand } from '../body';
import type { PartSet } from '../parts';
import type { BotKind } from '../types';

interface BotPalette {
  body: string;
  accent: string;
  joint: string;
  glow: string;
  /** Limb thickness. */
  limbs: number;
  bulk: number;
}

const PALETTES: Record<BotKind, BotPalette> = {
  grunt: { body: '#5d666e', accent: '#f5a623', joint: '#2a3036', glow: '#ff3b2f', limbs: 1, bulk: 1.05 },
  rusher: { body: '#c8231b', accent: '#2f363d', joint: '#1c2229', glow: '#ffb020', limbs: 0.86, bulk: 0.94 },
  sniper: { body: '#6d7ea8', accent: '#e7e1d2', joint: '#2a3036', glow: '#58f0e0', limbs: 0.9, bulk: 0.95 },
  boss: { body: '#2f363d', accent: '#c8231b', joint: '#15191d', glow: '#ffd23a', limbs: 1.15, bulk: 1.15 }
};

/** Snapbots: robotic but human-jointed; one builder, a head and kit per kind. */
export function bot(kind: BotKind) {
  return (b: PartSet) => {
    const p = PALETTES[kind];
    frame(b, p);
    if (kind === 'grunt') grunt(b, p);
    else if (kind === 'rusher') rusher(b, p);
    else if (kind === 'sniper') sniper(b, p);
    else boss(b, p);
  };
}

function frame(b: PartSet, p: BotPalette) {
  const L = p.limbs;
  const d1 = b.detail > 0;
  b.taper('pelvis', [0.24, 0.17], [0.3, 0.2], 0.15, p.body, { at: [0, -0.045, 0], look: 'metal' });
  b.cyl('spine', 0.1, 0.11, 0.24, p.joint, { at: [0, 0.03, 0], look: 'metal' });
  if (d1) for (const y of [-0.04, 0.02, 0.08, 0.13]) b.cyl('spine', 0.118, 0.118, 0.018, p.body, { at: [0, y, 0], look: 'metal' });
  b.taper('chest', [0.3 * p.bulk, 0.2], [0.4 * p.bulk, 0.235], 0.26, p.body, { at: [0, 0.09, 0], look: 'metal' });
  b.cyl('neck', 0.04, 0.045, 0.11, p.joint, { at: [0, 0.03, 0], look: 'metal' });
  b.ball('neck', 0.05, p.joint, { at: [0, 0.0, 0], look: 'metal' });
  if (d1) {
    for (let i = 0; i < 3; i++) b.box('chest', [0.12, 0.012, 0.01], p.joint, { at: [0.08, 0.02 + i * 0.03, -0.118], look: 'rubber' });
    b.box('chest', [0.1, 0.1, 0.012], p.accent, { at: [-0.08, 0.12, -0.12], look: 'gloss' });
  }
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    b.ball(ua, 0.06 * L, p.joint, { look: 'metal' });
    b.box(ua, [0.13 * L, 0.1, 0.14 * L], p.accent, { at: [sign * 0.02, 0.0, 0], look: 'gloss' });
    b.cyl(ua, 0.04 * L, 0.04 * L, 0.24, p.joint, { at: [0, -0.13, 0], look: 'metal' });
    b.box(ua, [0.085 * L, 0.15, 0.085 * L], p.body, { at: [0, -0.15, 0], look: 'metal' });
    b.box(ua, [0.095 * L, 0.06, 0.095 * L], '#ffffff', { at: [0, -0.1, 0], look: 'tint' });
    b.ball(fa, 0.047 * L, p.joint, { look: 'metal' });
    b.box(fa, [0.09 * L, 0.18, 0.095 * L], p.body, { at: [0, -0.11, 0], look: 'metal' });
    b.cyl(fa, 0.035, 0.035, 0.06, p.joint, { at: [0, -0.23, 0], look: 'metal' });
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    b.ball(th, 0.07 * L, p.joint, { look: 'metal' });
    b.cyl(th, 0.045 * L, 0.045 * L, 0.4, p.joint, { at: [0, -0.21, 0], look: 'metal' });
    b.box(th, [0.12 * L, 0.24, 0.13 * L], p.body, { at: [0, -0.16, 0], look: 'metal' });
    b.ball(sh, 0.058 * L, p.joint, { look: 'metal' });
    b.box(sh, [0.1 * L, 0.06, 0.06], p.accent, { at: [0, 0.0, -0.05], look: 'gloss' });
    b.taper(sh, [0.08 * L, 0.09], [0.11 * L, 0.12], 0.28, p.body, { at: [0, -0.2, 0.0], look: 'metal' });
    b.cyl(sh, 0.035 * L, 0.035 * L, 0.1, p.joint, { at: [0, -0.37, 0], look: 'metal' });
    const ft = `foot${side}` as const;
    b.ball(ft, 0.045 * L, p.joint, { at: [0, 0.0, 0], look: 'metal' });
    b.box(ft, [0.12, 0.085, 0.2], p.body, { at: [0, -0.035, -0.035], look: 'metal' });
    b.box(ft, [0.1, 0.05, 0.1], p.body, { at: [0, 0.02, 0.0], look: 'metal' });
    b.box(ft, [0.125, 0.02, 0.2], p.joint, { at: [0, -0.075, -0.035], look: 'rubber' });
    b.box(`toe${side}`, [0.115, 0.05, 0.08], p.accent, { at: [0, -0.002, -0.03], look: 'gloss' });
  });
  gripHand(b, { skin: p.joint, shirt: p.body, glove: p.joint, gloveLook: 'metal', pants: p.body, boot: p.body });
  supportHand(b, { skin: p.joint, shirt: p.body, glove: p.joint, gloveLook: 'metal', pants: p.body, boot: p.body });
  props(b);
}

function props(b: PartSet) {
  b.cyl('mallet', 0.014, 0.014, 0.34, '#8c949b', { at: [0, 0, -0.08], rot: [Math.PI / 2, 0, 0], look: 'metal' });
  b.box('mallet', [0.15, 0.09, 0.09], '#f5a623', { at: [0, 0, -0.27], look: 'gloss' });
  b.ball('grenade', 0.036, '#3a4047', { at: [0, 0.012, -0.005], look: 'metal' });
  b.ball('grenade', 0.014, '#ff3b2f', { at: [0, 0.04, -0.03], look: 'glow' });
}

function grunt(b: PartSet, p: BotPalette) {
  b.box('head', [0.23, 0.21, 0.23], p.body, { at: [0, 0.095, 0], look: 'metal', bevel: 0.025 });
  b.box('head', [0.18, 0.09, 0.02], p.joint, { at: [0, 0.09, -0.112], look: 'rubber' });
  b.ball('head', 0.035, p.glow, { at: [0, 0.09, -0.118], scale: [1, 1, 0.5], look: 'glow' });
  b.torus('head', 0.042, 0.009, p.accent, { at: [0, 0.09, -0.124], look: 'gloss' });
  b.mirror((_, sign) => b.cyl('head', 0.035, 0.035, 0.03, p.joint, { at: [sign * 0.125, 0.09, 0], rot: [0, 0, Math.PI / 2], look: 'metal' }));
  b.cyl('head', 0.01, 0.01, 0.1, p.joint, { at: [0.07, 0.24, 0.05], look: 'metal' });
  b.ball('head', 0.016, p.glow, { at: [0.07, 0.29, 0.05], look: 'glow' });
  b.box('chest', [0.42 * p.bulk, 0.035, 0.25], p.accent, { at: [0, -0.03, 0], look: 'gloss' });
}

function rusher(b: PartSet, p: BotPalette) {
  b.taper('head', [0.2, 0.24], [0.16, 0.14], 0.17, p.body, { at: [0, 0.08, 0.01], shiftZ: 0.05, look: 'gloss' });
  b.box('head', [0.17, 0.028, 0.02], p.glow, { at: [0, 0.08, -0.12], rot: [0, 0, 0], look: 'glow' });
  b.box('head', [0.19, 0.05, 0.06], p.accent, { at: [0, 0.12, -0.09], rot: [-0.4, 0, 0], look: 'metal' });
  b.mirror((_, sign) => {
    b.box('chest', [0.02, 0.16, 0.12], p.accent, { at: [sign * 0.08, 0.2, 0.15], rot: [-0.7, 0, sign * 0.25], look: 'metal' });
    b.box('head', [0.02, 0.08, 0.1], p.accent, { at: [sign * 0.1, 0.17, 0.05], rot: [-0.6, 0, sign * 0.2], look: 'metal' });
  });
  b.box('chest', [0.16, 0.08, 0.02], p.glow, { at: [0, 0.07, -0.125], look: 'glow' });
}

function sniper(b: PartSet, p: BotPalette) {
  b.box('head', [0.16, 0.2, 0.18], p.accent, { at: [0, 0.09, 0.02], look: 'gloss', bevel: 0.02 });
  b.cyl('head', 0.07, 0.075, 0.16, p.body, { at: [0, 0.11, -0.12], rot: [Math.PI / 2, 0, 0], look: 'metal' });
  b.cyl('head', 0.058, 0.058, 0.01, '#7fe8ff', { at: [0, 0.11, -0.202], rot: [Math.PI / 2, 0, 0], look: 'glass' });
  b.torus('head', 0.062, 0.008, p.glow, { at: [0, 0.11, -0.2], look: 'glow' });
  b.ball('head', 0.022, p.glow, { at: [0, 0.11, -0.19], scale: [1, 1, 0.5], look: 'glow' });
  b.cyl('dangleHead', 0.006, 0.008, 0.45, p.joint, { at: [0, 0.225, 0], look: 'metal' });
  b.ball('dangleHead', 0.014, p.glow, { at: [0, 0.45, 0], look: 'glow' });
  b.box('chest', [0.06, 0.2, 0.06], p.accent, { at: [-0.12, 0.08, 0.13], look: 'gloss' });
}

function boss(b: PartSet, p: BotPalette) {
  b.box('head', [0.25, 0.22, 0.25], p.body, { at: [0, 0.09, 0], look: 'metal', bevel: 0.03 });
  b.box('head', [0.2, 0.035, 0.02], p.glow, { at: [0, 0.09, -0.124], look: 'glow' });
  b.box('head', [0.27, 0.05, 0.27], p.accent, { at: [0, 0.18, 0], look: 'gloss' });
  b.box('head', [0.04, 0.08, 0.2], p.accent, { at: [0, 0.23, 0.02], look: 'gloss' });
  b.taper('chest', [0.36, 0.24], [0.46, 0.27], 0.22, p.body, { at: [0, 0.1, -0.01], look: 'metal' });
  b.box('chest', [0.24, 0.06, 0.02], p.accent, { at: [0, 0.15, -0.14], look: 'gloss' });
  b.mirror((side, sign) => {
    b.box(`upperArm${side}`, [0.18, 0.13, 0.2], p.accent, { at: [sign * 0.035, 0.035, 0], rot: [0, 0, sign * -0.25], look: 'gloss' });
    b.ball(`upperArm${side}`, 0.022, p.glow, { at: [sign * 0.085, 0.09, -0.06], look: 'glow' });
    b.ball(`upperArm${side}`, 0.022, p.glow, { at: [sign * 0.085, 0.09, 0.06], look: 'glow' });
    b.box(`shin${side}`, [0.13, 0.2, 0.14], p.accent, { at: [0, -0.1, -0.01], look: 'gloss' });
  });
  b.box('chest', [0.3, 0.3, 0.14], p.joint, { at: [0, 0.08, 0.18], look: 'metal' });
  b.mirror((_, sign) => b.cyl('chest', 0.03, 0.04, 0.18, p.joint, { at: [sign * 0.09, 0.3, 0.2], look: 'metal' }));
}

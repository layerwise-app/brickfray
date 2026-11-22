import { gripHand, supportHand } from '../body';
import type { PartSet } from '../parts';
import type { BotKind } from '../types';

interface BotPalette {
  /** Painted shell panels. */
  body: string;
  accent: string;
  /** Bare metal of the frame, joints and servos. */
  joint: string;
  glow: string;
  /** Limb thickness. */
  limbs: number;
  bulk: number;
}

const PALETTES: Record<BotKind, BotPalette> = {
  grunt: { body: '#7b8792', accent: '#f5a623', joint: '#3a424a', glow: '#ff3b2f', limbs: 1, bulk: 1.05 },
  rusher: { body: '#c8231b', accent: '#2f363d', joint: '#2c333a', glow: '#ffb020', limbs: 0.86, bulk: 0.94 },
  sniper: { body: '#6d7ea8', accent: '#e7e1d2', joint: '#2f363d', glow: '#58f0e0', limbs: 0.9, bulk: 0.95 },
  boss: { body: '#454e58', accent: '#c8231b', joint: '#22282e', glow: '#ffd23a', limbs: 1.15, bulk: 1.15 }
};

const ACROSS: [number, number, number] = [0, 0, Math.PI / 2];

/** Snapbots: robotic but human-jointed, painted shell panels on a bare metal frame; one builder, a head and kit per kind. */
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

/** A servo: a drum across the joint's hinge axis with a lit cap on its outer face. */
function servo(b: PartSet, bone: Parameters<PartSet['cyl']>[0], r: number, width: number, p: BotPalette, at: [number, number, number] = [0, 0, 0]) {
  b.cyl(bone, r, r, width, p.joint, { at, rot: ACROSS, look: 'metal' });
  if (b.detail > 0) b.mirror((_, sign) => b.cyl(bone, r * 0.55, r * 0.55, 0.006, p.accent, { at: [at[0] + sign * (width / 2 + 0.002), at[1], at[2]], rot: ACROSS, look: 'gloss' }));
}

function frame(b: PartSet, p: BotPalette) {
  const L = p.limbs;
  const d1 = b.detail > 0;
  const panel = d1 ? 0.018 : 0;
  b.taper('pelvis', [0.24, 0.17], [0.3, 0.2], 0.15, p.body, { at: [0, -0.045, 0], look: 'plastic', bevel: panel });
  b.cyl('spine', 0.1, 0.11, 0.24, p.joint, { at: [0, 0.03, 0], look: 'metal' });
  if (d1) for (const y of [-0.04, 0.02, 0.08, 0.13]) b.cyl('spine', 0.118, 0.118, 0.018, p.body, { at: [0, y, 0], look: 'plastic' });
  b.taper('chest', [0.3 * p.bulk, 0.2], [0.4 * p.bulk, 0.235], 0.26, p.body, { at: [0, 0.09, 0], look: 'plastic', bevel: panel });
  b.cyl('neck', 0.04, 0.045, 0.11, p.joint, { at: [0, 0.03, 0], look: 'metal' });
  b.ball('neck', 0.05, p.joint, { at: [0, 0.0, 0], look: 'metal' });
  if (d1) {
    // Vents, a painted badge plate and a light strip on the chest; a power cell with a lit window on the back.
    for (let i = 0; i < 3; i++) b.box('chest', [0.12, 0.012, 0.01], p.joint, { at: [0.08, 0.02 + i * 0.03, -0.118], look: 'rubber' });
    b.box('chest', [0.1, 0.1, 0.014], p.accent, { at: [-0.08, 0.12, -0.12], look: 'gloss', bevel: 0.01 });
    b.box('chest', [0.2 * p.bulk, 0.014, 0.008], p.glow, { at: [0, 0.0, -0.106], look: 'glow' });
    b.box('chest', [0.2, 0.2, 0.08], p.joint, { at: [0, 0.08, 0.15], look: 'metal', bevel: 0.015 });
    b.box('chest', [0.1, 0.03, 0.01], p.glow, { at: [0, 0.12, 0.192], look: 'glow' });
    b.mirror((_, sign) => servo(b, 'pelvis', 0.055, 0.03, p, [sign * 0.16, -0.06, 0]));
  }
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    b.ball(ua, 0.06 * L, p.joint, { look: 'metal' });
    b.box(ua, [0.13 * L, 0.1, 0.14 * L], p.accent, { at: [sign * 0.02, 0.0, 0], look: 'gloss', bevel: panel });
    b.cyl(ua, 0.05 * L, 0.05 * L, 0.24, p.joint, { at: [0, -0.13, 0], look: 'metal' });
    b.box(ua, [0.09 * L, 0.15, 0.09 * L], p.body, { at: [0, -0.15, 0], look: 'plastic' });
    b.box(ua, [0.1 * L, 0.06, 0.1 * L], '#ffffff', { at: [0, -0.1, 0], look: 'tint' });
    b.ball(fa, 0.047 * L, p.joint, { look: 'metal' });
    if (d1) servo(b, fa, 0.042 * L, 0.1 * L, p);
    b.box(fa, [0.095 * L, 0.18, 0.1 * L], p.body, { at: [0, -0.11, 0], look: 'plastic' });
    b.cyl(fa, 0.038, 0.038, 0.06, p.joint, { at: [0, -0.23, 0], look: 'metal' });
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    b.ball(th, 0.07 * L, p.joint, { look: 'metal' });
    b.cyl(th, 0.056 * L, 0.056 * L, 0.4, p.joint, { at: [0, -0.21, 0], look: 'metal' });
    b.box(th, [0.125 * L, 0.24, 0.135 * L], p.body, { at: [0, -0.16, 0], look: 'plastic', bevel: panel });
    b.ball(sh, 0.058 * L, p.joint, { look: 'metal' });
    if (d1) servo(b, sh, 0.05 * L, 0.12 * L, p);
    b.box(sh, [0.1 * L, 0.06, 0.06], p.accent, { at: [0, 0.0, -0.05], look: 'gloss' });
    b.taper(sh, [0.08 * L, 0.09], [0.11 * L, 0.12], 0.28, p.body, { at: [0, -0.2, 0.0], look: 'plastic', bevel: panel });
    b.cyl(sh, 0.04 * L, 0.04 * L, 0.1, p.joint, { at: [0, -0.37, 0], look: 'metal' });
    const ft = `foot${side}` as const;
    b.ball(ft, 0.045 * L, p.joint, { at: [0, 0.0, 0], look: 'metal' });
    b.box(ft, [0.12, 0.085, 0.2], p.body, { at: [0, -0.035, -0.035], look: 'plastic' });
    b.box(ft, [0.1, 0.05, 0.1], p.body, { at: [0, 0.02, 0.0], look: 'plastic' });
    b.box(ft, [0.125, 0.02, 0.2], p.joint, { at: [0, -0.075, -0.035], look: 'rubber' });
    b.box(`toe${side}`, [0.115, 0.05, 0.08], p.accent, { at: [0, -0.002, -0.03], look: 'gloss' });
  });
  gripHand(b, { skin: p.joint, shirt: p.body, glove: p.joint, gloveLook: 'metal', pants: p.body, boot: p.body });
  supportHand(b, { skin: p.joint, shirt: p.body, glove: p.joint, gloveLook: 'metal', pants: p.body, boot: p.body });
  props(b);
}

function props(b: PartSet) {
  b.ball('grenade', 0.036, '#3a4047', { at: [0, 0.012, -0.005], look: 'metal' });
  b.ball('grenade', 0.014, '#ff3b2f', { at: [0, 0.04, -0.03], look: 'glow' });
}

function grunt(b: PartSet, p: BotPalette) {
  b.box('head', [0.23, 0.21, 0.23], p.body, { at: [0, 0.095, 0], look: 'plastic', bevel: 0.03 });
  b.box('head', [0.18, 0.09, 0.02], p.joint, { at: [0, 0.09, -0.112], look: 'rubber' });
  b.ball('head', 0.035, p.glow, { at: [0, 0.09, -0.118], scale: [1, 1, 0.5], look: 'glow' });
  b.torus('head', 0.042, 0.009, p.accent, { at: [0, 0.09, -0.124], look: 'gloss' });
  b.box('head', [0.2, 0.03, 0.03], p.accent, { at: [0, 0.165, -0.105], look: 'gloss' });
  b.mirror((_, sign) => b.cyl('head', 0.038, 0.038, 0.03, p.joint, { at: [sign * 0.125, 0.09, 0], rot: ACROSS, look: 'metal' }));
  b.cyl('head', 0.01, 0.01, 0.1, p.joint, { at: [0.07, 0.24, 0.05], look: 'metal' });
  b.ball('head', 0.016, p.glow, { at: [0.07, 0.29, 0.05], look: 'glow' });
  b.box('chest', [0.42 * p.bulk, 0.035, 0.25], p.accent, { at: [0, -0.03, 0], look: 'gloss' });
}

function rusher(b: PartSet, p: BotPalette) {
  b.taper('head', [0.2, 0.24], [0.16, 0.14], 0.17, p.body, { at: [0, 0.08, 0.01], shiftZ: 0.05, look: 'plastic' });
  b.box('head', [0.17, 0.028, 0.02], p.glow, { at: [0, 0.08, -0.12], look: 'glow' });
  b.box('head', [0.19, 0.05, 0.06], p.accent, { at: [0, 0.12, -0.09], rot: [-0.4, 0, 0], look: 'metal' });
  b.mirror((_, sign) => {
    b.box('chest', [0.02, 0.16, 0.12], p.accent, { at: [sign * 0.08, 0.2, 0.15], rot: [-0.7, 0, sign * 0.25], look: 'metal' });
    b.box('head', [0.02, 0.08, 0.1], p.accent, { at: [sign * 0.1, 0.17, 0.05], rot: [-0.6, 0, sign * 0.2], look: 'metal' });
  });
  b.box('chest', [0.16, 0.08, 0.02], p.glow, { at: [0, 0.07, -0.125], look: 'glow' });
}

function sniper(b: PartSet, p: BotPalette) {
  b.box('head', [0.16, 0.2, 0.18], p.accent, { at: [0, 0.09, 0.02], look: 'gloss', bevel: 0.02 });
  b.cyl('head', 0.07, 0.075, 0.16, p.body, { at: [0, 0.11, -0.12], rot: [Math.PI / 2, 0, 0], look: 'plastic' });
  b.cyl('head', 0.058, 0.058, 0.01, '#7fe8ff', { at: [0, 0.11, -0.202], rot: [Math.PI / 2, 0, 0], look: 'glass' });
  b.torus('head', 0.062, 0.008, p.glow, { at: [0, 0.11, -0.2], look: 'glow' });
  b.ball('head', 0.022, p.glow, { at: [0, 0.11, -0.19], scale: [1, 1, 0.5], look: 'glow' });
  b.cyl('dangleHead', 0.006, 0.008, 0.45, p.joint, { at: [0, 0.225, 0], look: 'metal' });
  b.ball('dangleHead', 0.014, p.glow, { at: [0, 0.45, 0], look: 'glow' });
  b.box('chest', [0.06, 0.2, 0.06], p.accent, { at: [-0.12, 0.08, 0.13], look: 'gloss' });
}

/** The boss: its own armour over the frame: a crested helm with three eyes, a reactor in the chest, layered pauldrons and exhaust stacks. */
function boss(b: PartSet, p: BotPalette) {
  const d1 = b.detail > 0;
  b.taper('head', [0.24, 0.25], [0.2, 0.22], 0.22, p.body, { at: [0, 0.09, 0], look: 'plastic', bevel: d1 ? 0.02 : 0 });
  b.box('head', [0.21, 0.05, 0.02], p.joint, { at: [0, 0.11, -0.122], look: 'rubber' });
  for (const x of [-0.06, 0, 0.06]) b.box('head', [0.04, 0.022, 0.012], p.glow, { at: [x, 0.11, -0.13], look: 'glow' });
  b.box('head', [0.2, 0.06, 0.07], p.accent, { at: [0, 0.015, -0.1], rot: [0.25, 0, 0], look: 'gloss' });
  b.box('head', [0.035, 0.11, 0.26], p.accent, { at: [0, 0.24, 0.01], look: 'gloss', bevel: d1 ? 0.012 : 0 });
  b.mirror((_, sign) => b.box('head', [0.03, 0.14, 0.05], p.accent, { at: [sign * 0.13, 0.2, 0.03], rot: [-0.3, 0, sign * -0.45], look: 'gloss' }));

  b.taper('chest', [0.36, 0.24], [0.46, 0.27], 0.22, p.body, { at: [0, 0.1, -0.01], look: 'plastic', bevel: d1 ? 0.02 : 0 });
  b.torus('chest', 0.058, 0.014, p.accent, { at: [0, 0.12, -0.15], look: 'gloss' });
  b.ball('chest', 0.045, p.glow, { at: [0, 0.12, -0.148], scale: [1, 1, 0.45], look: 'glow' });
  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    b.box(ua, [0.2, 0.12, 0.22], p.accent, { at: [sign * 0.035, 0.04, 0], rot: [0, 0, sign * -0.25], look: 'gloss', bevel: d1 ? 0.015 : 0 });
    b.box(ua, [0.17, 0.08, 0.19], p.body, { at: [sign * 0.06, -0.03, 0], rot: [0, 0, sign * -0.35], look: 'plastic' });
    b.ball(ua, 0.022, p.glow, { at: [sign * 0.085, 0.1, -0.07], look: 'glow' });
    b.ball(ua, 0.022, p.glow, { at: [sign * 0.085, 0.1, 0.07], look: 'glow' });
    b.box(`shin${side}`, [0.13, 0.2, 0.14], p.accent, { at: [0, -0.1, -0.01], look: 'gloss', bevel: d1 ? 0.012 : 0 });
    b.box(`thigh${side}`, [0.14, 0.12, 0.05], p.accent, { at: [0, -0.12, -0.07], look: 'gloss' });
    b.cyl('chest', 0.03, 0.04, 0.18, p.joint, { at: [sign * 0.09, 0.3, 0.2], look: 'metal' });
    b.cyl('chest', 0.026, 0.026, 0.02, p.glow, { at: [sign * 0.09, 0.39, 0.2], look: 'glow' });
  });
  b.box('chest', [0.3, 0.3, 0.14], p.joint, { at: [0, 0.08, 0.18], look: 'metal', bevel: d1 ? 0.02 : 0 });
  b.box('chest', [0.04, 0.2, 0.012], p.glow, { at: [0, 0.08, 0.252], look: 'glow' });
}

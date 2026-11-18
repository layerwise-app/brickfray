import type { BodyStyle } from './body';
import type { PartSet } from './parts';

/** The blocky body of the low tier: tapered boxes, tube limbs, mitten hands. */
export function blockBody(b: PartSet, s: BodyStyle) {
  const omit = new Set(s.omit ?? []);
  const sleeve = s.sleeve ?? s.shirt;
  const L = s.limbs ?? 1;
  const bulk = s.bulk ?? 1;
  const shirtLook = s.shirtLook ?? 'cloth';
  const pantsLook = s.pantsLook ?? 'cloth';

  if (!omit.has('hips')) {
    b.taper('pelvis', [0.24, 0.17], [0.31 * Math.min(bulk, 1.05), 0.2], 0.16, s.pants, { at: [0, -0.045, 0], look: pantsLook });
    b.blob('pelvis', [0.13, 0.08, 0.15], s.pants, { at: [0, -0.115, 0.0], look: pantsLook, e: 0.6 });
  }
  if (!omit.has('belt') && s.belt) {
    b.box('pelvis', [0.325 * Math.min(bulk, 1.05), 0.05, 0.215], s.belt, { at: [0, 0.035, 0], look: 'rubber' });
    if (b.detail > 0) b.box('pelvis', [0.06, 0.042, 0.02], s.buckle ?? '#c9b27a', { at: [0, 0.035, -0.11], look: 'metal' });
  }
  if (!omit.has('abdomen')) b.taper('spine', [0.28, 0.18], [0.3 * bulk, 0.19], 0.17, s.shirt, { at: [0, 0.065, 0], look: shirtLook });
  if (!omit.has('chest')) {
    b.taper('chest', [0.3 * bulk, 0.19], [0.39 * bulk, 0.215], 0.25, s.shirt, { at: [0, 0.085, 0], look: shirtLook });
    b.taper('chest', [0.37 * bulk, 0.19], [0.17, 0.13], 0.06, s.shirt, { at: [0, 0.235, 0.005], look: shirtLook });
  }
  if (!omit.has('neck')) b.cyl('neck', 0.048, 0.054, 0.11, s.skin, { at: [0, 0.03, 0], look: 'skin' });
  if (!omit.has('head')) blockHead(b, s, omit.has('face'));
  props(b);

  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    const ft = `foot${side}` as const;
    const toe = `toe${side}` as const;
    if (!omit.has('upperArms')) {
      b.ball(ua, 0.064 * L, sleeve, { look: shirtLook });
      b.limb(ua, 0.053 * L, 0.047 * L, 0.265, sleeve, { at: [0, -0.01, 0], look: shirtLook });
    }
    b.cyl(ua, 0.0585 * L, 0.0565 * L, 0.07, '#ffffff', { at: [0, -0.12, 0], look: 'tint', seg: b.seg(6, 10, 12) });
    if (!omit.has('forearms')) {
      b.ball(fa, 0.048 * L, s.elbow ?? sleeve, { look: s.elbow ? (s.forearmLook ?? shirtLook) : shirtLook });
      b.limb(fa, 0.046 * L, 0.04 * L, 0.235, s.forearm ?? sleeve, { at: [0, -0.005, 0], look: s.forearmLook ?? shirtLook });
      b.cyl(fa, 0.047 * L, 0.044 * L, 0.05, s.glove, { at: [0, -0.235, 0], look: s.gloveLook ?? 'rubber' });
    }
    if (!omit.has('hands')) (sign > 0 ? blockGrip : blockCup)(b, s);
    if (!omit.has('thighs')) {
      b.ball(th, 0.08 * L, s.pants, { look: pantsLook });
      b.limb(th, 0.08 * L, 0.064 * L, 0.42, s.pants, { at: [0, -0.005, 0], look: pantsLook });
    }
    if (!omit.has('shins')) {
      b.ball(sh, 0.06 * L, s.pants, { look: pantsLook });
      b.limb(sh, 0.058 * L, 0.047 * L, 0.33, s.pants, { at: [0, -0.005, 0], look: pantsLook });
    }
    if (!omit.has('boots')) {
      const bl = s.bootLook ?? 'plastic';
      const sole = s.sole ?? '#2b2f33';
      b.cyl(ft, 0.061 * L, 0.059 * L, 0.13, s.boot, { at: [0, 0.02, 0.0], look: bl });
      b.blob(ft, [0.112, 0.095, 0.205], s.boot, { at: [0, -0.035, -0.035], look: bl, e: 0.35 });
      b.box(ft, [0.116, 0.024, 0.2], sole, { at: [0, -0.073, -0.035], look: 'rubber' });
      b.blob(toe, [0.11, 0.062, 0.085], s.boot, { at: [0, 0.0, -0.032], look: bl, e: 0.4, taper: 0.1 });
      b.box(toe, [0.114, 0.024, 0.085], sole, { at: [0, -0.018, -0.032], look: 'rubber' });
    }
  });
}

/** Head shape and face; the face looks along -Z with its eye line at head-local y 0.075. */
export function blockHead(b: PartSet, s: BodyStyle, noFace = false) {
  b.blob('head', [0.235, 0.275, 0.25], s.skin, { at: [0, 0.095, 0], e: 0.5, taper: 0.16, look: 'skin', keep: true });
  b.mirror((_, sign) => b.blob('head', [0.03, 0.056, 0.042], s.skin, { at: [sign * 0.117, 0.065, 0.01], look: 'skin' }));
  if (!noFace) blockFace(b, s);
}

export function blockFace(b: PartSet, s: BodyStyle, z = -0.121) {
  const eyes = s.eyes ?? '#1d2026';
  b.mirror((_, sign) => {
    b.blob('head', [0.032, 0.044, 0.02], eyes, { at: [sign * 0.048, 0.075, z + 0.004], look: 'gloss', e: 0.8, keep: true });
    if (s.brow) b.box('head', [0.052, 0.013, 0.016], s.brow, { at: [sign * 0.05, 0.118, z - 0.002], rot: [0, 0, sign * (s.browTilt ?? 0.1)], bevel: 0 });
  });
  if (b.detail > 0) b.blob('head', [0.03, 0.042, 0.03], s.skin, { at: [0, 0.035, z - 0.006], look: 'skin', e: 0.7 });
  const m = s.mouth ?? 'smile';
  if (m === 'flat') b.box('head', [0.055, 0.01, 0.012], '#5a2c22', { at: [0, -0.008, z], look: 'skin', bevel: 0 });
  if (m === 'smile' || m === 'grin') {
    b.box('head', [0.044, 0.011, 0.012], '#5a2c22', { at: [0, -0.012, z], look: 'skin', bevel: 0 });
    b.mirror((_, sign) => b.box('head', [0.016, 0.011, 0.012], '#5a2c22', { at: [sign * 0.027, -0.006, z + 0.001], rot: [0, 0, sign * 0.5], look: 'skin', bevel: 0 }));
    if (m === 'grin' && b.detail > 0) b.box('head', [0.04, 0.012, 0.01], '#f4f1e8', { at: [0, -0.003, z - 0.001], look: 'gloss', bevel: 0 });
  }
}

/** Right hand wrapped around a pistol grip; hand-local axes match the weapon (barrel -Z). */
export function blockGrip(b: PartSet, s: BodyStyle) {
  const g = s.glove;
  const look = s.gloveLook ?? 'rubber';
  const fingers = s.fingers ?? g;
  b.blob('handR', [0.032, 0.085, 0.09], g, { at: [0.012, 0.028, -0.052], look, e: 0.5 });
  b.box('handR', [0.052, 0.08, 0.026], fingers, { at: [-0.014, 0.028, -0.098], look });
  b.box('handR', [0.016, 0.075, 0.028], fingers, { at: [-0.04, 0.028, -0.084], look });
  b.blob('handR', [0.022, 0.024, 0.058], g, { at: [-0.04, 0.074, -0.05], rot: [0.15, 0.25, 0], look, e: 0.6 });
}

/** Left hand cupping a handguard that runs along -Z, held from below. */
export function blockCup(b: PartSet, s: BodyStyle) {
  const g = s.glove;
  const look = s.gloveLook ?? 'rubber';
  const fingers = s.fingers ?? g;
  b.blob('handL', [0.08, 0.03, 0.09], g, { at: [0.028, 0.01, -0.062], look, e: 0.5 });
  b.box('handL', [0.024, 0.05, 0.08], fingers, { at: [0.07, 0.04, -0.065], look });
  b.blob('handL', [0.02, 0.022, 0.062], g, { at: [0.0, 0.042, -0.072], rot: [0, -0.15, 0], look, e: 0.6 });
}

/** Grenade held in the left hand, its bone scaled to zero until used; `createCharacter` adds the melee weapon. */
export function props(b: PartSet) {
  b.ball('grenade', 0.036, '#5c7a3a', { at: [0, 0.012, -0.005], scale: [1, 1.15, 1], look: 'plastic' });
  b.cyl('grenade', 0.017, 0.02, 0.03, '#3a4047', { at: [0, 0.058, -0.005], look: 'metal', seg: 6 });
}

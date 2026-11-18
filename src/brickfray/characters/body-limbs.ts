import { hand } from './body-hands';
import { even, orb, tone, type BodyKit } from './body-kit';
import { boot } from './body-boots';
import * as S from './shapes';

const ACROSS: [number, number, number] = [0, 0, Math.PI / 2];

/** Arms and legs: sculpted segments that end in domes, hinge barrels at elbows and knees, cuffs at the wrists. */
export function limbs(k: BodyKit) {
  const { b, s, omit, L, sleeve, shirtLook, pantsLook, fine } = k;
  const steps = k.limbSteps;
  const n = b.hero ? 18 : even(b.seg(6, 8, 12));
  const hinge = b.hero ? 20 : b.seg(6, 10, 12);
  const joint = b.hero ? 18 : b.seg(6, 8, 10);
  const r = (y: number, radius: number, cz = 0, deep = 1.04) => ({ y, rx: radius * L, rz: radius * L * deep, cz: cz * L, e: 2.15 });

  b.mirror((side) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;

    if (!omit.has('upperArms')) {
      orb(b, ua, 0.06 * L, joint, sleeve, { look: shirtLook });
      b.add(ua, S.loft([r(-0.262, 0.044), r(-0.19, 0.0485, -0.001), r(-0.105, 0.0535, -0.002), r(-0.03, 0.052)], n, { steps, bottom: 0.02, top: 0.03 }), sleeve, { look: shirtLook });
    }
    b.cyl(ua, 0.0585 * L, 0.0565 * L, 0.07, '#ffffff', { at: [0, -0.12, 0], look: 'tint', seg: b.seg(6, 10, 12) });

    if (!omit.has('forearms')) {
      const elbow = s.elbow ?? sleeve;
      const elbowLook = s.elbow ? (s.forearmLook ?? shirtLook) : shirtLook;
      b.cyl(fa, 0.0455 * L, 0.0455 * L, 0.1 * L, elbow, { rot: ACROSS, look: elbowLook, seg: hinge });
      if (b.hero) pins(k, fa, 0.05 * L, 0.024 * L, elbow, elbowLook);
      b.add(fa, S.loft([r(-0.252, 0.037), r(-0.19, 0.0405), r(-0.09, 0.0465, 0.002), r(-0.018, 0.0445)], n, { steps, bottom: 0.012, top: 0.02 }), s.forearm ?? sleeve, { look: s.forearmLook ?? shirtLook });
      const cuff: [number, number][] = b.hero
        ? [
            [0, -0.27],
            [0.03 * L, -0.2685],
            [0.0405 * L, -0.264],
            [0.0445 * L, -0.257],
            [0.047 * L, -0.218],
            [0.0495 * L, -0.215],
            [0.0495 * L, -0.206],
            [0.047 * L, -0.202],
            [0, -0.202]
          ]
        : [
            [0, -0.262],
            [0.044 * L, -0.262],
            [0.047 * L, -0.21],
            [0, -0.21]
          ];
      b.lathe(fa, cuff, s.glove, { look: s.gloveLook ?? 'rubber', seg: b.hero ? 20 : b.seg(6, 10, 12) });
    }
    if (!omit.has('hands')) hand(b, s, side, b.hands[side]);

    if (!omit.has('thighs')) {
      b.add(th, S.loft([r(-0.412, 0.059), r(-0.33, 0.0655), r(-0.17, 0.0755, -0.002), r(-0.04, 0.079, -0.001)], n, { steps, bottom: 0.02, top: 0.07 * L }), s.pants, { look: pantsLook });
    }
    if (!omit.has('shins')) {
      b.cyl(sh, 0.057 * L, 0.057 * L, 0.126 * L, s.pants, { rot: ACROSS, look: pantsLook, seg: hinge });
      if (b.hero) pins(k, sh, 0.063 * L, 0.03 * L, s.pants, pantsLook);
      if (fine) b.add(sh, S.blob(0.082 * L, 0.078, 0.036, 0.7, b.hero ? 14 : 8), s.pants, { at: [0, 0.002, -0.046 * L], look: pantsLook });
      b.add(sh, S.loft([r(-0.338, 0.0435), r(-0.26, 0.047, 0.001), r(-0.13, 0.0565, 0.005), r(-0.02, 0.0545, 0.001)], n, { steps, top: 0.02 }), s.pants, { look: pantsLook });
    }
    if (!omit.has('boots')) boot(k, side);
  });
}

/** Round caps with a recessed pin on both ends of a hinge barrel. */
function pins(k: BodyKit, bone: Parameters<BodyKit['b']['cyl']>[0], x: number, radius: number, color: string, look: BodyKit['shirtLook']) {
  const { b } = k;
  for (const side of [-1, 1]) {
    b.cyl(bone, radius, radius, 0.006, tone(color, 0.86), { at: [side * x, 0, 0], rot: ACROSS, look, seg: 16 });
    orb(b, bone, radius * 0.38, 8, tone(color, 0.6), { at: [side * (x + 0.002), 0, 0], scale: [0.5, 1, 1], look });
  }
}

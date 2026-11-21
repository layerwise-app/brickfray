import * as THREE from 'three';
import { hand } from './body-hands';
import { even, orb, tone, type BodyKit } from './body-kit';
import { boot } from './body-boots';
import type { Look, PartSet } from './parts';
import * as S from './shapes';
import type { LoftRing } from './shapes';

const ACROSS: [number, number, number] = [0, 0, Math.PI / 2];

export type LimbPart = 'upperArm' | 'forearm' | 'thigh' | 'shin';
/**
 * Each limb segment's cross-sections hanging down from its joint, at limb thickness 1:
 * [y, radius, centre offset toward the back, depth ÷ width]. The thigh fills out toward the seat and the shin has a calf.
 */
const LIMB: Record<LimbPart, [number, number, number, number][]> = {
  upperArm: [[-0.262, 0.044, 0, 1.04], [-0.19, 0.0485, -0.001, 1.04], [-0.105, 0.0535, -0.002, 1.06], [-0.03, 0.052, 0, 1.04]],
  forearm: [[-0.252, 0.037, 0, 1.04], [-0.19, 0.0405, 0, 1.04], [-0.09, 0.0465, 0.002, 1.04], [-0.018, 0.0445, 0, 1.04]],
  thigh: [[-0.412, 0.0595, 0, 1.04], [-0.33, 0.066, -0.001, 1.06], [-0.17, 0.077, 0, 1.1], [-0.04, 0.081, 0.004, 1.14]],
  shin: [[-0.338, 0.0435, 0.001, 1.05], [-0.26, 0.047, 0.004, 1.08], [-0.13, 0.0565, 0.009, 1.13], [-0.02, 0.0545, 0.002, 1.05]]
};
/** A shared limb's rings at a limb thickness: what its bands, seams and patches are cut from. */
export const limbRings = (part: LimbPart, L: number): LoftRing[] => LIMB[part].map(([y, radius, cz, deep]) => ({ y, rx: radius * L, rz: radius * L * deep, cz: cz * L, e: 2.15 }));
const around = (b: PartSet) => (b.hero ? 18 : even(b.seg(6, 8, 12)));

/**
 * A band lying on one of the shared limbs between two heights, `grow` proud of it: straps, cuffs, tape, hems.
 * It has the limb's own cross-section and facets, so its edges stay level where a round ring would saw through.
 */
export function limbBand(b: PartSet, part: LimbPart, L: number, y0: number, y1: number, grow: number) {
  const rings = limbRings(part, L);
  const at = (y: number): LoftRing => {
    const r = S.loftRingAt(rings, y);
    return { ...r, y, rx: r.rx + grow, rz: r.rz + grow };
  };
  return S.loft(b.hero ? [at(y0), at((y0 + y1) / 2), at(y1)] : [at(y0), at(y1)], around(b));
}

/** Arms and legs: sculpted segments that end in domes, hinge barrels at elbows and knees, cuffs at the wrists. */
export function limbs(k: BodyKit) {
  const { b, s, omit, L, legs, sleeve, shirtLook, pantsLook, fine } = k;
  const steps = k.limbSteps;
  const n = around(b);
  const joint = b.hero ? 18 : b.seg(6, 8, 10);

  b.mirror((side) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;

    if (!omit.has('upperArms')) {
      orb(b, ua, 0.06 * L, joint, sleeve, { look: shirtLook });
      b.add(ua, S.loft(limbRings('upperArm', L), n, { steps, bottom: 0.02, top: 0.03 }), sleeve, { look: shirtLook });
    }
    b.cyl(ua, 0.0585 * L, 0.0565 * L, 0.07, '#ffffff', { at: [0, -0.12, 0], look: 'tint', seg: b.seg(6, 10, 12) });

    if (!omit.has('forearms')) {
      const elbow = s.elbow ?? sleeve;
      const elbowLook = s.elbow ? (s.forearmLook ?? shirtLook) : shirtLook;
      if (elbowLook === 'skin') orb(b, fa, 0.0478 * L, joint, elbow, { scale: [1.07, 1, 1.03], look: elbowLook });
      else if (b.hero && s.joints !== 'hinge') clothElbow(k, side, elbow, elbowLook);
      else hinge(k, fa, 0.0455 * L, 0.1 * L, elbow, elbowLook);
      b.add(fa, S.loft(limbRings('forearm', L), n, { steps, bottom: 0.012, top: 0.02 }), s.forearm ?? sleeve, { look: s.forearmLook ?? shirtLook });
      const G = L * (s.cuff ?? 1);
      const cuff: [number, number][] = b.hero
        ? [
            [0, -0.27],
            [0.03 * G, -0.2685],
            [0.0405 * G, -0.264],
            [0.0445 * G, -0.257],
            [0.047 * G, -0.218],
            [0.0495 * G, -0.215],
            [0.0495 * G, -0.206],
            [0.047 * G, -0.202],
            [0, -0.202]
          ]
        : [
            [0, -0.262],
            [0.044 * G, -0.262],
            [0.047 * G, -0.21],
            [0, -0.21]
          ];
      b.lathe(fa, cuff, s.glove, { look: s.gloveLook ?? 'rubber', seg: b.hero ? 20 : b.seg(6, 10, 12) });
    }
    if (!omit.has('hands')) hand(b, s, side, b.hands[side]);

    if (!omit.has('thighs')) {
      b.add(th, S.loft(limbRings('thigh', legs), n, { steps, bottom: 0.02, top: 0.07 * legs }), s.pants, { look: pantsLook });
    }
    if (!omit.has('shins')) {
      if (b.hero && s.joints !== 'hinge') clothKnee(k, side);
      else hinge(k, sh, 0.057 * legs, 0.126 * legs, s.pants, pantsLook);
      if (fine) b.add(sh, S.blob(0.082 * legs, 0.078, 0.036, 0.7, b.hero ? 14 : 8), s.pants, { at: [0, 0.002, -0.046 * legs], look: pantsLook });
      b.add(sh, S.loft(limbRings('shin', legs), n, { steps, top: 0.02 }), s.pants, { look: pantsLook });
    }
    if (!omit.has('boots')) boot(k, side);
  });
}

/**
 * A sleeve over a bent elbow: a rounded joint flush with the arm, and soft folds across the crook (-Z, where the forearm folds in).
 * The bones share the hinge axis X, so folds on either bone stay across the bend.
 */
function clothElbow(k: BodyKit, side: 'L' | 'R', color: string, look: Look) {
  const { b, L } = k;
  orb(b, `forearm${side}`, 0.0462 * L, 18, color, { at: [0, 0.002, 0.001 * L], scale: [0.98, 1, 1.03], look });
  for (const [y, sag] of [[-0.236, -0.006], [-0.254, -0.005]] as const) crease(b, `upperArm${side}`, 'upperArm', L, y, -1, 1.3, 0.0034 * L, sag, color, look);
  crease(b, `forearm${side}`, 'forearm', L, -0.03, -1, 1.2, 0.003 * L, 0.006, color, look);
}

/** A trouser knee: rounded and flush with the leg, the cap's pad in front, folds behind it where the shin folds back (+Z). */
function clothKnee(k: BodyKit, side: 'L' | 'R') {
  const { b, s, legs, pantsLook } = k;
  orb(b, `shin${side}`, 0.0585 * legs, 20, s.pants, { at: [0, 0.004, 0.002 * legs], scale: [1, 1.05, 1.02], look: pantsLook });
  for (const [y, sag] of [[-0.385, -0.007], [-0.405, -0.006]] as const) crease(b, `thigh${side}`, 'thigh', legs, y, 1, 1.25, 0.004 * legs, sag, s.pants, pantsLook);
  crease(b, `shin${side}`, 'shin', legs, -0.032, 1, 1.15, 0.0036 * legs, 0.007, s.pants, pantsLook);
}

/**
 * A fold lying across a limb at height y on the side `toward` (-1 front, +1 back): a low, wide ridge of cloth that swells
 * over the middle of its `span` (radians either side) and sinks back into the limb at its ends and edges, bowed `sag` in the middle.
 */
function crease(b: PartSet, bone: Parameters<PartSet['add']>[0], part: LimbPart, L: number, y: number, toward: number, span: number, h: number, sag: number, color: string, look: Look) {
  const rings = limbRings(part, L);
  const half = h * 2.4;
  const [nt, ns] = [14, 4];
  const P: number[] = [];
  for (let i = 0; i <= nt; i++) {
    const t = (i / nt) * 2 - 1;
    const a = t * span;
    const sn = Math.sin(a);
    const cs = Math.cos(a);
    for (let j = 0; j <= ns; j++) {
      const u = (j / ns) * 2 - 1;
      const at = y + sag * (1 - t * t) + u * half;
      const ring = S.loftRingAt(rings, at);
      const ex = 2 / ring.e;
      const lift = -0.0015 + (h * (1 - t * t) ** 0.8 + 0.0015) * (1 - u * u) ** 1.5;
      P.push(ring.cx + (ring.rx + lift) * Math.sign(sn) * Math.abs(sn) ** ex, at, ring.cz + toward * ((toward < 0 ? ring.rz : ring.back) + lift) * Math.abs(cs) ** ex);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < nt; i++) {
    for (let j = 0; j < ns; j++) {
      const q = i * (ns + 1) + j;
      if (toward < 0) index.push(q, q + 1, q + ns + 1, q + 1, q + ns + 2, q + ns + 1);
      else index.push(q, q + ns + 1, q + 1, q + 1, q + ns + 1, q + ns + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  b.add(bone, g.toNonIndexed(), color, { look });
}

/**
 * Hinge barrel across a joint. The showroom's has rounded ends with a pin head: a flat cap would face the
 * studio's rim light square on and bleach to white, and its edge would catch it as a bright outline.
 */
function hinge(k: BodyKit, bone: Parameters<BodyKit['b']['cyl']>[0], radius: number, length: number, color: string, look: BodyKit['shirtLook']) {
  const { b } = k;
  if (!b.hero) {
    b.cyl(bone, radius, radius, length, color, { rot: ACROSS, look, seg: b.seg(6, 10, 12) });
    return;
  }
  const cap = radius * 0.3;
  const ends = [-length / 2, length / 2].map((y) => ({ y, rx: radius, rz: radius }));
  b.add(bone, S.loft(ends, 20, { bottom: cap, top: cap, domes: 3 }), color, { rot: ACROSS, look });
  for (const side of [-1, 1]) orb(b, bone, radius * 0.19, 8, tone(color, 0.62), { at: [side * (length / 2 + cap - 0.0015), 0, 0], scale: [0.5, 1, 1], look });
}

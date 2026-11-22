import * as THREE from 'three';
import type { BodyStyle } from './body';
import { FACE_Z, HEAD } from './body-head';
import { limbRings, type LimbPart } from './body-limbs';
import type { Look, PartOptions, PartSet } from './parts';
import type { BoneName, V3 } from './skeleton';
import * as S from './shapes';

/** The body of the low tier: eight-sided tapered torso, tube limbs, mitt hands with a thumb. */
export function blockBody(b: PartSet, s: BodyStyle) {
  const omit = new Set(s.omit ?? []);
  const sleeve = s.sleeve ?? s.shirt;
  const L = s.limbs ?? 1;
  const bulk = s.bulk ?? 1;
  const shirtLook = s.shirtLook ?? 'cloth';
  const pantsLook = s.pantsLook ?? 'cloth';

  if (!omit.has('hips')) {
    lowTaper(b, 'pelvis', [0.24, 0.17], [0.31 * Math.min(bulk, 1.05), 0.2], 0.16, s.pants, { at: [0, -0.045, 0], look: pantsLook, caps: 'bottom' });
    b.blob('pelvis', [0.13, 0.08, 0.15], s.pants, { at: [0, -0.115, 0.0], look: pantsLook, e: 0.6 });
  }
  if (!omit.has('belt') && s.belt) {
    const w = 0.325 * Math.min(bulk, 1.05);
    lowTaper(b, 'pelvis', [w, 0.215], [w, 0.215], 0.05, s.belt, { at: [0, 0.035, 0], look: 'rubber' });
    if (b.detail > 0) b.box('pelvis', [0.06, 0.042, 0.02], s.buckle ?? '#c9b27a', { at: [0, 0.035, -0.11], look: 'metal' });
  }
  if (!omit.has('abdomen')) lowTaper(b, 'spine', [0.28, 0.18], [0.3 * bulk, 0.19], 0.17, s.shirt, { at: [0, 0.065, 0], look: shirtLook });
  if (!omit.has('chest')) {
    lowTaper(b, 'chest', [0.3 * bulk, 0.19], [0.39 * bulk, 0.215], 0.25, s.shirt, { at: [0, 0.085, 0], look: shirtLook });
    lowTaper(b, 'chest', [0.37 * bulk, 0.19], [0.17, 0.13], 0.06, s.shirt, { at: [0, 0.235, 0.005], look: shirtLook, caps: 'top' });
  }
  if (!omit.has('neck')) b.cyl('neck', 0.048, 0.054, 0.11, s.skin, { at: [0, 0.03, 0], look: 'skin' });
  if (!omit.has('head')) blockHead(b, s, omit.has('face'));
  props(b);

  b.mirror((side, sign) => {
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    if (!omit.has('upperArms')) lowShaped(b, ua, 'upperArm', L, 0.064 * L, sleeve, shirtLook, 6, 3);
    lowBand(b, ua, 'upperArm', L, -0.155, -0.085, 0.003, '#ffffff', 'tint');
    if (!omit.has('forearms')) {
      b.add(fa, S.sphere(0.048 * L, 6, 3), s.elbow ?? sleeve, { look: s.elbow ? (s.forearmLook ?? shirtLook) : shirtLook });
      lowShaped(b, fa, 'forearm', L, 0, s.forearm ?? sleeve, s.forearmLook ?? shirtLook);
      lowBand(b, fa, 'forearm', L, -0.26, -0.21, 0.004, s.glove, s.gloveLook ?? 'rubber');
    }
    if (!omit.has('hands')) (sign > 0 ? blockGrip : blockCup)(b, s);
    // The hip ball sits under the hips and the knee ball inside the leg's ends (a pad or cop covers the knee): both coarse.
    if (!omit.has('thighs')) lowShaped(b, th, 'thigh', L, 0.08 * L, s.pants, pantsLook, 6, 3);
    if (!omit.has('shins')) lowShaped(b, sh, 'shin', L, 0.056 * L, s.pants, pantsLook, 6, 3);
    if (!omit.has('boots')) lowBoot(b, s, side, L);
  });
}

/** The low tier's boot: a shaft, a rounded upper on a flat sole that stands out from it a little all round, and a toe. */
export function lowBoot(b: PartSet, s: BodyStyle, side: 'L' | 'R', L: number) {
  const ft = `foot${side}` as const;
  const toe = `toe${side}` as const;
  const bl = s.bootLook ?? 'plastic';
  const sole = s.sole ?? '#2b2f33';
  b.add(ft, S.cylinder(0.061 * L, 0.059 * L, 0.13, 6, true), s.boot, { at: [0, 0.02, 0.0], look: bl });
  b.add(ft, S.blob(0.112, 0.1, 0.21, 0.5, 6, 0), s.boot, { at: [0, -0.032, -0.035], look: bl });
  b.add(ft, S.box(0.116, 0.022, 0.2, 0), sole, { at: [0, -0.074, -0.035], look: 'rubber' });
  b.add(toe, S.blob(0.1, 0.07, 0.11, 0.5, 5, 0), s.boot, { at: [0, 0.002, -0.03], rot: [0, Math.PI / 2, 0], look: bl });
  b.add(toe, S.box(0.114, 0.022, 0.088, 0), sole, { at: [0, -0.019, -0.034], look: 'rubber' });
}

/**
 * A limb of the low tier: an eight-sided tube hung from the joint, open at both ends (the joint balls, cuffs and
 * boots close it), with an eight-sided ball of radius `joint` at the joint when `joint` > 0.
 */
export function lowLimb(b: PartSet, bone: BoneName, joint: number, rTop: number, rBottom: number, len: number, y: number, color: string, look: Look, jointSeg = 8, jointRings = 4) {
  if (joint > 0) b.add(bone, S.sphere(joint, jointSeg, jointRings), color, { look });
  b.add(bone, S.cylinder(rTop, rBottom, len, 8, true), color, { at: [0, y - len / 2, 0], look });
}

/**
 * A limb of the low tier cut from the shared limb shape (bottom, fullest and top rings, eight sides), a little fuller
 * than the higher tiers so it holds its volume without their shading; open at both ends like `lowLimb`.
 */
function lowShaped(b: PartSet, bone: BoneName, part: LimbPart, L: number, joint: number, color: string, look: Look, jointSeg = 8, jointRings = 4) {
  if (joint > 0) b.add(bone, S.sphere(joint, jointSeg, jointRings), color, { look });
  b.add(bone, strip(lowRings(part, L)), color, { look });
}

const lowRings = (part: LimbPart, L: number) => {
  const rings = limbRings(part, L * 1.08);
  return [rings[0]!, rings[2]!, rings[3]!];
};

/** A band lying on a low-tier limb between heights y0 < y1, `grow` proud of it, cut with the limb's own facets so it never sinks into them. */
export function lowBand(b: PartSet, bone: BoneName, part: LimbPart, L: number, y0: number, y1: number, grow: number, color: string, look: Look) {
  const rings = lowRings(part, L);
  const at = (y: number) => {
    const r = S.loftRingAt(rings, y);
    return { ...r, y, rx: r.rx + grow, rz: r.rz + grow, back: r.back + grow };
  };
  b.add(bone, strip([at(y0), at(y1)]), color, { look });
}

const strips = new Map<string, THREE.BufferGeometry>();

/** `S.loft`'s surface through rings in rising y, eight facets around and no end caps: its ends always sit inside a joint, cuff or boot. */
function strip(rings: S.LoftRing[]) {
  const key = JSON.stringify(rings);
  const hit = strips.get(key);
  if (hit) return hit;
  const radial = 8;
  const grid = rings.map((ring) => {
    const r = S.loftRingAt([ring], ring.y);
    const p = 2 / r.e;
    return Array.from({ length: radial }, (_, j) => {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      return new THREE.Vector3(r.cx + r.rx * Math.sign(c) * Math.abs(c) ** p, r.y, r.cz + (sn < 0 ? r.rz : r.back) * Math.sign(sn) * Math.abs(sn) ** p);
    });
  });
  const tu = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const normals = grid.map((ring, i) =>
    ring.map((_, j) => {
      tu.subVectors(ring[(j + 1) % radial]!, ring[(j + radial - 1) % radial]!);
      tv.subVectors(grid[Math.min(i + 1, grid.length - 1)]![j]!, grid[Math.max(i - 1, 0)]![j]!);
      return new THREE.Vector3().crossVectors(tv, tu).normalize();
    })
  );
  const pos: number[] = [];
  const nrm: number[] = [];
  const vertex = (i: number, j: number) => {
    const v = grid[i]![j]!;
    const n = normals[i]![j]!;
    pos.push(v.x, v.y, v.z);
    nrm.push(n.x, n.y, n.z);
  };
  for (let i = 0; i < grid.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const j1 = (j + 1) % radial;
      vertex(i, j);
      vertex(i + 1, j);
      vertex(i, j1);
      vertex(i, j1);
      vertex(i + 1, j);
      vertex(i + 1, j1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  strips.set(key, geometry);
  return geometry;
}

/**
 * Knee pads (or cops) over the knee joint of the low and medium tiers: a cup and, when given, a harder shell on it; `L` is
 * the leg thickness. Five segments around on low, turned so one runs down the front: a ridged pad, symmetric left to right.
 */
export function kneePads(b: PartSet, L: number, cup: string, cupLook: Look, shell?: string, shellLook: Look = 'gloss') {
  // An odd segment count has a seam on one side only: the blob is turned a quarter so it runs down the front instead.
  const pad = (w: number, h: number, d: number, seg: number, color: string, look: Look, at: V3) =>
    b.add(at[0] ? 'shinR' : 'shinL', S.blob(seg % 2 ? d : w, h, seg % 2 ? w : d, 0.55, seg, 0), color, { at: [0, at[1], at[2]], rot: [0, seg % 2 ? Math.PI / 2 : 0, 0], look });
  b.mirror((side) => {
    const r = side === 'R' ? 1 : 0;
    pad(0.108 * L, 0.112, 0.06, b.detail === 0 ? 5 : 6, cup, cupLook, [r, -0.014, -0.05 * L]);
    if (shell) pad(0.08 * L, 0.084, 0.03, 5, shell, shellLook, [r, -0.012, -0.073 * L]);
  });
}

type LowOptions = PartOptions & { seg: number };

/**
 * The low tier's torso block: an eight-sided prism with an elliptic cross-section from [width, depth] at the bottom to
 * [width, depth] at the top (top slid forward by `shiftZ`), so the trunk and shoulders read round instead of boxed.
 * Only the ends that show get a cap.
 */
export function lowTaper(b: PartSet, bone: BoneName, bottom: [number, number], top: [number, number], h: number, color: string, o: PartOptions & { shiftZ?: number; caps?: 'top' | 'bottom' | 'both' } = {}) {
  b.add(bone, octoPrism(bottom, top, h, o.shiftZ ?? 0, o.caps), color, o);
}

const prisms = new Map<string, THREE.BufferGeometry>();

function octoPrism(bottom: [number, number], top: [number, number], h: number, shiftZ: number, caps: 'top' | 'bottom' | 'both' | undefined) {
  const key = [...bottom, ...top, h, shiftZ, caps ?? ''].join(':');
  const hit = prisms.get(key);
  if (hit) return hit;
  const sides = 8;
  // Faces (not corners) touch the [width, depth] box, so the trunk keeps the block's size with its corners cut.
  const flat = 0.5 / Math.cos(Math.PI / sides);
  const pos: number[] = [];
  const nrm: number[] = [];
  // The side normal of an elliptic ring is (depth cos t, width sin t), tilted by how fast the prism narrows.
  const slope = ((bottom[0] + bottom[1]) / 2 - (top[0] + top[1]) / 2) / 2 / h;
  const vertex = (i: number, upper: boolean) => {
    // Rotated half a side so flat faces look front, back and to the sides.
    const t = ((i + 0.5) / sides) * Math.PI * 2;
    const [w, d] = upper ? top : bottom;
    pos.push(Math.cos(t) * w * flat, upper ? h / 2 : -h / 2, Math.sin(t) * d * flat + (upper ? shiftZ : 0));
    const nx = ((bottom[1] + top[1]) / 2) * Math.cos(t);
    const nz = ((bottom[0] + top[0]) / 2) * Math.sin(t);
    const l = Math.hypot(nx, nz);
    const len = Math.hypot(1, slope);
    nrm.push(nx / l / len, slope / len, nz / l / len);
  };
  const cap = (i: number, upper: boolean) => {
    const t = ((i + 0.5) / sides) * Math.PI * 2;
    const [w, d] = upper ? top : bottom;
    pos.push(Math.cos(t) * w * flat, upper ? h / 2 : -h / 2, Math.sin(t) * d * flat + (upper ? shiftZ : 0));
    nrm.push(0, upper ? 1 : -1, 0);
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    vertex(i, false);
    vertex(i, true);
    vertex(j, false);
    vertex(j, false);
    vertex(i, true);
    vertex(j, true);
    if (caps === 'top' || caps === 'both') {
      pos.push(0, h / 2, shiftZ);
      nrm.push(0, 1, 0);
      cap(j, true);
      cap(i, true);
    }
    if (caps === 'bottom' || caps === 'both') {
      pos.push(0, -h / 2, 0);
      nrm.push(0, -1, 0);
      cap(i, false);
      cap(j, false);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  prisms.set(key, geometry);
  return geometry;
}

/** A rounded blob on the low tier, where `b.blob` would fall back to a box: `e` near 1 is an egg, smaller is boxier. */
export function lowBlob(b: PartSet, bone: BoneName, [w, h, d]: V3, color: string, o: LowOptions & { e: number; taper?: number }) {
  b.add(bone, S.blob(w, h, d, o.e, o.seg, o.taper ?? 0), color, o);
}

/** A ball with an explicit segment count, for the big round shapes (helmets) that must not read as polygons. */
export function lowBall(b: PartSet, bone: BoneName, r: number, color: string, o: LowOptions) {
  b.add(bone, S.sphere(r, o.seg, Math.max(4, Math.round(o.seg * 0.7))), color, o);
}

/** A sphere section facing -Z (visor) with an explicit segment count across. */
export function lowSection(b: PartSet, bone: BoneName, r: number, wide: number, tall: number, color: string, o: LowOptions) {
  b.add(bone, S.section(r, wide, tall, o.seg, Math.max(3, Math.round(o.seg / 2))), color, o);
}

/** Head shape and face; the face looks along -Z with its eye line at head-local y 0.075. */
export function blockHead(b: PartSet, s: BodyStyle, noFace = false) {
  b.add('head', S.blob(0.235, 0.275, 0.25, 0.88, 10, 0.18), s.skin, { at: [0, 0.095, 0], look: 'skin' });
  b.mirror((_, sign) => b.add('head', S.blob(0.03, 0.056, 0.042, 0.8, 5), s.skin, { at: [sign * 0.117, 0.065, 0.01], look: 'skin' }));
  if (!noFace) blockFace(b, s);
}

/** Eyes with a catchlight, brows, a nose that catches the light, cheeks and mouth: the face of the low and medium tiers. */
export function blockFace(b: PartSet, s: BodyStyle, z = -0.121) {
  const eyes = s.eyes ?? '#1d2026';
  const lip = '#5a2c22';
  b.mirror((_, sign) => {
    if (b.detail === 0) {
      b.add('head', S.blob(0.034, 0.048, 0.02, 0.8, 5), eyes, { at: [sign * 0.048, 0.074, z + 0.004], look: 'gloss' });
      b.box('head', [0.011, 0.013, 0.008], '#ffffff', { at: [sign * 0.048 + 0.008, 0.084, z - 0.004], look: 'glow', bevel: 0 });
    } else {
      // White, iris, pupil, catchlight and a lash line: an eye that reads at fighting distance, not a dot.
      const x = sign * 0.048;
      const ix = x - sign * 0.003;
      b.add('head', S.blob(0.046, 0.052, 0.014, 0.7, 6), '#f6f3ea', { at: [x, 0.074, z + 0.003], look: 'gloss' });
      b.add('head', S.cylinder(0.0175, 0, 0.002, 8), s.iris ?? '#6a4a30', { at: [ix, 0.073, z - 0.0045], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 1.15], look: 'gloss' });
      b.box('head', [0.016, 0.02, 0.004], eyes, { at: [ix, 0.073, z - 0.006], look: 'gloss', bevel: 0 });
      b.box('head', [0.008, 0.009, 0.003], '#ffffff', { at: [ix + 0.007, 0.082, z - 0.0085], look: 'glow', bevel: 0 });
      // A thin lash line along the top of the white, as the sculpted lids draw it; a thick bar reads as heavy lids.
      b.box('head', [0.05, 0.0035, 0.01], eyes, { at: [x, 0.0985, z + 0.002], rot: [0, 0, sign * 0.08], look: 'gloss', bevel: 0 });
      if (s.lashes) b.box('head', [0.012, 0.003, 0.008], eyes, { at: [x + sign * 0.026, 0.1, z + 0.003], rot: [0, 0, sign * 0.7], look: 'gloss', bevel: 0 });
    }
    if (s.brow) b.box('head', [0.054, 0.014, 0.016], s.brow, { at: [sign * 0.05, 0.121, z - 0.002], rot: [0, 0, sign * (s.browTilt ?? 0.1)], bevel: 0 });
    if (s.blush && b.detail === 0) b.box('head', [0.026, 0.012, 0.008], s.blush, { at: [sign * 0.074, 0.034, z + 0.013], rot: [0, sign * 0.5, 0], look: 'skin', bevel: 0 });
    else if (s.blush) {
      const bz = z === FACE_Z ? S.loftFrontZ(HEAD, sign * 0.076, 0.036) + 0.002 : z + 0.012;
      b.add('head', S.sphere(0.017, 6, 3), s.blush, { at: [sign * 0.076, 0.036, bz], rot: [0, sign * 0.5, 0], scale: [1, 0.75, 0.25], look: 'skin' });
    }
  });
  if (b.detail > 0) b.blob('head', [0.03, 0.042, 0.03], s.skin, { at: [0, 0.035, z - 0.006], look: 'skin', e: 0.7 });
  else b.taper('head', [0.034, 0.03], [0.018, 0.012], 0.044, s.skin, { at: [0, 0.03, z - 0.004], look: 'skin', shiftZ: 0.008 });
  const m = s.mouth ?? 'smile';
  if (m === 'flat') b.box('head', [0.055, 0.01, 0.012], lip, { at: [0, -0.008, z], look: 'skin', bevel: 0 });
  if (m === 'smile' || m === 'grin' || m === 'smirk') {
    const lift = m === 'smirk' ? 0.006 : 0;
    b.box('head', [0.044, 0.011, 0.012], lip, { at: [0, -0.012, z], look: 'skin', bevel: 0 });
    b.mirror((_, sign) => b.box('head', [0.016, 0.011, 0.012], lip, { at: [sign * 0.027, -0.006 + (sign > 0 ? lift : 0), z + 0.001], rot: [0, 0, sign * (sign > 0 && lift ? 0.8 : 0.5)], look: 'skin', bevel: 0 }));
    if (m === 'grin' && b.detail > 0) b.box('head', [0.04, 0.012, 0.01], '#f4f1e8', { at: [0, -0.003, z - 0.001], look: 'gloss', bevel: 0 });
  }
}

/** A full beard for a low-tier head: tapered chin mass under the mouth, sideburns and a drooping mustache, eyes left clear. */
export function lowBeard(b: PartSet, beard: string, light: string) {
  b.add('head', S.blob(0.2, 0.15, 0.1, 0.62, 8, 0.55), beard, { at: [0, -0.045, -0.088], rot: [0.12, 0, 0], look: 'cloth' });
  b.add('head', S.blob(0.09, 0.07, 0.06, 0.7, 6, 0.8), light, { at: [0, -0.115, -0.105], rot: [0.3, 0, 0], look: 'cloth' });
  b.mirror((_, sign) => {
    b.add('head', S.blob(0.05, 0.13, 0.08, 0.75, 5), beard, { at: [sign * 0.1, 0.022, -0.06], rot: [0, 0, sign * 0.08], look: 'cloth' });
    b.add('head', S.blob(0.06, 0.02, 0.026, 0.7, 5, 0.3), light, { at: [sign * 0.028, 0.014, -0.13], rot: [0, sign * -0.25, sign * -0.42], look: 'cloth' });
  });
}

/**
 * A closed knight's visor for a low-tier helm whose face looks along -Z: a brow ridge shading two eye slits,
 * a raised prow down the middle and rows of breathing holes on the cheeks.
 */
export function lowVisor(b: PartSet, steel: string, slit = '#15181c') {
  b.mirror((_, sign) => {
    b.box('head', [0.095, 0.022, 0.026], steel, { at: [sign * 0.05, 0.103, -0.13], rot: [0, sign * -0.3, sign * 0.05], look: 'metal' });
    b.box('head', [0.074, 0.017, 0.02], slit, { at: [sign * 0.05, 0.084, -0.131], rot: [0, sign * -0.3, sign * 0.07], look: 'rubber' });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) b.box('head', [0.012, 0.011, 0.012], slit, { at: [sign * (0.034 + 0.018 * j), 0.03 - 0.022 * i, -0.134 + 0.006 * j], rot: [0, sign * -0.35, 0], look: 'rubber' });
  });
  b.taper('head', [0.026, 0.03], [0.012, 0.02], 0.17, steel, { at: [0, 0.006, -0.138], look: 'metal' });
}

/** Right hand wrapped around a pistol grip; hand-local axes match the weapon (barrel -Z). */
export function blockGrip(b: PartSet, s: BodyStyle) {
  const g = s.glove;
  const look = s.gloveLook ?? 'rubber';
  const fingers = s.fingers ?? g;
  if (b.detail === 0) {
    // A rounded mitt closed around the grip, the thumb wrapped over the top.
    lowBlob(b, 'handR', [0.074, 0.09, 0.098], fingers, { at: [-0.01, 0.028, -0.07], look, e: 0.7, seg: 6 });
    lowBlob(b, 'handR', [0.026, 0.028, 0.062], g, { at: [-0.04, 0.074, -0.05], rot: [0.15, 0.25, 0], look, e: 0.75, seg: 5 });
    return;
  }
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
  if (b.detail === 0) {
    // A rounded mitt under the handguard with its fingers curled up the right side, the thumb along the left.
    lowBlob(b, 'handL', [0.09, 0.062, 0.096], fingers, { at: [0.038, 0.022, -0.064], look, e: 0.7, seg: 6 });
    lowBlob(b, 'handL', [0.024, 0.026, 0.064], g, { at: [0.0, 0.044, -0.072], rot: [0, -0.15, 0], look, e: 0.75, seg: 5 });
    return;
  }
  b.blob('handL', [0.08, 0.03, 0.09], g, { at: [0.028, 0.01, -0.062], look, e: 0.5 });
  b.box('handL', [0.024, 0.05, 0.08], fingers, { at: [0.07, 0.04, -0.065], look });
  b.blob('handL', [0.02, 0.022, 0.062], g, { at: [0.0, 0.042, -0.072], rot: [0, -0.15, 0], look, e: 0.6 });
}

/** Nothing is baked for the hands to hold: the rig puts the real grenade model in the left hand, `createCharacter` adds the melee weapon. */
export function props(_b: PartSet) {}

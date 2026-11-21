import * as THREE from 'three';
import type { BodyStyle } from './body';
import { even, orb, tone } from './body-kit';
import type { PartOptions, PartSet } from './parts';
import * as S from './shapes';
import type { LoftRing } from './shapes';
import type { V3 } from './skeleton';

/** Where the face sits on the shared head; costumes built for a flat face pass their own z. */
export const FACE_Z = -0.121;

/** The shared head's rings: a chin, a jaw narrower than the cheeks, a full cranium. Hair and headgear are fitted to them. */
export const HEAD: LoftRing[] = [
  { y: -0.03, rx: 0.05, rz: 0.106, back: 0.05, e: 2.25 },
  { y: 0.002, rx: 0.087, rz: 0.1195, back: 0.088, e: 2.4 },
  { y: 0.042, rx: 0.109, rz: 0.1245, back: 0.108, e: 2.55 },
  { y: 0.092, rx: 0.1175, rz: 0.125, back: 0.122, e: 2.65 },
  { y: 0.152, rx: 0.114, rz: 0.121, back: 0.124, e: 2.6 },
  { y: 0.2, rx: 0.092, rz: 0.099, back: 0.104, e: 2.4 },
  { y: 0.223, rx: 0.058, rz: 0.063, back: 0.067, e: 2.3 }
];
const MOUTH = '#5a2c22';

/**
 * Adds a part to the shared head's face bent round its curve: every point keeps the depth over the face it has at the
 * part's centre, measured across the face at the centre's height, so a feature wider than a dot lies on the cheek
 * instead of standing off it in a flat plane.
 */
export function onFace(b: PartSet, geometry: THREE.BufferGeometry, color: string, o: PartOptions) {
  const [ax, ay] = o.at ?? [0, 0, 0];
  const g = geometry.clone().applyMatrix4(placement(o));
  const front = (x: number) => S.loftFrontZ(HEAD, x, ay);
  const base = front(ax);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + front(x) - base);
    if (!nor) continue;
    const slope = (front(x + 0.001) - front(x - 0.001)) / 0.002;
    const nz = nor.getZ(i);
    n.set(nor.getX(i) - slope * nz, nor.getY(i), nz).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return b.add('head', g, color, { look: o.look });
}
const n = new THREE.Vector3();
const placement = (o: PartOptions) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...(o.at ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]), 'YXZ')), new THREE.Vector3(...(o.scale ?? [1, 1, 1])));
const ca = new THREE.Color();
const cb = new THREE.Color();
const mix = (from: string, to: string, t: number) => `#${ca.set(from).lerp(cb.set(to), t).getHexString()}`;

/** Sculpted head: cranium, cheeks, jaw and a small chin, with ears. */
export function sculptHead(b: PartSet, s: BodyStyle) {
  const steps = b.hero ? 3 : b.detail;
  b.add('head', S.loft(HEAD, b.hero ? 28 : even(b.seg(8, 12, 16)), { steps, bottom: 0.02, top: 0.0095 }), s.skin, { look: 'skin' });
  b.mirror((_, sign) => ear(b, s, sign));
}

/** An ear standing off the side of the head: a thin pinna rolled into a rim that runs from the bowl over the top and down to the lobe. */
function ear(b: PartSet, s: BodyStyle, sign: number) {
  const turn = new THREE.Euler(0, sign * 0.3, 0);
  const rot: V3 = [0, sign * 0.3, 0];
  // Ear-local: x out from the head, y up, z toward the back.
  const put = (x: number, y: number, z: number): V3 => {
    const v = new THREE.Vector3(sign * x, y, z).applyEuler(turn);
    return [sign * 0.1175 + v.x, 0.066 + v.y, 0.012 + v.z];
  };
  // The rim: an ellipse from inside the bowl, up over the top, round the back and down into the lobe.
  const rim = (t: number, inset = 1, x = 0.0145): V3 => put(x + 0.003 * Math.sin(t / 2) ** 2, 0.004 + 0.028 * inset * Math.sin(t), 0.004 - 0.018 * inset * Math.cos(t));
  const arc = (from: number, to: number, n: number, inset?: number, x?: number) => Array.from({ length: n + 1 }, (_, i) => rim(from + ((to - from) * i) / n, inset, x));
  const helix = [put(0.008, -0.004, 0.0), ...arc(0.05 * Math.PI, 1.42 * Math.PI, b.hero ? 9 : 6)];
  if (!b.hero) {
    // One pinna and a rim whose ends sink into it: the lower tiers' triangle budget.
    b.add('head', S.blob(0.026, 0.064, 0.044, 0.72, 8), s.skin, { at: put(0.002, 0, 0.002), rot, look: 'skin' });
    b.add('head', S.tube([...helix, put(0.005, -0.026, 0.004)], 0.0065, b.detail >= 2 ? 8 : 6, b.detail >= 2 ? 4 : 3), s.skin, { look: 'skin' });
    if (b.detail >= 2) orb(b, 'head', 0.013, 6, tone(s.skin, 0.78), { at: put(0.0105, -0.004, 0.001), rot, scale: [0.32, 1.25, 0.95], look: 'skin' });
    return;
  }
  b.add('head', S.blob(0.026, 0.05, 0.03, 0.75, 12), s.skin, { at: put(-0.002, -0.004, -0.004), rot, look: 'skin' });
  b.add('head', S.blob(0.014, 0.064, 0.044, 0.72, 12), s.skin, { at: put(0.008, 0, 0.003), rot, look: 'skin' });
  b.add('head', S.tube(helix, 0.0058, 16, 6), s.skin, { look: 'skin' });
  orb(b, 'head', 0.0095, 8, s.skin, { at: put(0.009, -0.026, 0.002), rot, scale: [0.6, 1.1, 1], look: 'skin' });
  orb(b, 'head', 0.013, 10, tone(s.skin, 0.78), { at: put(0.0115, -0.004, 0.001), rot, scale: [0.32, 1.25, 0.95], look: 'skin' });
  b.add('head', S.tube(arc(0.55 * Math.PI, 1.3 * Math.PI, 6, 0.55, 0.0135), 0.0034, 10, 5), s.skin, { look: 'skin' });
  orb(b, 'head', 0.0055, 6, s.skin, { at: put(0.012, -0.007, -0.016), rot, scale: [0.6, 1, 0.8], look: 'skin' });
}

const EYE_Y = 0.075;
const EYE_R = 0.0245;
/** Share of the eye layers' modelled depth they stand off the face with: the far eye stays behind the face's profile. */
const DEEP = 0.6;
/** Half width of the eye white at `dy` above its centre, with room for the lid's edge. */
const eyeHalf = (dy: number) => 0.86 * Math.sqrt(Math.max(0, EYE_R * EYE_R - dy * dy)) + 0.0042;

/** Eyes with iris, pupil, highlight and lids, brows, nose and mouth, seated on the head's surface. */
export function sculptFace(b: PartSet, s: BodyStyle, z: number) {
  const at = (x: number, y: number, out = 0): V3 => [x, y, (z === FACE_Z ? S.loftFrontZ(HEAD, x, y) : z) - out];
  const pupil = s.eyes ?? '#1d2026';
  const tilt = s.browTilt ?? 0.1;
  const ex = s.expression ?? {};
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const [gazeX, gazeY] = ex.gaze ?? [0, 0];
  const upper = EYE_R * (clamp(ex.open ?? 0.8) * 2 - 1) * 0.94;
  const lower = -EYE_R * (1 - clamp(ex.squint ?? 0) * 0.8);
  const slant = ex.lidTilt ?? 0.05 + tilt * 0.3;
  const nose = s.nose ?? 1;
  const put = (geometry: THREE.BufferGeometry, color: string, o: PartOptions) => (z === FACE_Z ? onFace(b, geometry, color, o) : b.add('head', geometry, color, o));
  const ball = (r: number, n: number, color: string, o: PartOptions) => put(S.sphere(r, n, Math.max(3, Math.round(n * 0.6))), color, o);

  // Segment counts of the eye's layers: showroom, then high.
  const seg = (hero: number, high: number) => (b.hero ? hero : high);
  b.mirror((side, sign) => {
    const x = sign * 0.048;
    const ix = x - sign * 0.002 + gazeX * 0.0045;
    const iy = EYE_Y - 0.0015 + gazeY * 0.004;
    ball(EYE_R, seg(16, 8), '#f6f3ea', { at: at(x, EYE_Y, -0.0015 * DEEP), scale: [0.86, 1, 0.3 * DEEP], look: 'gloss' });
    ball(0.0165, seg(14, 8), s.iris ?? '#6a4a30', { at: at(ix, iy, 0.004 * DEEP), scale: [1, 1, 0.26 * DEEP], look: 'gloss' });
    ball(0.0098, seg(12, 6), pupil, { at: at(ix, iy, 0.0068 * DEEP), scale: [1, 1, 0.3 * DEEP], look: 'gloss' });
    ball(0.0052, seg(8, 5), '#ffffff', { at: at(ix + 0.0065, iy + 0.008, 0.0082 * DEEP), scale: [1, 1, 0.4 * DEEP], look: 'glow' });
    if (b.hero) ball(0.0026, 6, '#ffffff', { at: at(ix - 0.0055, iy - 0.0065, 0.0078 * DEEP), scale: [1, 1, 0.5 * DEEP], look: 'glow' });

    // Upper lid down to its lash line; a smile or a narrowed look pushes the lower lid up.
    const lid: V3 = [0, 0, sign * slant];
    const wide = eyeHalf(upper);
    put(S.dome(0.027, seg(16, 8), seg(5, 3)), s.skin, { at: at(x, EYE_Y + upper, -0.0015 * DEEP), rot: lid, scale: [wide / 0.027, (EYE_R - upper + 0.0055) / 0.027, 0.34 * DEEP], look: 'skin' });
    ball(0.0268, seg(14, 8), pupil, { at: at(x, EYE_Y + upper, -0.0015 * DEEP), rot: lid, scale: [(wide + 0.0006) / 0.0268, 0.07, 0.37 * DEEP], look: 'gloss' });
    if (lower > -EYE_R + 1e-4) {
      const under = eyeHalf(lower) - 0.002;
      const turn: V3 = [0, 0, Math.PI - sign * slant * 0.5];
      put(S.dome(0.027, seg(16, 8), seg(4, 3)), s.skin, { at: at(x, EYE_Y + lower, -0.0015 * DEEP), rot: turn, scale: [under / 0.027, (EYE_R + lower + 0.003) / 0.027, 0.31 * DEEP], look: 'skin' });
      ball(0.027, seg(14, 8), tone(s.skin, 0.9), { at: at(x, EYE_Y + lower, -0.0015 * DEEP), rot: turn, scale: [under / 0.027, 0.05, 0.31 * DEEP], look: 'skin' });
    }
    if (s.brow) {
      const arch = -sign * 0.0035;
      const lift = ex.brows?.[side === 'L' ? 0 : 1] ?? 0;
      put(
        S.loft(
          [
            { y: -0.028, rx: 0.0072, rz: 0.0075, e: 2.4 },
            { y: -0.008, rx: 0.0075, rz: 0.0078, cx: arch, e: 2.4 },
            { y: 0.014, rx: 0.006, rz: 0.007, cx: arch, e: 2.4 },
            { y: 0.03, rx: 0.0034, rz: 0.005, e: 2.4 }
          ],
          seg(8, 5),
          { steps: b.hero ? 2 : 1, bottom: 0.004, top: 0.003 }
        ),
        s.brow,
        { at: at(sign * 0.05, 0.123 + lift, -0.0005), rot: [0, 0, sign * (tilt - Math.PI / 2)], scale: [1, 1, 0.7] }
      );
    }
    if (s.lashes) {
      for (const [dx, lean, len] of [
        [0.86, 0.95, 0.013],
        [0.62, 0.55, 0.01]
      ] as const) {
        put(S.cylinder(0.0004, 0.0022, len, 5), pupil, { at: at(x + sign * (wide * dx + 0.002), EYE_Y + upper + 0.004 - dx * 0.006, 0.0015), rot: [0, 0, -sign * (lean + slant)], look: 'gloss' });
      }
    }
    if (s.blush) ball(0.017, seg(12, 8), s.blush, { at: at(sign * 0.078, 0.036, -0.002), scale: [1, 0.75, 0.2], look: 'skin' });
  });

  b.add(
    'head',
    S.loft(
      [
        { y: 0.024, rx: 0.0135, rz: 0.016, back: 0.004, e: 2.2 },
        { y: 0.034, rx: 0.0165, rz: 0.0205, back: 0.004, e: 2.2 },
        { y: 0.047, rx: 0.012, rz: 0.0135, back: 0.004, e: 2.2 },
        { y: 0.059, rx: 0.0085, rz: 0.0075, back: 0.004, e: 2.2 }
      ],
      seg(12, 8),
      { steps: b.hero ? 2 : 1, bottom: 0.006, top: 0.007 }
    ),
    s.skin,
    { at: [0, 0.04 * (1 - nose), at(0, 0.04)[2] + 0.003], scale: [nose, nose, nose], look: 'skin' }
  );

  const m = s.mouth ?? 'smile';
  if (m === 'none') return;
  if (m === 'grin') {
    put(S.blob(0.064, 0.032, 0.014, 0.62, seg(12, 8), 0.55), '#4a1f1a', { at: at(0, -0.009, -0.001), look: 'skin' });
    put(S.blob(0.05, 0.0115, 0.012, 0.5, seg(10, 6)), '#f4f1e8', { at: at(0, -0.0015, 0.0018), look: 'gloss' });
    if (b.hero) ball(0.012, 10, '#d96a62', { at: at(0, -0.0175, 0.0005), scale: [1.25, 0.6, 0.45], look: 'gloss' });
    return;
  }
  const line: [number, number][] =
    m === 'flat'
      ? [
          [-0.026, -0.008],
          [0, -0.008],
          [0.026, -0.008]
        ]
      : m === 'smirk'
        ? [
            [-0.029, -0.0095],
            [-0.014, -0.0125],
            [0.004, -0.012],
            [0.02, -0.0065],
            [0.032, 0.0025]
          ]
        : [
          [-0.031, -0.0035],
          [-0.019, -0.0105],
          [0, -0.0135],
          [0.019, -0.0105],
          [0.031, -0.0035]
        ];
  const points = line.map(([x, y]) => at(x, y, 0.0015));
  b.add('head', S.tube(points, 0.0042, seg(14, 8), seg(8, 5)), MOUTH, { look: 'skin' });
  for (const p of [points[0]!, points[points.length - 1]!]) ball(0.0044, seg(8, 5), MOUTH, { at: p, look: 'skin' });
  // A lower lip under the line: a bare line reads as drawn on.
  const low = line.reduce((p, q) => (q[1] < p[1] ? q : p));
  ball(0.011, seg(10, 6), mix(s.skin, '#c8604f', 0.3), { at: at(low[0], low[1] - 0.0068, -0.0052), scale: [1.5, 0.42, 0.5], look: 'skin' });
}

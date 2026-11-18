import type { BodyStyle } from './body';
import { even, orb, tone } from './body-kit';
import type { PartSet } from './parts';
import * as S from './shapes';
import type { LoftRing } from './shapes';
import type { V3 } from './skeleton';

/** Where the face sits on the shared head; costumes built for a flat face pass their own z. */
export const FACE_Z = -0.121;

const HEAD: LoftRing[] = [
  { y: -0.028, rx: 0.06, rz: 0.104, back: 0.058, e: 2.4 },
  { y: 0.002, rx: 0.094, rz: 0.12, back: 0.09, e: 2.5 },
  { y: 0.042, rx: 0.111, rz: 0.1245, back: 0.108, e: 2.6 },
  { y: 0.092, rx: 0.1175, rz: 0.125, back: 0.122, e: 2.65 },
  { y: 0.152, rx: 0.114, rz: 0.121, back: 0.124, e: 2.6 },
  { y: 0.2, rx: 0.092, rz: 0.099, back: 0.104, e: 2.4 },
  { y: 0.223, rx: 0.058, rz: 0.063, back: 0.067, e: 2.3 }
];
const MOUTH = '#5a2c22';

/** Sculpted head: cranium, cheeks, jaw and a small chin, with ears. */
export function sculptHead(b: PartSet, s: BodyStyle) {
  const steps = b.hero ? 3 : b.detail;
  b.add('head', S.loft(HEAD, b.hero ? 28 : even(b.seg(8, 12, 16)), { steps, bottom: 0.016, top: 0.0095 }), s.skin, { look: 'skin' });
  b.mirror((_, sign) => {
    b.add('head', S.blob(0.03, 0.06, 0.042, 0.75, b.hero ? 12 : 8), s.skin, { at: [sign * 0.1175, 0.066, 0.012], look: 'skin' });
    if (b.detail >= 2) orb(b, 'head', 0.014, b.hero ? 10 : 6, tone(s.skin, 0.8), { at: [sign * 0.1305, 0.066, 0.01], scale: [0.3, 1.3, 0.85], look: 'skin' });
  });
}

/** Eyes with iris, pupil, highlight and lids, brows, nose and mouth, seated on the head's surface. */
export function sculptFace(b: PartSet, s: BodyStyle, z: number) {
  const at = (x: number, y: number, out = 0): V3 => [x, y, (z === FACE_Z ? S.loftFrontZ(HEAD, x, y) : z) - out];
  const pupil = s.eyes ?? '#1d2026';
  const tilt = s.browTilt ?? 0.1;

  // Segment counts of the eye's layers: showroom, then high.
  const seg = (hero: number, high: number) => (b.hero ? hero : high);
  b.mirror((_, sign) => {
    const x = sign * 0.048;
    orb(b, 'head', 0.0245, seg(16, 8), '#f6f3ea', { at: at(x, 0.075, -0.0015), scale: [0.86, 1, 0.3], look: 'gloss' });
    orb(b, 'head', 0.0165, seg(14, 8), s.iris ?? '#6a4a30', { at: at(x - sign * 0.002, 0.0735, 0.004), scale: [1, 1, 0.26], look: 'gloss' });
    orb(b, 'head', 0.0098, seg(12, 6), pupil, { at: at(x - sign * 0.002, 0.0735, 0.0068), scale: [1, 1, 0.3], look: 'gloss' });
    orb(b, 'head', 0.0052, seg(8, 5), '#ffffff', { at: at(x + 0.0045, 0.0815, 0.0092), look: 'glow' });
    if (b.hero) orb(b, 'head', 0.0026, 6, '#ffffff', { at: at(x - 0.0075, 0.067, 0.0088), look: 'glow' });
    const lid: V3 = [0, 0, sign * (0.1 + tilt * 0.4)];
    b.add('head', S.dome(0.027, seg(16, 8), seg(5, 3)), s.skin, { at: at(x, 0.0875, -0.0015), rot: lid, scale: [0.9, 0.85, 0.4], look: 'skin' });
    orb(b, 'head', 0.0268, seg(14, 8), pupil, { at: at(x, 0.0875, -0.0015), rot: lid, scale: [0.92, 0.075, 0.43], look: 'gloss' });
    if (s.brow) {
      const arch = -sign * 0.0035;
      b.add(
        'head',
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
        { at: at(sign * 0.05, 0.123, 0.0025), rot: [0, 0, sign * (tilt - Math.PI / 2)] }
      );
    }
    if (s.blush) orb(b, 'head', 0.017, seg(12, 8), s.blush, { at: at(sign * 0.078, 0.036, -0.002), scale: [1, 0.75, 0.2], look: 'skin' });
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
    { at: [0, 0, at(0, 0.04)[2] + 0.003], look: 'skin' }
  );

  const m = s.mouth ?? 'smile';
  if (m === 'none') return;
  if (m === 'grin') {
    b.add('head', S.blob(0.064, 0.032, 0.014, 0.62, seg(12, 8), 0.55), '#4a1f1a', { at: at(0, -0.009, -0.001), look: 'skin' });
    b.add('head', S.blob(0.05, 0.0115, 0.012, 0.5, seg(10, 6)), '#f4f1e8', { at: at(0, -0.0015, 0.0018), look: 'gloss' });
    if (b.hero) orb(b, 'head', 0.012, 10, '#d96a62', { at: at(0, -0.0175, 0.0005), scale: [1.25, 0.6, 0.45], look: 'gloss' });
    return;
  }
  const line: [number, number][] =
    m === 'flat'
      ? [
          [-0.026, -0.008],
          [0, -0.008],
          [0.026, -0.008]
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
  for (const p of [points[0]!, points[points.length - 1]!]) orb(b, 'head', 0.0044, seg(8, 5), MOUTH, { at: p, look: 'skin' });
}

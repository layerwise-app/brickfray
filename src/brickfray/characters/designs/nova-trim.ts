import { limbBand } from '../body-limbs';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { V3 } from '../skeleton';
import { C, onHelmet, onVisor, VISOR } from './nova-suit';
import { pick, samples, surface, type Surface } from './sheet';
import { Garment, limbGarment, type Ring } from './tailor';

const HALF = Math.PI / 2;

/**
 * What the gold visor mirrors, laid on it as plates: the dark floor along its lower rim, the bright ceiling along the top,
 * a window glint, and the head-up display showing through. A plain gold dome reads flat.
 */
export function visorDepth(b: PartSet) {
  const us = samples(pick(b, 6, 8, 22));
  const crescent = (from: number, to: number, deep: number, lift: number): Surface => (s, t) => {
    const inner = 0.972 - deep * Math.sin(s * Math.PI) ** 0.85;
    return onVisor(from + (to - from) * s, inner + (0.972 - inner) * t, lift);
  };
  b.add('head', surface(us, samples(pick(b, 1, 2, 4)), crescent(0.545, 0.955, 0.4, 0.0007)), '#a96f1c', { look: VISOR(b) });
  if (b.detail < 2) return;
  b.add('head', surface(us, samples(pick(b, 1, 1, 3)), crescent(0.07, 0.43, 0.2, 0.0007)), '#ffe9ad', { look: VISOR(b) });
  // A lip of bright metal where the visor meets its bezel.
  if (b.hero) b.add('head', surface(samples(pick(b, 16, 28, 64)), [0.955, 1.01], (s, t) => onVisor(s, t, 0.0016)), C.chrome, { look: 'metal' });
  const glint = (ax: number, ay: number, wide: number, tall: number): Surface => (s, t) => onHelmet(ax + wide * (s - 0.5) + 0.1 * (t - 0.5), ay + tall * (t - 0.5), 0.0064);
  b.add('head', surface(samples(2), samples(pick(b, 2, 2, 5)), glint(0.36, 0.34, 0.085, 0.3), false, true), '#fff6dc', { look: 'gloss' });
  if (!b.hero) return;
  b.add('head', surface(samples(2), samples(3), glint(0.5, 0.25, 0.03, 0.2), false, true), '#fff6dc', { look: 'gloss' });
  // Head-up display: a reticle ring and a short read-out, glowing through from inside.
  const hud = (ax: number, ay: number): { at: V3; rot: V3 } => ({ at: onHelmet(ax, ay, 0.0064), rot: [ay, -ax, 0] });
  b.add('head', S.torus(0.013, 0.0014, 4, 16), C.cyan, { ...hud(-0.46, 0.2), look: 'glow' });
  b.box('head', [0.005, 0.005, 0.002], C.cyan, { ...hud(-0.46, 0.2), look: 'glow', bevel: 0 });
  [0.03, 0.021, 0.026].forEach((w, i) => b.box('head', [w, 0.0035, 0.002], i === 1 ? '#ff5ab0' : C.cyan, { ...hud(-0.47 + (0.03 - w) * 2.6, -0.02 - i * 0.045), look: 'glow', bevel: 0 }));
}

/** Panels, stripes and fittings that break up the white: a grey shoulder yoke, flank stripes, leg and arm plates, boot caps. */
export function panels(b: PartSet, bulk: number, L: number) {
  const hero = b.hero;
  const chest = new Garment(
    (
      [
        [-0.028, 0.15, 0.094],
        [0.05, 0.165, 0.099],
        [0.13, 0.18, 0.1035],
        [0.19, 0.19, 0.1055],
        [0.226, 0.15, 0.087]
      ] as const
    ).map(([y, rx, rz]): Ring => [y, 2 * rx * bulk, 2 * rz]),
    3
  );
  const around = pick(b, 12, 16, 32);
  b.add('chest', chest.panel({ y: [0.172, 0.224], a: [0, Math.PI * 2], lift: 0.0008, thick: 0.0035, seg: [around, pick(b, 1, 2, 3)] }), C.shade, { look: 'plastic' });
  b.add('chest', chest.panel({ y: [0.164, 0.172], a: [0, Math.PI * 2], lift: 0.0012, thick: 0.0035, seg: [around, 1] }), C.purple, { look: 'gloss' });
  const thigh = limbGarment('thigh', L);
  const shin = limbGarment('shin', L);
  const upper = limbGarment('upperArm', L);
  b.mirror((side, sign) => {
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    const ua = `upperArm${side}` as const;
    const out = sign * HALF;
    b.add('chest', chest.panel({ y: [-0.022, 0.128], a: [out - 0.2, out + 0.2], lift: 0.0008, thick: 0.0028, seg: [pick(b, 2, 2, 4), pick(b, 1, 1, 3)] }), C.purple, { look: 'gloss' });
    // Leg plates in grey with a purple pinstripe, a stripe down the outside of the thigh, a harness loop at the hip.
    if (hero) b.add(th, thigh.panel({ y: [-0.287, -0.088], a: [-0.74, 0.74], lift: 0.0008, thick: 0.0034, seg: [pick(b, 3, 4, 8), pick(b, 1, 2, 3)] }), C.shade, { look: 'plastic' });
    if (hero) b.add(sh, shin.panel({ y: [-0.292, -0.122], a: [-0.82, 0.82], lift: 0.0008, thick: 0.0034, seg: [pick(b, 3, 4, 8), pick(b, 1, 2, 3)] }), C.shade, { look: 'plastic' });
    if (b.detail < 2) return;
    b.add(th, thigh.panel({ y: [-0.292, -0.09], a: [out - 0.075, out + 0.075], lift: 0.0006, thick: 0.002, seg: [1, 3] }), C.purple, { look: 'gloss' });
    b.add(sh, shin.panel({ y: [-0.276, -0.14], a: [-0.1, 0.1], lift: 0.0044, thick: 0.0012, seg: [1, 3] }), C.purple, { look: 'gloss' });
    if (!hero) return;
    b.add(th, limbBand(b, 'thigh', L, -0.07, -0.05, 0.0042), C.joint, { look: 'rubber' });
    b.add(ua, upper.panel({ y: [-0.188, -0.108], a: [out - 0.85, out + 0.85], lift: 0.0008, thick: 0.003, seg: [8, 1] }), C.shade, { look: 'plastic' });
    b.add(th, thigh.panel({ y: [-0.096, -0.089], a: [-0.74, 0.74], lift: 0.0044, thick: 0.001, seg: [8, 1] }), C.purple, { look: 'gloss' });
    b.box(th, [0.022, 0.014, 0.008], C.chrome, { ...thigh.place(-0.06, 0, 0.005), look: 'metal', bevel: 0.003 });
    for (const a of [-0.5, 0.5]) for (const y of [-0.27, -0.105]) b.add(th, S.sphere(0.0045, 6, 4), C.chrome, { ...thigh.place(y, a * 1.2, 0.0045), look: 'metal' });
    for (let i = 0; i < 3; i++) b.box(th, [0.03, 0.005, 0.004], C.dark, { ...thigh.place(-0.13 - i * 0.014, 0, 0.0036), look: 'rubber', bevel: 0 });
    b.box(sh, [0.016, 0.008, 0.004], C.cyan, { ...shin.place(-0.128, 0, 0.0046), look: 'glow', bevel: 0 });
    for (const a of [-0.66, 0.66]) b.add(sh, S.sphere(0.0045, 6, 4), C.chrome, { ...shin.place(-0.15, a, 0.0045), look: 'metal' });
    b.add(ua, upper.panel({ y: [-0.115, -0.108], a: [out - 0.85, out + 0.85], lift: 0.004, thick: 0.001, seg: [8, 1] }), C.purple, { look: 'gloss' });
    // Boot: a bumper over the toe, a heel light.
    b.add(`toe${side}`, S.blob(0.118, 0.03, 0.05, 0.6, 12), C.purple, { at: [0, 0.006, -0.058], look: 'gloss' });
    b.box(`foot${side}`, [0.03, 0.014, 0.006], C.cyan, { at: [0, -0.02, 0.071], look: 'glow', bevel: 0.002 });
  });
  if (!hero) return;
  // Name tape over the chest unit.
  const tape = chest.place(0.196, chest.front(0.196, 0.062), 0.0046);
  b.box('chest', [0.056, 0.02, 0.004], C.purple, { ...tape, look: 'gloss', bevel: 0.0015 });
  [-0.016, -0.006, 0.004, 0.014].forEach((x, i) => b.box('chest', [0.006, i % 2 ? 0.008 : 0.011, 0.002], C.suit, { at: [tape.at[0] - x, tape.at[1], tape.at[2] - 0.0026], rot: tape.rot, look: 'gloss', bevel: 0 }));
}

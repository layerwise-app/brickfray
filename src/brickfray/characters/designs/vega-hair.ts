import * as THREE from 'three';
import { orb } from '../body-kit';
import { HEAD } from '../body-head';
import type { PartSet } from '../parts';
import * as S from '../shapes';
import type { V3 } from '../skeleton';
import { lump, SKULL, strand, tapering, tier } from './tailor';

export const C = {
  teal: '#1fa7a0',
  tealDark: '#157a75',
  white: '#f2f2ee',
  skin: '#f1c7a1',
  hair: '#b5502a',
  hairLight: '#cc6a3a',
  hairDark: '#8f3b1e',
  scarf: '#f5a623',
  scarfDark: '#d98a1a',
  dark: '#2a2f38',
  slate: '#39424e',
  steel: '#cfd6da',
  amber: '#ffb347',
  mouth: '#5a2c22',
  lip: '#e5a888'
};

const HALF = Math.PI / 2;
const { lerp, smoothstep } = THREE.MathUtils;
/** Where the ponytail's bone hangs from, in head space (designs/index.ts). */
const KNOT: V3 = [0, 0.215, 0.125];
type Stop = [y: number, a: number, lift: number];
interface LockOptions {
  flat?: number;
  side?: V3;
  tip?: number;
  more?: number;
}
type Lock = (bone: 'head' | 'dangleHead', points: V3[], r: number, color: string, o?: LockOptions) => void;

/** Copper hair: fitted cap, combed-back ridges, side-swept fringe, face-framing locks and a high ponytail of loose strands. */
export function hair(b: PartSet) {
  const hi = b.detail >= 2;
  const seg = tier(b, 4, 5, 14);
  const radial = tier(b, 4, 5, 12);
  const lock: Lock = (bone, points, r, color, o = {}) => {
    b.add(bone, strand(points, tapering(r, o.tip), { flat: o.flat ?? 0.5, side: o.side ?? [0, 1, 0], seg: seg + (o.more ?? 0), radial }), color, { look: 'cloth' });
  };

  // Cap: all around above the brow, behind the ears below it, down to the hairline at the nape, closed over the crown.
  const y0 = -0.016;
  const y1 = 0.223;
  const cap = (t: number): [number, number] => {
    const y = lerp(y0, y1, t);
    const behindEars = lerp(0.85, HALF - 0.42, smoothstep(y, y0, 0.05));
    const half = lerp(lerp(behindEars, HALF + 0.62, smoothstep(y, 0.085, 0.118)), Math.PI, smoothstep(y, 0.15, 0.172));
    return [Math.PI - half, Math.PI + half];
  };
  // Off the showroom the cap's facets are coarser than the head's: it stands off far enough that no facet dips into the scalp.
  const lift = b.hero ? 0.001 : b.detail >= 2 ? 0.004 : b.lean ? 0.008 : 0.006;
  b.add('head', SKULL.panel({ y: [y0, y1], a: cap, lift, thick: b.hero ? 0.008 : 0.011, seg: [b.lean ? 8 : tier(b, 10, 14, 30), b.lean ? 3 : tier(b, 3, 4, 8)] }), C.hair, { look: 'cloth' });
  b.add('head', S.dome(0.08, tier(b, 8, 10, 20), tier(b, 2, 3, 5)), C.hair, { at: [0, 0.222, 0.004], scale: [0.95, 0.3, 1.05], look: 'cloth' });
  lump(b, 'head', [0.1, 0.085, 0.1], tier(b, 6, 8, 14), C.hair, { at: [0, 0.2, 0.092], rot: [-0.5, 0, 0], look: 'cloth', e: 0.9 });

  // Locks combed back to the knot, from the hairline over the top and up from the nape: on the showroom figure a
  // darker under layer and a lighter, rounder over layer laid in its gaps, so the hair has depth instead of planks.
  const knot: V3 = [KNOT[0], KNOT[1] - 0.012, KNOT[2] - 0.03];
  const combed = (a: number, r: number, color: string, lift: number, flat: number) => {
    const start = SKULL.path([
      [0.176, a, 0.013 + lift],
      [0.206, a * 1.04, 0.015 + lift]
    ]);
    const over: V3 = [start[1]![0] * 0.5, 0.243 + lift - Math.abs(a) * 0.006, lerp(start[1]![2], knot[2], 0.55)];
    lock('head', [...start, over, knot], r, color, { flat, side: SKULL.around(0.19, a), tip: 0.55 });
  };
  const nape = (a: number, r: number, color: string, lift: number, flat: number) => {
    const up = SKULL.path([
      [0.0, lerp(a, Math.PI, 0.45), 0.008 + lift],
      [0.09, a, 0.014 + lift],
      [0.17, lerp(a, Math.PI, 0.25), 0.016 + lift]
    ]);
    lock('head', [...up, knot], r, color, { flat, side: SKULL.around(0.12, a), tip: 0.6 });
  };
  if (b.hero) {
    const under = [-1.95, -1.5, -1.05, -0.62, -0.2, 0.22, 0.64, 1.07, 1.5, 1.95];
    under.forEach((a, i) => combed(a, 0.026, i % 2 ? C.hairDark : C.hair, 0, 0.55));
    under.slice(0, -1).forEach((a, i) => combed((a + under[i + 1]!) / 2, 0.019, i % 3 ? C.hairLight : C.hair, 0.006, 0.72));
    const back = [2.15, 2.5, 2.85, 3.2, 3.55, 3.9, 4.2];
    back.forEach((a, i) => nape(a, 0.024, i % 2 ? C.hairDark : C.hair, 0, 0.55));
    back.slice(0, -1).forEach((a, i) => nape((a + back[i + 1]!) / 2, 0.018, i % 2 ? C.hairLight : C.hair, 0.006, 0.72));
    // Swept back above the ears, over the cap's edge.
    b.mirror((_, sign) => {
      for (const [y, r, color] of [
        [0.118, 0.017, C.hair],
        [0.138, 0.019, C.hairDark],
        [0.16, 0.018, C.hairLight]
      ] as const) {
        const path = SKULL.path([
          [y, sign * 1.42, 0.009],
          [y + 0.008, sign * 1.85, 0.012],
          [y + 0.02, sign * 2.35, 0.015]
        ]);
        lock('head', [...path, knot], r, color, { flat: 0.6, side: SKULL.around(y, sign * 1.9), tip: 0.5 });
      }
    });
  } else {
    const tops = hi ? [-1.75, -1.05, -0.35, 0.35, 1.05, 1.75] : [-1.3, 0, 1.3];
    for (const [i, a] of tops.entries()) combed(a, (0.24 / tops.length) * (i % 2 ? 0.92 : 1), i % 2 ? C.hair : C.hairLight, 0, 0.5);
    if (hi) for (const [i, a] of [2.45, Math.PI, 3.83].entries()) nape(a, 0.042, i % 2 ? C.hairLight : C.hair, 0, 0.42);
  }

  // Fringe swept from a parting over her right eye toward her left temple.
  const fringe: [Stop[], number, string][] = [
    [
      [
        [0.214, 0.5, 0.012],
        [0.196, 0.06, 0.021],
        [0.168, -0.42, 0.02],
        [0.136, -0.82, 0.011]
      ],
      0.03,
      C.hair
    ],
    [
      [
        [0.21, 0.56, 0.012],
        [0.186, 0.26, 0.022],
        [0.156, -0.1, 0.021],
        [0.128, -0.44, 0.012]
      ],
      0.027,
      C.hairLight
    ],
    [
      [
        [0.21, 0.62, 0.012],
        [0.186, 0.86, 0.02],
        [0.15, 1.08, 0.013]
      ],
      0.026,
      C.hair
    ],
    [
      [
        [0.216, 0.36, 0.012],
        [0.204, -0.3, 0.021],
        [0.184, -0.8, 0.019],
        [0.152, -1.16, 0.011]
      ],
      0.028,
      C.hairLight
    ]
  ];
  for (const [stops, r, color] of hi ? fringe : fringe.slice(0, 2)) lock('head', SKULL.path(stops), r, color, { flat: 0.4, more: 2 });

  // Locks in front of the ears: long on her left, short on her right.
  const sideLock = (sign: number, length: number, r: number, color: string, lean: number) => {
    const a = sign * (HALF - 0.5);
    const top = SKULL.path([
      [0.158, a, 0.012],
      [0.11, a + sign * 0.06, 0.016]
    ]);
    const end = SKULL.point(0.11 - length * 0.55, a + sign * lean, 0.02, new THREE.Vector3());
    const tip: V3 = [end.x + sign * 0.012, 0.11 - length, end.z - 0.012];
    lock('head', [...top, end.toArray() as V3, tip], r, color, { flat: 0.55, side: SKULL.around(0.11, a), more: 2 });
  };
  sideLock(-1, 0.14, 0.02, C.hair, 0.02);
  sideLock(1, 0.085, 0.018, C.hair, 0.02);
  if (hi) sideLock(-1, 0.1, 0.014, C.hairLight, -0.14);

  // Two flyaways at the crown.
  if (hi) {
    for (const [x, lean, r] of [
      [0.012, 0.05, 0.007],
      [-0.016, -0.03, 0.0055]
    ] as const) {
      lock('head', [[x, 0.232, -0.03], [x + lean * 0.4, 0.262, -0.04], [x + lean, 0.278, -0.016], [x + lean * 1.5, 0.27, 0.012]], r, C.hairLight, { flat: 0.7, side: [1, 0, 0], tip: 0.2 });
    }
  }

  ponytail(b, lock);
}

function ponytail(b: PartSet, lock: Lock) {
  // Hair tie where the tail leaves the head.
  if (b.hero) {
    b.torus('dangleHead', 0.026, 0.012, C.teal, { at: [0, 0.004, 0.006], rot: [0.75, 0, 0], look: 'gloss' });
    b.ball('dangleHead', 0.009, C.white, { at: [0.03, 0.0, 0.0], look: 'gloss' });
  } else b.cyl('dangleHead', 0.036, 0.036, 0.022, C.teal, { at: [0, 0.004, 0.006], rot: [0.75 - HALF, 0, 0], look: 'gloss', seg: tier(b, 8, 10, 10) });
  // A full round tail; on the showroom figure locks of three tones wrap its front, sides and back, each with a
  // blunt clumped end, so it has volume from every side.
  lock(
    'dangleHead',
    [
      [0, -0.012, -0.012],
      [0, 0.02, 0.034],
      [0, -0.045, 0.078],
      [0, -0.17, 0.092],
      [0.008, -0.285, 0.07],
      [0.014, -0.34, 0.086]
    ],
    b.hero ? 0.044 : 0.046,
    C.hair,
    { flat: b.hero ? 0.92 : 0.8, side: [1, 0, 0], tip: b.hero ? 0.22 : 0.1, more: 4 }
  );
  // [x, length, radius, out (toward the back), color]
  const strands: [number, number, number, number, string][] = b.hero
    ? [
        [-0.022, 0.29, 0.027, 0.012, C.hairLight],
        [0.022, 0.31, 0.026, 0.0, C.hairDark],
        [-0.006, 0.36, 0.026, 0.022, C.hairLight],
        [0.012, 0.25, 0.024, 0.026, C.hair],
        [-0.026, 0.23, 0.022, -0.006, C.hairDark],
        [0.026, 0.26, 0.022, 0.014, C.hairLight],
        [0.004, 0.33, 0.024, -0.014, C.hairDark],
        [-0.014, 0.31, 0.023, -0.01, C.hair],
        [0.016, 0.34, 0.022, 0.018, C.hair]
      ]
    : [
        [-0.03, 0.26, 0.024, 0.014, C.hairLight],
        [0.032, 0.3, 0.022, -0.004, C.hairDark],
        [-0.012, 0.36, 0.022, 0.03, C.hairLight]
      ];
  for (const [x, length, r, out, color] of strands.slice(0, tier(b, 1, 3, 9))) {
    lock(
      'dangleHead',
      [
        [x * 0.3, -0.004, -0.004],
        [x * 0.7, 0.022, 0.04 + out * 0.4],
        [x, -0.04, 0.086 + out],
        [x * 1.15, -length * 0.62, 0.1 + out],
        [x * 1.3 + 0.01, -length, 0.078 + out * 1.4]
      ],
      r,
      color,
      { flat: b.hero ? 0.9 : 0.8, side: [1, 0, 0], tip: b.hero ? 0.3 : 0.08, more: 3 }
    );
  }
}

/** Goggles pushed up on the forehead: twin cups with amber lenses on a striped strap, plus her earpiece. */
export function goggles(b: PartSet) {
  const hi = b.detail >= 2;
  const round = tier(b, 8, 12, 24);
  /** The cups look forward and a little up: their axis is tipped this far from vertical. */
  const tilt = HALF - 0.42;
  const strapA = 0.62;
  b.add('head', SKULL.panel({ y: [0.176, 0.2], a: [strapA, Math.PI * 2 - strapA], lift: 0.018, thick: 0.005, seg: [tier(b, 10, 14, 32), 1] }), C.dark, { look: 'rubber' });
  if (b.hero) b.add('head', SKULL.panel({ y: [0.185, 0.191], a: [strapA + 0.1, Math.PI * 2 - strapA - 0.1], lift: 0.023, thick: 0.0008, seg: [32, 1] }), C.teal, { look: 'cloth' });
  b.mirror((_, sign) => {
    const at: V3 = [sign * 0.047, 0.205, -0.118];
    const out = (d: number): V3 => [at[0], at[1] + Math.cos(tilt) * d, at[2] - Math.sin(tilt) * d];
    b.cyl('head', 0.031, 0.036, 0.034, C.dark, { at, rot: [-tilt, 0, 0], look: 'rubber', seg: round });
    b.cyl('head', 0.026, 0.026, 0.008, C.amber, { at: out(0.015), rot: [-tilt, 0, 0], look: 'glass', seg: round });
    if (!hi) return;
    if (b.hero) b.torus('head', 0.029, 0.0045, C.teal, { at: out(0.017), rot: [HALF - tilt, 0, 0], look: 'gloss' });
    else b.cyl('head', 0.0335, 0.0335, 0.007, C.teal, { at: out(0.012), rot: [-tilt, 0, 0], look: 'gloss', seg: round });
    b.box('head', [0.014, 0.02, 0.012], C.steel, { at: [sign * 0.094, 0.196, -0.092], rot: [0, sign * -0.9, 0], look: 'metal', bevel: b.hero ? 0.003 : 0 });
    if (b.hero) for (const dx of [-0.012, 0, 0.012]) b.box('head', [0.006, 0.003, 0.012], '#14171a', { at: [at[0] + dx, at[1] + 0.03, at[2] + 0.012], rot: [HALF - tilt, 0, 0], look: 'rubber', bevel: 0 });
  });
  b.box('head', [0.03, 0.022, 0.02], C.dark, { at: [0, 0.203, -0.122], rot: [HALF - tilt, 0, 0], look: 'rubber', bevel: b.hero ? 0.005 : 0 });
  if (!hi) return;

  // Earpiece on her left with a short boom mic.
  lump(b, 'head', [0.018, 0.04, 0.03], tier(b, 6, 6, 12), C.dark, { at: [-0.134, 0.072, 0.008], look: 'rubber', e: 0.6 });
  b.add(
    'head',
    strand(
      [
        [-0.136, 0.06, 0.0],
        [-0.132, 0.034, -0.05],
        [-0.108, 0.012, -0.098]
      ],
      0.0035,
      { seg: tier(b, 3, 3, 8), radial: tier(b, 4, 4, 6) }
    ),
    C.dark,
    { look: 'rubber' }
  );
  lump(b, 'head', [0.015, 0.015, 0.015], tier(b, 5, 5, 8), C.dark, { at: [-0.106, 0.011, -0.101], look: 'rubber', e: 1 });
  if (b.hero) b.ball('head', 0.0045, '#7dffe6', { at: [-0.1435, 0.082, 0.004], look: 'glow' });
}

/** Freckles across the nose and cheeks. */
export function freckles(b: PartSet) {
  for (const [x, y] of [
    [0.052, 0.046],
    [0.066, 0.052],
    [0.06, 0.038],
    [0.076, 0.042]
  ] as const) {
    b.mirror((_, sign) => b.cyl('head', 0.0026, 0.0026, 0.0012, '#c98a62', { ...SKULL.stud(y, SKULL.front(y, sign * x), 0.0002), look: 'skin', seg: b.hero ? 16 : 6 }));
  }
}

/** Her smirk, rising toward her left, in head space. */
const SMIRK: [number, number][] = [
  [-0.029, -0.0095],
  [-0.014, -0.0125],
  [0.004, -0.012],
  [0.02, -0.0065],
  [0.032, 0.0025]
];

/** The smirk drawn here instead of by the shared face, so the lower lip sits centred under it and follows its lift. */
export function smirk(b: PartSet) {
  const at = (x: number, y: number, out: number): V3 => [x, y, S.loftFrontZ(HEAD, x, y) - out];
  // A painted line: a flat band lying in the skin, proud of it by under a millimetre, so the profile stays clean.
  const points = SMIRK.map(([x, y]) => at(x, y, -0.0006));
  const width = (t: number) => 0.0034 * (1 - 0.45 * Math.abs(2 * t - 1) ** 2);
  b.add('head', strand(points, width, { flat: 0.4, side: [0, 1, 0], seg: b.hero ? 16 : b.lean ? 5 : 8, radial: b.hero ? 10 : b.lean ? 4 : 6 }), C.mouth, { look: 'skin' });
  orb(b, 'head', 0.011, b.hero ? 12 : b.lean ? 5 : 6, C.lip, { at: at(0.002, -0.0178, -0.0036), rot: [0, 0, 0.12], scale: [1.4, 0.38, 0.38], look: 'skin' });
}

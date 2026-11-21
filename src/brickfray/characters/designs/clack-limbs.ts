import * as THREE from 'three';
import { wristOffset } from '../body-hands';
import { orb, tone } from '../body-kit';
import type { HandShape, PartSet } from '../parts';
import type { BoneName, V3 } from '../skeleton';
import { GOLD, MAIL, MAIL_LOOK, SHADOW, STEEL } from './clack-armor';
import * as S from '../shapes';
import { rivets, sweep } from './plate-fittings';
import { Loft, pick, tier, type Spot } from './plate-forms';

const ACROSS: V3 = [0, 0, Math.PI / 2];
/** Lofts built along Y and laid along the foot: their y runs toward the heel, their front faces up. */
const LAID: V3 = [Math.PI / 2, 0, 0];

const CAP = new Loft([
  { y: 0.012, w: 0.1, f: 0.1 },
  { y: 0.03, w: 0.0925, f: 0.0925 },
  { y: 0.056, w: 0.079, f: 0.079 },
  { y: 0.077, w: 0.058, f: 0.058 },
  { y: 0.091, w: 0.032, f: 0.032 },
  { y: 0.097, w: 0, f: 0 }
]);
const LAME_A = new Loft([
  { y: -0.078, w: 0.075, f: 0.077 },
  { y: -0.04, w: 0.081, f: 0.083 },
  { y: -0.004, w: 0.084, f: 0.086 }
]);
const LAME_B = new Loft([
  { y: -0.13, w: 0.068, f: 0.07 },
  { y: -0.095, w: 0.073, f: 0.075 },
  { y: -0.058, w: 0.075, f: 0.077 }
]);
/** Where a weapon-holding hand sits off the wrist; mirrors the holds in body-hands. */
const HAND_SEAT: Partial<Record<HandShape, { at: V3; rot: V3 }>> = {
  grip: { at: [0.011, 0.03, 0], rot: [-0.22, 0, 0] },
  cup: { at: [0.012, 0.012, -0.012], rot: [0, 0.87, -Math.PI / 2] }
};

/** Pauldrons (a fixed cap and two sliding lames), rerebrace, winged couter, vambrace, gauntlet. */
export function arms(b: PartSet) {
  const q = tier(b);
  // Close up the pauldrons' and lames' gilt rims show every column as a corner in their curve.
  const around = pick(b, 8, 12, 36);
  const stud = pick(b, 5, 5, 12);
  b.mirror((side, sign) => {
    const clav = `clav${side}` as const;
    const ua = `upperArm${side}` as const;
    const fa = `forearm${side}` as const;
    const seat = { at: [sign * 0.145, 0, 0] as V3, rot: [0, 0, sign * -0.62] as V3, scale: [1.07, 1.05, 1.17] as V3 };
    b.add(clav, CAP.mesh({ cols: around, rows: q === 3 ? 2 : 1, thick: 0.008, back: q === 3 }), STEEL, { ...seat, look: 'metal' });
    if (q >= 2) {
      b.add(clav, CAP.mesh({ cols: around, t0: 0, t1: 0.55, lift: 0.0045, thick: 0.0045, back: false }), GOLD, { ...seat, look: 'gold' });
      b.add(clav, rivets(CAP.row(0.4, 1.5, 0.4 + Math.PI * 2 * (1 - 1 / 6), 1.5, 6), 0.0065, stud), GOLD, { ...seat, look: 'gold' });
    }

    const out = (sign * Math.PI) / 2;
    const lame = (loft: Loft, reach: number) => loft.mesh({ from: out - reach, to: out + reach, cols: Math.round(around * 0.7), rows: q === 3 ? 2 : 1, thick: 0.007, back: q === 3 });
    b.add(ua, lame(LAME_A, 2.2), STEEL, { look: 'metal' });
    b.add(ua, lame(LAME_B, 2.05), STEEL, { look: 'metal' });
    if (q >= 2) {
      b.add(ua, rivets([...LAME_A.row(out - 1.75, 0.5, out + 1.75, 0.5, 2), ...LAME_B.row(out - 1.6, 0.5, out + 1.6, 0.5, 2)], 0.006, stud), GOLD, { look: 'gold' });
      b.add(ua, LAME_B.mesh({ from: out - 2.05, to: out + 2.05, cols: Math.round(around * 0.7), t0: 0, t1: 0.3, lift: 0.004, thick: 0.004, back: false }), GOLD, { look: 'gold' });
    }
    b.cyl(ua, 0.066, 0.059, 0.14, STEEL, { at: [0, -0.18, 0], look: 'metal', seg: around, open: true });
    b.cyl(ua, 0.0695, 0.0685, 0.034, '#ffffff', { at: [0, -0.166, 0], look: 'tint', seg: around });

    // Couter: a domed cop with a point behind and a fan on the outside.
    b.add(fa, S.sphere(0.061, pick(b, 8, 12, 20), pick(b, 5, 8, 14)), STEEL, { scale: [1, 1.12, 1.08], look: 'metal' });
    if (q >= 2) {
      b.cyl(fa, 0.004, 0.034, 0.045, STEEL, { at: [0, 0, 0.068], rot: [Math.PI / 2, 0, 0], look: 'metal', seg: around });
      fan(b, fa, sign, 0.05, [0.064, 0, -0.012], around);
      b.add(fa, boss(0.016, sign, q), GOLD, { at: [sign * (b.hero ? 0.0725 : 0.069), 0, -0.012], look: 'gold' });
    }

    // Vambrace and the flared gauntlet cuff; a gun hand's cuff flares less, so a stock laid along the forearm clears its rim.
    const flare = b.hands[side] === 'grip' ? 0.45 : 1;
    const cuff = (r: number) => 0.052 + (r - 0.052) * flare;
    b.cyl(fa, 0.057, 0.049, 0.14, STEEL, { at: [0, -0.115, 0], look: 'metal', seg: around, open: true });
    b.lathe(
      fa,
      [
        [0.05, -0.27],
        [0.052, -0.25],
        [cuff(0.06), -0.208],
        [cuff(0.073), -0.17],
        [cuff(0.076), -0.16],
        [cuff(0.07), -0.157],
        [cuff(0.058), -0.168]
      ],
      STEEL,
      { look: 'metal', seg: around }
    );
    if (q >= 2) {
      b.cyl(fa, cuff(0.0775), cuff(0.0765), 0.009, GOLD, { at: [0, -0.161, 0], look: 'gold', seg: around, open: true });
      b.add(fa, rivets([0, 1, 2].map((i) => [new THREE.Vector3(sign * (0.0555 - i * 0.0025), -0.07 - i * 0.04, 0), new THREE.Vector3(sign, 0, 0)] as Spot), 0.0055, stud), GOLD, { look: 'gold' });
      gauntlet(b, side, sign);
    }
  });
}

/** Plate over the back of the hand with a knuckle bar. */
function gauntlet(b: PartSet, side: 'L' | 'R', sign: number) {
  const hold = HAND_SEAT[b.hands[side]];
  const m = new THREE.Matrix4();
  if (hold) m.compose(new THREE.Vector3(...hold.at), new THREE.Quaternion().setFromEuler(new THREE.Euler(hold.rot[0], hold.rot[1], hold.rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1));
  const flip = new THREE.Matrix4().makeScale(sign, 1, 1);
  const e = new THREE.Euler();
  const seated = (at: V3, rot: V3): { at: V3; rot: V3 } => {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(1, 1, 1));
    const world = flip.clone().multiply(m).multiply(local).multiply(flip);
    e.setFromRotationMatrix(world, 'YXZ');
    return { at: new THREE.Vector3().setFromMatrixPosition(world).toArray() as V3, rot: [e.x, e.y, e.z] };
  };
  const q = tier(b);
  const bone = `hand${side}` as const;
  b.add(bone, S.sphere(0.034, pick(b, 8, 8, 14), pick(b, 5, 5, 9)), STEEL, { at: wristOffset(b.hands[side], side), look: 'metal' });
  b.add(bone, S.blob(0.014, 0.086, 0.074, 0.6, pick(b, 6, 6, 14), 0), STEEL, { ...seated([0.02, 0.001, -0.05], [0, 0, 0]), look: 'metal' });
  b.add(bone, S.blob(0.016, 0.09, 0.024, 0.6, pick(b, 6, 6, 12), 0), STEEL, { ...seated([0.018, 0.001, -0.09], [0, 0, 0]), look: 'metal' });
  const knuckles = [-0.028, -0.009, 0.01, 0.03].map((y) => [new THREE.Vector3(0.026, y, -0.09), new THREE.Vector3(1, 0, 0)] as Spot);
  b.add(bone, rivets(knuckles, 0.0065, q === 3 ? 12 : 5), GOLD, { ...seated([0, 0, 0], [0, 0, 0]), look: 'gold' });
}

/** The round wing outside a joint cop. On the hero it is dished, because a flat face square to the studio rim light bleaches white. */
function fan(b: PartSet, bone: BoneName, sign: number, r: number, [x, y, z]: V3, seg: number) {
  if (b.hero) orb(b, bone, r, 16, STEEL, { at: [sign * (x - 0.006), y, z], scale: [0.3, 1, 1], look: 'metal' });
  else b.cyl(bone, r - 0.005, r, 0.012, STEEL, { at: [sign * x, y, z], rot: ACROSS, look: 'metal', seg });
}

/** A domed boss facing out along x. */
function boss(r: number, sign: number, q: number) {
  return rivets([[new THREE.Vector3(), new THREE.Vector3(sign, 0, 0)]], r, q === 3 ? 12 : 6, 1);
}

/** Hangs clear of the cuisse all the way down: where the two plates meet, their facets cut each other into a saw-toothed edge. */
const TASSET = new Loft([
  { y: -0.235, w: 0.099, f: 0.102, keel: 0.006 },
  { y: -0.13, w: 0.106, f: 0.109, keel: 0.008 },
  { y: -0.025, w: 0.105, f: 0.107, keel: 0.006 }
]);
const CUISSE = new Loft([
  { y: -0.4, w: 0.071, f: 0.075, b: 0.07 },
  { y: -0.31, w: 0.078, f: 0.083, b: 0.076, keel: 0.004 },
  { y: -0.2, w: 0.09, f: 0.094, b: 0.088, keel: 0.004 },
  { y: -0.14, w: 0.094, f: 0.097, b: 0.092 },
  { y: -0.085, w: 0.092, f: 0.095, b: 0.09 },
  { y: -0.03, w: 0.088, f: 0.09, b: 0.09 }
]);
const POLEYN = new Loft([
  { y: -0.068, w: 0.064, f: 0.068 },
  { y: -0.032, w: 0.076, f: 0.084, keel: 0.008 },
  { y: 0, w: 0.08, f: 0.09, keel: 0.014 },
  { y: 0.032, w: 0.08, f: 0.088, keel: 0.008 },
  { y: 0.062, w: 0.078, f: 0.084 },
  { y: 0.074, w: 0.071, f: 0.076 }
]);
const GREAVE = new Loft([
  { y: -0.385, w: 0.054, f: 0.056, b: 0.056 },
  { y: -0.345, w: 0.047, f: 0.05, b: 0.049, keel: 0.003 },
  { y: -0.22, w: 0.06, f: 0.058, b: 0.071, keel: 0.006 },
  { y: -0.09, w: 0.065, f: 0.063, b: 0.068, keel: 0.006 },
  { y: -0.03, w: 0.061, f: 0.061, b: 0.059, keel: 0.003 }
]);

/** A flute down a plate: a low rounded ridge from y0 up to y1 at `a` around, fading out at both ends. */
function flute(plate: Loft, a: number, y0: number, y1: number) {
  const stops = Array.from({ length: 6 }, (_, i) => [a, plate.tAt(y0 + ((y1 - y0) * i) / 5)] as [number, number]);
  const out = plate.normal(a, plate.tAt((y0 + y1) / 2), new THREE.Vector3());
  return sweep(plate.path(stops, 0.0085), (t) => [0.0012 + 0.0052 * Math.sin(t * Math.PI) ** 0.5, 0.0008 + 0.0034 * Math.sin(t * Math.PI) ** 0.5], { seg: 10, radial: 6, up: out.toArray() as V3 });
}

/**
 * The showroom tasset: three lames, each lower one tucked under the one above, every lower edge turned over into a roll,
 * the last one gilt, so the plate steps and catches the light in bands instead of reading as one flat slab.
 */
function tasset(b: PartSet, th: 'thighL' | 'thighR', mid: number, cut: (t: number) => [number, number]) {
  const whole = TASSET.spans;
  const lames: [y0: number, y1: number, lift: number][] = [[-0.235, -0.157, 0], [-0.167, -0.093, 0.0045], [-0.103, -0.025, 0.009]];
  for (const [i, [y0, y1, lift]] of lames.entries()) {
    const [t0, t1] = [TASSET.tAt(y0), TASSET.tAt(y1)];
    const span = (from: number, to: number) => (v: number) => cut((from + (to - from) * v) / whole);
    b.add(th, TASSET.mesh({ t0, t1, cols: 14, rows: 6, lift, thick: 0.007, back: true, cut: span(t0, t1) }), STEEL, { look: 'metal' });
    const roll = TASSET.tAt(y0 + 0.011);
    b.add(th, TASSET.mesh({ t0, t1: roll, cols: 14, rows: 1, lift: lift + 0.0032, thick: 0.0032, back: false, cut: span(t0, roll) }), i === 0 ? GOLD : tone(STEEL, 1.12), { look: i === 0 ? 'gold' : 'metal' });
  }
  b.add(th, rivets([...TASSET.row(mid - 0.75, TASSET.tAt(-0.128), mid + 0.75, TASSET.tAt(-0.128), 2, 0.0045), ...TASSET.row(mid - 0.6, TASSET.tAt(-0.198), mid + 0.6, TASSET.tAt(-0.198), 2)], 0.0055, 12), GOLD, { look: 'gold' });
}

/** What dresses a cuisse: a gilt border above the knee, a lame over the knee cop, flutes down the front and hinge rivets. */
function cuisseTrim(b: PartSet, th: 'thighL' | 'thighR', sign: number, q: number) {
  const cols = pick(b, 4, 6, 10);
  b.add(th, CUISSE.mesh({ from: 0, to: 1.95, t0: CUISSE.tAt(-0.4), t1: CUISSE.tAt(-0.362), cols, lift: 0.0095, thick: 0.006, back: false, mirror: true }), STEEL, { look: 'metal' });
  b.add(th, CUISSE.mesh({ from: 0, to: Math.PI, t0: CUISSE.tAt(-0.362), t1: CUISSE.tAt(-0.345), cols, lift: 0.004, thick: 0.004, back: false, mirror: true }), GOLD, { look: 'gold' });
  if (q < 3) return;
  for (const a of [-0.58, 0.58]) b.add(th, flute(CUISSE, a, -0.335, -0.25), STEEL, { look: 'metal' });
  b.add(th, rivets(CUISSE.row(sign * 1.75, CUISSE.tAt(-0.32), sign * 1.75, CUISSE.tAt(-0.26), 3), 0.0055, 12), GOLD, { look: 'gold' });
  b.add(th, rivets(CUISSE.row(-0.9, CUISSE.tAt(-0.381), 0.9, CUISSE.tAt(-0.381), 3, 0.0155), 0.005, 12), GOLD, { look: 'gold' });
}

/** Tassets and cuisses on the thighs, winged poleyns, ridged greaves. */
export function legs(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 4, 6, 10);
  const rows = q === 3 ? 3 : 1;
  const stud = pick(b, 5, 6, 12);
  b.mirror((side, sign) => {
    const th = `thigh${side}` as const;
    const sh = `shin${side}` as const;
    const mid = sign * 0.5;
    const cut = (t: number): [number, number] => {
      const reach = 1.25 * Math.min(1, 0.22 + t * 1.7);
      return [mid - reach, mid + reach];
    };
    if (q === 3) tasset(b, th, mid, cut);
    else b.add(th, TASSET.mesh({ cols: cols + 2, rows: 2, thick: 0.008, back: false, cut }), STEEL, { look: 'metal' });
    if (q >= 2) b.add(th, rivets(TASSET.row(mid - 0.8, 1.75, mid + 0.8, 1.75, 3, q === 3 ? 0.007 : 0), 0.0065, stud), GOLD, { look: 'gold' });
    b.add(th, CUISSE.mesh({ from: 0, to: Math.PI, cols, rows, thick: 0.008, back: false, mirror: true }), STEEL, { look: 'metal' });
    if (q >= 2) cuisseTrim(b, th, sign, q);

    b.cyl(sh, 0.058, 0.058, 0.132, MAIL, { rot: ACROSS, look: MAIL_LOOK, seg: pick(b, 8, 12, 18) });
    b.add(sh, POLEYN.mesh({ from: 0, to: 2.2, cols, rows: q === 3 ? 2 : 1, thick: 0.01, back: q === 3, mirror: true }), STEEL, { look: 'metal' });
    if (q >= 2) {
      fan(b, sh, sign, 0.046, [0.08, 0, 0.004], pick(b, 8, 12, 18));
      b.add(sh, boss(0.015, sign, q), GOLD, { at: [sign * (b.hero ? 0.088 : 0.085), 0, 0.004], look: 'gold' });
    }
    b.add(sh, GREAVE.mesh({ from: 0, to: Math.PI, cols: cols + 1, rows, thick: 0.012, back: false, mirror: true }), STEEL, { look: 'metal' });
    if (q >= 2) {
      b.add(sh, GREAVE.mesh({ from: 0, to: Math.PI, cols: cols + 1, t0: GREAVE.tAt(-0.062), t1: GREAVE.tAt(-0.044), lift: 0.004, thick: 0.004, back: false, mirror: true }), GOLD, { look: 'gold' });
      if (q === 3) for (const a of [-0.62, 0.62]) b.add(sh, flute(GREAVE, a, -0.3, -0.1), STEEL, { look: 'metal' });
      b.add(sh, GREAVE.mesh({ from: 0, to: Math.PI, cols: cols + 1, t0: 0, t1: 0.5, lift: 0.004, thick: 0.004, back: false, mirror: true }), GOLD, { look: 'gold' });
      b.add(sh, rivets([...GREAVE.row(sign * 1.75, 1.6, sign * 1.75, 3.6, 3)], 0.0055, stud), GOLD, { look: 'gold' });
    }
  });
}

const SABATON = new Loft([
  { y: -0.132, w: 0, f: 0, b: 0 },
  { y: -0.124, w: 0.056, f: 0.04, b: 0.012, e: 0.85, keel: 0.004 },
  { y: -0.07, w: 0.058, f: 0.052, b: 0.012, e: 0.85, keel: 0.006 },
  { y: -0.02, w: 0.056, f: 0.084, b: 0.012, e: 0.85, keel: 0.006 },
  { y: 0.03, w: 0.055, f: 0.094, b: 0.012, e: 0.85 },
  { y: 0.076, w: 0.05, f: 0.074, b: 0.012, e: 0.85 },
  { y: 0.097, w: 0.03, f: 0.046, b: 0.012, e: 0.85 },
  { y: 0.102, w: 0, f: 0, b: 0 }
]);
const TOE = new Loft([
  { y: -0.122, w: 0, f: 0, b: 0 },
  { y: -0.108, w: 0.02, f: 0.015, b: 0.008, e: 0.85, keel: 0.003 },
  { y: -0.072, w: 0.044, f: 0.028, b: 0.012, e: 0.85, keel: 0.006 },
  { y: -0.026, w: 0.056, f: 0.038, b: 0.012, e: 0.85, keel: 0.006 },
  { y: 0.012, w: 0.0575, f: 0.04, b: 0.012, e: 0.85, keel: 0.004 },
  { y: 0.018, w: 0, f: 0, b: 0 }
]);
const TREAD = new Loft([
  { y: -0.134, w: 0, f: 0 },
  { y: -0.128, w: 0.058, f: 0.007, e: 0.5 },
  { y: 0.08, w: 0.053, f: 0.007, e: 0.5 },
  { y: 0.1, w: 0.034, f: 0.007, e: 0.5 },
  { y: 0.104, w: 0, f: 0 }
]);
const TOE_TREAD = new Loft([
  { y: -0.124, w: 0, f: 0 },
  { y: -0.11, w: 0.022, f: 0.007, e: 0.5 },
  { y: -0.072, w: 0.046, f: 0.007, e: 0.5 },
  { y: 0.012, w: 0.0585, f: 0.007, e: 0.5 },
  { y: 0.018, w: 0, f: 0 }
]);

/** Sabatons: a ridged shell over the foot under overlapping lames, a pointed toe, a gold prick spur. */
export function sabatons(b: PartSet) {
  const q = tier(b);
  const cols = pick(b, 4, 6, 10);
  const rows = q === 3 ? 3 : 1;
  b.mirror((side) => {
    const ft = `foot${side}` as const;
    const toe = `toe${side}` as const;
    const foot = { at: [0, -0.063, 0] as V3, rot: LAID };
    const tip = { at: [0, -0.008, 0] as V3, rot: LAID };
    b.add(ft, SABATON.mesh({ from: 0, to: Math.PI, cols, rows, mirror: true }), STEEL, { ...foot, look: 'metal' });
    b.add(toe, TOE.mesh({ from: 0, to: Math.PI, cols, rows, mirror: true }), STEEL, { ...tip, look: 'metal' });
    b.add(ft, TREAD.mesh({ cols: pick(b, 4, 6, 20) }), SHADOW, { at: [0, -0.078, 0], rot: LAID, look: 'rubber' });
    b.add(toe, TOE_TREAD.mesh({ cols: pick(b, 4, 6, 20) }), SHADOW, { at: [0, -0.023, 0], rot: LAID, look: 'rubber' });
    if (q < 2) return;
    (q === 3 ? [-0.118, -0.086, -0.054, -0.022] : [-0.11, -0.066, -0.022]).forEach((y, i) => {
      b.add(ft, SABATON.mesh({ from: 0, to: 1.95, t0: SABATON.tAt(y), t1: SABATON.tAt(y + 0.04), cols, lift: 0.0035 + i * 0.002, thick: 0.005, back: false, mirror: true }), STEEL, { ...foot, look: 'metal' });
    });
    (q === 3 ? [-0.07, -0.03] : [-0.03]).forEach((y, i) => {
      b.add(toe, TOE.mesh({ from: 0, to: 1.95, t0: TOE.tAt(y), t1: TOE.tAt(y + 0.044), cols, lift: 0.003 + i * 0.002, thick: 0.005, back: false, mirror: true }), STEEL, { ...tip, look: 'metal' });
    });
    b.add(ft, SABATON.mesh({ from: 0, to: Math.PI, t0: SABATON.tAt(0.05), t1: SABATON.tAt(0.074), cols, lift: 0.004, thick: 0.004, back: false, mirror: true }), GOLD, { ...foot, look: 'gold' });
    b.cyl(ft, 0.0015, 0.007, 0.05, GOLD, { at: [0, -0.02, 0.122], rot: [Math.PI / 2 + 0.25, 0, 0], look: 'gold', seg: pick(b, 5, 6, 8) });
  });
}

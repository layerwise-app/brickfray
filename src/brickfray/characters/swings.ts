import { MELEES, type MeleeId } from '../weapons/defs';
import type { ActionLegs, HandAction } from './actions';
import { hprQuat, smooth, spline, window4 } from './ik';

/** [time, x, y, z, pitch, heading, roll, elbow pole x, y, z]; the blow lands at 0.4 on this clock. */
type Key = readonly [number, number, number, number, number, number, number, number, number, number];

/** Body and feet of a swing: chest twist and bend in the wind-up and through the blow, and how far the lead foot steps in. */
interface Swing {
  keys: readonly Key[];
  twist: [coil: number, strike: number];
  bend: [coil: number, strike: number];
  /** Lead (left) foot step forward, its turn, the hips' drop and push in the drive, the coil's sink. */
  step: number;
  turn: number;
  drop: number;
  push: number;
  sink: number;
}

const HOME: Key = [0, -0.02, -0.12, -0.38, 0, 0, 0, -0.4, -1, 0.3];
const BACK = (t: number): Key => [t, -0.02, -0.15, -0.38, -0.4, 0.05, 0, -0.4, -1, 0.3];

/**
 * Each tool's own blow, read at a glance from across a lane (all with the off hand; the gun stays in the right):
 * the mallet slams straight down over the left shoulder, the hatchet chops steeply across to the right knee, the
 * sword sweeps a wide diagonal from high left to low right, the knife is drawn back past the hip and lunged straight
 * out at full reach with the left shoulder driven forward, the anchor swings back low and hooks up through the
 * target, tipping over to the right, and the wrench is cocked out to the left at head height and hooked flat across.
 */
const SWINGS: Record<MeleeId, Swing> = {
  mallet: {
    keys: [
      HOME,
      [0.07, -0.29, 0.05, -0.27, 1.5, -0.15, 0, -0.7, -0.6, -0.4],
      [0.12, -0.34, 0.24, -0.06, 2.1, -0.05, 0, -0.9, -0.2, -0.4],
      [0.18, -0.3, 0.38, 0.1, 2.5, 0.04, 0, -0.8, 0, -0.5],
      [0.25, -0.3, 0.4, 0.14, 2.65, 0.04, 0, -0.8, 0, -0.45],
      [0.31, -0.28, 0.3, -0.16, 1.3, 0.02, 0, -0.9, -0.3, -0.3],
      [0.37, -0.18, 0.02, -0.5, -0.45, 0.05, 0, -0.6, -1, 0.2],
      [0.4, -0.13, -0.12, -0.54, -0.8, 0.08, 0, -0.5, -1, 0.3],
      [0.45, -0.11, -0.16, -0.53, -0.9, 0.1, 0, -0.5, -1, 0.3],
      [0.53, -0.04, -0.42, -0.42, -1.35, 0.18, 0, -0.3, -1, 0.4],
      [0.65, -0.02, -0.44, -0.38, -1.4, 0.2, 0, -0.3, -1, 0.4],
      BACK(0.86),
      BACK(1)
    ],
    twist: [-0.45, 0.4],
    bend: [0.16, -0.42],
    step: 0.3,
    turn: 0.15,
    drop: 0.09,
    push: 0.14,
    sink: 0.03
  },
  hatchet: {
    keys: [
      HOME,
      [0.08, -0.25, 0.08, -0.22, 1.4, -0.25, 0, -0.8, -0.4, -0.4],
      [0.19, -0.22, 0.38, 0.1, 2.5, 0.25, 0.35, -0.7, 0.15, -0.6],
      [0.27, -0.22, 0.4, 0.13, 2.65, 0.28, 0.35, -0.7, 0.15, -0.6],
      [0.34, -0.1, 0.18, -0.36, 1.0, 0.35, 0.35, -0.6, -0.4, -0.3],
      [0.4, 0.06, -0.14, -0.52, -0.6, 0.5, 0.4, -0.4, -0.9, 0.2],
      [0.47, 0.2, -0.4, -0.4, -1.3, 0.62, 0.45, -0.2, -1, 0.4],
      [0.62, 0.22, -0.42, -0.36, -1.35, 0.62, 0.45, -0.2, -1, 0.4],
      BACK(0.86),
      BACK(1)
    ],
    twist: [-0.4, 0.6],
    bend: [0.14, -0.4],
    step: 0.26,
    turn: 0.3,
    drop: 0.08,
    push: 0.12,
    sink: 0.03
  },
  sword: {
    keys: [
      HOME,
      [0.1, -0.3, 0.1, -0.22, 1.2, -0.5, 0, -0.8, -0.4, -0.3],
      [0.22, -0.44, 0.33, 0.0, 1.9, -0.95, 0.45, -0.9, 0.1, -0.3],
      [0.29, -0.42, 0.34, 0.02, 1.95, -1.0, 0.45, -0.9, 0.1, -0.3],
      [0.35, -0.24, 0.14, -0.42, 0.7, -0.25, 0.9, -0.7, -0.4, -0.2],
      [0.4, 0.02, -0.08, -0.56, -0.2, 0.55, 1.15, -0.4, -0.8, 0.2],
      [0.49, 0.28, -0.34, -0.36, -0.7, 1.25, 1.25, -0.2, -1, 0.3],
      [0.64, 0.3, -0.37, -0.3, -0.8, 1.3, 1.25, -0.2, -1, 0.3],
      BACK(0.86),
      BACK(1)
    ],
    twist: [-0.65, 0.8],
    bend: [0.05, -0.28],
    step: 0.34,
    turn: 0.35,
    drop: 0.08,
    push: 0.12,
    sink: 0.02
  },
  knife: {
    keys: [
      HOME,
      [0.12, -0.24, -0.24, -0.12, 0.12, 0.08, 0, -0.6, -0.6, 0.6],
      [0.25, -0.24, -0.2, 0.12, 0.2, 0.12, 0, -0.7, -0.3, 0.9],
      [0.31, -0.23, -0.19, 0.13, 0.2, 0.12, 0, -0.7, -0.3, 0.9],
      [0.36, -0.12, -0.08, -0.42, 0.08, 0.1, 0, -0.5, -0.7, 0.4],
      [0.4, -0.04, -0.02, -0.72, 0.04, 0.06, 0, -0.4, -0.9, 0.2],
      [0.55, -0.04, -0.03, -0.72, 0.04, 0.06, 0, -0.4, -0.9, 0.2],
      [0.68, -0.14, -0.18, -0.32, 0.08, 0.06, 0, -0.5, -0.9, 0.3],
      BACK(0.86),
      BACK(1)
    ],
    twist: [-0.6, 0.8],
    bend: [0.04, -0.3],
    step: 0.48,
    turn: 0.05,
    drop: 0.12,
    push: 0.28,
    sink: 0.04
  },
  anchor: {
    keys: [
      HOME,
      [0.1, -0.3, -0.3, -0.12, -1.2, -0.4, 0, -0.8, -0.6, 0.1],
      [0.22, -0.4, -0.33, 0.24, -2.2, -0.5, 0, -0.9, -0.3, 0.3],
      [0.28, -0.4, -0.31, 0.27, -2.3, -0.5, 0, -0.9, -0.3, 0.3],
      [0.35, -0.25, -0.22, -0.3, -0.6, -0.1, 0, -0.7, -0.7, -0.1],
      [0.4, -0.05, 0.04, -0.56, 0.5, 0.2, 0, -0.5, -0.7, 0.2],
      [0.48, 0.12, 0.3, -0.4, 1.3, 0.6, 0.3, -0.3, -0.5, 0.3],
      [0.58, 0.24, 0.18, -0.3, 0.6, 1.2, 0.6, -0.3, -0.6, 0.3],
      [0.7, 0.2, -0.22, -0.3, -0.6, 0.9, 0.3, -0.3, -0.9, 0.3],
      BACK(0.88),
      BACK(1)
    ],
    twist: [-0.6, 0.65],
    bend: [-0.28, 0.18],
    step: 0.3,
    turn: 0.2,
    drop: 0.11,
    push: 0.1,
    sink: 0.06
  },
  wrench: {
    keys: [
      HOME,
      [0.1, -0.3, 0.05, -0.2, 0.4, -0.6, 1.4, -0.8, -0.3, -0.2],
      [0.24, -0.48, 0.1, 0.0, 0.2, -1.4, 1.5, -1, -0.1, 0.1],
      [0.3, -0.48, 0.1, 0.02, 0.2, -1.45, 1.5, -1, -0.1, 0.1],
      [0.36, -0.3, 0.1, -0.42, 0.1, -0.5, 1.5, -0.8, -0.3, -0.2],
      [0.4, -0.02, 0.08, -0.58, 0.05, 0.2, 1.5, -0.5, -0.4, 0.1],
      [0.48, 0.25, 0.04, -0.4, 0.0, 1.0, 1.5, -0.3, -0.6, 0.3],
      [0.6, 0.28, -0.2, -0.32, -0.6, 1.1, 1.2, -0.3, -0.8, 0.3],
      BACK(0.86),
      BACK(1)
    ],
    twist: [-0.75, 0.7],
    bend: [0.02, -0.12],
    step: 0.22,
    turn: 0.25,
    drop: 0.06,
    push: 0.08,
    sink: 0.02
  }
};

/** Where the blow lands on the swing's own clock: its shown contact (the sim's hit check, or a little after it when that is too soon to read) over the swing's length. */
function contactShare(tool: MeleeId) {
  const m = MELEES[tool];
  return Math.max(m.windup, Math.min(m.windup + 0.055, 0.17)) / (m.cooldown * 0.62);
}
const CONTACT = Object.fromEntries((Object.keys(SWINGS) as MeleeId[]).map((id) => [id, contactShare(id)])) as Record<MeleeId, number>;

/** The swing's clock from its progress 0…1, so every tool's blow lands at 0.4 on its keys. */
function clock(tool: MeleeId, m: number) {
  const c = CONTACT[tool];
  const t = Math.min(1, Math.max(0, m));
  return t < c ? (0.4 * t) / c : 0.4 + (0.6 * (t - c)) / (1 - c);
}

const k9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export function meleeAction(tool: MeleeId, progress: number, out: HandAction) {
  const sw = SWINGS[tool];
  const m = clock(tool, progress);
  spline(m, sw.keys, k9);
  out.pos.set(k9[0]!, k9[1]!, k9[2]!);
  hprQuat(k9[4]!, k9[3]!, k9[5]!, out.q);
  out.pole.set(k9[6]!, k9[7]!, k9[8]!);
  out.weight = window4(m, 0, 0.07, 0.72, 0.92);
  out.lower = window4(m, 0, 0.08, 0.75, 0.95);
  out.twist = sw.twist[0] * window4(m, 0.03, 0.2, 0.28, 0.36) + sw.twist[1] * window4(m, 0.3, 0.42, 0.62, 0.88);
  out.bend = sw.bend[0] * window4(m, 0.05, 0.2, 0.28, 0.34) + sw.bend[1] * window4(m, 0.32, 0.42, 0.64, 0.88);
  out.mallet = window4(m, 0.0, 0.05, 0.82, 0.9);
  out.grenade = 0;
}

const stepArc = (t: number, a: number, b: number, c: number, d: number) => (t < (b + c) / 2 ? Math.sin(Math.PI * smooth(t, a, b)) : Math.sin(Math.PI * smooth(t, c, d)));

/** A swing coils back onto the right foot, then steps in with the left as the blow comes and drives through it. */
export function meleeLegs(tool: MeleeId, progress: number, out: ActionLegs) {
  const sw = SWINGS[tool];
  const m = clock(tool, progress);
  const coil = window4(m, 0.02, 0.2, 0.27, 0.35);
  const step = window4(m, 0.22, 0.38, 0.7, 0.95);
  const drive = window4(m, 0.3, 0.42, 0.6, 0.9);
  out.reach[0] = sw.step * step;
  out.reach[1] = -0.03 * drive;
  out.side[0] = 0.02 * step;
  out.turn[0] = sw.turn * step;
  out.lift[0] = 0.07 * stepArc(m, 0.22, 0.38, 0.7, 0.95);
  out.heel[0] = 0.45 * coil;
  out.heel[1] = 0.55 * drive;
  out.hip[0] = 0.055 * coil - 0.035 * drive;
  out.hip[1] = -sw.sink * coil - sw.drop * drive;
  out.hip[2] = 0.07 * coil - sw.push * drive;
  out.hip[3] = -0.4 * coil + 0.3 * drive;
  out.hip[4] = 0.05 * coil - 0.14 * drive;
  return out;
}

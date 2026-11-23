import * as THREE from 'three';
import type { MeleeId, WeaponId } from '../weapons/defs';
import { hprQuat, keyed, smooth, spline, window4 } from './ik';
import { meleeLegs } from './swings';

/** Where the left hand goes during an action, in model space about the shoulder center (x right, y up, z back). */
export interface HandAction {
  /** 0 = on the support grip, 1 = fully on this action's path. */
  weight: number;
  pos: THREE.Vector3;
  /** The hand's turn: its -Z runs along the held tool or the throw. */
  q: THREE.Quaternion;
  /** Model-space direction the elbow bends toward. */
  pole: THREE.Vector3;
  /** Lower the gun to one-handed carry. */
  lower: number;
  /** Extra chest heading (positive turns right, bringing the left shoulder forward) and pitch (positive leans back). */
  twist: number;
  bend: number;
  mallet: number;
  grenade: number;
}

export function emptyAction(): HandAction {
  return { weight: 0, pos: new THREE.Vector3(), q: new THREE.Quaternion(), pole: new THREE.Vector3(-0.4, -1, 0.3), lower: 0, twist: 0, bend: 0, mallet: 0, grenade: 0 };
}

/** [time, x, y, z, pitch, heading, roll, elbow pole x, y, z] */
type ActionKey = readonly [number, number, number, number, number, number, number, number, number, number];
const k9 = [0, 0, 0, 0, 0, 0, 0, 0, 0];

/**
 * Overarm off-hand throw. The grenade is brought out low on the left and cocked back behind the shoulder, the elbow
 * low and out and the chest coiled well away, so a held cook reads as a throw about to happen (cooking holds at 0.25). The bomb leaves the hand when the cook ends (0.25, when the match
 * spawns it): the elbow leads forward over the shoulder, the arm whips long toward the target with the wrist snapped
 * down, then follows through down across the body to the right hip while the thrower drives onto the lead foot.
 */
const THROW: readonly ActionKey[] = [
  [0.0, -0.03, -0.1, -0.36, 0, 0, 0, -0.4, -1, 0.3],
  [0.1, -0.38, -0.04, -0.06, 1.4, 0.2, 3.14, -1, -0.6, 0.2],
  [0.2, -0.3, 0.07, 0.44, 1.95, 0.5, 3.14, -0.8, -0.4, 0.4],
  [0.25, -0.31, 0.08, 0.46, 2.0, 0.5, 3.14, -0.8, -0.4, 0.4],
  [0.3, -0.46, 0.38, 0.04, 1.75, 0.12, 3.14, -0.9, -0.3, -0.2],
  [0.36, -0.38, 0.36, -0.3, 0.9, 0, 3.14, -0.8, -0.6, 0],
  [0.42, -0.32, 0.18, -0.5, 0.4, -0.05, 3.14, -0.7, -0.8, 0.2],
  [0.5, -0.2, -0.04, -0.56, -0.2, 0.05, 3.14, -0.5, -0.9, 0.3],
  [0.6, -0.04, -0.2, -0.52, -0.7, 0.3, 3.14, -0.3, -1, 0.4],
  [0.72, 0.06, -0.36, -0.42, -1.1, 0.45, 3.14, -0.3, -1, 0.4],
  [1, 0.05, -0.38, -0.4, -1.2, 0.45, 3.14, -0.3, -1, 0.4]
];

function path(keys: readonly ActionKey[], t: number, out: HandAction) {
  spline(t, keys, k9);
  out.pos.set(k9[0]!, k9[1]!, k9[2]!);
  hprQuat(k9[4]!, k9[3]!, k9[5]!, out.q);
  out.pole.set(k9[6]!, k9[7]!, k9[8]!);
}

export function throwAction(g: number, out: HandAction) {
  path(THROW, g, out);
  out.weight = window4(g, 0, 0.1, 0.82, 0.97);
  out.lower = window4(g, 0, 0.1, 0.86, 0.99);
  out.twist = -0.95 * window4(g, 0.02, 0.2, 0.26, 0.34) + 0.45 * window4(g, 0.27, 0.4, 0.8, 0.97);
  out.bend = 0.16 * window4(g, 0.05, 0.2, 0.26, 0.32) - 0.36 * window4(g, 0.28, 0.44, 0.8, 0.97);
  out.mallet = 0;
  out.grenade = g < 0.29 ? smooth(g, 0.04, 0.12) : 0;
}

/** Footwork of a throw or a swing for a figure standing still. */
export interface ActionLegs {
  /** Per foot [left, right]: step forward (m), sideways (m, + right), toe turn (+ right), lift (m), heel raise (rad). */
  reach: number[];
  side: number[];
  turn: number[];
  lift: number[];
  heel: number[];
  /** Hips: shift x right, y up, z back (m), then heading (+ right) and pitch (+ back). */
  hip: number[];
}

export function emptyLegs(): ActionLegs {
  return { reach: [0, 0], side: [0, 0], turn: [0, 0], lift: [0, 0], heel: [0, 0], hip: [0, 0, 0, 0, 0] };
}

const stepArc = (t: number, a: number, b: number, c: number, d: number) => (t < (b + c) / 2 ? Math.sin(Math.PI * smooth(t, a, b)) : Math.sin(Math.PI * smooth(t, c, d)));

/**
 * The thrower steps out toward the target with the right foot during the wind-up and holds the weight back while
 * cooking, then drives onto the lead foot after the release (hips drop and push forward, rear heel up). A swing's
 * footwork is its tool's own (`meleeLegs`).
 */
export function actionLegs(grenade: number, melee: number, tool: MeleeId, out: ActionLegs) {
  out.reach.fill(0);
  out.side.fill(0);
  out.turn.fill(0);
  out.lift.fill(0);
  out.heel.fill(0);
  out.hip.fill(0);
  if (grenade >= 0) {
    const g = grenade;
    const stride = window4(g, 0.03, 0.2, 0.84, 0.99);
    const coil = window4(g, 0.06, 0.22, 0.26, 0.36);
    const lunge = window4(g, 0.27, 0.42, 0.8, 0.98);
    out.reach[0] = -0.03 * lunge;
    out.reach[1] = 0.36 * stride;
    out.side[1] = -0.03 * stride;
    out.turn[1] = -0.3 * stride;
    out.lift[1] = 0.07 * stepArc(g, 0.03, 0.2, 0.84, 0.99);
    out.heel[0] = 0.6 * lunge;
    out.hip[0] = 0.03 * lunge - 0.02 * coil;
    out.hip[1] = -0.06 * lunge - 0.025 * stride;
    out.hip[2] = -0.12 * lunge - 0.06 * stride + 0.05 * coil;
    out.hip[3] = -0.28 * coil + 0.22 * lunge;
    out.hip[4] = -0.12 * lunge + 0.04 * coil;
  } else if (melee >= 0) meleeLegs(tool, melee, out);
  return out;
}

export type ReloadFamily = 'rifle' | 'pistol' | 'buzzer' | 'pump' | 'revolver' | 'harpoon';

export const RELOAD_FAMILY: Record<WeaponId, ReloadFamily> = {
  ar: 'rifle',
  nailer: 'rifle',
  pulse: 'rifle',
  sniper: 'rifle',
  pistol: 'pistol',
  buzzer: 'buzzer',
  shotgun: 'pump',
  cannon: 'revolver',
  harpoon: 'harpoon'
};

/** Places the left hand visits while reloading. */
export const AT = { support: 0, magazine: 1, pouch: 2, port: 3, cylinder: 4, quiver: 5, muzzle: 6, handle: 7 } as const;

export type Carried = 'none' | 'shell' | 'rounds' | 'bolt';
export type MagazineState = 'seated' | 'hand' | 'away';

export interface ReloadFrame {
  weight: number;
  /** Hand position as a blend of two `AT` places. */
  a: number;
  b: number;
  mix: number;
  /** Hand offset in the gun's axes: below the gun, and back along the barrel. */
  drop: number;
  slide: number;
  /** Added to the gun's carry pose: position, then [heading, pitch, roll]. */
  gun: number[];
  /** Whole-body beats: chest twist (positive turns right) and hunch, head turn and duck, hips sink and shift right. */
  body: number[];
  carried: Carried;
  magazine: MagazineState;
}

export function emptyReload(): ReloadFrame {
  return { weight: 0, a: 0, b: 0, mix: 0, drop: 0, slide: 0, gun: [0, 0, 0, 0, 0, 0], body: [0, 0, 0, 0, 0, 0], carried: 'none', magazine: 'seated' };
}

type HandKey = readonly [time: number, at: number, drop: number, slide: number];
type GunKey = readonly [time: number, x: number, y: number, z: number, heading: number, pitch: number, roll: number];
type BodyKey = readonly [time: number, twist: number, hunch: number, look: number, duck: number, sink: number, shift: number];

interface ReloadMotion {
  hand: readonly HandKey[];
  gun: readonly GunKey[];
  body: readonly BodyKey[];
  /** One reload repeats the motion (a shell at a time), so it has no lead-in or lead-out of its own. */
  loops?: boolean;
  carried?: { item: Carried; from: number; to: number };
  /** The magazine leaves the gun in the hand, is swapped at the pouch and comes back. */
  magazine?: { out: number; stow: number; draw: number; seat: number };
}

const { support, magazine, pouch, port, cylinder, quiver, muzzle, handle } = AT;
const PORT_UP: GunKey = [0, -0.08, -0.1, 0.1, 0.35, 0.4, -1.15];
const MUZZLE_UP: GunKey = [0.14, -0.07, 0.08, 0.12, 0.3, 1.15, -0.25];
const CYLINDER_OUT: GunKey = [0.36, -0.08, -0.07, 0.13, 0.4, -0.2, -0.8];
const SPEAR_UP: GunKey = [0.2, -0.16, -0.12, 0.16, 0.55, 1.0, -0.15];
const at = (key: GunKey, time: number): GunKey => [time, key[1], key[2], key[3], key[4], key[5], key[6]];
const REST: GunKey = [0, 0, 0, 0, 0, 0, 0];
const STILL: BodyKey = [0, 0, 0, 0, 0, 0, 0];
const still = (time: number): BodyKey => [time, 0, 0, 0, 0, 0, 0];

/**
 * Each reload is a run of beats that read across a room: the gun comes down off the shoulder and in to the chest,
 * rolled to the off hand, jerks as the magazine strips, sags one-handed to the belly while the hand goes out to the
 * belt pouch for a fresh one (chest and eyes turned after it, knees giving), rolls back to take it, jolts as it is
 * seated and slapped from below, then rolls the other way for a long pull on the charging handle.
 */
const MOTION: Record<ReloadFamily, ReloadMotion> = {
  rifle: {
    hand: [[0, support, 0, 0], [0.13, magazine, 0, 0], [0.2, magazine, -0.1, 0.03], [0.28, magazine, -0.22, 0.05], [0.42, pouch, 0, 0], [0.5, pouch, 0, 0], [0.6, magazine, -0.2, 0.04], [0.7, magazine, -0.01, 0], [0.74, magazine, 0, 0], [0.765, magazine, -0.07, 0], [0.785, magazine, 0.03, 0], [0.84, handle, 0.02, -0.02], [0.9, handle, 0.02, 0.14], [0.96, support, 0, 0], [1, support, 0, 0]],
    gun: [REST, [0.12, -0.07, -0.1, 0.1, -0.35, 0.3, -0.95], [0.2, -0.06, -0.06, 0.09, -0.4, 0.4, -1.1], [0.36, 0.02, -0.2, 0.08, -0.4, -0.08, -0.45], [0.5, 0.0, -0.18, 0.09, -0.36, -0.04, -0.55], [0.64, -0.07, -0.1, 0.1, -0.35, 0.3, -1.0], [0.73, -0.07, -0.06, 0.09, -0.3, 0.35, -1.05], [0.78, -0.06, -0.11, 0.1, -0.35, 0.28, -0.8], [0.88, -0.03, -0.06, 0.08, -0.45, 0.12, 0.4], at(REST, 0.98)],
    body: [STILL, [0.12, 0.1, 0.14, 0.06, 0.16, 0.03, 0.015], [0.22, 0.05, 0.2, 0.02, 0.24, 0.045, 0.02], [0.4, -0.42, 0.18, -0.5, 0.32, 0.07, -0.045], [0.5, -0.4, 0.16, -0.46, 0.3, 0.07, -0.045], [0.66, 0.08, 0.24, 0.06, 0.28, 0.06, 0.03], [0.76, 0.05, 0.1, 0.02, 0.14, 0.04, 0.02], [0.88, 0.2, 0.1, 0.16, 0.12, 0.035, 0.035], still(1)],
    magazine: { out: 0.16, stow: 0.42, draw: 0.5, seat: 0.74 }
  },
  /** The pistol comes in to the chest, the magazine drops into the hand, a fresh one comes from the belt and is pushed in, the slide racked. */
  pistol: {
    hand: [[0, support, 0, 0], [0.12, magazine, 0, 0], [0.24, magazine, -0.2, 0], [0.4, pouch, 0, 0], [0.5, pouch, 0, 0], [0.62, magazine, -0.18, 0], [0.71, magazine, 0, 0], [0.745, magazine, -0.05, 0], [0.765, magazine, 0.02, 0], [0.82, handle, -0.01, -0.03], [0.89, handle, -0.01, 0.11], [0.95, support, 0, 0], [1, support, 0, 0]],
    gun: [REST, [0.12, -0.1, -0.02, 0.16, 0.35, 0.6, -0.7], [0.2, -0.09, 0.02, 0.15, 0.3, 0.8, -0.8], [0.36, -0.03, -0.12, 0.18, 0.2, 0.3, -0.4], [0.52, -0.05, -0.1, 0.17, 0.26, 0.4, -0.5], [0.64, -0.1, -0.03, 0.16, 0.38, 0.62, -0.75], [0.72, -0.1, 0.0, 0.15, 0.4, 0.7, -0.78], [0.8, -0.07, -0.02, 0.12, 0.18, 0.4, -0.15], [0.88, -0.06, 0.01, 0.1, 0.1, 0.3, 0.05], at(REST, 0.97)],
    body: [STILL, [0.12, 0.07, 0.12, 0.05, 0.16, 0.025, 0.012], [0.22, 0.04, 0.16, 0.02, 0.22, 0.04, 0.018], [0.4, -0.38, 0.16, -0.46, 0.3, 0.06, -0.04], [0.5, -0.36, 0.14, -0.42, 0.28, 0.06, -0.04], [0.64, 0.06, 0.2, 0.05, 0.26, 0.05, 0.025], [0.74, 0.03, 0.08, 0.02, 0.14, 0.035, 0.018], [0.86, 0.15, 0.08, 0.12, 0.1, 0.03, 0.025], still(1)],
    magazine: { out: 0.15, stow: 0.38, draw: 0.48, seat: 0.71 }
  },
  /**
   * The machine pistol is laid flat on its side out in front of the belly, its long magazine pulled out sideways and
   * swapped at the belt, the fresh one driven home with a heel slap that knocks the gun; then it is snapped up muzzle
   * high as the slide drops.
   */
  buzzer: {
    hand: [[0, support, 0, 0], [0.1, magazine, 0, 0], [0.2, magazine, -0.26, 0.04], [0.38, pouch, 0, 0], [0.48, pouch, 0, 0], [0.6, magazine, -0.24, 0.04], [0.68, magazine, -0.02, 0], [0.7, magazine, -0.11, 0], [0.735, magazine, 0.03, 0], [0.8, magazine, -0.05, 0], [0.86, support, 0, 0], [1, support, 0, 0]],
    gun: [REST, [0.1, -0.06, -0.1, 0.2, 0.55, 0.05, -1.4], [0.2, -0.05, -0.12, 0.21, 0.6, 0.0, -1.5], [0.38, 0.0, -0.2, 0.14, 0.4, -0.15, -0.95], [0.5, -0.02, -0.18, 0.15, 0.42, -0.1, -1.05], [0.62, -0.06, -0.1, 0.2, 0.55, 0.05, -1.4], [0.72, -0.06, -0.1, 0.2, 0.55, 0.05, -1.4], [0.75, -0.02, -0.08, 0.2, 0.5, 0.12, -1.1], [0.84, -0.03, 0.06, 0.12, 0.2, 0.75, -0.15], [0.9, -0.03, 0.04, 0.1, 0.15, 0.6, -0.05], at(REST, 0.98)],
    body: [STILL, [0.1, 0.18, 0.1, 0.16, 0.12, 0.03, 0.02], [0.22, 0.22, 0.14, 0.2, 0.2, 0.04, 0.025], [0.4, -0.34, 0.14, -0.42, 0.26, 0.06, -0.04], [0.5, -0.32, 0.12, -0.4, 0.24, 0.06, -0.04], [0.64, 0.2, 0.16, 0.16, 0.22, 0.045, 0.025], [0.74, 0.26, 0.04, 0.2, 0.08, 0.03, 0.03], [0.85, 0.06, -0.06, 0.04, -0.06, 0.015, 0.005], still(1)],
    magazine: { out: 0.13, stow: 0.38, draw: 0.48, seat: 0.72 }
  },
  /** Loading port turned up; each cycle carries one shell from the belt and thumbs it into the tube, the gun bumping as it goes in. */
  pump: {
    hand: [[0, pouch, 0, 0], [0.12, pouch, 0, 0], [0.4, port, -0.1, 0.05], [0.5, port, -0.035, 0.03], [0.6, port, -0.01, -0.05], [0.72, port, -0.05, 0], [1, pouch, 0, 0]],
    gun: [PORT_UP, [0.12, -0.07, -0.14, 0.11, 0.3, 0.32, -1.0], [0.42, -0.08, -0.08, 0.1, 0.36, 0.42, -1.2], [0.56, -0.09, -0.05, 0.08, 0.38, 0.5, -1.25], [0.66, -0.08, -0.1, 0.1, 0.35, 0.4, -1.12], at(PORT_UP, 1)],
    body: [[0, -0.26, 0.12, -0.3, 0.2, 0.05, -0.025], [0.12, -0.34, 0.12, -0.4, 0.26, 0.06, -0.035], [0.42, 0.05, 0.18, 0.05, 0.26, 0.055, 0.015], [0.58, 0.07, 0.22, 0.06, 0.28, 0.06, 0.02], [0.72, 0.0, 0.16, 0.0, 0.24, 0.055, 0.0], [1, -0.26, 0.12, -0.3, 0.2, 0.05, -0.025]],
    loops: true,
    carried: { item: 'shell', from: 0.08, to: 0.6 }
  },
  /** Muzzle up and shaken to drop the empties, cylinder swung out, a ring of rounds pressed in, flicked shut. */
  revolver: {
    hand: [[0, support, 0, 0], [0.12, cylinder, 0, 0], [0.26, cylinder, -0.05, 0.03], [0.4, pouch, 0, 0], [0.48, pouch, 0, 0], [0.62, cylinder, 0, 0.07], [0.72, cylinder, 0, 0.005], [0.8, cylinder, -0.02, 0.02], [0.92, support, 0, 0], [1, support, 0, 0]],
    gun: [REST, MUZZLE_UP, [0.18, -0.07, 0.12, 0.1, 0.3, 1.28, -0.25], [0.22, -0.07, 0.06, 0.12, 0.3, 1.08, -0.25], [0.26, -0.07, 0.1, 0.11, 0.3, 1.2, -0.25], CYLINDER_OUT, [0.5, -0.05, -0.05, 0.13, 0.3, -0.3, -0.7], [0.68, -0.08, 0.0, 0.11, 0.4, -0.18, -0.85], at(CYLINDER_OUT, 0.76), [0.85, -0.02, 0.03, 0.04, 0.05, 0.2, 0.4], at(REST, 0.96)],
    body: [STILL, [0.16, 0.02, -0.04, 0.0, -0.05, 0.02, 0.01], [0.3, 0.02, 0.12, 0.02, 0.18, 0.04, 0.0], [0.44, -0.38, 0.16, -0.46, 0.3, 0.065, -0.04], [0.66, 0.05, 0.22, 0.04, 0.28, 0.06, 0.02], [0.85, 0.14, 0.05, 0.12, 0.06, 0.03, 0.02], still(1)],
    carried: { item: 'rounds', from: 0.44, to: 0.7 }
  },
  /** Butt to the hip and muzzle up, a spear drawn from behind the shoulder, slid down the barrel until it locks. */
  harpoon: {
    hand: [[0, support, 0, 0], [0.16, quiver, 0, 0], [0.26, quiver, 0, 0], [0.5, muzzle, 0, -0.14], [0.72, muzzle, 0, 0.1], [0.9, support, 0, 0], [1, support, 0, 0]],
    gun: [REST, SPEAR_UP, [0.5, -0.17, -0.14, 0.17, 0.55, 0.95, -0.2], [0.7, -0.15, -0.18, 0.16, 0.55, 1.02, -0.12], [0.75, -0.15, -0.1, 0.15, 0.5, 0.92, -0.1], at(REST, 0.96)],
    body: [STILL, [0.2, 0.22, -0.06, 0.32, -0.2, 0.02, 0.02], [0.3, 0.18, -0.04, 0.24, -0.14, 0.03, 0.02], [0.52, 0.02, 0.06, 0.04, 0.0, 0.05, 0.0], [0.72, 0.02, 0.14, 0.04, 0.12, 0.06, 0.01], [0.8, 0.02, 0.06, 0.02, 0.06, 0.035, 0.0], still(1)],
    carried: { item: 'bolt', from: 0.24, to: 0.7 }
  }
};

export function reloadAt(family: ReloadFamily, r: number, out: ReloadFrame) {
  const m = MOTION[family];
  out.weight = m.loops ? 1 : window4(r, 0, 0.1, 0.9, 0.99);
  let i = 0;
  while (i < m.hand.length - 2 && r > m.hand[i + 1]![0]) i++;
  const k0 = m.hand[i]!;
  const k1 = m.hand[i + 1]!;
  out.a = k0[1];
  out.b = k1[1];
  out.mix = smooth(r, k0[0], k1[0]);
  out.drop = k0[2] + (k1[2] - k0[2]) * out.mix;
  out.slide = k0[3] + (k1[3] - k0[3]) * out.mix;
  keyed(r, m.gun, out.gun);
  reloadBody(family, r, out.body);
  out.carried = m.carried && r >= m.carried.from && r < m.carried.to ? m.carried.item : 'none';
  const mag = m.magazine;
  out.magazine = !mag || r < mag.out || r >= mag.seat ? 'seated' : r >= mag.stow && r < mag.draw ? 'away' : 'hand';
  return out;
}

/** The reload's whole-body beats at progress `r` (see `ReloadFrame.body`). */
export function reloadBody(family: ReloadFamily, r: number, out: number[]) {
  return keyed(r, MOTION[family].body, out);
}

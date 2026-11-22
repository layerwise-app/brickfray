import type { WeaponId } from '../defs';
import { FINGERS, type FingerPose } from './fingers';
import type { ArmFit } from './arms';
import type { V3 } from './goals';

/** Per-weapon first-person placement and feel. Positions are in view-camera space (meters). */
export interface Tuning {
  /** Grip (model origin) at rest, hip fire. */
  hip: V3;
  hipRot: V3;
  /** Eye distance behind the `sight` node when fully aimed. */
  eye: number;
  sprint: V3;
  sprintRot: V3;
  /** Recoil impulses: back (m/s), rise (rad/s), random roll and yaw (rad/s), sideways jitter (m/s); `adsBack` and `adsRise` are the shares of `back` and of the turns kept at full aim (0.75 and 0.45 when omitted); `adsEye` is the share of an aimed kick that turns the gun about the eye, taking the sight off the target (0 when omitted). */
  recoil: { back: number; rise: number; roll: number; yaw: number; side: number; up: number; adsBack?: number; adsRise?: number; adsEye?: number };
  /** The sight picture is a rear and a front sight that must stay lined up when aimed (an optic only needs its reticle on the target). */
  irons?: boolean;
  /** Recoil spring stiffness and damping ratio. */
  spring: [number, number];
  /** Right hand: palm-frame position relative to the `grip` node, and the way the back of the hand faces (straight out to the right when omitted). */
  right: V3;
  rightBack?: V3;
  /** Left hand on the support node: position, back-of-hand direction, grip axis. */
  left: { pos: V3; back: V3; axis: V3 };
  /** Where the left hand takes the magazine, from its hold node; a short magazine is held low so it shows above the fist. */
  mag?: V3;
  /** Finger shapes of the resting grip: firing hand and support hand. */
  fingers: { right: FingerPose; left: FingerPose };
  /** How far down the holster drop this gun is already out of frame (1 when omitted); a small gun need not travel the whole way. */
  stow?: number;
  /** Overall sway/bob multiplier (heavier guns move more and slower). */
  weight: number;
  /** This gun's fit of the arms (elbow hints and shoulders), when its grips need one. */
  arms?: ArmFit;
}

/**
 * Support-hand shapes, one per kind of fore-end. Long guns sit in the palm from below (`left.back` points down, the
 * wrist low on the near side where the forearm comes in): the thumb lies up the near face, the fingers wrap up the far one.
 */
const GRIP = {
  /** Square handguard: fingers up the far face to its top edge, thumb against the near face, its tip curled in. */
  handguard: { ...FINGERS.support, thumb: 0.65, hook: 0.35, oppose: 0.75, index: 0.7, middle: 0.74, ring: 0.74, pinky: 0.7 },
  /** Pump: a firm hold round the forend from below, fingertips at the far top edge, thumb up the near side. */
  pump: { ...FINGERS.support, thumb: 0.65, hook: 0.35, oppose: 0.75, index: 0.74, middle: 0.78, ring: 0.78, pinky: 0.74 },
  /** Rifle fore-end resting in an open palm: loose fingers, thumb against the near side. */
  foreEnd: { ...FINGERS.support, thumb: 0.6, hook: 0.3, oppose: 0.7, index: 0.62, middle: 0.68, ring: 0.7, pinky: 0.68, spread: 0.2 },
  /** Fat drum cupped from below: fingers fanned up its side. */
  drum: { ...FINGERS.support, thumb: 0.6, hook: -0.22, index: 0.5, middle: 0.54, ring: 0.54, pinky: 0.5, spread: 0.35 },
  /** Vertical hand stop: a fist around it, thumb wrapped across the back. */
  stop: { ...FINGERS.handle, thumb: 0.55, index: 0.66 },
  /** Round launcher tube with a grip rail under it. */
  tube: { ...FINGERS.support, thumb: 0.62, hook: 0.3, oppose: 0.75, index: 0.6, middle: 0.68, ring: 0.7, pinky: 0.7, spread: 0.12 }
} satisfies Record<string, FingerPose>;

/** The support hand on a handgun: palm heel filling the side of the grip the firing hand leaves bare, fingers wrapped over the firing fingers, thumb forward under the slide. */
const SIDEARM_SUPPORT: Tuning['left'] = { pos: [-0.006, -0.03, -0.004], back: [-0.98, 0.1, 0.12], axis: [0.06, 0.94, 0.3] };

/** Both arms on a handgun: shoulders drawn in and down so the forearms run up to the grip in line with the wrists (extension under 45 degrees), not up from the side. */
const SIDEARM_ARMS: ArmFit = { right: { shoulder: [-0.12, -0.12, 0.06] }, left: { shoulder: [-0.04, -0.12, 0.1] } };
/** A support hand round an upright grip: the elbow out to the side, so the forearm comes in level instead of up from under the fist. */
const UPRIGHT_ELBOW: V3 = [-0.8, 0.8, 0];

/** A handgun held high: the hand turned round the grip so the palm heel and the web of the thumb cover the backstrap. */
const HIGH_GRIP: V3 = [0.85, 0, 0.53];

/** Firing hand on a gun whose trigger sits close behind the grip: the index curls tighter so its pad lands on the blade instead of running past it. */
const NEAR_TRIGGER: FingerPose = { ...FINGERS.trigger, index: 0.46 };

const BASE = {
  ar: {
    hip: [0.19, -0.215, -0.37],
    hipRot: [0.03, 0.05, -0.04],
    eye: 0.205,
    sprint: [0.08, -0.25, -0.28],
    sprintRot: [0.3, 0.55, 0.85],
    recoil: { back: 1.8, rise: 5.1, roll: 2.6, yaw: 1.7, side: 0.117, up: 0.091, adsBack: 0.54, adsRise: 0.344 },
    spring: [720, 0.52],
    right: [0, 0.002, 0.012],
    left: { pos: [0.011, -0.015, -0.0013], back: [0.25, -0.97, 0], axis: [-0.5, 0, -1] },
    fingers: { right: NEAR_TRIGGER, left: GRIP.handguard },
    weight: 1
  },
  shotgun: {
    hip: [0.18, -0.205, -0.37],
    hipRot: [0.025, 0.07, -0.03],
    eye: 0.12,
    sprint: [0.04, -0.25, -0.28],
    sprintRot: [0.55, 0.75, 0.9],
    recoil: { back: 2.6, rise: 9.5, roll: 2.4, yaw: 1.4, side: 0.12, up: 0.18 },
    spring: [300, 0.6],
    irons: true,
    right: [0, 0.002, 0.012],
    left: { pos: [0.008, -0.018, -0.0014], back: [0.25, -0.97, 0], axis: [-0.45, 0, -1] },
    fingers: { right: NEAR_TRIGGER, left: GRIP.pump },
    stow: 0.9,
    weight: 1.15,
    arms: { right: { pole: [0.3, 0.3, 0], shoulder: [-0.08, -0.03, 0.08] } },
  },
  sniper: {
    hip: [0.18, -0.205, -0.38],
    hipRot: [0.025, 0.06, -0.03],
    eye: 0.085,
    sprint: [0.15, -0.285, -0.27],
    sprintRot: [0.32, 0.7, 0.6],
    recoil: { back: 3.1, rise: 6, roll: 1.5, yaw: 0.9, side: 0.08, up: 0.1, adsBack: 0.45 },
    spring: [230, 0.76],
    right: [0, 0.002, 0.014],
    left: { pos: [0.006, -0.021, -0.001], back: [0.25, -0.97, 0], axis: [-0.45, 0, -1] },
    mag: [-0.004, -0.026, -0.004],
    fingers: { right: FINGERS.trigger, left: GRIP.foreEnd },
    weight: 1.3
  },
  pistol: {
    hip: [0.1, -0.12, -0.4],
    hipRot: [0.03, 0.1, -0.02],
    eye: 0.27,
    sprint: [0.08, -0.14, -0.34],
    sprintRot: [0.4, 0.55, 0.5],
    recoil: { back: 1.5, rise: 9, roll: 1.8, yaw: 1.2, side: 0.07, up: 0.12 },
    spring: [700, 0.6],
    irons: true,
    right: [0.002, -0.012, 0.03],
    rightBack: HIGH_GRIP,
    left: SIDEARM_SUPPORT,
    fingers: { right: FINGERS.trigger, left: FINGERS.wrap },
    stow: 0.85,
    weight: 0.8,
    arms: SIDEARM_ARMS,
  }
} satisfies Record<string, Tuning>;

export const TUNING: Record<WeaponId, Tuning> = {
  ...BASE,
  nailer: {
    hip: [0.165, -0.2, -0.42],
    hipRot: [0.035, 0.13, -0.05],
    eye: 0.358,
    sprint: [0.12, -0.235, -0.31],
    sprintRot: [0.42, 0.72, 0.42],
    recoil: { back: 1.9, rise: 3.6, roll: 3.0, yaw: 2.0, side: 0.14, up: 0.12, adsBack: 0.5 },
    spring: [1000, 0.45],
    irons: true,
    right: [0, 0.002, 0.012],
    left: { pos: [0.008, -0.0196, -0.0012], back: [0.45, -0.89, 0], axis: [-0.3, 0, -1] },
    fingers: { right: NEAR_TRIGGER, left: GRIP.drum },
    weight: 0.9
  },
  pulse: {
    hip: [0.185, -0.212, -0.36],
    hipRot: [0.03, 0.05, -0.04],
    eye: 0.215,
    sprint: [0.06, -0.19, -0.31],
    sprintRot: [0.12, 0.5, 1.45],
    recoil: { back: 1.8, rise: 4.2, roll: 1.0, yaw: 0.8, side: 0.05, up: 0.09 },
    spring: [650, 0.55],
    right: [0, 0.002, 0.012],
    left: { pos: [-0.002, -0.066, 0.012], back: [-0.5, 0.05, -0.86], axis: [0, 1, -0.48] },
    fingers: { right: NEAR_TRIGGER, left: GRIP.stop },
    stow: 0.95,
    weight: 0.95,
    arms: { left: { pole: UPRIGHT_ELBOW } },
  },
  harpoon: {
    hip: [0.175, -0.2, -0.37],
    hipRot: [0.025, 0.085, -0.035],
    eye: 0.583,
    sprint: [0.22, -0.31, -0.29],
    sprintRot: [0.7, 0, -0.35],
    recoil: { back: 2.2, rise: 7.5, roll: 1.6, yaw: 1.0, side: 0.08, up: 0.14, adsBack: 0.4, adsRise: 0.7, adsEye: 1 },
    spring: [420, 0.72],
    right: [0, 0.002, 0.012],
    left: { pos: [0.007, -0.014, -0.0012], back: [0.25, -0.97, 0], axis: [-0.45, 0, -1] },
    fingers: { right: NEAR_TRIGGER, left: GRIP.tube },
    stow: 0.85,
    weight: 1.15
  },
  cannon: {
    hip: [0.1, -0.127, -0.41],
    hipRot: [0.03, 0.09, -0.02],
    eye: 0.27,
    sprint: [0.075, -0.145, -0.36],
    sprintRot: [0.4, 0.55, 0.5],
    recoil: { back: 1.9, rise: 12, roll: 2.2, yaw: 1.3, side: 0.07, up: 0.15 },
    spring: [400, 0.58],
    irons: true,
    right: [0.002, -0.012, 0.03],
    rightBack: HIGH_GRIP,
    left: SIDEARM_SUPPORT,
    fingers: { right: FINGERS.trigger, left: FINGERS.wrap },
    stow: 0.9,
    weight: 0.95,
    arms: SIDEARM_ARMS,
  },
  buzzer: {
    hip: [0.12, -0.115, -0.37],
    hipRot: [0.03, 0.11, -0.02],
    eye: 0.27,
    sprint: [0.07, -0.135, -0.36],
    sprintRot: [0.5, 0.5, 0.45],
    recoil: { back: 1.3, rise: 8.0, roll: 3.8, yaw: 3.2, side: 0.17, up: 0.12 },
    spring: [800, 0.4],
    irons: true,
    right: [0.002, -0.012, 0.03],
    rightBack: [0.93, 0, 0.36],
    left: { pos: [-0.0041, -0.0097, 0.0054], back: [-0.6, 0, -0.8], axis: [0, 1, -0.2] },
    fingers: { right: NEAR_TRIGGER, left: FINGERS.handle },
    stow: 0.8,
    weight: 0.75,
    arms: { right: { shoulder: [-0.13, -0.1, 0.08] }, left: { pole: UPRIGHT_ELBOW } },
  }
};

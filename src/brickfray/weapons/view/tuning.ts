import type { WeaponId } from '../defs';
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
  /** Recoil impulses: back (m/s), rise (rad/s), random roll and yaw (rad/s), sideways jitter (m/s). */
  recoil: { back: number; rise: number; roll: number; yaw: number; side: number; up: number };
  /** Recoil spring stiffness and damping ratio. */
  spring: [number, number];
  /** Right hand: palm-frame position relative to the `grip` node. */
  right: V3;
  /** Left hand on the support node: position, back-of-hand direction, grip axis. */
  left: { pos: V3; back: V3; axis: V3 };
  /** Overall sway/bob multiplier (heavier guns move more and slower). */
  weight: number;
}

export const TUNING: Record<WeaponId, Tuning> = {
  ar: {
    hip: [0.19, -0.215, -0.37],
    hipRot: [0.03, 0.05, -0.04],
    eye: 0.205,
    sprint: [0.1, -0.27, -0.25],
    sprintRot: [0.38, 0.68, 0.38],
    recoil: { back: 0.95, rise: 3.0, roll: 1.4, yaw: 0.9, side: 0.06, up: 0.05 },
    spring: [560, 0.62],
    right: [0, 0.002, 0.016],
    left: { pos: [-0.006, -0.022, 0], back: [-0.3, -1, 0.05], axis: [0.08, 0, -1] },
    weight: 1
  },
  shotgun: {
    hip: [0.18, -0.205, -0.37],
    hipRot: [0.025, 0.07, -0.03],
    eye: 0.81,
    sprint: [0.1, -0.27, -0.25],
    sprintRot: [0.36, 0.68, 0.38],
    recoil: { back: 2.6, rise: 9.5, roll: 2.4, yaw: 1.4, side: 0.12, up: 0.18 },
    spring: [300, 0.6],
    right: [0, 0.002, 0.016],
    left: { pos: [-0.006, -0.02, 0], back: [-0.3, -1, 0.05], axis: [0.08, 0, -1] },
    weight: 1.15
  },
  sniper: {
    hip: [0.18, -0.205, -0.38],
    hipRot: [0.025, 0.06, -0.03],
    eye: 0.07,
    sprint: [0.1, -0.26, -0.26],
    sprintRot: [0.34, 0.66, 0.38],
    recoil: { back: 3.0, rise: 10.5, roll: 2.0, yaw: 1.2, side: 0.1, up: 0.2 },
    spring: [240, 0.58],
    right: [0, 0.002, 0.014],
    left: { pos: [-0.006, -0.026, 0], back: [-0.3, -1, 0.05], axis: [0.08, 0, -1] },
    weight: 1.3
  },
  pistol: {
    hip: [0.13, -0.17, -0.38],
    hipRot: [0.03, 0.12, -0.02],
    eye: 0.58,
    sprint: [0.09, -0.25, -0.27],
    sprintRot: [0.7, 0.35, 0.5],
    recoil: { back: 0.9, rise: 7.5, roll: 1.6, yaw: 1.1, side: 0.06, up: 0.08 },
    spring: [700, 0.6],
    right: [0, -0.012, 0.018],
    left: { pos: [-0.008, -0.03, -0.018], back: [-1, -0.35, 0.3], axis: [0.1, 1, -0.45] },
    weight: 0.8
  }
};

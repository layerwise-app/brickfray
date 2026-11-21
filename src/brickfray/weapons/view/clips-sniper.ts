import * as THREE from 'three';
import { hand, track, type Clip, type ClipCtx, type Frame, type Keys } from './clip';
import { clip, jolt, magSwap, Z } from './clips-kit';
import { fingers, type FingerPose } from './fingers';
import { env } from './springs';

/** Rolled toward the camera and turned across it, so the bolt and the hand working it sit in the open. */
const BOLT_TILT = [-0.12, -0.005, -0.08, 0.04, 0.12, 0.14];
const BOLT_PULL = [-0.114, 0.003, -0.066, 0.075, 0.11, 0.17];
const BOLT_PUSH = [-0.124, -0.009, -0.092, 0.02, 0.13, 0.11];
/** The empty reload works the bolt further out, clear of the lower right corner. */
const OUT = (pose: number[]) => pose.map((v, i) => v + (i === 2 ? -0.035 : i === 0 ? -0.01 : 0));
const PRESENT = [-0.1, 0.1, -0.17, 0.52, 0.26, -0.3];
const WAIT = [-0.091, 0.086, -0.16, 0.48, 0.25, -0.27];
const SAG = [-0.07, 0.062, -0.12, 0.34, 0.2, -0.2];
const MEET = [-0.103, 0.105, -0.172, 0.53, 0.26, -0.32];
const DIP = [0.005, -0.012, 0.006, -0.03, -0.02, 0.05];
const OVER = [0.006, -0.008, 0.004, -0.02, -0.012, 0.04];

const LIFT = 1.05;
const THROW = 0.09;
/** Bolt offsets: handle up, starting back, fully back. */
const UP = [0, 0, 0.004, 0, 0, LIFT * 0.96];
const UNLOCKED = [0, 0, 0.022, 0, 0, LIFT];
const BACK = [0, 0, THROW, 0, 0, LIFT];

/** Thumb and two fingers closed on the bolt knob, the rest of the hand a fist behind it. */
const KNOB: FingerPose = { thumb: 0.8, index: 0.86, middle: 0.88, ring: 0.94, pinky: 0.96, spread: 0, oppose: 1 };

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const turn = new THREE.Quaternion();
/** How much of the bolt's lift the wrist rolls along with. */
const WRIST_ROLL = 0.3;
/** Fully aimed, the bolt is worked with the cheek kept on the stock: this share of the hold on the aim, and of the rifle's roll toward the hand. */
const AIMED_BOLT = 0.4;
const AIMED_ROLL = 0.6;

/** Sets the bolt and keeps the palm on its knob. */
function work(f: Frame, c: ClipCtx, offset: number[]) {
  f.part('bolt', offset);
  const seat = c.goals.boltSeat!;
  const palm = c.goals.bolt!.node;
  const lift = offset[5] ?? 0;
  palm.position.copy(c.goals.boltKnob!.node.position).applyQuaternion(turn.setFromAxisAngle(AXIS_Z, lift)).applyQuaternion(seat.quat);
  palm.position.add(seat.pos);
  palm.position.z += offset[2] ?? 0;
  palm.quaternion.setFromAxisAngle(AXIS_Z, lift * WRIST_ROLL);
}

const swap = (at: readonly [number, number, number, number, number, number, number, number, number, number]) =>
  magSwap({
    present: PRESENT,
    meet: MEET,
    tug: [0, -0.008, 0, 0.02, 0, 0],
    clear: [0, -0.085, -0.004, 0.06, 0, 0],
    under: [-0.006, -0.15, -0.012, 0.14, 0, 0.1],
    mouth: [0, -0.05, -0.003, 0.03, 0, 0],
    leave: [-0.17, -0.34, -0.4, 0.6, 0.3, -1.05],
    pouch: [-0.25, -0.47, -0.26, 0.9, 0.3, -1.2],
    back: [-0.15, -0.33, -0.42, 0.5, 0.32, -1.0],
    at,
    rip: [-0.006, -0.014, 0, -0.03, 0, -0.05],
    slam: [0.004, 0.018, 0, 0.05, 0, 0.04]
  });

/** Bolt cycle after a shot: ride out the recoil on the grip, then lift, haul back to throw the case, drive home, lock down. */
export function sniperCycle(duration: number): Clip {
  const bolt: Keys = [[0.225, Z], [0.275, UP], [0.29, UNLOCKED], [0.36, BACK], [0.385, BACK], [0.45, UNLOCKED], [0.465, UP], [0.51, Z]];
  const gun: Keys = [[0, Z], [0.13, [-0.02, -0.002, -0.012, 0.008, 0.03, 0.03]], [0.25, BOLT_TILT], [0.36, BOLT_PULL], [0.46, BOLT_PUSH], [0.55, [-0.02, -0.006, -0.02, 0.01, 0.03, -0.1]], [0.62, Z], [0.64, Z]];
  return clip('bolt', duration, 0.64, [[0.13, 'cloth'], [0.285, 'boltBack'], [0.355, 'eject'], [0.455, 'boltForward']], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun), 1 - (1 - AIMED_ROLL) * c.ads);
    f.gun([0, 0.002, 0.012, 0.03, 0, -0.03], jolt(t - 0.355));
    f.gun([0, -0.003, -0.01, -0.03, 0, 0.04], jolt(t - 0.455));
    work(f, c, track(t, bolt));
    f.right = hand(t, [[0, g.rightRest!], [0.13, g.rightRest!], [0.235, g.bolt!], [0.52, g.bolt!], [0.63, g.rightRest!]]);
    if (t > 0.13 && t < 0.63) f.rightFingers = fingers(t, [[0.13, 'trigger'], [0.18, 'relaxed'], [0.24, KNOB], [0.51, KNOB], [0.57, 'relaxed'], [0.63, 'trigger']]);
    f.busy = env(t, 0.04, 0.18, 0.52, 0.63) * (1 - (1 - AIMED_BOLT) * c.ads);
  });
}

/** Rifle-style mag change, heavier; empty opens the bolt first and closes it on the fresh mag. */
export function sniperReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.12, DIP], [0.56, PRESENT], [0.9, WAIT], [1.2, SAG], [1.6, MEET], [1.94, WAIT], [2.32, OVER], [2.52, Z], [2.6, Z]];
    const mag = swap([0.64, 0.7, 0.8, 0.98, 1.12, 1.27, 1.52, 1.68, 1.73, 1.79]);
    return clip('sniperReload', duration, 2.6, [[0.02, 'cloth'], [0.74, 'magOut'], [1.78, 'magIn'], [2.05, 'cloth']], (t, f, c) => {
      const g = c.goals;
      f.gun(track(t, gun));
      mag(t, f, c);
      f.left = hand(t, [[0, g.leftRest!], [0.12, g.leftRest!], [0.56, g.mag!], [1.92, g.mag!], [2.34, g.leftRest!]]);
      if (t > 0.12 && t < 2.34) f.leftFingers = fingers(t, [[0.12, c.tuning.fingers.left], [0.34, 'open'], [0.58, 'magazine'], [1.86, 'magazine'], [2.08, 'relaxed'], [2.34, c.tuning.fingers.left]]);
      f.busy = env(t, 0, 0.2, 2.24, 2.52);
    });
  }
  const gun: Keys = [
    [0, Z],
    [0.12, [-0.02, -0.002, -0.012, 0.008, 0.03, 0.03]],
    [0.28, OUT(BOLT_TILT)],
    [0.47, OUT(BOLT_PULL)],
    [0.9, PRESENT],
    [1.22, WAIT],
    [1.5, SAG],
    [1.88, MEET],
    [2.26, WAIT],
    [2.56, OUT(BOLT_TILT)],
    [2.74, OUT(BOLT_PUSH)],
    [2.96, [-0.02, -0.006, -0.02, 0.01, 0.03, -0.1]],
    [3.12, Z],
    [3.2, Z]
  ];
  const bolt: Keys = [[0.3, Z], [0.36, UP], [0.38, UNLOCKED], [0.47, BACK], [2.6, BACK], [2.7, UNLOCKED], [2.72, UP], [2.79, Z]];
  const mag = swap([0.98, 1.04, 1.14, 1.32, 1.46, 1.6, 1.82, 1.96, 2.0, 2.06]);
  const events = [[0.02, 'cloth'], [0.37, 'boltBack'], [0.46, 'eject'], [1.08, 'magOut'], [2.05, 'magIn'], [2.71, 'boltForward'], [2.9, 'cloth']] as const;
  return clip('sniperReloadEmpty', duration, 3.2, [...events], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0, 0.002, 0.012, 0.03, 0, -0.03], jolt(t - 0.46));
    f.gun([0, -0.003, -0.01, -0.03, 0, 0.04], jolt(t - 2.71));
    mag(t, f, c);
    work(f, c, track(t, bolt));
    f.right = hand(t, [[0, g.rightRest!], [0.13, g.rightRest!], [0.3, g.bolt!], [0.5, g.bolt!], [0.76, g.rightRest!], [2.34, g.rightRest!], [2.58, g.bolt!], [2.81, g.bolt!], [3.04, g.rightRest!]]);
    if ((t > 0.13 && t < 0.76) || (t > 2.34 && t < 3.04)) {
      f.rightFingers = fingers(t, [[0.13, 'trigger'], [0.22, 'relaxed'], [0.3, KNOB], [0.5, KNOB], [0.62, 'relaxed'], [0.76, 'trigger'], [2.34, 'trigger'], [2.46, 'relaxed'], [2.58, KNOB], [2.81, KNOB], [2.92, 'relaxed'], [3.04, 'trigger']]);
    }
    f.left = hand(t, [[0, g.leftRest!], [0.62, g.leftRest!], [0.92, g.mag!], [2.2, g.mag!], [2.6, g.leftRest!]]);
    if (t > 0.62 && t < 2.6) f.leftFingers = fingers(t, [[0.62, c.tuning.fingers.left], [0.78, 'open'], [0.94, 'magazine'], [2.14, 'magazine'], [2.36, 'relaxed'], [2.6, c.tuning.fingers.left]]);
    f.busy = env(t, 0, 0.16, 2.94, 3.16);
  });
}

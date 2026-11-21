import * as THREE from 'three';
import { CRANE_HINGE } from '../models/cannon';
import { hand, track, type Clip, type Keys } from './clip';
import { carry, clip, jolt, viewGoal, viewOf, Z, type Events } from './clips-kit';
import { fingers, FINGERS, type FingerPose } from './fingers';
import { goal, gripQuat, type Goal, type V3 } from './goals';
import { env, seg, smooth01 } from './springs';
import { TUNING } from './tuning';

/** Crane swing when the cylinder is out (radians, positive = out to the left). */
const OPEN = 1.38;
/** Ejector rod stroke that lifts the moon-clipped empties out of the chambers. */
const STROKE = 0.018;
/** Seconds after a shot for the hammer to re-cock and the cylinder to index one chamber. */
export const REVOLVER_CYCLE = 0.34;
const HAMMER_COCK = 0.55;

const GUN_OPEN = [-0.075, 0.06, 0.03, 0.22, 0.38, -0.6];
const GUN_UP = [-0.02, 0.05, 0.05, 0.95, 0.42, -0.55];
const GUN_LOAD = [-0.05, 0.035, 0.02, 0.32, 0.42, -0.5];
const GUN_CLOSE = [-0.07, 0.055, 0.03, 0.2, 0.32, -0.3];

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Turns a view-space direction into the frame of the gun held in `pose`, optionally on the swung-out crane. */
function fromView(pose: readonly number[], crane: boolean) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...TUNING.cannon.hipRot));
  q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pose[3], pose[4], pose[5])));
  if (crane) q.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, OPEN));
  q.invert();
  return (v: V3): [number, number, number] => new THREE.Vector3(...v).applyQuaternion(q).toArray();
}

/** Moon clip offsets from its chambers: kicked out by the rod, lined up behind the cylinder, starting in. */
const KICKED = [0, -0.005, 0.045, 0.1, 0, 0];
const NEAR = [0, 0, 0.05, 0, 0, 0];
const STARTED = [0, 0, 0.036, 0, 0, 0];
const DIP = [0.004, -0.01, 0.006, -0.03, -0.02, 0.04];
const OVER = [0.004, -0.006, 0.004, -0.025, -0.01, 0.04];

const out: number[] = [];

/** Offset [x, y, z, rx, ry, rz] of a part on the crane (pivot on the cylinder axis) swung out by `a`, pushed `dz` along the axis. */
function crane(a: number, dz: number, o: number[] = out) {
  const cx = -CRANE_HINGE[0];
  const cy = -CRANE_HINGE[1];
  const c = Math.cos(a);
  const s = Math.sin(a);
  o.length = 6;
  o[0] = cx * c - cy * s - cx;
  o[1] = cx * s + cy * c - cy;
  o[2] = dz;
  o[3] = 0;
  o[4] = 0;
  o[5] = a;
  return o;
}

/**
 * Left-hand goals, authored in view space for the pose each is used in. Rod and
 * loader ride their crane nodes; the cylinder goal is a fixed frame where the
 * swung-out cylinder ends up, so the hand meets it there and stays put while it swings.
 */
export function revolverGoals(node: (name: string) => THREE.Object3D): Record<string, Goal> {
  const at = (target: THREE.Object3D, pose: readonly number[], pos: V3, back: V3, axis: V3) => {
    const f = fromView(pose, true);
    return goal(target, f(pos), gripQuat(f(back), f(axis), -1));
  };
  const hold = node('cylHold');
  const part = hold.parent!;
  const open = new THREE.Object3D();
  const [x, y, z] = crane(OPEN, 0);
  open.quaternion.setFromAxisAngle(AXIS_Z, OPEN);
  open.position.copy(hold.position).applyQuaternion(open.quaternion).add(part.position).add(new THREE.Vector3(x, y, z));
  part.parent!.add(open);
  const cylinder = at(open, GUN_OPEN, [0.012, -0.006, -0.006], [0.5, -0.86, 0.1], [-0.38, -0.08, -0.8]);
  // The same hold slid forward onto the ejector rod, and squeezed back along it by the rod's stroke.
  const onRod = (dz: number) => goal(open, [cylinder.pos.x, cylinder.pos.y, cylinder.pos.z + dz], cylinder.quat);
  return {
    cylinder,
    rod: onRod(-0.034),
    rodIn: onRod(-0.034 + STROKE),
    loader: at(node('loaderHold'), GUN_LOAD, [0.01, -0.03, -0.015], [0, -1, 0.15], [-0.41, -0.12, -0.8])
  };
}

/**
 * Per-shot action, `t` 0 → 1 over REVOLVER_CYCLE after a shot (1 at rest): the
 * hammer (modeled down) has just fallen, then re-cocks while the cylinder
 * indexes one chamber. The six-fold cylinder starts a sixth of a turn back, so
 * the jump at the shot is invisible.
 */
export function revolverAction(part: string, t: number, q: THREE.Quaternion): THREE.Quaternion {
  if (part === 'hammer') return q.setFromAxisAngle(AXIS_X, HAMMER_COCK * smooth01((t - 0.25) / 0.6));
  if (part === 'cylinder') return q.setFromAxisAngle(AXIS_Z, (Math.PI / 3) * (smooth01((t - 0.3) / 0.6) - 1));
  return q.identity();
}

/** Offset of the moon clip riding the crane swung out by `a`, moved `r` from its chambers. */
function onCrane(a: number, r: readonly number[]) {
  const base = crane(a, 0);
  return [base[0]! + r[0]!, base[1]! + r[1]!, r[2]!, r[3]!, r[4]!, a + r[5]!];
}

/** Cupped under the swung-out cylinder, thumb closed over it. */
const CUP: FingerPose = { ...FINGERS.support, thumb: 0.62, hook: -0.3, index: 0.62, middle: 0.66, ring: 0.66, pinky: 0.6 };
/** Closed around the ejector rod. */
const SQUEEZE: FingerPose = { ...CUP, thumb: 0.72, index: 0.74, middle: 0.76, ring: 0.76, pinky: 0.72 };
/** Muzzle only a little up: the half-used clip is drawn out by hand, not shaken out. */
const GUN_PLUCK = [-0.045, 0.04, 0.035, 0.46, 0.42, -0.52];

/**
 * Hand Cannon reload: the cylinder is pushed out and a fresh moon clip brought up by its gold knob, seated, and
 * the cylinder flicked home. Empty, the muzzle tips up and the ejector rod kicks the spent clip free to fall;
 * topping up, the left hand draws the half-used clip out by its knob and pockets it.
 */
export function revolverReload(empty: boolean, duration: number): Clip {
  const up = empty ? GUN_UP : GUN_PLUCK;
  const gun: Keys = [
    [0, Z],
    [0.06, DIP],
    [0.24, GUN_OPEN],
    [0.38, [-0.08, 0.055, 0.03, 0.25, 0.4, -0.66]],
    [0.56, up],
    [0.74, up.map((v, i) => v + [-0.002, -0.01, 0.002, -0.09, 0, 0][i]!)],
    [0.98, GUN_LOAD],
    [1.26, [-0.054, 0.042, 0.018, 0.35, 0.42, -0.54]],
    [1.44, GUN_LOAD],
    [1.6, GUN_OPEN],
    [1.74, GUN_CLOSE],
    [1.96, OVER],
    [2.06, Z],
    [2.1, Z]
  ];
  const swing: Keys = [[0.25, [0]], [0.37, [OPEN]], [1.6, [OPEN]], [1.665, [0]]];
  const rod: Keys = empty ? [[0.58, [0]], [0.625, [STROKE]], [0.68, [STROKE]], [0.76, [0]]] : [[0, [0]]];
  const rounds: Keys = empty
    ? [[0.58, Z], [0.625, [0, 0, STROKE, 0, 0, 0]], [0.68, KICKED], [1.24, NEAR], [1.3, STARTED], [1.36, Z]]
    : [[0.6, Z], [0.64, [0, 0, 0.006, 0, 0, 0]], [0.72, NEAR], [1.24, NEAR], [1.3, STARTED], [1.36, Z]];
  const events: Events = [[0.04, 'cloth'], [0.27, 'boltBack'], [empty ? 0.62 : 0.66, 'magOut'], [0.92, 'cloth'], [1.35, 'magIn'], [1.66, 'boltForward'], [1.9, 'cloth']];
  if (empty) events.push([0.625, 'eject']);
  /** When the clip leaves the gun for view space: the rod's kick, or the hand's pull. */
  const out = empty ? 0.64 : 0.62;
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('revolverReload', duration, 2.1, events, (t, f, c) => {
    const g = c.goals;
    const seat = g.speedloaderSeat!;
    const hold = g.loader!.node;
    if (!path) {
      const near = viewOf(c, GUN_LOAD, seat, hold, onCrane(OPEN, NEAR));
      const pouch = [-0.2, -0.42, -0.3, near[3]! + 0.3, near[4]!, near[5]! - 0.2];
      const back: Keys = [
        [0.98, pouch],
        [1.12, [-0.06, -0.24, -0.34, near[3]! + 0.12, near[4]!, near[5]! - 0.08]],
        [1.24, near],
        [1.3, viewOf(c, GUN_LOAD, seat, hold, onCrane(OPEN, STARTED))]
      ];
      if (empty) {
        const kicked = viewOf(c, GUN_UP, seat, hold, onCrane(OPEN, KICKED));
        path = [
          [0.625, viewOf(c, GUN_UP, seat, hold, onCrane(OPEN, [0, 0, STROKE, 0, 0, 0]))],
          [0.68, kicked],
          [0.78, [kicked[0]!, kicked[1]! - 0.2, kicked[2]! + 0.03, kicked[3]! + 0.6, kicked[4]!, kicked[5]! + 0.3]],
          [0.88, [kicked[0]!, kicked[1]! - 0.6, kicked[2]! + 0.05, kicked[3]! + 1.4, kicked[4]!, kicked[5]! + 0.6]],
          [0.8801, pouch],
          ...back
        ];
      } else {
        const drawn = viewOf(c, up, seat, hold, onCrane(OPEN, NEAR));
        path = [
          [0.64, viewOf(c, up, seat, hold, onCrane(OPEN, [0, 0, 0.006, 0, 0, 0]))],
          [0.72, drawn],
          [0.8, [drawn[0]! - 0.07, drawn[1]! - 0.1, drawn[2]! + 0.02, drawn[3]! + 0.15, drawn[4]!, drawn[5]! - 0.1]],
          [0.9, pouch],
          ...back
        ];
      }
      fetch = viewGoal(c, pouch, g.loader!);
    }
    f.gun(track(t, gun));
    f.gun([0.005, 0, 0, 0, 0.02, -0.07], jolt(t - 0.27));
    if (empty) f.gun([0, 0.006, 0.004, -0.05, 0, 0], jolt(t - 0.61));
    else f.gun([-0.003, -0.004, 0, 0.03, 0, 0.03], jolt(t - 0.65));
    f.gun([0, 0.008, -0.004, 0.05, 0, 0], jolt(t - 1.345));
    f.gun([0.006, 0, 0, 0, 0, -0.12], jolt(t - 1.655));
    const a = track(t, swing)[0]!;
    f.part('cylinder', crane(a, 0));
    f.part('crane', crane(a, 0));
    f.part('ejector', crane(a, track(t, rod)[0]!));
    carry(f, c, 'speedloader', seat, hold, onCrane(a, track(t, rounds)), track(t, path), seg(t, out, out + 0.07) * (1 - seg(t, 1.14, 1.26)));
    const rest = c.tuning.fingers.left;
    if (empty) {
      f.left = hand(t, [
        [0, g.leftRest!],
        [0.04, g.leftRest!],
        [0.24, g.cylinder!],
        [0.38, g.cylinder!],
        [0.56, g.rod!],
        [0.585, g.rod!],
        [0.625, g.rodIn!],
        [0.7, g.rodIn!],
        [0.92, fetch!],
        [0.94, fetch!],
        [0.9401, g.loader!],
        [1.42, g.loader!],
        [1.58, g.cylinder!],
        [1.66, g.cylinder!],
        [1.92, g.leftRest!]
      ]);
      if (t > 0.04 && t < 1.92) {
        f.leftFingers = fingers(t, [[0.04, rest], [0.16, 'open'], [0.26, CUP], [0.4, CUP], [0.56, SQUEEZE], [0.7, SQUEEZE], [0.9, 'pinch'], [1.38, 'pinch'], [1.5, 'relaxed'], [1.6, CUP], [1.68, 'flat'], [1.92, rest]]);
      }
    } else {
      // The hand rides the clip's knob from the pull to the fresh clip's seat; the clip's path carries it to the pouch and back.
      f.left = hand(t, [[0, g.leftRest!], [0.04, g.leftRest!], [0.24, g.cylinder!], [0.38, g.cylinder!], [0.58, g.loader!], [1.42, g.loader!], [1.58, g.cylinder!], [1.66, g.cylinder!], [1.92, g.leftRest!]]);
      if (t > 0.04 && t < 1.92) {
        f.leftFingers = fingers(t, [[0.04, rest], [0.16, 'open'], [0.26, CUP], [0.4, CUP], [0.56, 'pinch'], [1.38, 'pinch'], [1.5, 'relaxed'], [1.6, CUP], [1.68, 'flat'], [1.92, rest]]);
      }
    }
    f.busy = env(t, 0, 0.14, 1.9, 2.08);
  });
}

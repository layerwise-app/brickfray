import * as THREE from 'three';
import { CRANE_HINGE } from '../models/cannon';
import { hand, track, type Clip, type Keys } from './clip';
import { carry, clip, jolt, viewGoal, viewOf, Z, type Events } from './clips-kit';
import { fingers } from './fingers';
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

const GUN_OPEN = [-0.075, 0.075, -0.05, 0.22, 0.38, -0.6];
const GUN_UP = [-0.02, 0.07, -0.03, 0.95, 0.42, -0.55];
const GUN_LOAD = [-0.05, 0.05, -0.06, 0.32, 0.42, -0.5];
const GUN_CLOSE = [-0.07, 0.07, -0.05, 0.2, 0.32, -0.3];

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
  return {
    cylinder: at(open, GUN_OPEN, [0.012, -0.006, -0.006], [0, -1, 0.1], [-0.38, -0.08, -0.8]),
    rod: at(node('rodTip'), GUN_UP, [0.01, -0.02, 0.01], [-0.3, -1, 0.2], [-0.48, -0.01, -0.77]),
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

/**
 * Hand Cannon reload: the cylinder is pushed out, the muzzle tips up while the
 * ejector rod kicks the moon-clipped empties free, the left hand brings a fresh
 * clip up by its gold knob and seats it, then flicks the cylinder home.
 */
export function revolverReload(_empty: boolean, duration: number): Clip {
  const gun: Keys = [
    [0, Z],
    [0.06, DIP],
    [0.24, GUN_OPEN],
    [0.38, [-0.08, 0.07, -0.05, 0.25, 0.4, -0.66]],
    [0.56, GUN_UP],
    [0.74, [-0.022, 0.06, -0.028, 0.86, 0.42, -0.55]],
    [0.98, GUN_LOAD],
    [1.26, [-0.054, 0.057, -0.062, 0.35, 0.42, -0.54]],
    [1.44, GUN_LOAD],
    [1.6, GUN_OPEN],
    [1.74, GUN_CLOSE],
    [1.96, OVER],
    [2.06, Z],
    [2.1, Z]
  ];
  const swing: Keys = [[0.25, [0]], [0.37, [OPEN]], [1.6, [OPEN]], [1.665, [0]]];
  const rod: Keys = [[0.58, [0]], [0.625, [STROKE]], [0.68, [STROKE]], [0.76, [0]]];
  const rounds: Keys = [[0.58, Z], [0.625, [0, 0, STROKE, 0, 0, 0]], [0.68, KICKED], [1.24, NEAR], [1.3, STARTED], [1.36, Z]];
  const events: Events = [[0.04, 'cloth'], [0.27, 'boltBack'], [0.62, 'magOut'], [0.92, 'cloth'], [1.35, 'magIn'], [1.66, 'boltForward'], [1.9, 'cloth']];
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('revolverReload', duration, 2.1, events, (t, f, c) => {
    const g = c.goals;
    const seat = g.speedloaderSeat!;
    const hold = g.loader!.node;
    if (!path) {
      const kicked = viewOf(c, GUN_UP, seat, hold, onCrane(OPEN, KICKED));
      const near = viewOf(c, GUN_LOAD, seat, hold, onCrane(OPEN, NEAR));
      const pouch = [-0.2, -0.42, -0.3, near[3]! + 0.3, near[4]!, near[5]! - 0.2];
      path = [
        [0.625, viewOf(c, GUN_UP, seat, hold, onCrane(OPEN, [0, 0, STROKE, 0, 0, 0]))],
        [0.68, kicked],
        [0.78, [kicked[0]!, kicked[1]! - 0.2, kicked[2]! + 0.03, kicked[3]! + 0.6, kicked[4]!, kicked[5]! + 0.3]],
        [0.88, [kicked[0]!, kicked[1]! - 0.6, kicked[2]! + 0.05, kicked[3]! + 1.4, kicked[4]!, kicked[5]! + 0.6]],
        [0.8801, pouch],
        [0.98, pouch],
        [1.12, [-0.06, -0.24, -0.4, near[3]! + 0.12, near[4]!, near[5]! - 0.08]],
        [1.24, near],
        [1.3, viewOf(c, GUN_LOAD, seat, hold, onCrane(OPEN, STARTED))]
      ];
      fetch = viewGoal(c, pouch, g.loader!);
    }
    f.gun(track(t, gun));
    f.gun([0.005, 0, 0, 0, 0.02, -0.07], jolt(t - 0.27));
    f.gun([0, 0.006, 0.004, -0.05, 0, 0], jolt(t - 0.61));
    f.gun([0, 0.008, -0.004, 0.05, 0, 0], jolt(t - 1.345));
    f.gun([0.006, 0, 0, 0, 0, -0.12], jolt(t - 1.655));
    const a = track(t, swing)[0]!;
    f.part('cylinder', crane(a, 0));
    f.part('crane', crane(a, 0));
    f.part('ejector', crane(a, track(t, rod)[0]!));
    carry(f, c, 'speedloader', seat, hold, onCrane(a, track(t, rounds)), track(t, path), seg(t, 0.64, 0.7) * (1 - seg(t, 1.14, 1.26)));
    f.left = hand(t, [
      [0, g.leftRest!],
      [0.04, g.leftRest!],
      [0.24, g.cylinder!],
      [0.38, g.cylinder!],
      [0.56, g.rod!],
      [0.7, g.rod!],
      [0.92, fetch!],
      [0.94, fetch!],
      [0.9401, g.loader!],
      [1.42, g.loader!],
      [1.58, g.cylinder!],
      [1.66, g.cylinder!],
      [1.92, g.leftRest!]
    ]);
    if (t > 0.04 && t < 1.92) {
      f.leftFingers = fingers(t, [[0.04, 'wrap'], [0.16, 'open'], [0.26, 'support'], [0.4, 'support'], [0.56, 'flat'], [0.7, 'flat'], [0.9, 'pinch'], [1.38, 'pinch'], [1.5, 'open'], [1.6, 'support'], [1.68, 'flat'], [1.92, 'wrap']]);
    }
    f.busy = env(t, 0, 0.14, 1.9, 2.08);
  });
}

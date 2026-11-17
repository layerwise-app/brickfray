import * as THREE from 'three';
import { CRANE_HINGE } from '../models/cannon';
import { bump, hand, track, type Clip, type ClipEvent, type Keys } from './clip';
import { goal, gripQuat, type Goal, type V3 } from './goals';
import { env, smooth01 } from './springs';
import { TUNING } from './tuning';

const Z = [0, 0, 0, 0, 0, 0];
type Events = (readonly [number, ClipEvent])[];

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

/** Fresh rounds held low-left out of view, then lined up behind the open cylinder; empties dropping out of view. */
const ROUNDS_LOW = [...fromView(GUN_LOAD, false)([-0.3, -0.39, 0.18]), 0, 0.4, 0];
const ROUNDS_NEAR = [0, 0, 0.05, 0, 0, 0];
const ROUNDS_FALLEN = [...fromView(GUN_UP, false)([-0.05, -0.45, 0.08]), 1.4, 0.5, 0];

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

/**
 * Hand Cannon reload: the cylinder swings out, the muzzle tips up while the
 * ejector rod dumps the moon-clipped empties, the left hand brings a fresh clip
 * up by its gold speedloader knob and seats it, then pushes the cylinder home.
 */
export function revolverReload(_empty: boolean, duration: number): Clip {
  const gun: Keys = [[0, Z], [0.11, GUN_OPEN], [0.2, GUN_OPEN], [0.27, GUN_UP], [0.4, GUN_UP], [0.49, GUN_LOAD], [0.69, GUN_LOAD], [0.75, GUN_OPEN], [0.83, GUN_CLOSE], [1, Z]];
  const swing: Keys = [[0.11, [0]], [0.18, [OPEN]], [0.77, [OPEN]], [0.805, [0]]];
  const rod: Keys = [[0.29, [0]], [0.33, [STROKE]], [0.36, [STROKE]], [0.4, [0]]];
  const rounds: Keys = [
    [0.29, Z],
    [0.33, [0, 0, STROKE, 0, 0, 0]],
    [0.355, [0, -0.005, 0.04, 0.1, 0, 0]],
    [0.43, ROUNDS_FALLEN],
    [0.4301, ROUNDS_LOW],
    [0.47, ROUNDS_LOW],
    [0.6, ROUNDS_NEAR],
    [0.625, ROUNDS_NEAR],
    [0.66, Z]
  ];
  const events: Events = [[0.02, 'cloth'], [0.15, 'boltBack'], [0.32, 'magOut'], [0.44, 'cloth'], [0.655, 'magIn'], [0.8, 'boltForward'], [0.92, 'cloth']];
  const r: number[] = [];
  return {
    name: 'revolverReload',
    duration,
    events,
    sample(u, f, c) {
      const g = c.goals;
      f.gun(track(u, gun));
      f.gun([0, 0.006, 0.004, -0.04, 0, 0], bump(u, 0.33, 0.02));
      f.gun([0, 0.008, -0.004, 0.05, 0, 0], bump(u, 0.66, 0.02));
      f.gun([0.006, 0, 0, 0, 0, -0.12], bump(u, 0.805, 0.018));
      const a = track(u, swing)[0]!;
      f.part('cylinder', crane(a, 0));
      f.part('crane', crane(a, 0));
      f.part('ejector', crane(a, track(u, rod)[0]!));
      track(u, rounds, r);
      const base = crane(a, 0);
      f.part('speedloader', [base[0]! + r[0]!, base[1]! + r[1]!, r[2]!, r[3]!, r[4]!, a + r[5]!]);
      f.left = hand(u, [
        [0, g.leftRest!],
        [0.1, g.cylinder!],
        [0.2, g.cylinder!],
        [0.27, g.rod!],
        [0.37, g.rod!],
        [0.43, g.low!],
        [0.47, g.loader!],
        [0.67, g.loader!],
        [0.74, g.cylinder!],
        [0.79, g.cylinder!],
        [0.92, g.leftRest!]
      ]);
      f.busy = env(u, 0, 0.07, 0.92, 1);
    }
  };
}

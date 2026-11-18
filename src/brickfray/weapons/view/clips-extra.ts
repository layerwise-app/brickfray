import * as THREE from 'three';
import { hand, track, type Clip, type ClipEvent } from './clip';
import { fingers } from './fingers';
import { goal, holdQuat, type Goal, type V3 } from './goals';
import { seg } from './springs';

export const Z = [0, 0, 0, 0, 0, 0];
export type Events = (readonly [number, ClipEvent])[];
/** A hand placement in view space: position, tool axis, the direction the fingers' side faces. */
export type Pose = readonly [pos: V3, axis: V3, face: V3];

export function clip(name: string, duration: number, events: Events, sample: Clip['sample'], hold = false): Clip {
  return { name, duration, events: [...events].sort((a, b) => a[0] - b[0]), sample, hold };
}

export function held(view: THREE.Object3D, [pos, axis, face]: Pose): Goal {
  return goal(view, pos, holdQuat(axis, face));
}

export function scaled(v: readonly number[], k: number) {
  return v.map((x) => x * k);
}

/** View-space hand goals shared by the switch, melee and grenade clips. */
export function extraGoals(view: THREE.Object3D): Record<string, Goal> {
  return { low: held(view, [[-0.24, -0.5, -0.28], [0.2, 1, -0.2], [1, 0, -0.3]]) };
}

/** Off-screen at the lower right, rolled over: where a gun goes to and comes from on a switch. */
const AWAY = [0.04, -0.18, 0.07, -0.62, -0.16, -0.5];

/** The gun rolls over and falls away, still speeding up as it leaves; the cross-fade from the firing pose is its ease-in. */
export function holsterClip(duration: number): Clip {
  return clip('holster', duration, [[0, 'holster'], [1, 'swap']], (u, f) => {
    f.gun(track(u, [[-0.4, scaled(AWAY, -0.2)], [0, Z], [1, AWAY], [1.5, scaled(AWAY, 1.7)]]));
    f.busy = 1;
  });
}

/** Gun whips up already moving, overshoots high with the muzzle up, drops back and settles; the support hand lands as it peaks. */
export function drawClip(duration: number): Clip {
  return clip('draw', duration, [[0, 'draw'], [0.15, 'cloth']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, [[-0.5, scaled(AWAY, 1.7)], [0, AWAY], [0.56, [-0.006, 0.02, -0.02, 0.1, 0.03, 0.06]], [0.8, [0.001, -0.005, 0.004, -0.02, -0.005, -0.01]], [1, Z]]));
    f.left = hand(u, [[0, g.low!], [0.18, g.low!], [0.62, g.leftRest!]]);
    f.leftFingers = u < 0.62 ? fingers(u, [[0.2, 'relaxed'], [0.62, 'support']]) : null;
    f.busy = 1 - seg(u, 0.5, 1);
  });
}

/** Ease back to the idle pose from wherever the last clip left off (cross-fade does the work). */
export function restClip(duration: number): Clip {
  return clip('rest', duration, [], (u, f) => {
    f.busy = 1 - u;
  });
}

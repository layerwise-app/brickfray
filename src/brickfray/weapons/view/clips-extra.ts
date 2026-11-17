import * as THREE from 'three';
import { hand, track, type Clip, type ClipEvent, type Keys } from './clip';
import { goal, holdQuat, type Goal } from './goals';
import { env, seg } from './springs';

const Z = [0, 0, 0, 0, 0, 0];
const LOWERED = [0.03, -0.22, 0.08, -0.75, -0.25, -0.35];
const DIP = [0.05, -0.09, 0.05, -0.35, -0.25, -0.35];
const GRENADE_DOWN = [0.07, -0.26, 0.06, -0.65, -0.3, -0.3];
type Events = (readonly [number, ClipEvent])[];

function clip(name: string, duration: number, events: Events, sample: Clip['sample'], hold = false): Clip {
  return { name, duration, events: [...events].sort((a, b) => a[0] - b[0]), sample, hold };
}

/** View-space hand goals for the mallet and the grenade (anchored to the view root). */
export function extraGoals(view: THREE.Object3D): Record<string, Goal> {
  return {
    low: goal(view, [-0.24, -0.5, -0.28], holdQuat([0.2, 1, -0.2], [1, 0, -0.3])),
    malletWind: goal(view, [-0.34, -0.1, -0.3], holdQuat([-0.55, 0.45, -0.7], [0.8, 0.1, 0.55])),
    malletHit: goal(view, [-0.06, -0.15, -0.42], holdQuat([0.05, 0.4, -0.92], [1, 0.05, 0.05])),
    malletFollow: goal(view, [0.2, -0.24, -0.36], holdQuat([0.8, 0.25, -0.55], [0.55, -0.1, 0.83])),
    grenadeHold: goal(view, [-0.09, -0.13, -0.4], holdQuat([0.2, 0.9, 0.4], [0.3, 0.2, 0.95])),
    grenadeCocked: goal(view, [-0.15, -0.035, -0.4], holdQuat([0.25, 0.9, 0.35], [0.35, 0.1, -0.93])),
    overWind: goal(view, [-0.2, 0.1, -0.16], holdQuat([0.1, 0.6, 0.8], [0.3, 0.3, -0.9])),
    overRelease: goal(view, [-0.05, 0.06, -0.55], holdQuat([0.1, 0.95, -0.3], [0.1, -0.4, -0.9])),
    overFollow: goal(view, [0.08, -0.38, -0.45], holdQuat([0.3, 0.3, -0.9], [0.1, -0.95, -0.2])),
    underWind: goal(view, [-0.22, -0.34, -0.1], holdQuat([0.2, -0.2, 0.95], [0.2, -0.95, 0.1])),
    underRelease: goal(view, [-0.06, -0.12, -0.55], holdQuat([0.1, 0.3, -0.95], [0.1, 0.9, -0.4])),
    underFollow: goal(view, [-0.04, 0.08, -0.62], holdQuat([0.1, 0.8, -0.6], [0.1, 0.6, -0.8]))
  };
}

export function holsterClip(duration: number): Clip {
  return clip('holster', duration, [[0, 'holster'], [1, 'swap']], (u, f) => {
    f.gun(track(u, [[0, Z], [1, LOWERED]]));
    f.busy = 1;
  });
}

export function drawClip(duration: number): Clip {
  return clip('draw', duration, [[0, 'draw'], [0.15, 'cloth']], (u, f) => {
    f.gun(track(u, [[0, LOWERED], [0.82, [0, 0.004, -0.004, 0.03, 0.01, 0.015]], [1, Z]]));
    f.busy = 1 - seg(u, 0.5, 1);
  });
}

/** Ease back to the idle pose from wherever the last clip left off (cross-fade does the work). */
export function restClip(duration: number): Clip {
  return clip('rest', duration, [], (u, f) => {
    f.busy = 1 - u;
  });
}

/** Gun dips, the left hand hooks the Brick Mallet across from the left. */
export function meleeClip(duration: number): Clip {
  return clip('melee', duration, [[0.06, 'swing'], [0.1, 'cloth']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, [[0, Z], [0.12, DIP], [0.55, DIP], [1, Z]]));
    f.left = hand(u, [[0, g.leftRest!], [0.1, g.malletWind!], [0.13, g.malletWind!], [0.25, g.malletHit!], [0.42, g.malletFollow!], [0.56, g.low!], [0.88, g.leftRest!]]);
    f.show.mallet = u > 0.03 && u < 0.52;
    f.busy = env(u, 0, 0.05, 0.85, 1);
  });
}

/** Gun lowered, bomb up in the left hand, right hand pulls the pin, then the arm cocks back and holds until the throw. */
export function cookClip(): Clip {
  const pin: Keys = [[0.54, Z], [0.65, [0.075, 0.012, 0.02]]];
  return clip('cook', 0.8, [[0.03, 'cloth'], [0.57, 'pinPull']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, [[0, Z], [0.31, GRENADE_DOWN]]));
    f.left = hand(u, [[0, g.leftRest!], [0.16, g.low!], [0.37, g.grenadeHold!], [0.74, g.grenadeHold!], [1, g.grenadeCocked!]]);
    f.right = hand(u, [[0, g.rightRest!], [0.36, g.rightRest!], [0.5, g.ring!], [0.56, g.ring!], [0.67, g.ring!], [0.78, g.rightRest!]]);
    f.part('pin', track(u, pin));
    f.show.grenade = u > 0.09;
    f.show.pin = u < 0.74;
    f.busy = Math.min(1, u * 4);
  }, true);
}

/**
 * Overhand (or underhand when low) throw from the raised arm, then the gun comes back up.
 * The bomb leaves the hand ~0.1 s in, when the host's grenade first shows through the interpolation delay.
 */
export function throwClip(low: boolean): Clip {
  const out = low ? 0.16 : 0.14;
  return clip('throw', 0.75, [[0.02, 'cloth'], [out, 'throw'], [out, 'release']], (u, f, c) => {
    const g = c.goals;
    const [release, follow] = low ? [g.underRelease!, g.underFollow!] : [g.overRelease!, g.overFollow!];
    f.gun(track(u, [[0, GRENADE_DOWN], [0.5, GRENADE_DOWN], [1, Z]]));
    f.left = hand(u, [[0, g.grenadeCocked!], [0.05, g.overWind!], [out, release], [out + 0.18, follow], [out + 0.32, g.low!], [0.88, g.leftRest!]]);
    f.show.grenade = u < out + 0.01;
    f.show.pin = false;
    f.busy = 1 - seg(u, 0.7, 1);
  });
}

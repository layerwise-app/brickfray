import { hand, track, type Clip, type ClipCtx, type Keys } from './clip';
import { clip, jolt, Z, type Events } from './clips-kit';
import { fingers } from './fingers';
import { goal, gripQuat, type Goal } from './goals';
import { env, seg } from './springs';

const STROKE = 0.078;
/** Gun hauled back with the forend, then driven forward with it. */
const PULLED = [0, -0.008, 0.02, 0.06, 0.045, -0.12];
const PUSHED = [0, 0.005, -0.01, -0.028, 0.015, -0.03];
const REBOUND = [0, -0.001, 0.003, 0.008, 0, 0.012];
/** Loading port rolled up toward the left hand; the gun dips between shells and rises to meet each one. */
const LOAD = [-0.08, 0.11, -0.03, 0.26, 0.3, -0.9];
const LOAD_LOW = [-0.07, 0.092, -0.02, 0.2, 0.28, -0.78];
const LOAD_MEET = [-0.086, 0.118, -0.034, 0.29, 0.3, -0.96];

const pouches = new WeakMap<object, Goal>();

/** Where the left hand picks shells, out of frame; fixed in view space so the rolling gun does not drag it around. */
function pouch(c: ClipCtx) {
  let g = pouches.get(c.view);
  if (!g) pouches.set(c.view, (g = goal(c.view, [-0.14, -0.36, -0.34], gripQuat([0.4, -0.8, -0.4], [-0.2, 0.3, -0.9], -1))));
  return g;
}

/** Pump after a shot: haul the forend back to throw the hull, slam it forward. */
export function shotgunPump(duration: number, eject: boolean): Clip {
  const pump: Keys = [[0.1, Z], [0.125, [0, 0, -0.003]], [0.215, [0, 0, STROKE]], [0.25, [0, 0, STROKE]], [0.335, Z]];
  const gun: Keys = [[0, Z], [0.1, [0, -0.001, 0.002, 0.006, 0.004, -0.01]], [0.215, PULLED], [0.345, PUSHED], [0.405, REBOUND], [0.44, Z]];
  const events: Events = [[0.19, 'pumpBack'], [0.325, 'pumpForward']];
  if (eject) events.push([0.215, 'shellEject']);
  return clip('pump', duration, 0.44, events, (t, f) => {
    f.gun(track(t, gun));
    f.gun([0, 0.002, 0.008, 0.03, 0, -0.02], jolt(t - 0.21));
    f.gun([0, -0.003, -0.008, -0.035, 0, 0.02], jolt(t - 0.33));
    f.part('pump', track(t, pump));
    f.busy = env(t, 0, 0.1, 0.34, 0.43) * 0.7;
  });
}

/** Shotgun: roll the port up while the left hand drops for the first shell. Holds. */
export function shotgunLoadIn(duration: number): Clip {
  return clip('loadIn', duration, 0.2, [[0.02, 'cloth']], (t, f, c) => {
    f.gun(track(t, [[0, Z], [0.2, LOAD_LOW]]));
    f.left = hand(t, [[0, c.goals.leftRest!], [0.2, pouch(c)]]);
    f.leftFingers = fingers(t, [[0, 'support'], [0.2, 'pinch']]);
    f.busy = seg(t, 0, 0.1);
  }, true);
}

/** One shell: up from below, thumbed forward into the port, hand already dropping for the next. Holds below. */
export function shotgunShell(duration: number): Clip {
  const gun: Keys = [[0, LOAD_LOW], [0.24, LOAD_MEET], [0.36, LOAD], [0.5, LOAD_LOW]];
  return clip('shell', duration, 0.5, [[0.3, 'shellIn'], [0.3, 'shellLoaded']], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0.004, 0.016, -0.008, 0.05, 0, 0.04], jolt(t - 0.295));
    f.left = hand(t, [[0, pouch(c)], [0.19, g.portNear!], [0.27, g.port!], [0.31, g.portIn!], [0.5, pouch(c)]]);
    f.leftFingers = fingers(t, [[0, 'pinch'], [0.27, 'pinch'], [0.32, 'flat'], [0.42, 'relaxed'], [0.5, 'pinch']]);
    f.show.shell = t < 0.305;
    f.busy = 1;
  }, true);
}

/** Back to the forend; racks it if the reload started empty. */
export function shotgunLoadOut(duration: number, rack: boolean): Clip {
  if (!rack) {
    return clip('loadOut', duration, 0.32, [[0.04, 'cloth']], (t, f, c) => {
      f.gun(track(t, [[0, LOAD_LOW], [0.22, [0.004, -0.006, 0.003, -0.015, -0.01, 0.05]], [0.32, Z]]));
      f.left = hand(t, [[0, pouch(c)], [0.26, c.goals.leftRest!]]);
      if (t < 0.26) f.leftFingers = fingers(t, [[0, 'relaxed'], [0.14, 'open'], [0.26, 'support']]);
      f.busy = 1 - seg(t, 0.08, 0.3);
    });
  }
  const gun: Keys = [[0, LOAD_LOW], [0.3, [-0.01, 0.012, 0, 0.03, 0.05, -0.14]], [0.44, PULLED], [0.6, PUSHED], [0.69, REBOUND], [0.75, Z]];
  const pump: Keys = [[0.31, Z], [0.34, [0, 0, -0.003]], [0.44, [0, 0, STROKE]], [0.49, [0, 0, STROKE]], [0.585, Z]];
  return clip('loadOut', duration, 0.75, [[0.04, 'cloth'], [0.41, 'pumpBack'], [0.575, 'pumpForward']], (t, f, c) => {
    f.gun(track(t, gun));
    f.gun([0, 0.002, 0.008, 0.03, 0, -0.02], jolt(t - 0.435));
    f.gun([0, -0.003, -0.008, -0.035, 0, 0.02], jolt(t - 0.58));
    f.part('pump', track(t, pump));
    f.left = hand(t, [[0, pouch(c)], [0.29, c.goals.leftRest!]]);
    if (t < 0.29) f.leftFingers = fingers(t, [[0, 'relaxed'], [0.16, 'open'], [0.29, 'support']]);
    f.busy = 1 - seg(t, 0.56, 0.74);
  });
}

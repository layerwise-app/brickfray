import { hand, track, type Clip, type ClipCtx, type Keys } from './clip';
import { clip, jolt, regripGun, settleGun, Z, type Events } from './clips-kit';
import { fingers, type FingerPose } from './fingers';
import { goal, gripQuat, type Goal } from './goals';
import { env, seg } from './springs';

const STROKE = 0.078;
/** Gun hauled back with the forend, then driven forward with it. */
const PULLED = [0, -0.008, 0.02, 0.06, 0.045, -0.12];
const PUSHED = [0, 0.005, -0.01, -0.028, 0.015, -0.03];
const REBOUND = [0, -0.001, 0.003, 0.008, 0, 0.012];
/** Loading port rolled up toward the left hand; the gun dips between shells and rises to meet each one. */
const LOAD = [-0.1, 0.1, -0.05, 0.36, 0.55, -0.55];
const LOAD_LOW = [-0.09, 0.085, -0.04, 0.28, 0.52, -0.47];
const LOAD_MEET = [-0.106, 0.108, -0.054, 0.39, 0.55, -0.59];

/** How far a pump stroke takes the gun out of the sights: it is worked in the shoulder, the bead dipping rather than leaving the eye. */
const AIMED_PUMP = 0.06;
/** Share of the stroke's haul and roll the gun still makes when fully aimed. */
const AIMED_HAUL = 0.45;

/**
 * No two shells go in alike: per shell, how high the gun rises to meet it [x, y, z, rx, ry, rz], how long the hand
 * takes to arrive and to push (seconds), and how far the thumb follows the shell in.
 */
const SHELLS = [
  { meet: [0, 0, 0, 0, 0, 0], arrive: 0, push: 0, follow: 0 },
  { meet: [0.006, -0.008, 0.004, -0.04, 0.02, 0.07], arrive: 0.02, push: 0.012, follow: 0.4 },
  { meet: [-0.004, 0.006, -0.004, 0.03, -0.015, -0.05], arrive: -0.018, push: -0.008, follow: 0 },
  { meet: [0.003, -0.004, 0.006, -0.02, 0.03, 0.04], arrive: 0.01, push: 0.02, follow: 1 },
  { meet: [-0.006, 0.004, 0, 0.02, -0.02, -0.08], arrive: -0.01, push: 0, follow: 0.2 },
  { meet: [0.002, -0.01, 0.002, -0.05, 0.01, 0.03], arrive: 0.026, push: 0.01, follow: 0.7 }
] as const;
let shellCount = 0;
/** The thumb straight behind the shell, driving it in, the fingers curled out of its way; then a loose curled hand on the way down. */
const PUSH: FingerPose = { thumb: 0.08, index: 0.5, middle: 0.58, ring: 0.64, pinky: 0.68, spread: 0.08, oppose: -0.25 };
const LOOSE: FingerPose = { thumb: 0.4, index: 0.48, middle: 0.55, ring: 0.6, pinky: 0.64, spread: 0.12, oppose: 0.45 };
/** Beats a shell clip lasts; the gun's sway runs on across shells on it. */
const SHELL = 0.5;

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
  return clip('pump', duration, 0.44, events, (t, f, c) => {
    f.gun(track(t, gun), 1 - (1 - AIMED_HAUL) * c.ads);
    f.gun([0, 0.002, 0.008, 0.03, 0, -0.02], jolt(t - 0.21));
    // The slam's rebound is still ringing when the clip ends; it is let out first, so the gun does not jump.
    f.gun([0, -0.003, -0.008, -0.035, 0, 0.02], jolt(t - 0.33) * (1 - seg(t, 0.38, 0.44)));
    f.part('pump', track(t, pump));
    f.busy = env(t, 0, 0.1, 0.34, 0.43) * AIMED_PUMP;
  });
}

/** Shotgun: roll the port up while the left hand drops for the first shell. Holds. */
export function shotgunLoadIn(duration: number): Clip {
  shellCount = 0;
  return clip('loadIn', duration, 0.2, [[0.02, 'cloth']], (t, f, c) => {
    f.gun(track(t, [[0, Z], [0.2, LOAD_LOW]]));
    f.left = hand(t, [[0, c.goals.leftRest!], [0.2, pouch(c)]]);
    f.leftFingers = fingers(t, [[0, c.tuning.fingers.left], [0.2, 'pinch']]);
    f.busy = seg(t, 0, 0.1);
  }, true);
}

/** One shell: up from below, thumbed forward into the port, hand already dropping for the next. Holds below. */
export function shotgunShell(duration: number): Clip {
  const index = shellCount++;
  const v = SHELLS[index % SHELLS.length]!;
  const add = (base: readonly number[], k: number) => base.map((x, i) => x + v.meet[i]! * k);
  const gun: Keys = [[0, LOAD_LOW], [0.24 + v.arrive * 0.5, add(LOAD_MEET, 1)], [0.36 + v.push, add(LOAD, 0.6)], [0.5, LOAD_LOW]];
  const near = 0.19 + v.arrive;
  const out = 0.31 + v.push + v.follow * 0.035;
  return clip('shell', duration, SHELL, [[0.3, 'shellIn'], [0.3, 'shellLoaded']], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0.004, 0.016, -0.008, 0.05, 0, 0.04], jolt(t - 0.295));
    // While the hand is down for the next shell the gun hand shifts under the weight and takes a fresh grip, done before the shell ends.
    const away = 1 - seg(t, 0.02, near) + seg(t, out + 0.03, SHELL);
    settleGun(f, index * SHELL + t, away * (index === 0 ? seg(t, 0, 0.08) : 1));
    regripGun(f, t, Math.min(out + 0.02, SHELL - 0.16), 0.5 + 0.5 * v.follow, 0.6);
    f.left = hand(t, [[0, pouch(c)], [near, g.portNear!], [0.27, g.port!], [0.31, g.portIn!], [out, g.portIn!], [SHELL, pouch(c)]]);
    f.leftFingers = fingers(t, [[0, 'pinch'], [0.27, 'pinch'], [0.31, PUSH], [out + 0.04, PUSH], [out + 0.12, LOOSE], [SHELL, 'pinch']]);
    f.show.shell = t < 0.305 ? 1 : 0;
    f.busy = 1;
  }, true);
}

/** Back to the forend; racks it if the reload started empty. */
export function shotgunLoadOut(duration: number, rack: boolean): Clip {
  if (!rack) {
    return clip('loadOut', duration, 0.32, [[0.04, 'cloth']], (t, f, c) => {
      f.gun(track(t, [[0, LOAD_LOW], [0.22, [0.004, -0.006, 0.003, -0.015, -0.01, 0.05]], [0.32, Z]]));
      f.left = hand(t, [[0, pouch(c)], [0.26, c.goals.leftRest!]]);
      if (t < 0.26) f.leftFingers = fingers(t, [[0, 'relaxed'], [0.14, 'open'], [0.26, c.tuning.fingers.left]]);
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
    if (t < 0.29) f.leftFingers = fingers(t, [[0, 'relaxed'], [0.16, 'open'], [0.29, c.tuning.fingers.left]]);
    f.busy = 1 - seg(t, 0.56, 0.74);
  });
}

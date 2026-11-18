import { hand, track, type Clip, type Keys } from './clip';
import { clip, jolt, magSwap, Z } from './clips-kit';
import { fingers } from './fingers';
import { env } from './springs';

/** Rolled away from the bolt hand so the handle clears the scope. */
const BOLT_TILT = [-0.1, 0, -0.085, 0.08, 0.14, -0.42];
const BOLT_PULL = [-0.096, 0.007, -0.07, 0.11, 0.13, -0.46];
const BOLT_PUSH = [-0.1, -0.003, -0.094, 0.06, 0.14, -0.38];
const PRESENT = [-0.085, 0.115, -0.02, 0.24, 0.32, -0.78];
const WAIT = [-0.076, 0.1, -0.014, 0.2, 0.3, -0.7];
const SAG = [-0.058, 0.074, 0, 0.12, 0.26, -0.48];
const MEET = [-0.088, 0.12, -0.022, 0.25, 0.32, -0.8];
const DIP = [0.005, -0.012, 0.006, -0.03, -0.02, 0.05];
const OVER = [0.006, -0.008, 0.004, -0.02, -0.012, 0.04];

const LIFT = 1.05;
const THROW = 0.09;
/** Bolt offsets: handle up, starting back, fully back. */
const UP = [0, 0, 0.004, 0, 0, LIFT * 0.96];
const UNLOCKED = [0, 0, 0.022, 0, 0, LIFT];
const BACK = [0, 0, THROW, 0, 0, LIFT];

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

/** Bolt cycle after a shot: lift, haul back to throw the case, drive home, lock down. */
export function sniperCycle(duration: number): Clip {
  const bolt: Keys = [[0.11, Z], [0.17, UP], [0.19, UNLOCKED], [0.265, BACK], [0.29, BACK], [0.365, UNLOCKED], [0.385, UP], [0.44, Z]];
  const gun: Keys = [[0, Z], [0.13, BOLT_TILT], [0.27, BOLT_PULL], [0.39, BOLT_PUSH], [0.5, [-0.02, -0.006, -0.02, 0.01, 0.03, -0.1]], [0.6, Z], [0.64, Z]];
  return clip('bolt', duration, 0.64, [[0.03, 'cloth'], [0.18, 'boltBack'], [0.26, 'eject'], [0.38, 'boltForward']], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0, 0.002, 0.012, 0.03, 0, -0.03], jolt(t - 0.26));
    f.gun([0, -0.003, -0.01, -0.03, 0, 0.04], jolt(t - 0.38));
    f.part('bolt', track(t, bolt));
    f.right = hand(t, [[0, g.rightRest!], [0.015, g.rightRest!], [0.12, g.bolt!], [0.46, g.bolt!], [0.61, g.rightRest!]]);
    if (t > 0.015 && t < 0.61) f.rightFingers = fingers(t, [[0.015, 'trigger'], [0.08, 'open'], [0.13, 'pinch'], [0.45, 'pinch'], [0.52, 'relaxed'], [0.61, 'trigger']]);
    f.busy = env(t, 0, 0.1, 0.48, 0.62);
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
      if (t > 0.12 && t < 2.34) f.leftFingers = fingers(t, [[0.12, 'support'], [0.34, 'open'], [0.58, 'magazine'], [1.86, 'magazine'], [2.08, 'relaxed'], [2.34, 'support']]);
      f.busy = env(t, 0, 0.2, 2.24, 2.52);
    });
  }
  const gun: Keys = [
    [0, Z],
    [0.2, BOLT_TILT],
    [0.42, BOLT_PULL],
    [0.9, PRESENT],
    [1.22, WAIT],
    [1.5, SAG],
    [1.88, MEET],
    [2.26, WAIT],
    [2.56, BOLT_TILT],
    [2.74, BOLT_PUSH],
    [2.96, [-0.02, -0.006, -0.02, 0.01, 0.03, -0.1]],
    [3.12, Z],
    [3.2, Z]
  ];
  const bolt: Keys = [[0.24, Z], [0.31, UP], [0.33, UNLOCKED], [0.42, BACK], [2.6, BACK], [2.7, UNLOCKED], [2.72, UP], [2.79, Z]];
  const mag = swap([0.98, 1.04, 1.14, 1.32, 1.46, 1.6, 1.82, 1.96, 2.0, 2.06]);
  const events = [[0.02, 'cloth'], [0.32, 'boltBack'], [0.41, 'eject'], [1.08, 'magOut'], [2.05, 'magIn'], [2.71, 'boltForward'], [2.9, 'cloth']] as const;
  return clip('sniperReloadEmpty', duration, 3.2, [...events], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0, 0.002, 0.012, 0.03, 0, -0.03], jolt(t - 0.41));
    f.gun([0, -0.003, -0.01, -0.03, 0, 0.04], jolt(t - 2.71));
    mag(t, f, c);
    f.part('bolt', track(t, bolt));
    f.right = hand(t, [[0, g.rightRest!], [0.03, g.rightRest!], [0.23, g.bolt!], [0.46, g.bolt!], [0.74, g.rightRest!], [2.34, g.rightRest!], [2.58, g.bolt!], [2.81, g.bolt!], [3.04, g.rightRest!]]);
    if ((t > 0.03 && t < 0.74) || (t > 2.34 && t < 3.04)) {
      f.rightFingers = fingers(t, [[0.03, 'trigger'], [0.14, 'open'], [0.24, 'pinch'], [0.46, 'pinch'], [0.6, 'relaxed'], [0.74, 'trigger'], [2.34, 'trigger'], [2.46, 'open'], [2.58, 'pinch'], [2.81, 'pinch'], [2.92, 'relaxed'], [3.04, 'trigger']]);
    }
    f.left = hand(t, [[0, g.leftRest!], [0.62, g.leftRest!], [0.92, g.mag!], [2.2, g.mag!], [2.6, g.leftRest!]]);
    if (t > 0.62 && t < 2.6) f.leftFingers = fingers(t, [[0.62, 'support'], [0.78, 'open'], [0.94, 'magazine'], [2.14, 'magazine'], [2.36, 'relaxed'], [2.6, 'support']]);
    f.busy = env(t, 0, 0.16, 2.94, 3.16);
  });
}

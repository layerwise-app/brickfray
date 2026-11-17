import { bump, hand, track, type Clip, type Keys } from './clip';
import { env } from './springs';

const Z = [0, 0, 0, 0, 0, 0];
/** Gun turned across the body, muzzle near the middle of the screen within reach of the left hand. */
const TILT = [0.12, -0.04, 0.12, 0.38, 0.9, -0.2];
/** Spear offsets from its seated pose (gun space, around the muzzle). */
const FETCH = [-0.04, -0.6, 0.12, -0.6, 0.3, 0];
const RISE = [-0.03, -0.08, -0.25, -0.12, 0.1, 0];
const ALIGN = [0, 0, -0.2, 0, 0, 0];
/** Tail fed into the muzzle until the hand meets it; the hand then shifts to the head for the long stroke. */
const HALF = [0, 0, -0.14, 0, 0, 0];

/** Harpooner: fetch a fresh spear, feed its tail into the muzzle and push it home against the air. */
export function harpoonReload(_empty: boolean, duration: number): Clip {
  const gun: Keys = [[0, Z], [0.16, TILT], [0.8, TILT], [1, Z]];
  const spear: Keys = [[0, FETCH], [0.18, FETCH], [0.31, RISE], [0.42, ALIGN], [0.45, ALIGN], [0.52, HALF], [0.58, HALF], [0.69, Z]];
  return {
    name: 'harpoonReload',
    duration,
    events: [[0.02, 'cloth'], [0.2, 'magOut'], [0.48, 'shellIn'], [0.69, 'magIn']],
    sample(u, f, c) {
      const g = c.goals;
      f.gun(track(u, gun));
      f.gun([0.003, 0.004, 0.006, 0.02, 0, 0], bump(u, 0.49, 0.03));
      f.gun([0.004, 0, 0.01, -0.02, 0, 0], bump(u, 0.63, 0.05));
      f.gun([0.006, -0.004, 0.014, -0.04, 0, 0], bump(u, 0.69, 0.025));
      f.part('spear', track(u, spear));
      f.left = hand(u, [[0, g.leftRest!], [0.17, g.spear!], [0.52, g.spear!], [0.58, g.spearHead!], [0.7, g.spearHead!], [0.86, g.leftRest!]]);
      f.busy = env(u, 0, 0.08, 0.9, 1);
    }
  };
}

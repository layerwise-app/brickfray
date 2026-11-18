import { hand, track, type Clip, type Keys } from './clip';
import { carry, clip, jolt, viewGoal, viewOf, Z } from './clips-kit';
import { fingers } from './fingers';
import type { Goal } from './goals';
import { env, seg } from './springs';

/** Gun turned across the body, muzzle near the middle of the screen within reach of the left hand. */
const TILT = [0.12, -0.04, 0.12, 0.38, 0.9, -0.2];
const MEET = [0.1, -0.03, 0.1, 0.42, 0.96, -0.26];
/** Shoved back by the push against the air. */
const PUSHED = [0.145, -0.05, 0.15, 0.33, 0.82, -0.14];
const DIP = [-0.004, -0.008, -0.004, -0.02, -0.03, 0.03];
const OVER = [-0.004, -0.004, -0.004, -0.015, -0.02, 0.02];
/** Spear offsets from its seated pose along the bore: nearing the muzzle, tail at the muzzle, fed in to the hand, hand shifted to the head. */
const APPROACH = [-0.016, -0.03, -0.25, -0.12, 0.1, 0];
const ALIGN = [0, 0, -0.2, 0, 0, 0];
const HALF = [0, 0, -0.14, 0, 0, 0];
const REGRIP = [0, 0, -0.132, 0, 0, 0];
/** The spear in the hand, in view space: out of frame at the quiver, then swinging up toward the muzzle. */
const QUIVER = [-0.2, -0.52, -0.3, 1.2, 0.7, -0.3];
const RISE = [-0.27, -0.26, -0.43, 0.8, 0.88, -0.3];

/** Harpooner: fetch a fresh spear, feed its tail into the muzzle and push it home against the air. */
export function harpoonReload(_empty: boolean, duration: number): Clip {
  const gun: Keys = [[0, Z], [0.05, DIP], [0.3, TILT], [0.45, MEET], [0.66, PUSHED], [0.77, [0.05, -0.016, 0.05, 0.14, 0.34, -0.08]], [0.88, OVER], [0.95, Z]];
  const spear: Keys = [[0.41, APPROACH], [0.47, ALIGN], [0.53, HALF], [0.585, REGRIP], [0.68, Z]];
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('harpoonReload', duration, 0.95, [[0.02, 'cloth'], [0.17, 'magOut'], [0.47, 'shellIn'], [0.68, 'magIn']], (t, f, c) => {
    const g = c.goals;
    const seat = g.spearSeat!;
    const hold = g.spear!.node;
    if (!path) {
      path = [[0, QUIVER], [0.16, QUIVER], [0.3, RISE], [0.41, viewOf(c, MEET, seat, hold, APPROACH)], [0.47, viewOf(c, MEET, seat, hold, ALIGN)]];
      fetch = viewGoal(c, QUIVER, g.spear!);
    }
    f.gun(track(t, gun));
    f.gun([0.004, 0.003, 0.008, 0.02, -0.01, 0], jolt(t - 0.465));
    f.gun([0.006, -0.004, 0.012, -0.04, -0.02, 0], jolt(t - 0.675));
    carry(f, c, 'spear', seat, hold, track(t, spear), track(t, path), 1 - seg(t, 0.37, 0.46));
    f.left = hand(t, [[0, g.leftRest!], [0.03, g.leftRest!], [0.16, fetch!], [0.1601, g.spear!], [0.53, g.spear!], [0.585, g.spearHead!], [0.7, g.spearHead!], [0.9, g.leftRest!]]);
    if (t > 0.03 && t < 0.9) f.leftFingers = fingers(t, [[0.03, 'support'], [0.1, 'open'], [0.17, 'handle'], [0.52, 'handle'], [0.56, 'relaxed'], [0.6, 'handle'], [0.7, 'handle'], [0.78, 'open'], [0.9, 'support']]);
    f.busy = env(t, 0, 0.1, 0.78, 0.93);
  });
}

import { hand, track, type Clip, type Keys } from './clip';
import { carry, clip, jolt, viewGoal, viewOf, Z } from './clips-kit';
import { scaled } from './clips-extra';
import { fingers } from './fingers';
import type { Goal } from './goals';
import { env, seg } from './springs';

/** Gun turned across the body, muzzle near the middle of the screen within reach of the left hand. */
const TILT = [0.12, -0.04, 0.12, 0.38, 0.9, -0.2];
const MEET = [0.1, -0.03, 0.1, 0.42, 0.96, -0.26];
/** Shoved back by the push against the air. */
const PUSHED = [0.145, -0.05, 0.15, 0.33, 0.82, -0.14];
const OVER = [-0.004, -0.004, -0.004, -0.015, -0.02, 0.02];
/** Spear offsets from its seated pose along the bore: nearing the muzzle, tail at the muzzle, fed in to the hand, hand shifted to the head. */
const APPROACH = [-0.016, -0.03, -0.25, -0.12, 0.1, 0];
const ALIGN = [0, 0, -0.2, 0, 0, 0];
const HALF = [0, 0, -0.14, 0, 0, 0];
const REGRIP = [0, 0, -0.132, 0, 0, 0];
/** The spear in the hand, in view space: out of frame at the quiver, then swinging up toward the muzzle. */
const QUIVER = [-0.2, -0.52, -0.3, 1.2, 0.7, -0.3];
const RISE = [-0.27, -0.26, -0.43, 0.8, 0.88, -0.3];

/** Seconds the gun is left alone after the shot, so its recoil reads (and an aimed shot stays in the sights) before the reload takes it. */
const RECOIL = 0.12;
/** Beats in seconds: hand at the quiver, spear's tail at the muzzle, spear home, hand back on the forend. */
const FETCH = 0.32;
const SEAT = 0.62;
const HOME = 0.9;
const BACK = 1.12;
/** The sim's reload, and the beats this clip runs: it ends a moment after the spear is in, as the gun settles. */
const RELOAD = 0.95;
const BEATS = 1.2;

/**
 * Harpooner: the shot's recoil plays out, then the gun swings across while the left hand fetches a fresh spear from
 * the quiver, feeds its tail into the muzzle and pushes it home against the air.
 */
export function harpoonReload(_empty: boolean, duration: number): Clip {
  // Out of the recoil the gun starts straight for the turn, so an aimed shot leaves the sights once instead of dipping back through them.
  const gun: Keys = [[0, Z], [RECOIL, Z], [RECOIL + 0.06, scaled(TILT, 0.12)], [0.42, TILT], [SEAT - 0.03, MEET], [HOME - 0.02, PUSHED], [1.0, [0.05, -0.016, 0.05, 0.14, 0.34, -0.08]], [1.1, OVER], [1.17, Z]];
  const spear: Keys = [[SEAT - 0.07, APPROACH], [SEAT, ALIGN], [SEAT + 0.07, HALF], [SEAT + 0.14, REGRIP], [HOME, Z]];
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('harpoonReload', (duration * BEATS) / RELOAD, BEATS, [[RECOIL + 0.01, 'cloth'], [FETCH, 'magOut'], [SEAT, 'shellIn'], [HOME, 'magIn']], (t, f, c) => {
    const g = c.goals;
    const seat = g.spearSeat!;
    const hold = g.spear!.node;
    if (!path) {
      path = [[FETCH, QUIVER], [FETCH + 0.14, RISE], [SEAT - 0.07, viewOf(c, MEET, seat, hold, APPROACH)], [SEAT, viewOf(c, MEET, seat, hold, ALIGN)]];
      fetch = viewGoal(c, QUIVER, g.spear!);
    }
    f.gun(track(t, gun));
    f.gun([0.004, 0.003, 0.008, 0.02, -0.01, 0], jolt(t - SEAT + 0.005));
    f.gun([0.006, -0.004, 0.012, -0.04, -0.02, 0], jolt(t - HOME + 0.005));
    // The spear exists only from the quiver on: until the hand is down there the barrel stays empty.
    if (t >= FETCH) carry(f, c, 'spear', seat, hold, track(t, spear), track(t, path), 1 - seg(t, SEAT - 0.1, SEAT - 0.01));
    f.left = hand(t, [[0, g.leftRest!], [RECOIL, g.leftRest!], [FETCH, fetch!], [FETCH + 1e-4, g.spear!], [SEAT + 0.07, g.spear!], [SEAT + 0.14, g.spearHead!], [HOME + 0.02, g.spearHead!], [BACK, g.leftRest!]]);
    if (t > RECOIL && t < BACK) {
      f.leftFingers = fingers(t, [[RECOIL, c.tuning.fingers.left], [RECOIL + 0.08, 'open'], [FETCH, 'handle'], [SEAT + 0.05, 'handle'], [SEAT + 0.1, 'relaxed'], [SEAT + 0.15, 'handle'], [HOME + 0.02, 'handle'], [HOME + 0.1, 'open'], [BACK, c.tuning.fingers.left]]);
    }
    f.busy = env(t, RECOIL, RECOIL + 0.18, 1.0, 1.15);
  });
}

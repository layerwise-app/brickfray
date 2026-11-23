import { hand, track, type Clip, type Keys } from './clip';
import { SLIDE_LOCK } from './clips-pistol';
import { carry, clip, jolt, magSwap, settleGun, viewGoal, viewOf, Z } from './clips-kit';
import { fingers } from './fingers';
import type { Goal } from './goals';
import { env, seg } from './springs';

/** Laid over on its left side across the body, muzzle a little up: the long magazine sticks out toward the off hand. */
const LAY = [-0.075, 0.075, -0.03, 0.14, 0.24, -1.3];
const HOLD = [-0.068, 0.066, -0.026, 0.1, 0.22, -1.22];
const SAG = [-0.04, 0.04, -0.012, 0.04, 0.16, -0.95];
const MEET = [-0.08, 0.08, -0.034, 0.16, 0.25, -1.36];
/** Rolling back upright after the heel slap. */
const ROLL = [-0.03, 0.035, -0.012, 0.06, 0.1, -0.35];
const OVER = [0.004, -0.006, 0.004, -0.02, -0.01, 0.06];
const DIP = [0.004, -0.012, 0.006, -0.05, -0.02, 0.06];
/** The empty one: raised and snapped down rolled to the left, so the spent magazine drops free past the off hand. */
const FLING = [-0.035, 0.075, -0.02, -0.14, 0.12, -0.85];
const RECOVER = [-0.02, 0.03, -0.01, 0.0, 0.1, -0.4];
/** Raised with the support hand back on the foregrip, thumb on the slide stop. */
const READY = [-0.012, 0.022, -0.006, 0.06, 0.03, -0.08];
const PAST = [0.003, -0.006, 0.003, -0.03, -0.02, 0.04];
const REBOUND = [0.001, 0.002, 0.001, 0.008, 0.006, -0.01];

/** Magazine offsets along the grip's well: the long box needs a long pull before it clears. */
const TUG = [0, -0.01, 0.002, 0, 0, 0];
const CLEAR = [0, -0.15, 0.026, 0.06, 0, 0];
const UNDER = [-0.006, -0.19, 0.034, 0.12, 0, 0.08];
const MOUTH = [0, -0.065, 0.011, 0.02, 0, 0];
/** Carried away to the left and down past the frame's corner, to the belt, and back up. */
const LEAVE = [-0.22, -0.3, -0.34, 0.6, 0.6, -1.4];
const POUCH = [-0.24, -0.46, -0.22, 1.0, 0.3, -1.25];
const BACK = [-0.15, -0.32, -0.36, 0.7, 0.45, -1.3];

/**
 * Buzzer reload: the machine pistol is laid on its side across the body so its long magazine points at the off hand,
 * which pulls it out sideways, swaps it at the belt and drives the fresh one home with a heel slap before the gun rolls
 * upright. Empty: the spent magazine is flung out with a flick of the gun hand while the other hand is already on the
 * way to the belt, and with both hands back on the gun the thumb drops the locked slide.
 */
export function buzzerReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.08, DIP], [0.26, LAY], [0.46, HOLD], [0.66, SAG], [0.92, MEET], [1.08, HOLD], [1.24, ROLL], [1.38, OVER], [1.47, Z], [1.5, Z]];
    const mag = magSwap({
      present: LAY,
      meet: MEET,
      tug: TUG,
      clear: CLEAR,
      under: UNDER,
      mouth: MOUTH,
      leave: LEAVE,
      pouch: POUCH,
      back: BACK,
      at: [0.26, 0.29, 0.4, 0.52, 0.63, 0.76, 0.9, 1.0, 1.025, 1.05],
      rip: [-0.012, 0.004, 0, 0.0, 0.02, -0.08],
      slam: [0.016, 0.006, 0, 0.03, -0.02, 0.12]
    });
    return clip('buzzerReload', duration, 1.5, [[0.02, 'cloth'], [0.32, 'magOut'], [1.04, 'magIn'], [1.2, 'cloth']], (t, f, c) => {
      const g = c.goals;
      f.gun(track(t, gun));
      mag(t, f, c);
      f.left = hand(t, [[0, g.leftRest!], [0.06, g.leftRest!], [0.25, g.mag!], [1.06, g.mag!], [1.34, g.leftRest!]]);
      if (t > 0.06 && t < 1.34) f.leftFingers = fingers(t, [[0.06, c.tuning.fingers.left], [0.16, 'open'], [0.26, 'magazine'], [0.98, 'magazine'], [1.02, 'flat'], [1.08, 'flat'], [1.2, 'relaxed'], [1.34, c.tuning.fingers.left]]);
      f.busy = env(t, 0, 0.14, 1.3, 1.48);
    });
  }
  const gun: Keys = [[0, Z], [0.05, DIP], [0.17, FLING], [0.32, RECOVER], [0.48, LAY], [0.64, SAG], [0.9, MEET], [1.0, MEET], [1.06, HOLD], [1.2, ROLL], [1.32, READY], [1.38, READY], [1.5, PAST], [1.62, REBOUND], [1.72, Z], [1.8, Z]];
  const local: Keys = [[0.1, Z], [0.13, TUG], [0.18, CLEAR], [0.8, UNDER], [0.9, MOUTH], [0.93, [0, -0.056, 0.009, 0.017, 0, 0]], [0.96, Z]];
  const slide: Keys = [[0, [0, 0, SLIDE_LOCK]], [1.38, [0, 0, SLIDE_LOCK]], [1.405, Z]];
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('buzzerReloadEmpty', duration, 1.8, [[0.02, 'cloth'], [0.12, 'magOut'], [0.955, 'magIn'], [1.395, 'slideForward'], [1.5, 'cloth']], (t, f, c) => {
    const g = c.goals;
    const seat = g.magazineSeat!;
    const hold = g.mag!.node;
    if (!path) {
      const out = viewOf(c, FLING, seat, hold, CLEAR);
      path = [
        [0.13, viewOf(c, FLING, seat, hold, TUG)],
        [0.18, out],
        // Thrown clear: on out of the well down to the left, tumbling, until it drops past the frame's edge.
        [0.25, [out[0]! - 0.05, out[1]! - 0.05, out[2]! + 0.005, out[3]! + 0.4, out[4]! + 0.2, out[5]! - 0.5]],
        [0.33, [out[0]! - 0.09, out[1]! - 0.22, out[2]! + 0.01, out[3]! + 1.1, out[4]! + 0.4, out[5]! - 1.2]],
        [0.41, [out[0]! - 0.12, out[1]! - 0.52, out[2]! + 0.02, out[3]! + 1.9, out[4]! + 0.6, out[5]! - 1.9]],
        [0.4101, POUCH],
        [0.5, POUCH],
        [0.64, BACK],
        [0.8, viewOf(c, MEET, seat, hold, UNDER)],
        [0.9, viewOf(c, MEET, seat, hold, MOUTH)]
      ];
      fetch = viewGoal(c, POUCH, g.mag!);
    }
    f.gun(track(t, gun));
    f.gun([0.016, 0.006, 0, 0.03, -0.02, 0.12], jolt(t - 0.95));
    // The slide slams home off its stop: the gun bucks forward and up in the hands.
    f.gun([0, 0.005, -0.014, 0.07, 0, 0], jolt(t - 1.395));
    settleGun(f, t - 0.2, env(t, 0.2, 0.3, 0.64, 0.8));
    carry(f, c, 'magazine', seat, hold, track(t, local), track(t, path), seg(t, 0.13, 0.18) * (1 - seg(t, 0.84, 0.92)));
    f.part('slide', track(t, slide));
    f.left = hand(t, [[0, g.leftRest!], [0.04, g.leftRest!], [0.3, fetch!], [0.5, fetch!], [0.5001, g.mag!], [0.98, g.mag!], [1.28, g.leftRest!]]);
    if (t > 0.04 && t < 1.28) {
      const rest = c.tuning.fingers.left;
      f.leftFingers = fingers(t, [[0.04, rest], [0.16, 'relaxed'], [0.46, 'magazine'], [0.9, 'magazine'], [0.94, 'flat'], [1.0, 'flat'], [1.12, 'relaxed'], [1.28, rest]]);
    }
    f.busy = env(t, 0, 0.12, 1.6, 1.78);
  });
}

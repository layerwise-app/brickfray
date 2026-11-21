import { hand, track, type Clip, type Keys } from './clip';
import { carry, clip, jolt, magSwap, viewGoal, viewOf, Z } from './clips-kit';
import { fingers, FINGERS, type FingerPose } from './fingers';
import type { Goal } from './goals';
import { env, seg } from './springs';

export const SLIDE_LOCK = 0.03;
/** Clamped over the slide: four fingertips hooked on the far serrations, the thumb pressed on the near ones. */
const CLAMP: FingerPose = { ...FINGERS.support, thumb: 0.7, oppose: 0.45, hook: 0.3, index: 0.74, middle: 0.76, ring: 0.8, pinky: 0.8, spread: 0 };
const SLIDE_PULL = SLIDE_LOCK + 0.006;

/** Muzzle up, butt of the grip turned in toward the left hand. */
const PRESENT = [-0.06, 0.13, -0.06, 0.5, 0.25, -0.75];
const WAIT = [-0.052, 0.112, -0.05, 0.42, 0.24, -0.64];
const SAG = [-0.03, 0.074, -0.028, 0.24, 0.18, -0.36];
const MEET = [-0.064, 0.134, -0.062, 0.52, 0.25, -0.78];
/** Thumbing the release: a short flick that helps the empty mag out. */
const FLICK = [-0.03, 0.11, -0.03, 0.42, 0.1, -0.35];
const RECOVER = [-0.04, 0.085, -0.045, 0.34, 0.2, -0.55];
/** Turning over after the seat, on the way to the rack. */
const TURN = [-0.08, 0.12, -0.05, 0.45, 0.5, 0.25];
/** Turned broadside across the chest, so the eye reads the slide in profile and the hand takes its rear from the top without hiding it. */
const RACK = [-0.1, 0.1, -0.04, 0.3, 0.85, 1.05];
/** Punched forward out of the hand that holds the slide, then drawn back as it lets go. */
const RACKED = [-0.117, 0.107, -0.052, 0.32, 0.87, 1.07];
const RACK_OUT = [-0.05, 0.05, -0.015, 0.15, 0.3, 0.2];
const DIP = [0.004, -0.01, 0.006, -0.04, -0.02, 0.05];
const OVER = [0.004, -0.006, 0.004, -0.03, -0.01, 0.04];

/** Magazine offsets along the raked grip. */
const TUG = [0, -0.008, 0.001, 0, 0, 0];
const CLEAR = [0, -0.11, 0.017, 0.05, 0, 0];
const UNDER = [-0.004, -0.15, 0.022, 0.1, 0, 0.08];
const MOUTH = [0, -0.05, 0.008, 0.02, 0, 0];
const LEAVE = [-0.12, -0.33, -0.36, 0.8, 0.3, -1.0];
const POUCH = [-0.22, -0.45, -0.24, 1.0, 0.3, -1.2];
const BACK = [-0.1, -0.32, -0.38, 0.7, 0.3, -0.95];

/** Sidearm reload. Tactical: the hand strips the mag and swaps it. Empty: the mag drops free while the hand fetches, then the slide is racked off its lock. */
export function pistolReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.07, DIP], [0.27, PRESENT], [0.48, WAIT], [0.68, SAG], [0.92, MEET], [1.08, WAIT], [1.25, OVER], [1.36, Z], [1.4, Z]];
    const mag = magSwap({
      present: PRESENT,
      meet: MEET,
      tug: TUG,
      clear: CLEAR,
      under: UNDER,
      mouth: MOUTH,
      leave: LEAVE,
      pouch: POUCH,
      back: BACK,
      at: [0.28, 0.31, 0.38, 0.5, 0.61, 0.73, 0.86, 0.95, 0.975, 1.01],
      rip: [-0.004, -0.012, 0, -0.04, 0, -0.04],
      slam: [0.004, 0.016, 0, 0.07, 0, 0.04]
    });
    return clip('pistolReload', duration, 1.4, [[0.02, 'cloth'], [0.34, 'magOut'], [1.0, 'magIn'], [1.14, 'cloth']], (t, f, c) => {
      const g = c.goals;
      f.gun(track(t, gun));
      mag(t, f, c);
      f.left = hand(t, [[0, g.leftRest!], [0.05, g.leftRest!], [0.25, g.mag!], [1.07, g.mag!], [1.3, g.leftRest!]]);
      if (t > 0.05 && t < 1.3) f.leftFingers = fingers(t, [[0.05, c.tuning.fingers.left], [0.16, 'open'], [0.27, 'magazine'], [1.04, 'magazine'], [1.16, 'relaxed'], [1.3, c.tuning.fingers.left]]);
      f.busy = env(t, 0, 0.14, 1.2, 1.38);
    });
  }
  const gun: Keys = [[0, Z], [0.06, DIP], [0.19, FLICK], [0.34, RECOVER], [0.52, PRESENT], [0.7, MEET], [0.9, TURN], [1.12, RACK], [1.225, RACKED], [1.37, RACK_OUT], [1.57, OVER], [1.67, Z], [1.7, Z]];
  const local: Keys = [[0.14, Z], [0.2, [0, -0.03, 0.005]], [0.27, CLEAR], [0.64, UNDER], [0.72, MOUTH], [0.745, [0, -0.043, 0.007, 0.02, 0, 0]], [0.78, Z]];
  const slide: Keys = [[1.14, [0, 0, SLIDE_LOCK]], [1.21, [0, 0, SLIDE_PULL]], [1.24, [0, 0, SLIDE_PULL]], [1.265, Z]];
  let path: Keys | null = null;
  let fetch: Goal | null = null;
  return clip('pistolReloadEmpty', duration, 1.7, [[0.02, 'cloth'], [0.15, 'magOut'], [0.775, 'magIn'], [1.19, 'slideBack'], [1.26, 'slideForward'], [1.42, 'cloth']], (t, f, c) => {
    const g = c.goals;
    const seat = g.magazineSeat!;
    const hold = g.mag!.node;
    if (!path) {
      const out = viewOf(c, FLICK, seat, hold, CLEAR);
      path = [
        [0.2, viewOf(c, FLICK, seat, hold, [0, -0.03, 0.005])],
        [0.27, out],
        [0.34, [out[0]! - 0.02, out[1]! - 0.2, out[2]! + 0.01, out[3]! + 0.4, out[4]!, out[5]! - 0.2]],
        [0.41, [out[0]! - 0.04, out[1]! - 0.56, out[2]! + 0.02, out[3]! + 1, out[4]!, out[5]! - 0.5]],
        [0.4101, POUCH],
        [0.44, POUCH],
        [0.54, BACK],
        [0.64, viewOf(c, MEET, seat, hold, UNDER)],
        [0.72, viewOf(c, MEET, seat, hold, MOUTH)]
      ];
      fetch = viewGoal(c, POUCH, g.mag!);
    }
    f.gun(track(t, gun));
    f.gun([0.004, 0.016, 0, 0.07, 0, 0.04], jolt(t - 0.77));
    f.gun([0, 0.004, 0.012, 0.06, 0, 0], jolt(t - 1.2));
    f.gun([0, -0.004, -0.014, -0.07, 0, 0], jolt(t - 1.26));
    carry(f, c, 'magazine', seat, hold, track(t, local), track(t, path), seg(t, 0.2, 0.28) * (1 - seg(t, 0.57, 0.66)));
    f.part('slide', track(t, slide));
    f.left = hand(t, [
      [0, g.leftRest!],
      [0.05, g.leftRest!],
      [0.34, fetch!],
      [0.42, fetch!],
      [0.4201, g.mag!],
      [0.86, g.mag!],
      [1.12, g.slide!],
      [1.24, g.slide!],
      [1.2401, g.slideBack!],
      [1.31, g.slideBack!],
      [1.45, g.leftOff!],
      [1.6, g.leftRest!]
    ]);
    if (t > 0.05 && t < 1.58) {
      const rest = c.tuning.fingers.left;
      f.leftFingers = fingers(t, [[0.05, rest], [0.2, 'relaxed'], [0.4, 'magazine'], [0.83, 'magazine'], [0.98, 'relaxed'], [1.11, CLAMP], [1.25, CLAMP], [1.4, 'relaxed'], [1.58, rest]]);
    }
    f.busy = env(t, 0, 0.14, 1.5, 1.68);
  });
}

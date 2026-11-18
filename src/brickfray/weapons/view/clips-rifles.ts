import { hand, track, type Clip, type Keys } from './clip';
import { clip, jolt, magSwap, Z } from './clips-kit';
import { fingers } from './fingers';
import { env } from './springs';

/** Magwell rolled up and in toward the left hand. */
const PRESENT = [-0.09, 0.12, -0.02, 0.26, 0.34, -0.8];
/** The gun easing while the hand is away: first held, then sagging, so it never freezes. */
const WAIT = [-0.08, 0.105, -0.015, 0.21, 0.32, -0.72];
const SAG = [-0.06, 0.075, 0, 0.13, 0.27, -0.48];
const MEET = [-0.092, 0.126, -0.022, 0.27, 0.34, -0.82];
/** Rear of the receiver brought to the middle for the charging handle. */
const CHARGE = [-0.17, -0.01, -0.17, -0.06, 0.3, 0.08];
const DIP = [0.005, -0.012, 0.006, -0.03, -0.02, 0.06];
const OVER = [0.006, -0.008, 0.004, -0.02, -0.012, 0.05];

const BOLT = 0.068;

/** The magazine change both reloads share, `s` scaling its pace. */
const swap = (s: number) =>
  magSwap({
    present: PRESENT,
    meet: MEET,
    tug: [0, -0.01, 0, 0.02, 0, 0],
    clear: [0, -0.1, -0.012, 0.08, 0, 0],
    under: [-0.006, -0.16, -0.02, 0.16, 0, 0.1],
    mouth: [0, -0.055, -0.008, 0.04, 0, 0],
    leave: [-0.17, -0.34, -0.4, 0.6, 0.3, -1.05],
    pouch: [-0.25, -0.47, -0.26, 0.9, 0.3, -1.2],
    back: [-0.15, -0.33, -0.42, 0.5, 0.32, -1.0],
    at: [0.4 * s, 0.44 * s, 0.52 * s, 0.66 * s, 0.77 * s, 0.89 * s, 1.08 * s, 1.2 * s, 1.24 * s, 1.285 * s],
    rip: [-0.006, -0.014, 0, -0.03, 0, -0.05],
    slam: [0.004, 0.016, 0, 0.05, 0, 0.04]
  });

/** Rifle reload: roll to present the well, rip the mag out and away, bring a fresh one up and slam it home; empty adds the charging handle. */
export function arReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.09, DIP], [0.36, PRESENT], [0.6, WAIT], [0.84, SAG], [1.16, MEET], [1.4, WAIT], [1.68, OVER], [1.84, Z], [1.9, Z]];
    const mag = swap(1);
    return clip('arReload', duration, 1.9, [[0.02, 'cloth'], [0.46, 'magOut'], [1.28, 'magIn'], [1.5, 'cloth']], (t, f, c) => {
      const g = c.goals;
      f.gun(track(t, gun));
      mag(t, f, c);
      f.left = hand(t, [[0, g.leftRest!], [0.07, g.leftRest!], [0.36, g.mag!], [1.38, g.mag!], [1.7, g.leftRest!]]);
      if (t > 0.07 && t < 1.7) f.leftFingers = fingers(t, [[0.07, 'support'], [0.22, 'open'], [0.38, 'magazine'], [1.34, 'magazine'], [1.5, 'relaxed'], [1.7, 'support']]);
      f.busy = env(t, 0, 0.16, 1.62, 1.86);
    });
  }
  const s = 0.96;
  const gun: Keys = [[0, Z], [0.08, DIP], [0.34, PRESENT], [0.58, WAIT], [0.8, SAG], [1.11, MEET], [1.3, WAIT], [1.58, CHARGE], [1.8, CHARGE], [2.14, OVER], [2.32, Z], [2.4, Z]];
  const bolt: Keys = [[1.6, Z], [1.63, [0, 0, -0.003]], [1.7, [0, 0, BOLT]], [1.735, [0, 0, BOLT]], [1.765, Z]];
  const mag = swap(s);
  return clip('arReloadEmpty', duration, 2.4, [[0.02, 'cloth'], [0.46 * s, 'magOut'], [1.28 * s, 'magIn'], [1.67, 'boltBack'], [1.76, 'boltForward'], [1.95, 'cloth']], (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0, 0.004, 0.014, 0.04, 0, 0], jolt(t - 1.69));
    f.gun([0, -0.004, -0.012, -0.05, 0, 0], jolt(t - 1.76));
    mag(t, f, c);
    f.part('bolt', track(t, bolt));
    f.left = hand(t, [[0, g.leftRest!], [0.07, g.leftRest!], [0.34, g.mag!], [1.29, g.mag!], [1.58, g.charge!], [1.735, g.charge!], [1.7351, g.chargeBack!], [1.8, g.chargeBack!], [2.16, g.leftRest!]]);
    if (t > 0.07 && t < 2.16) {
      f.leftFingers = fingers(t, [[0.07, 'support'], [0.2, 'open'], [0.36, 'magazine'], [1.28, 'magazine'], [1.42, 'relaxed'], [1.58, 'pinch'], [1.74, 'pinch'], [1.82, 'open'], [2.16, 'support']]);
    }
    f.busy = env(t, 0, 0.16, 2.1, 2.34);
  });
}

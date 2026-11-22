import * as THREE from 'three';
import type { WeaponId } from '../defs';
import { hand, track, type Clip, type Keys } from './clip';
import { clip, jolt, magSwap, Z, type Events } from './clips-kit';
import { SLIDE_LOCK } from './clips-pistol';
import { fingers, type FingerShape } from './fingers';
import type { Goal } from './goals';
import { env } from './springs';

/** How a rifle is held while its magazine is changed: presented to the left hand, eased (held, then sagging) while the hand is away, and met as the fresh one comes up. */
interface Stance {
  present: readonly number[];
  wait: readonly number[];
  sag: readonly number[];
  meet: readonly number[];
}
const STANCE: Record<Feed, Stance> = {
  // Box magazine: the magwell rolled up and in toward the left hand.
  box: { present: [-0.09, 0.12, -0.02, 0.26, 0.34, -0.8], wait: [-0.08, 0.105, -0.015, 0.21, 0.32, -0.72], sag: [-0.06, 0.075, 0, 0.13, 0.27, -0.48], meet: [-0.092, 0.126, -0.022, 0.27, 0.34, -0.82] },
  // Nail strip: muzzle tipped down and swung in, hardly rolled, so the raked strip slides out down its rake past the drum.
  strip: { present: [-0.07, 0.08, -0.03, -0.14, 0.5, -0.36], wait: [-0.062, 0.07, -0.026, -0.11, 0.46, -0.32], sag: [-0.045, 0.05, -0.015, -0.06, 0.36, -0.22], meet: [-0.072, 0.083, -0.032, -0.15, 0.52, -0.38] },
  // Energy cell: lifted muzzle-high and turned broadside, the cell port facing the eye, for the twist.
  cell: { present: [-0.1, 0.105, 0.01, 0.4, 0.6, -0.22], wait: [-0.09, 0.095, 0.012, 0.35, 0.56, -0.2], sag: [-0.065, 0.07, 0.01, 0.24, 0.45, -0.14], meet: [-0.102, 0.108, 0.01, 0.41, 0.61, -0.23] }
};
/** A magazine brought back after a cut-off reload: the rifle only canted toward the hand. */
const TILT = [-0.045, 0.05, -0.01, 0.12, 0.16, -0.4];
/** Rear of the receiver brought up toward the middle and canted over to the left hand, the handle on top facing it. */
const CHARGE = [-0.04, 0.07, -0.11, 0.3, 0.1, 0.15];
const DIP = [0.005, -0.012, 0.006, -0.03, -0.02, 0.06];
const OVER = [0.006, -0.008, 0.004, -0.02, -0.012, 0.05];

const BOLT = 0.068;

export type Feed = 'box' | 'strip' | 'cell';
const FEED: Partial<Record<WeaponId, Feed>> = { nailer: 'strip', pulse: 'cell' };
/** Magazine offsets in the well's frame per feed: a box mag drops straight, the raked nail strip slides out down and forward along its rake. */
const PATH: Record<Feed, { tug: number[]; clear: number[]; under: number[]; mouth: number[] }> = {
  box: { tug: [0, -0.01, 0, 0.02, 0, 0], clear: [0, -0.1, -0.012, 0.08, 0, 0], under: [-0.006, -0.16, -0.02, 0.16, 0, 0.1], mouth: [0, -0.055, -0.008, 0.04, 0, 0] },
  strip: { tug: [0, -0.012, -0.004, 0.03, 0, 0], clear: [0, -0.095, -0.034, 0.14, 0, 0], under: [-0.006, -0.155, -0.045, 0.2, 0, 0.1], mouth: [0, -0.055, -0.02, 0.06, 0, 0] },
  cell: { tug: [0, -0.008, 0, 0.01, 0, 0], clear: [0, -0.1, -0.008, 0.06, 0, 0], under: [-0.006, -0.16, -0.016, 0.12, 0, 0.08], mouth: [0, -0.05, -0.006, 0.03, 0, 0] }
};
/** The energy cell goes in turned a quarter and is twisted shut; the nail strip is slapped up into the feed after it seats. */
const CELL_TWIST = 0.9;
const TAP = 0.05;

const LEAVE = [-0.17, -0.34, -0.4, 0.6, 0.3, -1.05];
const POUCH = [-0.25, -0.47, -0.26, 0.9, 0.3, -1.2];
const BACK = [-0.15, -0.33, -0.42, 0.5, 0.32, -1.0];
const SLAM = [0.004, 0.016, 0, 0.05, 0, 0.04];

/** The magazine change of a rifle reload, `s` scaling its pace. */
const swap = (s: number, feed: Feed) =>
  magSwap({
    present: STANCE[feed].present,
    meet: STANCE[feed].meet,
    ...PATH[feed],
    twist: feed === 'cell' ? CELL_TWIST : undefined,
    leave: LEAVE,
    pouch: POUCH,
    back: BACK,
    at: [0.4 * s, 0.44 * s, 0.52 * s, 0.66 * s, 0.77 * s, 0.89 * s, 1.08 * s, 1.2 * s, 1.24 * s, 1.285 * s],
    rip: [-0.006, -0.014, 0, -0.03, 0, -0.05],
    slam: SLAM
  });

const taps = new WeakMap<Goal, Goal>();
/** The flat hand just under the seated strip, drawn back for the slap. */
function tapOff(mag: Goal) {
  let g = taps.get(mag);
  if (!g) taps.set(mag, (g = { node: mag.node, pos: mag.pos.clone().add(new THREE.Vector3(0, -0.035, 0.012)), quat: mag.quat }));
  return g;
}

/** After the seat, what the hand does on the magazine before it lets go, from `at` seconds: hand keys, finger keys and when it is free. */
function finish(feed: Feed, at: number, mag: Goal): { hand: [number, Goal][]; fingers: [number, FingerShape][]; free: number } {
  if (feed === 'strip') return { hand: [[at, mag], [at + TAP, tapOff(mag)], [at + TAP * 2, mag]], fingers: [[at, 'magazine'], [at + TAP * 0.8, 'flat'], [at + TAP * 2.4, 'flat']], free: at + TAP * 2 };
  if (feed === 'cell') return { hand: [[at, mag], [at + 0.08, mag]], fingers: [[at + 0.08, 'magazine']], free: at + 0.08 };
  return { hand: [[at, mag]], fingers: [[at, 'magazine']], free: at };
}

/** Rifle reload: roll to present the well, rip the mag out and away, bring a fresh one up and slam it home; empty adds the charging handle. The nail strip gets a slap up into the feed, the energy cell a locking twist. */
export function arReload(id: WeaponId, empty: boolean, duration: number): Clip {
  const feed = FEED[id] ?? 'box';
  const { present, wait, sag, meet } = STANCE[feed];
  if (!empty) {
    const gun: Keys = [[0, Z], [0.09, DIP], [0.36, present], [0.6, wait], [0.84, sag], [1.16, meet], [1.4, wait], [1.68, OVER], [1.84, Z], [1.9, Z]];
    const mag = swap(1, feed);
    return clip('arReload', duration, 1.9, [[0.02, 'cloth'], [0.46, 'magOut'], [1.28, 'magIn'], [1.5, 'cloth']], (t, f, c) => {
      const g = c.goals;
      const done = finish(feed, 1.31, g.mag!);
      f.gun(track(t, gun));
      if (feed === 'strip') f.gun([0.002, 0.012, 0, 0.035, 0, 0.02], jolt(t - 1.31 - TAP * 2));
      mag(t, f, c);
      const back = Math.max(1.66, done.free + 0.3);
      f.left = hand(t, [[0, g.leftRest!], [0.07, g.leftRest!], [0.36, g.mag!], ...done.hand, [back, g.leftRest!]]);
      if (t > 0.07 && t < back) f.leftFingers = fingers(t, [[0.07, c.tuning.fingers.left], [0.22, 'open'], [0.38, 'magazine'], ...done.fingers, [done.free + 0.13, 'relaxed'], [back, c.tuning.fingers.left]]);
      f.busy = env(t, 0, 0.16, 1.62, 1.86);
    });
  }
  const s = 0.96;
  const gun: Keys = [[0, Z], [0.08, DIP], [0.34, present], [0.58, wait], [0.8, sag], [1.11, meet], [1.3, wait], [1.58, CHARGE], [1.82, CHARGE], [2.14, OVER], [2.32, Z], [2.4, Z]];
  const bolt: Keys = [[1.59, Z], [1.62, [0, 0, -0.003]], [1.73, [0, 0, BOLT]], [1.765, [0, 0, BOLT]], [1.79, Z]];
  // The carrier sits locked back since the last shot and runs home with the released handle.
  const carrier: Keys = [[1.77, [0, 0, SLIDE_LOCK]], [1.79, Z]];
  const mag = swap(s, feed);
  const events: Events = [[0.02, 'cloth'], [0.46 * s, 'magOut'], [1.28 * s, 'magIn'], [1.69, 'boltBack'], [1.785, 'boltForward'], [1.79, 'boltRelease'], [1.95, 'cloth']];
  return clip('arReloadEmpty', duration, 2.4, events, (t, f, c) => {
    const g = c.goals;
    f.gun(track(t, gun));
    f.gun([0, 0.004, 0.014, 0.04, 0, 0], jolt(t - 1.72));
    f.gun([0, -0.004, -0.012, -0.05, 0, 0], jolt(t - 1.785));
    mag(t, f, c);
    f.part('bolt', track(t, bolt));
    if (c.goals.slideSeat) f.part('slide', track(t, carrier));
    const done = finish(feed, 1.27, g.mag!);
    if (feed === 'strip') f.gun([0.002, 0.012, 0, 0.035, 0, 0.02], jolt(t - 1.27 - TAP * 2));
    f.left = hand(t, [[0, g.leftRest!], [0.07, g.leftRest!], [0.34, g.mag!], ...done.hand, [1.58, g.charge!], [1.765, g.charge!], [1.7651, g.chargeBack!], [1.82, g.chargeBack!], [1.98, g.chargeOut!], [2.16, g.leftRest!]]);
    if (t > 0.07 && t < 2.16) {
      const rest = c.tuning.fingers.left;
      f.leftFingers = fingers(t, [[0.07, rest], [0.2, 'open'], [0.36, 'magazine'], ...done.fingers, [done.free + 0.12, 'relaxed'], [1.56, 'hook'], [1.78, 'hook'], [2.02, 'handle'], [2.16, rest]]);
    }
    f.busy = env(t, 0, 0.16, 2.1, 2.34);
  });
}

/** Rifles whose magazine a cut-off reload drops: the next free moment brings another up from the belt (reseatClip). */
export const reseats = (id: WeaponId) => id === 'ar' || id in FEED;

/**
 * A reload cut off with the magazine out of the gun let it fall; once the hands are free the left one goes down to the
 * belt and comes back with another, seats it (slapped or twisted like a reload's) and returns to the fore-end.
 */
export function reseatClip(id: WeaponId): Clip {
  const feed = FEED[id] ?? 'box';
  const mag = magSwap({ present: TILT, meet: TILT, ...PATH[feed], twist: feed === 'cell' ? CELL_TWIST : undefined, leave: LEAVE, pouch: POUCH, back: BACK, at: [-0.5, -0.46, -0.42, -0.3, -0.12, 0.14, 0.3, 0.4, 0.425, 0.46], rip: Z, slam: SLAM });
  const gun: Keys = [[0, Z], [0.24, TILT], [0.46, TILT], [0.62, OVER], [0.72, Z]];
  return clip('reseat', 0.72, 0.72, [[0.02, 'cloth'], [0.46, 'magIn']], (t, f, c) => {
    const g = c.goals;
    const done = finish(feed, 0.48, g.mag!);
    f.gun(track(t, gun));
    if (feed === 'strip') f.gun([0.002, 0.012, 0, 0.035, 0, 0.02], jolt(t - 0.48 - TAP * 2));
    mag(t, f, c);
    const back = done.free + 0.18;
    f.left = hand(t, [[0, g.mag!], ...done.hand, [back, g.leftRest!]]);
    if (t < back) f.leftFingers = fingers(t, [[0, 'magazine'], ...done.fingers, [done.free + 0.1, 'relaxed'], [back, c.tuning.fingers.left]]);
    f.busy = 0.5 * env(t, 0, 0.08, back - 0.1, back);
  });
}

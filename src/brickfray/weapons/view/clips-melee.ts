import * as THREE from 'three';
import { MELEE_IDS, MELEES, type MeleeId } from '../defs';
import { bump, hand, track, type Clip } from './clip';
import { clip, held, scaled, Z, type Pose } from './clips-extra';
import { fingers, FINGERS, type FingerPose } from './fingers';
import type { Goal } from './goals';
import { seg } from './springs';

/** How a weapon's weight shows in the timing, in seconds. The lift from the hip to the cocked pose takes what is left before contact. */
interface Beat {
  /** From the gun down to the hip, where the hand takes the weapon. */
  fetch: number;
  /** Held cocked, drawn back a touch (`load`, a share of the blow), before the blow. */
  hang: number;
  load: number;
  /** The blow, from the cocked pose to contact. */
  swing: number;
  /** In the target after contact, then the follow-through. */
  bite: number;
  follow: number;
  /** From the end of the follow-through until the weapon is out of the picture (put away under the frame), and from there onto the gun. */
  stow: number;
  back: number;
}

/** Light: a quick flick and straight back. Heavy: a long hang at the top, a dead stop in the target, and a slow drag out. */
const LIGHT: Beat = { fetch: 0.044, hang: 0.01, load: 0.12, swing: 0.024, bite: 0.018, follow: 0.04, stow: 0.03, back: 0.08 };
const MEDIUM: Beat = { fetch: 0.049, hang: 0.017, load: 0.12, swing: 0.025, bite: 0.03, follow: 0.06, stow: 0.04, back: 0.1 };
const HEAVY: Beat = { fetch: 0.05, hang: 0.028, load: 0.15, swing: 0.024, bite: 0.045, follow: 0.12, stow: 0.045, back: 0.11 };
/** Shares of the lift at which the weapon, still hanging head down, clears the bottom of the frame, and at which it is half turned over. */
const PULLED = 0.2;
const TURNED = 0.62;
/** How far the fist rises out of the hip before the weapon turns over: the unsheathe. */
const PULL = new THREE.Vector3(-0.012, 0.1, 0.012);

/** One strike: taken up hanging at the hip, turned over on the way up, cocked in view, contact at screen center, the stop, the follow-through. */
interface Swing {
  draw: Pose;
  rise: Pose;
  wind: Pose;
  hit: Pose;
  stop: Pose;
  through: Pose;
  recover: Pose;
  beat: Beat;
  /** How hard the blow jolts the gun hand. */
  weight: number;
  /** Gun offset while the other arm swings: rolled out and down to the right, clear of the follow-through. */
  dip: readonly number[];
}

const DIP = [0.06, -0.075, 0.05, -0.34, -0.3, -0.5];
const HEAVY_DIP = [0.065, -0.1, 0.06, -0.42, -0.36, -0.56];
/** Hanging from the fist at the front of the left hip, head down and a little ahead, just under the frame: where it is drawn from. */
const HIP: Pose = [[-0.03, -0.3, -0.42], [0.05, -0.8, -0.6], [0.9, 0.1, -0.4]];
/** Where it goes back in, a little lower so the fist is well out of the picture. */
const STOW: Pose = [[0.03, -0.31, -0.42], [0.1, -0.8, -0.6], [0.9, 0.1, -0.4]];
/** View-space offset from the support grip to where the empty hand comes up from onto it, out of the picture under the lowered gun. */
const UNDER = new THREE.Vector3(0.005, -0.15, 0.03);
/** The soonest a strike can read after the hand leaves the gun (time for a visible lift and hang), and the most the picture may trail the sim's hit for it. */
const SOONEST = 0.17;
const LATE = 0.055;
/** Seconds the swing cue leads the shown contact: the audio's whoosh peaks 30-50 ms after it starts. */
const WHOOSH = 0.048;
/** An empty hand reaching for the gun: fingers long and together, not a claw. */
const REACH: FingerPose = { ...FINGERS.open, index: 0.18, middle: 0.2, ring: 0.24, pinky: 0.28, spread: 0.05, thumb: 0.15, oppose: 0.3 };
/** How fast the weapon arrives at contact, as a share of its average speed over the swing: it is still speeding up when it lands. */
const ARRIVE = 1.6;
/** Share of the dip the gun has made by the time the hand has the weapon: it eases out of the way over several frames. */
const DIP_EARLY = 0.4;

/** Seconds from the press to the moment the first-person swing is shown landing, for a sim windup of `windup` seconds. */
export function shownContact(windup: number): number {
  return Math.max(windup, Math.min(windup + LATE, SOONEST));
}

/** Each melee weapon's shown contact, seconds after the press (its sim hit check is `MELEES[id].windup`). */
export const MELEE_CONTACT = Object.fromEntries(MELEE_IDS.map((id) => [id, shownContact(MELEES[id].windup)])) as Record<MeleeId, number>;

const SWINGS: Record<MeleeId, Swing> = {
  // Overhead smash: the head swings up out of the hip and over the left shoulder, hangs there, and is driven down onto the crosshair face first, on down through it and out of the frame.
  mallet: {
    draw: [[-0.03, -0.3, -0.42], [-0.1, -0.85, -0.5], [0.9, 0.1, -0.4]],
    rise: [[-0.11, -0.2, -0.4], [-0.55, 0.3, -0.78], [0.75, 0.2, -0.6]],
    wind: [[-0.13, -0.07, -0.42], [-0.5, 0.86, 0.0], [0.45, 0.2, -0.87]],
    hit: [[-0.036, -0.187, -0.508], [0.12, 0.62, -0.77], [0, -0.77, -0.62]],
    stop: [[-0.035, -0.2, -0.505], [0.12, 0.54, -0.83], [0, -0.83, -0.54]],
    through: [[-0.05, -0.33, -0.42], [0.1, -0.5, -0.86], [0, -0.86, 0.5]],
    recover: [[-0.07, -0.35, -0.42], [0.15, -0.7, -0.7], [0.1, -0.7, 0.7]],
    beat: HEAVY,
    weight: 1.3,
    dip: DIP
  },
  // Diagonal slash, upper left to lower right, the blade crossing the crosshair and carrying on out of the bottom of the frame.
  sword: {
    draw: HIP,
    rise: [[-0.15, -0.21, -0.43], [-0.85, 0.2, -0.5], [0.45, 0.45, -0.77]],
    wind: [[-0.23, -0.04, -0.43], [-0.42, 0.85, -0.3], [0.75, 0.25, -0.6]],
    hit: [[-0.135, -0.176, -0.469], [0.42, 0.55, -0.72], [0.7, -0.65, 0.1]],
    stop: [[-0.07, -0.2, -0.46], [0.62, 0.25, -0.74], [0.6, -0.8, 0]],
    through: [[0.06, -0.32, -0.4], [0.6, -0.45, -0.66], [0.3, -0.9, -0.3]],
    recover: [[0.02, -0.34, -0.4], [0.4, -0.5, -0.77], [0.4, -0.8, 0.3]],
    beat: MEDIUM,
    weight: 0.6,
    dip: DIP
  },
  // A flick: up out of the hip, the blade flipped over in the fist, and a forehand slash at chest height, broadside to the eye, on down out of the frame.
  knife: {
    draw: HIP,
    rise: [[-0.17, -0.19, -0.4], [-0.9, 0.05, -0.43], [0.4, 0.5, -0.77]],
    wind: [[-0.2, -0.1, -0.4], [-0.45, 0.75, -0.5], [0.75, 0.35, -0.55]],
    hit: [[-0.06, -0.106, -0.501], [0.35, 0.62, -0.7], [0.9, -0.3, 0.2]],
    stop: [[0, -0.115, -0.49], [0.6, 0.5, -0.62], [0.75, -0.6, 0.2]],
    through: [[0.07, -0.3, -0.42], [0.5, -0.5, -0.7], [0.45, -0.85, 0.3]],
    recover: [[0.04, -0.34, -0.4], [0.4, -0.6, -0.7], [0.5, -0.8, 0.3]],
    beat: LIGHT,
    weight: 0.4,
    dip: DIP
  },
  // Rising hook from low on the left: the crown swings out of the hip and back, hangs, comes up through the crosshair, its weight tips it over to the right, and it drops out of the frame.
  anchor: {
    draw: [[-0.03, -0.3, -0.42], [-0.1, -0.85, -0.5], [0.9, 0.1, -0.4]],
    rise: [[-0.13, -0.2, -0.41], [-0.75, -0.55, -0.4], [0.6, -0.3, -0.75]],
    wind: [[-0.19, -0.17, -0.42], [-0.62, 0.12, -0.78], [0.5, 0.5, -0.7]],
    hit: [[-0.058, -0.174, -0.541], [0.25, 0.75, -0.6], [0.95, 0.1, 0.25]],
    stop: [[-0.02, -0.15, -0.53], [0.45, 0.72, -0.52], [0.85, -0.25, 0.4]],
    through: [[0.04, -0.19, -0.47], [0.8, 0.4, -0.45], [0.2, -0.45, 0.85]],
    recover: [[0.0, -0.38, -0.41], [0.55, -0.65, -0.52], [0.1, -0.55, 0.8]],
    beat: HEAVY,
    weight: 1.4,
    dip: HEAVY_DIP
  },
  // Diagonal chop from the upper left: the bit sinks in at the crosshair, side-on to the eye, and is wrenched out down to the right.
  hatchet: {
    draw: HIP,
    rise: [[-0.14, -0.2, -0.43], [-0.85, 0.25, -0.45], [0.45, 0.45, -0.77]],
    wind: [[-0.21, -0.07, -0.45], [-0.55, 0.82, -0.12], [0.6, 0.3, -0.75]],
    hit: [[-0.112, -0.173, -0.49], [0.4, 0.62, -0.68], [0.6, -0.7, -0.3]],
    stop: [[-0.1, -0.19, -0.49], [0.42, 0.55, -0.72], [0.6, -0.78, -0.2]],
    through: [[0.04, -0.32, -0.42], [0.5, -0.4, -0.77], [0.4, -0.9, 0.1]],
    recover: [[0.01, -0.35, -0.42], [0.3, -0.6, -0.74], [0.3, -0.8, 0.5]],
    beat: MEDIUM,
    weight: 0.9,
    dip: DIP
  },
  // Cross swing, left to right, the jaw through the crosshair and on down out of the lower right.
  wrench: {
    draw: HIP,
    rise: [[-0.16, -0.22, -0.44], [-0.85, 0.2, -0.5], [0.45, 0.5, -0.74]],
    wind: [[-0.26, -0.09, -0.43], [-0.6, 0.76, -0.25], [0.5, 0.4, -0.75]],
    hit: [[-0.152, -0.168, -0.516], [0.5, 0.55, -0.67], [0.85, -0.45, 0.25]],
    stop: [[-0.11, -0.18, -0.5], [0.68, 0.42, -0.6], [0.7, -0.65, 0.2]],
    through: [[0.05, -0.3, -0.42], [0.8, -0.15, -0.58], [0.3, -0.95, 0.1]],
    recover: [[0.04, -0.35, -0.42], [0.6, -0.5, -0.62], [0.4, -0.85, 0.3]],
    beat: MEDIUM,
    weight: 1,
    dip: DIP
  }
};

/** View-space hand goals of every melee weapon's strike. */
export function meleeGoals(view: THREE.Object3D): Record<string, Goal> {
  const goals: Record<string, Goal> = { meleeStow: held(view, STOW) };
  for (const [id, s] of Object.entries(SWINGS)) {
    const draw = held(view, s.draw);
    goals[`${id}Draw`] = draw;
    goals[`${id}Pull`] = { node: view, pos: draw.pos.clone().add(PULL), quat: draw.quat };
    goals[`${id}Rise`] = held(view, s.rise);
    const wind = held(view, s.wind);
    const hit = held(view, s.hit);
    const cock = loaded(wind, hit, s.beat.load);
    goals[`${id}Wind`] = wind;
    goals[`${id}Cock`] = cock;
    goals[`${id}Hit`] = hit;
    goals[`${id}Past`] = past(cock, hit, s.beat);
    goals[`${id}Stop`] = held(view, s.stop);
    goals[`${id}Through`] = held(view, s.through);
    goals[`${id}Recover`] = held(view, s.recover);
  }
  return goals;
}

const away = new THREE.Quaternion();
const turn = new THREE.Quaternion();

/** Keeps `out` straight under the support grip `rest` in view space, however the gun is turned. */
function under(rest: Goal, out: Goal) {
  rest.node.getWorldQuaternion(turn).invert();
  out.pos.copy(UNDER).applyQuaternion(turn).add(rest.pos);
}

/** The wind pulled a little further back, away from the strike: where the weapon hangs before it comes through. */
function loaded(wind: Goal, hit: Goal, load: number): Goal {
  away.copy(hit.quat).invert().premultiply(wind.quat);
  const quat = new THREE.Quaternion().slerp(away, load).multiply(wind.quat);
  return { node: wind.node, pos: wind.pos.clone().lerp(hit.pos, -load), quat };
}

/**
 * A point beyond contact on the line of the blow, the swing's next neighbour: placed so the hand path arrives at the
 * target ARRIVE times as fast as it travelled on average, instead of easing into it.
 */
function past(cock: Goal, hit: Goal, b: Beat): Goal {
  const k = (b.bite * (ARRIVE * b.swing + (ARRIVE - 1) * b.bite)) / (b.swing * b.swing);
  return { node: hit.node, pos: hit.pos.clone().lerp(cock.pos, -k), quat: hit.quat };
}

/**
 * The gun eases down and rolls out to the right while the left hand drops off it to the hip, where it takes the
 * weapon; the weapon comes up out of the hip turning over, hangs cocked a moment, and is driven through the screen
 * center faster than it was raised. The blow stops in the target, follows through out of the frame, the weapon goes
 * back into the hip and the hand rises onto the gun from under it as the gun comes back up. The sim resolves the
 * hit `windup` seconds in; a windup too short for the lift is shown up to LATE seconds behind it.
 */
export function meleeClip(id: MeleeId, duration: number, windup: number): Clip {
  const s = SWINGS[id];
  const b = s.beat;
  const at = (seconds: number) => seconds / duration;
  const contact = shownContact(windup);
  const hit = at(contact);
  const cock = at(contact - b.swing);
  const wind = at(contact - b.swing - b.hang);
  const draw = at(b.fetch);
  const pull = draw + (wind - draw) * PULLED;
  const rise = draw + (wind - draw) * TURNED;
  const stop = at(contact + b.bite);
  const through = at(contact + b.bite + b.follow);
  const recover = through + at(b.stow);
  const below = recover + at(b.back * 0.5);
  const back = recover + at(b.back);
  const settle = Math.min(at(0.12), (1 - back) * 0.9);
  let from: Goal | null = null;
  const strike = clip('melee', duration, [[0, 'cloth'], [at(contact - WHOOSH), 'swing']], (u, f, c) => {
    const g = c.goals;
    const blow = g[`${id}Hit`]!;
    from ??= { node: g.leftRest!.node, pos: new THREE.Vector3(), quat: g.leftRest!.quat };
    under(g.leftRest!, from);
    const path = hand(u, [
      [0, g.leftFrom!],
      [draw, g[`${id}Draw`]!],
      [pull, g[`${id}Pull`]!],
      [rise, g[`${id}Rise`]!],
      [wind, g[`${id}Wind`]!],
      [cock, g[`${id}Cock`]!],
      [hit, blow],
      [stop, g[`${id}Stop`]!],
      [through, g[`${id}Through`]!],
      [recover, g[`${id}Recover`]!],
      [below, from],
      [back, g.leftRest!]
    ]);
    // Full speed into the target, and from a dead stop out of it.
    if (path.to === blow) path.after = g[`${id}Past`]!;
    else if (path.from === blow) path.before = blow;
    f.left = path;
    const grip = c.tuning.fingers.left;
    f.leftFingers = u < back ? fingers(u, [[0, grip], [draw * 0.5, REACH], [draw, 'handle'], [recover, 'handle'], [below, REACH], [back, grip]]) : null;
    // Taken up at the hip and put away once the follow-through has taken it out of the frame, so it is never seen arriving or leaving the fist.
    f.show.mallet = u >= draw && u < recover ? 1 : 0;

    const dip = s.dip;
    // Kept low until the hand is back on it, then brought up with both hands.
    f.gun(track(u, [[0, Z], [draw, scaled(dip, DIP_EARLY)], [cock, dip], [stop, scaled(dip, 1.05)], [through, dip], [recover, scaled(dip, 0.95)], [below, scaled(dip, 0.8)], [back, scaled(dip, 0.5)], [back + settle * 0.55, [-0.002, 0.006, -0.006, 0.028, 0.01, 0.022]], [back + settle, Z]]));
    const jolt = bump(u, hit + at(0.022), at(0.02)) * s.weight;
    f.gun([0.004, -0.006, 0.012, -0.03, -0.025, 0.035], jolt);
    f.busy = seg(u, 0, hit * 0.5) * (1 - seg(u, back, back + settle));
  });
  return { ...strike, fade: Math.min(0.05, windup * 0.4), instant: true };
}

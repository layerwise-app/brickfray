import * as THREE from 'three';
import { MELEE_IDS, MELEES, type MeleeId } from '../defs';
import { hand, track, type Clip } from './clip';
import { clip, held, scaled, Z, type Pose } from './clips-extra';
import { fingers, FINGERS, type FingerPose } from './fingers';
import type { Goal } from './goals';
import { seg } from './springs';

/** How a weapon's weight shows in the timing, in seconds. The lift from the hip to the cocked pose takes what is left before contact. */
interface Beat {
  /** Held cocked, drawn back a touch (`load`, a share of the blow), before the blow. */
  hang: number;
  load: number;
  /** The blow, from the cocked pose to contact. */
  swing: number;
  /** From contact on through the target to the follow-through pose, still in view at speed (a confirmed hit's hit-stop is the view model's), and from there until the weapon is out of the picture, put away under the frame. */
  bite: number;
  follow: number;
  /** From there onto the gun. */
  back: number;
}

/** Light: a quick flick and straight back. Heavy: a long hang at the top. Every blow carries on through the target and follows through, still in view. */
const LIGHT: Beat = { hang: 0.01, load: 0.12, swing: 0.024, bite: 0.084, follow: 0.03, back: 0.08 };
const MEDIUM: Beat = { hang: 0.015, load: 0.12, swing: 0.025, bite: 0.05, follow: 0.09, back: 0.1 };
const HEAVY: Beat = { hang: 0.02, load: 0.15, swing: 0.024, bite: 0.055, follow: 0.115, back: 0.11 };
/**
 * The support hand peels off the gun: it lets go and drops back out of the picture over PEEL seconds (three frames at
 * 60 Hz, slow at first), then hurries on to the hip out of sight in RUSH; PEEL_AWAY is where it leaves the picture,
 * in view space from its grip.
 */
const PEEL = 0.052;
const RUSH = 0.02;
const PEEL_AWAY = new THREE.Vector3(-0.03, -0.21, 0.065);
/** Shares of the lift at which the weapon, still hanging head down, clears the bottom of the frame, and at which it is half turned over. */
const PULLED = 0.2;
const TURNED = 0.62;
/** How far the fist rises out of the hip before the weapon turns over: the unsheathe. */
const PULL = new THREE.Vector3(-0.012, 0.1, 0.012);

/** One strike: taken up hanging at the hip, turned over on the way up, cocked in view, contact at screen center, the follow-through. */
interface Swing {
  draw: Pose;
  rise: Pose;
  wind: Pose;
  hit: Pose;
  through: Pose;
  recover: Pose;
  beat: Beat;
  /** How hard a landed blow jars the gun hand. */
  weight: number;
  /** Gun offset while the other arm swings: rolled out and down to the right, clear of the follow-through. */
  dip: readonly number[];
}

/** The gun in the right hand while the left one strikes, per weapon: a knife's quick jab barely moves it, a sword's slash rolls it over on its side out of the cut, a heavy swing lets it sink. */
const KNIFE_DIP = [0.035, -0.04, 0.03, -0.16, -0.18, -0.32];
const SWORD_DIP = [0.075, -0.06, 0.07, -0.28, -0.45, -0.78];
const HATCHET_DIP = [0.06, -0.085, 0.05, -0.42, -0.3, -0.42];
const WRENCH_DIP = [0.05, -0.07, 0.045, -0.3, -0.2, -0.62];
const MALLET_DIP = [0.065, -0.1, 0.06, -0.42, -0.36, -0.56];
const ANCHOR_DIP = [0.07, -0.11, 0.065, -0.5, -0.3, -0.45];
/** Hanging from the fist at the front of the left hip, head down and a little ahead, just under the frame: where it is drawn from. */
const HIP: Pose = [[-0.03, -0.3, -0.42], [0.05, -0.8, -0.6], [0.9, 0.1, -0.4]];
/** Where it goes back in, a little lower so the fist is well out of the picture. */
const STOW: Pose = [[0.03, -0.31, -0.42], [0.1, -0.8, -0.6], [0.9, 0.1, -0.4]];
/** View-space offset from the support grip to where the empty hand comes up from onto it, out of the picture under the lowered gun. */
const UNDER = new THREE.Vector3(0.005, -0.22, 0.05);
/** A support hand within this distance (m) of its grip when the strike starts is on the gun and peels off it. */
const ON_GUN = 0.06;
const gripAt = new THREE.Vector3();
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

/** How hard a landed blow of this weapon jars the gun hand. */
export function meleeWeight(id: MeleeId) {
  return SWINGS[id].weight;
}

const SWINGS: Record<MeleeId, Swing> = {
  // Overhead smash: the head swings up out of the hip and over the left shoulder, hangs there, and is driven down onto the crosshair face first, on down through it and out of the frame.
  mallet: {
    draw: [[-0.03, -0.3, -0.42], [-0.1, -0.85, -0.5], [0.9, 0.1, -0.4]],
    rise: [[-0.11, -0.2, -0.4], [-0.55, 0.3, -0.78], [0.75, 0.2, -0.6]],
    wind: [[-0.13, -0.07, -0.42], [-0.5, 0.86, 0.0], [0.45, 0.2, -0.87]],
    hit: [[-0.036, -0.187, -0.508], [0.12, 0.62, -0.77], [0, -0.77, -0.62]],
    through: [[-0.045, -0.3, -0.46], [0.1, -0.15, -0.98], [0, -0.98, 0.15]],
    recover: [[-0.07, -0.39, -0.42], [0.15, -0.7, -0.7], [0.1, -0.7, 0.7]],
    beat: HEAVY,
    weight: 1.3,
    dip: MALLET_DIP
  },
  // Diagonal slash, upper left to lower right, the blade crossing the crosshair and carrying on out of the bottom of the frame.
  sword: {
    draw: HIP,
    rise: [[-0.15, -0.21, -0.43], [-0.85, 0.2, -0.5], [0.45, 0.45, -0.77]],
    wind: [[-0.23, -0.04, -0.43], [-0.42, 0.85, -0.3], [0.75, 0.25, -0.6]],
    hit: [[-0.135, -0.176, -0.469], [0.42, 0.55, -0.72], [0.7, -0.65, 0.1]],
    through: [[-0.04, -0.235, -0.45], [0.62, 0.2, -0.76], [0.55, -0.83, 0]],
    recover: [[0.06, -0.34, -0.4], [0.6, -0.45, -0.66], [0.3, -0.9, -0.3]],
    beat: MEDIUM,
    weight: 0.7,
    dip: SWORD_DIP
  },
  // A stab: up out of the hip with the blade turning forward, edge down, drawn back low beside the chest, and thrust straight out with the point on the crosshair, on along the line of sight, then pulled back down out of the frame.
  knife: {
    draw: [[-0.05, -0.31, -0.36], [0.05, -0.8, -0.6], [0.9, 0.1, -0.4]],
    rise: [[-0.21, -0.27, -0.38], [0.25, 0.45, -0.86], [0.15, -0.9, -0.2]],
    wind: [[-0.2, -0.235, -0.33], [0.45, 0.5, -0.74], [0.25, -0.85, -0.1]],
    hit: [[-0.15, -0.185, -0.47], [0.42, 0.5, -0.76], [0.25, -0.88, -0.1]],
    // The thrust carries on straight down the line of sight, the point staying on the crosshair, before it is pulled back.
    through: [[-0.15, -0.185, -0.525], [0.42, 0.5, -0.76], [0.25, -0.88, -0.1]],
    recover: [[-0.12, -0.37, -0.36], [0.15, -0.7, -0.7], [0.1, -0.7, 0.7]],
    beat: LIGHT,
    weight: 0.5,
    dip: KNIFE_DIP
  },
  // Rising hook from low on the left: the crown swings out of the hip and back, hangs, comes up through the crosshair, its weight tips it over to the right, and it drops out of the frame.
  anchor: {
    draw: [[-0.03, -0.3, -0.42], [-0.1, -0.85, -0.5], [0.9, 0.1, -0.4]],
    rise: [[-0.13, -0.2, -0.41], [-0.75, -0.55, -0.4], [0.6, -0.3, -0.75]],
    wind: [[-0.19, -0.17, -0.42], [-0.62, 0.12, -0.78], [0.5, 0.5, -0.7]],
    hit: [[-0.058, -0.174, -0.541], [0.25, 0.75, -0.6], [0.95, 0.1, 0.25]],
    through: [[0.07, -0.32, -0.45], [0.85, -0.15, -0.5], [0.2, -0.6, 0.75]],
    recover: [[0.02, -0.4, -0.41], [0.55, -0.65, -0.52], [0.1, -0.55, 0.8]],
    beat: HEAVY,
    weight: 1.4,
    dip: ANCHOR_DIP
  },
  // Diagonal chop from the upper left: the bit sinks in at the crosshair, side-on to the eye, and is wrenched out down to the right.
  hatchet: {
    draw: HIP,
    rise: [[-0.14, -0.2, -0.43], [-0.85, 0.25, -0.45], [0.45, 0.45, -0.77]],
    wind: [[-0.21, -0.07, -0.45], [-0.55, 0.82, -0.12], [0.6, 0.3, -0.75]],
    hit: [[-0.112, -0.173, -0.49], [0.4, 0.62, -0.68], [0.6, -0.7, -0.3]],
    through: [[0.0, -0.27, -0.44], [0.75, 0.08, -0.65], [0.35, -0.9, 0.2]],
    recover: [[0.04, -0.34, -0.42], [0.4, -0.5, -0.77], [0.35, -0.85, 0.3]],
    beat: MEDIUM,
    weight: 1,
    dip: HATCHET_DIP
  },
  // A short bash: raised back over the left shoulder, the jaw leading, the bent arm brings it down and across so the jaw slams into the crosshair with the bar upright in the fist, and on down to the right out of the frame.
  wrench: {
    draw: HIP,
    rise: [[-0.2, -0.23, -0.38], [-0.45, 0.6, -0.65], [0.8, 0.3, -0.5]],
    wind: [[-0.21, -0.11, -0.43], [-0.4, 0.9, 0.15], [0.85, 0.4, -0.3]],
    hit: [[-0.15, -0.205, -0.44], [0.55, 0.75, -0.35], [0.75, -0.45, -0.3]],
    through: [[-0.03, -0.28, -0.42], [0.85, 0.3, -0.42], [0.35, -0.85, -0.35]],
    recover: [[0.03, -0.38, -0.4], [0.6, -0.5, -0.62], [0.4, -0.85, 0.3]],
    beat: MEDIUM,
    weight: 1,
    dip: WRENCH_DIP
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
    goals[`${id}Through`] = held(view, s.through);
    goals[`${id}Recover`] = held(view, s.recover);
  }
  return goals;
}

const away = new THREE.Quaternion();
const turn = new THREE.Quaternion();

/** Keeps `out` at the view-space offset `by` from the support grip `rest`, however the gun is turned. */
function under(rest: Goal, out: Goal, by: THREE.Vector3) {
  rest.node.getWorldQuaternion(turn).invert();
  out.pos.copy(by).applyQuaternion(turn).add(rest.pos);
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
 * The gun eases down and rolls out to the right while the left hand peels off it and drops to the hip, where it takes
 * the weapon; the weapon comes up out of the hip turning over, hangs cocked a moment, and is driven through the screen
 * center faster than it was raised, on through the target and out of the frame (a hit's hit-stop is laid on by the
 * view model), the weapon goes back into the hip and the hand rises onto the gun from under it as the gun comes back
 * up. The sim resolves the hit `windup` seconds in; a windup too short for the lift is shown up to LATE seconds behind it.
 */
export function meleeClip(id: MeleeId, duration: number, windup: number): Clip {
  const s = SWINGS[id];
  const b = s.beat;
  const at = (seconds: number) => seconds / duration;
  const contact = shownContact(windup);
  const hit = at(contact);
  const cock = at(contact - b.swing);
  const wind = at(contact - b.swing - b.hang);
  const peel = at(PEEL);
  const draw = at(PEEL + RUSH);
  const pull = draw + (wind - draw) * PULLED;
  const rise = draw + (wind - draw) * TURNED;
  const stop = at(contact + 0.03);
  let off: Goal | null = null;
  const through = at(contact + b.bite);
  const recover = through + at(b.follow);
  const below = recover + at(b.back * 0.4);
  const back = recover + at(b.back);
  const settle = Math.min(at(0.12), (1 - back) * 0.9);
  let from: Goal | null = null;
  /** Whether the strike found the hand on the gun; one already away (fetching a magazine out of frame) goes straight to the hip. */
  let onGun: boolean | null = null;
  const strike = clip('melee', duration, [[0, 'cloth'], [at(contact - WHOOSH), 'swing']], (u, f, c) => {
    const g = c.goals;
    const blow = g[`${id}Hit`]!;
    from ??= { node: g.leftRest!.node, pos: new THREE.Vector3(), quat: g.leftRest!.quat };
    off ??= { node: g.leftRest!.node, pos: new THREE.Vector3(), quat: g.leftRest!.quat };
    under(g.leftRest!, from, UNDER);
    under(g.leftRest!, off, PEEL_AWAY);
    onGun ??= g.leftRest!.node.localToWorld(gripAt.copy(g.leftRest!.pos)).distanceTo(g.leftFrom!.pos) < ON_GUN;
    const path = hand(u, [
      [0, g.leftFrom!],
      ...(onGun ? ([[peel, off]] as const) : []),
      [draw, g[`${id}Draw`]!],
      [pull, g[`${id}Pull`]!],
      [rise, g[`${id}Rise`]!],
      [wind, g[`${id}Wind`]!],
      [cock, g[`${id}Cock`]!],
      [hit, blow],
      [through, g[`${id}Through`]!],
      [recover, g[`${id}Recover`]!],
      [below, from],
      [back, g.leftRest!]
    ]);
    // Full speed into the target; under the gun the empty hand stops before it rises onto the grip, so it does not come into the picture at a run.
    if (path.to === blow) path.after = g[`${id}Past`]!;
    else if (path.to === from) path.after = from;
    else if (path.from === from) path.before = from;
    f.left = path;
    const grip = c.tuning.fingers.left;
    f.leftFingers = u < back ? fingers(u, [[0, grip], [peel * 0.7, REACH], [draw, 'handle'], [recover, 'handle'], [below, REACH], [back, grip]]) : null;
    // Taken up at the hip and put away once the follow-through has taken it out of the frame, so it is never seen arriving or leaving the fist.
    f.show.mallet = u >= draw && u < recover ? 1 : 0;

    const dip = s.dip;
    // Out of the way for the blow; from the hit-stop the gun hand already brings it back up, so the follow-through and
    // the weapon's exit play out over a gun on its way back, never over an empty frame.
    f.gun(track(u, [[0, Z], [draw, scaled(dip, DIP_EARLY)], [cock, dip], [stop, scaled(dip, 1.05)], [stop + Math.min(at(0.07), (recover - stop) * 0.55), scaled(dip, 0.8)], [recover, scaled(dip, 0.5)], [below, scaled(dip, 0.24)], [back, scaled(dip, 0.07)], [back + settle * 0.55, [-0.002, 0.006, -0.006, 0.028, 0.01, 0.022]], [back + settle, Z]]));
    f.busy = seg(u, 0, hit * 0.5) * (1 - seg(u, back, back + settle));
  });
  return { ...strike, fade: Math.min(0.05, windup * 0.4), instant: true };
}

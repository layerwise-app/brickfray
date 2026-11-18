import * as THREE from 'three';
import type { MeleeId } from '../defs';
import { bump, hand, track, type Clip } from './clip';
import { clip, held, scaled, Z, type Pose } from './clips-extra';
import { fingers } from './fingers';
import type { Goal } from './goals';
import { seg } from './springs';

/** One strike: cocked, contact at screen center, where the blow stops, the end of the follow-through, drawn back before it is put away. */
interface Swing {
  wind: Pose;
  hit: Pose;
  stop: Pose;
  through: Pose;
  recover: Pose;
  /** Seconds the weapon takes to shed its speed after contact, and to finish the follow-through after that. */
  bite: number;
  follow: number;
  /** How hard the blow jolts the gun hand. */
  weight: number;
  /** Gun offset while the other arm swings. */
  dip: readonly number[];
}

const DIP = [0.04, -0.035, 0.04, -0.16, -0.2, -0.28];
const HEAVY_DIP = [0.045, -0.04, 0.05, -0.18, -0.26, -0.32];
/** Off-screen at the lower left, the weapon pointing ahead so a long blade leaves the picture with the hand. */
const AWAY: Pose = [[-0.2, -0.44, -0.24], [0.3, -0.2, -0.9], [0.3, -0.9, 0]];

const SWINGS: Record<MeleeId, Swing> = {
  // Overhead smash that bounces off the target.
  mallet: {
    wind: [[-0.2, 0.03, -0.3], [-0.25, 0.85, 0.45], [0.1, 0.45, -0.9]],
    hit: [[-0.07, -0.1, -0.5], [0.25, 0.4, -0.9], [0, -1, -0.3]],
    stop: [[-0.065, -0.135, -0.5], [0.25, 0.22, -0.95], [0, -1, -0.2]],
    through: [[-0.12, -0.07, -0.42], [0.15, 0.72, -0.68], [0, -0.7, -0.7]],
    recover: [[-0.17, -0.13, -0.36], [0.0, 0.85, -0.5], [0.2, -0.5, -0.85]],
    bite: 0.03,
    follow: 0.11,
    weight: 1,
    dip: DIP
  },
  // Diagonal slash, upper left to lower right, straight through; the blade comes back up as the arm draws in.
  sword: {
    wind: [[-0.27, 0.0, -0.27], [-0.4, 0.82, 0.4], [0.7, 0.2, -0.65]],
    hit: [[-0.12, -0.12, -0.4], [0.3, 0.62, -0.72], [0.75, -0.6, 0.1]],
    stop: [[-0.04, -0.15, -0.41], [0.62, 0.22, -0.76], [0.6, -0.8, 0]],
    through: [[0.03, -0.165, -0.4], [0.82, -0.08, -0.56], [0.2, -0.95, -0.2]],
    recover: [[-0.1, -0.16, -0.36], [0.35, 0.5, -0.8], [0.7, -0.7, 0]],
    bite: 0.03,
    follow: 0.06,
    weight: 0.6,
    dip: DIP
  },
  // Short forehand slash at chest height and a flick back.
  knife: {
    wind: [[-0.27, -0.09, -0.34], [-0.55, 0.35, -0.75], [0.6, 0.3, -0.7]],
    hit: [[-0.05, -0.085, -0.48], [0.1, 0.25, -0.96], [0.95, -0.1, 0.2]],
    stop: [[0.05, -0.095, -0.47], [0.5, 0.2, -0.85], [0.8, -0.4, 0.4]],
    through: [[0.15, -0.13, -0.42], [0.85, 0.1, -0.5], [0.5, -0.5, 0.7]],
    recover: [[-0.06, -0.17, -0.38], [0.3, 0.5, -0.8], [0.9, -0.3, 0.2]],
    bite: 0.03,
    follow: 0.1,
    weight: 0.4,
    dip: scaled(DIP, 0.7)
  },
  // Rising hook from low on the left that drags the whole body round.
  anchor: {
    wind: [[-0.34, -0.26, -0.28], [-0.7, -0.2, -0.65], [0.5, 0.5, -0.7]],
    hit: [[-0.13, -0.17, -0.43], [0.15, 0.7, -0.7], [0.9, 0.4, 0.1]],
    stop: [[-0.07, -0.14, -0.43], [0.35, 0.75, -0.56], [0.85, 0.1, 0.3]],
    through: [[0.04, -0.08, -0.4], [0.7, 0.62, -0.35], [0.5, -0.5, 0.5]],
    recover: [[-0.08, -0.19, -0.37], [0.35, 0.6, -0.7], [0.8, -0.4, 0.2]],
    bite: 0.04,
    follow: 0.14,
    weight: 1.4,
    dip: HEAVY_DIP
  },
  // Diagonal chop that bites in, then is wrenched free.
  hatchet: {
    wind: [[-0.24, 0.04, -0.28], [-0.45, 0.8, 0.4], [0.6, 0.3, -0.75]],
    hit: [[-0.03, -0.06, -0.48], [0.3, 0.5, -0.8], [0.65, -0.75, -0.1]],
    stop: [[0.0, -0.095, -0.48], [0.42, 0.28, -0.87], [0.65, -0.75, -0.1]],
    through: [[-0.06, -0.04, -0.42], [0.25, 0.65, -0.72], [0.65, -0.75, -0.1]],
    recover: [[-0.14, -0.11, -0.38], [0.1, 0.8, -0.6], [0.7, -0.6, -0.2]],
    bite: 0.03,
    follow: 0.12,
    weight: 0.9,
    dip: DIP
  },
  // Flat cross swing, left to right, the jaw sweeping the whole width.
  wrench: {
    wind: [[-0.36, -0.08, -0.3], [-0.85, 0.4, -0.3], [0.4, 0.5, -0.75]],
    hit: [[-0.12, -0.13, -0.44], [0.3, 0.7, -0.64], [1, -0.2, 0.1]],
    stop: [[-0.06, -0.125, -0.44], [0.55, 0.58, -0.6], [0.8, -0.5, 0.2]],
    through: [[0.07, -0.125, -0.4], [0.92, 0.1, -0.38], [0.3, -0.9, 0.3]],
    recover: [[-0.1, -0.17, -0.37], [0.3, 0.7, -0.65], [0.9, -0.35, 0.1]],
    bite: 0.025,
    follow: 0.055,
    weight: 1,
    dip: DIP
  }
};

/** View-space hand goals of every melee weapon's strike. */
export function meleeGoals(view: THREE.Object3D): Record<string, Goal> {
  const goals: Record<string, Goal> = { meleeAway: held(view, AWAY) };
  for (const [id, s] of Object.entries(SWINGS)) {
    goals[`${id}Wind`] = held(view, s.wind);
    goals[`${id}Hit`] = held(view, s.hit);
    goals[`${id}Stop`] = held(view, s.stop);
    goals[`${id}Through`] = held(view, s.through);
    goals[`${id}Recover`] = held(view, s.recover);
  }
  return goals;
}

/**
 * The gun dips right while the left hand whips the weapon up and through the screen center, landing `windup`
 * seconds in (when the sim resolves the hit); it sheds its speed on impact, follows through, and drops away as the gun rises.
 */
export function meleeClip(id: MeleeId, duration: number, windup: number): Clip {
  const s = SWINGS[id];
  const at = (seconds: number) => seconds / duration;
  const cock = at(windup * 0.5);
  const whoosh = at(Math.max(0.02, windup - 0.055));
  const hit = at(windup);
  const stop = at(windup + s.bite);
  const through = Math.min(0.5, at(windup + s.bite + s.follow));
  const recover = 0.6;
  const out = 0.78;
  const back = 0.93;
  const strike = clip('melee', duration, [[0, 'cloth'], [whoosh, 'swing']], (u, f, c) => {
    const g = c.goals;
    f.left = hand(u, [[0, g.leftRest!], [cock, g[`${id}Wind`]!], [hit, g[`${id}Hit`]!], [stop, g[`${id}Stop`]!], [through, g[`${id}Through`]!], [recover, g[`${id}Recover`]!], [out, g.meleeAway!], [back, g.leftRest!]]);
    f.leftFingers = u < back ? fingers(u, [[0, 'support'], [cock * 0.6, 'handle'], [out - 0.04, 'handle'], [back, 'support']]) : null;
    f.show.mallet = u > cock * 0.7 && u < out - 0.015;

    const dip = s.dip;
    f.gun(track(u, [[0, Z], [hit, dip], [through, scaled(dip, 1.12)], [0.58, scaled(dip, 0.96)], [0.84, [-0.002, 0.006, -0.006, 0.028, 0.01, 0.022]], [0.93, [0, -0.002, 0.001, -0.006, 0, -0.004]], [1, Z]]));
    const jolt = bump(u, hit + at(0.022), at(0.02)) * s.weight;
    f.gun([0.004, -0.006, 0.012, -0.03, -0.025, 0.035], jolt);
    f.busy = seg(u, 0, hit * 0.5) * (1 - seg(u, 0.68, 0.86));
  });
  return { ...strike, fade: Math.min(0.05, windup * 0.4) };
}

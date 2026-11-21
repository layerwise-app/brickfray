import * as THREE from 'three';
import { GRENADE } from '../defs';
import { hand, track, type Clip } from './clip';
import { clip, held, scaled, Z, type Pose } from './clips-extra';
import { fingers, FINGERS, type FingerPose, type FingerShape } from './fingers';
import { goalMatrix, type Goal, type V3 } from './goals';
import { seg } from './springs';

/** One-handed low ready: the gun sags to the lower right and rolls outward while the left arm works. */
const DOWN = [0.04, -0.014, 0.03, -0.16, -0.14, -0.36];
/** The gun's weight drops into one hand as the other lets go. */
const SAG = [0.008, -0.022, 0.012, -0.07, -0.03, -0.09];
/** Where the gun hand comes to meet the bomb (grip in view space) and how the gun is turned there. */
const MEET_AT = [0.13, -0.15, -0.38] as const;
const MEET_ROT = [0.28, -0.06, -0.14] as const;
/** The gun hand's snatch as the pin comes out. */
const YANK = [0.03, 0.025, 0.035, 0.1, -0.1, -0.12];
/** The gun hand's thumb, off the grip and out to the left for the ring, then curled shut on it. */
const THUMB_OUT: FingerPose = { ...FINGERS.trigger, thumb: 0, oppose: 0.55 };
const THUMB_SHUT: FingerPose = { ...FINGERS.trigger, thumb: 0.55, oppose: 0.7 };
/** Pin out: the bomb hand's thumb swung across the back of the bomb, pressing the spoon flat. */
const SPOON: FingerPose = { ...FINGERS.ball, thumb: 0.25, oppose: 0.9 };

const PRESENT: Pose = [[0, 0, 0], [0.05, 1, 0.15], [0.6, 0, -0.8]];
/** How far the bomb is snatched off the pin, from where it was presented: down and ahead, across the thumb. */
const TUG = [-0.06, -0.07, -0.07] as const;
const TUGGED: Pose = [[0, 0, 0], [-0.3, 0.95, 0.1], [0.6, 0, -0.8]];
const COCKED: Pose = [[-0.15, 0.04, -0.34], [0.88, 0.3, 0.35], [-0.08, 0.9, -0.25]];
/** Just under the frame below the gun hand: where a throw let go before the bomb was fetched takes it up on the way, its ring sweeping past the gun hand's thumb. */
const SNATCH: Pose = [[0.11, -0.31, -0.4], [-0.6, 0.3, -0.75], [0.2, -0.6, -0.75]];

/** Cook beats in seconds: hand at the belt, bomb presented with its ring on the thumb, the snatch starts, hands apart, pin flicked, arm cocked. */
const GRAB = 0.16;
const UP = 0.35;
const PULL = 0.43;
const APART = 0.51;
const FLICK = 0.59;
const READY = 0.88;
const COOK = GRENADE.maxCook + 0.7;

/** View-space hand goals of the throw. */
export function grenadeGoals(view: THREE.Object3D): Record<string, Goal> {
  return {
    grenadeCocked: held(view, COCKED),
    grenadeSnatch: held(view, SNATCH),
    overWind: held(view, [[-0.185, 0.055, -0.29], [0.75, 0.3, 0.6], [-0.05, 0.75, 0.45]]),
    overRelease: held(view, [[-0.07, 0.09, -0.52], [1, 0, 0], [0, 0.7, -0.7]]),
    overFollow: held(view, [[0.05, -0.19, -0.43], [0.9, 0.1, 0.35], [0.35, -0.35, -0.87]]),
    // Underhand: the arm drops down the left edge and swings back into the lower left corner, the bomb still in the frame,
    // then swings through low in the middle and out after the bomb, and drops out of the frame to come up to the gun from below.
    underDrop: held(view, open([-0.235, -0.07, -0.36], [-0.25, -0.2, -0.95], [0.75, 0.6, -0.3])),
    underWind: held(view, open([-0.215, -0.15, -0.33], [0.05, -0.75, -0.66], [0.25, 0.6, -0.76])),
    underRelease: held(view, open([-0.1, -0.19, -0.47], [0.2, -0.12, -0.97], [0.3, 0.94, 0.1])),
    underFollow: held(view, open([-0.04, -0.21, -0.58], [0.2, -0.3, -0.93], [0.88, 0.42, -0.2])),
    underBack: held(view, open([0.05, -0.32, -0.44], [0.2, 0.25, -0.95], [0.3, 0.9, 0.3]))
  };
}

/** A left hand in view space from where its straight fingers point and the way its palm faces. */
function open(pos: V3, toward: V3, facing: V3): Pose {
  const [a, b, c] = facing;
  const [d, e, f] = toward;
  return [pos, [b * f - c * e, c * d - a * f, a * e - b * d], toward];
}

/** Share of the way from the snatch to the release by which an unfetched bomb's ring has caught on the gun hand's thumb, and when (throw time) that thumb flicks the pin away. */
const CATCH = 0.2;
const TAP_FLICK = 0.27;
/** Fingers left long and loose as the bomb rolls off them. */
const TOSSED: FingerPose = { thumb: 0.24, index: 0.26, middle: 0.31, ring: 0.37, pinky: 0.44, spread: 0.04, oppose: 0.3 };

const m = new THREE.Matrix4();
const hook = new THREE.Vector3();
const seat = new THREE.Vector3();

/**
 * Left hand fetches the bomb from the belt and brings it up to the gun hand, whose thumb comes off the grip and hooks
 * the ring; the hands snatch apart, the thumb flicks the pin away, and the arm cocks back beside the head while the gun
 * sags to a one-handed low ready. Runs past the longest cook so the cocked arm and the gun keep breathing until the throw.
 */
export function cookClip(): Clip {
  const at = (seconds: number) => seconds / COOK;
  let live: { present: Goal; tugged: Goal; cocked: Goal } | null = null;
  return clip('cook', COOK, [[at(0.02), 'cloth'], [at(PULL), 'pinPull']], (u, f, c) => {
    const g = c.goals;
    const t = u * COOK;
    live ??= { present: held(c.view, PRESENT), tugged: held(c.view, TUGGED), cocked: held(c.view, COCKED) };

    // The bomb is offered so its ring slips over the gun hand's thumb; frozen once the pull starts so the snatch is clean.
    if (t < PULL) {
      const bomb = g.ring!.node;
      hook.setFromMatrixPosition(goalMatrix(g.ringHook!, m));
      seat.copy(g.ring!.pos).applyQuaternion(bomb.quaternion).add(bomb.position).applyQuaternion(live.present.quat);
      live.present.pos.copy(hook).sub(seat);
      live.tugged.pos.set(...TUG).add(live.present.pos);
    }
    const alive = seg(t, READY - 0.25, READY + 0.35);
    live.cocked.pos.set(COCKED[0][0] + Math.sin(t * 2.1) * 0.009 * alive, COCKED[0][1] + Math.sin(t * 1.6 + 1) * 0.015 * alive, COCKED[0][2] + Math.cos(t * 1.3) * 0.01 * alive + 0.02 * seg(t, READY, COOK));

    const meet = [MEET_AT[0] - c.tuning.hip[0], MEET_AT[1] - c.tuning.hip[1], MEET_AT[2] - c.tuning.hip[2], ...MEET_ROT];
    f.gun(track(u, [[0, Z], [at(GRAB * 0.7), SAG], [at(UP - 0.03), meet], [at(PULL), meet], [at(PULL + 0.07), meet.map((v, i) => v + YANK[i]!)], [at(READY - 0.04), DOWN]]));
    f.gun([0, Math.sin(t * 1.7) * 0.005, 0, Math.sin(t * 1.7 + 0.8) * 0.016, 0, Math.sin(t * 1.1) * 0.014], alive);

    f.left = hand(u, [[0, g.leftFrom!], [at(GRAB), g.low!], [at(UP), live.present], [at(PULL), live.present], [at(APART), live.tugged], [at(READY), live.cocked]]);
    f.leftFingers = fingers(u, [[0, c.tuning.fingers.left], [at(GRAB * 0.6), 'relaxed'], [at(GRAB), 'ball'], [at(APART), 'ball'], [at(READY - 0.12), SPOON]]);
    f.rightFingers = t > UP - 0.16 && t < FLICK + 0.22 ? fingers(u, [[at(UP - 0.16), 'trigger'], [at(UP - 0.04), THUMB_OUT], [at(UP + 0.01), THUMB_OUT], [at(PULL - 0.01), THUMB_SHUT], [at(FLICK - 0.02), THUMB_SHUT], [at(FLICK + 0.03), THUMB_OUT], [at(FLICK + 0.22), 'trigger']]) : null;

    f.show.grenade = t > GRAB - 0.04 ? 1 : 0;
    f.pin.hook = t >= PULL ? 1 : 0;
    f.pin.fly = t - FLICK;
    f.busy = seg(t, 0, 0.2);
  }, true);
}

/**
 * From the cocked arm: a short wind back, a whip forward through the release, the follow-through down across the
 * body, and the hand lands on the handguard as the gun comes back up. Underhand when low: a pendulum swing from the hip.
 * The bomb leaves the hand ~0.1 s in, when the host's grenade first shows through the interpolation delay.
 * `cooked` is how far the cook had come: a throw let go before the arm was cocked skips the wind and goes straight
 * for the release, the pin flying off on the way; one let go before the bomb was even fetched takes it up under the frame,
 * its ring catching on the gun hand's thumb as it sweeps past.
 */
export function throwClip(low: boolean, cooked: number): Clip {
  const out = low ? 0.16 : 0.14;
  const wind = 0.1;
  const landed = 0.62;
  const fetched = cooked >= GRAB - 0.04;
  const cocked = cooked >= READY - 0.2;
  const fetch = out * 0.42;
  const sag = fetched ? 1 : 0.5;
  const caught = fetch + (out - fetch) * CATCH;
  const spoon = cooked >= APART ? SPOON : 'ball';
  return clip('throw', 0.75, [[0.02, 'cloth'], [out, 'throw'], [out, 'release']], (u, f, c) => {
    const g = c.goals;
    const [back, release, follow] = low ? [g.underWind!, g.underRelease!, g.underFollow!] : [g.overWind!, g.overRelease!, g.overFollow!];
    f.gun(track(u, [[0, scaled(DOWN, sag)], [out, DOWN.map((v, i) => (v + [0.012, -0.012, 0.015, -0.05, -0.06, -0.05][i]!) * sag)], [0.6, [-0.004, 0.01, -0.01, 0.045, 0.015, 0.03]], [0.78, [0.001, -0.003, 0.002, -0.012, -0.003, -0.007]], [0.96, Z]]));
    const lead: [number, Goal][] = cocked ? [[0, g.leftFrom!], [wind, back]] : fetched ? [[0, g.leftFrom!]] : [[0, g.leftFrom!], [fetch, g.grenadeSnatch!]];
    if (cocked && low) lead.splice(1, 0, [wind * 0.42, g.underDrop!]);
    const after: [number, Goal][] = low ? [[out + 0.11, follow], [out + 0.27, g.underBack!]] : [[out + 0.15, follow]];
    f.left = hand(u, [...lead, [out, release], ...after, [landed, g.leftRest!]]);
    // The underhand lets the bomb roll off long fingers, which curl as the arm comes back round.
    const opened: [number, FingerShape | FingerPose][] = low ? [[out + 0.02, TOSSED], [out + 0.05, TOSSED], [out + 0.12, 'relaxed']] : [[out + 0.03, 'open'], [out + 0.16, 'relaxed']];
    f.leftFingers = u < landed ? fingers(u, [[0, fetched ? spoon : 'relaxed'], [fetched ? out - 0.03 : fetch, fetched ? spoon : 'ball'], [out - 0.03, 'ball'], ...opened, [landed, c.tuning.fingers.left]]) : null;
    f.show.grenade = u < out + 0.01 && (fetched || u >= fetch) ? 1 : 0;
    f.show.pin = true;
    if (fetched) f.pin.fly = Math.max(0, cooked - FLICK) + u * 0.75;
    else {
      // A bomb taken up under the frame sweeps its ring over the gun hand's thumb, which keeps the pin and flicks it away.
      f.pin.hook = seg(u, fetch, caught);
      f.pin.fly = (u - TAP_FLICK) * 0.75;
      f.gun(scaled(YANK, 0.35), seg(u, fetch - 0.02, caught + 0.04) * (1 - seg(u, caught + 0.06, caught + 0.24)));
      if (u < TAP_FLICK + 0.2) f.rightFingers = fingers(u, [[0, 'trigger'], [fetch - 0.03, THUMB_OUT], [caught, THUMB_SHUT], [TAP_FLICK - 0.02, THUMB_SHUT], [TAP_FLICK + 0.03, THUMB_OUT], [TAP_FLICK + 0.2, 'trigger']]);
    }
    f.busy = 1 - seg(u, 0.45, 0.64);
  });
}

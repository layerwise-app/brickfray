import * as THREE from 'three';
import { GRENADE } from '../defs';
import { hand, track, type Clip, type ClipCtx, type Frame } from './clip';
import { clip, held, Z, type Pose } from './clips-extra';
import { fingers } from './fingers';
import { goal, goalMatrix, type Goal } from './goals';
import { seg } from './springs';

/** One-handed low ready: the gun sags to the lower right and rolls outward while the left arm works. */
const DOWN = [0.04, -0.014, 0.03, -0.16, -0.14, -0.36];
/** The gun's weight drops into one hand as the other lets go. */
const SAG = [0.008, -0.022, 0.012, -0.07, -0.03, -0.09];
/** Where the gun hand comes to meet the bomb (grip in view space) and how the gun is turned there. */
const MEET_AT = [0.13, -0.15, -0.38] as const;
const MEET_ROT = [0.1, -0.22, -0.3] as const;
/** The gun hand's snatch as the pin comes out. */
const YANK = [0.035, 0.02, 0.03, 0.08, -0.1, -0.12];
/** Thumb and index of the gun hand, in the grip's frame. */
const PINCH = [-0.035, 0.035, -0.01] as const;

const PRESENT: Pose = [[0, 0, 0], [0.05, 1, 0.15], [0.6, 0, -0.8]];
const TUGGED: Pose = [[-0.1, -0.03, -0.05], [-0.3, 0.95, 0.1], [0.6, 0, -0.8]];
const COCKED: Pose = [[-0.15, 0.04, -0.34], [0.6, 0.1, 0.75], [0, 0.85, 0.5]];

/** Cook beats in seconds: hand at the belt, bomb presented, pin hooked, bomb snatched away, pin flicked, arm cocked. */
const GRAB = 0.16;
const UP = 0.36;
const PULL = 0.42;
const APART = 0.5;
const FLICK = 0.55;
const READY = 0.86;
const COOK = GRENADE.maxCook + 0.7;

/** View-space hand goals of the throw. */
export function grenadeGoals(view: THREE.Object3D): Record<string, Goal> {
  return {
    grenadeCocked: held(view, COCKED),
    overWind: held(view, [[-0.24, 0.1, -0.14], [0.5, 0.2, 0.85], [0, 0.6, 0.8]]),
    overRelease: held(view, [[-0.07, 0.09, -0.52], [1, 0, 0], [0, 0.7, -0.7]]),
    overFollow: held(view, [[0.05, -0.19, -0.43], [1, -0.1, 0.1], [0.1, -0.8, -0.6]]),
    underWind: held(view, [[-0.26, -0.3, -0.12], [-1, 0, 0], [0, -0.8, 0.6]]),
    underRelease: held(view, [[-0.08, -0.14, -0.5], [-1, 0, 0], [0, -0.3, -0.95]]),
    underFollow: held(view, [[-0.04, -0.03, -0.56], [-1, 0, 0.1], [0, 0.5, -0.85]])
  };
}

const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const seat = new THREE.Vector3();

/**
 * Left hand fetches the bomb from the belt and brings it up to the gun hand, which hooks the ring; the hands snatch
 * apart, the pin is flicked away, and the arm cocks back beside the head while the gun sags to a one-handed low ready.
 * Runs past the longest cook so the cocked arm and the gun keep breathing until the throw.
 */
export function cookClip(): Clip {
  const at = (seconds: number) => seconds / COOK;
  let live: { pinch: Goal; present: Goal; tugged: Goal; cocked: Goal } | null = null;
  return clip('cook', COOK, [[at(0.02), 'cloth'], [at(PULL), 'pinPull']], (u, f, c) => {
    const g = c.goals;
    const t = u * COOK;
    live ??= {
      pinch: goal(g.rightRest!.node, PINCH, new THREE.Quaternion()),
      present: held(c.view, PRESENT),
      tugged: held(c.view, TUGGED),
      cocked: held(c.view, COCKED)
    };
    const pinch = p.setFromMatrixPosition(goalMatrix(live.pinch, m));

    // The bomb is offered so its ring sits in the gun hand's fingers; frozen once the pull starts so the snatch is clean.
    if (t < PULL) {
      const bomb = g.ring!.node;
      seat.copy(g.ring!.pos).applyQuaternion(bomb.quaternion).add(bomb.position).applyQuaternion(live.present.quat);
      live.present.pos.copy(pinch).sub(seat);
      live.tugged.pos.set(...TUGGED[0]).add(live.present.pos);
    }
    const alive = seg(t, READY - 0.25, READY + 0.35);
    live.cocked.pos.set(COCKED[0][0] + Math.sin(t * 2.1) * 0.009 * alive, COCKED[0][1] + Math.sin(t * 1.6 + 1) * 0.015 * alive, COCKED[0][2] + Math.cos(t * 1.3) * 0.01 * alive + 0.02 * seg(t, READY, COOK));

    const meet = [MEET_AT[0] - c.tuning.hip[0], MEET_AT[1] - c.tuning.hip[1], MEET_AT[2] - c.tuning.hip[2], ...MEET_ROT];
    f.gun(track(u, [[0, Z], [at(GRAB * 0.7), SAG], [at(UP), meet], [at(PULL), meet], [at(PULL + 0.07), meet.map((v, i) => v + YANK[i]!)], [at(READY - 0.04), DOWN]]));
    f.gun([0, Math.sin(t * 1.7) * 0.005, 0, Math.sin(t * 1.7 + 0.8) * 0.016, 0, Math.sin(t * 1.1) * 0.014], alive);

    f.left = hand(u, [[0, g.leftRest!], [at(GRAB), g.low!], [at(UP), live.present], [at(PULL), live.present], [at(APART), live.tugged], [at(READY), live.cocked]]);
    f.leftFingers = fingers(u, [[0, 'support'], [at(GRAB * 0.6), 'relaxed'], [at(GRAB), 'ball']]);
    f.rightFingers = t > UP - 0.1 && t < FLICK + 0.2 ? fingers(u, [[at(UP - 0.1), 'trigger'], [at(PULL - 0.02), 'pinch'], [at(FLICK), 'pinch'], [at(FLICK + 0.05), 'relaxed'], [at(FLICK + 0.2), 'trigger']]) : null;

    f.show.grenade = t > GRAB - 0.04;
    f.show.pin = t < FLICK + 0.4;
    if (t >= PULL) pinOut(f, c, pinch, t);
    f.busy = seg(t, 0, 0.2);
  }, true);
}

/** The pin stays in the gun hand's fingers as the bomb is snatched away, then is flicked up and falls. */
function pinOut(f: Frame, c: ClipCtx, pinch: THREE.Vector3, t: number) {
  const ring = goalMatrix(c.goals.ring!, m);
  seat.setFromMatrixPosition(ring).lerp(pinch, seg(t, PULL, PULL + 0.03));
  const fly = Math.max(0, t - FLICK);
  seat.x -= 0.25 * fly;
  seat.y += 1.1 * fly - 4.5 * fly * fly;
  seat.z -= 0.2 * fly;
  seat.applyMatrix4(ring.invert());
  f.part('pin', [seat.x, seat.y, seat.z]);
}

/**
 * From the cocked arm: a short wind back, a whip forward through the release, the follow-through down across the
 * body, and the hand lands on the handguard as the gun comes back up. Underhand when low: a scoop from the hip.
 * The bomb leaves the hand ~0.1 s in, when the host's grenade first shows through the interpolation delay.
 */
export function throwClip(low: boolean): Clip {
  const out = low ? 0.16 : 0.14;
  const wind = low ? 0.075 : 0.06;
  const landed = 0.62;
  return clip('throw', 0.75, [[0.02, 'cloth'], [out, 'throw'], [out, 'release']], (u, f, c) => {
    const g = c.goals;
    const [back, release, follow] = low ? [g.underWind!, g.underRelease!, g.underFollow!] : [g.overWind!, g.overRelease!, g.overFollow!];
    f.gun(track(u, [[0, DOWN], [out, DOWN.map((v, i) => v + [0.012, -0.012, 0.015, -0.05, -0.06, -0.05][i]!)], [0.6, [-0.004, 0.01, -0.01, 0.045, 0.015, 0.03]], [0.78, [0.001, -0.003, 0.002, -0.012, -0.003, -0.007]], [0.96, Z]]));
    f.left = hand(u, [[0, g.grenadeCocked!], [wind, back], [out, release], [out + 0.15, follow], [landed, g.leftRest!]]);
    f.leftFingers = u < landed ? fingers(u, [[0, 'ball'], [out - 0.03, 'ball'], [out + 0.03, 'open'], [out + 0.26, 'relaxed'], [landed, 'support']]) : null;
    f.show.grenade = u < out + 0.01;
    f.show.pin = false;
    f.busy = 1 - seg(u, 0.45, 0.64);
  });
}

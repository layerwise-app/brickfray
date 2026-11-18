import * as THREE from 'three';
import { track, type Clip, type ClipCtx, type ClipEvent, type Frame, type Keys } from './clip';
import { goal, type Goal } from './goals';
import { seg } from './springs';

export const Z = [0, 0, 0, 0, 0, 0];
export type Events = (readonly [number, ClipEvent])[];

/** A clip authored in seconds of a nominal length `beats`; the sim's duration stretches it. */
export function clip(name: string, duration: number, beats: number, events: Events, sample: (t: number, f: Frame, c: ClipCtx) => void, hold = false): Clip {
  return {
    name,
    duration,
    events: events.map(([t, e]) => [t / beats, e] as const).sort((a, b) => a[0] - b[0]),
    hold,
    sample: (u, f, c) => sample(u * beats, f, c)
  };
}

/**
 * The knock a contact gives the gun, `seconds` after it lands: nothing before,
 * full two frames later, then one small rebound and rest.
 */
export function jolt(seconds: number) {
  if (seconds <= 0 || seconds > 0.4) return 0;
  return Math.exp(-seconds / 0.06) * Math.sin(seconds * 44) * 1.69;
}

const gunQ = new THREE.Quaternion();
const gunP = new THREE.Vector3();
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const lq = new THREE.Quaternion();
const e = new THREE.Euler();

/**
 * Hands a part over from the gun to a hand that carries it: at `k` 0 the part
 * sits at its gun-space offset `local`; at 1 its `hold` node sits at the
 * view-space pose `view`, however the clip moves the gun meanwhile. `seat` is
 * the part's rest place on the gun. Call after the frame's last `f.gun()`.
 */
export function carry(f: Frame, c: ClipCtx, part: string, seat: Goal, hold: THREE.Object3D, local: readonly number[], view: readonly number[], k: number) {
  if (k <= 0) return f.part(part, local);
  const t = c.tuning;
  gunQ.setFromEuler(e.set(...t.hipRot)).multiply(q.setFromEuler(e.set(f.gunRot.x, f.gunRot.y, f.gunRot.z)));
  gunP.set(...t.hip).add(f.gunPos);
  // Part pose in view space, then in the gun's, then as an offset from its seat.
  q.setFromEuler(e.set(view[3] ?? 0, view[4] ?? 0, view[5] ?? 0)).multiply(lq.copy(hold.quaternion).invert());
  p.copy(hold.position).negate().applyQuaternion(q).add(gunP.set(view[0]! - gunP.x, view[1]! - gunP.y, view[2]! - gunP.z));
  gunQ.invert();
  p.applyQuaternion(gunQ).sub(seat.pos);
  q.premultiply(gunQ).premultiply(lq.copy(seat.quat).invert());
  lq.setFromEuler(e.set(local[3] ?? 0, local[4] ?? 0, local[5] ?? 0)).slerp(q, k);
  e.setFromQuaternion(lq);
  f.part(part, [lerp(local[0] ?? 0, p.x, k), lerp(local[1] ?? 0, p.y, k), lerp(local[2] ?? 0, p.z, k), e.x, e.y, e.z]);
}

/**
 * View-space pose [x, y, z, rx, ry, rz] of a part's `hold` node when the gun
 * sits at the clip offset `gun` and the part at its gun-space offset `local`:
 * the place a carrying hand takes the part over or gives it back.
 */
export function viewOf(c: ClipCtx, gun: readonly number[], seat: Goal, hold: THREE.Object3D, local: readonly number[]): number[] {
  const t = c.tuning;
  gunQ.setFromEuler(e.set(...t.hipRot)).multiply(q.setFromEuler(e.set(gun[3] ?? 0, gun[4] ?? 0, gun[5] ?? 0)));
  q.copy(gunQ).multiply(seat.quat).multiply(lq.setFromEuler(e.set(local[3] ?? 0, local[4] ?? 0, local[5] ?? 0)));
  p.set(local[0] ?? 0, local[1] ?? 0, local[2] ?? 0).add(seat.pos).applyQuaternion(gunQ);
  p.add(gunP.copy(hold.position).applyQuaternion(q));
  e.setFromQuaternion(q.multiply(hold.quaternion));
  return [t.hip[0] + (gun[0] ?? 0) + p.x, t.hip[1] + (gun[1] ?? 0) + p.y, t.hip[2] + (gun[2] ?? 0) + p.z, e.x, e.y, e.z];
}

/** A view-space hand goal: where the hand on `on` is when the node `on` hangs from sits at the view pose `view`. */
export function viewGoal(c: ClipCtx, view: readonly number[], on: Goal): Goal {
  q.setFromEuler(e.set(view[3] ?? 0, view[4] ?? 0, view[5] ?? 0));
  p.copy(on.pos).applyQuaternion(q);
  return goal(c.view, [view[0]! + p.x, view[1]! + p.y, view[2]! + p.z], q.clone().multiply(on.quat));
}

export interface Swap {
  /** Gun offsets as the magazine leaves and as the fresh one arrives. */
  present: readonly number[];
  meet: readonly number[];
  /** Magazine offsets in the well's frame: unlatched, clear of the well, lined up under it, at its mouth. */
  tug: readonly number[];
  clear: readonly number[];
  under: readonly number[];
  mouth: readonly number[];
  /** The carrying hand in view space: dropping out of frame, at the pouch, coming back up. */
  leave: readonly number[];
  pouch: readonly number[];
  back: readonly number[];
  /** Seconds: grip tightens, unlatched, clear, out of frame, pouch, back in frame, under the well, at the mouth, slam starts, seated. */
  at: readonly [number, number, number, number, number, number, number, number, number, number];
  /** Knocks the gun takes from the rip and from the seat. */
  rip: readonly number[];
  slam: readonly number[];
}

/**
 * A hand-carried magazine change: pulled down the well, carried out of frame
 * in view space, a fresh one brought back the same way and slammed home.
 * The hand rides the magazine's hold node the whole time.
 */
export function magSwap(o: Swap) {
  const a = o.at;
  const local: Keys = [[a[0], Z], [a[1], o.tug], [a[2], o.clear], [a[6], o.under], [a[7], o.mouth], [a[8], scale(o.mouth, 0.86)], [a[9], Z]];
  let path: Keys | null = null;
  return (t: number, f: Frame, c: ClipCtx) => {
    const seat = c.goals.magazineSeat!;
    const hold = c.goals.mag!.node;
    path ??= [
      [a[1], viewOf(c, o.present, seat, hold, o.tug)],
      [a[2], viewOf(c, o.present, seat, hold, o.clear)],
      [a[3], o.leave],
      [a[4], o.pouch],
      [a[5], o.back],
      [a[6], viewOf(c, o.meet, seat, hold, o.under)],
      [a[7], viewOf(c, o.meet, seat, hold, o.mouth)]
    ];
    f.gun(o.rip, jolt(t - (a[1] + a[2]) / 2));
    f.gun(o.slam, jolt(t - a[9] + 0.01));
    const k = seg(t, a[1] + 0.03, a[2] + 0.04) * (1 - seg(t, a[5] + 0.06, a[6] + 0.02));
    carry(f, c, 'magazine', seat, hold, track(t, local), track(t, path), k);
  };
}

function scale(v: readonly number[], k: number) {
  return v.map((x) => x * k);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

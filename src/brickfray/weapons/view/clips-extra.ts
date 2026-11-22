import * as THREE from 'three';
import { hand, track, type Clip, type ClipEvent } from './clip';
import { SIDEARMS, type WeaponId } from '../defs';
import { jolt } from './clips-kit';
import { fingers } from './fingers';
import { goal, holdQuat, type Goal, type V3 } from './goals';
import { seg } from './springs';

export const Z = [0, 0, 0, 0, 0, 0];
export type Events = (readonly [number, ClipEvent])[];
/** A hand placement in view space: position, tool axis, the direction the fingers' side faces. */
export type Pose = readonly [pos: V3, axis: V3, face: V3];

export function clip(name: string, duration: number, events: Events, sample: Clip['sample'], hold = false): Clip {
  return { name, duration, events: [...events].sort((a, b) => a[0] - b[0]), sample, hold };
}

export function held(view: THREE.Object3D, [pos, axis, face]: Pose): Goal {
  return goal(view, pos, holdQuat(axis, face));
}

export function scaled(v: readonly number[], k: number) {
  return v.map((x) => x * k);
}

/**
 * View-space hand goals shared by the clips: the belt, out of frame, and where the left hand was when the running
 * clip cut in (the view model keeps it current), so a clip can lead the hand on from there instead of from the gun.
 */
export function extraGoals(view: THREE.Object3D): Record<string, Goal> {
  return { low: held(view, [[-0.2, -0.33, -0.3], [0.2, 1, -0.2], [1, 0, -0.3]]), leftFrom: goal(view, [0, 0, 0], new THREE.Quaternion()) };
}

/** A gun's switch arc, each pose [x, y, z, pitch, yaw, roll] off its rest: where it is halfway out, where it has just left the frame, and what it overshoots to as a draw brings it up over `rise` seconds. */
interface Arc {
  mid: readonly number[];
  away: readonly number[];
  rise: number;
  up: readonly number[];
}
/** A rifle rolls onto its side first, so the hands under it go out with it, then drops away to the lower right. */
const RIFLE: Arc = { mid: [0.012, -0.03, 0.012, -0.1, -0.05, -0.72], away: [0.05, -0.13, 0.045, -0.34, -0.1, -1.1], rise: 0.13, up: [-0.006, 0.02, -0.02, 0.1, 0.03, 0.1] };
/** A long heavy gun lets its muzzle fall first, slung, and sinks; it comes back up slower, muzzle last. */
const SLUNG: Arc = { mid: [0.01, -0.025, 0.02, -0.42, -0.03, -0.1], away: [0.055, -0.17, 0.06, -0.5, -0.07, -0.28], rise: 0.21, up: [-0.004, 0.012, -0.012, 0.05, 0.02, 0.04] };
/** A sidearm turns muzzle down and out toward the hip. */
const HIP: Arc = { mid: [0.01, -0.04, 0.02, -0.12, 0.15, -0.4], away: [0.04, -0.19, 0.07, -0.35, 0.4, -0.95], rise: 0.11, up: [-0.01, 0.024, -0.02, 0.17, 0.06, 0.26] };
/**
 * A long gun traded for a sidearm is let go to hang on its sling: it falls away to the lower left, muzzle dropping and
 * rolling over, while the sidearm comes out of the other side. Back from a sidearm it is swung up off the sling the same
 * way and overshoots the other way as it lands in the hands.
 */
const SLING: Arc = { mid: [-0.02, -0.06, 0.02, -0.3, 0.14, 0.42], away: [-0.06, -0.19, 0.05, -0.62, 0.28, 0.8], rise: 0.15, up: [0.006, 0.018, -0.018, 0.09, -0.05, -0.16] };
const SLUNG_GUNS = new Set<WeaponId>(['sniper', 'shotgun', 'harpoon']);
/** The way a gun leaves for `to`, and the way `to` comes in after `from`: each pair of classes has its own. */
const outArc = (from: WeaponId, to: WeaponId | null) => (SIDEARMS.has(from) ? HIP : to && SIDEARMS.has(to) ? SLING : SLUNG_GUNS.has(from) ? SLUNG : RIFLE);
const inArc = (from: WeaponId | null, to: WeaponId) => (SIDEARMS.has(to) ? HIP : from && SIDEARMS.has(from) ? SLING : SLUNG_GUNS.has(to) ? SLUNG : RIFLE);
/** How far along its way in (away to mid) a gun brought straight back up starts. */
const EDGE = 0.5;

/** Grown frame a drawn gun must start wholly outside of, so not even a corner of it shows before its hands. */
export const DRAW_MARGIN = 1.05;

/**
 * Where along its way in (away 0, mid 1) a gun drawn after `from` starts: the furthest in at which `outside` (the gun
 * at that clip offset) still finds it wholly out of the picture, so the first frame it shows it is already moving in.
 */
export function drawEdge(from: WeaponId, to: WeaponId, stow: number, outside: (offset: readonly number[]) => boolean) {
  const a = inArc(from, to);
  const k = SIDEARMS.has(to) ? 1 : stow;
  let edge = -0.7;
  for (let e = -0.65; e < 0.85; e += 0.05) {
    if (!outside(a.away.map((x, i) => (x + (a.mid[i]! - x) * e) * k))) break;
    edge = e;
  }
  return edge;
}

/** The knock the gun takes as the support hand lands on it at the end of a draw. */
const SEAT_KNOCK = [0.001, -0.005, 0.003, -0.02, 0.004, 0.012];

/** How far past its `away` pose a holster has the gun by its end: a quick holster still has it wholly out of the picture when the swap comes. */
const HOLSTER_END = 1.15;

/** The gun takes its arc out of the frame, still speeding up as it leaves; the cross-fade from the firing pose is its ease-in. */
export function holsterClip(duration: number, to: WeaponId | null = null): Clip {
  return clip('holster', duration, [[0, 'holster'], [1, 'swap']], (u, f, c) => {
    const a = outArc(c.id, to);
    const k = c.tuning.stow ?? 1;
    f.gun(track(u, [[-0.4, scaled(a.away, -0.2 * k)], [0, Z], [0.45, scaled(a.mid, k)], [1, scaled(a.away, HOLSTER_END * k)], [1.5, scaled(a.away, 1.7 * k)]]));
    f.busy = 1;
  });
}

/**
 * Gun comes up its arc already moving in the firing hand, overshoots, drops back and settles; a slow draw spends the
 * rest settling, not below the frame. Drawn after `from` it starts at `edge` (see drawEdge) with the support hand hanging
 * off it, which comes up and takes its grip as the gun lands: the ready beat. Without `from` (the same gun brought back
 * mid-holster) it comes straight back up from wherever it was.
 */
export function drawClip(duration: number, sidearm = false, from: WeaponId | null = null, edge = EDGE): Clip {
  return clip('draw', duration, [[0, 'draw'], [0.15, 'cloth']], (u, f, c) => {
    const a = inArc(from, c.id);
    const k = sidearm ? 1 : (c.tuning.stow ?? 1);
    const rise = Math.min(0.56, a.rise / duration);
    const settle = rise + (1 - rise) * 0.55;
    const start = a.away.map((x, i) => x + (a.mid[i]! - x) * edge);
    if (sidearm) {
      // Flourish: turned up out of the hip, the wrist snaps it past square, canted in and muzzle high, and it settles; a revolver's cylinder spins down.
      f.gun(track(u, [[-rise, scaled(a.away, 1.7)], [0, start], [rise * 0.85, a.up], [settle, [0.001, -0.004, 0.003, -0.02, 0, -0.04]], [1, Z]]));
      if (c.id === 'cannon') f.part('cylinder', [0, 0, 0, 0, 0, -Math.PI * 4 * (1 - (1 - seg(u, 0, settle)) ** 2)]);
    } else f.gun(track(u, [[-rise, scaled(a.away, 1.7 * k)], [0, scaled(start, k)], [rise * 0.4, scaled(a.mid, k)], [rise, a.up], [settle, [0.001, -0.005, 0.004, -0.02, -0.005, -0.01]], [1, Z]]));
    f.busy = 1 - seg(u, rise, 1);
    if (!from) return;
    const seat = rise + (settle - rise) * 0.45;
    f.gun(SEAT_KNOCK, jolt((u - seat) * duration));
    if (u >= seat) return;
    const g = c.goals;
    f.left = hand(u, [[0, g.leftOff!], [rise * 0.55, g.leftOff!], [seat, g.leftRest!]]);
    f.leftFingers = fingers(u, [[0, 'relaxed'], [rise * 0.55, 'reach'], [seat, c.tuning.fingers.left]]);
  });
}

/** Ease back to the idle pose from wherever the last clip left off (cross-fade does the work). */
export function restClip(duration: number): Clip {
  return clip('rest', duration, [], (u, f) => {
    f.busy = 1 - u;
  });
}

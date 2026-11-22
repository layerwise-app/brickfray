import * as THREE from 'three';
import type { GunAction } from './action';
import type { Frame } from './clip';
import type { Drops } from './drops';
import type { GunRig } from './rig';
import { smooth01 } from './springs';

/** Seconds a part on the gun (bolt, slide, pump, cylinder) takes to leave the pose an interrupted clip left it in. */
const PART_FADE = 0.17;
/** Parts a hand carries off the gun, with the end (in the part's frame) that shows while it is seated. */
const CARRIED: Record<string, readonly [number, number, number]> = { magazine: [0, -1, 0], spear: [0, 0, -1], speedloader: [0, 0, 1] };
/** A carried part that sits in another moving part: the revolver's rounds stay in the cylinder as it swings out. */
const RIDES: Record<string, string> = { speedloader: 'cylinder' };
/** Further than this from its seat a carried part is out of the gun: in a hand or falling. */
const LOOSE = 0.025;
/** A magazine cut off this close to its seat, still lined up with the well, is pushed home by the hand leaving it instead of dropped, over HOMING seconds. */
const HOME = 0.065;
const HOME_TILT = 0.4;
const HOMING = 0.07;

interface Offset {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}

interface Track {
  at: THREE.Vector3;
  speed: THREE.Vector3;
  box: THREE.Box3;
}

const e = new THREE.Euler();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const blend = new THREE.Quaternion();
const point = new THREE.Vector3();
const size = new THREE.Vector3();
const inverse = new THREE.Matrix4();
const local = new THREE.Box3();
const shift = new THREE.Vector3();

/**
 * Poses a gun's moving parts: rest pose plus this frame's offset. When a clip cuts in on another, a part that stays
 * on the gun eases over from where it was. A part that was out of the gun (a magazine in the hand) is let go instead:
 * it falls, and the gun gets its own back only where nobody sees it arrive.
 */
export class Parts {
  private readonly from = new Map<string, Offset>();
  private readonly tracks = new WeakMap<THREE.Object3D, Track>();
  private readonly missing = new Set<string>();
  private fade = 0;
  private homing = 0;
  /** Carried parts a clip of their own brings back (a rifle's magazine dropped by a cut-off reload): never put back unseen. */
  readonly refilled = new Set<string>();

  /** Whether a carried part is out of the gun and not yet brought back. */
  lacks(name: string) {
    return this.missing.has(name);
  }

  /** A new clip starts on `rig`: remember where every part is now, and let anything out of its seat fall. Returns whether a magazine at the mouth of its well was pushed home. */
  capture(rig: GunRig, drops: Drops) {
    let home = false;
    for (const [name, rest] of rig.rest) {
      const part = rig.rigged.parts.get(name)!;
      this.from.delete(name);
      if (!part.visible) continue;
      const off = pos.subVectors(part.position, rest.pos).sub(seatShift(rig, name)).length();
      if (CARRIED[name] && off > LOOSE) {
        if (name === 'magazine' && off < HOME && rest.quat.angleTo(part.quaternion) < HOME_TILT) {
          home = true;
        } else {
          drops.add(part, this.track(part).speed);
          this.missing.add(name);
          continue;
        }
      }
      this.from.set(name, { pos: part.position.clone().sub(rest.pos), quat: rest.quat.clone().invert().multiply(part.quaternion) });
    }
    this.fade = 1;
    this.homing = home ? 1 : 0;
    return home;
  }

  /** Forget any blend and anything dropped: the next pose is taken as is (a fresh gun). */
  reset() {
    this.fade = this.homing = 0;
    this.missing.clear();
  }

  /** Each part gets the clip's offset from rest this frame, else whatever a shot set going on it. */
  apply(rig: GunRig, dt: number, f: Frame, action: GunAction) {
    this.fade = Math.max(0, this.fade - dt / PART_FADE);
    if (this.homing > 0) this.homing = Math.max(1e-6, this.homing - dt / HOMING);
    const k = smooth01(1 - this.fade);
    for (const [name, rest] of rig.rest) {
      const part = rig.rigged.parts.get(name)!;
      const o = action.offset(rig, f, name);
      if (o) this.missing.delete(name);
      if (CARRIED[name]) part.visible = !this.missing.has(name) && (o !== undefined || !action.gone(rig, name));
      pos.set(o?.[0] ?? 0, o?.[1] ?? 0, o?.[2] ?? 0);
      if (o) quat.setFromEuler(e.set(o[3] ?? 0, o[4] ?? 0, o[5] ?? 0));
      else if (!action.turn(rig, name, quat)) quat.identity();
      const from = this.fade > 0 ? this.from.get(name) : undefined;
      if (from) {
        const w = name === 'magazine' && this.homing > 0 ? smooth01(1 - this.homing) : k;
        pos.lerpVectors(from.pos, pos, w);
        quat.copy(blend.slerpQuaternions(from.quat, quat, w));
      }
      part.position.copy(rest.pos).add(pos);
      part.quaternion.copy(rest.quat).multiply(quat);
    }
  }

  /** After the gun is placed: follow the carried parts (a dropped one keeps its speed) and put back what cannot be seen arriving. */
  settle(rig: GunRig, dt: number, camera: THREE.Camera) {
    for (const name in CARRIED) {
      const part = rig.rigged.parts.get(name);
      if (!part) continue;
      const t = this.track(part);
      point.setFromMatrixPosition(part.matrixWorld);
      if (dt > 0) t.speed.subVectors(point, t.at).divideScalar(dt);
      t.at.copy(point);
      if (!this.missing.has(name) || this.refilled.has(name)) continue;
      // Rounds go back into a cylinder as it shuts on them; anything else once its seat is out of the picture.
      const shut = RIDES[name] !== undefined && this.fade <= 0 && seatShift(rig, name).lengthSq() < 1e-8;
      if (shut || unseen(part, t.box, CARRIED[name]!, camera)) this.missing.delete(name);
    }
  }

  private track(part: THREE.Object3D) {
    let t = this.tracks.get(part);
    if (!t) this.tracks.set(part, (t = { at: new THREE.Vector3(), speed: new THREE.Vector3(), box: bounds(part) }));
    return t;
  }
}

/** How far the part that `name` rides in has moved its seat. */
function seatShift(rig: GunRig, name: string) {
  const carrier = RIDES[name];
  if (!carrier) return shift.set(0, 0, 0);
  return shift.subVectors(rig.rigged.parts.get(carrier)!.position, rig.rest.get(carrier)!.pos);
}

/** The part's box in its own frame. */
function bounds(part: THREE.Object3D) {
  const box = new THREE.Box3();
  part.updateWorldMatrix(true, true);
  inverse.copy(part.matrixWorld).invert();
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    box.union(local.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
  });
  return box;
}

/** Whether the half of a seated part that shows (`end` is its outer end) is out of the picture. */
function unseen(part: THREE.Object3D, box: THREE.Box3, end: readonly [number, number, number], camera: THREE.Camera) {
  box.getSize(size).multiplyScalar(0.5);
  for (const reach of [0, 1]) {
    box.getCenter(point);
    point.x += end[0] * size.x * reach;
    point.y += end[1] * size.y * reach;
    point.z += end[2] * size.z * reach;
    point.applyMatrix4(part.matrixWorld).project(camera);
    if (Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1) return false;
  }
  return true;
}

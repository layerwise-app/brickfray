import * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';

/** How far the camera backs off the body, the gap it keeps from walls, and how high it rises (rad above level). */
const REACH = 3.6;
const MARGIN = 0.42;
const SHORTEST = 1.3;
const RISE = [0.42, 0.75, 1.1] as const;
/** Turns tried round the preferred side (rad); the camera settles on the best clear one and keeps it unless it is lost. */
const TURNS = [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.75, -1.75, Math.PI] as const;
const RETHINK = 0.3;

const v = new THREE.Vector3();
const w = new THREE.Vector3();
const w2 = new THREE.Vector3();
const goal = new THREE.Vector3();
const toBody = new THREE.Vector3();
const toKiller = new THREE.Vector3();
const axis = new THREE.Vector3();
const near: number[] = [];
const UP = new THREE.Vector3(0, 1, 0);
const CANDIDATES: { dir: THREE.Vector3; length: number; score: number }[] = [];

/**
 * The view after the local player dies: it backs out of the head along a clear line to a spot above and behind the
 * body, on the side away from the killer, so the falling pieces are in the foreground and the killer beyond them.
 * The arm from the body to the camera is cast against the world every frame, so it is never inside a wall, an
 * awning or a roof; candidate spots are scored on how much room they have and whether the killer can be seen.
 */
export class DeathCam {
  readonly body = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  /** Smoothed view direction, and the point it keeps in frame (the body's pieces). */
  private readonly view = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private length = 0;
  private targetLength = REACH;
  private rethink = 0;
  private time = 0;
  /** Height of the floor the body lies on. */
  private floor = 0;
  /** Widest angle off the view centre that stays well inside the frame (rad). */
  private reach = 0.45;
  /** Set by `begin`, cleared when the player is back. */
  active = false;

  constructor(private readonly world: CollisionWorld) {}

  /** Starts from the eye at the moment of death, looking along `forward`. */
  begin(eye: THREE.Vector3, forward: THREE.Vector3) {
    this.body.copy(eye).setY(eye.y - 0.75);
    const floor = this.world.raycast(this.body.x, this.body.y, this.body.z, 0, -1, 0, 1.5, false);
    this.floor = this.body.y - (floor ? floor.t : 0.85);
    this.dir.copy(eye).sub(this.body).normalize();
    this.length = eye.distanceTo(this.body);
    this.view.copy(forward).normalize();
    this.target.copy(forward).setY(0).normalize().negate();
    if (this.target.lengthSq() < 1e-6) this.target.set(0, 0, 1);
    this.active = true;
    this.rethink = 0;
    this.time = 0;
    this.choose(null, true);
  }

  /** `pieces`: the body's own pieces, followed as they scatter (those that stray far are left out). */
  update(dt: number, camera: THREE.PerspectiveCamera, killer: THREE.Vector3 | null, pieces: readonly THREE.Object3D[] = []) {
    this.time += dt;
    this.rethink -= dt;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    this.reach = 0.7 * Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    if (this.rethink <= 0) {
      this.rethink = RETHINK;
      this.choose(killer, false);
    }
    // Swing the arm round toward the chosen side and let it out; it pulls in at once wherever the world is closer.
    const ease = 1 - Math.exp(-dt * (this.time < 0.9 ? 4.5 : 2.2));
    this.dir.lerp(this.target, ease).normalize();
    this.length += (this.targetLength - this.length) * ease;
    const room = this.room(this.dir, REACH);
    if (this.length > room) this.length = room;
    camera.position.copy(this.body).addScaledVector(this.dir, this.length);
    this.unstick(camera.position);
    // Always the body; the killer too when it can be seen and both fit in the frame.
    const c = camera.position;
    goal.copy(this.body).setY(this.body.y + 0.25);
    let n = 0;
    w.set(0, 0, 0);
    for (const piece of pieces) {
      if (!piece.parent || piece.getWorldPosition(v).distanceToSquared(this.body) > 9) continue;
      w.add(v);
      n++;
    }
    if (n) goal.lerp(w.divideScalar(n), 0.7);
    this.focus.lerp(goal, this.time < dt * 1.5 ? 1 : 1 - Math.exp(-dt * 6));
    toBody.copy(this.focus).sub(c).normalize();
    goal.copy(toBody);
    if (killer && this.sees(c, killer)) {
      toKiller.copy(killer).sub(c).normalize();
      const apart = toBody.angleTo(toKiller);
      if (apart > 1e-3 && apart < 2 * this.reach && axis.crossVectors(toBody, toKiller).lengthSq() > 1e-8) goal.applyAxisAngle(axis.normalize(), apart / 2);
    }
    this.view.lerp(goal, 1 - Math.exp(-dt * (this.time < 0.4 ? 9 : 5))).normalize();
    camera.lookAt(goal.copy(c).add(this.view));
    camera.updateMatrixWorld();
  }

  /** Clear length along `d` from the body, short of anything in the way by the margin. */
  private room(d: THREE.Vector3, reach: number) {
    const b = this.body;
    const hit = this.world.raycast(b.x, b.y, b.z, d.x, d.y, d.z, reach + MARGIN, false);
    return hit ? Math.max(0.2, hit.t - MARGIN) : reach;
  }

  /** Pulls a spot out of any box it sits in (a ray along a wall's face can graze it). */
  private unstick(p: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      if (!this.world.overlaps(p.x - 0.18, p.y - 0.18, p.z - 0.18, p.x + 0.18, p.y + 0.18, p.z + 0.18, near).length) return;
      p.lerp(this.body, 0.2);
    }
  }

  /** Whether a figure whose chest is at `chest` stands within reach of `from` or across its line to the body. */
  private blocks(chest: THREE.Vector3, from: THREE.Vector3) {
    for (let i = 0; i <= 6; i++) {
      w2.copy(from).lerp(this.body, i / 6);
      if (w2.y < chest.y - 1.4 || w2.y > chest.y + 0.6) continue;
      if (Math.hypot(w2.x - chest.x, w2.z - chest.z) < (i === 0 ? 1.3 : 0.55)) return true;
    }
    return false;
  }

  private choose(killer: THREE.Vector3 | null, first: boolean) {
    // Prefer the side of the body away from the killer, else behind where the player was looking.
    if (killer) {
      goal.copy(this.body).sub(killer).setY(0);
      if (goal.lengthSq() > 1e-4) this.target.copy(goal.normalize());
    }
    const base = Math.atan2(this.target.x, this.target.z);
    let n = 0;
    for (const turn of TURNS) {
      for (const rise of RISE) {
        const yaw = base + (killer ? 0.3 : 0) + turn;
        w.set(Math.sin(yaw) * Math.cos(rise), Math.sin(rise), Math.cos(yaw) * Math.cos(rise));
        const length = this.room(w, REACH);
        if (length < SHORTEST) continue;
        v.copy(this.body).addScaledVector(w, length);
        let score = length - 0.55 * Math.abs(turn) - 0.6 * (rise - RISE[0]);
        // The killer standing by the camera or between it and the body would fill the frame.
        if (killer && this.blocks(killer, v)) score -= 4;
        else if (killer && this.sees(v, killer)) {
          // Seen, and better still when body and killer fit in one frame from here.
          toBody.copy(this.body).sub(v).normalize();
          toKiller.copy(killer).sub(v).normalize();
          score += toBody.angleTo(toKiller) < 1.8 * this.reach ? 2.5 : 0.3;
        }
        // Keep the current side unless another is clearly better.
        if (!first && w.dot(this.dir) > 0.9) score += 0.8;
        const c = (CANDIDATES[n++] ??= { dir: new THREE.Vector3(), length: 0, score: 0 });
        c.dir.copy(w);
        c.length = length;
        c.score = score;
      }
    }
    // Best first, taking the first whose view of the whole body is clear (not just of its middle).
    const ranked = CANDIDATES.slice(0, n).sort((a, b) => b.score - a.score);
    const pick = ranked.find((c) => this.clearView(c.dir, c.length)) ?? ranked[0];
    if (pick) {
      this.target.copy(pick.dir);
      this.targetLength = pick.length;
    } else {
      // Boxed in: up from the body, leaning a little to the preferred side, as far as the room allows.
      this.target.set(Math.sin(base) * 0.3, 1, Math.cos(base) * 0.3).normalize();
      this.targetLength = this.room(this.target, 2.2);
    }
  }

  /**
   * Lines from the floor under the body, its sides and above it to the camera spot all clear: drawn ledges and trims
   * stick out past their boxes, so a single line grazing a box edge can still look straight into one.
   */
  private clearView(dir: THREE.Vector3, length: number) {
    v.copy(this.body).addScaledVector(dir, length);
    w2.crossVectors(dir, UP);
    if (w2.lengthSq() < 1e-6) w2.set(1, 0, 0);
    w2.normalize().multiplyScalar(0.3);
    for (let i = 0; i < 4; i++) {
      w.copy(this.body);
      if (i === 0) w.y = this.floor + 0.15;
      else if (i === 1) w.add(w2);
      else if (i === 2) w.sub(w2);
      else w.y += 0.35;
      if (!this.sees(w, v)) return false;
    }
    return true;
  }

  /** Nothing at all between a and b (awnings and rails that let bullets through still hide what is behind them). */
  private sees(a: THREE.Vector3, b: THREE.Vector3) {
    return this.world.raycast(a.x, a.y, a.z, b.x - a.x, b.y - a.y, b.z - a.z, 1, false) === null;
  }
}

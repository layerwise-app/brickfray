import * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';

/** How far the camera backs off the body (longer when that is what frames the killer too), the gap it keeps from walls, and how high it rises (rad above level). */
const REACH = 3.6;
const FAR = 4.8;
const MARGIN = 0.42;
const SHORTEST = 1.3;
const CLOSEST = 0.95;
const RISE = [0.3, 0.55, 0.85, 1.15] as const;
/** Turns tried round the preferred side (rad); the camera settles on the best clear one and keeps it unless it is lost. */
const TURNS = [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.75, -1.75, 2.4, -2.4, Math.PI] as const;
const RETHINK = 0.3;
/** Own pieces closer to the lens than this (or than six of their radii) are not drawn: a hard hat filling half the screen reads as a glitch. */
const NEAR = 1.2;
/** Share of the frame's half-angles a framed point stays inside, and the share of the screen a shown killer is inside. */
const INSIDE = 0.78;
const SHOWN = 0.9;
/**
 * Once the body has had its beat, a killer the view has not shown for UNSEEN seconds (out of the frame, behind a wall
 * or too far off to read) gets a shot of their own: a cut to a camera off their chest, turned toward the body so they
 * are seen from the front, SHOT_SHORTEST to SHOT_REACH out.
 */
const BEAT = 1.1;
const UNSEEN = 0.4;
const SHOWN_RANGE = 24;
const SHOT_REACH = 3.4;
const SHOT_SHORTEST = 1.7;
const SHOT_TURNS = [0.45, -0.45, 0.85, -0.85, 0.15, -0.15, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6, Math.PI] as const;
const SHOT_RISE = [0.12, 0.3, 0.5] as const;

const v = new THREE.Vector3();
const w = new THREE.Vector3();
const w2 = new THREE.Vector3();
const goal = new THREE.Vector3();
const toBody = new THREE.Vector3();
const toKiller = new THREE.Vector3();
const look = new THREE.Vector3();
const right = new THREE.Vector3();
const upward = new THREE.Vector3();
const near: number[] = [];
const UP = new THREE.Vector3(0, 1, 0);
const CANDIDATES: { dir: THREE.Vector3; length: number; score: number }[] = [];

/**
 * The view after the local player dies: it backs out of the head along a clear line to a spot above and behind the
 * body, on the side away from the killer, so the falling pieces are in the foreground and the killer beyond them.
 * The arm from the body to the camera is cast against the world every frame, so it is never inside a wall, an
 * awning or a roof; candidate spots are scored on their room and on fitting the body and the killer in one frame.
 * Pieces that fly at the lens are hidden, and a post or wall that comes between the camera and the body cuts the
 * camera to its spot instead of sweeping across the lens. Where no spot shows the killer with the body (no line to
 * them, or they stand beside the lens), the view cuts to the killer once the body has had its beat.
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
  /** Half-angles of the frame (rad) that stay well inside it, across and up. */
  private halfX = 0.6;
  private halfY = 0.4;
  /** Own pieces hidden for being at the lens. */
  private readonly hidden = new Set<THREE.Object3D>();
  /** Seconds the killer has gone unshown; after the cut, the arm from their chest to the camera and where they last were. */
  private unseen = 0;
  private readonly arm = new THREE.Vector3();
  private readonly killerAt = new THREE.Vector3();
  /** Seconds after `begin` that the view cut to the killer; null while it is on the body. */
  cutAt: number | null = null;
  /** Set by `begin`, cleared by `end` when the player is back. */
  active = false;

  constructor(private readonly world: CollisionWorld) {}

  /** Starts from the eye at the moment of death, looking along `forward`; `killer` is their chest when seen. */
  begin(eye: THREE.Vector3, forward: THREE.Vector3, killer: THREE.Vector3 | null = null) {
    this.body.copy(eye).setY(eye.y - 0.75);
    const floor = this.world.raycast(this.body.x, this.body.y, this.body.z, 0, -1, 0, 1.5, false);
    this.floor = this.body.y - (floor ? floor.t : 0.85);
    this.dir.copy(eye).sub(this.body).normalize();
    this.length = eye.distanceTo(this.body);
    this.view.copy(forward).normalize();
    this.target.copy(forward).setY(0).normalize().negate();
    if (this.target.lengthSq() < 1e-6) this.target.set(0, 0, 1);
    this.active = true;
    this.rethink = RETHINK;
    this.time = 0;
    this.unseen = 0;
    this.cutAt = null;
    this.choose(killer, true);
  }

  /** The player is back: pieces hidden at the lens show again. */
  end() {
    this.active = false;
    for (const piece of this.hidden) piece.visible = true;
    this.hidden.clear();
  }

  /** `pieces`: the body's own pieces, followed as they scatter (those that stray far are left out); `all` adds the head and guns, hidden at the lens too. */
  update(dt: number, camera: THREE.PerspectiveCamera, killer: THREE.Vector3 | null, pieces: readonly THREE.Object3D[] = [], all: readonly THREE.Object3D[] = pieces) {
    this.time += dt;
    this.rethink -= dt;
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    this.halfY = INSIDE * half;
    this.halfX = INSIDE * Math.atan(Math.tan(half) * camera.aspect);
    if (this.cutAt !== null) return this.watch(dt, camera, killer, all, false);
    if (this.rethink <= 0) {
      this.rethink = RETHINK;
      this.choose(killer, false);
    }
    // Swing the arm round toward the chosen side and let it out; it pulls in at once wherever the world is closer.
    const ease = 1 - Math.exp(-dt * (this.time < 0.9 ? 5.5 : 2.2));
    this.dir.lerp(this.target, ease).normalize();
    this.length += (this.targetLength - this.length) * ease;
    this.place(camera.position);
    // Something thin (a lamp post, a pillar) between the camera and the body would sweep across the lens: cut instead.
    w.copy(this.body).setY(this.body.y + 0.3);
    if (this.time > 0.08 && !this.sees(camera.position, w) && !this.sees(camera.position, this.body)) {
      this.dir.copy(this.target);
      this.length = this.targetLength;
      this.place(camera.position);
    }
    const c = camera.position;
    // Always the body; the killer too when it can be seen, turned toward as far as the frame allows.
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
    if (killer && this.seesFigure(c, killer)) {
      // With the killer in the shot the body itself is what stays in frame; its pieces may fly out of it.
      toBody.copy(this.body).setY(this.body.y + 0.25).lerp(this.focus, 0.3).sub(c).normalize();
      goal.copy(toBody);
      this.frame(c, killer, goal);
    }
    this.view.lerp(goal, 1 - Math.exp(-dt * (this.time < 0.4 ? 10 : 6))).normalize();
    camera.lookAt(goal.copy(c).add(this.view));
    camera.updateMatrixWorld();
    if (killer) {
      v.copy(killer).project(camera);
      const shown = c.distanceTo(killer) < SHOWN_RANGE && v.z < 1 && Math.abs(v.x) < SHOWN && Math.abs(v.y) < SHOWN && this.seesFigure(c, killer);
      this.unseen = shown ? 0 : this.unseen + dt;
      if (this.time >= BEAT && this.unseen >= UNSEEN && this.aim(killer)) {
        this.cutAt = this.time;
        return this.watch(dt, camera, killer, all, true);
      }
    }
    this.hide(c, all);
  }

  /** Own pieces at the lens are hidden; big ones (the torso, a gun) further out, so none fills the frame. */
  private hide(c: THREE.Vector3, all: readonly THREE.Object3D[]) {
    for (const piece of all) {
      if (!piece.parent) continue;
      const mesh = piece as THREE.Mesh;
      if (mesh.isMesh && !mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const reach = Math.max(NEAR, 6 * (mesh.geometry?.boundingSphere?.radius ?? 0) * piece.scale.x);
      const close = piece.getWorldPosition(v).distanceToSquared(c) < reach * reach;
      if (close === piece.visible) {
        piece.visible = !close;
        if (close) this.hidden.add(piece);
      }
    }
  }

  /** Cut to the killer: the camera rides its arm from their chest, pulled in by walls, and keeps them in the middle of the frame. */
  private watch(dt: number, camera: THREE.PerspectiveCamera, killer: THREE.Vector3 | null, all: readonly THREE.Object3D[], cut: boolean) {
    const c = camera.position;
    if (killer) {
      this.killerAt.copy(killer);
      // They may walk on: the arm keeps its line from them, and a fresh one is cut to when that line is lost.
      this.rethink -= dt;
      if (this.rethink <= 0 && !this.seesFigure(c, killer)) {
        this.rethink = RETHINK;
        cut = this.aim(killer) || cut;
      }
    }
    w.copy(this.arm).normalize();
    c.copy(this.killerAt).addScaledVector(w, Math.min(this.arm.length(), this.room(w, this.arm.length(), this.killerAt)));
    this.unstick(c, this.killerAt);
    goal.copy(this.killerAt).setY(this.killerAt.y - 0.15).sub(c).normalize();
    if (cut) this.view.copy(goal);
    else this.view.lerp(goal, 1 - Math.exp(-dt * 8)).normalize();
    camera.lookAt(goal.copy(c).add(this.view));
    camera.updateMatrixWorld();
    this.hide(c, all);
  }

  /** Into `arm`: the best clear spot facing the killer from which their chest or head and their legs are seen; false when there is none. */
  private aim(killer: THREE.Vector3) {
    goal.copy(this.body).sub(killer).setY(0);
    const base = goal.lengthSq() > 1e-4 ? Math.atan2(goal.x, goal.z) : Math.atan2(this.target.x, this.target.z);
    let best = -Infinity;
    for (const turn of SHOT_TURNS) {
      for (const rise of SHOT_RISE) {
        const yaw = base + turn;
        w.set(Math.sin(yaw) * Math.cos(rise), Math.sin(rise), Math.cos(yaw) * Math.cos(rise));
        const length = this.room(w, SHOT_REACH, killer);
        if (length < SHOT_SHORTEST) continue;
        v.copy(killer).addScaledVector(w, length);
        if (!this.seesFigure(v, killer) || !this.sees(v, w2.copy(killer).setY(killer.y - 0.8))) continue;
        const score = length - 0.6 * Math.abs(Math.abs(turn) - SHOT_TURNS[0]) - 1.5 * Math.abs(rise - SHOT_RISE[1]);
        if (score > best) {
          best = score;
          this.arm.copy(w).multiplyScalar(length);
        }
      }
    }
    return best > -Infinity;
  }

  /** The camera on its arm from the body, short of anything in the way. */
  private place(out: THREE.Vector3) {
    const room = this.room(this.dir, Math.max(REACH, this.targetLength));
    if (this.length > room) this.length = room;
    out.copy(this.body).addScaledVector(this.dir, this.length);
    this.unstick(out);
  }

  /**
   * Into `out`: the view from `c` that shows the body (`toBody`) and the killer. Both when they fit in the frame,
   * looking between them; otherwise the body stays in frame at its edge, turned as far toward the killer as that allows.
   */
  private frame(c: THREE.Vector3, killer: THREE.Vector3, out: THREE.Vector3) {
    toKiller.copy(killer).sub(c).normalize();
    for (const f of [0.5, 0.38, 0.26, 0.14]) {
      look.copy(toBody).lerp(toKiller, f).normalize();
      if (this.inFrame(look, toBody) && (f < 0.5 || this.inFrame(look, toKiller))) {
        out.copy(look);
        return;
      }
    }
  }

  /** Whether direction `d` shows inside the frame of a camera looking along `along` (kept level). */
  private inFrame(along: THREE.Vector3, d: THREE.Vector3) {
    right.crossVectors(along, UP);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    upward.crossVectors(right, along);
    const ahead = d.dot(along);
    if (ahead <= 0) return false;
    return Math.abs(Math.atan2(d.dot(right), ahead)) < this.halfX && Math.abs(Math.atan2(d.dot(upward), ahead)) < this.halfY;
  }

  /** Whether a camera at `c` frames both the body and the killer, looking between them. */
  private fits(c: THREE.Vector3, killer: THREE.Vector3) {
    toBody.copy(this.body).sub(c).normalize();
    toKiller.copy(killer).sub(c).normalize();
    look.copy(toBody).add(toKiller).normalize();
    return this.inFrame(look, toBody) && this.inFrame(look, toKiller);
  }

  /** Clear length along `d` from the body (or `b`), short of anything in the way by the margin. */
  private room(d: THREE.Vector3, reach: number, b: THREE.Vector3 = this.body) {
    const hit = this.world.raycast(b.x, b.y, b.z, d.x, d.y, d.z, reach + MARGIN, false);
    return hit ? Math.max(0.2, hit.t - MARGIN) : reach;
  }

  /** Pulls a spot out of any box it sits in (a ray along a wall's face can graze it), toward the body or `toward`. */
  private unstick(p: THREE.Vector3, toward: THREE.Vector3 = this.body) {
    for (let i = 0; i < 8; i++) {
      if (!this.world.overlaps(p.x - 0.18, p.y - 0.18, p.z - 0.18, p.x + 0.18, p.y + 0.18, p.z + 0.18, near).length) return;
      p.lerp(toward, 0.2);
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
        const length = this.room(w, killer ? FAR : REACH);
        if (length < CLOSEST) continue;
        v.copy(this.body).addScaledVector(w, length);
        let score = Math.min(length, REACH) - 0.45 * Math.abs(turn) - 0.6 * Math.abs(rise - RISE[1]);
        // The killer standing by the camera or between it and the body would fill the frame.
        const blocked = killer && this.blocks(killer, v);
        const framed = killer && !blocked && this.seesFigure(v, killer) ? (this.fits(v, killer) ? 2 : 1) : 0;
        // A short arm only where it is what frames the killer.
        if (length < SHORTEST && framed < 2) continue;
        if (blocked) score -= 4;
        // Seen, and far better when body and killer fit in one frame from here.
        score += framed === 2 ? 5 : framed === 1 ? 1.5 : 0;
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

  /** The killer's chest or head can be seen from `a`. */
  private seesFigure(a: THREE.Vector3, chest: THREE.Vector3) {
    return this.sees(a, chest) || this.sees(a, w2.copy(chest).setY(chest.y + 0.3));
  }

  /** Nothing at all between a and b (awnings and rails that let bullets through still hide what is behind them). */
  private sees(a: THREE.Vector3, b: THREE.Vector3) {
    return this.world.raycast(a.x, a.y, a.z, b.x - a.x, b.y - a.y, b.z - a.z, 1, false) === null;
  }
}

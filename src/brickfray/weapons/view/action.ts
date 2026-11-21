import type * as THREE from 'three';
import type { WeaponId } from '../defs';
import { NAIL_STEP } from '../models/nailer';
import { SPARK_RUN } from '../models/pulse';
import type { Frame } from './clip';
import { SLIDE_LOCK } from './clips-pistol';
import { REVOLVER_CYCLE, revolverAction } from './clips-revolver';
import type { GunRig } from './rig';
import { smooth01 } from './springs';

/** The trigger finger snaps back on a shot, stays back while shots keep coming (automatic fire), then lets go. */
const TRIGGER = { pull: 0.025, hold: 0.11, reset: 0.13, curl: 0.2 };
const SLIDE_CYCLE = 0.1;
/** Parts a shot sets off from an offset that runs back to rest in `time` seconds: the nailer's strip feeding a nail up, the pulse rifle's hot cell. */
const RUNS: Record<string, { from: readonly number[]; time: number }> = {
  strip: { from: NAIL_STEP, time: 0.035 },
  spark: { from: SPARK_RUN, time: 0.05 }
};

/**
 * What a shot sets going on the gun outside any clip: slide kick and lock, hammer and cylinder, the spent spear, the
 * trigger pull. A locked slide and a spent spear stay with their gun through a switch, so it comes back as it was put away.
 */
export class GunAction {
  private readonly locked = new Set<WeaponId>();
  private readonly spent = new Set<WeaponId>();
  private slideKick = 1;
  private cylinderKick = 1;
  private sinceShot = 1;
  private readonly slide = [0, 0, 0];
  private readonly run = [0, 0, 0];

  fire(rig: GunRig, empty: boolean) {
    this.sinceShot = 0;
    if (rig.rest.has('slide')) {
      this.slideKick = 0;
      if (empty) this.locked.add(rig.id);
    }
    if (rig.rest.has('spear')) this.spent.add(rig.id);
    if (rig.rest.has('cylinder')) this.cylinderKick = 0;
  }

  /** Whether a shot took this part with it: the Harpooner's spear, fired and not yet replaced. */
  gone(rig: GunRig, name: string) {
    return name === 'spear' && this.spent.has(rig.id);
  }

  /** A fresh spear is home. */
  seat(rig: GunRig) {
    this.spent.delete(rig.id);
  }

  /** The slide has been let off its lock. */
  release(rig: GunRig) {
    this.locked.delete(rig.id);
  }

  reset() {
    this.locked.clear();
    this.spent.clear();
    this.slideKick = this.cylinderKick = this.sinceShot = 1;
  }

  update(dt: number) {
    this.slideKick = Math.min(1, this.slideKick + dt / SLIDE_CYCLE);
    this.cylinderKick = Math.min(1, this.cylinderKick + dt / REVOLVER_CYCLE);
    this.sinceShot += dt;
  }

  /** Extra curl of the trigger finger right now. */
  squeeze() {
    const t = this.sinceShot;
    return TRIGGER.curl * (t < TRIGGER.pull ? t / TRIGGER.pull : 1 - smooth01((t - TRIGGER.hold) / TRIGGER.reset));
  }

  /** A part's offset from rest: the clip's, else the slide's own kick or lock. */
  offset(rig: GunRig, f: Frame, name: string): readonly number[] | undefined {
    const o = f.parts.get(name);
    if (o) return o;
    const run = RUNS[name];
    if (run) {
      const k = 1 - smooth01(this.sinceShot / run.time);
      for (let i = 0; i < 3; i++) this.run[i] = (run.from[i] ?? 0) * k;
      return this.run;
    }
    if (name !== 'slide') return undefined;
    const t = this.slideKick;
    this.slide[2] = this.locked.has(rig.id) ? SLIDE_LOCK : t >= 1 ? 0 : SLIDE_LOCK * (t < 0.25 ? t / 0.25 : 1 - smooth01((t - 0.25) / 0.75));
    return this.slide;
  }

  /** Hammer and cylinder turn of a revolver between clips; false for any other part. */
  turn(rig: GunRig, name: string, q: THREE.Quaternion) {
    if ((name !== 'cylinder' && name !== 'hammer') || !rig.rest.has('cylinder')) return false;
    revolverAction(name, this.cylinderKick, q);
    return true;
  }
}

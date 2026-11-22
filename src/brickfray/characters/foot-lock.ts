import type { FootPose } from './gait';
import { dampAngle, lerp, smooth } from './ik';
import { BALL } from './skeleton';

/** Where a match stands the figure: its root on the ground and its turn about +Y. */
export interface Place {
  x: number;
  z: number;
  yaw: number;
}

/** A step on the spot: seconds, and how high it lifts the foot. */
const STEP = 0.24;
const LIFT = 0.07;
/** How far (m) and how much turned (rad) a held foot may be from where the stance wants it before it steps. */
const REACH = 0.17;
const SPLAY = 0.6;
/** Once one foot has stepped, the other follows if it is this far off, so the figure ends up square. */
const SETTLE = 0.06;
const SETTLE_TURN = 0.25;
/** In the gait, a planted foot this far from its stride is let go early (a sharp turn, a sudden stop). */
const DRIFT = 0.3;
const DRIFT_TURN = 0.8;
/** Further off than this the foot just jumps (a teleport). */
const SNAP = 0.7;
/** A foot let go without a swing of the gait to carry it (a jump) settles onto the pose over this long. */
const LET_GO = 0.2;
/** The most the hips trail the aim as the figure turns on the spot, and how fast they follow it. */
const TWIST = 1.0;
const HIPS = 6;
/** The toe joint below the ankle (the skeleton's toe offset). */
const TOE_DROP = 0.055;

class Hold {
  locked = false;
  /** The held toe joint's spot and the foot's heading, in the world. */
  wx = 0;
  wz = 0;
  wh = 0;
  /** Offset from the wanted pose (root space) being let go of, and how much of it is left. */
  dx = 0;
  dz = 0;
  dh = 0;
  fade = 0;
  /** Progress of a step on the spot, or -1. */
  step = -1;
  /** The partner just stepped: follow it on a smaller miss. */
  settle = false;
  /** Last frame's wanted toe and heading (root space, without the hips' twist). */
  px = 0;
  pz = 0;
  ph = 0;

  free(dx: number, dz: number, dh: number, fade: number, step: number) {
    this.locked = false;
    this.dx = dx;
    this.dz = dz;
    this.dh = dh;
    this.fade = fade;
    this.step = step;
  }
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Planted feet hold their spots on the ground while the figure moves and turns over them. A foot keeps its world
 * spot from touchdown to lift-off; what it drifted from its stride is let go of over the swing. Standing, the hips
 * trail a turn of the aim, and a foot twisted or pulled too far steps to where the stance wants it, the other one
 * following, so a figure turning on the spot steps around instead of spinning on its soles.
 */
export class FootLock {
  private readonly holds = [new Hold(), new Hold()];
  private placed = false;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private hips = 0;
  /** The lower body's heading off the root's (model heading), for the pelvis. */
  twist = 0;

  reset() {
    this.placed = false;
    this.twist = 0;
    for (const h of this.holds) h.free(0, 0, 0, 0, -1);
  }

  /**
   * Called first each frame with the figure's place (none outside a match). Returns how far the root turned since the
   * last frame as a model heading, which the stride and the velocity's smoothing take back to stay put in the world.
   */
  turn(dt: number, place: Place | undefined, moving: number) {
    if (!place) {
      this.reset();
      return 0;
    }
    if (!this.placed || Math.hypot(place.x - this.x, place.z - this.z) > 2) {
      this.reset();
      this.placed = true;
      this.hips = place.yaw;
      this.set(place);
      return 0;
    }
    const turned = wrap(place.yaw - this.yaw);
    this.set(place);
    this.hips = dampAngle(this.hips, place.yaw, lerp(HIPS, 40, moving), dt);
    const twist = wrap(place.yaw - this.hips);
    if (Math.abs(twist) > TWIST) this.hips = place.yaw - Math.sign(twist) * TWIST;
    this.twist = wrap(place.yaw - this.hips);
    return turned;
  }

  /** Holds planted feet (model space, final targets before the legs' IK) on their world spots; `scale` is the body's. */
  hold(dt: number, feet: FootPose[], scale: number, ground: number, moving: number) {
    if (!this.placed) return;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const idle = 1 - moving;
    const tw = this.twist * idle;
    const ct = Math.cos(tw);
    const st = Math.sin(tw);
    for (let i = 0; i < 2; i++) {
      const f = feet[i]!;
      const h = this.holds[i]!;
      const other = this.holds[1 - i]!;
      const reach = BALL * Math.cos(f.pitch) + TOE_DROP * Math.sin(f.pitch);
      const px = f.pos.x + Math.sin(f.heading) * reach;
      const pz = f.pos.z - Math.cos(f.heading) * reach;
      // Where the toe should be: the pose's, turned with the hips.
      const tx = px * ct - pz * st;
      const tz = px * st + pz * ct;
      const th = f.heading + tw;
      const toeY = f.pos.y - TOE_DROP * Math.cos(f.pitch) + BALL * Math.sin(f.pitch);
      const on = ground > 0.5 && f.planted >= 0.5 && toeY < 0.09;
      let mx = tx;
      let mz = tz;
      let mh = th;
      if (h.locked) {
        // The pose's own motion standing (a crouch, a lunge) carries the spot along; the root's motion does not.
        if (idle > 0) {
          const ex = (px - h.px) * idle * scale;
          const ez = (pz - h.pz) * idle * scale;
          h.wx += ex * c + ez * s;
          h.wz += -ex * s + ez * c;
          h.wh += wrap(f.heading - h.ph) * idle;
        }
        const dx = h.wx - this.x;
        const dz = h.wz - this.z;
        mx = (dx * c - dz * s) / scale;
        mz = (dx * s + dz * c) / scale;
        mh = h.wh + this.yaw;
        const miss = Math.hypot(mx - tx, mz - tz);
        const twisted = Math.abs(wrap(mh - th));
        const far =
          moving < 0.5
            ? other.step < 0 && (h.settle ? miss > SETTLE || twisted > SETTLE_TURN : miss > REACH || twisted > SPLAY)
            : miss > DRIFT || twisted > DRIFT_TURN;
        h.settle = false;
        if (!on || miss > SNAP) h.free(mx - tx, mz - tz, wrap(mh - th), miss > SNAP ? 0 : 1, -1);
        else if (far) h.free(mx - tx, mz - tz, wrap(mh - th), 1, 0);
      }
      if (!h.locked) {
        if (h.step >= 0) {
          h.step += dt / (moving < 0.5 ? STEP : STEP * 0.7);
          if (h.step >= 1) {
            h.step = -1;
            h.fade = 0;
            other.settle = other.locked;
          } else h.fade = 1 - smooth(h.step, 0, 1);
        } else if (f.swing >= 0) h.fade = Math.min(h.fade, 1 - smooth(f.swing, 0.05, 0.85));
        else h.fade = Math.max(0, h.fade - dt / LET_GO);
        mx = tx + h.dx * h.fade;
        mz = tz + h.dz * h.fade;
        mh = th + h.dh * h.fade;
        if (h.step < 0 && on) {
          const lx = mx * scale;
          const lz = mz * scale;
          h.wx = this.x + lx * c + lz * s;
          h.wz = this.z - lx * s + lz * c;
          h.wh = mh - this.yaw;
          h.locked = true;
        }
      }
      h.px = px;
      h.pz = pz;
      h.ph = f.heading;
      f.heading = mh;
      f.pos.x = mx - Math.sin(mh) * reach;
      f.pos.z = mz + Math.cos(mh) * reach;
      if (h.step >= 0) {
        f.pos.y += LIFT * Math.sin(Math.PI * h.step);
        f.planted = 0;
      }
    }
  }

  private set(place: Place) {
    this.x = place.x;
    this.z = place.z;
    this.yaw = place.yaw;
  }
}

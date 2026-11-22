import type { ClipPlayer } from './clip';

/** Seconds a landed blow holds in the target, the share of speed the strike keeps meanwhile, and the seconds it takes to get going again. */
const HOLD = 0.055;
const CRAWL = 0.08;
const RAMP = 0.035;
/** A hit confirmed this long after the shown contact (the swing is well into its follow-through) gets no hold. */
const LATE = 0.06;

/**
 * The hit-stop of a melee strike: only a blow the game says landed catches in the target, the strike slowed almost to
 * a stop for a few frames at its shown contact before it carries on through; a whiff follows straight through.
 */
export class HitStop {
  private clip: object | null = null;
  private contact = 0;
  private landed = false;
  private since = -1;
  /** Whether the hold started on the last step (the gun is jarred then). */
  started = false;

  /** A strike starts: its clip and the clip time (s) of its shown contact. */
  strike(clip: object, contact: number) {
    this.clip = clip;
    this.contact = contact;
    this.landed = false;
    this.since = -1;
  }

  land(hit: boolean) {
    if (hit && this.clip) this.landed = true;
  }

  /** The clip's time step for this frame: dt, slowed while a landed blow holds. */
  step(dt: number, player: ClipPlayer): number {
    this.started = false;
    if (!this.landed || player.clip !== this.clip) return dt;
    if (this.since < 0) {
      if (player.time + dt < this.contact) return dt;
      if (player.time > this.contact + LATE) {
        this.landed = false;
        return dt;
      }
      this.since = 0;
      this.started = true;
      return Math.max(0, this.contact - player.time) + dt * CRAWL;
    }
    this.since += dt;
    const k = this.since < HOLD ? 0 : Math.min(1, (this.since - HOLD) / RAMP);
    if (k >= 1) this.landed = false;
    return dt * (CRAWL + (1 - CRAWL) * k * k);
  }
}

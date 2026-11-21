/** Radians the figure turns per CSS pixel of drag: half a turn for a 390 px swipe. */
export const TURN_PER_PIXEL = 0.008;

/** How long a released figure keeps the angle it came to rest at before it turns back to face the lens. */
const HOLD = 3.2;
/** Friction on a thrown figure, per second, and a steady brake on top so it stops instead of creeping. */
const FRICTION = 2.6;
const BRAKE = 0.5;
/** The stand's top speed (radians per second): a hand turns it as fast as it moves up to `KNEE`, then it slips toward `TOP`. */
const KNEE = 9;
const TOP = 14;
/** Top speed of the eased turn back to the front, and the shortest time it takes. */
const RETURN_SPEED = 1.5;
const RETURN_MIN = 1.1;
/** A drag sample older than this (seconds) no longer counts as a throw. */
const STALE = 0.09;
const TURN = Math.PI * 2;

/** A speed eased into the stand's top speed: unchanged up to `KNEE`, then flattening toward `TOP`. */
function limit(speed: number) {
  const s = Math.abs(speed);
  return s <= KNEE ? speed : Math.sign(speed) * (KNEE + (TOP - KNEE) * Math.tanh((s - KNEE) / (TOP - KNEE)));
}

/** Minimum-jerk ease from 0 to 1: starts and ends at rest; its peak slope is 1.875. */
const ease = (s: number) => s * s * s * (10 - 15 * s + 6 * s * s);

/**
 * The menu figure's turntable: a drag turns it (a flick past its top speed slips), a release lets it spin on at the
 * speed it had and down to a stop, it holds that angle a while,
 * then eases back to face the lens the short way. The idle sway owns the figure until a hand takes it where it stands,
 * and gets it back once the turn back has brought it into step with the sway again, so neither ever makes it jump.
 */
export class Turntable {
  /** Radians away from the front while `engaged`; positive brings the figure's front to the right. */
  angle = 0;
  /** From a grab until the figure is back in step with the idle sway. */
  engaged = false;
  private velocity = 0;
  /** How fast the hand moves, smoothed over the last few drag samples. */
  private hand = 0;
  private held = false;
  /** Seconds the released figure has stood still. */
  private still = 0;
  private sinceDrag = 0;
  private sway = 0;
  /** The turn back: how far from the sway it started, and how far along it is (seconds of `span`). */
  private from = 0;
  private along = 0;
  private span = 0;

  /** A finger or the mouse button went down on the stage. */
  grab() {
    if (!this.engaged) this.angle = this.sway;
    this.engaged = true;
    this.held = true;
    this.velocity = 0;
    this.hand = 0;
    this.span = 0;
    this.sinceDrag = STALE;
  }

  /** The pointer moved `radians` worth of drag over `seconds`. */
  drag(radians: number, seconds: number) {
    if (!this.held) return;
    const speed = radians / Math.max(seconds, 1 / 240);
    this.hand = this.sinceDrag >= STALE ? speed : this.hand + (speed - this.hand) * 0.5;
    this.velocity = limit(this.hand);
    this.angle += Math.abs(this.hand) > KNEE ? (radians * this.velocity) / this.hand : radians;
    this.sinceDrag = 0;
  }

  /** The figure spins on at the speed the hand last turned it, unless the pointer rested before letting go. */
  release() {
    if (!this.held) return;
    this.held = false;
    this.still = 0;
    if (this.sinceDrag >= STALE) this.velocity = 0;
  }

  /** Back to the idle at once, for a new figure. */
  reset() {
    this.held = false;
    this.engaged = false;
    this.velocity = 0;
    this.span = 0;
  }

  /** `sway` is how far the idle would turn the figure this frame. */
  update(dt: number, sway = 0) {
    this.sway = sway;
    if (this.held) {
      this.sinceDrag += dt;
      return;
    }
    if (!this.engaged) return;
    // Whole turns are the same pose: the way back is never more than half a turn.
    this.angle -= Math.round((this.angle - sway) / TURN) * TURN;
    if (this.span > 0) {
      this.along = Math.min(this.span, this.along + dt);
      this.angle = sway + this.from * (1 - ease(this.along / this.span));
      if (this.along >= this.span) this.reset();
      return;
    }
    if (this.velocity !== 0) {
      const speed = Math.max(0, Math.abs(this.velocity) * Math.exp(-FRICTION * dt) - BRAKE * dt);
      this.velocity = Math.sign(this.velocity) * speed;
      this.angle += this.velocity * dt;
      return;
    }
    this.still += dt;
    if (this.still < HOLD) return;
    this.from = this.angle - sway;
    this.along = 0;
    this.span = Math.max(RETURN_MIN, (1.875 * Math.abs(this.from)) / RETURN_SPEED);
  }

  /** The figure's turn away from the front this frame. */
  get turn() {
    return this.engaged ? this.angle : this.sway;
  }
}

/** The one turntable on screen: the menu overlay feeds it drags, the showroom reads its turn. */
export const turntable = new Turntable();

import { BUTTON } from '../sim/types';

export interface TouchSettings {
  /** Look speed of a dragging thumb (1 = default). */
  sensitivity: number;
  /** Scale of the on-screen buttons and stick. */
  buttonSize: number;
  /** Mirrored: stick on the right, look and buttons on the left. */
  leftHanded: boolean;
  /** Fire on its own while the sight is on an enemy. */
  autoFire: boolean;
  /** Vibrate on firing and hits, where the device can. */
  haptics: boolean;
}

export const DEFAULT_TOUCH: TouchSettings = { sensitivity: 1, buttonSize: 1, leftHanded: false, autoFire: false, haptics: true };

export type TouchButton = 'fire' | 'fireLeft' | 'ads' | 'jump' | 'crouch' | 'reload' | 'grenade' | 'melee' | 'swap' | 'steady';

const BIT: Record<TouchButton, number> = { fire: 1, fireLeft: 2, ads: 4, jump: 8, crouch: 16, reload: 32, grenade: 64, melee: 128, swap: 256, steady: 512 };
const FIRE = BIT.fire | BIT.fireLeft;

/** Radians of turn per CSS pixel of thumb travel at sensitivity 1, before acceleration. */
const LOOK_RADIANS = 0.0042;
/** Thumb speed (px/s) up to which the look gain stays at SLOW_GAIN, and from which it is FAST_GAIN. */
const SLOW = 160;
const FAST = 1400;
const SLOW_GAIN = 0.75;
const FAST_GAIN = 1.9;
/** Share of the stick's reach that is ignored, and the deflection that runs. */
export const STICK_DEAD = 0.12;
export const STICK_SPRINT = 0.9;
/** A tap on crouch while running slides: crouch is held this long (ms) so the slide starts. */
const SLIDE_PULSE = 220;
/** Aim held longer than this (ms) is a hold: letting go leaves the sights. */
const ADS_HOLD = 300;
/** Auto-fire waits this long (ms) on a target before shooting, and keeps shooting this long after the sight slips off. */
const SIGHT_DELAY = 60;
const SIGHT_GRACE = 110;

/** Look gain for a thumb moving at `speed` px/s: fine aim when slow, quick turns when flicked. */
export function lookGain(speed: number) {
  const t = Math.min(1, Math.max(0, (speed - SLOW) / (FAST - SLOW)));
  return SLOW_GAIN + (FAST_GAIN - SLOW_GAIN) * t * t * (3 - 2 * t);
}

/** One finger turning the view: on the look side, or dragged from fire, aim or grenade. */
export interface Drag {
  x: number;
  y: number;
  t: number;
  speed: number;
  /** A finger on a button aims only once it has moved past a slop, so a tap doesn't nudge the view. */
  live: boolean;
}

/** What the frame loop folds the touch intent into (Input's per-frame result). */
export interface TouchFrame {
  lookYaw: number;
  lookPitch: number;
  forward: number;
  right: number;
  buttons: number;
  cycle: number;
  scoreboard: boolean;
}

type Assist = (yawRate: number, pitchRate: number) => [number, number];

/**
 * The on-screen controls' state. The touch layer reports fingers; `apply` turns them into one frame of intent the way
 * a mobile shooter does: a floating stick that runs at full reach (or locks into a run), toggled aim and crouch, a tap
 * on crouch while running slides, firing stops the run.
 */
export class TouchInput {
  private sx = 0;
  private sy = 0;
  private stickDown = false;
  private yaw = 0;
  private pitch = 0;
  private held = 0;
  private pressed = 0;
  private adsAt = 0;
  private slideUntil = 0;
  private cycle = 0;
  private sightOn = -1;
  private sightOff = -1;
  private autoFiring = false;
  /** Fingers aiming right now: aim assist acts only while the player aims. */
  private aiming = 0;
  ads = false;
  crouch = false;
  sprintLock = false;
  scoreboard = false;
  private listeners = new Set<() => void>();
  version = 0;

  /** Toggles (aim, crouch, run lock, scoreboard) changed: the buttons show their state. */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  private changed() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  /** Stick deflection as a share of its reach (y down). */
  stick(x: number, y: number) {
    this.sx = x;
    this.sy = y;
    if (!this.stickDown) {
      this.stickDown = true;
      if (this.sprintLock) {
        this.sprintLock = false;
        this.changed();
      }
    }
    if (this.crouch && this.running()) {
      this.crouch = false;
      this.changed();
    }
  }

  /** The thumb left the stick; `lock` when it let go in the run-lock spot. */
  stickEnd(lock: boolean) {
    this.sx = this.sy = 0;
    this.stickDown = false;
    if (lock !== this.sprintLock) {
      this.sprintLock = lock;
      if (lock && this.ads) this.ads = false;
      this.changed();
    }
  }

  beginDrag(drag: Drag, x: number, y: number, t: number, live: boolean) {
    drag.x = x;
    drag.y = y;
    drag.t = t;
    drag.speed = 0;
    drag.live = live;
    this.aiming++;
  }

  /** A dragging finger moved to (x, y) at time `t` (ms). */
  drag(drag: Drag, x: number, y: number, t: number) {
    const dx = x - drag.x;
    const dy = y - drag.y;
    if (!drag.live) {
      if (dx * dx + dy * dy < 36) return;
      drag.live = true;
    }
    const dt = Math.max(4, t - drag.t);
    const speed = (Math.hypot(dx, dy) * 1000) / dt;
    drag.speed += (speed - drag.speed) * 0.5;
    const gain = lookGain(drag.speed) * LOOK_RADIANS;
    this.yaw += dx * gain;
    this.pitch += dy * gain;
    drag.x = x;
    drag.y = y;
    drag.t = t;
  }

  endDrag() {
    this.aiming = Math.max(0, this.aiming - 1);
  }

  press(button: TouchButton, now: number) {
    const bit = BIT[button];
    this.held |= bit;
    this.pressed |= bit;
    if (button === 'ads') {
      this.adsAt = now;
      this.ads = !this.ads;
      if (this.ads) this.sprintLock = false;
      this.changed();
    } else if (button === 'crouch') {
      if (this.running()) this.slideUntil = now + SLIDE_PULSE;
      else this.crouch = !this.crouch;
      this.changed();
    } else if (button === 'jump' && this.crouch) {
      this.crouch = false;
      this.changed();
    } else if (button === 'swap') this.cycle = 1;
    else if (bit & FIRE && this.sprintLock) {
      this.sprintLock = false;
      this.changed();
    }
  }

  release(button: TouchButton, now: number) {
    this.held &= ~BIT[button];
    if (button === 'ads' && this.ads && now - this.adsAt > ADS_HOLD) {
      this.ads = false;
      this.changed();
    }
  }

  toggleScoreboard() {
    this.scoreboard = !this.scoreboard;
    this.changed();
  }

  /** Everything let go: death, a menu, the upgrade cards, leaving touch mode. */
  reset() {
    this.sx = this.sy = this.yaw = this.pitch = 0;
    this.held = this.pressed = this.cycle = this.aiming = 0;
    this.stickDown = false;
    this.slideUntil = 0;
    this.autoFiring = false;
    this.sightOn = this.sightOff = -1;
    if (this.ads || this.crouch || this.sprintLock || this.scoreboard) {
      this.ads = this.crouch = this.sprintLock = this.scoreboard = false;
      this.changed();
    }
  }

  private running() {
    if (this.sprintLock) return true;
    const m = Math.hypot(this.sx, this.sy);
    return m >= STICK_SPRINT && -this.sy / m > 0.5;
  }

  private autoFire(sights: (() => boolean) | null, now: number) {
    const on = !!sights && sights();
    if (on) {
      if (this.sightOn < 0) this.sightOn = now;
      this.sightOff = -1;
      if (now - this.sightOn >= SIGHT_DELAY) this.autoFiring = true;
    } else {
      this.sightOn = -1;
      if (this.autoFiring) {
        if (this.sightOff < 0) this.sightOff = now;
        if (now - this.sightOff > SIGHT_GRACE) this.autoFiring = false;
      }
    }
    return this.autoFiring;
  }

  /**
   * Folds this frame's touch intent into `f`. `lookScale` turns accumulated thumb radians into view radians
   * (sensitivity, aim zoom); `assist` is the game's aim assist on look rates.
   */
  apply(f: TouchFrame, dt: number, now: number, lookScale: number, invertY: boolean, assist: Assist | null, sights: (() => boolean) | null) {
    let yaw = -this.yaw * lookScale;
    let pitch = -this.pitch * lookScale * (invertY ? -1 : 1);
    this.yaw = this.pitch = 0;
    const firing = ((this.held | this.pressed) & FIRE) !== 0 || (sights !== null && this.autoFire(sights, now));
    if (assist && dt > 0 && (this.aiming > 0 || firing)) {
      const [yawRate, pitchRate] = assist(yaw / dt, pitch / dt);
      yaw = yawRate * dt;
      pitch = pitchRate * dt;
    }
    f.lookYaw += yaw;
    f.lookPitch += pitch;

    const m = Math.hypot(this.sx, this.sy);
    if (this.sprintLock) {
      f.forward = 1;
      f.right = 0;
    } else if (m > STICK_DEAD) {
      const reach = m >= STICK_SPRINT ? 1 : (Math.min(1, m) - STICK_DEAD) / (1 - STICK_DEAD);
      f.forward = (-this.sy / m) * reach;
      f.right = (this.sx / m) * reach;
    }
    const keys = this.held | this.pressed;
    let b = 0;
    if (firing) b |= BUTTON.fire;
    if (this.ads) b |= BUTTON.ads;
    if (keys & BIT.jump) b |= BUTTON.jump;
    if (this.crouch || now < this.slideUntil) b |= BUTTON.crouch;
    const run = !firing && this.running();
    if (run || keys & BIT.steady) b |= BUTTON.sprint;
    if (keys & BIT.reload) b |= BUTTON.reload;
    if (keys & BIT.melee) b |= BUTTON.melee;
    if (keys & BIT.grenade) b |= run ? BUTTON.grenade | BUTTON.grenadeLow : BUTTON.grenade;
    f.buttons |= b;
    if (this.cycle) {
      f.cycle = this.cycle;
      this.cycle = 0;
    }
    if (this.scoreboard) f.scoreboard = true;
    this.pressed = 0;
  }
}

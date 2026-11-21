import type { FrameCost } from './resolution-scale';

/** Displays refreshing faster than this (ms per refresh, about 100 Hz) may be paced at every second refresh. */
const FAST_DISPLAY = 10;
/** Faster than any display (400 Hz): frames not tied to a refresh (an uncapped browser), never paced. */
const NO_DISPLAY = 2.5;
/** A drawn frame this many target intervals after the previous one missed its refresh. */
const MISS = 1.5;
const WINDOW_MS = 1000;
/** Missed share of drawn frames that halves the rate after two windows in a row, or at once above HEAVY_MISS. */
const MISS_RATE = 0.05;
const HEAVY_MISS = 0.25;
const CLEAN_RATE = 0.01;
/** Clean time with headroom at the halved rate before the full rate is tried again; each failed try quadruples it. */
const UP_DELAY_MS = 4000;
/** Back at the halved rate this soon after leaving it: the try failed. Three failures keep the halved rate. */
const FAIL_WITHIN_MS = 20000;
const MAX_FAILURES = 3;
/** Frame cost (max of CPU and GPU) must stay under this share of one refresh before the full rate is tried again. */
const HEADROOM = 0.7;

/**
 * Even pacing for fast displays. A frame that can't hold a 144 Hz display's 6.9 ms alternates hits and misses, and a
 * turning view shows every miss as judder; drawing on every second refresh (72 of 144) evenly looks smoother. Halves
 * the rate only once lower resolutions can't help (`exhausted`), goes back up after clean seconds with clear headroom.
 * Driven by drawn-frame intervals only, so it is deterministic and testable.
 */
export class FramePacer {
  /** Draw on every `divisor`-th refresh. */
  divisor = 1;
  private window: number[] = [];
  private windowMs = 0;
  private badWindows = 0;
  /** Time halved with no misses and frames cheap enough for every refresh. */
  private clean = 0;
  private clock = 0;
  private failures = 0;
  private fullSince = -Infinity;

  /** Whether a frame starting `sinceDrawn` ms after the last drawn one should draw (not wait for the next refresh). */
  due(sinceDrawn: number, refresh: number) {
    return this.divisor === 1 || refresh <= 0 || sinceDrawn >= (this.divisor - 0.5) * refresh;
  }

  /** Forget the current window (after a break, or a new display or tier). */
  reset() {
    this.window = [];
    this.windowMs = 0;
    this.badWindows = 0;
    this.clean = 0;
  }

  /** Back to the full rate with no history of failures (new tier or display). */
  restart() {
    this.divisor = 1;
    this.failures = 0;
    this.fullSince = -Infinity;
    this.reset();
  }

  /**
   * One drawn frame: `interval` ms since the previous drawn frame (0 after a break), `refresh` the display's
   * interval (0 while unknown), `exhausted` when lower resolution can't help any more. True when the divisor changed.
   */
  frame(interval: number, refresh: number, cost: FrameCost, exhausted: boolean): boolean {
    const fast = refresh > NO_DISPLAY && refresh <= FAST_DISPLAY;
    if (!fast && this.divisor > 1) return this.go(1);
    if (interval <= 0 || !fast) {
      this.reset();
      return false;
    }
    this.clock += interval;
    this.window.push(interval);
    this.windowMs += interval;
    if (this.windowMs < WINDOW_MS) return false;
    const target = refresh * this.divisor;
    const missed = this.window.filter((v) => v > target * MISS).length / this.window.length;
    const windowMs = this.windowMs;
    this.window = [];
    this.windowMs = 0;
    if (missed > MISS_RATE) {
      this.clean = 0;
      this.badWindows++;
      if (this.divisor > 1 || !exhausted || (this.badWindows < 2 && missed <= HEAVY_MISS)) return false;
      if (this.clock - this.fullSince < FAIL_WITHIN_MS) this.failures++;
      return this.go(2);
    }
    this.badWindows = 0;
    if (missed > CLEAN_RATE) {
      this.clean = 0;
      return false;
    }
    if (this.divisor === 1 || this.failures >= MAX_FAILURES) return false;
    if (Math.max(cost.cpu, cost.gpu ?? 0) > refresh * HEADROOM) {
      this.clean = 0;
      return false;
    }
    this.clean += windowMs;
    const timed = cost.gpu !== null;
    if (this.clean < UP_DELAY_MS * 4 ** this.failures * (timed ? 1 : 2)) return false;
    this.fullSince = this.clock;
    return this.go(1);
  }

  private go(divisor: number) {
    this.divisor = divisor;
    this.reset();
    return true;
  }
}

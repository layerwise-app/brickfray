/** Render pixel ratios (of CSS pixels) the scaler steps through below a tier's own ratio. */
export const SCALE_STEPS = [2, 1.75, 1.5, 1.25, 1, 0.85, 0.7];
/** The lowest ratio of the lowest tier. */
export const SCALE_FLOOR = 0.7;

/** A frame this many refresh intervals after the previous one missed at least one refresh. */
const MISS = 1.5;
const WINDOW_MS = 1000;
/** Missed share of frames that steps down after two windows in a row, or at once above HEAVY_MISS. */
const MISS_RATE = 0.05;
const HEAVY_MISS = 0.25;
const CLEAN_RATE = 0.01;
/** Frames right after a change still carry the resize and the old cost averages. */
const SETTLE_MS = 600;
const UP_DELAY_MS = 4000;
const STEADY_MS = 2000;
/** A step that misses again this soon after being reached failed; each failure quadruples its wait, three retire it. */
const FAIL_WITHIN_MS = 20000;
const MAX_FAILURES = 3;
/** Predicted cost at the next step up must stay under this share of the refresh interval. */
const HEADROOM = 0.7;
/** A GPU busy for less than this share of the refresh is not why frames miss: fewer pixels wouldn't help. */
const GPU_IDLE = 0.5;
/** A GPU busy for more than this share of the refresh counts as missing: the next busy moment will. */
const GPU_FULL = 0.9;

/** The tier's own ratio first, then each lower step down to `floor`: the next tier's ratio, 0.7 for the lowest. */
export function scaleLadder(base: number, floor = SCALE_FLOOR): number[] {
  const bottom = Math.min(base, floor);
  if (bottom > base - 0.05) return [base];
  return [base, ...SCALE_STEPS.filter((s) => s < base - 0.05 && s > bottom + 0.05), bottom];
}

/** One choice the governor can make: a render ratio, how many of the tier's extras are given up, the GPU cost share. */
export interface Rung {
  ratio: number;
  shed: number;
  cost: number;
}

/**
 * Everything the governor may choose for a tier, best first: the tier's ratio with each extra given up in turn
 * (`saves`: the share of GPU time each one saves), then each lower ratio down to `floor` with all of them given up.
 * Resolution is the last thing given up, and never below the floor.
 */
export function governorLadder(base: number, floor = SCALE_FLOOR, saves: readonly number[] = []): Rung[] {
  const rungs: Rung[] = [{ ratio: base, shed: 0, cost: 1 }];
  let cost = 1;
  for (const s of saves) {
    cost *= 1 - s;
    rungs.push({ ratio: base, shed: rungs.length, cost });
  }
  for (const ratio of scaleLadder(base, floor).slice(1)) rungs.push({ ratio, shed: saves.length, cost: cost * (ratio / base) ** 2 });
  return rungs;
}

/** Refresh interval from frame intervals: the median of the fastest cluster, so missed frames don't skew it. */
export function estimateRefresh(intervals: readonly number[]): number {
  const sorted = [...intervals].sort((a, b) => a - b);
  const fast = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const cluster = sorted.filter((v) => v >= fast * 0.75 && v <= fast * 1.3);
  return cluster[cluster.length >> 1] ?? 0;
}

/** Frame cost at the current ratio: CPU stays put, GPU scales with pixel count. GPU is null when not timed. */
export interface FrameCost {
  cpu: number;
  gpu: number | null;
}

/**
 * Keeps frames on the display's refresh by giving up a tier's extras, then its resolution down to the next tier's:
 * steps down when a few percent of frames miss a refresh, steps back up after several clean seconds when the
 * measured cost predicts the higher step fits. Driven only by delivered frame intervals, so it is deterministic and
 * testable.
 */
export class ResolutionScaler {
  ladder: Rung[] = [];
  step = 0;
  private key = '';
  private window: number[] = [];
  private windowMs = 0;
  private badWindows = 0;
  private settle = 0;
  private clean = 0;
  private clock = 0;
  private failures: number[] = [];
  /** When each step was last reached by stepping up. */
  private reachedAt: number[] = [];

  constructor(base = 1, floor = SCALE_FLOOR, saves: readonly number[] = []) {
    this.setBase(base, floor, saves);
  }

  get ratio() {
    return this.ladder[this.step]!.ratio;
  }

  /** How many of the tier's extras are given up. */
  get shed() {
    return this.ladder[this.step]!.shed;
  }

  get base() {
    return this.ladder[0]!.ratio;
  }

  /** Frames have met the refresh for a while since the last change. */
  get steady() {
    return this.clean >= STEADY_MS;
  }

  /** New tier or device pixel ratio: a fresh ladder from the top. Returns whether anything changed. */
  setBase(base: number, floor = SCALE_FLOOR, saves: readonly number[] = []): boolean {
    const key = `${base}|${floor}|${saves.join()}`;
    if (key === this.key) return false;
    this.key = key;
    this.ladder = governorLadder(base, floor, saves);
    this.failures = this.ladder.map(() => 0);
    this.reachedAt = this.ladder.map(() => -Infinity);
    this.step = 0;
    this.reset();
    return true;
  }

  /** Forget the current window (after a break or while the refresh is unknown). */
  reset() {
    this.window = [];
    this.windowMs = 0;
    this.badWindows = 0;
    this.clean = 0;
  }

  /** Lower ratios can't keep frames on the refresh: none is left, or the GPU isn't what makes them late. */
  exhausted(refresh: number, cost: FrameCost) {
    return this.step === this.ladder.length - 1 || (cost.gpu !== null && cost.gpu < refresh * GPU_IDLE);
  }

  /**
   * One delivered frame: `interval` ms since the previous one (0 after a break), `refresh` the interval frames are
   * due at (0 while unknown). `mayRise` false holds the ratio from stepping up. Returns true when the ratio changed.
   */
  frame(interval: number, refresh: number, cost: FrameCost, mayRise = true): boolean {
    if (interval <= 0 || refresh <= 0) {
      this.reset();
      return false;
    }
    this.clock += interval;
    if (this.settle > 0) {
      this.settle -= interval;
      return false;
    }
    this.window.push(interval);
    this.windowMs += interval;
    if (this.windowMs < WINDOW_MS) return false;
    const missed = this.window.filter((v) => v > refresh * MISS).length / this.window.length;
    const windowMs = this.windowMs;
    this.window = [];
    this.windowMs = 0;
    if (missed > MISS_RATE || (cost.gpu !== null && cost.gpu > refresh * GPU_FULL)) {
      this.clean = 0;
      this.badWindows++;
      if ((this.badWindows < 2 && missed <= HEAVY_MISS) || this.step === this.ladder.length - 1) return false;
      if (cost.gpu !== null && cost.gpu < refresh * GPU_IDLE) return false;
      if (this.clock - this.reachedAt[this.step]! < FAIL_WITHIN_MS) this.failures[this.step]!++;
      // Straight to the step the measured GPU cost predicts fits, so a heavy scene doesn't judder through every step;
      // an extra given up at the same ratio only needs to fit the refresh, so resolution goes last.
      let next = this.step + 1;
      const now = this.ladder[this.step]!.cost;
      const fits = (i: number) => cost.gpu! * (this.ladder[i]!.cost / now) <= refresh * (this.ladder[i]!.ratio === this.ratio ? GPU_FULL : HEADROOM);
      while (cost.gpu !== null && next < this.ladder.length - 1 && !fits(next)) next++;
      return this.go(next);
    }
    this.badWindows = 0;
    if (missed > CLEAN_RATE) {
      this.clean = 0;
      return false;
    }
    this.clean += windowMs;
    const up = this.step - 1;
    if (!mayRise || up < 0 || this.failures[up]! >= MAX_FAILURES) return false;
    const timed = cost.gpu !== null;
    if (this.clean < UP_DELAY_MS * 4 ** this.failures[up]! * (timed ? 1 : 2)) return false;
    if (timed) {
      const grow = this.ladder[up]!.cost / this.ladder[this.step]!.cost;
      if (Math.max(cost.cpu, cost.gpu! * grow) > refresh * HEADROOM) return false;
    }
    return this.go(up);
  }

  private go(step: number) {
    if (step < this.step) this.reachedAt[step] = this.clock;
    this.step = step;
    this.settle = SETTLE_MS;
    this.reset();
    return true;
  }
}

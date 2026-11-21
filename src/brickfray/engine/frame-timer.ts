import { estimateRefresh } from './resolution-scale';

type TimerQueryExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

const COST_WINDOW_MS = 500;
const PACE_WINDOW_MS = 1000;
/** A longer gap is a hidden tab or a stall before the first frame, not a delivered frame. */
const BREAK_MS = 1000;
const MAX_PENDING = 4;
const MEASURE_MS = 1500;
const MEASURE_FRAMES = 60;
/** The last two seconds of intervals, re-checked for a faster display than the one measured. */
const RECHECK_MS = 2000;

/** The animation frame's own time inside a requestAnimationFrame callback: vsync-aligned, unlike performance.now(). */
function frameTime() {
  const t = typeof document === 'undefined' ? null : document.timeline?.currentTime;
  return typeof t === 'number' ? t : performance.now();
}

/**
 * What the player gets and what a frame costs. Pacing comes from frame start times: frames delivered over the
 * last second and the longest gap between two of them. Cost is CPU and GPU ms per frame, which shows headroom
 * but not smoothness. Also measures the display's refresh interval from the same frames.
 */
export class FrameTimer {
  /** Frames delivered over the last second. */
  fps = 0;
  /** Longest interval between two frames over the last second, ms. */
  worstMs = 0;
  /** Main-loop CPU time per frame, ms. */
  cpuMs = 0;
  /** GPU time per frame, ms; null without GPU timer queries. */
  gpuMs: number | null = null;
  /** Interval from the previous frame, ms; 0 for the first frame after a break. */
  interval = 0;
  /** Display refresh interval, ms; 0 until measured. */
  refresh = 0;
  /** Frames begun so far. */
  frame = 0;
  /** Runs at the end of every frame, after everything was drawn. */
  onEnd: (() => void) | null = null;
  private readonly ext: TimerQueryExt | null;
  private readonly pending: WebGLQuery[] = [];
  private query: WebGLQuery | null = null;
  private started = 0;
  private last = 0;
  private windowStart = 0;
  private frames = 0;
  private cpu = 0;
  private gpu = 0;
  private gpuFrames = 0;
  /** Start time and interval of each frame over the last PACE_WINDOW_MS. */
  private readonly paceTimes: number[] = [];
  private readonly paceGaps: number[] = [];
  private sample: number[] = [];
  private sampleMs = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
  }

  /** max(CPU, GPU) ms per frame: what the game could sustain without vsync. */
  get ms() {
    return Math.max(this.cpuMs, this.gpuMs ?? 0);
  }

  /** The display may have changed (resized, moved to another screen): measure its refresh again. */
  remeasure() {
    this.refresh = 0;
    this.sample = [];
    this.sampleMs = 0;
  }

  begin() {
    this.frame++;
    const t = frameTime();
    this.started = performance.now();
    const gap = this.last ? t - this.last : 0;
    this.last = t;
    this.interval = gap > 0 && gap < BREAK_MS ? gap : 0;
    if (this.interval) this.pace(t, this.interval);
    else this.paceTimes.length = this.paceGaps.length = 0;
    if (!this.windowStart) this.windowStart = this.started;
    if (!this.ext || this.pending.length >= MAX_PENDING) return;
    this.query = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.query);
  }

  end() {
    this.onEnd?.();
    const now = performance.now();
    this.cpu += now - this.started;
    this.frames++;
    if (this.query) {
      this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);
      this.pending.push(this.query);
      this.query = null;
    }
    this.collect();
    if (now - this.windowStart < COST_WINDOW_MS) return;
    this.cpuMs = this.cpu / this.frames;
    if (this.gpuFrames) this.gpuMs = this.gpu / this.gpuFrames;
    const span = this.paceGaps.reduce((a, b) => a + b, 0);
    this.fps = span ? Math.round((this.paceGaps.length * 1000) / span) : 0;
    this.worstMs = this.paceGaps.reduce((a, b) => Math.max(a, b), 0);
    this.windowStart = now;
    this.frames = this.cpu = this.gpu = this.gpuFrames = 0;
  }

  private pace(t: number, gap: number) {
    this.paceTimes.push(t);
    this.paceGaps.push(gap);
    let drop = 0;
    while (drop < this.paceTimes.length && this.paceTimes[drop]! <= t - PACE_WINDOW_MS) drop++;
    if (drop) {
      this.paceTimes.splice(0, drop);
      this.paceGaps.splice(0, drop);
    }
    this.sample.push(gap);
    this.sampleMs += gap;
    if (this.refresh) {
      if (this.sampleMs < RECHECK_MS) return;
      // A busy stretch also looks like a slower display: slower counts only while frames cost under half of it.
      const seen = estimateRefresh(this.sample);
      const cheap = this.gpuMs !== null && this.ms < seen * 0.5;
      if (seen < this.refresh * 0.9 || (seen > this.refresh * 1.25 && cheap)) this.refresh = seen;
    } else if (this.sampleMs >= MEASURE_MS && this.sample.length >= MEASURE_FRAMES) {
      this.refresh = estimateRefresh(this.sample);
    } else return;
    this.sample = [];
    this.sampleMs = 0;
  }

  private collect() {
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length && gl.getQueryParameter(this.pending[0]!, gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift()!;
      if (!disjoint) {
        this.gpu += (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
        this.gpuFrames++;
      }
      gl.deleteQuery(query);
    }
  }
}

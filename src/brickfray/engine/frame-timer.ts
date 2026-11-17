type TimerQueryExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

const WINDOW_MS = 500;
const MAX_PENDING = 4;

/**
 * Frame rate the game could sustain without vsync: 1000 / max(CPU, GPU) ms per frame.
 * Without GPU timer queries it falls back to the delivered (refresh-capped) rate.
 */
export class FrameTimer {
  fps = 0;
  ms = 0;
  private readonly ext: TimerQueryExt | null;
  private readonly pending: WebGLQuery[] = [];
  private query: WebGLQuery | null = null;
  private started = 0;
  private windowStart = performance.now();
  private frames = 0;
  private cpu = 0;
  private gpu = 0;
  private gpuFrames = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
  }

  begin() {
    this.started = performance.now();
    if (!this.ext || this.pending.length >= MAX_PENDING) return;
    this.query = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.query);
  }

  end() {
    const now = performance.now();
    this.cpu += now - this.started;
    this.frames++;
    if (this.query) {
      this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);
      this.pending.push(this.query);
      this.query = null;
    }
    this.collect();
    const elapsed = now - this.windowStart;
    if (elapsed < WINDOW_MS) return;
    this.ms = this.gpuFrames ? Math.max(this.cpu / this.frames, this.gpu / this.gpuFrames) : elapsed / this.frames;
    this.fps = Math.round(1000 / Math.max(this.ms, 0.1));
    this.windowStart = now;
    this.frames = this.cpu = this.gpu = this.gpuFrames = 0;
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

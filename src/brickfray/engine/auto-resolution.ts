import * as THREE from 'three';
import type { FrameTimer } from './frame-timer';
import { ResolutionScaler } from './resolution-scale';

/** A lower ratio that never settles on the refresh still gets its smaller canvas after this long. */
const SHRINK_AFTER_MS = 4000;
/** Frames left undrawn at most while the GPU finishes its queue before the canvas shrinks. */
const MAX_SKIPS = 2;

/**
 * Keeps a match's frames on the display's refresh by drawing fewer pixels (ResolutionScaler picks how many).
 * Resizing the canvas waits for the GPU to finish every queued frame (100+ ms when it is the bottleneck), so a lower
 * ratio is first drawn into the canvas's lower-left corner and the compositor stretches the element over the screen;
 * the canvas shrinks to it once frames are back on the refresh, on a frame where the GPU has caught up. Drawing
 * through an offscreen target instead costs more than the pixels it saves (its multisampling isn't resolved on tile).
 */
export class AutoResolution {
  enabled = true;
  private scaler: ResolutionScaler;
  private renderedFrame = -1;
  private stretched = '';
  private largerSince = -1;
  private skipped = 0;
  private fence: WebGLSync | null = null;
  private readonly size = new THREE.Vector2();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly timer: FrameTimer,
    base: number
  ) {
    this.scaler = new ResolutionScaler(base);
    // The menu draws the whole canvas: a frame without a match frame takes the stretch off before it is shown.
    timer.onEnd = () => {
      if (this.renderedFrame !== timer.frame) this.stretch(1, 1);
    };
  }

  /** The ratio a match renders at for the tier's ratio `base`. */
  ratio(base: number) {
    return this.enabled ? this.scaler.ratio : base;
  }

  /** A new tier or switch: start again from the tier's ratio. */
  restart(base: number) {
    this.scaler = new ResolutionScaler(base);
  }

  setBase(base: number) {
    this.scaler.setBase(base);
  }

  /**
   * Once per match frame, before drawing: steps the ratio on missed refreshes (a new device pixel ratio restarts the
   * ladder) and sizes the canvas. False means leave this frame undrawn while the GPU catches up before a shrink.
   */
  prepare(base: number, width: number, height: number): boolean {
    const t = this.timer;
    const continuous = t.frame === this.renderedFrame + 1;
    this.renderedFrame = t.frame;
    if (this.enabled && this.scaler.ladder[0] !== base) {
      t.remeasure();
      this.scaler.setBase(base);
    } else if (this.enabled) {
      this.scaler.frame(continuous ? t.interval : 0, t.refresh, { cpu: t.cpuMs, gpu: t.gpuMs });
    }
    const want = this.ratio(base);
    const canvas = this.renderer.getPixelRatio();
    if (want >= canvas) {
      this.largerSince = -1;
      if (want > canvas) this.renderer.setDrawingBufferSize(width, height, want);
      return true;
    }
    const now = performance.now();
    if (this.largerSince < 0) this.largerSince = now;
    if (this.enabled && !this.scaler.steady && now - this.largerSince < SHRINK_AFTER_MS) return true;
    if (!this.gpuIdle() && this.skipped < MAX_SKIPS) {
      this.skipped++;
      return false;
    }
    this.skipped = 0;
    this.largerSince = -1;
    this.renderer.setDrawingBufferSize(width, height, want);
    return true;
  }

  /** Points the viewport at the part of the canvas a frame at `ratio` fills; returns that part's share. */
  viewport(ratio: number) {
    const canvas = this.renderer.getPixelRatio();
    const scale = Math.min(1, ratio / canvas);
    const full = this.renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.round(full.x * scale));
    const h = Math.max(1, Math.round(full.y * scale));
    this.stretch(full.x / w, full.y / h);
    this.renderer.setViewport(0, 0, w / canvas, h / canvas);
    return scale;
  }

  /** After a drawn match frame: marks where the GPU's work for it ends. */
  drawn() {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  }

  dispose() {
    this.stretch(1, 1);
    this.timer.onEnd = null;
    if (this.fence) (this.renderer.getContext() as WebGL2RenderingContext).deleteSync(this.fence);
    this.fence = null;
  }

  private gpuIdle() {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    return !this.fence || gl.getSyncParameter(this.fence, gl.SYNC_STATUS) === gl.SIGNALED;
  }

  /** The compositor stretches the canvas element so its lower-left `1/sx` by `1/sy` fills the screen. */
  private stretch(sx: number, sy: number) {
    const transform = sx > 1.001 || sy > 1.001 ? `scale(${sx}, ${sy})` : '';
    if (transform === this.stretched) return;
    this.stretched = transform;
    const style = this.renderer.domElement.style;
    style.transformOrigin = '0 100%';
    style.transform = transform;
  }
}

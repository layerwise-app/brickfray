import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameTimer } from './frame-timer';

const fakeGl = (timer: boolean, gpuMs: number) =>
  ({
    QUERY_RESULT_AVAILABLE: 1,
    QUERY_RESULT: 2,
    getExtension: () => (timer ? { TIME_ELAPSED_EXT: 10, GPU_DISJOINT_EXT: 11 } : null),
    createQuery: () => ({}),
    beginQuery: () => {},
    endQuery: () => {},
    deleteQuery: () => {},
    getParameter: () => false,
    getQueryParameter: (_q: unknown, pname: number) => (pname === 1 ? true : gpuMs * 1e6)
  }) as unknown as WebGL2RenderingContext;

/** Runs 60 Hz vsync-paced frames that each cost `cpuMs` of loop work. */
const run = (timer: FrameTimer, now: { t: number }, cpuMs: number) => {
  for (let i = 0; i < 120; i++) {
    timer.begin();
    now.t += cpuMs;
    timer.end();
    now.t += 1000 / 60 - cpuMs;
  }
};

describe('FrameTimer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports what the frame costs, not the display refresh rate', () => {
    const now = { t: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => now.t);
    const timer = new FrameTimer(fakeGl(true, 5));
    run(timer, now, 3);
    expect(timer.ms).toBeCloseTo(5);
    expect(timer.fps).toBe(200);
  });

  it('uses CPU time when the GPU is idle sooner', () => {
    const now = { t: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => now.t);
    const timer = new FrameTimer(fakeGl(true, 2));
    run(timer, now, 8);
    expect(timer.fps).toBe(125);
  });

  it('falls back to the delivered rate without GPU timer queries', () => {
    const now = { t: 0 };
    vi.spyOn(performance, 'now').mockImplementation(() => now.t);
    const timer = new FrameTimer(fakeGl(false, 0));
    run(timer, now, 3);
    expect(timer.fps).toBe(60);
  });
});

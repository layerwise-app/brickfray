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

/** Runs vsync-paced frames that each cost `cpuMs` of loop work; `gap(i)` is the i-th frame's interval. */
const run = (timer: FrameTimer, now: { t: number }, cpuMs: number, frames: number, gap: (i: number) => number = () => 1000 / 60) => {
  for (let i = 0; i < frames; i++) {
    timer.begin();
    now.t += cpuMs;
    timer.end();
    now.t += gap(i) - cpuMs;
  }
};

const clock = () => {
  const now = { t: 1000 };
  vi.spyOn(performance, 'now').mockImplementation(() => now.t);
  return now;
};

describe('FrameTimer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports delivered frames and, separately, what a frame costs', () => {
    const now = clock();
    const timer = new FrameTimer(fakeGl(true, 5));
    run(timer, now, 3, 120);
    expect(timer.fps).toBe(60);
    expect(timer.worstMs).toBeCloseTo(1000 / 60);
    expect(timer.gpuMs).toBeCloseTo(5);
    expect(timer.cpuMs).toBeCloseTo(3);
    expect(timer.ms).toBeCloseTo(5);
  });

  it('shows missed refreshes that the cost hides', () => {
    const now = clock();
    const timer = new FrameTimer(fakeGl(true, 6.5));
    run(timer, now, 2, 300, (i) => (i % 4 === 0 ? 2000 / 144 : 1000 / 144));
    expect(timer.fps).toBeLessThan(120);
    expect(timer.worstMs).toBeCloseTo(2000 / 144);
    expect(Math.round(1000 / timer.ms)).toBe(154);
    expect(timer.refresh).toBeCloseTo(1000 / 144);
  });

  it('uses CPU time when the GPU is idle sooner, and CPU alone without timer queries', () => {
    const now = clock();
    const timed = new FrameTimer(fakeGl(true, 2));
    run(timed, now, 8, 120);
    expect(timed.ms).toBeCloseTo(8);
    const untimed = new FrameTimer(fakeGl(false, 0));
    run(untimed, now, 3, 120);
    expect(untimed.gpuMs).toBeNull();
    expect(untimed.ms).toBeCloseTo(3);
  });

  it('does not count a hidden tab as a frame', () => {
    const now = clock();
    const timer = new FrameTimer(fakeGl(true, 3));
    run(timer, now, 2, 60);
    now.t += 5000;
    run(timer, now, 2, 90);
    expect(timer.worstMs).toBeLessThan(20);
    expect(timer.fps).toBe(60);
  });

  it('measures the refresh again after remeasure()', () => {
    const now = clock();
    const timer = new FrameTimer(fakeGl(true, 3));
    run(timer, now, 2, 200);
    expect(timer.refresh).toBeCloseTo(1000 / 60);
    timer.remeasure();
    expect(timer.refresh).toBe(0);
    run(timer, now, 2, 400, () => 1000 / 120);
    expect(timer.refresh).toBeCloseTo(1000 / 120);
  });
});

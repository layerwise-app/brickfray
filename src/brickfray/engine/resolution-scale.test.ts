import { describe, expect, it } from 'vitest';
import { estimateRefresh, ResolutionScaler, scaleLadder, type FrameCost } from './resolution-scale';

const HZ120 = 1000 / 120;

/**
 * Feeds up to `seconds` of frames on a 120 Hz display, stopping early once the ratio changes when `untilChange`;
 * every `missEvery`-th frame takes two refreshes. Returns the ratios seen and the ms run.
 */
const run = (s: ResolutionScaler, seconds: number, missEvery: number, cost: FrameCost = { cpu: 2, gpu: 7 }, untilChange = false) => {
  const seen = new Set<number>();
  const start = s.ratio;
  let t = 0;
  for (let i = 1; t < seconds * 1000; i++) {
    const gap = missEvery && i % missEvery === 0 ? 2 * HZ120 : HZ120;
    t += gap;
    s.frame(gap, HZ120, cost);
    seen.add(s.ratio);
    if (untilChange && s.ratio !== start) break;
  }
  return { seen, ms: t };
};

describe('scaleLadder', () => {
  it('starts at the tier ratio and steps down to the 0.7 floor', () => {
    expect(scaleLadder(1.5)).toEqual([1.5, 1.25, 1, 0.85, 0.7]);
    expect(scaleLadder(2)).toEqual([2, 1.75, 1.5, 1.25, 1, 0.85, 0.7]);
    expect(scaleLadder(1)).toEqual([1, 0.85, 0.7]);
    expect(scaleLadder(1.1)).toEqual([1.1, 1, 0.85, 0.7]);
  });
});

describe('estimateRefresh', () => {
  it('finds the refresh even when many frames miss it', () => {
    const gaps = Array.from({ length: 200 }, (_, i) => (i % 5 < 2 ? 2 * HZ120 : HZ120 + (i % 3) * 0.2 - 0.2));
    expect(estimateRefresh(gaps)).toBeCloseTo(HZ120, 0);
  });

  it('ignores a few short gaps from jitter', () => {
    const gaps = Array.from({ length: 120 }, (_, i) => (i === 7 ? 3 : 1000 / 60));
    expect(estimateRefresh(gaps)).toBeCloseTo(1000 / 60, 1);
  });
});

describe('ResolutionScaler', () => {
  it('holds the tier ratio while every refresh is met', () => {
    const s = new ResolutionScaler(1.5);
    expect(run(s, 20, 0).seen).toEqual(new Set([1.5]));
  });

  it('does nothing until the refresh is known', () => {
    const s = new ResolutionScaler(1.5);
    for (let i = 0; i < 600; i++) s.frame(2 * HZ120, 0, { cpu: 2, gpu: 12 });
    expect(s.ratio).toBe(1.5);
  });

  it('steps down one level when a few percent of frames keep missing', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 1.05, 10);
    expect(s.ratio).toBe(1.5);
    run(s, 1.05, 10);
    expect(s.ratio).toBe(1.25);
  });

  it('is steady only after clean seconds since the last change', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 1.05, 2);
    expect(s.ratio).toBe(1.25);
    expect(s.steady).toBe(false);
    run(s, 2, 0, { cpu: 2, gpu: 6 });
    expect(s.steady).toBe(false);
    run(s, 1.2, 0, { cpu: 2, gpu: 6 });
    expect(s.steady).toBe(true);
  });

  it('ignores one bad second, such as a hitch burst', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 1.05, 8);
    run(s, 5, 0);
    expect(s.ratio).toBe(1.5);
  });

  it('steps at once when most frames miss, and never below the floor', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 1.05, 2);
    expect(s.ratio).toBe(1.25);
    run(s, 30, 2, { cpu: 2, gpu: 16 });
    expect(s.ratio).toBe(0.7);
  });

  it('keeps the resolution when the GPU is mostly idle and frames miss anyway', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 10, 2, { cpu: 12, gpu: 3 });
    expect(s.ratio).toBe(1.5);
  });

  it('steps back up after clean seconds only when the higher ratio is predicted to fit', () => {
    const heavy = new ResolutionScaler(1.5);
    run(heavy, 1.05, 2);
    expect(heavy.ratio).toBe(1.25);
    // 5.5 ms at 1.25 predicts 7.9 ms at 1.5: over 70% of 8.3 ms.
    run(heavy, 30, 0, { cpu: 2, gpu: 5.5 });
    expect(heavy.ratio).toBe(1.25);

    const light = new ResolutionScaler(1.5);
    run(light, 1.05, 2);
    expect(light.ratio).toBe(1.25);
    run(light, 3, 0, { cpu: 2, gpu: 3 });
    expect(light.ratio).toBe(1.25);
    run(light, 2, 0, { cpu: 2, gpu: 3 });
    expect(light.ratio).toBe(1.5);
  });

  it('waits longer each time a step up fails, then stops trying it', () => {
    const s = new ResolutionScaler(1.5);
    const ups: number[] = [];
    for (let k = 0; k < 6; k++) {
      run(s, 5, 2, { cpu: 2, gpu: 7 }, true);
      expect(s.ratio).toBe(1.25);
      const { ms } = run(s, 300, 0, { cpu: 2, gpu: 3 }, true);
      if (s.ratio === 1.25) break;
      ups.push(ms);
    }
    expect(ups.length).toBe(3);
    expect(ups[1]!).toBeGreaterThan(ups[0]! * 3);
    expect(ups[2]!).toBeGreaterThan(ups[1]! * 3);
  });

  it('waits twice as long to step up without GPU timing', () => {
    const s = new ResolutionScaler(1.5);
    run(s, 1.05, 2);
    run(s, 6, 0, { cpu: 2, gpu: null });
    expect(s.ratio).toBe(1.25);
    run(s, 4, 0, { cpu: 2, gpu: null });
    expect(s.ratio).toBe(1.5);
  });
});

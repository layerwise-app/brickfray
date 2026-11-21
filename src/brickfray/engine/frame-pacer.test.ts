import { describe, expect, it } from 'vitest';
import { FramePacer } from './frame-pacer';
import type { FrameCost } from './resolution-scale';

const HZ144 = 1000 / 144;
const HEAVY: FrameCost = { cpu: 3, gpu: 8 };
const LIGHT: FrameCost = { cpu: 2, gpu: 3 };

/**
 * Feeds `seconds` of drawn frames at the pacer's current rate on a display of `refresh` ms; every `missEvery`-th
 * frame comes one refresh late. Stops at the first change when `untilChange`. Returns the divisors seen and ms run.
 */
const run = (p: FramePacer, seconds: number, missEvery: number, cost: FrameCost, exhausted = true, untilChange = false, refresh = HZ144) => {
  const seen = new Set<number>([p.divisor]);
  let t = 0;
  for (let i = 1; t < seconds * 1000; i++) {
    const gap = (p.divisor + (missEvery && i % missEvery === 0 ? 1 : 0)) * refresh;
    t += gap;
    const changed = p.frame(gap, refresh, cost, exhausted);
    seen.add(p.divisor);
    if (untilChange && changed) break;
  }
  return { seen, ms: t };
};

describe('FramePacer', () => {
  it('keeps every refresh while frames hold it', () => {
    const p = new FramePacer();
    expect(run(p, 20, 0, LIGHT).seen).toEqual(new Set([1]));
  });

  it('never halves a display slower than about 100 Hz', () => {
    const p = new FramePacer();
    expect(run(p, 10, 3, HEAVY, true, false, 1000 / 60).seen).toEqual(new Set([1]));
  });

  it('leaves misses to the resolution scaler while it can still step down', () => {
    const p = new FramePacer();
    expect(run(p, 10, 3, HEAVY, false).seen).toEqual(new Set([1]));
  });

  it('halves the rate after two windows with a few percent missed', () => {
    const p = new FramePacer();
    const r = run(p, 10, 10, HEAVY, true, true);
    expect(p.divisor).toBe(2);
    expect(r.ms).toBeGreaterThan(1900);
    expect(r.ms).toBeLessThan(2300);
  });

  it('halves at once when a quarter of the frames miss', () => {
    const p = new FramePacer();
    const r = run(p, 5, 3, HEAVY, true, true);
    expect(p.divisor).toBe(2);
    expect(r.ms).toBeLessThan(1200);
  });

  it('draws on every second refresh when halved, and at once after a late frame', () => {
    const p = new FramePacer();
    run(p, 5, 3, HEAVY, true, true);
    expect(p.due(HZ144, HZ144)).toBe(false);
    expect(p.due(2 * HZ144, HZ144)).toBe(true);
    // Refresh timestamps jitter by a fraction of a millisecond.
    expect(p.due(2 * HZ144 - 0.4, HZ144)).toBe(true);
    expect(p.due(3 * HZ144, HZ144)).toBe(true);
  });

  it('goes back to every refresh only with clear headroom', () => {
    const p = new FramePacer();
    run(p, 5, 3, HEAVY, true, true);
    expect(run(p, 30, 0, HEAVY).seen).toEqual(new Set([2]));
    const r = run(p, 30, 0, LIGHT, true, true);
    expect(p.divisor).toBe(1);
    expect(r.ms).toBeGreaterThan(3900);
    expect(r.ms).toBeLessThan(5100);
  });

  it('waits four times longer after each failed return, and stays halved after three', () => {
    const p = new FramePacer();
    run(p, 5, 3, HEAVY, true, true);
    const waits: number[] = [];
    for (let k = 0; k < 4; k++) {
      const up = run(p, 400, 0, LIGHT, true, true);
      if (p.divisor === 1) waits.push(up.ms);
      run(p, 5, 3, HEAVY, true, true);
    }
    expect(waits.length).toBe(3);
    expect(waits[1]! / waits[0]!).toBeGreaterThan(3.5);
    expect(waits[2]! / waits[1]!).toBeGreaterThan(3.5);
    expect(p.divisor).toBe(2);
  });

  it('returns to every refresh on a slower display', () => {
    const p = new FramePacer();
    run(p, 5, 3, HEAVY, true, true);
    expect(p.frame(1000 / 60, 1000 / 60, HEAVY, true)).toBe(true);
    expect(p.divisor).toBe(1);
  });
});

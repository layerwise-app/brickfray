import { describe, expect, it } from 'vitest';
import { FALLOFF, inverseGain } from './catalog';
import { AUDIBLE, audibility, behind } from './positional';

describe('positional', () => {
  it('fades a distant sound out over the audible floor instead of cutting it off', () => {
    expect(audibility(AUDIBLE.full + 5)).toBe(1);
    expect(audibility(AUDIBLE.gone - 1)).toBe(0);
    let last = 1;
    for (let e = AUDIBLE.full; e >= AUDIBLE.gone; e -= 0.5) {
      const g = audibility(e);
      expect(g).toBeLessThanOrEqual(last);
      expect(last - g).toBeLessThan(0.1);
      last = g;
    }
  });

  it('carries footsteps further without touching near ones or letting a farther step sound louder', () => {
    const { ref, rolloff } = FALLOFF.step;
    const plain = (d: number) => ref / (ref + rolloff * (Math.max(d, ref) - ref));
    for (const d of [1, 3, 5, 8, 45, 60]) expect(inverseGain('step', d)).toBeCloseTo(plain(d), 9);
    expect(inverseGain('step', 25) / plain(25)).toBeGreaterThan(1.9);
    let last = Infinity;
    for (let d = 2; d <= 60; d += 0.25) {
      const g = inverseGain('step', d);
      expect(g).toBeLessThan(last);
      last = g;
    }
  });

  it('shades only sources behind the listener', () => {
    const at = { x: 0, y: 0, z: 0 };
    const forward = { x: 0, y: 0, z: -1 };
    expect(behind(at, forward, { x: 0, y: 0, z: -10 })).toBe(0);
    expect(behind(at, forward, { x: 10, y: 0, z: 0 })).toBe(0);
    expect(behind(at, forward, { x: 0, y: 0, z: 10 })).toBeCloseTo(1);
    expect(behind(at, forward, { x: 10, y: 0, z: 10 })).toBeCloseTo(Math.SQRT1_2);
  });
});

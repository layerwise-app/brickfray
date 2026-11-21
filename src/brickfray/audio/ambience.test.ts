import { describe, expect, it } from 'vitest';
import { nextStretch, type Stretch } from './ambience';
import { mulberry32 } from './synth';

describe('ambience stretches', () => {
  it('chains stretches that overlap by three seconds, stay inside the recording and never replay what is fading out', () => {
    const rng = mulberry32(5);
    const duration = 24;
    let previous: Stretch | null = null;
    const offsets = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const next = nextStretch(duration, previous, rng);
      expect(next.offset).toBeGreaterThanOrEqual(0.06);
      expect(next.offset + next.length).toBeLessThanOrEqual(duration - 0.06 + 1e-9);
      expect(next.length).toBeGreaterThanOrEqual(9);
      if (previous) {
        expect(next.at).toBeCloseTo(previous.at + previous.length - 3);
        expect(Math.abs(next.offset - (previous.offset + previous.length - 3))).toBeGreaterThanOrEqual(1.5);
      }
      offsets.add(Math.round(next.offset));
      previous = next;
    }
    expect(offsets.size).toBeGreaterThan(10);
  });
});

import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './catalog';
import { SAMPLES } from './samples';
import { SOUNDS } from './sounds';
import { TAKE_PITCH } from './takes';
import type { SoundId } from './types';

describe('take pitch', () => {
  it('gives every take of a family an offset and keeps differently pitched takes apart beyond the rate jitter', () => {
    for (const [id, cents] of Object.entries(TAKE_PITCH) as [SoundId, readonly number[]][]) {
      expect(cents.length, id).toBe(SAMPLES[id]?.length);
      const jitter = 1200 * Math.log2(1 + CATEGORIES[SOUNDS[id].category].jitter);
      for (const a of cents) for (const b of cents) if (a !== b) expect(Math.abs(a - b), id).toBeGreaterThan(1.2 * jitter);
    }
  });
});

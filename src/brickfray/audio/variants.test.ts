import { describe, expect, it } from 'vitest';
import { mulberry32 } from './synth';
import { VariantPicker } from './variants';

function run(count: number, n = 2000): number[] {
  const picker = new VariantPicker(mulberry32(7));
  return Array.from({ length: n }, () => picker.pick('x', count));
}

/** Longest stretch where every pick equals the one two before it (A-B-A-B...). */
function longestAlternation(seq: number[]): number {
  let best = 0;
  let run = 0;
  for (let i = 2; i < seq.length; i++) {
    run = seq[i] === seq[i - 2] && seq[i] !== seq[i - 1] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

describe('VariantPicker', () => {
  it('never alternates two variants strictly', () => {
    const seq = run(2);
    expect(longestAlternation(seq)).toBeLessThan(14);
    let triples = 0;
    let repeats = 0;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] === seq[i - 1]) repeats++;
      if (i >= 2 && seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) triples++;
    }
    expect(triples).toBe(0);
    expect(repeats / seq.length).toBeGreaterThan(0.2);
  });

  it('never repeats and spreads evenly with three variants', () => {
    const seq = run(3);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    for (let v = 0; v < 3; v++) expect(seq.filter((s) => s === v).length / seq.length).toBeCloseTo(1 / 3, 1);
    expect(longestAlternation(seq)).toBeLessThan(8);
  });

  it('never plays either of the last two with four or more variants', () => {
    for (const count of [4, 6]) {
      const seq = run(count);
      for (let i = 2; i < seq.length; i++) {
        expect(seq[i]).not.toBe(seq[i - 1]);
        expect(seq[i]).not.toBe(seq[i - 2]);
      }
      for (let v = 0; v < count; v++) expect(seq.filter((s) => s === v).length / seq.length).toBeCloseTo(1 / count, 1);
    }
  });
});

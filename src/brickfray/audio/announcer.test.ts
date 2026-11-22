import { describe, expect, it } from 'vitest';
import { ANNOUNCER_DELAY, ANNOUNCER_GAP, ANNOUNCER_LINES, lineFor, nextSlot } from './announcer';

describe('announcer lines', () => {
  it('one line per chain from a double kill up, the last one for every longer chain', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map((n) => (lineFor(n) < 0 ? null : ANNOUNCER_LINES[lineFor(n)]))).toEqual([null, 'chain-2', 'chain-3', 'chain-4', 'chain-5', 'chain-6', 'chain-6', 'chain-6']);
  });

  it('never cuts a line: a fast chain waits behind the one speaking and only its highest count is heard', () => {
    const LINE = 1.2;
    const heard: { count: number; start: number; end: number }[] = [];
    let last: { start: number; end: number } | null = null;
    // kills 0.3 s apart: a chain of 2 to 6, all of it while the double kill speaks
    for (const [i, count] of [2, 3, 4, 5, 6].entries()) {
      const now = i * 0.3;
      const { start, replaces } = nextSlot(last, now);
      if (replaces) heard.pop();
      last = { start, end: start + LINE };
      heard.push({ count, ...last });
    }
    expect(heard.map((h) => h.count)).toEqual([2, 6]);
    expect(heard[0]!.start).toBeCloseTo(ANNOUNCER_DELAY);
    expect(heard[1]!.start).toBeCloseTo(heard[0]!.end + ANNOUNCER_GAP);
    for (let i = 1; i < heard.length; i++) expect(heard[i]!.start).toBeGreaterThanOrEqual(heard[i - 1]!.end);
  });

  it('a line not yet heard gives its slot to the newer one; a lone line starts after the kill sound', () => {
    expect(nextSlot(null, 10)).toEqual({ start: 10 + ANNOUNCER_DELAY, replaces: false });
    expect(nextSlot({ start: 10.3, end: 11.4 }, 10.1)).toEqual({ start: 10.3, replaces: true });
    expect(nextSlot({ start: 10.3, end: 11.4 }, 12)).toEqual({ start: 12 + ANNOUNCER_DELAY, replaces: false });
  });
});

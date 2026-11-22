import { describe, expect, it } from 'vitest';
import { ANNOUNCER_LINES, lineFor } from './announcer';

describe('announcer lines', () => {
  it('one line per chain from a double kill up, the last one for every longer chain', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map((n) => (lineFor(n) < 0 ? null : ANNOUNCER_LINES[lineFor(n)]))).toEqual([null, 'chain-2', 'chain-3', 'chain-4', 'chain-5', 'chain-6', 'chain-6', 'chain-6']);
  });
});

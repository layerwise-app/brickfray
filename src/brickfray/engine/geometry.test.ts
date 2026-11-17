import { describe, expect, test } from 'vitest';
import { partGeometry, PITCH, PLATE } from './geometry';
import { QUALITY } from './quality';

describe('round parts', () => {
  test.each([2, 4, 5, 6])('size %i keeps every stud on its top face', (size) => {
    const position = partGeometry({ w: size, d: size, h: 1, shape: 'round' }, QUALITY.high).getAttribute('position');
    const rim = (size * PITCH) / 2;
    let farthest = 0;
    let top = 0;
    for (let i = 0; i < position.count; i++) {
      farthest = Math.max(farthest, Math.hypot(position.getX(i), position.getZ(i)));
      top = Math.max(top, position.getY(i));
    }
    expect(farthest).toBeLessThan(rim + 0.01);
    expect(top).toBeGreaterThan(PLATE);
  });
});

import { describe, expect, it } from 'vitest';
import { isStep, StepSmoother } from './step-smoother';

const TICK = 1 / 60;
const FRAME = 1 / 144;

/** Ticks at 60 Hz, renders interpolated frames at 144 Hz walking 5 m/s along +x; returns camera heights. */
function walk(floor: (x: number) => number, seconds: number, grounded = true) {
  const smoother = new StepSmoother();
  let prev = { x: 0, y: floor(0), z: 0, grounded };
  let next = { ...prev };
  let acc = 0;
  const cams: number[] = [];
  for (let t = 0; t < seconds; t += FRAME) {
    acc += FRAME;
    while (acc >= TICK) {
      acc -= TICK;
      prev = next;
      const x = prev.x + 5 * TICK;
      next = { x, y: floor(x), z: 0, grounded };
      smoother.tick(prev, next);
    }
    const alpha = acc / TICK;
    cams.push(prev.y + (next.y - prev.y) * alpha + smoother.frame(alpha, FRAME));
  }
  return { cams, offset: smoother.offset };
}

const steepest = (cams: number[]) => Math.max(...cams.slice(1).map((y, i) => Math.abs(y - cams[i]!)));

describe('StepSmoother', () => {
  it('climbs 0.48 m stair steps at a steady speed instead of popping a step at a time', () => {
    const { cams, offset } = walk((x) => Math.min(8, Math.floor(x / 0.8)) * 0.48, 2.2);
    expect(steepest(cams) / FRAME).toBeLessThan(4.5);
    expect(Math.abs(offset)).toBeLessThan(0.01);
  });

  it('leaves ramps alone', () => {
    const { cams, offset } = walk((x) => x * 0.6, 1);
    expect(steepest(cams)).toBeCloseTo(5 * FRAME * 0.6, 2);
    expect(offset).toBe(0);
  });

  it('leaves jumps and falls alone', () => {
    const { offset } = walk((x) => Math.floor(x / 0.8) * 0.48, 1, false);
    expect(offset).toBe(0);
    expect(isStep({ x: 0, y: 0, z: 0, grounded: true }, { x: 0, y: 3, z: 0, grounded: true })).toBe(false);
  });
});

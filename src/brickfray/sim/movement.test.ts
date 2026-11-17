import { describe, expect, it } from 'vitest';
import type { Collider } from '../world/types';
import { CollisionWorld } from './collision';
import { TICK } from './constants';
import { createMoveState, stepMove, type MoveInput } from './movement';

const box = (min: [number, number, number], max: [number, number, number]): Collider => ({ min, max, surface: 'plastic' });
const floor = box([-50, -1, -50], [50, 0, 50]);
const idle: MoveInput = { forward: 0, right: 0, yaw: 0, jump: false, crouch: false, sprint: false, ads: false };

function run(world: CollisionWorld, seconds: number, input: Partial<MoveInput>, start = createMoveState(0, 0, 0)) {
  const s = start;
  for (let t = 0; t < seconds; t += TICK) stepMove(world, s, { ...idle, ...input }, TICK);
  return s;
}

describe('stepMove', () => {
  it('walks toward -Z at walk speed and stays on the floor', () => {
    const s = run(new CollisionWorld([floor]), 1, { forward: 1 });
    expect(s.grounded).toBe(true);
    expect(s.y).toBeCloseTo(0, 3);
    expect(s.z).toBeLessThan(-4);
    expect(Math.hypot(s.vx, s.vz)).toBeCloseTo(4.6, 1);
  });

  it('stops flush against a wall', () => {
    const s = run(new CollisionWorld([floor, box([-5, 0, -3], [5, 3, -2])]), 2, { forward: 1 });
    expect(s.z).toBeGreaterThan(-2 + 0.29);
    expect(s.z).toBeLessThan(-2 + 0.31);
  });

  it('steps up a one-brick ledge but not a higher one', () => {
    const low = run(new CollisionWorld([floor, box([-5, 0, -8], [5, 0.48, -2])]), 1.5, { forward: 1 });
    expect(low.y).toBeCloseTo(0.48, 2);
    expect(low.z).toBeLessThan(-3);
    const high = run(new CollisionWorld([floor, box([-5, 0, -8], [5, 0.64, -2])]), 1.5, { forward: 1 });
    expect(high.y).toBeCloseTo(0, 2);
  });

  it('jumps about 1.2 m and lands with an impact speed', () => {
    const world = new CollisionWorld([floor]);
    const s = run(world, 0.2, {});
    let peak = 0;
    let landed = 0;
    stepMove(world, s, { ...idle, jump: true }, TICK);
    for (let i = 0; i < 120; i++) {
      stepMove(world, s, { ...idle, jump: true }, TICK);
      peak = Math.max(peak, s.y);
      landed = Math.max(landed, s.landed);
    }
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.3);
    expect(landed).toBeGreaterThan(5);
    expect(s.grounded).toBe(true);
  });

  it('cannot stand up under a low ceiling', () => {
    const world = new CollisionWorld([floor, box([-5, 1.4, -5], [5, 2, 5])]);
    const s = run(world, 0.5, { crouch: true });
    expect(s.crouch).toBe(1);
    run(world, 0.5, {}, s);
    expect(s.crouch).toBeGreaterThan(0.6);
  });

  it('walks down stairs without leaving the ground', () => {
    const steps = [0, 1, 2, 3].map((i) => box([-5, 0, -(i + 1) * 0.5], [5, 1.6 - i * 0.4, -i * 0.5]));
    const top = box([-5, 0, 0], [5, 2, 6]);
    const world = new CollisionWorld([floor, top, ...steps]);
    const s = run(world, 0.3, {}, createMoveState(0, 2, 2));
    let airborne = 0;
    for (let i = 0; i < 90; i++) {
      stepMove(world, s, { ...idle, forward: 1 }, TICK);
      if (!s.grounded) airborne++;
    }
    expect(s.z).toBeLessThan(-4);
    expect(airborne).toBeLessThan(6);
  });
});

describe('CollisionWorld.raycast', () => {
  it('stays finite for level rays that graze a box face', () => {
    const world = new CollisionWorld([{ min: [-1, 0, -6], max: [1, 2, -4], surface: 'plastic' }]);
    // Eye exactly at the top face height, aiming level past the box's side.
    expect(world.raycast(5, 2, 0, -1, 0, 0, 20, true)).toBeNull();
    const hit = world.raycast(0, 1, 0, 0, 0, -1, 20, true);
    expect(hit?.t).toBeCloseTo(4);
    expect(world.raycast(0, 2, 0, 0, 0, -1, 3, true)).toBeNull();
  });
});

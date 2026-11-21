import { describe, expect, it } from 'vitest';
import { Turntable } from './stage-turn';

const STEP = 1 / 60;
const run = (table: Turntable, seconds: number) => {
  for (let t = 0; t < seconds; t += STEP) table.update(STEP);
};

describe('Turntable', () => {
  it('follows the drag exactly while held', () => {
    const table = new Turntable();
    table.grab();
    table.drag(0.12, 0.016);
    table.drag(-0.04, 0.016);
    run(table, 0.5);
    expect(table.angle).toBeCloseTo(0.08, 6);
    expect(table.engaged).toBe(true);
  });

  it('turns no faster than its top speed under a flick and carries that speed through the release', () => {
    const table = new Turntable();
    table.grab();
    let last = 0;
    let during = 0;
    for (let i = 0; i < 6; i++) {
      table.drag(0.7, STEP);
      table.update(STEP);
      during = (table.angle - last) / STEP;
      last = table.angle;
    }
    expect(during).toBeGreaterThan(12);
    expect(during).toBeLessThan(14);
    table.release();
    table.update(STEP);
    const after = (table.angle - last) / STEP;
    expect(after).toBeGreaterThan(during * 0.93);
    expect(after).toBeLessThan(during);
  });

  it('keeps spinning after a throw, then slows down', () => {
    const table = new Turntable();
    table.grab();
    for (let i = 0; i < 6; i++) {
      table.drag(0.05, STEP);
      table.update(STEP);
    }
    const thrown = table.angle;
    table.release();
    run(table, 0.3);
    const early = table.angle - thrown;
    expect(early).toBeGreaterThan(0.3);
    run(table, 0.3);
    expect(table.angle - thrown - early).toBeLessThan(early);
  });

  it('moves the figure on every frame under a slow drag whose events come at 20 Hz', () => {
    const table = new Turntable();
    table.grab();
    let last = table.turn;
    const steps: number[] = [];
    for (let i = 0; i < 60; i++) {
      if (i % 3 === 0) table.drag(0.06, 0.05);
      table.update(STEP);
      steps.push(table.turn - last);
      last = table.turn;
    }
    const tail = steps.slice(20);
    expect(Math.min(...tail)).toBeGreaterThan(0.005);
    expect(Math.max(...tail) / Math.min(...tail)).toBeLessThan(1.5);
  });

  it('does not throw when the pointer rested before letting go', () => {
    const table = new Turntable();
    table.grab();
    table.drag(0.12, STEP);
    run(table, 0.3);
    table.release();
    run(table, 0.5);
    expect(table.angle).toBeCloseTo(0.12, 6);
  });

  it('comes back to the front the short way and hands the figure back to the idle', () => {
    const table = new Turntable();
    table.grab();
    table.drag(Math.PI * 2 - 0.6, 1);
    run(table, 0.2);
    table.release();
    let overshoot = 0;
    for (let t = 0; t < 6; t += STEP) {
      table.update(STEP);
      expect(Math.abs(table.angle)).toBeLessThanOrEqual(0.6 + 1e-6);
      overshoot = Math.max(overshoot, table.angle);
    }
    expect(overshoot).toBeLessThan(0.02);
    expect(table.engaged).toBe(false);
    expect(table.turn).toBe(0);
  });

  it('holds a released figure at its angle for three seconds before turning back', () => {
    const table = new Turntable();
    table.grab();
    table.drag(2, 1);
    run(table, 0.2);
    table.release();
    run(table, 3);
    expect(table.angle).toBeCloseTo(2, 6);
    run(table, 0.5);
    expect(table.angle).toBeLessThan(2);
  });

  it('spins a throw down to a stop and never speeds up again; the turn back is eased and capped', () => {
    const table = new Turntable();
    table.grab();
    for (let i = 0; i < 6; i++) {
      table.drag(0.15, STEP);
      table.update(STEP);
    }
    table.release();
    let last = table.angle;
    let speed = Infinity;
    let stopped = -1;
    let fastest = 0;
    for (let t = 0; t < 12; t += STEP) {
      table.update(STEP);
      // The angle may jump by whole turns when the turn back begins; the step taken is what moves on screen.
      let step = table.turn - last;
      step -= Math.round(step / (Math.PI * 2)) * Math.PI * 2;
      const now = Math.abs(step) / STEP;
      last = table.turn;
      // The shown turn closes on the hand's over a few frames after the release before it only slows.
      if (t < 0.15) continue;
      if (stopped < 0) {
        expect(now).toBeLessThanOrEqual(speed + 1e-6);
        speed = now;
        if (now === 0) stopped = t;
      } else fastest = Math.max(fastest, now);
    }
    expect(stopped).toBeGreaterThan(0);
    expect(fastest).toBeGreaterThan(0.3);
    expect(fastest).toBeLessThanOrEqual(1.5 + 1e-3);
    expect(table.engaged).toBe(false);
  });

  it('takes the figure from the swaying idle where it stands and gives it back in step, never jumping', () => {
    const table = new Turntable();
    const sway = (t: number) => 0.1 * Math.sin(t * 0.35);
    let t = 3;
    let last = sway(t);
    const tick = (limit: number) => {
      t += STEP;
      table.update(STEP, sway(t));
      expect(Math.abs(table.turn - last)).toBeLessThan(limit);
      last = table.turn;
    };
    for (let i = 0; i < 30; i++) tick(0.002);
    table.grab();
    for (let i = 0; i < 30; i++) tick(1e-9);
    table.drag(0.4, 0.2);
    last = table.turn;
    for (let i = 0; i < 20; i++) tick(0.4 * 0.32);
    expect(table.turn).toBeGreaterThan(table.angle - 0.002);
    table.release();
    for (let i = 0; i < 8 / STEP; i++) tick(0.02);
    expect(table.engaged).toBe(false);
    expect(table.turn).toBe(sway(t));
  });
});

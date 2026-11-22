import { describe, expect, it } from 'vitest';
import { BUTTON } from '../sim/types';
import { lookGain, TouchInput, type Drag, type TouchFrame } from './touch-input';

const frame = (): TouchFrame => ({ lookYaw: 0, lookPitch: 0, forward: 0, right: 0, buttons: 0, cycle: 0, scoreboard: false });
const drag = (): Drag => ({ x: 0, y: 0, t: 0, speed: 0, live: false });

/** One frame of intent at `now` ms with no assist and no auto-fire. */
function step(touch: TouchInput, now: number, extra: Partial<{ assist: (y: number, p: number) => [number, number]; sights: () => boolean }> = {}) {
  const f = frame();
  touch.apply(f, 1 / 60, now, 1, false, extra.assist ?? null, extra.sights ?? null);
  return f;
}

describe('touch input', () => {
  it('turns slowly for fine aim and quickly for flicks', () => {
    expect(lookGain(0)).toBeCloseTo(0.75);
    expect(lookGain(5000)).toBeCloseTo(1.9);
    expect(lookGain(400)).toBeGreaterThan(lookGain(200));
  });

  it('runs at full reach, walks short of it, and stops running to fire', () => {
    const touch = new TouchInput();
    touch.stick(0, -0.5);
    let f = step(touch, 0);
    expect(f.forward).toBeGreaterThan(0.3);
    expect(f.buttons & BUTTON.sprint).toBe(0);
    touch.stick(0, -1);
    f = step(touch, 16);
    expect(f.forward).toBe(1);
    expect(f.buttons & BUTTON.sprint).toBe(BUTTON.sprint);
    touch.press('fire', 32);
    f = step(touch, 32);
    expect(f.buttons & BUTTON.fire).toBe(BUTTON.fire);
    expect(f.buttons & BUTTON.sprint).toBe(0);
  });

  it('keeps running after letting go in the lock spot until the stick or fire is touched', () => {
    const touch = new TouchInput();
    touch.stick(0, -1);
    touch.stickEnd(true);
    let f = step(touch, 0);
    expect(f.forward).toBe(1);
    expect(f.buttons & BUTTON.sprint).toBe(BUTTON.sprint);
    touch.stick(0.3, 0);
    expect(touch.sprintLock).toBe(false);
    touch.stickEnd(true);
    touch.press('fire', 10);
    expect(touch.sprintLock).toBe(false);
  });

  it('slides on a crouch tap while running, and toggles crouch while walking', () => {
    const touch = new TouchInput();
    touch.stick(0, -1);
    touch.press('crouch', 0);
    touch.release('crouch', 40);
    expect(touch.crouch).toBe(false);
    expect(step(touch, 100).buttons & BUTTON.crouch).toBe(BUTTON.crouch);
    expect(step(touch, 400).buttons & BUTTON.crouch).toBe(0);
    touch.stick(0, -0.4);
    touch.press('crouch', 500);
    touch.release('crouch', 540);
    expect(touch.crouch).toBe(true);
    expect(step(touch, 1000).buttons & BUTTON.crouch).toBe(BUTTON.crouch);
  });

  it('toggles aim on a tap and holds it only while held on a long press', () => {
    const touch = new TouchInput();
    touch.press('ads', 0);
    touch.release('ads', 120);
    expect(touch.ads).toBe(true);
    touch.press('ads', 1000);
    touch.release('ads', 1050);
    expect(touch.ads).toBe(false);
    touch.press('ads', 2000);
    touch.release('ads', 2600);
    expect(touch.ads).toBe(false);
  });

  it('ignores a tap that barely moves on a button, then turns once the finger drags', () => {
    const touch = new TouchInput();
    const d = drag();
    touch.beginDrag(d, 100, 100, 0, false);
    touch.drag(d, 103, 102, 16);
    expect(step(touch, 16).lookYaw).toBe(0);
    touch.drag(d, 140, 100, 32);
    expect(step(touch, 32).lookYaw).toBeLessThan(0);
  });

  it('helps aim only while a finger aims or the gun fires', () => {
    const touch = new TouchInput();
    const assist = (y: number, p: number): [number, number] => [y + 1, p];
    expect(step(touch, 0, { assist }).lookYaw).toBe(0);
    const d = drag();
    touch.beginDrag(d, 0, 0, 0, true);
    expect(step(touch, 16, { assist }).lookYaw).toBeCloseTo(1 / 60);
    touch.endDrag();
    expect(step(touch, 32, { assist }).lookYaw).toBe(0);
  });

  it('auto-fires a moment after an enemy is in the sights and stops a moment after it leaves', () => {
    const touch = new TouchInput();
    let on = true;
    const sights = () => on;
    expect(step(touch, 0, { sights }).buttons & BUTTON.fire).toBe(0);
    expect(step(touch, 80, { sights }).buttons & BUTTON.fire).toBe(BUTTON.fire);
    on = false;
    expect(step(touch, 150, { sights }).buttons & BUTTON.fire).toBe(BUTTON.fire);
    expect(step(touch, 300, { sights }).buttons & BUTTON.fire).toBe(0);
  });

  it('keeps a tap that starts and ends between two frames', () => {
    const touch = new TouchInput();
    touch.press('jump', 0);
    touch.release('jump', 5);
    expect(step(touch, 16).buttons & BUTTON.jump).toBe(BUTTON.jump);
    expect(step(touch, 32).buttons & BUTTON.jump).toBe(0);
  });

  it('cooks a low throw when a grenade is held on the run', () => {
    const touch = new TouchInput();
    touch.stick(0, -1);
    touch.press('grenade', 0);
    expect(step(touch, 16).buttons & (BUTTON.grenade | BUTTON.grenadeLow)).toBe(BUTTON.grenade | BUTTON.grenadeLow);
    touch.stickEnd(false);
    expect(step(touch, 32).buttons & (BUTTON.grenade | BUTTON.grenadeLow)).toBe(BUTTON.grenade);
  });

  it('lets go of everything on a reset, aiming fingers included', () => {
    const touch = new TouchInput();
    const assist = (y: number, p: number): [number, number] => [y + 1, p];
    touch.press('ads', 0);
    touch.stick(0, -1);
    touch.stickEnd(true);
    touch.beginDrag(drag(), 0, 0, 0, true);
    touch.reset();
    expect([touch.ads, touch.sprintLock]).toEqual([false, false]);
    const f = step(touch, 16, { assist });
    expect([f.forward, f.buttons, f.lookYaw]).toEqual([0, 0, 0]);
  });
});

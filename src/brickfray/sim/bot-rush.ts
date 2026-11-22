import { TICK } from './constants';
import { BUTTON, type Command } from './types';

/** A Zipbot's attack run: sprint in weaving, crouch to wind up, lunge for a swing, back off shooting, again. */
export type RushPhase = 'close' | 'windup' | 'lunge' | 'back';

export interface RushState {
  rush: RushPhase;
  /** Seconds left in the current phase (close: until the next weave). */
  rushTime: number;
  strafe: number;
}

/** Closer than this (m) the run stops to wind up its lunge. */
const WIND_AT = 5;
const WINDUP = 0.35;
const LUNGE = 0.7;
/** Seconds of backing off after a lunge, before the next run. */
const BACK = [1, 1.6] as const;

export function startRush(b: RushState) {
  b.rush = 'close';
  b.rushTime = 0;
}

/** Steer one tick of the run at a target `dist` m away (in plan); the swing itself is the brain's melee-in-reach rule. */
export function rush(b: RushState, dist: number, cmd: Command, swung: boolean, random: () => number) {
  b.rushTime -= TICK;
  switch (b.rush) {
    case 'close':
      if (b.rushTime <= 0) {
        b.strafe = -b.strafe;
        b.rushTime = 0.35 + random() * 0.25;
      }
      cmd.forward = 1;
      cmd.right = b.strafe * 0.5;
      cmd.buttons |= BUTTON.sprint;
      if (dist < WIND_AT) {
        b.rush = 'windup';
        b.rushTime = WINDUP;
      }
      break;
    case 'windup':
      cmd.forward = 0;
      cmd.right = 0;
      cmd.buttons |= BUTTON.crouch;
      if (b.rushTime <= 0) {
        b.rush = 'lunge';
        b.rushTime = LUNGE;
      }
      break;
    case 'lunge':
      cmd.forward = 1;
      cmd.right = 0;
      cmd.buttons |= BUTTON.sprint;
      if (swung || b.rushTime <= 0) {
        b.rush = 'back';
        b.rushTime = BACK[0] + random() * (BACK[1] - BACK[0]);
      }
      break;
    case 'back':
      cmd.forward = dist < 9 ? -0.8 : 0;
      cmd.right = b.strafe * 0.85;
      if (b.rushTime <= 0) startRush(b);
      break;
  }
}

import type { AnimState } from './types';

/** A standing, idle animation state; labs and spawn code override what they need. */
export function idleState(over: Partial<AnimState> = {}): AnimState {
  return {
    localVelocity: { x: 0, z: 0 },
    speed: 0,
    grounded: true,
    verticalVelocity: 0,
    crouch: 0,
    sprint: false,
    aimPitch: 0,
    ads: 0,
    weapon: 'ar',
    sinceShot: 99,
    reload: -1,
    melee: -1,
    grenade: -1,
    sinceHurt: 99,
    hurtDirection: { x: 0, z: 1 },
    ...over
  };
}

/** Partial state from a lab script; `speed` is derived from the velocity when missing. */
export function mergeState(base: AnimState, patch: Partial<AnimState>): AnimState {
  const s = { ...base, ...patch };
  if (patch.localVelocity && patch.speed === undefined) s.speed = Math.hypot(s.localVelocity.x, s.localVelocity.z);
  return s;
}

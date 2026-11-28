export const TICK = 1 / 60;
export const SNAPSHOT_HZ = 30;
/** Remote players are drawn this far in the past so there are always two snapshots to blend. */
export const INTERP_DELAY = 0.1;
export const MAX_REWIND = 0.2;

export const PLAYER = {
  halfWidth: 0.3,
  height: 1.8,
  crouchHeight: 1.2,
  eye: 1.62,
  crouchEye: 1.05,
  stepHeight: 0.52,
  health: 100,
  spawnProtection: 1.5,
  respawnDelay: 5
} as const;

/** Seconds to get one thrown grenade back, in every mode; solo upgrades lower a player's own. */
export const GRENADE_REFILL = 9;

/** Health comes back `rate` per second per 100 max health once `delay` seconds pass without damage. */
export const REGEN = { delay: 4.5, rate: 22 } as const;

export const MOVE = {
  walk: 4.6,
  sprint: 7.2,
  crouch: 2.4,
  adsScale: 0.6,
  groundAccel: 70,
  airAccel: 14,
  friction: 11,
  gravity: 22,
  jumpSpeed: 7.2,
  slideSpeed: 9.5,
  slideMinSpeed: 5.6,
  slideTime: 0.65,
  slideFriction: 2.2,
  crouchRate: 7,
  /** Seconds after sprint ends before the gun can fire. */
  sprintRecovery: 0.12
} as const;

export const MATCH = {
  maxPlayers: 12,
  ffaKills: 30,
  tdmKills: 50,
  defaultMinutes: 10,
  reconnectGrace: 30
} as const;

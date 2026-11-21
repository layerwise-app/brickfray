import { GRENADE, MELEES, WEAPON_IDS, WEAPONS, type WeaponId } from '../weapons/defs';
import { LOADOUTS, slotWeapon, type Loadout } from '../weapons/loadouts';
import type { ViewAction } from '../weapons/types';
import { MOVE } from './constants';
import { BUTTON, type ArmsState, type Command, type PlayerState } from './types';

/** Side effects of a command; the host resolves hits, the client draws. Replays pass null. */
export interface ArmsHooks {
  fire(player: PlayerState, weapon: WeaponId, directions: [number, number, number][], seq: number): void;
  melee(player: PlayerState, seq: number): void;
  grenade(player: PlayerState, cook: number, low: boolean, seq: number): void;
  view?(action: ViewAction): void;
  dryFire?(): void;
}

/** Full magazines, holding `weapon` (the loadout's primary unless it is one of its guns). */
export function createArms(loadout: Loadout = LOADOUTS.grunt, weapon?: WeaponId): ArmsState {
  const ammo = {} as Record<WeaponId, number>;
  for (const id of WEAPON_IDS) ammo[id] = WEAPONS[id].mag;
  return {
    weapon: weapon === loadout.primary || weapon === loadout.secondary ? weapon : loadout.primary,
    next: null,
    switchTime: 0,
    ammo,
    cooldown: 0,
    burstLeft: 0,
    reload: 0,
    reloadTotal: 0,
    reloadEmpty: false,
    burst: 0,
    sinceShot: 10,
    sprintRecovery: 0,
    meleeCooldown: 0,
    meleeTime: -1,
    grenades: GRENADE.perLife,
    cook: -1,
    throwTime: 0,
    ads: 0,
    queuedFire: 0,
    prevButtons: 0,
    shots: 0
  };
}

export function copyArms(from: ArmsState, to: ArmsState): ArmsState {
  Object.assign(to, from);
  to.ammo = { ...from.ammo };
  return to;
}

export function aimDirection(yaw: number, pitch: number): [number, number, number] {
  const c = Math.cos(pitch);
  return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

/** Deterministic 0…1 random from integers, so client and host agree on spread. */
export function hashRandom(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** The view racks the pump after an empty shotgun reload; no shot before it is done. */
const RACK = 0.75;

/** Shotgun reloads start with a short load-in before the first shell. */
const LOAD_IN = 0.2;

const SHOTGUN_PATTERN: [number, number][] = [[0, 0], ...Array.from({ length: 7 }, (_, i): [number, number] => {
  const a = (i / 7) * Math.PI * 2 + 0.3;
  return [Math.cos(a), Math.sin(a)];
})];

/** Current cone half-angle including movement, air and first-shot accuracy. */
export function currentSpread(player: PlayerState): number {
  const arms = player.arms;
  const def = WEAPONS[arms.weapon];
  let spread = def.spread + (def.adsSpread - def.spread) * arms.ads;
  if (def.pellets > 1) return spread;
  const speed = Math.hypot(player.move.vx, player.move.vz);
  spread *= 1 + (speed / MOVE.sprint) * (1 - arms.ads * 0.8) * 0.9;
  if (!player.move.grounded) spread *= 1.8;
  if (player.move.crouch > 0.5) spread *= 0.8;
  if (def.mode === 'auto' && arms.sinceShot > 0.32) spread *= 0.2;
  return spread;
}

function pelletDirections(player: PlayerState, seq: number): [number, number, number][] {
  const def = WEAPONS[player.arms.weapon];
  const spread = currentSpread(player);
  const forward = aimDirection(player.yaw, player.pitch);
  const right: [number, number, number] = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
  const up: [number, number, number] = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0]
  ];
  const dirs: [number, number, number][] = [];
  for (let i = 0; i < def.pellets; i++) {
    let ox: number;
    let oy: number;
    if (def.pellets > 1) {
      [ox, oy] = SHOTGUN_PATTERN[i % SHOTGUN_PATTERN.length]!;
    } else {
      const r = Math.sqrt(hashRandom(player.id, seq, i * 2));
      const a = hashRandom(player.id, seq, i * 2 + 1) * Math.PI * 2;
      ox = Math.cos(a) * r;
      oy = Math.sin(a) * r;
    }
    const d: [number, number, number] = [
      forward[0] + (right[0] * ox + up[0] * oy) * spread,
      forward[1] + (right[1] * ox + up[1] * oy) * spread,
      forward[2] + (right[2] * ox + up[2] * oy) * spread
    ];
    const len = Math.hypot(d[0], d[1], d[2]);
    dirs.push([d[0] / len, d[1] / len, d[2] / len]);
  }
  return dirs;
}

function startReload(arms: ArmsState, hooks: ArmsHooks | null) {
  const def = WEAPONS[arms.weapon];
  if (arms.reload > 0 || arms.ammo[arms.weapon] >= def.mag || arms.next) return;
  arms.reloadEmpty = arms.ammo[arms.weapon] === 0;
  if (def.mode === 'pump') {
    arms.reload = LOAD_IN;
    arms.reloadTotal = LOAD_IN;
    hooks?.view?.({ type: 'reload', empty: arms.reloadEmpty, duration: LOAD_IN });
  } else {
    arms.reload = arms.reloadEmpty ? def.reloadEmpty : def.reload;
    arms.reloadTotal = arms.reload;
    hooks?.view?.({ type: 'reload', empty: arms.reloadEmpty, duration: arms.reload });
  }
}

function cancelReload(arms: ArmsState, hooks: ArmsHooks | null) {
  if (arms.reload <= 0) return;
  arms.reload = 0;
  hooks?.view?.({ type: 'cancelReload' });
}

/** Advance one player's weapons by one command. Movement must already have run. */
export function stepArms(player: PlayerState, cmd: Command, dt: number, hooks: ArmsHooks | null) {
  const arms = player.arms;
  const b = cmd.buttons;
  const pressed = b & ~arms.prevButtons;
  const released = arms.prevButtons & ~b;
  arms.prevButtons = b;
  const sprinting = player.move.sprinting;

  arms.cooldown = Math.max(0, arms.cooldown - dt);
  arms.meleeCooldown = Math.max(0, arms.meleeCooldown - dt);
  arms.throwTime = Math.max(0, arms.throwTime - dt);
  arms.sinceShot += dt;
  arms.queuedFire = Math.max(0, arms.queuedFire - dt);
  arms.sprintRecovery = sprinting ? MOVE.sprintRecovery : Math.max(0, arms.sprintRecovery - dt);
  if (arms.sinceShot > 0.45) arms.burst = 0;

  const loadout = LOADOUTS[player.character];
  const melee = MELEES[loadout.melee];

  // Weapon switch: holster, swap, draw.
  const wanted = slotWeapon(loadout, cmd.slot);
  const target = arms.next ?? arms.weapon;
  if (wanted !== target && arms.cook < 0) {
    cancelReload(arms, hooks);
    arms.burstLeft = 0;
    const holster = arms.next ? 0 : WEAPONS[arms.weapon].holsterTime;
    arms.next = wanted;
    arms.switchTime = holster + WEAPONS[wanted].drawTime;
    hooks?.view?.({ type: 'switch', to: wanted, holster, draw: WEAPONS[wanted].drawTime });
  }
  if (arms.switchTime > 0) {
    arms.switchTime = Math.max(0, arms.switchTime - dt);
    if (arms.next && arms.switchTime <= WEAPONS[arms.next].drawTime) {
      arms.weapon = arms.next;
      arms.next = null;
      arms.burst = 0;
    }
  }

  // Melee.
  if (arms.meleeTime >= 0) {
    const before = arms.meleeTime;
    arms.meleeTime += dt;
    if (before < melee.windup && arms.meleeTime >= melee.windup) hooks?.melee(player, cmd.seq);
    if (arms.meleeTime > melee.cooldown * 0.62) arms.meleeTime = -1;
  } else if (pressed & BUTTON.melee && arms.meleeCooldown <= 0 && arms.cook < 0) {
    cancelReload(arms, hooks);
    arms.meleeTime = 0;
    arms.meleeCooldown = melee.cooldown;
    arms.burstLeft = 0;
    hooks?.view?.({ type: 'melee' });
  }

  // Grenade: hold to cook, release (or max cook) to throw.
  if (arms.cook >= 0) {
    arms.cook += dt;
    if (released & BUTTON.grenade || arms.cook >= GRENADE.maxCook) {
      const low = (b & BUTTON.grenadeLow) !== 0 || (released & BUTTON.grenadeLow) !== 0;
      hooks?.grenade(player, arms.cook, low, cmd.seq);
      hooks?.view?.({ type: 'grenadeThrow', low });
      arms.grenades--;
      arms.cook = -1;
      arms.throwTime = 0.45;
    }
  } else if (pressed & BUTTON.grenade && arms.grenades > 0 && arms.meleeTime < 0 && arms.throwTime <= 0) {
    cancelReload(arms, hooks);
    arms.cook = 0;
    hooks?.view?.({ type: 'grenadeCook' });
  }

  const def = WEAPONS[arms.weapon];
  const busy = arms.switchTime > 0 || arms.meleeTime >= 0 || arms.cook >= 0 || arms.throwTime > 0;

  // Reload progress.
  if (arms.reload > 0) {
    arms.reload = Math.max(0, arms.reload - dt);
    if (arms.reload === 0) {
      if (def.mode === 'pump') {
        if (arms.reloadTotal !== LOAD_IN) arms.ammo[arms.weapon] = Math.min(def.mag, arms.ammo[arms.weapon] + 1);
        if (arms.ammo[arms.weapon] < def.mag) {
          arms.reload = def.reload;
          arms.reloadTotal = def.reload;
          hooks?.view?.({ type: 'reloadShell', index: arms.ammo[arms.weapon], duration: def.reload });
        } else {
          hooks?.view?.({ type: 'reloadEnd' });
          arms.cooldown = Math.max(arms.cooldown, arms.reloadEmpty ? RACK : 0.3);
        }
      } else {
        arms.ammo[arms.weapon] = def.mag;
      }
    }
  }
  if (pressed & BUTTON.reload && !busy) startReload(arms, hooks);

  // Aim.
  const canAim = (b & BUTTON.ads) !== 0 && !sprinting && !busy && arms.reload <= 0;
  arms.ads = canAim ? Math.min(1, arms.ads + dt / def.adsTime) : Math.max(0, arms.ads - dt / (def.adsTime * 0.8));

  // Fire.
  const edge = (pressed & BUTTON.fire) !== 0;
  if (edge) arms.queuedFire = 0.18;
  const wantsFire = def.mode === 'auto' ? (b & BUTTON.fire) !== 0 : arms.queuedFire > 0 || arms.burstLeft > 0;
  const shotgunInterrupt = def.mode === 'pump' && arms.reload > 0 && arms.ammo[arms.weapon] > 0;
  if (busy || sprinting || arms.reload > 0) arms.burstLeft = 0;
  if (!wantsFire || busy || sprinting || arms.sprintRecovery > 0 || arms.cooldown > 0) return;
  if (arms.reload > 0 && !shotgunInterrupt) return;
  if (arms.ammo[arms.weapon] <= 0) {
    arms.burstLeft = 0;
    if (edge) {
      hooks?.dryFire?.();
      startReload(arms, hooks);
    }
    arms.queuedFire = 0;
    return;
  }
  if (shotgunInterrupt && arms.reloadEmpty) {
    // Nothing is chambered after an empty reload: the shells loaded so far stay, the pump is racked, then the shot goes.
    arms.reload = 0;
    arms.reloadEmpty = false;
    hooks?.view?.({ type: 'reloadEnd' });
    arms.cooldown = Math.max(arms.cooldown, RACK);
    arms.queuedFire = RACK + 0.1;
    return;
  }
  if (shotgunInterrupt) cancelReload(arms, hooks);
  arms.queuedFire = 0;
  arms.ammo[arms.weapon]--;
  arms.shots++;
  arms.cooldown = Math.max(60 / def.rpm, def.cycle ?? 0);
  if (def.burst) {
    arms.burstLeft = (arms.burstLeft || def.burst.count) - 1;
    if (arms.burstLeft === 0) arms.cooldown = def.burst.pause;
  }
  hooks?.fire(player, arms.weapon, pelletDirections(player, cmd.seq), cmd.seq);
  arms.sinceShot = 0;
  arms.burst++;
  const empty = arms.ammo[arms.weapon] === 0;
  hooks?.view?.({ type: 'fire', empty });
  if ((def.mode === 'pump' || def.mode === 'bolt') && !empty) hooks?.view?.({ type: 'cycle', duration: (def.cycle ?? 0.5) * 0.8 });
  if (empty && def.mode !== 'pump') startReload(arms, hooks);
}

import { GRENADE, WEAPONS, type WeaponId } from '../weapons/defs';
import { ROLL, THROW_REACH, type Band, type BotProfile } from './bot-profile';
import { PLAYER, TICK } from './constants';
import { throwPitchFor } from './grenades';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

/** How a bot moves in a fight: its strafe, and whether stepping aside or back keeps its line on the enemy. */
export interface FightState {
  strafe: number;
  strafeTime: number;
  crouchTime: number;
  /** Seconds to the next look at which ways it can step without losing the line. */
  lineCheck: number;
  sideOk: boolean;
  backOk: boolean;
}

/** A bot's grenade throwing: when it may throw again, the aim of a throw on its way out, and staying clear of its own. */
export interface ThrowState {
  grenadeCooldown: number;
  /** Seconds left to stay clear of a grenade the bot just threw. */
  clearing: number;
  /** Ticks left holding `lobPitch`, the aim of a throw on its way out of the hand. */
  lob: number;
  lobPitch: number;
}

/** After losing sight this long (s) a bot goes hunting; until then it keeps its aim where the enemy was and looks for it. */
export const GRACE = 1.2;
/** Seconds a bot stays put on losing sight, ready for the enemy to come back round the corner. */
const HOLD = 0.4;
/** How far (m) a step aside or back is checked for keeping the line. */
const STEP = 1.2;
/** A long gun's bot goes back to it once the enemy is this much (m) past where it took out its sidearm. */
const SIDEARM_SLACK = 6;
/** How much higher (m, at scale 1) the head is than the chest a bot aims at. */
export const HEAD_ABOVE_CHEST = 0.35;

/**
 * The slot to fight with at `dist`: the sidearm where the primary is poor. A close-range kit keeps it to the end of the
 * fight (swapping back costs more than it wins); a long gun goes back once the enemy is well out.
 */
export function kitSlot(side: NonNullable<BotProfile['sidearm']>, slot: number, dist: number) {
  if (slot === 0) return (side.near !== undefined && dist < side.near) || (side.far !== undefined && dist > side.far) ? 1 : 0;
  return side.near !== undefined && dist > side.near + SIDEARM_SLACK ? 0 : 1;
}

/**
 * Whether the aim is good enough to fire: a scoped gun with its sights up and the head under the crosshair, a heavy
 * one-round gun with the body under it, anything else once roughly on.
 */
export function onTarget(gun: BotProfile, ads: number, offAim: number, dist: number, scale: number) {
  if (gun.patient) return ads > 0.9 && offAim < Math.atan2(0.45 * scale, dist) + 0.015;
  if (gun.steady) return offAim < Math.atan2(0.4 * scale, dist) + 0.01;
  return offAim < 0.12 + (1.5 / Math.max(4, dist)) * 0.1;
}

/** Aim down the sights: a scoped gun always (a snapbot's only beyond 12 m), others beyond their profile's `sights`. */
export function wantsSights(gun: BotProfile, weapon: WeaponId, dist: number) {
  return gun.patient || (gun.sights !== undefined && dist > gun.sights) || (WEAPONS[weapon].zoom > 2 && dist > 12);
}

/**
 * In sight: close in beyond the band; back off inside it while backing keeps the line, else stand and fight; strafe
 * only to a side that keeps the line, and crouch only where the line stays clear over the cover.
 */
export function fightMove(host: HostSim, bot: PlayerState, b: FightState, yaw: number, aim: readonly number[], dist: number, band: Band, random: () => number, cmd: Command) {
  const eye = host.eye(bot);
  const keeps = (dx: number, dz: number, dy = 0) => host.world.clearLine(eye[0] + dx * STEP, eye[1] + dy, eye[2] + dz * STEP, aim[0]!, aim[1]!, aim[2]!);
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  b.strafeTime -= TICK;
  b.lineCheck -= TICK;
  if (b.strafeTime <= 0) {
    b.strafe = random() < 0.5 ? -1 : 1;
    b.strafeTime = 0.5 + random() * 1.1;
    if (random() < 0.15 && keeps(0, 0, -(PLAYER.eye - PLAYER.crouchEye) * bot.scale)) b.crouchTime = 0.8;
    b.lineCheck = 0;
  }
  if (b.lineCheck <= 0) {
    b.lineCheck = 0.2;
    // Right of the aim is (cos, -sin); behind it is (sin, cos).
    b.sideOk = keeps(c * b.strafe, -s * b.strafe);
    if (!b.sideOk && keeps(-c * b.strafe, s * b.strafe)) {
      b.strafe = -b.strafe;
      b.sideOk = true;
    }
    b.backOk = keeps(s, c);
  }
  cmd.right = b.sideOk ? b.strafe * (bot.bot === 'sniper' ? 0.3 : 0.85) : 0;
  cmd.forward = dist > band.max ? 1 : dist < band.min && b.backOk ? -0.7 : 0;
}

/**
 * Just lost sight, aim kept where the enemy was: hold a moment, then walk up from beyond the band (or straight in with a
 * close-range gun); inside the band it waits for the enemy to show again.
 */
export function lostMove(lostFor: number, dist: number, band: Band, cmd: Command) {
  if (lostFor >= HOLD && (dist > band.max || band.min === 0)) cmd.forward = 0.7;
}

/** Now and then a Snapbot or Megabot (and every fill bot) lobs a grenade, aimed to come down short and roll the rest. */
export function throwAt(bot: PlayerState, b: ThrowState, target: PlayerState, eye: readonly number[], dist: number, skill: number, random: () => number, cmd: Command) {
  b.grenadeCooldown -= TICK;
  if ((bot.bot !== 'boss' && bot.bot !== 'grunt') || b.grenadeCooldown > 0 || dist <= GRENADE.radius + 4 || dist >= THROW_REACH || bot.arms.grenades <= 0 || random() >= 0.01) return;
  const pitch = throwPitchFor(dist - ROLL, target.move.y - eye[1]!);
  if (pitch === null) return;
  b.grenadeCooldown = 9;
  b.clearing = GRENADE.fuse + 0.6;
  b.lob = 3;
  // The error shrinks with skill.
  b.lobPitch = pitch + (random() - 0.5) * (1 - skill) * 0.12;
  cmd.buttons |= BUTTON.grenade;
}

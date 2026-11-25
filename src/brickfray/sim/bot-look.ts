import type { BeliefState } from './bot-belief';
import type { BotProfile } from './bot-profile';
import type { BotRoam, RoamState, Spot } from './bot-roam';
import { wrap } from './bot-sense';
import { TICK } from './constants';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

/** Where a bot points its eyes and gun between ticks, and when it last checked an angle on the way. */
export interface LookState {
  aimYaw: number;
  aimPitch: number;
  /** Host time of its last corner check (see `look`). */
  checked: number;
}

/** Turn rate (rad/s) of a bot's look out of a fight: toward the way it walks, a sound, a spot it expects someone. */
const LOOK_TURN = 5;
/** Corner checks: a glance down a waypoint's longest view that is this far (rad) off the way it walks, for `hold` s, at most every `every` s. */
const CHECK = { off: 0.6, hold: 0.6, every: 2.5 };

/** Turn the aim toward `at` (with the bot's aim error) at its turn rate; the distance in plan and how far off it still is. */
export function turnTo(b: LookState & { errYaw: number; errPitch: number }, eye: readonly number[], at: readonly number[], prof: BotProfile, skill: number) {
  const dx = at[0]! - eye[0]!;
  const dy = at[1]! - eye[1]!;
  const dz = at[2]! - eye[2]!;
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(-dx, -dz) + b.errYaw;
  const wantPitch = Math.atan2(dy, dist) + b.errPitch;
  const turn = prof.turn * (0.6 + skill * 0.8) * TICK;
  b.aimYaw += clamp(wrap(wantYaw - b.aimYaw), -turn, turn);
  b.aimPitch += clamp(wantPitch - b.aimPitch, -turn, turn);
  return { dist, offAim: Math.abs(wrap(wantYaw - b.errYaw - b.aimYaw)) + Math.abs(wantPitch - b.errPitch - b.aimPitch) };
}

type Looker = LookState & BeliefState & Pick<RoamState, 'approach' | 'path'> & { strafe: number; sidestep: number; lostFor: number; reached: number };

/**
 * Walk the route `steer` gives: strafing in a fight; out of one it looks where it walks, unless it is glancing at
 * something heard or felt, or has its eyes on the spot where it expects an enemy (`watch`), and it checks the long
 * views it passes. A match bot with nobody believed near runs, as a player would; solo waves keep their walking pace.
 */
export function look(host: HostSim, roam: BotRoam, bot: PlayerState, b: Looker, steer: [number, number] | null, visible: boolean, lost: boolean, watch: Spot | null, cmd: Command) {
  const now = host.time;
  if (b.glance && now >= b.glance.until) b.glance = null;
  const glance = b.glance && now >= b.glance.from ? b.glance.yaw : null;
  if (!visible && !lost && b.reached >= 0 && glance === null && !watch && now - b.checked > CHECK.every && steer) {
    const view = roam.longestView(b.reached);
    if (view !== null && Math.abs(wrap(view - Math.atan2(-steer[0], -steer[1]))) > CHECK.off) {
      b.glance = { yaw: view, from: now, until: now + CHECK.hold };
      b.checked = now;
    }
  }
  b.reached = -1;
  const yawTo = (at: Spot) => Math.atan2(-(at[0] - bot.move.x), -(at[2] - bot.move.z));
  if (steer && !(visible && cmd.forward <= 0)) {
    const moveYaw = Math.atan2(-steer[0], -steer[1]);
    if (visible) {
      const rel = wrap(moveYaw - b.aimYaw);
      cmd.forward = clamp(cmd.forward + Math.cos(rel) * 0.7, -1, 1);
      cmd.right = clamp(cmd.right - Math.sin(rel) * 0.7, -1, 1);
      return;
    }
    const eyes = glance ?? (watch ? yawTo(watch) : moveYaw);
    b.aimYaw += clamp(wrap(eyes - b.aimYaw), -LOOK_TURN * TICK, LOOK_TURN * TICK);
    b.aimPitch *= 0.9;
    // It walks the route while it turns to it: walking the way it still faces can step off the quay it was aiming across.
    const ahead = wrap(moveYaw - b.aimYaw);
    cmd.forward = b.sidestep > 0 ? -0.4 : Math.cos(ahead);
    cmd.right = b.sidestep > 0 ? b.strafe : -Math.sin(ahead);
    const hurry = host.settings.mode !== 'solo' && b.lostFor > 2 && b.path.length > 2 && b.sidestep <= 0 && !(cmd.buttons & BUTTON.crouch) && !watch && glance === null;
    if (bot.bot === 'rusher' || hurry) cmd.buttons |= BUTTON.sprint;
  } else if (!visible && !lost) {
    // Arrived where the enemy should be in sight: face it, or it stays out of the bot's view cone behind it.
    const eyes = glance ?? (watch ? yawTo(watch) : b.approach ? yawTo(b.approach.for) : null);
    if (eyes !== null) b.aimYaw += clamp(wrap(eyes - b.aimYaw), -LOOK_TURN * TICK, LOOK_TURN * TICK);
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

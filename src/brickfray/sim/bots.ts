import { GRENADE, WEAPONS } from '../weapons/defs';
import { BotNav, nearestWaypoint, type NavState } from './bot-nav';
import { BOSS_VOLLEY, botProfile, ROLL, THROW_REACH } from './bot-profile';
import { BotRoam, HEADWAY, type RoamState, type Spot } from './bot-roam';
import { rush, startRush, type RushState } from './bot-rush';
import { throwPitchFor } from './grenades';
import { PLAYER, TICK } from './constants';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

export { findPath } from './bot-nav';

interface Brain extends NavState, RoamState, RushState {
  seq: number;
  target: number;
  seenFor: number;
  lostFor: number;
  /** Where the bot last made headway out of a fight, and the host time it did. */
  anchor: Spot;
  anchorAt: number;
  think: number;
  strafeTime: number;
  aimYaw: number;
  aimPitch: number;
  errYaw: number;
  errPitch: number;
  stuck: number;
  lastPos: [number, number];
  crouchTime: number;
  /** Seconds left of stepping aside round whatever the bot walked into (a post, a crate corner). */
  sidestep: number;
  grenadeCooldown: number;
  /** Seconds left to stay clear of a grenade the bot just threw. */
  clearing: number;
  /** Ticks left holding `lobPitch`, the aim of a throw on its way out of the hand. */
  lob: number;
  lobPitch: number;
  fireHeld: boolean;
  slot: number;
  /** A fixed skill instead of the director's (a scripted stand-in for a player in tests). */
  skill: number | null;
}

/** Out of a fight, a bot that has not got `HEADWAY` from where it stood for this many seconds goes on patrol. */
const IDLE = 2;
/** Snapbot and fill-bot brains: perceive, navigate the waypoint graph, aim with human-like lag, shoot. */
export class BotDirector {
  private brains = new Map<number, Brain>();
  /** 0 = easy … 1 = sharp; solo raises it each wave. */
  skill = 0.4;
  /** Seconds the aim trails a moving target (solo: early waves miss a strafing player); 0 aims where it is. */
  lag = 0;
  private readonly nav: BotNav;
  private readonly roam: BotRoam;
  /** Bot choices are drawn from the match's seed, so a seeded match plays out the same every time. */
  private seed: number;

  constructor(private readonly host: HostSim) {
    this.nav = new BotNav(host);
    this.roam = new BotRoam(host, () => this.random());
    this.seed = Math.floor(host.random() * 4294967296);
  }

  add(player: PlayerState, skill: number | null = null) {
    this.brains.set(player.id, {
      skill,
      seq: 0,
      target: 0,
      seenFor: 0,
      lostFor: 99,
      lastSeen: null,
      patrol: null,
      patrolUntil: 0,
      approach: null,
      anchor: [player.move.x, player.move.y, player.move.z],
      anchorAt: this.host.time,
      path: [],
      repath: 0,
      think: this.random() * 0.2,
      strafe: 1,
      strafeTime: 0,
      aimYaw: player.yaw,
      aimPitch: 0,
      errYaw: 0,
      errPitch: 0,
      stuck: 0,
      lastPos: [player.move.x, player.move.z],
      crouchTime: 0,
      sidestep: 0,
      grenadeCooldown: 6,
      clearing: 0,
      lob: 0,
      lobPitch: 0,
      rush: 'close',
      rushTime: 0,
      avoid: new Map(),
      heading: new Map(),
      blocked: new Map(),
      graphOnly: 0,
      fireHeld: false,
      slot: 0
    });
  }

  remove(id: number) {
    this.brains.delete(id);
  }

  tick() {
    for (const [id, brain] of this.brains) {
      const bot = this.host.players.get(id);
      if (!bot) {
        this.brains.delete(id);
        continue;
      }
      const cmd = this.decide(bot, brain);
      this.host.applyCommand(id, cmd);
    }
  }

  private decide(bot: PlayerState, b: Brain): Command {
    const host = this.host;
    const prof = botProfile(bot);
    b.seq++;
    const cmd: Command = { seq: b.seq, forward: 0, right: 0, yaw: b.aimYaw, pitch: b.aimPitch, buttons: 0, slot: b.slot, viewTime: host.time, life: bot.life };
    const m = bot.move;
    if (!bot.alive) {
      // It comes back somewhere else with nothing in sight: what it was after died with it.
      b.path = [];
      b.target = 0;
      b.seenFor = 0;
      b.lostFor = 99;
      b.lastSeen = null;
      b.patrol = null;
      b.anchor = [m.x, m.y, m.z];
      b.anchorAt = host.time;
      return cmd;
    }
    const eye = host.eye(bot);
    b.think -= TICK;
    if (b.think <= 0) {
      b.think = 0.15 + this.random() * 0.1;
      this.perceive(bot, b, eye, prof.range);
    }
    const target = b.target ? host.players.get(b.target) : undefined;
    const visible = !!target && target.alive && b.lostFor === 0;
    if (visible || Math.hypot(m.x - b.anchor[0], m.y - b.anchor[1], m.z - b.anchor[2]) > HEADWAY) {
      b.anchor = [m.x, m.y, m.z];
      b.anchorAt = host.time;
    } else if (host.time - b.anchorAt > IDLE) {
      // Whatever it was walking to can't be reached or held nobody: go somewhere else.
      this.roam.patrol(bot, b);
      b.anchorAt = host.time;
    }

    let goal: [number, number, number] | null = null;
    if (visible && target) {
      b.seenFor += TICK;
      // A Scopebot lines up one deliberate shot: its aim trails a moving target half as far.
      const aim = this.aimPoint(target, this.lag * (bot.bot === 'sniper' ? 0.5 : 1));
      const dx = aim[0] - eye[0];
      const dy = aim[1] - eye[1];
      const dz = aim[2] - eye[2];
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz) + b.errYaw;
      const wantPitch = Math.atan2(dy, dist) + b.errPitch;
      const skill = b.skill ?? this.skill;
      const turn = prof.turn * (0.6 + skill * 0.8) * TICK;
      b.aimYaw += clamp(wrap(wantYaw - b.aimYaw), -turn, turn);
      b.aimPitch += clamp(wantPitch - b.aimPitch, -turn, turn);
      b.errYaw *= 0.985 - skill * 0.02;
      b.errPitch *= 0.985 - skill * 0.02;
      const offAim = Math.abs(wrap(wantYaw - b.errYaw - b.aimYaw)) + Math.abs(wantPitch - b.errPitch - b.aimPitch);
      const ready = b.seenFor > prof.reaction * (1.3 - skill * 0.6);
      const def = WEAPONS[bot.arms.weapon];
      const volley = bot.bot !== 'boss' || bot.arms.sinceShot > BOSS_VOLLEY;
      if (ready && volley && offAim < 0.12 + 1.5 / Math.max(4, dist) * 0.1 && bot.arms.ammo[bot.arms.weapon] > 0) {
        if (def.mode === 'auto') cmd.buttons |= BUTTON.fire;
        else if (!b.fireHeld) cmd.buttons |= BUTTON.fire;
      }
      b.fireHeld = (cmd.buttons & BUTTON.fire) !== 0;
      if (def.zoom > 2 && dist > 12) cmd.buttons |= BUTTON.ads;
      const swing = dist < 1.9 && bot.arms.meleeCooldown <= 0;
      if (swing) cmd.buttons |= BUTTON.melee;
      if (bot.bot === 'rusher') rush(b, dist, cmd, swing, () => this.random());
      else {
        // Keep a preferred distance and strafe.
        b.strafeTime -= TICK;
        if (b.strafeTime <= 0) {
          b.strafe = this.random() < 0.5 ? -1 : 1;
          b.strafeTime = 0.5 + this.random() * 1.1;
          if (this.random() < 0.15) b.crouchTime = 0.8;
        }
        cmd.right = b.strafe * (bot.bot === 'sniper' ? 0.3 : 0.85);
        cmd.forward = dist > prof.keep + 3 ? 1 : dist < prof.keep - 3 ? -0.7 : 0;
      }
      b.grenadeCooldown -= TICK;
      if ((bot.bot === 'boss' || bot.bot === 'grunt') && b.grenadeCooldown <= 0 && dist > GRENADE.radius + 4 && dist < THROW_REACH && bot.arms.grenades > 0 && this.random() < 0.01) {
        // Aimed to come down short of the target and roll the rest, with an error that shrinks with skill.
        const pitch = throwPitchFor(dist - ROLL, target.move.y - eye[1]);
        if (pitch !== null) {
          b.grenadeCooldown = 9;
          b.clearing = GRENADE.fuse + 0.6;
          b.lob = 3;
          b.lobPitch = pitch + (this.random() - 0.5) * (1 - skill) * 0.12;
          cmd.buttons |= BUTTON.grenade;
        }
      }
      // A bot that walks on after its own grenade (or has it bounce back off cover) blows itself up.
      if (b.clearing > 0 && dist < GRENADE.radius * 2 + 4) cmd.forward = -1;
      if (cmd.forward > 0) goal = [target.move.x, target.move.y, target.move.z];
    } else {
      b.seenFor = 0;
      b.fireHeld = false;
      startRush(b);
      if (bot.arms.ammo[bot.arms.weapon] < WEAPONS[bot.arms.weapon].mag * 0.5) cmd.buttons |= BUTTON.reload;
      goal = this.roam.goal(bot, b, () => {
        const enemy = this.nearestEnemy(bot);
        return enemy && this.roam.approach(bot, b, enemy, prof.range);
      });
    }
    b.clearing = Math.max(0, b.clearing - TICK);
    if (bot.arms.ammo[bot.arms.weapon] === 0) cmd.buttons |= BUTTON.reload;
    if (b.crouchTime > 0) {
      b.crouchTime -= TICK;
      cmd.buttons |= BUTTON.crouch;
    }

    // Walk the waypoint graph toward the goal.
    const steer = this.nav.navigate(bot, b, goal);
    if (steer && !(visible && cmd.forward <= 0)) {
      const moveYaw = Math.atan2(-steer[0], -steer[1]);
      const rel = wrap(moveYaw - b.aimYaw);
      const fwd = Math.cos(rel);
      const right = -Math.sin(rel);
      if (visible) {
        cmd.forward = clamp(cmd.forward + fwd * 0.7, -1, 1);
        cmd.right = clamp(cmd.right + right * 0.7, -1, 1);
      } else {
        b.aimYaw += clamp(wrap(moveYaw - b.aimYaw), -5 * TICK, 5 * TICK);
        b.aimPitch *= 0.9;
        cmd.forward = b.sidestep > 0 ? -0.4 : 1;
        cmd.right = b.sidestep > 0 ? b.strafe : 0;
        // With nobody known nearby a match bot runs to the fight, as a player would; solo waves keep their walking pace.
        const hurry = host.settings.mode !== 'solo' && b.lostFor > 2 && b.path.length > 2 && b.sidestep <= 0 && !(cmd.buttons & BUTTON.crouch);
        if (bot.bot === 'rusher' || hurry) cmd.buttons |= BUTTON.sprint;
      }
    } else if (!visible && b.approach) {
      // Arrived where the enemy should be in sight: face it, or it stays out of the bot's view cone behind it.
      const [ex, , ez] = b.approach.for;
      b.aimYaw += clamp(wrap(Math.atan2(-(ex - m.x), -(ez - m.z)) - b.aimYaw), -5 * TICK, 5 * TICK);
    }
    b.sidestep = Math.max(0, b.sidestep - TICK);
    // Unstick: duck under a low beam, else jump, when not making progress.
    const moved = Math.hypot(bot.move.x - b.lastPos[0], bot.move.z - b.lastPos[1]);
    b.lastPos = [bot.move.x, bot.move.z];
    b.stuck = Math.abs(cmd.forward) + Math.abs(cmd.right) > 0.3 && moved < 0.01 ? b.stuck + TICK : 0;
    if (b.stuck > 0.25) {
      if (this.nav.ducks(bot, b.aimYaw, cmd.forward, cmd.right)) {
        b.crouchTime = 1.5;
        cmd.buttons |= BUTTON.crouch;
      } else cmd.buttons |= BUTTON.jump;
      if (b.stuck > 1.2) {
        const wps = host.layout.waypoints;
        if (b.path.length && wps.length) {
          const here = nearestWaypoint(wps, bot.move.x, bot.move.y, bot.move.z);
          const next = b.path[0] === here && b.path.length > 1 ? b.path[1]! : b.path[0]!;
          b.avoid.set(`${here}>${next}`, host.time + 12);
          // Nearest but not stood on: it may be the far side of the very thing the bot is pressed against.
          const w = wps[here]!.position;
          if (Math.hypot(w[0] - bot.move.x, w[2] - bot.move.z) > 0.9) b.blocked.set(here, host.time + 12);
        }
        b.graphOnly = host.time + 3;
        b.path = [];
        b.strafe *= -1;
        b.sidestep = 0.6;
        b.stuck = 0;
      }
    }
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.lob > 0 ? b.lobPitch : clamp(b.aimPitch, -1.2, 1.2);
    b.lob = Math.max(0, b.lob - 1);
    this.nav.keepOnGround(bot, b, cmd);
    return cmd;
  }

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Chest height of `target` as it stood `lag` seconds ago. */
  private aimPoint(target: PlayerState, lag = 0): [number, number, number] {
    const at = lag > 0 ? this.host.poseAt(target, this.host.time - lag) : null;
    const m = at ?? target.move;
    const head = m.y + (PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * m.crouch) * target.scale;
    return [m.x, head - 0.35 * target.scale, m.z];
  }

  private perceive(bot: PlayerState, b: Brain, eye: [number, number, number], range: number) {
    const host = this.host;
    let best: PlayerState | null = null;
    let bestScore = Infinity;
    for (const p of host.players.values()) {
      if (!p.alive || !host.hostile(bot, p)) continue;
      const aim = this.aimPoint(p);
      const d = Math.hypot(aim[0] - eye[0], aim[2] - eye[2]);
      if (d > range) continue;
      // A narrower awareness cone behind the bot unless the target is close or shooting.
      const facing = Math.cos(wrap(Math.atan2(-(aim[0] - eye[0]), -(aim[2] - eye[2])) - bot.yaw));
      if (facing < -0.2 && d > 6 && p.arms.sinceShot > 0.5) continue;
      if (!host.world.clearLine(eye[0], eye[1], eye[2], aim[0], aim[1], aim[2])) continue;
      const score = d - (p.id === b.target ? 6 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      if (best.id !== b.target) {
        b.target = best.id;
        b.seenFor = 0;
        const miss = (1 - (b.skill ?? this.skill)) * 0.25 + 0.03;
        b.errYaw = (this.random() - 0.5) * miss * 2;
        b.errPitch = (this.random() - 0.5) * miss;
      }
      b.lostFor = 0;
      b.lastSeen = [best.move.x, best.move.y, best.move.z];
      this.roam.saw(b.lastSeen);
    } else if (b.target) {
      b.lostFor += 0.2;
      if (b.lostFor > 4) {
        b.target = 0;
        b.lastSeen = null;
      }
    }
  }

  private nearestEnemy(bot: PlayerState): Spot | null {
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const p of this.host.players.values()) {
      if (!p.alive || !this.host.hostile(bot, p)) continue;
      const d = Math.hypot(p.move.x - bot.move.x, p.move.z - bot.move.z);
      if (d < bestD) {
        bestD = d;
        best = [p.move.x, p.move.y, p.move.z];
      }
    }
    return best;
  }
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

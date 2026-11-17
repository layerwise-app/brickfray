import { WEAPON_IDS, WEAPONS, type WeaponId } from '../weapons/defs';
import type { Waypoint } from '../world/types';
import { PLAYER, TICK } from './constants';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

interface Brain {
  seq: number;
  target: number;
  seenFor: number;
  lostFor: number;
  lastSeen: [number, number, number] | null;
  path: number[];
  goal: number;
  repath: number;
  think: number;
  strafe: number;
  strafeTime: number;
  aimYaw: number;
  aimPitch: number;
  errYaw: number;
  errPitch: number;
  stuck: number;
  lastPos: [number, number];
  crouchTime: number;
  grenadeCooldown: number;
  fireHeld: boolean;
  slot: number;
  /** Waypoint links this bot got stuck on ("a>b" → host time until which it routes around them). */
  avoid: Map<string, number>;
  /** Host time until which the bot follows the graph instead of walking straight at its goal. */
  graphOnly: number;
}

const PROFILE = {
  grunt: { weapon: 'ar' as WeaponId, reaction: 0.42, turn: 4.2, error: 0.08, range: 34, keep: 14 },
  rusher: { weapon: 'pistol' as WeaponId, reaction: 0.3, turn: 6.5, error: 0.1, range: 24, keep: 2 },
  sniper: { weapon: 'sniper' as WeaponId, reaction: 0.65, turn: 2.6, error: 0.035, range: 70, keep: 30 },
  boss: { weapon: 'shotgun' as WeaponId, reaction: 0.35, turn: 3.2, error: 0.06, range: 22, keep: 6 }
};

/** Snapbot and fill-bot brains: perceive, navigate the waypoint graph, aim with human-like lag, shoot. */
export class BotDirector {
  private brains = new Map<number, Brain>();
  /** 0 = easy … 1 = sharp; solo raises it each wave. */
  skill = 0.4;

  constructor(private readonly host: HostSim) {}

  add(player: PlayerState) {
    const p = PROFILE[player.bot ?? 'grunt'];
    const weapon = player.bot === 'grunt' && player.character !== 'grunt' ? WEAPON_IDS[player.id % 4]! : p.weapon;
    this.brains.set(player.id, {
      seq: 0,
      target: 0,
      seenFor: 0,
      lostFor: 99,
      lastSeen: null,
      path: [],
      goal: -1,
      repath: 0,
      think: Math.random() * 0.2,
      strafe: 1,
      strafeTime: 0,
      aimYaw: player.yaw,
      aimPitch: 0,
      errYaw: 0,
      errPitch: 0,
      stuck: 0,
      lastPos: [player.move.x, player.move.z],
      crouchTime: 0,
      grenadeCooldown: 6,
      avoid: new Map(),
      graphOnly: 0,
      fireHeld: false,
      slot: WEAPON_IDS.indexOf(weapon)
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
    const prof = PROFILE[bot.bot ?? 'grunt'];
    b.seq++;
    const cmd: Command = { seq: b.seq, forward: 0, right: 0, yaw: b.aimYaw, pitch: b.aimPitch, buttons: 0, slot: b.slot, viewTime: host.time, life: bot.life };
    if (!bot.alive) {
      b.path = [];
      b.target = 0;
      return cmd;
    }
    const eye = host.eye(bot);
    b.think -= TICK;
    if (b.think <= 0) {
      b.think = 0.15 + Math.random() * 0.1;
      this.perceive(bot, b, eye, prof.range);
    }
    const target = b.target ? host.players.get(b.target) : undefined;
    const visible = !!target && target.alive && b.lostFor === 0;

    let goal: [number, number, number] | null = null;
    if (visible && target) {
      b.seenFor += TICK;
      const aim = this.aimPoint(target);
      const dx = aim[0] - eye[0];
      const dy = aim[1] - eye[1];
      const dz = aim[2] - eye[2];
      const dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz) + b.errYaw;
      const wantPitch = Math.atan2(dy, dist) + b.errPitch;
      const turn = prof.turn * (0.6 + this.skill * 0.8) * TICK;
      b.aimYaw += clamp(wrap(wantYaw - b.aimYaw), -turn, turn);
      b.aimPitch += clamp(wantPitch - b.aimPitch, -turn, turn);
      b.errYaw *= 0.985 - this.skill * 0.02;
      b.errPitch *= 0.985 - this.skill * 0.02;
      const offAim = Math.abs(wrap(wantYaw - b.errYaw - b.aimYaw)) + Math.abs(wantPitch - b.errPitch - b.aimPitch);
      const ready = b.seenFor > prof.reaction * (1.3 - this.skill * 0.6);
      const def = WEAPONS[bot.arms.weapon];
      if (ready && offAim < 0.12 + 1.5 / Math.max(4, dist) * 0.1 && bot.arms.ammo[bot.arms.weapon] > 0) {
        if (def.mode === 'auto') cmd.buttons |= BUTTON.fire;
        else if (!b.fireHeld) cmd.buttons |= BUTTON.fire;
      }
      b.fireHeld = (cmd.buttons & BUTTON.fire) !== 0;
      if (bot.bot === 'sniper' && dist > 12) cmd.buttons |= BUTTON.ads;
      if (dist < 1.9 && bot.arms.meleeCooldown <= 0) cmd.buttons |= BUTTON.melee;
      // Keep a preferred distance and strafe.
      b.strafeTime -= TICK;
      if (b.strafeTime <= 0) {
        b.strafe = Math.random() < 0.5 ? -1 : 1;
        b.strafeTime = 0.5 + Math.random() * 1.1;
        if (bot.bot !== 'rusher' && Math.random() < 0.15) b.crouchTime = 0.8;
      }
      cmd.right = b.strafe * (bot.bot === 'sniper' ? 0.3 : 0.85);
      cmd.forward = dist > prof.keep + 3 ? 1 : dist < prof.keep - 3 ? -0.7 : 0;
      if (cmd.forward > 0) goal = [target.move.x, target.move.y, target.move.z];
      b.grenadeCooldown -= TICK;
      if ((bot.bot === 'boss' || bot.bot === 'grunt') && b.grenadeCooldown <= 0 && dist > 8 && dist < 22 && bot.arms.grenades > 0 && Math.random() < 0.01) {
        b.grenadeCooldown = 9;
        cmd.buttons |= BUTTON.grenade;
      }
    } else {
      b.seenFor = 0;
      b.fireHeld = false;
      if (bot.arms.ammo[bot.arms.weapon] < WEAPONS[bot.arms.weapon].mag * 0.5) cmd.buttons |= BUTTON.reload;
      goal = b.lastSeen ?? this.nearestEnemy(bot);
    }
    if (bot.arms.ammo[bot.arms.weapon] === 0) cmd.buttons |= BUTTON.reload;
    if (b.crouchTime > 0) {
      b.crouchTime -= TICK;
      cmd.buttons |= BUTTON.crouch;
    }

    // Walk the waypoint graph toward the goal.
    const steer = this.navigate(bot, b, goal);
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
        cmd.forward = 1;
        cmd.right = 0;
        if (bot.bot === 'rusher') cmd.buttons |= BUTTON.sprint;
      }
    }
    // Unstick: jump when not making progress.
    const moved = Math.hypot(bot.move.x - b.lastPos[0], bot.move.z - b.lastPos[1]);
    b.lastPos = [bot.move.x, bot.move.z];
    b.stuck = Math.abs(cmd.forward) + Math.abs(cmd.right) > 0.3 && moved < 0.01 ? b.stuck + TICK : 0;
    if (b.stuck > 0.25) {
      cmd.buttons |= BUTTON.jump;
      if (b.stuck > 1.2) {
        const wps = host.layout.waypoints;
        if (b.path.length && wps.length) {
          const here = nearestWaypoint(wps, bot.move.x, bot.move.y, bot.move.z);
          const next = b.path[0] === here && b.path.length > 1 ? b.path[1]! : b.path[0]!;
          b.avoid.set(`${here}>${next}`, host.time + 12);
        }
        b.graphOnly = host.time + 3;
        b.path = [];
        b.strafe *= -1;
        b.stuck = 0;
      }
    }
    cmd.yaw = b.aimYaw;
    cmd.pitch = clamp(b.aimPitch, -1.2, 1.2);
    if (this.deadlyAhead(bot, cmd)) {
      cmd.forward = 0;
      cmd.right = 0;
      b.strafe *= -1;
      b.path = [];
    }
    return cmd;
  }

  /** Strafing and corner-cutting would walk bots off bridges and piers into the kill zone. */
  private deadlyAhead(bot: PlayerState, cmd: Command) {
    if (!cmd.forward && !cmd.right) return false;
    const s = Math.sin(cmd.yaw);
    const c = Math.cos(cmd.yaw);
    let dx = -s * cmd.forward + c * cmd.right;
    let dz = -c * cmd.forward - s * cmd.right;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const m = bot.move;
    const top = m.y + 0.6;
    const floor = this.host.world.raycast(m.x + dx * 0.8, top, m.z + dz * 0.8, 0, -1, 0, 6, false);
    return !floor || top - floor.t < this.host.layout.killY + 0.4;
  }

  private aimPoint(target: PlayerState): [number, number, number] {
    const head = target.move.y + (PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * target.move.crouch) * target.scale;
    return [target.move.x, head - 0.35 * target.scale, target.move.z];
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
        const miss = (1 - this.skill) * 0.25 + 0.03;
        b.errYaw = (Math.random() - 0.5) * miss * 2;
        b.errPitch = (Math.random() - 0.5) * miss;
      }
      b.lostFor = 0;
      b.lastSeen = [best.move.x, best.move.y, best.move.z];
    } else if (b.target) {
      b.lostFor += 0.2;
      if (b.lostFor > 4) {
        b.target = 0;
        b.lastSeen = null;
      }
    }
  }

  private nearestEnemy(bot: PlayerState): [number, number, number] | null {
    let best: [number, number, number] | null = null;
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

  /** Direction (x, z) to walk, following waypoints when the goal isn't straight ahead. */
  private navigate(bot: PlayerState, b: Brain, goal: readonly [number, number, number] | null): [number, number] | null {
    if (!goal) return null;
    const [gx, gy, gz] = goal;
    const wps = this.host.layout.waypoints;
    const m = bot.move;
    const direct = Math.hypot(gx - m.x, gz - m.z);
    // A goal on another floor (a balcony overhead) needs the graph even when it's close in plan.
    const sameLevel = Math.abs(gy - m.y) < 1.2;
    if (direct < 1 && sameLevel) return null;
    if (wps.length === 0 || (sameLevel && direct < 10 && this.host.time > b.graphOnly && this.host.world.clearLine(m.x, m.y + 0.6, m.z, gx, m.y + 0.6, gz))) {
      return direct < 1e-3 ? null : [(gx - m.x) / direct, (gz - m.z) / direct];
    }
    b.repath -= TICK;
    if (b.path.length === 0 || b.repath <= 0) {
      b.repath = 1.5;
      const now = this.host.time;
      b.path = findPath(wps, nearestWaypoint(wps, m.x, m.y, m.z), nearestWaypoint(wps, gx, gy, gz), (from, to) => (b.avoid.get(`${from}>${to}`) ?? 0) > now);
    }
    while (b.path.length) {
      const w = wps[b.path[0]!]!.position;
      const d = Math.hypot(w[0] - m.x, w[2] - m.z);
      if (d < 0.9 && Math.abs(w[1] - m.y) < 1.2) {
        b.path.shift();
        continue;
      }
      if (d < 1e-3) break;
      return [(w[0] - m.x) / d, (w[2] - m.z) / d];
    }
    return direct < 1e-3 ? null : [(gx - m.x) / direct, (gz - m.z) / direct];
  }
}

function nearestWaypoint(wps: readonly Waypoint[], x: number, y: number, z: number) {
  let best = 0;
  let bestD = Infinity;
  wps.forEach((w, i) => {
    const d = Math.hypot(w.position[0] - x, (w.position[1] - y) * 2, w.position[2] - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** A* over the waypoint graph; returns node indices excluding the start. */
export function findPath(wps: readonly Waypoint[], start: number, goal: number, avoid: (from: number, to: number) => boolean = () => false): number[] {
  if (start === goal) return [goal];
  const dist = (a: number, b: number) => {
    const p = wps[a]!.position;
    const q = wps[b]!.position;
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  };
  const g = new Map<number, number>([[start, 0]]);
  const from = new Map<number, number>();
  const open = new Set([start]);
  while (open.size) {
    let current = -1;
    let bestF = Infinity;
    for (const n of open) {
      const f = g.get(n)! + dist(n, goal);
      if (f < bestF) {
        bestF = f;
        current = n;
      }
    }
    if (current === goal) {
      const path = [goal];
      while (from.has(path[0]!) && from.get(path[0]!) !== start) path.unshift(from.get(path[0]!)!);
      return path;
    }
    open.delete(current);
    for (const next of wps[current]!.links) {
      if (avoid(current, next)) continue;
      const cost = g.get(current)! + dist(current, next);
      if (cost < (g.get(next) ?? Infinity)) {
        g.set(next, cost);
        from.set(next, current);
        open.add(next);
      }
    }
  }
  return [];
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

import type { BotKind, CharacterId } from '../characters/types';
import { GRENADE, MELEES, WEAPONS, type MeleeId, type WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import type { MapLayout } from '../world/types';
import { aimDirection, createArms, stepArms, type ArmsHooks } from './arms';
import { CollisionWorld } from './collision';
import { MAX_REWIND, PLAYER, TICK } from './constants';
import { explosionDamage, stepGrenade, throwGrenade, type Grenade } from './grenades';
import { damageAt, headCenterY, rayHitPlayer, type HitPose } from './hitboxes';
import { createMoveState, eyeHeight, stepMove } from './movement';
import { pickSpawn, type RecentDeath } from './spawns';
import { BUTTON, type Command, type GameEvent, type HitKind, type MatchSettings, type PlayerState, type ShotTrace } from './types';

const HISTORY = 72;
const REGEN_DELAY = 4.5;
const REGEN_RATE = 22;

interface PoseRecord extends HitPose {
  time: number;
  alive: boolean;
}

export interface DamageSource {
  attacker: number;
  weapon: WeaponId | MeleeId | 'grenade';
  kind: HitKind;
  from: [number, number, number];
}

/** Authoritative world: commands in, state and events out. Runs on the host for every mode. */
export class HostSim {
  readonly world: CollisionWorld;
  readonly players = new Map<number, PlayerState>();
  readonly grenades: Grenade[] = [];
  events: GameEvent[] = [];
  traces: ShotTrace[] = [];
  time = 0;
  /** Rules hook: decides respawns, scoring and round flow (see match.ts). */
  onKill: ((victim: PlayerState, killer: PlayerState | null) => void) | null = null;
  damageEnabled = true;
  /** Bots hit humans for less; solo raises it wave by wave. */
  botDamage = 0.55;
  private history = new Map<number, PoseRecord[]>();
  private deaths: RecentDeath[] = [];
  private lastHurt = new Map<number, number>();
  private nextId = 1;
  private nextGrenade = 1;
  private seed: number;

  /** `seed` fixes spawns and bot choices for tests; matches roll a new one so spawns differ every game. */
  constructor(
    readonly layout: MapLayout,
    public settings: MatchSettings,
    seed = Math.floor(Math.random() * 4294967296)
  ) {
    this.world = new CollisionWorld(layout.colliders);
    this.seed = seed >>> 0;
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  addPlayer(name: string, character: CharacterId | BotKind, bot: BotKind | null = null, team: 0 | 1 | -1 = -1): PlayerState {
    const id = this.nextId++;
    const scale = bot === 'boss' ? 1.6 : 1;
    const health = bot === 'boss' ? 900 : bot === 'rusher' ? 70 : bot ? 100 : PLAYER.health;
    const player: PlayerState = {
      id,
      name,
      character,
      bot,
      team,
      move: createMoveState(),
      yaw: 0,
      pitch: 0,
      arms: createArms(LOADOUTS[character]),
      health,
      maxHealth: health,
      alive: false,
      respawnAt: this.time,
      protectedUntil: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      ping: 0,
      damagers: new Map(),
      lastSeq: 0,
      life: 0,
      scale
    };
    this.players.set(id, player);
    this.history.set(id, []);
    return player;
  }

  removePlayer(id: number) {
    this.players.delete(id);
    this.history.delete(id);
  }

  spawn(player: PlayerState, at?: { position: [number, number, number]; yaw: number }) {
    const spot = at ?? pickSpawn(this.world, this.layout.spawns, player, this.players.values(), this.deaths, this.time, () => this.random());
    player.move = createMoveState(...spot.position);
    player.move.grounded = true;
    player.yaw = spot.yaw;
    player.pitch = 0;
    player.life = (player.life + 1) & 255;
    const keep = player.arms;
    player.arms = createArms(LOADOUTS[player.character], keep.next ?? keep.weapon);
    player.arms.prevButtons = keep.prevButtons;
    player.health = player.maxHealth;
    player.alive = true;
    player.protectedUntil = this.time + (player.bot ? 0 : PLAYER.spawnProtection);
    player.damagers.clear();
    this.history.set(player.id, []);
    this.events.push({ type: 'spawn', player: player.id });
  }

  /** One client command = one tick of that player's time. */
  applyCommand(id: number, cmd: Command) {
    const p = this.players.get(id);
    if (!p || cmd.seq <= p.lastSeq) return;
    p.lastSeq = cmd.seq;
    if (cmd.life !== p.life) return;
    if (!p.alive) {
      p.arms.prevButtons = cmd.buttons;
      return;
    }
    p.yaw = cmd.yaw;
    p.pitch = Math.max(-1.5, Math.min(1.5, cmd.pitch));
    const def = WEAPONS[p.arms.weapon];
    stepMove(this.world, p.move, cmdToMove(cmd), TICK, def.moveScale * (p.bot === 'rusher' ? 1.15 : 1));
    stepArms(p, cmd, TICK, this.hooks(cmd.viewTime));
    if (p.move.y < this.layout.killY) this.damage(p, 1000, { attacker: p.id, weapon: 'grenade', kind: 'body', from: [p.move.x, p.move.y, p.move.z] });
  }

  private hooks(viewTime: number): ArmsHooks {
    return {
      fire: (player, weapon, dirs) => this.resolveShot(player, weapon, dirs, viewTime),
      melee: (player) => this.resolveMelee(player, viewTime),
      grenade: (player, cook, low) => {
        const m = player.move;
        const eye: [number, number, number] = [m.x, m.y + eyeHeight(m) * player.scale, m.z];
        this.grenades.push(throwGrenade(this.nextGrenade++, player.id, eye, aimDirection(player.yaw, player.pitch), [m.vx, m.vy, m.vz], cook, low));
      }
    };
  }

  eye(p: PlayerState): [number, number, number] {
    return [p.move.x, p.move.y + eyeHeight(p.move) * p.scale, p.move.z];
  }

  hostile(a: PlayerState, b: PlayerState) {
    if (a.id === b.id) return false;
    if (a.bot && b.bot && this.settings.mode === 'solo') return false;
    return a.team < 0 || a.team !== b.team;
  }

  /** Where `target` was at host time `t`, from the recorded history. */
  poseAt(target: PlayerState, t: number): PoseRecord | null {
    const list = this.history.get(target.id);
    const now: PoseRecord = { time: this.time, alive: target.alive, x: target.move.x, y: target.move.y, z: target.move.z, crouch: target.move.crouch, scale: target.scale };
    if (!list || list.length === 0 || t >= this.time) return now;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]!;
      if (a.time <= t) {
        const b = list[i + 1] ?? now;
        const k = b.time > a.time ? (t - a.time) / (b.time - a.time) : 0;
        return { time: t, alive: a.alive && b.alive, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, crouch: a.crouch + (b.crouch - a.crouch) * k, scale: a.scale };
      }
    }
    return list[0]!;
  }

  private rewindTime(viewTime: number) {
    return Math.max(this.time - MAX_REWIND, Math.min(this.time, viewTime));
  }

  private resolveShot(shooter: PlayerState, weapon: WeaponId, dirs: [number, number, number][], viewTime: number) {
    const def = WEAPONS[weapon];
    const t = this.rewindTime(viewTime);
    const origin = this.eye(shooter);
    const trace: ShotTrace = { shooter: shooter.id, weapon, origin, ends: [] };
    const totals = new Map<number, { amount: number; head: boolean }>();
    const poses = new Map<number, PoseRecord>();
    for (const p of this.players.values()) {
      if (p.alive && p.id !== shooter.id) {
        const pose = this.poseAt(p, t);
        if (pose?.alive) poses.set(p.id, pose);
      }
    }
    for (const d of dirs) {
      const wall = this.world.raycast(origin[0], origin[1], origin[2], d[0], d[1], d[2], 260, true);
      let maxT = wall?.t ?? 260;
      let victim: PlayerState | null = null;
      let kind: HitKind = 'body';
      for (const [id, pose] of poses) {
        const hit = rayHitPlayer(pose, origin[0], origin[1], origin[2], d[0], d[1], d[2], maxT);
        if (hit) {
          maxT = hit.t;
          victim = this.players.get(id)!;
          kind = hit.kind;
        }
      }
      const point: [number, number, number] = [origin[0] + d[0] * maxT, origin[1] + d[1] * maxT, origin[2] + d[2] * maxT];
      trace.ends.push({ point, surface: victim ? 'body' : (wall?.surface ?? 'none'), hitPlayer: victim?.id ?? 0, normal: victim ? [-d[0], -d[1], -d[2]] : (wall?.normal ?? [0, 1, 0]) });
      if (victim && this.hostile(shooter, victim)) {
        const full = kind === 'head' ? def.head : def.body;
        const min = def.minDamage * (full / def.body);
        const amount = damageAt(maxT, full, min, def.falloffStart, def.falloffEnd) * (shooter.bot && !victim.bot ? this.botDamage : 1);
        const entry = totals.get(victim.id) ?? { amount: 0, head: false };
        entry.amount += amount;
        entry.head ||= kind === 'head';
        totals.set(victim.id, entry);
      }
    }
    this.traces.push(trace);
    for (const [id, { amount, head }] of totals) {
      const victim = this.players.get(id);
      if (victim) this.damage(victim, Math.round(amount), { attacker: shooter.id, weapon, kind: head ? 'head' : 'body', from: origin });
    }
  }

  private resolveMelee(attacker: PlayerState, viewTime: number) {
    const t = this.rewindTime(viewTime);
    const eye = this.eye(attacker);
    const fwd = aimDirection(attacker.yaw, 0);
    let best: PlayerState | null = null;
    const melee = MELEES[LOADOUTS[attacker.character].melee];
    let bestD = melee.range + 0.4;
    for (const p of this.players.values()) {
      if (!p.alive || !this.hostile(attacker, p)) continue;
      const pose = this.poseAt(p, t);
      if (!pose?.alive) continue;
      const dx = pose.x - eye[0];
      const dz = pose.z - eye[2];
      const d = Math.hypot(dx, dz);
      const dy = headCenterY(pose) - 0.5 - eye[1];
      if (d > bestD || Math.abs(dy) > 1.4) continue;
      const cos = (dx * fwd[0] + dz * fwd[2]) / Math.max(d, 1e-4);
      if (d > 0.5 && cos < Math.cos(melee.arc)) continue;
      best = p;
      bestD = d;
    }
    this.events.push({ type: 'melee', player: attacker.id, hit: !!best });
    if (!best) return;
    const toVictim = Math.atan2(-(best.move.x - attacker.move.x), -(best.move.z - attacker.move.z));
    const facing = Math.cos(best.yaw - toVictim);
    // Victim facing away from the attacker: their forward points along attacker→victim.
    const backstab = facing > 0.5;
    this.damage(best, backstab ? melee.backstab : melee.damage, { attacker: attacker.id, weapon: melee.id, kind: 'body', from: eye });
  }

  damage(victim: PlayerState, amount: number, src: DamageSource) {
    if (!victim.alive || amount <= 0) return;
    const attacker = this.players.get(src.attacker) ?? null;
    const self = src.attacker === victim.id;
    if (!self && (!this.damageEnabled || this.time < victim.protectedUntil)) return;
    if (attacker && !self && !this.hostile(attacker, victim)) return;
    victim.health -= amount;
    this.lastHurt.set(victim.id, this.time);
    if (!self) victim.damagers.set(src.attacker, (victim.damagers.get(src.attacker) ?? 0) + amount);
    const fatal = victim.health <= 0;
    this.events.push({ type: 'damage', attacker: src.attacker, victim: victim.id, amount, kind: src.kind, from: src.from, fatal });
    if (!fatal) return;
    victim.health = 0;
    victim.alive = false;
    victim.deaths++;
    victim.arms.cook = -1;
    this.deaths.push({ x: victim.move.x, z: victim.move.z, time: this.time });
    let assister: number | null = null;
    for (const [id, dealt] of victim.damagers) {
      if (id !== src.attacker && dealt >= 30) {
        const a = this.players.get(id);
        if (a) {
          a.assists++;
          a.score += 50;
          assister = id;
        }
      }
    }
    const killer = attacker && !self ? attacker : null;
    if (killer) {
      killer.kills++;
      killer.score += src.kind === 'head' ? 150 : 100;
    }
    this.events.push({ type: 'kill', killer: killer?.id ?? victim.id, victim: victim.id, weapon: src.weapon, headshot: src.kind === 'head', assister });
    this.onKill?.(victim, killer);
  }

  /** Grenades, regeneration and pose history; commands are applied as they arrive. */
  tick(dt: number) {
    this.time += dt;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i]!;
      if (stepGrenade(this.world, g, dt)) {
        this.grenades.splice(i, 1);
        this.explode(g);
      }
    }
    for (const p of this.players.values()) {
      if (p.alive && p.health < p.maxHealth && this.time - (this.lastHurt.get(p.id) ?? -99) > REGEN_DELAY) {
        p.health = Math.min(p.maxHealth, p.health + REGEN_RATE * dt * (p.maxHealth / 100));
      }
      const list = this.history.get(p.id)!;
      list.push({ time: this.time, alive: p.alive, x: p.move.x, y: p.move.y, z: p.move.z, crouch: p.move.crouch, scale: p.scale });
      if (list.length > HISTORY) list.shift();
    }
    if (this.deaths.length > 24) this.deaths.splice(0, this.deaths.length - 24);
  }

  private explode(g: Grenade) {
    this.events.push({ type: 'explosion', position: [g.x, g.y, g.z], owner: g.owner });
    for (const p of [...this.players.values()]) {
      if (!p.alive) continue;
      const cy = p.move.y + 0.9 * p.scale;
      const d = Math.hypot(p.move.x - g.x, cy - g.y, p.move.z - g.z);
      if (d > GRENADE.radius) continue;
      if (!this.world.clearLine(g.x, g.y + 0.15, g.z, p.move.x, cy, p.move.z) && !this.world.clearLine(g.x, g.y + 0.15, g.z, p.move.x, p.move.y + 1.6 * p.scale, p.move.z)) continue;
      const owner = this.players.get(g.owner);
      if (owner && p.id !== owner.id && !this.hostile(owner, p)) continue;
      this.damage(p, explosionDamage(d), { attacker: g.owner, weapon: 'grenade', kind: 'body', from: [g.x, g.y, g.z] });
    }
  }

  drain() {
    const out = { events: this.events, traces: this.traces };
    this.events = [];
    this.traces = [];
    return out;
  }
}

export function cmdToMove(cmd: Command) {
  return {
    forward: cmd.forward,
    right: cmd.right,
    yaw: cmd.yaw,
    jump: (cmd.buttons & BUTTON.jump) !== 0,
    crouch: (cmd.buttons & BUTTON.crouch) !== 0,
    sprint: (cmd.buttons & BUTTON.sprint) !== 0,
    ads: (cmd.buttons & BUTTON.ads) !== 0
  };
}

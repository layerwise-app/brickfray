import type { BotKind, CharacterId } from '../characters/types';
import { GRENADE, WEAPONS } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import type { MapLayout } from '../world/types';
import { aimDirection, createArms, fillMagazines, stepArms, type ArmsHooks } from './arms';
import { CollisionWorld } from './collision';
import { MAX_REWIND, PLAYER, TICK } from './constants';
import { explosionDamage, stepGrenade, throwGrenade, type Grenade } from './grenades';
import type { HitPose } from './hitboxes';
import { resolveMelee, resolveShot } from './hits';
import { createMoveState, eyeHeight, stepMove } from './movement';
import { pickSpawn, spawnWatch, type RecentDeath, type SpawnWatch } from './spawns';
import { KILL_SCORE } from './streaks';
import { BUTTON, type Command, type GameEvent, type HitKind, type HostPlayer, type KillCause, type MatchSettings, type PlayerState, type ShotTrace } from './types';

type KillEvent = Extract<GameEvent, { type: 'kill' }>;
import { applyLevels, noUpgrades, upgradeStats } from './upgrades';

const HISTORY = 72;

export interface PoseRecord extends HitPose {
  time: number;
  alive: boolean;
}

export interface DamageSource {
  attacker: number;
  weapon: KillCause;
  kind: HitKind;
  from: [number, number, number];
}

/** Authoritative world: commands in, state and events out. Runs on the host for every mode. */
export class HostSim {
  readonly world: CollisionWorld;
  readonly players = new Map<number, HostPlayer>();
  readonly grenades: Grenade[] = [];
  events: GameEvent[] = [];
  traces: ShotTrace[] = [];
  time = 0;
  /** Rules hook: decides respawns, scoring and round flow (see match.ts). */
  onKill: ((victim: HostPlayer, killer: HostPlayer | null, weapon: KillCause, kill: KillEvent) => void) | null = null;
  damageEnabled = true;
  /** Bots hit humans for less; solo raises it wave by wave. */
  botDamage = 0.55;
  /** Host time before which nobody regenerates (solo holds it through a part heal between waves). */
  regenAfter = 0;
  private history = new Map<number, PoseRecord[]>();
  private deaths: RecentDeath[] = [];
  private lastHurt = new Map<number, number>();
  private nextId = 1;
  private nextGrenade = 1;
  private seed: number;
  /** Room matches judge spawns by how soon an enemy could see them too (built on the first spawn); undefined = not yet. */
  private watch: SpawnWatch | null | undefined;

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

  addPlayer(name: string, character: CharacterId | BotKind, bot: BotKind | null = null, team: 0 | 1 | -1 = -1): HostPlayer {
    const id = this.nextId++;
    const scale = bot === 'boss' ? 1.6 : 1;
    const health = bot === 'boss' ? 900 : bot === 'rusher' ? 70 : bot ? 100 : PLAYER.health;
    const player: HostPlayer = {
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
      scale,
      upgrades: noUpgrades(),
      armor: 0,
      thrown: 0
    };
    this.players.set(id, player);
    this.history.set(id, []);
    return player;
  }

  removePlayer(id: number) {
    this.players.delete(id);
    this.history.delete(id);
  }

  spawn(player: HostPlayer, at?: { position: [number, number, number]; yaw: number }) {
    const rooms = this.settings.mode !== 'solo';
    if (!at && rooms && this.watch === undefined) this.watch = spawnWatch(this.world, this.layout);
    const runs = rooms ? this.watch : null;
    const spot = at ?? pickSpawn(this.world, this.layout.spawns, player, this.players.values(), this.deaths, this.time, () => this.random(), runs ? { layout: this.layout, runs } : null);
    player.move = createMoveState(...spot.position);
    player.move.grounded = true;
    player.yaw = spot.yaw;
    player.pitch = 0;
    player.life = (player.life + 1) & 255;
    const keep = player.arms;
    player.arms = createArms(LOADOUTS[player.character], keep.next ?? keep.weapon);
    player.arms.prevButtons = keep.prevButtons;
    applyLevels(player);
    fillMagazines(player.arms);
    player.arms.grenades = player.arms.grenadeMax;
    player.health = player.maxHealth;
    player.alive = true;
    // Solo's snapbots come in waves balanced without it; in rooms bots get what a player gets.
    player.protectedUntil = this.time + (player.bot && !rooms ? 0 : PLAYER.spawnProtection);
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
    if (p.move.y < this.layout.killY) this.damage(p, 1000, { attacker: p.id, weapon: 'water', kind: 'body', from: [p.move.x, p.move.y, p.move.z] });
  }

  private hooks(viewTime: number): ArmsHooks {
    // Spawn protection ends with the first attack: nobody fights from behind it.
    const attack = (player: PlayerState) => (player.protectedUntil = Math.min(player.protectedUntil, this.time));
    return {
      fire: (player, weapon, dirs) => {
        attack(player);
        resolveShot(this, player, weapon, dirs, viewTime);
      },
      melee: (player) => {
        attack(player);
        resolveMelee(this, player, viewTime);
      },
      grenade: (player, cook, low) => {
        attack(player);
        const m = player.move;
        const eye: [number, number, number] = [m.x, m.y + eyeHeight(m) * player.scale, m.z];
        const g = throwGrenade(this.nextGrenade++, player.id, eye, aimDirection(player.yaw, player.pitch), [m.vx, m.vy, m.vz], cook, low);
        g.byBot = player.bot !== null;
        this.grenades.push(g);
        const thrower = this.players.get(player.id);
        if (thrower) thrower.thrown = (thrower.thrown ?? 0) + 1;
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

  rewindTime(viewTime: number) {
    return Math.max(this.time - MAX_REWIND, Math.min(this.time, viewTime));
  }

  damage(victim: HostPlayer, amount: number, src: DamageSource) {
    if (!victim.alive || amount <= 0) return;
    const attacker = this.players.get(src.attacker) ?? null;
    const self = src.attacker === victim.id;
    if (!self && (!this.damageEnabled || this.time < victim.protectedUntil)) return;
    if (attacker && !self && !this.hostile(attacker, victim)) return;
    if (attacker && !self && attacker.upgrades.damage) amount = Math.round(amount * upgradeStats(attacker.upgrades).damageScale);
    const soaked = Math.min(victim.armor, amount);
    victim.armor -= soaked;
    victim.health -= amount - soaked;
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
      killer.score += src.kind === 'head' ? KILL_SCORE.head : KILL_SCORE.body;
    }
    const kill: KillEvent = { type: 'kill', killer: killer?.id ?? victim.id, victim: victim.id, weapon: src.weapon, headshot: src.kind === 'head', assister, respawnAt: null, bounty: 0 };
    this.events.push(kill);
    this.onKill?.(victim, killer, src.weapon, kill);
    if (victim.respawnAt > this.time && Number.isFinite(victim.respawnAt)) kill.respawnAt = victim.respawnAt;
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
      if (p.alive && p.health < p.maxHealth && this.time >= this.regenAfter) {
        const { regenDelay, regenRate } = upgradeStats(p.upgrades);
        if (this.time - (this.lastHurt.get(p.id) ?? -99) > regenDelay) p.health = Math.min(p.maxHealth, p.health + regenRate * dt * (p.maxHealth / 100));
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
      const scale = g.byBot && !p.bot ? this.botDamage : 1;
      this.damage(p, Math.round(explosionDamage(d) * scale), { attacker: g.owner, weapon: 'grenade', kind: 'body', from: [g.x, g.y, g.z] });
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

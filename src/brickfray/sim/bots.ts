import { GRENADE, WEAPONS } from '../weapons/defs';
import { GrenadeWatch, runTo, type DodgeState } from './bot-dodge';
import { fightMove, GRACE, kitSlot, lostMove, onTarget, throwAt, wantsSights, type FightState, type ThrowState } from './bot-fight';
import { BotNav, type NavState, type StuckState } from './bot-nav';
import { BOSS_VOLLEY, botProfile, type BotProfile } from './bot-profile';
import { BotRoam, HEADWAY, type RoamState, type Spot } from './bot-roam';
import { rush, startRush, type RushState } from './bot-rush';
import { BotSense, wrap, type SenseState } from './bot-sense';
import { huntTarget, pickLane, type TeamState } from './bot-team';
import { TICK } from './constants';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

export { findPath } from './bot-nav';

interface Brain extends NavState, StuckState, RoamState, RushState, FightState, ThrowState, DodgeState, SenseState, TeamState {
  seq: number;
  /** The life (`PlayerState.life`) this brain last played. */
  life: number;
  /** Where the bot last made headway out of a fight, and the host time it did. */
  anchor: Spot;
  anchorAt: number;
  aimPitch: number;
  fireHeld: boolean;
  /** A reload starts on a press, and a grenade throw cancels one: a held button would never start it again. */
  reloadHeld: boolean;
  slot: number;
  /** A fixed skill instead of the director's (a scripted stand-in for a player in tests). */
  skill: number | null;
}

/** Out of a fight, a bot that has not got `HEADWAY` from where it stood for this many seconds goes on patrol. */
const IDLE = 2;
/** A kit carries its far-fight sidearm while hunting an enemy this much (m) beyond the range it switches at. */
const HUNT_SLACK = 4;
/** A fill bot steps right onto its firing spot (m): a metre off it, the post or crate edge the line passes can block it. */
const SPOT_REACH = 0.3;
/**
 * In rooms a bot does not know where an enemy came back in: it hunts one that respawned less than this long ago (s) only
 * once it has fired (or the bot sees it). Hunting everyone's true position made bots converge on every fresh spawn.
 */
const FRESH = 4;

/** Snapbot and fill-bot brains: perceive, navigate the waypoint graph, aim with human-like lag, shoot. */
export class BotDirector {
  private brains = new Map<number, Brain>();
  /** Each player's life and the host time it began (-Infinity for a life already under way when first seen). */
  private lives = new Map<number, { life: number; at: number }>();
  /** 0 = easy … 1 = sharp; solo raises it each wave. */
  skill = 0.4;
  /** Seconds the aim trails a moving target (solo: early waves miss a strafing player); 0 aims where it is. */
  lag = 0;
  private readonly nav: BotNav;
  private readonly roam: BotRoam;
  private readonly sense: BotSense;
  private readonly grenades: GrenadeWatch;
  /** Bot choices are drawn from the match's seed, so a seeded match plays out the same every time. */
  private seed: number;

  constructor(private readonly host: HostSim) {
    const random = () => this.random();
    this.nav = new BotNav(host);
    this.roam = new BotRoam(host, random);
    this.sense = new BotSense(host, random, (at) => this.roam.saw(at));
    this.grenades = new GrenadeWatch(host, this.nav);
    this.seed = Math.floor(host.random() * 4294967296);
  }

  add(player: PlayerState, skill: number | null = null) {
    const m = player.move;
    this.brains.set(player.id, {
      skill,
      seq: 0,
      life: player.life,
      target: 0,
      seenFor: 0,
      lostFor: 99,
      hunt: 0,
      dealt: new Map(),
      hurtAt: new Map(),
      lastSeen: null,
      patrol: null,
      patrolUntil: 0,
      approach: null,
      lane: 0,
      anchor: [m.x, m.y, m.z],
      anchorAt: this.host.time,
      path: [],
      repath: 0,
      think: this.random() * 0.2,
      strafe: 1,
      strafeTime: 0,
      lineCheck: 0,
      sideOk: true,
      backOk: true,
      aimYaw: player.yaw,
      aimPitch: 0,
      errYaw: 0,
      errPitch: 0,
      stuck: 0,
      lastPos: [m.x, m.z],
      crouchTime: 0,
      sidestep: 0,
      grenadeCooldown: 6,
      clearing: 0,
      lob: 0,
      lobPitch: 0,
      noticed: new Map(),
      escape: null,
      rush: 'close',
      rushTime: 0,
      avoid: new Map(),
      heading: new Map(),
      blocked: new Map(),
      graphOnly: 0,
      fireHeld: false,
      reloadHeld: false,
      slot: 0,
      post: null,
      postRest: 0
    });
  }

  remove(id: number) {
    this.brains.delete(id);
  }

  tick() {
    for (const p of this.host.players.values()) {
      const known = this.lives.get(p.id);
      if (!known) this.lives.set(p.id, { life: p.life, at: -Infinity });
      else if (known.life !== p.life) this.lives.set(p.id, { life: p.life, at: this.host.time });
    }
    this.grenades.update();
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
      this.sense.forget(b);
      b.patrol = null;
      b.escape = null;
      b.anchor = [m.x, m.y, m.z];
      b.anchorAt = host.time;
      return cmd;
    }
    if (b.life !== bot.life) this.newLife(bot, b);
    const skill = b.skill ?? this.skill;
    const eye = host.eye(bot);
    this.sense.feelHits(bot, b, prof, skill);
    b.think -= TICK;
    if (b.think <= 0) {
      b.think = 0.15 + this.random() * 0.1;
      this.sense.perceive(bot, b, eye, prof, skill);
    }
    const target = b.target ? host.players.get(b.target) : undefined;
    if (b.target && !target?.alive) this.sense.forget(b);
    const visible = !!target?.alive && b.lostFor === 0;
    // A close-range gun goes after an enemy at once, round through cover.
    const closer = bot.bot === 'rusher' || (prof.standoff && prof.band.min === 0);
    // Just out of sight, a fight goes on: aim where the enemy was and look for it, rather than walk off after it.
    const lost = !!target?.alive && !visible && b.lostFor <= GRACE && !!b.lastSeen && !closer;
    if (visible || lost || Math.hypot(m.x - b.anchor[0], m.y - b.anchor[1], m.z - b.anchor[2]) > HEADWAY) {
      b.anchor = [m.x, m.y, m.z];
      b.anchorAt = host.time;
    } else if (host.time - b.anchorAt > IDLE) {
      // Whatever it was walking to can't be reached or held nobody: go somewhere else.
      this.roam.patrol(bot, b);
      b.anchorAt = host.time;
    }
    const run = this.grenades.dodge(bot, b, skill, () => this.random());

    let goal: Spot | null = null;
    /** The enemy a close-range bot's route keeps out of the sight of. */
    let watcher: Spot | null = null;
    if (visible && target) {
      b.seenFor += TICK;
      b.hunt = 0;
      // A fill bot fights the way the gun in its hands wants; a snapbot has one way.
      const gun = bot.character === bot.bot ? prof : botProfile(bot, bot.arms.weapon);
      // A Scopebot lines up one deliberate shot: its aim trails a moving target half as far.
      const aim = this.sense.aimPoint(target, this.lag * (bot.bot === 'sniper' ? 0.5 : 1), gun.patient);
      const { dist, offAim } = this.turnTo(b, eye, aim, prof, skill);
      b.errYaw *= 0.985 - skill * 0.02;
      b.errPitch *= 0.985 - skill * 0.02;
      if (prof.sidearm) b.slot = kitSlot(prof.sidearm, b.slot, dist);
      const ready = b.seenFor > prof.reaction * (1.3 - skill * 0.6);
      const def = WEAPONS[bot.arms.weapon];
      const volley = bot.bot !== 'boss' || bot.arms.sinceShot > BOSS_VOLLEY;
      if (ready && volley && onTarget(gun, bot.arms.ads, offAim, dist, target.scale) && bot.arms.ammo[bot.arms.weapon] > 0) {
        if (def.mode === 'auto') cmd.buttons |= BUTTON.fire;
        else if (!b.fireHeld) cmd.buttons |= BUTTON.fire;
      }
      b.fireHeld = (cmd.buttons & BUTTON.fire) !== 0;
      if (wantsSights(gun, bot.arms.weapon, dist, closingSpeed(bot, target))) cmd.buttons |= BUTTON.ads;
      const swing = dist < 1.9 && bot.arms.meleeCooldown <= 0;
      if (swing) cmd.buttons |= BUTTON.melee;
      if (bot.bot === 'rusher') rush(b, dist, cmd, swing, () => this.random());
      else fightMove(host, bot, b, b.aimYaw, aim, dist, gun.band, () => this.random(), cmd);
      if (!run) throwAt(bot, b, target, eye, dist, skill, () => this.random(), cmd);
      // A bot that walks on after its own grenade (or has it bounce back off cover) blows itself up.
      if (b.clearing > 0 && dist < GRENADE.radius * 2 + 4) cmd.forward = -1;
      if (cmd.forward > 0) goal = [target.move.x, target.move.y, target.move.z];
    } else {
      b.fireHeld = false;
      if (b.lostFor > GRACE) b.slot = this.huntingSlot(bot, b, prof);
      startRush(b);
      if (lost) {
        const seen = b.lastSeen!;
        const { dist } = this.turnTo(b, eye, [seen[0], seen[1] + 1.2, seen[2]], prof, skill);
        lostMove(b.lostFor, dist, prof.band, cmd);
      } else {
        b.seenFor = 0;
        const toward = prof.standoff ? (seen: Spot) => this.roam.standoff(bot, b, (watcher = seen), prof.band, prof.range, null) : undefined;
        goal = this.roam.goal(bot, b, () => this.hunt(bot, b, prof, closer, (enemy) => (watcher = enemy)), toward);
        if (!closer || bot.bot === 'rusher') watcher = null;
      }
    }
    b.clearing = Math.max(0, b.clearing - TICK);
    const ammo = bot.arms.ammo[bot.arms.weapon];
    const engaged = b.target !== 0 && b.lostFor <= 2;
    if ((ammo === 0 || (!engaged && ammo < WEAPONS[bot.arms.weapon].mag * 0.5)) && !b.reloadHeld) cmd.buttons |= BUTTON.reload;
    b.reloadHeld = (cmd.buttons & BUTTON.reload) !== 0;
    if (b.crouchTime > 0) {
      b.crouchTime -= TICK;
      cmd.buttons |= BUTTON.crouch;
    }

    if (run) runTo(bot, b, run, cmd);
    else this.steer(bot, b, goal, watcher, visible, lost, prof.standoff ? SPOT_REACH : 1, cmd);
    b.sidestep = Math.max(0, b.sidestep - TICK);
    this.nav.unstick(bot, b, cmd);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.lob > 0 ? b.lobPitch : clamp(b.aimPitch, -1.2, 1.2);
    b.lob = Math.max(0, b.lob - 1);
    this.nav.keepOnGround(bot, b, cmd);
    return cmd;
  }

  /** Walk the waypoint graph toward the goal: strafing in a fight, else facing the way it walks. */
  private steer(bot: PlayerState, b: Brain, goal: Spot | null, watcher: Spot | null, visible: boolean, lost: boolean, reach: number, cmd: Command) {
    const steer = this.nav.navigate(bot, b, goal, watcher, reach);
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
        // It walks the route while it turns to it: walking the way it still faces can step off the quay it was aiming across.
        const ahead = wrap(moveYaw - b.aimYaw);
        cmd.forward = b.sidestep > 0 ? -0.4 : Math.cos(ahead);
        cmd.right = b.sidestep > 0 ? b.strafe : -Math.sin(ahead);
        // With nobody known nearby a match bot runs to the fight, as a player would; solo waves keep their walking pace.
        const hurry = this.host.settings.mode !== 'solo' && b.lostFor > 2 && b.path.length > 2 && b.sidestep <= 0 && !(cmd.buttons & BUTTON.crouch);
        if (bot.bot === 'rusher' || hurry) cmd.buttons |= BUTTON.sprint;
      }
    } else if (!visible && !lost && b.approach) {
      // Arrived where the enemy should be in sight: face it, or it stays out of the bot's view cone behind it.
      const [ex, , ez] = b.approach.for;
      b.aimYaw += clamp(wrap(Math.atan2(-(ex - bot.move.x), -(ez - bot.move.z)) - b.aimYaw), -5 * TICK, 5 * TICK);
    }
  }

  /** A fresh life: last life's grudges are gone, and a team bot takes the flank fewest living teammates are on. */
  private newLife(bot: PlayerState, b: Brain) {
    b.life = bot.life;
    b.dealt.clear();
    b.hurtAt.clear();
    b.noticed.clear();
    b.hunt = 0;
    b.lane = pickLane(this.host, bot, b, this.brains, () => this.random());
    b.post = null;
    b.postRest = 0;
  }

  /** Out of a fight a kit with a sidearm for far fights carries it while the enemy it hunts is well beyond its primary's reach. */
  private huntingSlot(bot: PlayerState, b: Brain, prof: BotProfile) {
    const far = prof.sidearm?.far;
    const enemy = far === undefined ? undefined : this.host.players.get(b.hunt);
    return enemy?.alive && Math.hypot(enemy.move.x - bot.move.x, enemy.move.z - bot.move.z) > far! + HUNT_SLACK ? 1 : 0;
  }

  /** Nobody in sight: where to go for the enemy it hunts (a fill bot to a spot in its band, from its flank). */
  private hunt(bot: PlayerState, b: Brain, prof: BotProfile, closer: boolean, chose: (enemy: Spot) => void): Spot | null {
    const enemy = huntTarget(this.host, bot, b, this.brains, closer, (p) => this.unheard(p));
    if (!enemy) return null;
    chose(enemy);
    const post = prof.patient ? this.roam.perch(bot, b, enemy, prof.band) : null;
    if (post) return post;
    return prof.standoff ? this.roam.standoff(bot, b, enemy, prof.band, prof.range, this.roam.flank(bot, b.lane, enemy)) : this.roam.approach(bot, b, enemy, prof.range);
  }

  /** A room enemy that respawned under FRESH s ago and has not fired since. */
  private unheard(p: PlayerState) {
    const since = this.host.time - (this.lives.get(p.id)?.at ?? -Infinity);
    return this.host.settings.mode !== 'solo' && since < FRESH && p.arms.shots === 0;
  }

  /** Turn the aim toward `at` (with the bot's aim error) at its turn rate; the distance in plan and how far off it still is. */
  private turnTo(b: Brain, eye: [number, number, number], at: readonly number[], prof: BotProfile, skill: number) {
    const dx = at[0]! - eye[0];
    const dy = at[1]! - eye[1];
    const dz = at[2]! - eye[2];
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(-dx, -dz) + b.errYaw;
    const wantPitch = Math.atan2(dy, dist) + b.errPitch;
    const turn = prof.turn * (0.6 + skill * 0.8) * TICK;
    b.aimYaw += clamp(wrap(wantYaw - b.aimYaw), -turn, turn);
    b.aimPitch += clamp(wantPitch - b.aimPitch, -turn, turn);
    return { dist, offAim: Math.abs(wrap(wantYaw - b.errYaw - b.aimYaw)) + Math.abs(wantPitch - b.errPitch - b.aimPitch) };
  }

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How fast (m/s) `target` is coming at `bot` in plan. */
function closingSpeed(bot: PlayerState, target: PlayerState) {
  const dx = bot.move.x - target.move.x;
  const dz = bot.move.z - target.move.z;
  const d = Math.hypot(dx, dz);
  return d < 1e-3 ? 0 : (target.move.vx * dx + target.move.vz * dz) / d;
}

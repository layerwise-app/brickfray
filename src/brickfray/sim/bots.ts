import { GRENADE, WEAPONS } from '../weapons/defs';
import { prune, TeamCalls, CALL_ERR, believe, type BeliefState } from './bot-belief';
import { GrenadeWatch, runTo, type DodgeState } from './bot-dodge';
import { listen, Noises, type EarState } from './bot-ears';
import { fightMove, GRACE, kitSlot, lostMove, onTarget, throwAt, wantsSights, type FightState, type ThrowState } from './bot-fight';
import { BotNav, type NavState, type StuckState } from './bot-nav';
import { BOSS_VOLLEY, botProfile, type BotProfile } from './bot-profile';
import { BotRoam, HEADWAY, type RoamState, type Spot } from './bot-roam';
import { rush, startRush, type RushState } from './bot-rush';
import { BotSense, type SenseState } from './bot-sense';
import { look, turnTo, type LookState } from './bot-look';
import { huntTarget, pickLane, type TeamState } from './bot-team';
import { TICK } from './constants';
import type { DamageSource, HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

export { findPath } from './bot-nav';

interface Brain extends NavState, StuckState, RoamState, RushState, FightState, ThrowState, DodgeState, SenseState, BeliefState, EarState, TeamState, LookState {
  seq: number;
  /** The life (`PlayerState.life`) this brain last played. */
  life: number;
  /** Where the bot last made headway out of a fight, and the host time it did. */
  anchor: Spot;
  anchorAt: number;
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
/** Fire no sooner than this (s) after locking on, however long it took to notice the enemy. */
const MIN_AIM = 0.08;
/** Going for an enemy believed this near (m), a bot walks with its eyes on the spot instead of running. */
const WATCH = 25;
/**
 * Solo only, a horde mode's rule: when no wave bot has had news of the player for `after` s, the wave gets a scout's
 * word of where the player is, `err` m off. A player who holds still in a corner can't stall a wave; never in matches.
 */
const SCOUT = { after: 15, err: 12 };

/**
 * Snapbot and fill-bot brains. A bot acts only on what a player in its place could know: what it sees in its view,
 * hears, feels hit it, or a teammate calls; with none of that it patrols the map. It navigates the waypoint graph,
 * aims with human-like lag and shoots.
 */
export class BotDirector {
  private brains = new Map<number, Brain>();
  /** 0 = easy … 1 = sharp: match fill bots play at this; solo sets it each wave. */
  skill = 0.5;
  /** Seconds the aim trails a moving target (solo: early waves miss a strafing player); 0 aims where it is. */
  lag = 0;
  private readonly nav: BotNav;
  private readonly roam: BotRoam;
  private readonly sense: BotSense;
  private readonly grenades: GrenadeWatch;
  private readonly noises: Noises;
  private readonly calls: TeamCalls;
  /** Hits each bot took since its last think, with where they came from. */
  private hits = new Map<number, DamageSource[]>();
  /** Solo: player id -> host time the wave last had news of that player (see SCOUT). */
  private news = new Map<number, number>();
  /** Bot choices are drawn from the match's seed, so a seeded match plays out the same every time. */
  private seed: number;

  constructor(private readonly host: HostSim) {
    const random = () => this.random();
    this.nav = new BotNav(host);
    this.roam = new BotRoam(host, random);
    this.sense = new BotSense(host, random);
    this.grenades = new GrenadeWatch(host, this.nav);
    this.noises = new Noises(host);
    this.calls = new TeamCalls(random);
    this.seed = Math.floor(host.random() * 4294967296);
    host.onDamage = (victim, src) => {
      if (this.brains.has(victim.id)) this.hits.set(victim.id, [...(this.hits.get(victim.id) ?? []), src]);
    };
  }

  add(player: PlayerState, skill: number | null = null) {
    const m = player.move;
    const t = this.host.time;
    this.brains.set(player.id, {
      skill,
      seq: 0,
      life: player.life,
      target: 0,
      seenFor: 0,
      lostFor: 99,
      hunt: 0,
      huntAt: null,
      hurtAt: new Map(),
      lastSeen: null,
      beliefs: new Map(),
      glance: null,
      inView: new Map(),
      looked: t,
      noticeTook: 0,
      heardUpTo: t,
      loud: { level: -Infinity, at: -Infinity },
      checked: -Infinity,
      patrol: null,
      patrolUntil: 0,
      approach: null,
      lane: 0,
      anchor: [m.x, m.y, m.z],
      anchorAt: t,
      path: [],
      repath: 0,
      reached: -1,
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
    const host = this.host;
    this.noises.update(TICK);
    this.grenades.update();
    this.calls.deliver(host.time, (c) => {
      for (const [id, b] of this.brains) if (id !== c.caller && this.side(host.players.get(id)) === c.team) believe(b, c.enemy, c.life, c.at, CALL_ERR, host.time, host.time, false);
    });
    if (host.settings.mode === 'solo') this.scout();
    for (const [id, brain] of this.brains) {
      const bot = host.players.get(id);
      if (!bot) {
        this.brains.delete(id);
        continue;
      }
      const cmd = this.decide(bot, brain);
      host.applyCommand(id, cmd);
    }
  }

  private decide(bot: PlayerState, b: Brain): Command {
    const host = this.host;
    const prof = botProfile(bot);
    b.seq++;
    const cmd: Command = { seq: b.seq, forward: 0, right: 0, yaw: b.aimYaw, pitch: b.aimPitch, buttons: 0, slot: b.slot, viewTime: host.time, life: bot.life };
    const m = bot.move;
    const hits = this.hits.get(bot.id);
    this.hits.delete(bot.id);
    if (!bot.alive) {
      // It comes back somewhere else with nothing in sight: what it was after died with it.
      b.path = [];
      this.sense.forget(b);
      b.beliefs.clear();
      b.glance = null;
      b.patrol = null;
      b.escape = null;
      b.anchor = [m.x, m.y, m.z];
      b.anchorAt = host.time;
      return cmd;
    }
    if (b.life !== bot.life) this.newLife(bot, b);
    const skill = b.skill ?? this.skill;
    const eye = host.eye(bot);
    if (hits) this.sense.feelHits(bot, b, hits, skill);
    b.think -= TICK;
    if (b.think <= 0) {
      b.think = 0.15 + this.random() * 0.1;
      prune(b, host.time, (id) => {
        const p = host.players.get(id);
        return p?.alive ? p.life : null;
      });
      this.sense.hear(bot, b, eye, listen(host, this.noises, bot, eye, b, () => this.random()), skill);
      const team = this.side(bot);
      for (const p of this.sense.perceive(bot, b, eye, prof, skill)) if (team !== null) this.calls.call(bot.id, team, p.id, p.life, [p.move.x, p.move.y, p.move.z], host.time);
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
      // Whatever it was walking to can't be reached or held nobody: give it up and go somewhere else.
      b.beliefs.delete(b.hunt);
      this.roam.patrol(bot, b);
      b.anchorAt = host.time;
    }
    const run = this.grenades.dodge(bot, b, skill, () => this.random());

    let goal: Spot | null = null;
    /** The enemy a close-range bot's route keeps out of the sight of. */
    let watcher: Spot | null = null;
    if (visible && target) {
      b.seenFor += TICK;
      b.glance = null;
      // A fill bot fights the way the gun in its hands wants; a snapbot has one way.
      const gun = bot.character === bot.bot ? prof : botProfile(bot, bot.arms.weapon);
      // A Scopebot lines up one deliberate shot: its aim trails a moving target half as far.
      const aim = this.sense.aimPoint(target, this.lag * (bot.bot === 'sniper' ? 0.5 : 1), gun.patient);
      const { dist, offAim } = turnTo(b, eye, aim, prof, skill);
      b.errYaw *= 0.985 - skill * 0.02;
      b.errPitch *= 0.985 - skill * 0.02;
      if (prof.sidearm) b.slot = kitSlot(prof.sidearm, b.slot, dist);
      const ready = b.seenFor > Math.max(MIN_AIM, prof.reaction * (1.3 - skill * 0.6) - b.noticeTook);
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
        const { dist } = turnTo(b, eye, [seen[0], seen[1] + 1.2, seen[2]], prof, skill);
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
    else {
      const hunted = b.beliefs.has(b.hunt) ? b.huntAt : null;
      const watch = !visible && !lost && hunted && Math.hypot(hunted[0] - m.x, hunted[2] - m.z) < WATCH ? hunted : null;
      const steer = this.nav.navigate(bot, b, goal, watcher, prof.standoff ? SPOT_REACH : 1);
      look(host, this.roam, bot, b, steer, visible, lost, watch, cmd);
    }
    b.sidestep = Math.max(0, b.sidestep - TICK);
    this.nav.unstick(bot, b, cmd);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.lob > 0 ? b.lobPitch : Math.max(-1.2, Math.min(1.2, b.aimPitch));
    b.lob = Math.max(0, b.lob - 1);
    this.nav.keepOnGround(bot, b, cmd);
    return cmd;
  }

  /** A fresh life: last life's grudges are gone, and a team bot takes the flank fewest living teammates are on. */
  private newLife(bot: PlayerState, b: Brain) {
    b.life = bot.life;
    // It looks the way it came in facing, not the way it looked when it fell.
    b.aimYaw = bot.yaw;
    b.aimPitch = 0;
    b.glance = null;
    b.hurtAt.clear();
    b.noticed.clear();
    b.inView.clear();
    b.hunt = 0;
    b.heardUpTo = this.host.time;
    b.lane = pickLane(this.host, bot, b, this.brains, () => this.random());
    b.post = null;
    b.postRest = 0;
  }

  /** Out of a fight a kit with a sidearm for far fights carries it while the enemy it hunts is believed well beyond its primary's reach. */
  private huntingSlot(bot: PlayerState, b: Brain, prof: BotProfile) {
    const far = prof.sidearm?.far;
    const enemy = far === undefined ? undefined : b.beliefs.get(b.hunt);
    return enemy && Math.hypot(enemy.at[0] - bot.move.x, enemy.at[2] - bot.move.z) > far! + HUNT_SLACK ? 1 : 0;
  }

  /** Nobody in sight: where to go for the enemy it believes in (a fill bot to a spot in its band, from its flank). */
  private hunt(bot: PlayerState, b: Brain, prof: BotProfile, closer: boolean, chose: (enemy: Spot) => void): Spot | null {
    const enemy = huntTarget(this.host, bot, b, this.brains, closer);
    if (!enemy) return null;
    chose(enemy);
    const post = prof.patient ? this.roam.perch(bot, b, enemy, prof.band) : null;
    if (post) return post;
    return prof.standoff ? this.roam.standoff(bot, b, enemy, prof.band, prof.range, this.roam.flank(bot, b.lane, enemy)) : this.roam.approach(bot, b, enemy, prof.range);
  }

  /** Solo: a wave that has had no news of a player for SCOUT.after s is told roughly where the player is. */
  private scout() {
    const now = this.host.time;
    for (const p of this.host.players.values()) {
      if (p.bot || !p.alive) continue;
      let news = this.news.get(p.id) ?? now;
      for (const b of this.brains.values()) {
        const bel = b.beliefs.get(p.id);
        if (bel && bel.life === p.life) news = Math.max(news, bel.time);
      }
      if (now - news > SCOUT.after && this.brains.size) {
        const r = SCOUT.err * this.random();
        const a = this.random() * Math.PI * 2;
        const at: Spot = [p.move.x + Math.sin(a) * r, p.move.y, p.move.z + Math.cos(a) * r];
        for (const b of this.brains.values()) believe(b, p.id, p.life, at, SCOUT.err, now, now, false);
        news = now;
      }
      this.news.set(p.id, news);
    }
  }

  /** Whose calls a bot hears: its team's in team matches, every snapbot's in solo (one squad), nobody's in free-for-all. */
  private side(p: PlayerState | undefined): number | null {
    if (!p) return null;
    if (p.team >= 0) return p.team;
    return this.host.settings.mode === 'solo' && p.bot ? -2 : null;
  }

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

/** How fast (m/s) `target` is coming at `bot` in plan. */
function closingSpeed(bot: PlayerState, target: PlayerState) {
  const dx = bot.move.x - target.move.x;
  const dz = bot.move.z - target.move.z;
  const d = Math.hypot(dx, dz);
  return d < 1e-3 ? 0 : (target.move.vx * dx + target.move.vz * dz) / d;
}

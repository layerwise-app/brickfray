import { WEAPONS } from '../weapons/defs';
import { believe, type BeliefState } from './bot-belief';
import type { Heard } from './bot-ears';
import { GRACE, HEAD_ABOVE_CHEST } from './bot-fight';
import type { BotProfile } from './bot-profile';
import type { Spot } from './bot-roam';
import { PLAYER } from './constants';
import type { DamageSource, HostSim } from './host';
import type { PlayerState } from './types';

/** What a bot knows of its enemies: who it fights, what it believes of the others, its aim error, and who hurt it. */
export interface SenseState extends BeliefState {
  target: number;
  seenFor: number;
  lostFor: number;
  lastSeen: Spot | null;
  errYaw: number;
  errPitch: number;
  /** Seconds to the next look round. */
  think: number;
  /** Host time each enemy last hurt it this life. */
  hurtAt: Map<number, number>;
  /** Enemy → host time it came into view and has stayed in view since (noticed or not yet). */
  inView: Map<number, number>;
  /** Host time of the last look round. */
  looked: number;
  /** Seconds it took to notice the target: its fire delay counts from first sight, not from noticing. */
  noticeTook: number;
}

/**
 * The player's view: 90 deg across (game/settings fov), narrowed as the camera narrows it while aiming down sights
 * (fov / (1 + (zoom - 1) * ads)), on a 16:9 screen. A bot sees nothing outside it.
 */
export const VIEW = { half: Math.PI / 4, aspect: 16 / 9 };
/**
 * How far (m) a person notices a figure in that view: one standing still 40 m (a Megabot's size further); moving x1.4,
 * crouched x0.6, firing (muzzle flash, within `firingFor` s of a shot) x2.5; a magnified view (aimed scope) stretches
 * it by its zoom.
 */
export const NOTICE = { still: 40, moving: 1.4, crouched: 0.6, firing: 2.5, firingFor: 0.3 };
/**
 * Seconds to notice a figure: `slow` at skill 0 to `quick` at 1, up to `edge` longer at the edge of the view and
 * `far` longer at the limit of `NOTICE`; an enemy it just lost sight of is picked up again in `again` s, one where it
 * expects it (a sound or a call from that way) in `expected` of the time.
 */
export const REACTION = { slow: 0.45, quick: 0.25, edge: 0.8, far: 0.5, again: 0.1, expected: 0.6 };
/** A believed spot this near (m), in view with a clear line and seen empty, is given up: the enemy moved on. */
const CHECK = 20;
/** A bot trading shots with an enemy that hurt it this recently (s) finishes that fight before turning to a new attacker. */
const TRADING = 1.5;
/** A fill bot fights an enemy that hurt it this recently (s) out to `range` m, past its gun's reach: it shoots back. */
const RETURN_FIRE = { within: 3, range: 50 };
/**
 * Being hit tells the direction of the shot to within `spread` rad (the damage indicator), not who or how far: with
 * nothing better the shooter is guessed `guess` m off, give or take `err`. It turns to look `react` s later, swinging
 * round at `turn` rad/s as a hit player whips round, not at the pace it looks about.
 */
const HIT = { spread: 0.12, guess: 20, err: 12, react: [0.2, 0.35] as const, look: 1.2, turn: 9 };
/**
 * A heard sound gives a bearing to within `spread` rad and a distance to within `range` of itself: a shot is placed
 * better than a step, a sound through a wall worse (it comes round the opening, muffled and seeming farther), several
 * at once better. It acts on one `react` s later (by skill), and turns to look at one out of view within `look` m.
 * A sound `muffled` or more behind solid world is placed somewhere out of the bot's sight.
 */
const SOUND = { spread: { shot: 0.08, body: 0.2 }, range: { shot: 0.2, body: 0.35 }, wall: 1.5, react: [0.9, 0.4] as const, look: 25, glance: 0.9, muffled: 0.5 };
/** The first shots after swinging onto a target miss by up to this much more per radian turned. */
const TURN_MISS = 0.35;

/** Bot senses: sight (view cone, line, distance, time to notice), hearing, being hit, and settling on a target. */
export class BotSense {
  constructor(
    private readonly host: HostSim,
    private readonly random: () => number
  ) {}

  /** Chest (or head) height of `target` as it stood `lag` seconds ago. */
  aimPoint(target: PlayerState, lag = 0, head = false): [number, number, number] {
    const at = lag > 0 ? this.host.poseAt(target, this.host.time - lag) : null;
    const m = at ?? target.move;
    const eyes = m.y + (PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * m.crouch) * target.scale;
    return [m.x, head ? eyes : eyes - HEAD_ABOVE_CHEST * target.scale, m.z];
  }

  /**
   * Look round: enemies in the view cone with a clear line, near enough to notice, are noticed after the reaction
   * time; the nearest noticed one within reach becomes the target. Spots it believed in and now sees empty are given
   * up. Returns the enemies it has noticed (for its team's calls).
   */
  perceive(bot: PlayerState, b: SenseState, eye: readonly number[], prof: BotProfile, skill: number): PlayerState[] {
    const host = this.host;
    const now = host.time;
    const elapsed = now - b.looked;
    b.looked = now;
    const half = viewHalf(bot);
    const zoom = 1 + (WEAPONS[bot.arms.weapon].zoom - 1) * bot.arms.ads;
    const fill = bot.character !== bot.bot;
    const noticed: PlayerState[] = [];
    let best: PlayerState | null = null;
    let bestScore = Infinity;
    let took = 0;
    let due = Infinity;
    for (const p of host.players.values()) {
      if (!p.alive || !host.hostile(bot, p) || !this.inSight(bot, eye, p, half, zoom)) {
        b.inView.delete(p.id);
        continue;
      }
      const since = b.inView.get(p.id) ?? now;
      b.inView.set(p.id, since);
      const need = this.needed(bot, b, eye, p, half, zoom, skill);
      if (now - since < need) {
        due = Math.min(due, since + need);
        continue;
      }
      noticed.push(p);
      believe(b, p.id, p.life, [p.move.x, p.move.y, p.move.z], 0.3, now, now, true, p.arms.sinceShot < NOTICE.firingFor);
      const d = Math.hypot(p.move.x - eye[0]!, p.move.z - eye[2]!);
      const shotAt = fill && now - (b.hurtAt.get(p.id) ?? -99) < RETURN_FIRE.within;
      if (d > (shotAt ? Math.max(prof.range, RETURN_FIRE.range) : prof.range)) continue;
      const score = d - (p.id === b.target ? 6 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p;
        took = now - since;
      }
    }
    if (due < Infinity) b.think = Math.min(b.think, due - now + 1e-3);
    if (best) {
      if (best.id !== b.target) this.lockOn(b, best.id, prof, skill, Math.abs(wrap(yawTo(eye, best.move) - bot.yaw)), took);
      b.lostFor = 0;
      b.lastSeen = [best.move.x, best.move.y, best.move.z];
    } else if (b.target) {
      b.lostFor += elapsed;
      if (b.lostFor > 4) this.forget(b);
    }
    this.check(bot, b, eye, half, zoom);
    return noticed;
  }

  /** Hits taken since the last tick: the direction they came from becomes a rough belief, and it turns to look. */
  feelHits(bot: PlayerState, b: SenseState, hits: readonly DamageSource[], skill: number) {
    const now = this.host.time;
    const eye = this.host.eye(bot);
    for (const hit of hits) {
      const attacker = this.host.players.get(hit.attacker);
      if (!attacker || attacker.id === bot.id || !this.host.hostile(bot, attacker)) continue;
      b.hurtAt.set(attacker.id, now);
      // A blast points at the grenade, not at whoever threw it.
      if (hit.weapon === 'grenade') continue;
      const yaw = yawTo(eye, { x: hit.from[0], z: hit.from[2] }) + (this.random() - 0.5) * 2 * HIT.spread;
      const known = b.beliefs.get(attacker.id);
      const along = known && known.life === attacker.life && now - known.time < 4 ? Math.hypot(known.at[0] - eye[0], known.at[2] - eye[2]) : 0;
      const d = along > 1 ? along : HIT.guess;
      const react = now + HIT.react[1] - (HIT.react[1] - HIT.react[0]) * skill;
      believe(b, attacker.id, attacker.life, [eye[0] - Math.sin(yaw) * d, bot.move.y, eye[2] - Math.cos(yaw) * d], along > 1 ? Math.max(known!.err, d * HIT.spread) : HIT.err, now, react, false);
      if (b.target === attacker.id && b.lostFor === 0) continue;
      if (b.target && b.lostFor === 0 && now - (b.hurtAt.get(b.target) ?? -99) < TRADING) continue;
      b.glance = { yaw, from: react, until: react + HIT.look, turn: HIT.turn };
      b.think = Math.min(b.think, react - now);
    }
  }

  /**
   * Sounds heard: each a bearing and a rough distance, so a believed spot with an error; one out of view and near
   * turns the bot to look after a moment (not while it fights).
   */
  hear(bot: PlayerState, b: SenseState, eye: readonly number[], heard: readonly Heard[], skill: number) {
    const now = this.host.time;
    const half = viewHalf(bot);
    for (const h of heard) {
      const enemy = this.host.players.get(h.source);
      if (!enemy) continue;
      const n = h.noise;
      const shot = n.kind === 'shot';
      const sure = Math.sqrt(Math.min(h.count, 4));
      const spread = ((shot ? SOUND.spread.shot : SOUND.spread.body) * (1 + SOUND.wall * h.occlusion)) / sure;
      const range = ((shot ? SOUND.range.shot : SOUND.range.body) * (1 + h.occlusion)) / sure;
      const yaw = yawTo(eye, n) + (this.random() - 0.5) * 2 * spread * 1.7;
      const plan = Math.hypot(n.x - eye[0]!, n.z - eye[2]!);
      const d = plan * (1 + 0.25 * h.occlusion) * (1 + (this.random() - 0.5) * 2 * range * 1.7);
      const react = now + SOUND.react[0] - (SOUND.react[0] - SOUND.react[1]) * skill;
      const err = plan * (spread + range);
      let spot: Spot = [eye[0]! - Math.sin(yaw) * d, n.ground, eye[2]! - Math.cos(yaw) * d];
      // A muffled sound came from somewhere out of sight: the nearest such place to where it seemed to be.
      if (h.occlusion >= SOUND.muffled) spot = this.outOfSight(eye, spot, err) ?? spot;
      believe(b, h.source, enemy.life, spot, err, now, react, false, shot, plan);
      const fighting = b.target !== 0 && b.lostFor <= GRACE;
      if (!fighting && !b.glance && plan < SOUND.look && Math.abs(wrap(yaw - bot.yaw)) > half) b.glance = { yaw, from: react, until: react + SOUND.glance };
    }
  }

  forget(b: SenseState) {
    b.target = 0;
    b.seenFor = 0;
    b.lostFor = 99;
    b.lastSeen = null;
  }

  /** The waypoint nearest `at` (within `reach` m, about its floor) that the eye has no line to. */
  private outOfSight(eye: readonly number[], at: Spot, reach: number): Spot | null {
    const near: [number, Spot][] = [];
    for (const w of this.host.layout.waypoints) {
      const p = w.position;
      const d = Math.hypot(p[0] - at[0], p[2] - at[2]);
      if (d <= Math.max(reach, 4) && Math.abs(p[1] - at[1]) < 3) near.push([d, p]);
    }
    near.sort((a, c) => a[0] - c[0]);
    for (const [, p] of near.slice(0, 12)) if (!this.host.world.clearLine(eye[0]!, eye[1]!, eye[2]!, p[0], p[1] + 1.2, p[2])) return [p[0], p[1], p[2]];
    return null;
  }

  /** In the view cone (and its height), near enough to notice, with a clear line to the chest or the head. */
  private inSight(bot: PlayerState, eye: readonly number[], p: PlayerState, half: number, zoom: number) {
    const chest = this.aimPoint(p);
    const dx = chest[0] - eye[0]!;
    const dz = chest[2] - eye[2]!;
    const d = Math.hypot(dx, dz);
    if (d > noticeReach(p) * zoom || Math.abs(wrap(Math.atan2(-dx, -dz) - bot.yaw)) > half) return false;
    const head = chest[1] + HEAD_ABOVE_CHEST * p.scale;
    const up = Math.atan(Math.tan(half) / VIEW.aspect);
    const pitch = (y: number) => Math.abs(Math.atan2(y - eye[1]!, d) - bot.pitch) <= up;
    const world = this.host.world;
    return (pitch(chest[1]) && world.clearLine(eye[0]!, eye[1]!, eye[2]!, chest[0], chest[1], chest[2])) || (pitch(head) && world.clearLine(eye[0]!, eye[1]!, eye[2]!, chest[0], head, chest[2]));
  }

  /** Seconds `p` must stay in view to be noticed (see REACTION). */
  private needed(bot: PlayerState, b: SenseState, eye: readonly number[], p: PlayerState, half: number, zoom: number, skill: number) {
    if (p.id === b.target && b.lostFor <= GRACE) return 0;
    const now = this.host.time;
    const yaw = yawTo(eye, p.move);
    const d = Math.hypot(p.move.x - eye[0]!, p.move.z - eye[2]!);
    const off = Math.abs(wrap(yaw - bot.yaw)) / half;
    let need = (REACTION.slow - (REACTION.slow - REACTION.quick) * skill) * (1 + REACTION.edge * off * off) * (1 + (REACTION.far * d) / (noticeReach(p) * zoom));
    const known = b.beliefs.get(p.id);
    if (!known || known.life !== p.life) return need;
    if (known.seen && now - known.time < 1.5 && Math.hypot(known.at[0] - p.move.x, known.at[2] - p.move.z) < 3) return REACTION.again;
    if (now - known.time < 2 && Math.abs(wrap(yawTo(eye, { x: known.at[0], z: known.at[2] }) - yaw)) < 0.35) need *= REACTION.expected;
    return need;
  }

  /** Believed spots in plain view near by, with nobody noticed there, are given up. */
  private check(bot: PlayerState, b: SenseState, eye: readonly number[], half: number, zoom: number) {
    const now = this.host.time;
    for (const [id, bel] of b.beliefs) {
      if (b.inView.has(id) || now - bel.time < 0.5) continue;
      const [x, y, z] = bel.at;
      const d = Math.hypot(x - eye[0]!, z - eye[2]!);
      if (d > Math.min(CHECK, NOTICE.still * zoom) || Math.abs(wrap(yawTo(eye, { x, z }) - bot.yaw)) > half) continue;
      if (this.host.world.clearLine(eye[0]!, eye[1]!, eye[2]!, x, y + 1.2, z)) b.beliefs.delete(id);
    }
  }

  /** Fix on an enemy: a bot already in a fight swings onto the next one faster than it notices a first; a big turn first costs aim. */
  private lockOn(b: SenseState, id: number, prof: BotProfile, skill: number, turn: number, took: number) {
    const inFight = b.target !== 0 && b.lostFor <= GRACE;
    b.target = id;
    b.seenFor = inFight ? Math.min(b.seenFor, prof.reaction * 0.5) : 0;
    b.noticeTook = inFight ? 0 : took;
    const miss = ((1 - skill) * 0.25 + 0.03) * (1 + TURN_MISS * Math.min(turn, Math.PI));
    b.errYaw = (this.random() - 0.5) * miss * 2;
    b.errPitch = (this.random() - 0.5) * miss;
  }
}

/** Half the bot's view across (rad), narrowed while aiming down sights as the player's camera is. */
export function viewHalf(bot: PlayerState) {
  return VIEW.half / (1 + (WEAPONS[bot.arms.weapon].zoom - 1) * bot.arms.ads);
}

/** How far (m) a person notices `p` with the hip view (see NOTICE). */
export function noticeReach(p: PlayerState) {
  const m = p.move;
  const moving = Math.hypot(m.vx, m.vz) > 1.2;
  return NOTICE.still * p.scale * (moving ? NOTICE.moving : 1) * (m.crouch > 0.5 ? NOTICE.crouched : 1) * (p.arms.sinceShot < NOTICE.firingFor ? NOTICE.firing : 1);
}

const yawTo = (eye: readonly number[], at: { x: number; z: number }) => Math.atan2(-(at.x - eye[0]!), -(at.z - eye[2]!));

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

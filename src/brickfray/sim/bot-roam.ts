import { nearestWaypoint } from './bot-nav';
import { PLAYER } from './constants';
import type { HostSim } from './host';
import type { PlayerState } from './types';

export type Spot = [number, number, number];

/** Where a bot heads while no enemy is in sight. */
export interface RoamState {
  path: number[];
  /** Where the target was last seen, walked to after losing sight of it; forgotten on death and on getting there. */
  lastSeen: Spot | null;
  /** Somewhere to go while there is nobody to hunt, followed until host time `patrolUntil`. */
  patrol: Spot | null;
  patrolUntil: number;
  /** The last `approach` worked out: the enemy spot it was for, when, and where it said to go. */
  approach: { for: Spot; at: number; spot: Spot } | null;
}

/** Closer than this (m, in plan, same floor) a bot has reached a spot. */
export const HEADWAY = 1.5;
/** Seconds a patrol goal is followed before the bot goes back to hunting. */
const PATROL = 20;
/** A sighting this recent (s) marks the last known fight, a place worth patrolling to. */
const FIGHT_FRESH = 15;
/** A waypoint this far (m) above the map's usual walking level is a high post: a wall walk, a bridge, a terrace. */
const HIGH = 2;
/** Share of patrols that head for a high post rather than a spawn or the last fight. */
const HIGH_SHARE = 0.3;
/** An enemy this far (m) across or this far above or below the nearest waypoint stands where the graph can't take a bot. */
const OFF_GRAPH = { across: 4, up: 1.5 };

/** Bot goals out of a fight: the last sighting, a patrol, or the nearest enemy; never nothing for long. */
export class BotRoam {
  /** The latest place any bot saw an enemy. */
  private fight: { at: Spot; time: number } | null = null;

  constructor(
    private readonly host: HostSim,
    private readonly random: () => number
  ) {}

  saw(at: Spot) {
    this.fight = { at, time: this.host.time };
  }

  /** The last sighting until it is reached, a patrol while one runs, else whatever `hunt` finds, else a new patrol. */
  goal(bot: PlayerState, b: RoamState, hunt: () => Spot | null): Spot | null {
    const m = bot.move;
    const at = (p: Spot) => Math.hypot(p[0] - m.x, p[2] - m.z) < HEADWAY && Math.abs(p[1] - m.y) < 1.2;
    if (b.lastSeen && at(b.lastSeen)) b.lastSeen = null;
    if (b.lastSeen) return b.lastSeen;
    if (b.patrol && (this.host.time > b.patrolUntil || at(b.patrol))) b.patrol = null;
    return b.patrol ?? hunt() ?? this.patrol(bot, b);
  }

  /** Head for the other team's spawns (any spawn in free-for-all), a high post or the last known fight, away from here. */
  patrol(bot: PlayerState, b: RoamState): Spot | null {
    const m = bot.move;
    const away = (p: Spot) => Math.hypot(p[0] - m.x, p[2] - m.z) > 10 && p !== b.patrol;
    const spawns = this.host.layout.spawns;
    const theirs = spawns.filter((s) => bot.team >= 0 && s.team !== undefined && s.team !== bot.team);
    const spots = (theirs.length ? theirs : spawns).map((s) => s.position).filter(away);
    if (this.fight && this.host.time - this.fight.time < FIGHT_FRESH && away(this.fight.at)) spots.push(this.fight.at);
    const posts = this.highPosts().filter(away);
    const pool = posts.length && this.random() < HIGH_SHARE ? posts : spots;
    b.lastSeen = null;
    b.path = [];
    b.patrol = pool.length ? pool[Math.floor(this.random() * pool.length)]! : null;
    b.patrolUntil = this.host.time + PATROL;
    return b.patrol;
  }

  /**
   * Where to go for an enemy out of sight: where it stands, or, when that is off the waypoint graph (a roof, a keep
   * top), a waypoint near the bot with a clear shot at it.
   */
  approach(bot: PlayerState, b: RoamState, enemy: Spot, range: number): Spot {
    const last = b.approach;
    if (last && this.host.time - last.at < 1.5 && Math.hypot(last.for[0] - enemy[0], last.for[1] - enemy[1], last.for[2] - enemy[2]) < 1.5) return last.spot;
    const spot = this.firingSpot(bot, enemy, range);
    b.approach = { for: enemy, at: this.host.time, spot };
    return spot;
  }

  private firingSpot(bot: PlayerState, enemy: Spot, range: number): Spot {
    const wps = this.host.layout.waypoints;
    if (!wps.length) return enemy;
    const n = wps[nearestWaypoint(wps, enemy[0], enemy[1], enemy[2])]!.position;
    if (Math.hypot(n[0] - enemy[0], n[2] - enemy[2]) < OFF_GRAPH.across && Math.abs(n[1] - enemy[1]) < OFF_GRAPH.up) return enemy;
    const m = bot.move;
    let best: Spot = enemy;
    let bestD = Infinity;
    for (const w of wps) {
      const [x, y, z] = w.position;
      if (Math.hypot(x - enemy[0], z - enemy[2]) > range) continue;
      // Near the bot, and nearer the enemy where that costs little.
      const d = Math.hypot(x - m.x, y - m.y, z - m.z) + 0.5 * Math.hypot(x - enemy[0], z - enemy[2]);
      if (d >= bestD || !this.host.world.clearLine(x, y + PLAYER.eye, z, enemy[0], enemy[1] + 1.2, enemy[2])) continue;
      best = w.position;
      bestD = d;
    }
    return best;
  }

  private posts: Spot[] | null = null;

  /** Waypoints well above the map's usual walking level, found once. */
  private highPosts(): Spot[] {
    if (!this.posts) {
      const ys = this.host.layout.waypoints.map((w) => w.position[1]).sort((a, b) => a - b);
      const ground = ys[Math.floor(ys.length / 2)] ?? 0;
      this.posts = this.host.layout.waypoints.map((w) => w.position).filter((p) => p[1] > ground + HIGH);
    }
    return this.posts;
  }
}

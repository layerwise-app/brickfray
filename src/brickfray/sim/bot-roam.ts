import { nearestWaypoint } from './bot-nav';
import type { Band } from './bot-profile';
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
/** How far (m) to the side of an enemy a flanking bot aims to come from. */
const FLANK = 18;
/** How much (per m) a flanking bot will walk farther to come from its flank. */
const FLANK_PULL = 1.5;
/** Cheapest standoff spots tried for a line on the enemy, per look. */
const TRIES = 48;

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

  /**
   * The last sighting (or the spot `toward` picks for it) until it is reached, a patrol while one runs, else whatever
   * `hunt` finds, else a new patrol.
   */
  goal(bot: PlayerState, b: RoamState, hunt: () => Spot | null, toward = (seen: Spot) => seen): Spot | null {
    const m = bot.move;
    const at = (p: Spot) => Math.hypot(p[0] - m.x, p[2] - m.z) < HEADWAY && Math.abs(p[1] - m.y) < 1.2;
    if (b.lastSeen) {
      const spot = toward(b.lastSeen);
      if (at(spot) || at(b.lastSeen)) b.lastSeen = null;
      else return spot;
    }
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

  /**
   * `approach` for a bot that fights from its band: a waypoint inside the band with a line on the enemy, taken from the
   * `flank` side when it has one. A spot that still holds is kept: no hopping between two equally good ones.
   */
  standoff(bot: PlayerState, b: RoamState, enemy: Spot, band: Band, range: number, flank: Spot | null): Spot {
    const last = b.approach;
    if (last && this.host.time - last.at < 1.5 && Math.hypot(last.for[0] - enemy[0], last.for[1] - enemy[1], last.for[2] - enemy[2]) < 1.5) return last.spot;
    const keep = last && last.spot !== last.for && this.holds(last.spot, enemy, band);
    const spot = keep ? last.spot : this.standoffSpot(bot, enemy, band, range, flank);
    b.approach = { for: enemy, at: this.host.time, spot };
    return spot;
  }

  /** In team matches, the point `FLANK` m to the bot's lane side of an enemy, across the line from its team's spawns. */
  flank(bot: PlayerState, lane: number, enemy: Spot): Spot | null {
    if (bot.team < 0 || lane === 0) return null;
    const home = this.home(bot.team);
    if (!home) return null;
    const ax = enemy[0] - home[0];
    const az = enemy[2] - home[1];
    const len = Math.hypot(ax, az);
    if (len < 1) return null;
    return [enemy[0] - (az / len) * lane * FLANK, enemy[1], enemy[2] + (ax / len) * lane * FLANK];
  }

  private homes = new Map<number, [number, number] | null>();

  private home(team: number) {
    if (!this.homes.has(team)) {
      const own = this.host.layout.spawns.filter((s) => s.team === team);
      this.homes.set(team, own.length ? [own.reduce((a, s) => a + s.position[0], 0) / own.length, own.reduce((a, s) => a + s.position[2], 0) / own.length] : null);
    }
    return this.homes.get(team)!;
  }

  private sees(p: Spot, enemy: Spot) {
    return this.host.world.clearLine(p[0], p[1] + PLAYER.eye, p[2], enemy[0], enemy[1] + 1.2, enemy[2]);
  }

  private holds(p: Spot, enemy: Spot, band: Band) {
    const d = Math.hypot(p[0] - enemy[0], p[2] - enemy[2]);
    return d >= band.min && d <= band.max && this.sees(p, enemy);
  }

  /**
   * A waypoint inside the bot's band from the enemy with a line on it: near the bot, near the middle of the band and,
   * when flanking, near the flank point. A close-range gun with no such spot walks straight in.
   */
  private standoffSpot(bot: PlayerState, enemy: Spot, band: Band, range: number, flank: Spot | null): Spot {
    const { min, max } = band;
    const mid = (min + max) / 2;
    const m = bot.move;
    const scored: [number, Spot][] = [];
    for (const w of this.host.layout.waypoints) {
      const [x, y, z] = w.position;
      const d = Math.hypot(x - enemy[0], z - enemy[2]);
      if (d < min || d > max) continue;
      const cost = Math.hypot(x - m.x, y - m.y, z - m.z) + 0.3 * Math.abs(d - mid) + (flank ? FLANK_PULL * Math.hypot(x - flank[0], z - flank[2]) : 0);
      scored.push([cost, w.position]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(TRIES, scored.length); i++) if (this.sees(scored[i]![1], enemy)) return scored[i]![1];
    return this.firingSpot(bot, enemy, min === 0 ? range : max);
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

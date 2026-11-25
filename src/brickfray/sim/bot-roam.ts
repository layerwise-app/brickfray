import { findPath, nearestWaypoint, routeTree } from './bot-nav';
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
  /** A long gun's high post (see `perch`): where, the host time to be on it by, and since when it is on it (-1 not yet). */
  post: { spot: Spot; by: number; on: number } | null;
  /** Host time until which it takes no post. */
  postRest: number;
}

/** Closer than this (m, in plan, same floor) a bot has reached a spot. */
export const HEADWAY = 1.5;
/** Seconds a patrol goal is followed before the bot goes back to hunting. */
const PATROL = 20;
/** A waypoint this far (m) above the map's usual walking level is a high post: a wall walk, a bridge, a terrace. */
const HIGH = 2;
/**
 * Where a bot with nobody to go for patrols: mostly the map's meeting places (the `count` waypoints most routes
 * between spawns pass, `spacing` m apart); `high` of the time a high post; in team matches `theirs` of the time the
 * way into the other team's spawns.
 */
const PATROLS = { count: 14, spacing: 12, high: 0.25, theirs: 0.2 };
/** A corner check looks down the longest clear view from a waypoint, among waypoints within `reach` m (every `every`th). */
const VIEWS = { reach: 60, every: 3 };
/** An enemy this far (m) across or this far above or below the nearest waypoint stands where the graph can't take a bot. */
const OFF_GRAPH = { across: 4, up: 1.5 };
/** How far (m) to the side of an enemy a flanking bot aims to come from. */
const FLANK = 18;
/** How much (per m) a flanking bot will walk farther to come from its flank. */
const FLANK_PULL = 1.5;
/** Cheapest standoff spots tried for a line on the enemy, per look. */
const TRIES = 48;
/**
 * A long gun hunting takes a high post within a `reach` m walk when one stands about its band from the enemy (`tries`
 * nearest looked up on the graph); it gives up on one not reached in time, holds one `hold` s at most, then takes none
 * for `rest` s, so it never camps.
 */
const PERCH = { reach: 60, tries: 6, hold: 20, rest: 20, retry: 3 };

/** Bot goals out of a fight: the last sighting, a patrol, or what it believes of an enemy; never nothing for long. */
export class BotRoam {
  constructor(
    private readonly host: HostSim,
    private readonly random: () => number
  ) {}

  /**
   * The last sighting (or the spot `toward` picks for it) until it is reached, else whatever `hunt` finds (news of an
   * enemy breaks off a patrol), else the patrol under way, else a new one.
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
    return hunt() ?? b.patrol ?? this.patrol(bot, b);
  }

  /** Head for one of the map's meeting places, a high post or (team matches) the other team's side, away from here. */
  patrol(bot: PlayerState, b: RoamState): Spot | null {
    const m = bot.move;
    const away = (p: Spot) => Math.hypot(p[0] - m.x, p[2] - m.z) > 10 && p !== b.patrol;
    const spawns = this.host.layout.spawns;
    const theirs = spawns.filter((s) => bot.team >= 0 && s.team !== undefined && s.team !== bot.team).map((s) => s.position).filter(away);
    const posts = this.highPosts().filter(away);
    const hubs = this.hubs().filter(away);
    const r = this.random();
    const pool = posts.length && r < PATROLS.high ? posts : theirs.length && r < PATROLS.high + PATROLS.theirs ? theirs : hubs.length ? hubs : spawns.map((s) => s.position).filter(away);
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

  /**
   * A long gun's high post while it hunts `enemy` (see `PERCH`): the nearest lookout about its band from the enemy, held
   * until it has stood there long enough; null when it is resting from one or none is near.
   */
  perch(bot: PlayerState, b: RoamState, enemy: Spot, band: Band): Spot | null {
    const now = this.host.time;
    if (now < b.postRest) return null;
    const m = bot.move;
    const post = b.post;
    if (post) {
      if (post.on < 0 && Math.hypot(post.spot[0] - m.x, post.spot[2] - m.z) < HEADWAY && Math.abs(post.spot[1] - m.y) < 1.2) post.on = now;
      if (post.on < 0 ? now < post.by : now - post.on < PERCH.hold) {
        // Facing the enemy it hunts once up there (see BotDirector.steer).
        b.approach = { for: enemy, at: now, spot: post.spot };
        return post.spot;
      }
      b.post = null;
      b.approach = null;
      b.postRest = now + PERCH.rest;
      return null;
    }
    const wps = this.host.layout.waypoints;
    const mid = (band.min + band.max) / 2;
    const near: [number, number][] = [];
    for (const i of this.lookouts()) {
      const p = wps[i]!.position;
      const d = Math.hypot(p[0] - enemy[0], p[2] - enemy[2]);
      const plan = Math.hypot(p[0] - m.x, p[2] - m.z);
      if (plan <= PERCH.reach && d >= band.min && d <= band.max + 10) near.push([plan + 0.3 * Math.abs(d - mid), i]);
    }
    near.sort((a, c) => a[0] - c[0]);
    const from = nearestWaypoint(wps, m.x, m.y, m.z);
    let best: { spot: Spot; walk: number; cost: number } | null = null;
    for (const [, i] of near.slice(0, PERCH.tries)) {
      let walk = 0;
      let at = from;
      const route = findPath(wps, from, i);
      for (const n of route) {
        const p = wps[at]!.position;
        const q = wps[n]!.position;
        walk += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        at = n;
      }
      const spot = wps[i]!.position;
      const cost = walk + 0.3 * Math.abs(Math.hypot(spot[0] - enemy[0], spot[2] - enemy[2]) - mid);
      if (at === i && walk <= PERCH.reach && (!best || cost < best.cost)) best = { spot, walk, cost };
    }
    // Time to walk there (with room for a fight on the way) before it gives up on the post.
    if (best) b.post = { spot: best.spot, by: now + 4 + best.walk / 3, on: -1 };
    else b.postRest = now + PERCH.retry;
    return best?.spot ?? null;
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

  private meets: Spot[] | null = null;

  /** The map's meeting places: the waypoints most shortest routes between spawns pass through, spread apart; found once. */
  private hubs(): Spot[] {
    if (!this.meets) {
      const wps = this.host.layout.waypoints;
      const starts = [...new Set(this.host.layout.spawns.map((s) => nearestWaypoint(wps, s.position[0], s.position[1], s.position[2])))];
      const through = new Float64Array(wps.length);
      for (const s of wps.length ? starts : []) {
        const prev = routeTree(wps, s);
        for (const t of starts) for (let n = prev[t]!; n >= 0 && n !== s; n = prev[n]!) through[n]!++;
      }
      const order = [...through.keys()].filter((i) => through[i]! > 0).sort((a, c) => through[c]! - through[a]!);
      this.meets = [];
      for (const i of order) {
        const p = wps[i]!.position;
        if (this.meets.every((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) > PATROLS.spacing)) this.meets.push(p);
        if (this.meets.length >= PATROLS.count) break;
      }
    }
    return this.meets;
  }

  private views = new Map<number, number | null>();

  /** The yaw down the longest clear view from waypoint `i` (an angle worth checking on the way past), found once each. */
  longestView(i: number): number | null {
    let yaw = this.views.get(i);
    if (yaw === undefined) {
      const wps = this.host.layout.waypoints;
      const [x, y, z] = wps[i]!.position;
      let far = 0;
      yaw = null;
      for (let k = i % VIEWS.every; k < wps.length; k += VIEWS.every) {
        const q = wps[k]!.position;
        const d = Math.hypot(q[0] - x, q[2] - z);
        if (d > far && d < VIEWS.reach && this.host.world.clearLine(x, y + PLAYER.eye, z, q[0], q[1] + 1.2, q[2])) {
          far = d;
          yaw = Math.atan2(-(q[0] - x), -(q[2] - z));
        }
      }
      this.views.set(i, yaw);
    }
    return yaw;
  }

  private posts: Spot[] | null = null;
  private ground: number | null = null;

  /** Whether height `y` is a high post's: well above the map's usual walking level (the median waypoint's). */
  private high(y: number) {
    if (this.ground === null) {
      const ys = this.host.layout.waypoints.map((w) => w.position[1]).sort((a, b) => a - b);
      this.ground = ys[Math.floor(ys.length / 2)] ?? 0;
    }
    return y > this.ground + HIGH;
  }

  /** Waypoints well above the map's usual walking level, found once. */
  private highPosts(): Spot[] {
    this.posts ??= this.host.layout.waypoints.map((w) => w.position).filter((p) => this.high(p[1]));
    return this.posts;
  }

  private looks: number[] | null = null;

  /** High waypoints with the wider view (the better half by waypoints in sight within 50 m, every fourth tried), found once. */
  private lookouts(): number[] {
    if (!this.looks) {
      const wps = this.host.layout.waypoints;
      const view = (p: Spot) => {
        let n = 0;
        for (let i = 0; i < wps.length; i += 4) {
          const q = wps[i]!.position;
          if (Math.hypot(q[0] - p[0], q[2] - p[2]) < 50 && this.host.world.clearLine(p[0], p[1] + PLAYER.eye, p[2], q[0], q[1] + 1.2, q[2])) n++;
        }
        return n;
      };
      const rated = wps.flatMap((w, i) => (this.high(w.position[1]) ? [[view(w.position), i] as const] : []));
      rated.sort((a, c) => c[0] - a[0]);
      this.looks = rated.slice(0, Math.ceil(rated.length / 2)).map(([, i]) => i);
    }
    return this.looks;
  }
}

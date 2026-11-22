import type { Waypoint } from '../world/types';
import { MOVE, PLAYER, TICK } from './constants';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

/** What a bot's walking keeps between ticks: its route, the links it gave up on and its strafe side. */
export interface NavState {
  path: number[];
  repath: number;
  strafe: number;
  /** Waypoint links this bot got stuck on ("a>b" → host time until which it routes around them). */
  avoid: Map<string, number>;
  /** Seconds spent heading for each waypoint without arriving; a node that never comes is blocked. */
  heading: Map<number, number>;
  /** Waypoints given up on → host time until which the bot routes around them. */
  blocked: Map<number, number>;
  /** Host time until which the bot follows the graph instead of walking straight at its goal. */
  graphOnly: number;
}

/** What getting unstuck keeps: how long the bot has pushed without moving, from where, and its sidestep round it. */
export interface StuckState {
  stuck: number;
  lastPos: [number, number];
  /** Seconds left of stepping aside round whatever the bot walked into (a post, a crate corner). */
  sidestep: number;
  crouchTime: number;
  aimYaw: number;
}

/** How far from a goal its route may end when the nearest waypoint can't see it (m). */
const GOAL_REACH = 7;
/** A route past waypoints in an enemy's sight (within `EXPOSED.range` m) counts each as this many metres longer. */
const EXPOSED = { cost: 8, range: 35 };
const REPATH = 1.5;
const RETRY = 0.3;

/** Bot legwork: the waypoint route to a goal, and never stepping off a ledge into the kill zone. */
export class BotNav {
  private readonly hits: number[] = [];

  constructor(private readonly host: HostSim) {}

  /**
   * Direction (x, z) to walk, following waypoints when the goal isn't straight ahead; null at the goal. With a
   * `watcher` (an enemy a close-range bot is going for) the route keeps out of its sight where it can.
   */
  navigate(bot: PlayerState, b: NavState, goal: readonly [number, number, number] | null, watcher: readonly [number, number, number] | null = null): [number, number] | null {
    if (!goal) return null;
    const [gx, gy, gz] = goal;
    const wps = this.host.layout.waypoints;
    const m = bot.move;
    const direct = Math.hypot(gx - m.x, gz - m.z);
    // A goal on another floor (a balcony overhead) needs the graph even when it's close in plan.
    const sameLevel = Math.abs(gy - m.y) < 1.2;
    if (direct < 1 && sameLevel) return null;
    const straight = watcher ? direct < 4 : direct < 10;
    if (wps.length === 0 || (sameLevel && straight && this.host.time > b.graphOnly && this.host.world.clearLine(m.x, m.y + 0.6, m.z, gx, m.y + 0.6, gz))) {
      return direct < 1e-3 ? null : [(gx - m.x) / direct, (gz - m.z) / direct];
    }
    b.repath -= TICK;
    // An empty route is searched again only after a pause: with no way to the goal the search would run every tick.
    if (b.repath <= 0 || (b.path.length === 0 && b.repath <= REPATH - RETRY)) {
      b.repath = REPATH;
      const now = this.host.time;
      const blocked = (i: number) => (b.blocked.get(i) ?? 0) > now;
      b.path = findPath(wps, nearestWaypoint(wps, m.x, m.y, m.z, blocked), this.goalWaypoint(gx, gy, gz), (from, to) => (b.avoid.get(`${from}>${to}`) ?? 0) > now || blocked(to), watcher ? this.exposure(watcher) : undefined);
    }
    while (b.path.length) {
      const w = wps[b.path[0]!]!.position;
      const d = Math.hypot(w[0] - m.x, w[2] - m.z);
      if (d < 0.9 && Math.abs(w[1] - m.y) < 1.2) {
        b.heading.delete(b.path.shift()!);
        continue;
      }
      if (d < 1e-3) break;
      // Neighbouring waypoints are a second or two apart; bouncing off the way to one for this long means it can't be reached from here.
      const spent = (b.heading.get(b.path[0]!) ?? 0) + TICK;
      if (spent > 3.5) {
        b.blocked.set(b.path[0]!, this.host.time + 20);
        b.heading.delete(b.path[0]!);
        b.path = [];
        b.repath = 0;
        break;
      }
      b.heading.set(b.path[0]!, spent);
      return [(w[0] - m.x) / d, (w[2] - m.z) / d];
    }
    return direct < 1e-3 ? null : [(gx - m.x) / direct, (gz - m.z) / direct];
  }

  /**
   * Strafing, corner-cutting and hugging an edge would walk bots off bridges and piers into the kill zone:
   * stop short of a drop ahead, and veer away from one beside the path.
   */
  keepOnGround(bot: PlayerState, b: NavState, cmd: Command) {
    if (!cmd.forward && !cmd.right) return;
    const s = Math.sin(cmd.yaw);
    const c = Math.cos(cmd.yaw);
    let dx = -s * cmd.forward + c * cmd.right;
    let dz = -c * cmd.forward - s * cmd.right;
    const speed = Math.hypot(dx, dz);
    dx /= speed;
    dz /= speed;
    const m = bot.move;
    // The unstick jump clears a parapet: look past it before leaping.
    const leap = (cmd.buttons & BUTTON.jump) !== 0 && [1.4, 2.3, 3.2].some((d) => this.deadly(m.x + dx * d, m.y, m.z + dz * d, 1.8));
    if (leap) {
      cmd.buttons &= ~BUTTON.jump;
      b.graphOnly = this.host.time + 3;
    }
    const pace = (cmd.buttons & BUTTON.sprint ? MOVE.sprint : MOVE.walk) * (bot.bot === 'rusher' ? 1.15 : 1);
    // Sliding along a wall, the body goes where the wall lets it, not where the command points.
    const drift = Math.hypot(m.vx, m.vz);
    const sliding = m.grounded && drift > 1 && this.overshoots(m.x, m.y, m.z, m.vx / drift, m.vz / drift, Math.max(pace, drift));
    if (leap || sliding || this.overshoots(m.x, m.y, m.z, dx, dz, pace)) {
      cmd.forward = 0;
      cmd.right = 0;
      b.strafe *= -1;
      b.path = [];
      return;
    }
    // Right of the heading is (-dz, dx).
    const side = (sign: number) => this.deadly(m.x + dx * 0.6 - dz * 0.55 * sign, m.y, m.z + dz * 0.6 + dx * 0.55 * sign) || this.deadly(m.x - dz * 0.45 * sign, m.y, m.z + dx * 0.45 * sign);
    const left = side(-1);
    const right = side(1);
    if (left === right) return;
    const away = left ? 1 : -1;
    const vx = dx - dz * 0.9 * away;
    const vz = dz + dx * 0.9 * away;
    const k = speed / Math.hypot(vx, vz);
    cmd.forward = (-s * vx - c * vz) * k;
    cmd.right = (c * vx - s * vz) * k;
  }

  /** Duck under a low beam, else jump, when pushing without moving; after a while give up on that link and step aside. */
  unstick(bot: PlayerState, b: NavState & StuckState, cmd: Command) {
    const host = this.host;
    const moved = Math.hypot(bot.move.x - b.lastPos[0], bot.move.z - b.lastPos[1]);
    b.lastPos = [bot.move.x, bot.move.z];
    b.stuck = Math.abs(cmd.forward) + Math.abs(cmd.right) > 0.3 && moved < 0.01 ? b.stuck + TICK : 0;
    if (b.stuck <= 0.25) return;
    if (this.ducks(bot, b.aimYaw, cmd.forward, cmd.right)) {
      b.crouchTime = 1.5;
      cmd.buttons |= BUTTON.crouch;
    } else cmd.buttons |= BUTTON.jump;
    if (b.stuck <= 1.2) return;
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

  /** A beam or shelf at head height a step ahead of where the bot is walking (facing `yaw`), with room under it for a crouch. */
  ducks(bot: PlayerState, yaw: number, forward: number, right: number) {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const dx = -s * forward + c * right;
    const dz = -c * forward - s * right;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return false;
    const m = bot.move;
    const x = m.x + (dx / len) * 0.25;
    const z = m.z + (dz / len) * 0.25;
    const r = PLAYER.halfWidth;
    const fits = (h: number) => this.host.world.overlaps(x - r, m.y + 0.05, z - r, x + r, m.y + h, z + r, this.hits).length === 0;
    return !fits(PLAYER.height) && fits(PLAYER.crouchHeight);
  }

  /** Extra route cost of each waypoint in `watcher`'s sight, looked up once per waypoint per search. */
  private exposure(watcher: readonly [number, number, number]) {
    const wps = this.host.layout.waypoints;
    const seen = new Map<number, number>();
    return (i: number) => {
      let cost = seen.get(i);
      if (cost === undefined) {
        const [x, y, z] = wps[i]!.position;
        const near = Math.hypot(x - watcher[0], z - watcher[2]) < EXPOSED.range;
        cost = near && this.host.world.clearLine(watcher[0], watcher[1] + PLAYER.eye, watcher[2], x, y + 1.2, z) ? EXPOSED.cost : 0;
        seen.set(i, cost);
      }
      return cost;
    };
  }

  /** Whether a body standing at height `y` can step to (x, z): a floor within a step, not over the kill zone. */
  footing(x: number, y: number, z: number) {
    const floor = this.floor(x, y, z);
    return floor > this.host.layout.killY + 0.4 && Math.abs(floor - y) < PLAYER.stepHeight;
  }

  /** A drop ahead that kills, or one whose fall carries the body past the ledge below it into one. */
  private overshoots(x: number, y: number, z: number, dx: number, dz: number, pace: number) {
    const floor = this.floor(x + dx * 0.8, y, z + dz * 0.8);
    if (floor < this.host.layout.killY + 0.4) return true;
    const fall = y - floor;
    if (fall < 1.2) return false;
    const reach = 1.2 + pace * Math.sqrt((2 * fall) / MOVE.gravity);
    for (let d = 1.4; d < reach + 0.6; d += 0.6) if (this.deadly(x + dx * d, y, z + dz * d)) return true;
    return false;
  }

  /** The waypoint to route to for a goal: the nearest that sees it, as the plain nearest may stand behind the wall the goal is pressed against. */
  private goalWaypoint(x: number, y: number, z: number) {
    const wps = this.host.layout.waypoints;
    const world = this.host.world;
    const sees = (i: number) => {
      const [wx, wy, wz] = wps[i]!.position;
      return Math.hypot(wx - x, wz - z) < 0.5 || world.clearLine(wx, wy + 0.6, wz, x, y + 0.6, z) || world.clearLine(wx, wy + 1.6, wz, x, y + 1.2, z);
    };
    let best = nearestWaypoint(wps, x, y, z);
    if (sees(best)) return best;
    let bestD = GOAL_REACH;
    wps.forEach((w, i) => {
      const d = Math.hypot(w.position[0] - x, (w.position[1] - y) * 2, w.position[2] - z);
      if (d < bestD && sees(i)) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private deadly(x: number, y: number, z: number, lift = 0.6) {
    return this.floor(x, y, z, lift) < this.host.layout.killY + 0.4;
  }

  private floor(x: number, y: number, z: number, lift = 0.6) {
    const top = y + lift;
    const hit = this.host.world.raycast(x, top, z, 0, -1, 0, 5.4 + lift, false);
    return hit ? top - hit.t : -Infinity;
  }
}

/** The closest waypoint, skipping any `skip` rules out (unless that leaves none). */
export function nearestWaypoint(wps: readonly Waypoint[], x: number, y: number, z: number, skip: (i: number) => boolean = () => false) {
  let best = 0;
  let bestD = Infinity;
  wps.forEach((w, i) => {
    const d = Math.hypot(w.position[0] - x, (w.position[1] - y) * 2, w.position[2] - z) + (skip(i) ? 1e6 : 0);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** A* over the waypoint graph, `extra` adding to the cost of entering a node; returns node indices excluding the start. */
export function findPath(wps: readonly Waypoint[], start: number, goal: number, avoid: (from: number, to: number) => boolean = () => false, extra: (node: number) => number = () => 0): number[] {
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
      const cost = g.get(current)! + dist(current, next) + extra(next);
      if (cost < (g.get(next) ?? Infinity)) {
        g.set(next, cost);
        from.set(next, current);
        open.add(next);
      }
    }
  }
  return [];
}

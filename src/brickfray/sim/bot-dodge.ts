import { GRENADE } from '../weapons/defs';
import type { BotNav } from './bot-nav';
import type { Spot } from './bot-roam';
import { MOVE, PLAYER, TICK } from './constants';
import { stepGrenade, type Grenade } from './grenades';
import type { HostSim } from './host';
import { BUTTON, type Command, type PlayerState } from './types';

/** What a bot knows of live grenades: when it reacts to each one it noticed, and where it is running. */
export interface DodgeState {
  /** Grenade id → host time the bot starts to move (Infinity: it never does). */
  noticed: Map<number, number>;
  /** Where it runs to get out of the blast of `grenade`, worked out at host time `at`. */
  escape: { grenade: number; spot: Spot; at: number } | null;
}

/** Clearance (m) past the blast radius a bot wants between itself and a burst. */
const MARGIN = 1.5;
/** A grenade this close (m) is heard; one in flight is seen this far ahead of the bot. */
const HEAR = 12;
const SEE = 30;
/** How far (m) a bot looks for somewhere to run to. */
const SEARCH = 9;
/** Seconds between fresh looks for an escape while running: the way out may close, a better one open. */
const RETHINK = 0.4;

/**
 * How a bot takes a grenade, by skill and kind: how far from the burst it wants to be, the chance it never reacts, and
 * its reaction time. Megabots shrug off all but a close one; Zipbots never break off a run.
 */
function alertness(bot: PlayerState, skill: number) {
  const careless = 0.6 * (1 - skill) ** 2;
  const boss = bot.bot === 'boss';
  return { reach: boss ? GRENADE.radius * 0.6 : GRENADE.radius + MARGIN, ignore: boss ? careless + 0.3 : careless, delay: 0.15 + (1 - skill) * 0.6 };
}

/** Grenade sense for bots: where each live grenade will burst, who notices it in time, and where to run. */
export class GrenadeWatch {
  /** A flight doesn't depend on players, so each grenade's burst point is worked out once. */
  private bursts = new Map<number, Spot>();

  constructor(
    private readonly host: HostSim,
    private readonly nav: BotNav
  ) {}

  /** Once per tick, before the bots think: forget grenades that went off. */
  update() {
    if (this.bursts.size === 0) return;
    for (const id of this.bursts.keys()) if (!this.host.grenades.some((g) => g.id === id)) this.bursts.delete(id);
  }

  /** Where a live grenade will go off. */
  burst(g: Grenade): Spot {
    let at = this.bursts.get(g.id);
    if (!at) {
      const flight = { ...g };
      while (!stepGrenade(this.host.world, flight, TICK));
      at = [flight.x, flight.y, flight.z];
      this.bursts.set(g.id, at);
    }
    return at;
  }

  /** The spot to run to from a grenade about to catch `bot`, or null when none does or it hasn't reacted yet. */
  dodge(bot: PlayerState, b: DodgeState, skill: number, random: () => number): Spot | null {
    const host = this.host;
    if (bot.bot === 'rusher' || host.grenades.length === 0) {
      b.noticed.clear();
      b.escape = null;
      return null;
    }
    if (b.noticed.size > host.grenades.length) for (const id of b.noticed.keys()) if (!host.grenades.some((g) => g.id === id)) b.noticed.delete(id);
    const m = bot.move;
    const alert = alertness(bot, skill);
    let threat: { g: Grenade; at: Spot; reach: number } | null = null;
    for (const g of host.grenades) {
      const owner = host.players.get(g.owner);
      // A teammate's grenade can't hurt it; its own can.
      if (owner && owner.id !== bot.id && !host.hostile(owner, bot)) continue;
      let react = b.noticed.get(g.id);
      if (react === Infinity) continue;
      const at = this.burst(g);
      // Once running from it, a bot keeps going a metre past where it would have started: no stepping back and forth at the edge.
      const reach = alert.reach + (b.escape?.grenade === g.id ? 1 : 0);
      if (!this.catches(at, m.x, m.y, m.z, bot.scale, reach)) continue;
      if (react === undefined) {
        if (!this.notices(bot, g)) continue;
        react = random() < alert.ignore ? Infinity : host.time + alert.delay + random() * 0.3;
        b.noticed.set(g.id, react);
      }
      if (host.time < react) continue;
      if (!threat || g.fuse < threat.g.fuse) threat = { g, at, reach };
    }
    if (!threat) {
      b.escape = null;
      return null;
    }
    if (!b.escape || b.escape.grenade !== threat.g.id || host.time - b.escape.at > RETHINK) {
      const spot = this.escape(bot, threat.at, threat.g.fuse, threat.reach);
      b.escape = spot ? { grenade: threat.g.id, spot, at: host.time } : null;
    }
    return b.escape?.spot ?? null;
  }

  /** Whether a burst at `at` reaches a body standing at (x, y, z): in range, with a line to its middle or its head. */
  private catches(at: Spot, x: number, y: number, z: number, scale: number, reach: number) {
    const cy = y + 0.9 * scale;
    if (Math.hypot(x - at[0], cy - at[1], z - at[2]) > reach) return false;
    const world = this.host.world;
    return world.clearLine(at[0], at[1] + 0.15, at[2], x, cy, z) || world.clearLine(at[0], at[1] + 0.15, at[2], x, y + 1.6 * scale, z);
  }

  /** Its own throw, one landing near enough to hear, or one in flight ahead of it in plain view. */
  private notices(bot: PlayerState, g: Grenade) {
    if (g.owner === bot.id) return true;
    const eye = this.host.eye(bot);
    const d = Math.hypot(g.x - eye[0], g.y - eye[1], g.z - eye[2]);
    if (d < HEAR) return true;
    if (d > SEE) return false;
    const facing = Math.cos(Math.atan2(-(g.x - eye[0]), -(g.z - eye[2])) - bot.yaw);
    return facing > 0.3 && this.host.world.clearLine(eye[0], eye[1], eye[2], g.x, g.y, g.z);
  }

  /**
   * Somewhere a short straight run away that the blast won't reach in time to matter: behind cover if there is any
   * near, else out of range; failing both, the farthest it can get. Waypoints and a ring round the bot are the choices,
   * and none of them is past a ledge.
   */
  private escape(bot: PlayerState, at: Spot, fuse: number, reach: number): Spot | null {
    const m = bot.move;
    const choices: Spot[] = [];
    for (const w of this.host.layout.waypoints) {
      const p = w.position;
      if (Math.abs(p[1] - m.y) < 1 && Math.hypot(p[0] - m.x, p[2] - m.z) < SEARCH) choices.push(p);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const r of [3, 6]) choices.push([m.x + Math.sin(a) * r, m.y, m.z + Math.cos(a) * r]);
    }
    const from = Math.hypot(m.x - at[0], m.z - at[2]);
    let best: Spot | null = null;
    let bestCost = Infinity;
    let fallback: Spot | null = null;
    let far = from + 0.5;
    for (const c of choices) {
      const run = Math.hypot(c[0] - m.x, c[2] - m.z);
      if (run < 1 || !this.walkable(m, c)) continue;
      const covered = !this.catches(at, c[0], c[1], c[2], bot.scale, Infinity);
      const away = Math.hypot(c[0] - at[0], c[2] - at[2]);
      if (away > far) {
        far = away;
        fallback = c;
      }
      if (!covered && Math.hypot(c[0] - at[0], c[1] + 0.9 * bot.scale - at[1], c[2] - at[2]) <= reach) continue;
      // Turning and getting up to a sprint cost a beat.
      if (run / MOVE.sprint + 0.3 > fuse) continue;
      const cost = run - (covered ? 3 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    }
    return best ?? fallback;
  }

  /** A straight run a body wide with nothing in the way at knee and chest height, and floor under it all the way. */
  private walkable(m: PlayerState['move'], c: Spot) {
    const world = this.host.world;
    const len = Math.hypot(c[0] - m.x, c[2] - m.z);
    // The body's edges either side of the line it runs along.
    const sx = (-(c[2] - m.z) / len) * PLAYER.halfWidth;
    const sz = ((c[0] - m.x) / len) * PLAYER.halfWidth;
    for (const [ox, h, oz] of [[sx, 0.45, sz], [-sx, 0.45, -sz], [0, 1.2, 0]] as const) if (!world.clearLine(m.x + ox, m.y + h, m.z + oz, c[0] + ox, c[1] + h, c[2] + oz)) return false;
    for (const k of [0.5, 1]) if (!this.nav.footing(m.x + (c[0] - m.x) * k, m.y + (c[1] - m.y) * k, m.z + (c[2] - m.z) * k)) return false;
    return true;
  }
}

/** Get out of a grenade's blast: turn for the spot, walking at once and sprinting once it faces the way; no shooting. */
export function runTo(bot: PlayerState, b: { aimYaw: number; fireHeld: boolean; crouchTime: number }, spot: Spot, cmd: Command) {
  cmd.buttons &= ~(BUTTON.fire | BUTTON.ads | BUTTON.crouch);
  b.fireHeld = false;
  b.crouchTime = 0;
  const dx = spot[0] - bot.move.x;
  const dz = spot[2] - bot.move.z;
  if (Math.hypot(dx, dz) < 0.5) {
    cmd.forward = 0;
    cmd.right = 0;
    return;
  }
  const yaw = Math.atan2(-dx, -dz);
  const turn = Math.atan2(Math.sin(yaw - b.aimYaw), Math.cos(yaw - b.aimYaw));
  b.aimYaw += Math.max(-9 * TICK, Math.min(9 * TICK, turn));
  const rel = Math.atan2(Math.sin(yaw - b.aimYaw), Math.cos(yaw - b.aimYaw));
  cmd.forward = Math.cos(rel);
  cmd.right = -Math.sin(rel);
  if (Math.abs(rel) < 0.6) cmd.buttons |= BUTTON.sprint;
}

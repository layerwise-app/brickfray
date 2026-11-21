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
}

/** Closer than this (m, in plan, same floor) a bot has reached a spot. */
export const HEADWAY = 1.5;
/** Seconds a patrol goal is followed before the bot goes back to hunting. */
const PATROL = 20;
/** A sighting this recent (s) marks the last known fight, a place worth patrolling to. */
const FIGHT_FRESH = 15;

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

  /** Head for the other team's spawns (any spawn in free-for-all) or the last known fight, away from here. */
  patrol(bot: PlayerState, b: RoamState): Spot | null {
    const m = bot.move;
    const away = (p: Spot) => Math.hypot(p[0] - m.x, p[2] - m.z) > 10 && p !== b.patrol;
    const spawns = this.host.layout.spawns;
    const theirs = spawns.filter((s) => bot.team >= 0 && s.team !== undefined && s.team !== bot.team);
    const spots = (theirs.length ? theirs : spawns).map((s) => s.position).filter(away);
    if (this.fight && this.host.time - this.fight.time < FIGHT_FRESH && away(this.fight.at)) spots.push(this.fight.at);
    b.lastSeen = null;
    b.path = [];
    b.patrol = spots.length ? spots[Math.floor(this.random() * spots.length)]! : null;
    b.patrolUntil = this.host.time + PATROL;
    return b.patrol;
  }
}

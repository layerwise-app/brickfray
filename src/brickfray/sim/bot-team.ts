import type { Spot } from './bot-roam';
import type { HostSim } from './host';
import type { PlayerState } from './types';

/** What teammates read of each other's brains to spread out: the flank each takes and the enemy each is after. */
export interface TeamState {
  /** Team matches: the flank it takes for a life (-1 left, 0 straight in, 1 right of the line from its spawns). */
  lane: number;
  /** The enemy it is going after while nobody is in sight. */
  hunt: number;
  target: number;
  lostFor: number;
}

/** Team bots rate an enemy a teammate is already after as this much farther (m): they spread over the other team. */
const SHARE = 15;
/** A close-range bot rates an enemy that is busy in another fight as this much nearer (m). */
const BUSY = 12;
/** A bot keeps after the enemy it chose unless another is this much (m) better. */
const STICK = 8;

/** The flank fewest living teammates are on (a free-for-all bot goes straight in). */
export function pickLane(host: HostSim, bot: PlayerState, b: TeamState, brains: ReadonlyMap<number, TeamState>, random: () => number) {
  if (bot.team < 0) return 0;
  const used = [0, 0, 0];
  for (const [id, o] of brains) {
    const p = host.players.get(id);
    if (o !== b && p?.alive && p.team === bot.team) used[o.lane + 1]!++;
  }
  const least = Math.min(...used);
  const lanes = [-1, 0, 1].filter((l) => used[l + 1] === least);
  return lanes[Math.floor(random() * lanes.length)]!;
}

/**
 * The enemy to go after with nobody in sight: the nearest, kept unless another is clearly nearer; team bots leave
 * enemies their teammates are after, and a close-range bot picks on one busy fighting someone else. `unheard` enemies
 * (just respawned, see BotDirector) are not known to be anywhere yet.
 */
export function huntTarget(host: HostSim, bot: PlayerState, b: TeamState, brains: ReadonlyMap<number, TeamState>, closer: boolean, unheard: (p: PlayerState) => boolean = () => false): Spot | null {
  let best: PlayerState | null = null;
  let bestScore = Infinity;
  for (const p of host.players.values()) {
    if (!p.alive || !host.hostile(bot, p) || unheard(p)) continue;
    let score = Math.hypot(p.move.x - bot.move.x, p.move.z - bot.move.z) - (p.id === b.hunt ? STICK : 0);
    const other = brains.get(p.id);
    if (closer && other && other.target && other.target !== bot.id && other.lostFor === 0) score -= BUSY;
    if (bot.team >= 0) for (const [id, o] of brains) if (o !== b && (o.hunt === p.id || o.target === p.id) && host.players.get(id)?.team === bot.team) score += SHARE;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  b.hunt = best?.id ?? 0;
  return best && [best.move.x, best.move.y, best.move.z];
}

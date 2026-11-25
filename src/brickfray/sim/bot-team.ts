import { uncertainty, type BeliefState } from './bot-belief';
import type { Spot } from './bot-roam';
import type { HostSim } from './host';
import type { PlayerState } from './types';

/** What teammates read of each other's brains to spread out: the flank each takes and the enemy each is after. */
export interface TeamState {
  /** Team matches: the flank it takes for a life (-1 left, 0 straight in, 1 right of the line from its spawns). */
  lane: number;
  /** The enemy whose believed spot it is going to while nobody is in sight (0: none), and the spot it is making for. */
  hunt: number;
  huntAt: Spot | null;
  target: number;
  lostFor: number;
}

/** Team bots rate an enemy a teammate is already after as this much farther (m): they spread over the other team. */
const SHARE = 15;
/** A close-range bot rates an enemy it heard firing in the last `within` s (busy with someone else) this much nearer (m). */
const BUSY = { by: 12, within: 2 };
/** A bot keeps after the enemy it chose unless another is this much (m) better. */
const STICK = 8;
/** Each second since the news counts as this many metres: fresh news first. */
const STALE = 1.5;
/**
 * News of the enemy it is already going for moves the spot it makes for only when it lands farther off than the belief
 * is sure (at least `HOLD` m): a bot picks a way round and keeps to it rather than turn back at each shot it hears.
 */
const HOLD = 3;

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
 * The believed spot to go for with nobody in sight: the nearest and freshest of what the bot believes (only what it
 * saw, heard, felt or was told, once it has taken it in), kept unless another is clearly better; team bots leave enemies
 * their teammates are after, and a close-range bot picks on one it hears busy firing. Null: it believes in nobody.
 */
export function huntTarget(host: HostSim, bot: PlayerState, b: TeamState & BeliefState, brains: ReadonlyMap<number, TeamState>, closer: boolean): Spot | null {
  const now = host.time;
  let best = 0;
  let spot: Spot | null = null;
  let bestScore = Infinity;
  for (const [id, bel] of b.beliefs) {
    if (now < bel.act) continue;
    let score = Math.hypot(bel.at[0] - bot.move.x, bel.at[2] - bot.move.z) + STALE * (now - bel.time) - (id === b.hunt ? STICK : 0);
    if (closer && now - bel.fired < BUSY.within) score -= BUSY.by;
    if (bot.team >= 0) for (const [mate, o] of brains) if (o !== b && (o.hunt === id || o.target === id) && host.players.get(mate)?.team === bot.team) score += SHARE;
    if (score < bestScore) {
      bestScore = score;
      best = id;
      spot = bel.at;
    }
  }
  const bel = b.beliefs.get(best);
  if (bel && spot && best === b.hunt && b.huntAt && Math.hypot(b.huntAt[0] - spot[0], b.huntAt[2] - spot[2]) < Math.max(HOLD, uncertainty(bel, now))) spot = b.huntAt;
  b.hunt = best;
  b.huntAt = spot;
  return spot;
}

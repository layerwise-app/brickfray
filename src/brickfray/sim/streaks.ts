import type { HostPlayer } from './types';

/** A kill within this many seconds of the same player's previous one extends their chain: a double, triple … kill. */
export const CHAIN_WINDOW = 4;
/** The longest chain with its own name; longer chains repeat it. */
export const CHAIN_TOP = 5;

/** What a kill scores before any bounty. */
export const KILL_SCORE = { body: 100, head: 150 } as const;

/**
 * Rooms only: a player whose streak (kills since their last death) reaches `from` carries a bounty of `step` points,
 * rising by `step` with each further kill up to `cap`; whoever takes them down collects it on top of the kill.
 */
export const BOUNTY = { from: 3, step: 25, cap: 150 } as const;

/** Most one kill can ever score: a headshot on a player carrying the largest bounty. */
export const MAX_KILL_SCORE = KILL_SCORE.head + BOUNTY.cap;

export function bountyFor(streak: number): number {
  return Math.min(BOUNTY.cap, Math.max(0, streak - BOUNTY.from + 1) * BOUNTY.step);
}

export interface KillOutcome {
  /** Points collected for ending the victim's streak (0 without a bounty or outside rooms). */
  bounty: number;
  /** The killer's chain after this kill: 1 for a lone kill, 2 for a double kill … (0 without a killer). */
  chain: number;
}

/**
 * Per-player kill streaks (for the bounty) and kill chains (for the multi-kill callouts), kept by the host. A death
 * ends the streak at once. A chain belongs to one life: a kill landed just after its maker died (their grenade still
 * in the air) still extends it, a kill after the respawn starts a new one.
 */
export class Streaks {
  private readonly streak = new Map<number, number>();
  private readonly chains = new Map<number, { count: number; at: number; life: number }>();

  constructor(private readonly bounties: boolean) {}

  bounty(id: number): number {
    return this.bounties ? bountyFor(this.streak.get(id) ?? 0) : 0;
  }

  kill(time: number, victim: HostPlayer, killer: HostPlayer | null): KillOutcome {
    const bounty = killer ? this.bounty(victim.id) : 0;
    this.streak.delete(victim.id);
    if (!killer) return { bounty, chain: 0 };
    if (killer.alive) this.streak.set(killer.id, (this.streak.get(killer.id) ?? 0) + 1);
    const last = this.chains.get(killer.id);
    const count = last && last.life === killer.life && time - last.at <= CHAIN_WINDOW ? last.count + 1 : 1;
    this.chains.set(killer.id, { count, at: time, life: killer.life });
    return { bounty, chain: count };
  }

  remove(id: number) {
    this.streak.delete(id);
    this.chains.delete(id);
  }
}

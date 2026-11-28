import type { Spot } from './bot-roam';

/**
 * Where a bot believes an enemy is: built only from what it saw, heard, felt (a hit) or was told by a teammate.
 * `err` is how far off (m) the spot may be at `time`; it grows as the enemy walks on, and the belief is dropped
 * after `MEMORY` s without news, once the bot has looked at the spot and found nobody, or when the kill feed shows
 * the enemy died (`life` no longer its life).
 */
export interface Belief {
  at: Spot;
  err: number;
  time: number;
  /** Host time from which the bot acts on it (it takes a moment to place a sound or a call). */
  act: number;
  life: number;
  /** The newest news was a sighting. */
  seen: boolean;
  /** Host time it last heard the enemy fire (-Infinity: never). */
  fired: number;
}

export interface BeliefState {
  beliefs: Map<number, Belief>;
  /** A look toward something heard or felt out of view: the yaw, from when, until when, and how fast it turns (rad/s; default the look pace). */
  glance: { yaw: number; from: number; until: number; turn?: number } | null;
}

/** How fast (m/s) a believed spot grows less sure: an enemy keeps moving, not always away. */
const DRIFT = 2.5;
/** Seconds a belief lasts without fresh news. */
export const MEMORY = 12;
/** Older beliefs are merged with a new reading only while this fresh (s); after it a reading replaces them. */
const FUSE = 4;
/** A hearing alone never places an enemy closer than this share of its distance. */
const SOUND_FLOOR = 0.1;

export function uncertainty(bel: Belief, now: number) {
  return bel.err + DRIFT * (now - bel.time);
}

/**
 * Take in news of enemy `id`: a sighting replaces what the bot believed; a sound or a call is averaged with a fresh
 * belief by how sure each is (a sighting under half a second old is not moved by a sound).
 */
export function believe(b: BeliefState, id: number, life: number, at: Spot, err: number, now: number, act: number, seen: boolean, fired = false, distance = 0) {
  const old = b.beliefs.get(id);
  const fresh = old && old.life === life && now - old.time < FUSE;
  if (!seen && fresh && old.seen && now - old.time < 0.5) {
    if (fired) old.fired = now;
    return;
  }
  let spot = at;
  let sure = err;
  if (!seen && fresh) {
    // A reading that agrees with the belief says the enemy is still about there: the two narrow it down. One that
    // does not is weighed against how far the enemy may have gone since.
    const agrees = Math.hypot(old.at[0] - at[0], old.at[2] - at[2]) < Math.max(old.err, err);
    const e = agrees ? old.err : uncertainty(old, now);
    const w1 = 1 / (e * e);
    const w2 = 1 / (err * err);
    spot = [0, 1, 2].map((k) => (old.at[k]! * w1 + at[k]! * w2) / (w1 + w2)) as unknown as Spot;
    sure = Math.max(1 / Math.sqrt(w1 + w2), SOUND_FLOOR * distance);
  }
  b.beliefs.set(id, {
    at: spot,
    err: sure,
    time: now,
    act: fresh ? Math.min(old.act, act) : act,
    life,
    seen,
    fired: fired ? now : fresh ? old.fired : -Infinity
  });
}

/** Drop beliefs gone stale, and those of enemies the kill feed shows dead since (`lifeOf` null: dead or gone). */
export function prune(b: BeliefState, now: number, lifeOf: (id: number) => number | null) {
  for (const [id, bel] of b.beliefs) if (now - bel.time > MEMORY || lifeOf(id) !== bel.life) b.beliefs.delete(id);
}

/** A teammate's call: what it saw, heard by the team a moment later as a rough spot. */
interface Call {
  caller: number;
  team: number;
  enemy: number;
  life: number;
  at: Spot;
  due: number;
}

/** Seconds from a sighting to the team hearing the call, and between two calls of one enemy. */
const CALL = { delay: [1, 1.5], every: 2, err: 4 } as const;

/** Team callouts: what a bot sees is passed to its teammates as a rough spot, late, no more than every two seconds. */
export class TeamCalls {
  private queue: Call[] = [];
  private last = new Map<string, number>();

  constructor(private readonly random: () => number) {}

  call(caller: number, team: number, enemy: number, life: number, at: Spot, now: number) {
    const key = `${team}:${enemy}`;
    if (now - (this.last.get(key) ?? -Infinity) < CALL.every) return;
    this.last.set(key, now);
    const r = CALL.err * this.random();
    const a = this.random() * Math.PI * 2;
    this.queue.push({ caller, team, enemy, life, at: [at[0] + Math.sin(a) * r, at[1], at[2] + Math.cos(a) * r], due: now + CALL.delay[0] + (CALL.delay[1] - CALL.delay[0]) * this.random() });
  }

  /** Calls due by `now`, each handed to `hear` once (`caller` saw it itself). */
  deliver(now: number, hear: (c: { team: number; enemy: number; life: number; at: Spot; caller: number }) => void) {
    if (!this.queue.some((c) => c.due <= now)) return;
    const due = this.queue.filter((c) => c.due <= now);
    this.queue = this.queue.filter((c) => c.due > now);
    for (const c of due) hear(c);
  }
}

export const CALL_ERR = CALL.err;

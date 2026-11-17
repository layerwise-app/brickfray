import type { SpawnPoint } from '../world/types';
import type { CollisionWorld } from './collision';
import { PLAYER } from './constants';
import type { PlayerState } from './types';

export interface RecentDeath {
  x: number;
  z: number;
  time: number;
}

/**
 * Pick the spawn that is farthest from enemies, out of their sight and away from
 * recent deaths. A little noise keeps it from always choosing the same spot.
 */
export function pickSpawn(
  world: CollisionWorld,
  spawns: readonly SpawnPoint[],
  player: PlayerState,
  players: Iterable<PlayerState>,
  deaths: readonly RecentDeath[],
  now: number,
  random: () => number
): SpawnPoint {
  const enemies = [...players].filter((p) => p.alive && p.id !== player.id && (player.team < 0 || p.team !== player.team));
  const candidates = spawns.filter((s) => player.team < 0 || s.team === undefined || s.team === player.team);
  const pool = candidates.length ? candidates : spawns;
  let best = pool[0]!;
  let bestScore = -Infinity;
  for (const s of pool) {
    const [x, y, z] = s.position;
    let score = random() * 4;
    let nearest = 80;
    for (const e of enemies) {
      const d = Math.hypot(e.move.x - x, e.move.z - z);
      nearest = Math.min(nearest, d);
      if (d < 45 && world.clearLine(e.move.x, e.move.y + PLAYER.eye, e.move.z, x, y + PLAYER.eye, z)) score -= 30;
    }
    score += Math.min(nearest, 40);
    if (nearest < 8) score -= 60;
    for (const d of deaths) {
      if (now - d.time < 8 && Math.hypot(d.x - x, d.z - z) < 10) score -= 15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

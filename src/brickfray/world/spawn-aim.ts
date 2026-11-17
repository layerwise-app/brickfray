import type { Collider, SpawnPoint } from './types';

const EYE = 1.6;
const STEPS = 24;
const FAR = 40;

/** Distance along a level ray at eye height to the first collider bullets can't pass. */
function clearDistance(colliders: readonly Collider[], x: number, y: number, z: number, dx: number, dz: number) {
  let best = FAR;
  for (const c of colliders) {
    if (c.bulletsPass || y < c.min[1] || y > c.max[1]) continue;
    let t0 = 0;
    let t1 = best;
    for (const [o, d, lo, hi] of [
      [x, dx, c.min[0], c.max[0]],
      [z, dz, c.min[2], c.max[2]]
    ] as const) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) t1 = -1;
        continue;
      }
      const a = (lo - o) / d;
      const b = (hi - o) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 <= t1 && t1 > 0) best = Math.min(best, t0);
  }
  return best;
}

/**
 * Face each spawn where the player can see the fight: the most open direction,
 * leaning toward the middle of the map and the authored yaw. Visual-only facades
 * have no colliders, so the pull toward the middle keeps edge spawns from staring at them.
 */
export function aimSpawns(spawns: readonly SpawnPoint[], colliders: readonly Collider[], center: [number, number]): SpawnPoint[] {
  return spawns.map((s) => {
    const [x, y, z] = s.position;
    const toCenter = Math.atan2(-(center[0] - x), -(center[1] - z));
    const centered = Math.hypot(center[0] - x, center[1] - z) > 4;
    let best = s.yaw;
    let bestScore = -Infinity;
    for (let i = 0; i < STEPS; i++) {
      const yaw = s.yaw + (i / STEPS) * Math.PI * 2;
      const open = clearDistance(colliders, x, y + EYE, z, -Math.sin(yaw), -Math.cos(yaw));
      const score = Math.min(open, 30) + (centered ? 10 * Math.cos(yaw - toCenter) : 0) + 3 * Math.cos(yaw - s.yaw) - (open < 6 ? 40 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = yaw;
      }
    }
    const yaw = Math.atan2(Math.sin(best), Math.cos(best));
    return { ...s, yaw: Math.round(yaw * 1000) / 1000 };
  });
}

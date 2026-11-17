import type * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';

const scratch: number[] = [];

/**
 * Resolve a small sphere against the box world: pushes `p` out along the axis
 * of least penetration and reflects `v` with damping. Returns the impact speed
 * of the hardest contact (0 if none) and whether it landed on a floor.
 */
export function collideSphere(world: CollisionWorld | null, p: THREE.Vector3, v: THREE.Vector3, r: number, restitution = 0.35, friction = 0.72) {
  let impact = 0;
  let floor = false;
  const resolve = (comp: 'x' | 'y' | 'z', sign: number) => {
    const vn = v[comp] * sign;
    if (vn >= 0) return;
    impact = Math.max(impact, -vn);
    v[comp] = -vn * restitution * sign;
    for (const other of ['x', 'y', 'z'] as const) if (other !== comp) v[other] *= friction;
    if (comp === 'y' && sign > 0) floor = true;
  };
  if (!world) {
    if (p.y - r < 0) {
      p.y = r;
      resolve('y', 1);
    }
    return { impact, floor };
  }
  const hits = world.overlaps(p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r, scratch);
  const b = world.boxes;
  for (const i of hits) {
    const o = i * 6;
    const pen = [p.x + r - b[o]!, b[o + 3]! - (p.x - r), p.y + r - b[o + 1]!, b[o + 4]! - (p.y - r), p.z + r - b[o + 2]!, b[o + 5]! - (p.z - r)];
    let best = 0;
    for (let k = 1; k < 6; k++) if (pen[k]! < pen[best]!) best = k;
    if (pen[best]! <= 0) continue;
    const comp = (['x', 'y', 'z'] as const)[best >> 1]!;
    const sign = best % 2 === 0 ? -1 : 1;
    p[comp] += sign * pen[best]!;
    resolve(comp, sign);
  }
  return { impact, floor };
}

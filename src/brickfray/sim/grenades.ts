import { GRENADE } from '../weapons/defs';
import type { CollisionWorld } from './collision';
import { MOVE } from './constants';

export interface Grenade {
  id: number;
  owner: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
  /** Bounces since the last snapshot, for client sounds. */
  bounces: number;
  resting: boolean;
}

const RADIUS = 0.09;
const RESTITUTION = 0.38;
const FRICTION = 0.7;

export function throwGrenade(
  id: number,
  owner: number,
  eye: [number, number, number],
  dir: [number, number, number],
  inherit: [number, number, number],
  cook: number,
  low: boolean
): Grenade {
  const speed = low ? GRENADE.lobSpeed : GRENADE.throwSpeed;
  const lift = low ? 0.05 : 0.18;
  return {
    id,
    owner,
    x: eye[0] + dir[0] * 0.4,
    y: eye[1] - 0.15 + dir[1] * 0.4,
    z: eye[2] + dir[2] * 0.4,
    vx: dir[0] * speed + inherit[0] * 0.6,
    vy: (dir[1] + lift) * speed + inherit[1] * 0.3,
    vz: dir[2] * speed + inherit[2] * 0.6,
    fuse: Math.max(0.05, GRENADE.fuse - cook),
    bounces: 0,
    resting: false
  };
}

/** Advance a grenade; returns true when its fuse runs out. */
export function stepGrenade(world: CollisionWorld, g: Grenade, dt: number): boolean {
  g.fuse -= dt;
  if (g.fuse <= 0) return true;
  if (g.resting) return false;
  g.vy -= MOVE.gravity * dt;
  let remaining = dt;
  for (let i = 0; i < 3 && remaining > 1e-5; i++) {
    const dx = g.vx * remaining;
    const dy = g.vy * remaining;
    const dz = g.vz * remaining;
    const hit = world.raycast(g.x, g.y, g.z, dx, dy, dz, 1, false);
    if (!hit) {
      g.x += dx;
      g.y += dy;
      g.z += dz;
      break;
    }
    const t = Math.max(0, hit.t - RADIUS / Math.max(1e-5, Math.hypot(dx, dy, dz)));
    g.x += dx * t;
    g.y += dy * t;
    g.z += dz * t;
    remaining *= 1 - hit.t;
    const [nx, ny, nz] = hit.normal;
    const vn = g.vx * nx + g.vy * ny + g.vz * nz;
    g.vx = (g.vx - nx * vn) * FRICTION - nx * vn * RESTITUTION;
    g.vy = (g.vy - ny * vn) * FRICTION - ny * vn * RESTITUTION;
    g.vz = (g.vz - nz * vn) * FRICTION - nz * vn * RESTITUTION;
    if (Math.abs(vn) > 1.2) g.bounces++;
    if (ny > 0.5 && Math.hypot(g.vx, g.vy, g.vz) < 0.6) {
      g.resting = true;
      g.vx = g.vy = g.vz = 0;
      break;
    }
  }
  return false;
}

/** Damage by distance: full at the center, zero at the radius edge. */
export function explosionDamage(distance: number) {
  if (distance >= GRENADE.radius) return 0;
  const k = 1 - distance / GRENADE.radius;
  return Math.round(GRENADE.damage * Math.min(1, k * 1.15));
}

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
  /** Thrown by a bot: hits humans for the bots' share even if the bot is gone by the time it bursts. */
  byBot?: boolean;
}

/**
 * The overhand throw: one speed, raised a little above a level aim, the rise fading out by 45° of aim. Carry on flat
 * ground from standing: 13 m level, 28 m at most (aim 40–45°), nearer again above that; a sprint adds about 3 m.
 */
export const THROW = { speed: 24, lift: 0.14, liftFade: Math.PI / 4, inherit: 0.3 } as const;

const RADIUS = 0.09;
const RESTITUTION = 0.38;
const FRICTION = 0.7;
/** A hard landing bites into the ground and barely hops: it keeps at least this share of its run and of its fall. */
const LANDING_GRIP = 0.4;
const LANDING_BOUNCE = 0.22;

export function throwGrenade(
  id: number,
  owner: number,
  eye: [number, number, number],
  dir: [number, number, number],
  inherit: [number, number, number],
  cook: number,
  low: boolean
): Grenade {
  const v = low ? lobVelocity(dir) : throwVelocity(dir);
  const keep = low ? 0.6 : THROW.inherit;
  return {
    id,
    owner,
    x: eye[0] + dir[0] * 0.4,
    y: eye[1] - 0.15 + dir[1] * 0.4,
    z: eye[2] + dir[2] * 0.4,
    vx: v[0] + inherit[0] * keep,
    vy: v[1] + inherit[1] * 0.3,
    vz: v[2] + inherit[2] * keep,
    fuse: Math.max(0.05, GRENADE.fuse - cook),
    bounces: 0,
    resting: false
  };
}

/** The underhand lob: short and soft whatever the aim. */
function lobVelocity(dir: [number, number, number]): [number, number, number] {
  return [dir[0] * GRENADE.lobSpeed, (dir[1] + 0.05) * GRENADE.lobSpeed, dir[2] * GRENADE.lobSpeed];
}

function throwVelocity(dir: [number, number, number]): [number, number, number] {
  const flat = Math.hypot(dir[0], dir[2]);
  const pitch = Math.atan2(dir[1], flat);
  const up = pitch + THROW.lift * Math.max(0, 1 - Math.max(0, pitch) / THROW.liftFade);
  const across = flat > 1e-6 ? Math.cos(up) / flat : 0;
  return [dir[0] * across * THROW.speed, Math.sin(up) * THROW.speed, dir[2] * across * THROW.speed];
}

/**
 * The aim pitch whose overhand throw first comes down `distance` m away (in plan) and `rise` m above the eye; null when
 * no aim up to the longest throw reaches it. Below the longest throw's aim the carry only grows with pitch.
 */
export function throwPitchFor(distance: number, rise: number): number | null {
  const carry = (pitch: number) => {
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const [vx, vy, vz] = throwVelocity([0, s, -c]);
    const drop = -0.15 + 0.4 * s - rise;
    const root = vy * vy + 2 * MOVE.gravity * drop;
    return root < 0 ? -1 : 0.4 * c + Math.hypot(vx, vz) * ((vy + Math.sqrt(root)) / MOVE.gravity);
  };
  let lo = -0.6;
  let hi = THROW.liftFade - 0.05;
  if (carry(hi) < distance) return null;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (carry(mid) < distance) lo = mid;
    else hi = mid;
  }
  return hi;
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
    const floor = ny > 0.5;
    const grip = floor ? Math.max(LANDING_GRIP, FRICTION - 0.025 * Math.abs(vn)) : FRICTION;
    const bounce = floor ? Math.max(LANDING_BOUNCE, RESTITUTION - 0.008 * Math.abs(vn)) : RESTITUTION;
    g.vx = (g.vx - nx * vn) * grip - nx * vn * bounce;
    g.vy = (g.vy - ny * vn) * grip - ny * vn * bounce;
    g.vz = (g.vz - nz * vn) * grip - nz * vn * bounce;
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

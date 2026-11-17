import { PLAYER } from './constants';
import type { HitKind } from './types';

/** A player's pose as hit detection sees it. */
export interface HitPose {
  x: number;
  y: number;
  z: number;
  crouch: number;
  scale: number;
}

export const HEAD_RADIUS = 0.18;
const BODY_HALF = 0.27;

export function headCenterY(pose: HitPose) {
  return pose.y + (PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * pose.crouch) * pose.scale;
}

/** Distance along the ray to the head sphere, or -1. Direction must be normalized. */
function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  return tca - Math.sqrt(r * r - d2);
}

function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  let tmin = 0;
  let tmax = Infinity;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]!) < 1e-9) {
      if (o[a]! < lo[a]! || o[a]! > hi[a]!) return -1;
      continue;
    }
    let t0 = (lo[a]! - o[a]!) / d[a]!;
    let t1 = (hi[a]! - o[a]!) / d[a]!;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/** Nearest hit on a player's head sphere or body box within maxT. */
export function rayHitPlayer(
  pose: HitPose,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxT: number
): { t: number; kind: HitKind } | null {
  const s = pose.scale;
  const hy = headCenterY(pose);
  const head = raySphere(ox, oy, oz, dx, dy, dz, pose.x, hy, pose.z, HEAD_RADIUS * s);
  const half = BODY_HALF * s;
  const body = rayBox(ox, oy, oz, dx, dy, dz, pose.x - half, pose.y, pose.z - half, pose.x + half, hy - HEAD_RADIUS * s * 0.9, pose.z + half);
  let best: { t: number; kind: HitKind } | null = null;
  if (head >= 0 && head <= maxT) best = { t: head, kind: 'head' };
  if (body >= 0 && body <= maxT && (!best || body < best.t)) best = { t: body, kind: 'body' };
  return best;
}

/** Linear falloff between start and end distances. */
export function damageAt(distance: number, full: number, min: number, start: number, end: number) {
  if (distance <= start) return full;
  if (distance >= end) return min;
  return full + (min - full) * ((distance - start) / (end - start));
}

import type { CollisionWorld } from './collision';
import { MOVE, PLAYER } from './constants';

export interface MoveInput {
  /** -1…1 (S…W) and -1…1 (A…D). */
  forward: number;
  right: number;
  yaw: number;
  jump: boolean;
  crouch: boolean;
  sprint: boolean;
  ads: boolean;
}

export interface MoveState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  /** Current collision height blend: 0 standing … 1 crouched. */
  crouch: number;
  slide: number;
  sprinting: boolean;
  /** Jump needs a fresh press. */
  jumpLatch: boolean;
  /** Downward speed at the last landing (for camera dip and sounds), consumed by the caller. */
  landed: number;
  /** The player's own speed multiplier (solo upgrades), on top of the weapon's. */
  pace: number;
}

export function createMoveState(x = 0, y = 0, z = 0): MoveState {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false, crouch: 0, slide: 0, sprinting: false, jumpLatch: false, landed: 0, pace: 1 };
}

export function copyMoveState(from: MoveState, to: MoveState): MoveState {
  Object.assign(to, from);
  return to;
}

export function playerHeight(state: MoveState) {
  return PLAYER.height + (PLAYER.crouchHeight - PLAYER.height) * state.crouch;
}

export function eyeHeight(state: MoveState) {
  return PLAYER.eye + (PLAYER.crouchEye - PLAYER.eye) * state.crouch;
}

const scratch: number[] = [];
const EPS = 1e-4;

function blocked(world: CollisionWorld, x: number, y: number, z: number, h: number) {
  const r = PLAYER.halfWidth;
  return world.overlaps(x - r, y, z - r, x + r, y + h, z + r, scratch).length > 0;
}

/** Move along one axis, stopping flush against the first box in the way. Returns true if blocked. */
function moveAxis(world: CollisionWorld, s: MoveState, axis: 0 | 1 | 2, delta: number, h: number): boolean {
  if (delta === 0) return false;
  const r = PLAYER.halfWidth;
  const pos = [s.x, s.y, s.z];
  pos[axis]! += delta;
  const hits = world.overlaps(pos[0]! - r, pos[1]!, pos[2]! - r, pos[0]! + r, pos[1]! + h, pos[2]! + r, scratch);
  if (hits.length === 0) {
    s.x = pos[0]!;
    s.y = pos[1]!;
    s.z = pos[2]!;
    return false;
  }
  const b = world.boxes;
  let limit = delta > 0 ? Infinity : -Infinity;
  for (const i of hits) {
    const o = i * 6;
    if (axis === 1) {
      limit = delta > 0 ? Math.min(limit, b[o + 1]! - h - EPS) : Math.max(limit, b[o + 4]! + EPS);
    } else {
      const lo = b[o + axis]!;
      const hi = b[o + 3 + axis]!;
      limit = delta > 0 ? Math.min(limit, lo - r - EPS) : Math.max(limit, hi + r + EPS);
    }
  }
  const start = axis === 0 ? s.x : axis === 1 ? s.y : s.z;
  // Never move backwards because of a box we were already touching.
  const next = delta > 0 ? Math.max(start, Math.min(start + delta, limit)) : Math.min(start, Math.max(start + delta, limit));
  if (axis === 0) s.x = next;
  else if (axis === 1) s.y = next;
  else s.z = next;
  return true;
}

function moveHorizontal(world: CollisionWorld, s: MoveState, dx: number, dz: number, h: number) {
  const hitX = moveAxis(world, s, 0, dx, h);
  const hitZ = moveAxis(world, s, 2, dz, h);
  return { hitX, hitZ };
}

/**
 * One fixed tick of player movement. Shared by the host simulation and client
 * prediction, so both must call it with identical inputs and dt.
 */
export function stepMove(world: CollisionWorld, s: MoveState, input: MoveInput, dt: number, speedScale = 1) {
  s.landed = 0;
  const forward = Math.max(-1, Math.min(1, input.forward));
  const right = Math.max(-1, Math.min(1, input.right));

  // Crouch (can't stand up under a ceiling).
  const wantCrouch = input.crouch || s.slide > 0;
  const target = wantCrouch ? 1 : 0;
  if (target < s.crouch) {
    const next = Math.max(target, s.crouch - MOVE.crouchRate * dt);
    const nextH = PLAYER.height + (PLAYER.crouchHeight - PLAYER.height) * next;
    if (!blocked(world, s.x, s.y, s.z, nextH)) s.crouch = next;
  } else if (target > s.crouch) {
    s.crouch = Math.min(target, s.crouch + MOVE.crouchRate * dt);
  }
  const h = playerHeight(s);

  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  // Yaw 0 looks toward -Z, matching a Three.js camera.
  let wx = -sin * forward + cos * right;
  let wz = -cos * forward - sin * right;
  const len = Math.hypot(wx, wz);
  if (len > 1) {
    wx /= len;
    wz /= len;
  }

  const horizontalSpeed = Math.hypot(s.vx, s.vz);
  s.sprinting = input.sprint && forward > 0.5 && !input.ads && s.crouch < 0.5 && s.slide <= 0;
  if (input.crouch && input.sprint && s.grounded && s.slide <= 0 && horizontalSpeed > MOVE.slideMinSpeed && forward > 0.5) {
    s.slide = MOVE.slideTime;
    const boost = Math.max(MOVE.slideSpeed, horizontalSpeed) / Math.max(horizontalSpeed, 0.001);
    s.vx *= boost;
    s.vz *= boost;
  }
  if (s.slide > 0) s.slide = Math.max(0, s.slide - dt);

  let maxSpeed = s.sprinting ? MOVE.sprint : s.crouch > 0.5 ? MOVE.crouch : MOVE.walk;
  if (input.ads && !s.sprinting) maxSpeed *= MOVE.adsScale;
  maxSpeed *= speedScale * s.pace;

  if (s.grounded) {
    const friction = s.slide > 0 ? MOVE.slideFriction : MOVE.friction;
    const speed = Math.hypot(s.vx, s.vz);
    if (speed > 0) {
      const drop = speed * friction * dt;
      const k = Math.max(0, speed - drop) / speed;
      s.vx *= k;
      s.vz *= k;
    }
    if (s.slide <= 0) accelerate(s, wx, wz, maxSpeed * Math.min(1, Math.hypot(wx, wz)), MOVE.groundAccel, dt);
    if (input.jump && !s.jumpLatch) {
      s.vy = MOVE.jumpSpeed;
      s.grounded = false;
      s.slide = 0;
    }
  } else {
    accelerate(s, wx, wz, maxSpeed * Math.min(1, Math.hypot(wx, wz)), MOVE.airAccel, dt);
  }
  s.jumpLatch = input.jump;

  s.vy -= MOVE.gravity * dt;

  // Horizontal move with automatic step-up onto ledges up to one brick high.
  const dx = s.vx * dt;
  const dz = s.vz * dt;
  const startX = s.x;
  const startY = s.y;
  const startZ = s.z;
  const flat = moveHorizontal(world, s, dx, dz, h);
  if ((flat.hitX || flat.hitZ) && s.grounded) {
    const flatX = s.x;
    const flatZ = s.z;
    const stepped = { ...s, x: startX, y: startY, z: startZ };
    if (!moveAxis(world, stepped, 1, PLAYER.stepHeight, h)) {
      moveHorizontal(world, stepped, dx, dz, h);
      moveAxis(world, stepped, 1, -PLAYER.stepHeight - EPS * 2, h);
      const flatDist = Math.hypot(flatX - startX, flatZ - startZ);
      const stepDist = Math.hypot(stepped.x - startX, stepped.z - startZ);
      if (stepDist > flatDist + 0.001 && stepped.y >= startY) {
        s.x = stepped.x;
        s.y = stepped.y;
        s.z = stepped.z;
      }
    }
  }
  if (Math.abs(s.x - startX) < Math.abs(dx) - 1e-6) s.vx = (s.x - startX) / dt;
  if (Math.abs(s.z - startZ) < Math.abs(dz) - 1e-6) s.vz = (s.z - startZ) / dt;

  // Vertical move.
  const wasGrounded = s.grounded;
  const fallSpeed = -s.vy;
  const hitY = moveAxis(world, s, 1, s.vy * dt, h);
  if (hitY) {
    if (s.vy < 0) {
      if (!wasGrounded) s.landed = fallSpeed;
      s.grounded = true;
    }
    s.vy = 0;
  } else {
    s.grounded = false;
    // Stick to the floor walking down stairs instead of hopping off each step.
    if (wasGrounded && s.vy <= 0) {
      const probe = { ...s };
      if (moveAxis(world, probe, 1, -PLAYER.stepHeight, h)) {
        s.y = probe.y;
        s.vy = 0;
        s.grounded = true;
      }
    }
  }
}

function accelerate(s: MoveState, wx: number, wz: number, wishSpeed: number, accel: number, dt: number) {
  const wishLen = Math.hypot(wx, wz);
  if (wishLen < 1e-5 || wishSpeed <= 0) return;
  const dirX = wx / wishLen;
  const dirZ = wz / wishLen;
  const current = s.vx * dirX + s.vz * dirZ;
  const add = wishSpeed - current;
  if (add <= 0) return;
  const gain = Math.min(add, accel * wishSpeed * dt * 0.25);
  s.vx += dirX * gain;
  s.vz += dirZ * gain;
  // Cap ground speed to the wish speed so strafing doesn't stack.
  const speed = Math.hypot(s.vx, s.vz);
  const cap = Math.max(wishSpeed, current);
  if (s.grounded && speed > cap && s.slide <= 0) {
    s.vx *= cap / speed;
    s.vz *= cap / speed;
  }
}

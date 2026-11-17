import type { Collider, Surface } from './types';

export type Vec3 = [number, number, number];

/** Collider used while planning a map; `walk` marks floors that get bot waypoints. */
export interface PlanCollider extends Collider {
  walk?: boolean;
}

/** Player movement limits shared by nav generation and validation. */
export const MOVE = {
  /** Ledges up to this height are stepped automatically. */
  step: 0.5,
  /** Highest ledge a jump reaches. */
  jump: 1.2,
  radius: 0.32,
  height: 1.75,
  /** Longest drop bots plan to take. */
  maxDrop: 4.2
} as const;

/** Small deterministic PRNG (mulberry32) so layouts never depend on Math.random. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }
  chance(p: number) {
    return this.next() < p;
  }
}

/** Yaw (0 faces -Z, as SpawnPoint) that looks from `from` toward `to` on the XZ plane. */
export function yawToward(from: [number, number], to: [number, number]) {
  return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
}

export function box(min: Vec3, max: Vec3, surface: Surface, extra: Partial<PlanCollider> = {}): PlanCollider {
  return {
    min: [Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.min(min[2], max[2])],
    max: [Math.max(min[0], max[0]), Math.max(min[1], max[1]), Math.max(min[2], max[2])],
    surface,
    ...extra
  };
}

/**
 * Placement of a model: position of its local origin plus quarter turns
 * around Y. Quarter turns keep collider boxes axis-aligned.
 */
export class Frame {
  readonly yaw: number;
  private c: number;
  private s: number;
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly turns = 0
  ) {
    const t = ((turns % 4) + 4) % 4;
    this.yaw = (t * Math.PI) / 2;
    this.c = [1, 0, -1, 0][t]!;
    this.s = [0, 1, 0, -1][t]!;
  }

  /** Local point to world, using three.js rotation.y convention. */
  p(lx: number, ly: number, lz: number): Vec3 {
    return [this.x + this.c * lx + this.s * lz, this.y + ly, this.z - this.s * lx + this.c * lz];
  }

  /** Local box (any corner order) to a world collider. */
  box(a: Vec3, b: Vec3, surface: Surface, extra: Partial<PlanCollider> = {}): PlanCollider {
    return box(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), surface, extra);
  }

  child(lx: number, ly: number, lz: number, turns = 0) {
    const [x, y, z] = this.p(lx, ly, lz);
    return new Frame(x, y, z, this.turns + turns);
  }
}

export function hashString(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mix two sRGB hex colors (t = 0 keeps a). */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function shade(color: string, amount: number) {
  return amount >= 0 ? mix(color, '#ffffff', amount) : mix(color, '#000000', -amount);
}

/** n = -z, s = +z, e = +x, w = -x. */
export type Face = 'n' | 's' | 'e' | 'w';

/** Local frame of a wall face: x runs along it, +z points out of the wall, y up. */
export function faceFrame(face: Face, x0: number, z0: number, x1: number, z1: number) {
  switch (face) {
    case 's':
      return { f: new Frame(x0, 0, z1, 0), length: x1 - x0, along: (u: number) => x0 + u };
    case 'n':
      return { f: new Frame(x1, 0, z0, 2), length: x1 - x0, along: (u: number) => x1 - u };
    case 'e':
      return { f: new Frame(x1, 0, z1, 1), length: z1 - z0, along: (u: number) => z1 - u };
    case 'w':
      return { f: new Frame(x0, 0, z0, 3), length: z1 - z0, along: (u: number) => z0 + u };
  }
}

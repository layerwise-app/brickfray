import type { WeaponId } from '../weapons/defs';
import type { Surface } from '../world/types';
import { PEAK_AT } from './sync';
import type { AudioEngine, WhizClass } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Where the player hears from, and how much wall is in the way of a source. */
export interface Ears {
  readonly listener: Vec3;
  occlusion(key: number | null, at: Vec3, lift?: number): number;
  /** What the ground is made of under `at`. */
  surfaceAt(at: Vec3): Surface;
}

/** The kind of round each gun sends past: the sniper's is supersonic (a crack before its whiz). */
const WHIZ: Record<WeaponId, WhizClass> = {
  ar: 'rifle',
  cannon: 'rifle',
  sniper: 'crack',
  pistol: 'small',
  buzzer: 'small',
  nailer: 'small',
  shotgun: 'small',
  pulse: 'energy',
  harpoon: 'spear'
};

/** Shown speed of a bullet (the tracers in fx/tracers.ts and game/match-view.ts); a strike is heard when it lands. */
export function bulletSpeed(weapon: WeaponId): number {
  return weapon === 'sniper' ? 700 : 330;
}

/** Remote strikes farther than this from the listener are not played (they drown in their own gunfire anyway). */
const STRIKE_RANGE = 26;
/** A remote bullet passing closer than this is heard going by. */
const NEAR_MISS = 4;
const MAX_FLIGHT = 0.3;
/** Of a shotgun volley only this many pellet strikes are played; the rest land under them. */
const PELLETS = 3;

export const SURFACES: ReadonlySet<string> = new Set<Surface>(['plastic', 'metal', 'wood', 'glass', 'foliage', 'water', 'stone']);

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Bullet strikes and fly-bys: the player's own, timed to the shown bullet, and other players' near the listener. */
export class BulletSounds {
  private pellets = 0;

  constructor(
    private readonly audio: AudioEngine,
    private readonly ears: Ears
  ) {}

  /** The start of one shot's worth of strikes (a shotgun volley counts its pellets). */
  volley(): void {
    this.pellets = 0;
  }

  /** The local player's bullet struck the world `travelled` m from the eye. */
  own(surface: Surface, at: Vec3, travelled: number, weapon: WeaponId, pellet: boolean): void {
    if (pellet && this.pellets++ >= PELLETS) return;
    const delay = Math.min(travelled / bulletSpeed(weapon), MAX_FLIGHT);
    this.audio.play(`impact:${surface}`, { position: at, volume: pellet ? 0.7 : 1, priority: 5, delay });
  }

  /** Another player's bullet struck a surface (or a third player: 'body') `travelled` m from their muzzle. */
  strike(surface: string, at: Vec3, travelled: number, weapon: WeaponId, pellet: boolean): void {
    if (surface !== 'body' && !SURFACES.has(surface)) return;
    const near = distance(this.ears.listener, at);
    if (near > STRIKE_RANGE || (pellet && this.pellets++ >= PELLETS)) return;
    this.audio.play(surface === 'body' ? 'impactBody' : `impact:${surface as Surface}`, {
      position: at,
      volume: (pellet ? 0.6 : 0.85) * (surface === 'body' ? 0.7 : 1),
      priority: near < 8 ? 5 : 3,
      delay: Math.min(travelled / bulletSpeed(weapon), MAX_FLIGHT),
      occlusion: this.ears.occlusion(null, at)
    });
  }

  /** Another player's shot from `from` (one path per pellet): a whiz where the closest path passes within NEAR_MISS. */
  flyby(from: Vec3, ends: readonly Vec3[], weapon: WeaponId): void {
    const l = this.ears.listener;
    let best: { at: Vec3; miss: number; travelled: number } | null = null;
    for (const to of ends) {
      const sx = to.x - from.x;
      const sy = to.y - from.y;
      const sz = to.z - from.z;
      const len2 = Math.max(sx * sx + sy * sy + sz * sz, 1e-6);
      const along = ((l.x - from.x) * sx + (l.y - from.y) * sy + (l.z - from.z) * sz) / len2;
      if (along <= 0.03 || along >= 0.98) continue;
      const at = { x: from.x + sx * along, y: from.y + sy * along, z: from.z + sz * along };
      const miss = distance(at, l);
      if (miss < NEAR_MISS && (!best || miss < best.miss)) best = { at, miss, travelled: Math.sqrt(len2) * along };
    }
    if (!best) return;
    const close = 1 - best.miss / NEAR_MISS;
    const id = `whiz:${WHIZ[weapon]}` as const;
    const rate = 0.92 + 0.16 * close;
    // Started early by its build-up so the peak lands as the bullet passes; a shot from close by skips into it.
    const pass = Math.min(best.travelled / bulletSpeed(weapon), MAX_FLIGHT);
    const build = PEAK_AT[id] ?? 0;
    this.audio.play(id, {
      position: best.at,
      volume: 0.45 + 0.55 * close,
      rate,
      priority: 7,
      delay: Math.max(pass - build / rate, 0),
      offset: Math.max(build - pass * rate, 0)
    });
  }
}

/** Clatters per second on average, the most at once, and how far away one is still played. */
const DEBRIS = { rate: 4, burst: 3, range: 12 };

/** Chips and shattered parts bouncing: a few clatters a second near the listener; the rest is left to the eye. */
export class DebrisSounds {
  private budget = DEBRIS.burst;
  private last = 0;

  constructor(
    private readonly audio: AudioEngine,
    private readonly ears: Ears,
    private readonly now: () => number = () => performance.now() / 1000
  ) {}

  bounce(at: Vec3, speed: number): void {
    const t = this.now();
    this.budget = Math.min(DEBRIS.burst, this.budget + (t - this.last) * DEBRIS.rate);
    this.last = t;
    const near = distance(this.ears.listener, at);
    if (near > DEBRIS.range || this.budget < 1) return;
    this.budget -= 1;
    const volume = 0.5 + 0.5 * Math.min(speed / 5, 1);
    this.audio.play('brickClatter', { position: at, volume, priority: 1 });
  }
}

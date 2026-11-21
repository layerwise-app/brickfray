import type { BotKind, CharacterId } from '../characters/types';
import type { MatchPhase } from '../sim/types';
import { MELEES, type MeleeId, type WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { MELEE_CONTACT } from '../weapons/view/clips-melee';
import type { ViewAction } from '../weapons/types';
import { cycleClip, loadsShells, reloadClip } from '../weapons/view/clips-guns';
import type { MapId, Surface } from '../world/types';
import { BulletSounds, DebrisSounds, SURFACES, type Ears, type Vec3 } from './bullet-sounds';
import { gearOf } from './gear';
import { reloadLayers, type ReloadLayer } from './reload-layers';
import { GROUND, RemoteSounds } from './remote-sounds';
import { pickSpot } from './scenery';
import type { AudioEngine, MeleeClass, MeleeHit, SoundId } from './types';

/** Each melee weapon's swing through the air and its strike. */
const MELEE_SOUND: Record<MeleeId, { swing: MeleeClass; hit: MeleeHit }> = {
  mallet: { swing: 'blunt', hit: 'mallet' },
  sword: { swing: 'blade', hit: 'blade' },
  knife: { swing: 'blade', hit: 'blade' },
  hatchet: { swing: 'blade', hit: 'chop' },
  anchor: { swing: 'heavy', hit: 'iron' },
  wrench: { swing: 'blunt', hit: 'clank' }
};

function meleeSound(character: CharacterId | BotKind | undefined) {
  return MELEE_SOUND[character ? LOADOUTS[character].melee : 'mallet'];
}


/** Seconds between the hit check and the moment the first-person swing is shown landing. */
function shownLate(character: CharacterId | BotKind): number {
  const melee = LOADOUTS[character].melee;
  return MELEE_CONTACT[melee] - MELEES[melee].windup;
}

/** A swing into the world: the surface's contact level, and the weapon's strike under it, a little dulled. */
const WALL_HIT = { surface: 1.3, weapon: 0.45, tone: 0.7 };

/** A swing peaks 30-50 ms after its first sample; a remote miss is reported at the strike and starts just before the peak. */
const SWING_SKIP = 0.03;

/** The player's own step level (-1.4 dB), and lower (-3.7 dB) for `hold` s after another player stepped within `near` m. */
const OWN_STEP = { level: 0.85, ducked: 0.65, near: 15, hold: 0.8 };

/** View actions that end a reload before its layers have played. */
const INTERRUPTS: ReadonlySet<ViewAction['type']> = new Set(['cancelReload', 'switch', 'melee', 'grenadeCook', 'grenadeThrow']);
/** Reload layers are handed to the engine this long before they are due, with the rest as a delay: sample-exact timing. */
const LAYER_LEAD = 0.05;

/** Seconds an ejected case takes to reach the floor. */
const FALL = 0.48;
/** Auto fire drops at most one audible case per this many seconds. */
const CASE_GAP = 0.11;
const LOW_HEALTH = 30;
const OCCLUSION_TTL = 0.22;
/**
 * Rays from the ear to points around a source, [up, sideways] in metres, with their share of the occlusion: the
 * direct line counts most, the others say how much of the source shows round or over the obstacle.
 */
const PROBES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.4],
  [0.75, 0, 0.15],
  [1.5, 0, 0.15],
  [0.5, -0.7, 0.15],
  [0.5, 0.7, 0.15]
];
/** A cached source's occlusion follows the probes with this time constant, so passing a corner fades the sound. */
const OCCLUSION_GLIDE = 0.15;

/** Guns that throw a case with every shot (CASING in weapons/view/rig.ts); the others eject while the pump or bolt is worked. */
const CASE_ON_FIRE: ReadonlySet<WeaponId> = new Set(['ar', 'pistol', 'buzzer']);

/** When the clip the view model plays for a worked action or reload throws a case out, read from the clip itself. */
function ejection(action: ViewAction, weapon: WeaponId): { id: 'casing' | 'shell'; at: number } | null {
  const clip =
    action.type === 'cycle' ? cycleClip(weapon, action.duration) : action.type === 'reload' && !loadsShells(weapon) ? reloadClip(weapon, action.empty, action.duration) : null;
  const event = clip?.events.find(([, e]) => e === 'eject' || e === 'shellEject');
  return clip && event ? { id: event[1] === 'shellEject' ? 'shell' : 'casing', at: event[0] * clip.duration } : null;
}

/** How a case sounds where it lands: [volume, rate]. Foliage swallows it; water gets a small plip instead. */
const LANDING: Record<Surface, readonly [number, number]> = {
  plastic: [0.5, 1],
  stone: [0.55, 0.96],
  metal: [0.55, 1.08],
  glass: [0.5, 1.12],
  wood: [0.4, 0.88],
  foliage: [0.1, 0.8],
  water: [0.12, 1.6]
};

export interface MatchAudioState {
  alive: boolean;
  health: number;
  sliding: boolean;
  /** Surface under the local player. */
  surface: Surface;
  listener: { x: number; y: number; z: number };
}

interface Pending {
  at: number;
  id: SoundId;
  volume: number;
  rate: number;
}

/**
 * The parts of a match's sound that no single game event carries: low-health heartbeat, slide, countdown and
 * match stingers, falling cases, scenery around the listener, and how much wall sits in front of a source.
 */
export class MatchAudio implements Ears {
  readonly listener = { x: 0, y: 0, z: 0 };
  readonly bullets: BulletSounds;
  readonly debris: DebrisSounds;
  readonly remotes: RemoteSounds;
  private clock = 0;
  private readonly pending: Pending[] = [];
  /** The running reload's layers, `at` on this clock. */
  private layers: ReloadLayer[] = [];
  private lastCase = -1;
  private beat = 0;
  private wasSliding = false;
  private phase: MatchPhase | null = null;
  private counted = 0;
  private heardStep = -Infinity;
  private nextSpot = 4 + Math.random() * 6;
  private surface: Surface = 'plastic';
  private readonly occluded = new Map<number, { until: number; at: number; value: number }>();

  constructor(
    private readonly audio: AudioEngine,
    private readonly map: MapId,
    /** True when nothing solid blocks the segment. */
    private readonly clear: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean,
    private readonly ground: (x: number, y: number, z: number) => Surface = () => 'plastic'
  ) {
    this.bullets = new BulletSounds(audio, this);
    this.debris = new DebrisSounds(audio, this);
    this.remotes = new RemoteSounds(audio, this);
  }

  /**
   * View-model actions of the local player pass through here: a shot or a worked action drops a case; a reload
   * schedules the hand and magazine sounds between its cues.
   */
  action(action: ViewAction, weapon: WeaponId): void {
    if (action.type === 'fire') {
      if (CASE_ON_FIRE.has(weapon)) this.dropCase('casing', FALL);
      return;
    }
    if (action.type === 'reload') this.layers = reloadLayers(weapon, action.empty, action.duration).layers.map((l) => ({ at: this.clock + l.at, id: l.id }));
    else if (INTERRUPTS.has(action.type)) this.layers = [];
    const eject = ejection(action, weapon);
    if (eject) this.dropCase(eject.id, eject.at + FALL);
  }

  /**
   * A footstep (`at` null for the local player, `source` the walker's id) with the walker's outfit layered on it.
   * The player's own steps sit a little back, and further while someone else walks within OWN_STEP.near metres.
   */
  footstep(surface: Surface, character: CharacterId | BotKind | undefined, at: { x: number; y: number; z: number } | null, volume: number, priority: number, occlusion = 0, source?: number): void {
    const position = at ? { x: at.x, y: at.y, z: at.z } : undefined;
    if (at && Math.hypot(at.x - this.listener.x, at.y - this.listener.y, at.z - this.listener.z) < OWN_STEP.near) this.heardStep = this.clock;
    const level = at ? volume : volume * (this.clock - this.heardStep < OWN_STEP.hold ? OWN_STEP.ducked : OWN_STEP.level);
    this.audio.play(`step:${surface}`, { position, volume: level, priority, occlusion, source });
    const gear = gearOf(character);
    if (gear) this.audio.play(`gear:${gear}`, { position, volume: level, priority: priority - 1, occlusion, source });
  }

  /** A jump, landing or slide (`at` null for the local player) with the ground's own footstep under it. */
  movement(kind: 'jump' | 'land' | 'slide', surface: Surface, at: Vec3 | null, volume: number, priority: number, occlusion = 0, source?: number): void {
    const position = at ? { x: at.x, y: at.y, z: at.z } : undefined;
    this.audio.play(kind, { position, volume, priority, occlusion, source });
    this.audio.play(`step:${surface}`, { position, volume: volume * GROUND[kind], priority: priority - 1, occlusion, source });
  }

  /** A grenade striking the ground at `speed` m/s: a soft touch is quiet and dull, a hard throw loud and bright. */
  bounce(at: Vec3, speed: number): void {
    const hard = Math.min(Math.max(speed / 9, 0.12), 1);
    const position = { x: at.x, y: at.y, z: at.z };
    const occlusion = this.occlusion(null, position, 0.2);
    this.audio.play('grenadeBounce', { position, volume: 0.3 + 0.7 * hard, tone: 0.25 + 0.75 * hard, priority: 4, occlusion });
    this.audio.play(`step:${this.surfaceAt(position)}`, { position, volume: 0.25 + 0.45 * hard, tone: 0.4 + 0.6 * hard, priority: 3, occlusion });
  }

  surfaceAt(at: Vec3): Surface {
    return this.ground(at.x, at.y, at.z);
  }

  /** The local player's swing, cued by the view model 42-54 ms before the weapon is shown landing. */
  swing(character: CharacterId | BotKind): void {
    this.audio.play(`meleeSwing:${meleeSound(character).swing}`, { volume: 0.9, priority: 6 });
  }

  /**
   * A melee strike was resolved. `at` is null for the local player, whose swing has already played; `wall` is where
   * a swing that met no one struck the world.
   */
  melee(character: CharacterId | BotKind | undefined, hit: boolean, at: Vec3 | null, own: boolean, wall?: { surface: string; at: readonly [number, number, number] }): void {
    const kind = meleeSound(character);
    const late = own && character ? shownLate(character) : 0;
    if (own) {
      if (hit) this.audio.play(`meleeHit:${kind.hit}`, { priority: 8, delay: late });
    } else if (at) {
      const position = { x: at.x, y: at.y + 1.2, z: at.z };
      const occlusion = this.occlusion(null, position);
      if (hit) this.audio.play(`meleeHit:${kind.hit}`, { position, priority: 6, occlusion });
      else this.audio.play(`meleeSwing:${kind.swing}`, { position, offset: SWING_SKIP, priority: 5, occlusion });
    }
    if (hit || !wall || !SURFACES.has(wall.surface)) return;
    // The surface's own contact (its footstep recording, struck harder) with the weapon's strike under it.
    const position = { x: wall.at[0], y: wall.at[1], z: wall.at[2] };
    const occlusion = this.occlusion(null, position);
    this.audio.play(`step:${wall.surface as Surface}`, { position, volume: WALL_HIT.surface, priority: 6, delay: late, occlusion });
    this.audio.play(`meleeHit:${kind.hit}`, { position, volume: WALL_HIT.weapon, tone: WALL_HIT.tone, priority: 5, delay: late, occlusion });
  }

  /** Countdown ticks over the last three seconds of warmup, a semitone higher each second, then the start and end stingers. */
  setPhase(phase: MatchPhase, left: number): void {
    if (phase === 'warmup' && left > 0 && left <= 3) {
      const second = Math.ceil(left);
      if (second !== this.counted) {
        this.counted = second;
        this.audio.play('countdown', { priority: 9, rate: 2 ** ((3 - second) / 12) });
      }
    }
    if (phase === this.phase) return;
    if (this.phase === 'warmup' && phase === 'playing') this.audio.play('matchStart', { priority: 9 });
    if (this.phase !== null && phase === 'ended') this.audio.play('matchEnd', { priority: 9 });
    this.phase = phase;
    this.counted = 0;
  }

  /**
   * How much solid world sits between the listener and a source, 0…1: the weighted share of PROBES rays that are
   * blocked. `lift` raises a position given at the feet. Cached per `key` (a player id) for a few frames and glided
   * toward each new reading.
   */
  occlusion(key: number | null, at: { x: number; y: number; z: number }, lift = 0): number {
    const cached = key === null ? undefined : this.occluded.get(key);
    if (cached && cached.until > this.clock) return cached.value;
    const l = this.listener;
    const dx = at.x - l.x;
    const dz = at.z - l.z;
    const across = Math.hypot(dx, dz) || 1;
    let blocked = 0;
    for (const [up, side, share] of PROBES) {
      if (!this.clear(l.x, l.y, l.z, at.x - (dz / across) * side, at.y + lift + up, at.z + (dx / across) * side)) blocked += share;
    }
    const glide = cached ? Math.exp(-(this.clock - cached.at) / OCCLUSION_GLIDE) : 0;
    const value = blocked + ((cached?.value ?? blocked) - blocked) * glide;
    if (key !== null) this.occluded.set(key, { until: this.clock + OCCLUSION_TTL, at: this.clock, value });
    return value;
  }

  frame(dt: number, state: MatchAudioState): void {
    this.clock += dt;
    this.surface = state.surface;
    Object.assign(this.listener, state.listener);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.at > this.clock) continue;
      this.pending.splice(i, 1);
      this.land(p);
    }
    if (!state.alive) this.layers = [];
    while (this.layers.length && this.layers[0]!.at <= this.clock + LAYER_LEAD) {
      const layer = this.layers.shift()!;
      this.audio.play(layer.id, { volume: 0.8, priority: 5, delay: Math.max(layer.at - this.clock, 0) });
    }
    if (state.sliding && !this.wasSliding && state.alive) this.movement('slide', state.surface, null, 0.7, 4);
    this.wasSliding = state.sliding;
    this.heartbeat(dt, state);
    this.scenery(dt);
  }

  dispose(): void {
    this.pending.length = 0;
    this.layers = [];
    this.occluded.clear();
    this.remotes.clear();
  }

  private dropCase(id: 'casing' | 'shell', delay: number): void {
    if (this.clock - this.lastCase < CASE_GAP) return;
    this.lastCase = this.clock;
    this.pending.push({ at: this.clock + delay + Math.random() * 0.08, id, volume: 1, rate: 1 });
  }

  private land(p: Pending): void {
    const [volume, rate] = LANDING[this.surface];
    if (this.surface === 'water') this.audio.play('impact:water', { volume, rate, priority: 1 });
    else this.audio.play(p.id, { volume: p.volume * volume, rate: p.rate * rate, priority: 2 });
  }

  /** Faster and louder as health runs out. */
  private heartbeat(dt: number, state: MatchAudioState): void {
    if (!state.alive || state.health >= LOW_HEALTH) {
      this.beat = 0;
      return;
    }
    const danger = 1 - state.health / LOW_HEALTH;
    this.beat -= dt;
    if (this.beat > 0) return;
    this.beat = 1 - 0.4 * danger;
    this.audio.play('heartbeat', { volume: 0.55 + 0.4 * danger, priority: 7 });
  }

  private scenery(dt: number): void {
    this.nextSpot -= dt;
    if (this.nextSpot > 0) return;
    this.nextSpot = 5 + Math.random() * 10;
    const { spot, position } = pickSpot(this.map, Math.random);
    this.audio.play(`spot:${spot}`, { position, volume: 0.6 + Math.random() * 0.4, occlusion: this.occlusion(null, position) });
  }
}

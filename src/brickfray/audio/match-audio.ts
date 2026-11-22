import type { BotKind, CharacterId } from '../characters/types';
import { MELEES, type MeleeId, type WeaponId } from '../weapons/defs';
import { LOADOUTS } from '../weapons/loadouts';
import { MELEE_CONTACT } from '../weapons/view/clips-melee';
import type { ViewAction } from '../weapons/types';
import type { MapId, Surface } from '../world/types';
import { BulletSounds, DebrisSounds, SURFACES, type Ears, type Vec3 } from './bullet-sounds';
import { CaseSounds } from './cases';
import { gearOf } from './gear';
import { Heartbeat } from './heartbeat';
import { MatchCues } from './match-cues';
import { reloadLayers, type ReloadLayer } from './reload-layers';
import { GROUND, RemoteSounds } from './remote-sounds';
import { pickSpot } from './scenery';
import type { AudioEngine, HeldSound, MeleeClass, MeleeHit, SoundId } from './types';

/** Each melee weapon's swing through the air and its strike. */
const MELEE_SOUND: Record<MeleeId, { swing: MeleeClass; hit: MeleeHit }> = {
  mallet: { swing: 'blunt', hit: 'mallet' },
  sword: { swing: 'sword', hit: 'slash' },
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

/**
 * Being shot: the first bullet thumps at `volume`; while hits keep coming less than `quiet` s apart they merge, one
 * ducked thump at most every `gap` s, so a burst reads as one blow and not a drum roll.
 */
const HURT = { volume: 0.8, ducked: 0.3, quiet: 0.25, gap: 0.15 };

/** A headshot kill rings the headshot ping this many seconds in front of the kill sound, which stays the same. */
const HEADSHOT_LEAD = 0.07;

/**
 * A cooked grenade's fuse ticks from the pin pull (`from` s into the cook) until the throw, the gap closing from
 * `gap[0]` to `gap[1]` s by the longest cook (`full` s), so the hand hears how long it has held.
 */
const FUSE = { from: 0.45, full: 2.5, gap: [0.42, 0.16], volume: 0.75 } as const;
/** A slide: the push-off one-shot, then a scrape held as long as the slide lasts. */
const SLIDE = { volume: 0.7, scrape: 0.55, fade: 0.14 };

/** View actions that end a reload before its layers have played. */
const INTERRUPTS: ReadonlySet<ViewAction['type']> = new Set(['cancelReload', 'switch', 'melee', 'grenadeCook', 'grenadeThrow']);
/** Reload layers are handed to the engine this long before they are due, with the rest as a delay: sample-exact timing. */
const LAYER_LEAD = 0.05;

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
/** A scenery sound is drawn from this many places of its kind, the least hidden and nearest (one SPOT_REACH counts as a whole wall) winning. */
const SPOT_TRIES = 4;
const SPOT_REACH = 60;
/** When every place of the drawn kind is behind a wall (occlusion at least SPOT_HIDDEN), another kind is drawn, up to SPOT_DRAWS in all. */
const SPOT_DRAWS = 3;
const SPOT_HIDDEN = 0.9;
/** Scenery sits high and wide: what a wall hides of it still carries over the roofline, so a hidden one is softened (occlusion at most this), never muffled. */
const SPOT_OCCLUSION = 0.5;

export interface MatchAudioState {
  alive: boolean;
  health: number;
  sliding: boolean;
  /** Surface under the local player. */
  surface: Surface;
  listener: { x: number; y: number; z: number };
}

/**
 * The parts of a match's sound that no single game event carries: low-health heartbeat, slide scrape, a cooked
 * grenade's fuse, the match's cues and music (cues), falling cases, scenery around the listener, and how much wall
 * sits in front of a source.
 */
export class MatchAudio implements Ears {
  readonly listener = { x: 0, y: 0, z: 0 };
  readonly bullets: BulletSounds;
  readonly debris: DebrisSounds;
  readonly remotes: RemoteSounds;
  private clock = 0;
  /** The running reload's layers, `at` on this clock. */
  private layers: ReloadLayer[] = [];
  private wasSliding = false;
  private scrape: HeldSound | null = null;
  /** Clock time the grenade in hand was pressed, and of its next fuse tick; null when none is cooking. */
  private cook: { at: number; tick: number } | null = null;
  private heardStep = -Infinity;
  private lastHit = -Infinity;
  private lastHurt = -Infinity;
  private nextSpot = 4 + Math.random() * 6;
  private readonly heart: Heartbeat;
  readonly cues: MatchCues;
  private readonly cases: CaseSounds;
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
    this.heart = new Heartbeat(audio);
    this.cues = new MatchCues(audio, map);
    this.cases = new CaseSounds(audio);
  }

  /**
   * View-model actions of the local player pass through here: a shot or a worked action drops a case; a reload
   * schedules the hand and magazine sounds between its cues.
   */
  action(action: ViewAction, weapon: WeaponId): void {
    this.cases.action(action, weapon, this.clock);
    if (action.type === 'fire') return;
    if (action.type === 'grenadeCook') this.cook = { at: this.clock, tick: this.clock + FUSE.from };
    else if (action.type === 'grenadeThrow' || action.type === 'switch' || action.type === 'melee') this.cook = null;
    if (action.type === 'reload') this.layers = reloadLayers(weapon, action.empty, action.duration).layers.map((l) => ({ at: this.clock + l.at, id: l.id }));
    else if (INTERRUPTS.has(action.type)) this.layers = [];
  }

  /**
   * A footstep (`at` null for the local player, `source` the walker's id) with the walker's outfit layered on it.
   * The player's own steps sit a little back, and further while someone else walks within OWN_STEP.near metres.
   */
  footstep(surface: Surface, character: CharacterId | BotKind | undefined, at: { x: number; y: number; z: number } | null, volume: number, priority: number, occlusion = 0, source?: number): void {
    if (!at && this.wasSliding) return;
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

  /** The local player took a hit from someone else. */
  hurt(): void {
    const burst = this.clock - this.lastHit < HURT.quiet;
    this.lastHit = this.clock;
    if (burst && this.clock - this.lastHurt < HURT.gap) return;
    this.lastHurt = this.clock;
    this.audio.play('hurt', { volume: burst ? HURT.ducked : HURT.volume, priority: 8 });
  }

  /** The local player killed someone: always the same kill sound, a headshot's ping just in front of it. */
  kill(headshot: boolean): void {
    if (headshot) this.audio.play('headshotMarker', { priority: 9 });
    this.audio.play('killConfirm', { priority: 9, delay: headshot ? HEADSHOT_LEAD : 0 });
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
    Object.assign(this.listener, state.listener);
    this.cases.frame(this.clock, state.surface);
    if (!state.alive) this.layers = [];
    while (this.layers.length && this.layers[0]!.at <= this.clock + LAYER_LEAD) {
      const layer = this.layers.shift()!;
      this.audio.play(layer.id, { volume: 0.8, priority: 5, delay: Math.max(layer.at - this.clock, 0) });
    }
    this.slide(state.sliding && state.alive, state.surface);
    this.fuse(state.alive);
    this.heart.frame(dt, state.alive, state.health);
    this.cues.frame(dt);
    this.scenery(dt);
  }

  dispose(): void {
    this.cases.dispose();
    this.layers = [];
    this.scrape?.stop();
    this.scrape = null;
    this.cook = null;
    this.occluded.clear();
    this.remotes.clear();
  }

  private slide(sliding: boolean, surface: Surface): void {
    if (sliding && !this.wasSliding) {
      this.movement('slide', surface, null, SLIDE.volume, 4);
      this.scrape = this.audio.hold('slideLoop', { volume: SLIDE.scrape, priority: 4 });
    } else if (!sliding && this.wasSliding) {
      this.scrape?.stop(SLIDE.fade);
      this.scrape = null;
    }
    this.wasSliding = sliding;
  }

  private fuse(alive: boolean): void {
    const cook = this.cook;
    if (!cook) return;
    if (!alive) {
      this.cook = null;
      return;
    }
    while (cook.tick <= this.clock + LAYER_LEAD) {
      this.audio.play('grenadeFuse', { volume: FUSE.volume, priority: 6, delay: Math.max(cook.tick - this.clock, 0) });
      const held = Math.min((cook.tick - cook.at - FUSE.from) / (FUSE.full - FUSE.from), 1);
      cook.tick += FUSE.gap[0] + (FUSE.gap[1] - FUSE.gap[0]) * held;
    }
  }

  private scenery(dt: number): void {
    this.nextSpot -= dt;
    if (this.nextSpot > 0) return;
    this.nextSpot = 5 + Math.random() * 10;
    const l = this.listener;
    const rank = (at: Vec3) => this.occlusion(null, at) + Math.hypot(at.x - l.x, at.y - l.y, at.z - l.z) / SPOT_REACH;
    let pick = pickSpot(this.map, Math.random, rank, SPOT_TRIES);
    let occlusion = this.occlusion(null, pick.position);
    for (let draw = 1; draw < SPOT_DRAWS && occlusion >= SPOT_HIDDEN; draw++) {
      pick = pickSpot(this.map, Math.random, rank, SPOT_TRIES);
      occlusion = this.occlusion(null, pick.position);
    }
    this.audio.play(`spot:${pick.spot}`, { position: pick.position, volume: 0.6 + Math.random() * 0.4, occlusion: Math.min(occlusion, SPOT_OCCLUSION) });
  }
}

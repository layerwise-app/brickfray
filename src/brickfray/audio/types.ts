import type * as THREE from 'three';
import type { WeaponId } from '../weapons/defs';
import type { MapId, Surface } from '../world/types';
import type { ViewCue } from '../weapons/types';

/** How a melee weapon sounds: mallet-like, edged, or a lump of metal. */
/** What a melee weapon's swing sounds like through the air. */
export type MeleeClass = 'blunt' | 'blade' | 'heavy';
/** What a melee weapon sounds like striking: blade ring, wood chop, heavy iron, rubber mallet, wrench clank. */
export type MeleeHit = 'blade' | 'chop' | 'iron' | 'mallet' | 'clank';
/** The kind of round passing the listener. */
export type WhizClass = 'small' | 'rifle' | 'crack' | 'energy' | 'spear';

/** A view-model cue that makes a handling sound (the swing has its own melee whoosh). */
export type HandlingCue = Exclude<ViewCue, 'swing'>;

/** Weapon-family reload and action sounds; audio/foley.ts says which gun plays which for a view cue. */
export type FoleyId =
  | 'pistolMagOut'
  | 'pistolMagIn'
  | 'boltOpen'
  | 'boltClose'
  | 'boltMagOut'
  | 'boltMagIn'
  | 'cylinderOpen'
  | 'cylinderEject'
  | 'cylinderLoad'
  | 'cylinderClose'
  | 'spearFetch'
  | 'spearSeat'
  | 'spearHome'
  | 'stripOut'
  | 'stripIn'
  | 'cellOut'
  | 'cellIn'
  | 'smgMagOut'
  | 'smgMagIn'
  | 'smgBoltBack'
  | 'smgBoltForward'
  | 'driverBack'
  | 'driverHome'
  | 'chargeUp'
  | 'chargeLock'
  | 'rifleDraw'
  | 'rifleHolster'
  | 'pistolDraw'
  | 'pistolHolster'
  | 'toolDraw'
  | 'toolHolster'
  | 'gripOff'
  | 'pouch'
  | 'magScrape'
  | 'regrip';

/** What a character wears that sounds with each step: plate armour, a suit, or loose gear. */
export type GearId = 'armour' | 'suit' | 'rattle';

/** One-shots scattered around the listener on top of a map's ambience bed. */
export type AmbientSpot = 'bird' | 'crow' | 'pigeon' | 'bell' | 'flag' | 'gull' | 'creak' | 'horn';

export type SoundId =
  | `fire:${WeaponId}`
  | `fireFar:${WeaponId}`
  | 'dryFire'
  | `cue:${HandlingCue}`
  | `foley:${FoleyId}`
  | `step:${Surface}`
  | `gear:${GearId}`
  | 'land'
  | 'jump'
  | 'slide'
  | `impact:${Surface}`
  | 'impactBody'
  | 'impactHead'
  | 'hitmarker'
  | 'headshotMarker'
  | 'killConfirm'
  | 'hurt'
  | 'death'
  | 'shatter'
  | 'brickClatter'
  | 'casing'
  | 'shell'
  | `whiz:${WhizClass}`
  | 'grenadeBounce'
  | 'explosion'
  | 'explosionFar'
  | `meleeHit:${MeleeHit}`
  | `meleeSwing:${MeleeClass}`
  | `spot:${AmbientSpot}`
  | 'heartbeat'
  | 'respawn'
  | 'uiHover'
  | 'uiClick'
  | 'uiBack'
  | 'matchStart'
  | 'matchEnd'
  | 'waveStart'
  | 'countdown';

export type MusicTrack = 'menu' | 'match';

export interface PlayOptions {
  /** World position; omit for 2D (own player, UI). */
  position?: { x: number; y: number; z: number };
  volume?: number;
  /** Playback-rate multiplier on top of built-in variation. */
  rate?: number;
  /** Higher survives voice stealing (0–10, default 5). */
  priority?: number;
  /** How much solid world sits between the source and the listener, 0…1: duller and quieter. */
  occlusion?: number;
  /** Skip this many seconds of the sound (an event that reports the strike plays a swing from its peak). */
  offset?: number;
  /** Start this many seconds from now (a blow resolved before the swing is shown landing). */
  delay?: number;
  /** Who makes the sound (a player id): identical sounds from different sources are never merged as one burst. */
  source?: number;
  /** Brightness of a positional sound, 0 (a dull knock) … 1 (as recorded, the default). */
  tone?: number;
  /** Play this recorded take instead of a random one: a sequence whose steps are takes of one sound. */
  variant?: number;
}

export interface AudioMix {
  master: number;
  effects: number;
  music: number;
  ui: number;
}

export interface AudioEngine {
  /** Call from a user gesture; resolves when sounds are rendered and ready. */
  unlock(): Promise<void>;
  play(id: SoundId, options?: PlayOptions): void;
  setListener(position: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3): void;
  setMix(mix: AudioMix): void;
  /** Muffle the world (low health), 0…1. */
  setMuffle(amount: number): void;
  /** Pause everything while the tab is hidden. */
  setSuspended(suspended: boolean): void;
  /** Crossfade to a looping track on the music bus at `level` (0…1, default 1); null fades music out. Starts once rendered. */
  playMusic(track: MusicTrack | null, level?: number): void;
  /** The map being played: its ambience bed and its reverb. null in menus. */
  setScene(map: MapId | null): void;
  dispose(): void;
}

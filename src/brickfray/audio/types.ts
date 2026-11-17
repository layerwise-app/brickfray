import type * as THREE from 'three';
import type { WeaponId } from '../weapons/defs';
import type { Surface } from '../world/types';
import type { ViewCue } from '../weapons/types';

export type SoundId =
  | `fire:${WeaponId}`
  | `fireFar:${WeaponId}`
  | 'dryFire'
  | `cue:${ViewCue}`
  | `step:${Surface}`
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
  | 'whiz'
  | 'grenadeBounce'
  | 'explosion'
  | 'malletHit'
  | 'malletMiss'
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
  /** Crossfade to a looping track on the music bus; null fades music out. Starts once rendered. */
  playMusic(track: MusicTrack | null): void;
  dispose(): void;
}

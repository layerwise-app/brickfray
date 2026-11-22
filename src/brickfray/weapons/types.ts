import type * as THREE from 'three';
import type { CharacterId } from '../characters/types';
import type { Atmosphere } from '../engine/renderer';
import type { WeaponId } from './defs';
import type { ModelId } from './model';

/**
 * A gun model. Origin = where the right hand holds the pistol grip, barrel
 * along -Z, top up +Y. Units are meters at real-world gun scale.
 */
export interface WeaponModel {
  readonly id: ModelId;
  readonly root: THREE.Group;
  /** Tip of the barrel; flash and tracers start here. -Z points out of the barrel. */
  readonly muzzle: THREE.Object3D;
  /** Where spent casings pop out. */
  readonly ejectPort: THREE.Object3D | null;
  /** Left-hand grip target. */
  readonly supportGrip: THREE.Object3D | null;
  /** A point on the sight line; aiming puts it on the camera axis. */
  readonly sight: THREE.Object3D | null;
  /** Moving parts the reload/cycle animation drives, when present. */
  readonly parts: {
    magazine?: THREE.Object3D;
    bolt?: THREE.Object3D;
    pump?: THREE.Object3D;
    slide?: THREE.Object3D;
    hammer?: THREE.Object3D;
    pin?: THREE.Object3D;
  };
  dispose(): void;
}

export type ViewAction =
  | { type: 'fire'; empty: boolean }
  | { type: 'reload'; empty: boolean; duration: number }
  | { type: 'reloadShell'; index: number; duration: number }
  | { type: 'reloadEnd' }
  | { type: 'cancelReload' }
  | { type: 'cycle'; duration: number }
  | { type: 'melee' }
  | { type: 'grenadeCook' }
  | { type: 'grenadeThrow'; low: boolean }
  | { type: 'switch'; to: WeaponId; holster: number; draw: number }
  | { type: 'land'; impact: number }
  | { type: 'hurt'; strength: number };

/** Per-frame state for first-person motion. */
export interface ViewInput {
  /** Horizontal speed m/s and whether sprinting. */
  speed: number;
  sprint: boolean;
  grounded: boolean;
  crouch: number;
  sliding: boolean;
  /** Aim blend 0…1, already timed by the game from adsTime. */
  ads: number;
  /** Mouse look delta this frame in radians (yaw, pitch). */
  look: { yaw: number; pitch: number };
  /** Seconds of time, for idle breathing. */
  time: number;
}

/** Reload/animation beats the audio layer plays on. */
export type ViewCue =
  | 'magOut'
  | 'magIn'
  | 'boltBack'
  | 'boltForward'
  | 'pumpBack'
  | 'pumpForward'
  | 'shellIn'
  | 'slideBack'
  | 'slideForward'
  | 'pinPull'
  | 'throw'
  | 'swing'
  | 'draw'
  | 'holster'
  | 'cloth';

export interface ViewModel {
  /** Rendered after the world with its own camera and a depth clear. */
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  setCharacter(id: CharacterId): void;
  /** Instantly show this weapon (spawn). */
  equip(id: WeaponId): void;
  act(action: ViewAction): void;
  /** The game's word on the player's last melee strike: a landed blow catches in the target, a whiff follows straight through. */
  meleeLanded(hit: boolean): void;
  update(dt: number, input: ViewInput): void;
  /** Muzzle position in the view camera's space (for tracers and flash). */
  muzzleViewPosition(out: THREE.Vector3): THREE.Vector3;
  /** Gait bob phase in radians, one cycle per two steps: footsteps land on it. */
  readonly stepPhase: number;
  /** Called on animation beats. */
  onCue: ((cue: ViewCue) => void) | null;
  /** Hide the gun and hands (the player is dead); the view model puts them away for a scope picture itself. */
  setHidden(hidden: boolean): void;
  /** World camera orientation each frame, so view-layer light and reflections match the world sun. */
  orient(worldCameraQuaternion: THREE.Quaternion): void;
  /** Match the view layer's lighting to the map's atmosphere (defaults to DEFAULT_ATMOSPHERE). */
  setAtmosphere(atmosphere: Atmosphere): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

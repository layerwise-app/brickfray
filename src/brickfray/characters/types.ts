import type * as THREE from 'three';
import type { WeaponId } from '../weapons/defs';
import type { Stance } from './stance';
import type { StowPlace } from './stow';

export type CharacterId = 'rivet' | 'vega' | 'clack' | 'coral' | 'moss' | 'nova';
export type BotKind = 'grunt' | 'rusher' | 'sniper' | 'boss';

/** Everything the animator needs for one frame; written by the game from sim state. */
export interface AnimState {
  /** Velocity in the character's own frame, m/s: x = right, z = forward. */
  localVelocity: { x: number; z: number };
  /** Horizontal speed in m/s (walk ≈ 4.6, sprint ≈ 7.2, crouch ≈ 2.4). */
  speed: number;
  grounded: boolean;
  /** Vertical velocity, m/s (positive = rising). */
  verticalVelocity: number;
  /** 0 standing … 1 fully crouched. */
  crouch: number;
  sprint: boolean;
  /** Look pitch in radians, positive = looking up. */
  aimPitch: number;
  /** Aim-down-sights blend 0…1. */
  ads: number;
  weapon: WeaponId;
  /** Seconds since the last shot (large when idle). */
  sinceShot: number;
  /** Reload progress 0…1, or -1 when not reloading. */
  reload: number;
  /** Melee swing progress 0…1 over the character's own tool's whole swing, or -1. */
  melee: number;
  /** Grenade throw progress 0…1 (cooking holds at 0.25), or -1. */
  grenade: number;
  /** Seconds since last damage taken (large when none). */
  sinceHurt: number;
  /** Direction toward the last hit's source in local space (x right, z forward), for the flinch. */
  hurtDirection: { x: number; z: number };
  /** Damage of the last hit (sizes the flinch; a mid-sized hit when unknown). */
  hurtAmount?: number;
  /** Sliding: crouched and gliding on the ground. */
  slide?: boolean;
  /**
   * Weapon switch, -1 or absent when none. 0…0.5: `weapon` (the gun in hand) is being put away; 0.5…1: `weapon` is
   * being drawn, after `swapFrom` was put away.
   */
  swap?: number;
  swapFrom?: WeaponId | null;
  /** A shot is about to show (seen in a newer snapshot): the gun comes up ahead of it. */
  alert?: boolean;
}

/** A part that flies off when the character shatters. */
export interface ShatterPiece {
  mesh: THREE.Mesh;
  /** World transform at the moment of death (already applied to mesh). */
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  /** Part of the head or hat (headshot kills send these flying). */
  head: boolean;
}

export interface CharacterRig {
  /** Origin between the feet on the ground; model faces -Z (same as yaw 0 of a camera). */
  readonly root: THREE.Group;
  readonly id: CharacterId | BotKind;
  update(dt: number, state: AnimState): void;
  /** Weapon models attach here: origin = right-hand pistol grip, barrel along -Z. */
  readonly rightHand: THREE.Object3D;
  /** Holds the weapon model; the rig IKs the left hand to its `supportGrip` node when present. */
  setWeapon(model: THREE.Object3D | null, supportGrip: THREE.Object3D | null): void;
  /** Carry a gun that is not in hand on the figure (slung on the back, holstered on the hip); null takes it off, hidden. */
  stow(model: THREE.Object3D, place: StowPlace | null): void;
  /** Hold a showroom pose instead of the gameplay animation; null returns to it. */
  setStance(stance: Stance | null): void;
  /** A melee weapon model (origin at its grip, head up +Y) for the left hand; it shows where a stance's `melee` seats it. */
  setMelee(model: THREE.Object3D | null): void;
  /** Team or player tint shown on an armband/visor stripe; null clears it. */
  setTint(color: THREE.ColorRepresentation | null): void;
  /** Brief white hit flash. */
  flash(): void;
  /**
   * Breaks the character into its parts in world space and hides the rig;
   * `impulse` pushes pieces (bullet direction × strength).
   */
  shatter(impulse: THREE.Vector3): ShatterPiece[];
  /** Restore after shatter (respawn). */
  reset(): void;
  /** Head center in world space, for hit boxes and name tags. */
  headPosition(out: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  /** Main suit color, used for UI swatches and first-person sleeves. */
  primary: string;
  secondary: string;
  /** Glove / hand color for first-person arms. */
  glove: string;
  /** First-person sleeve color when it differs from `primary` (e.g. a shirt under a vest). */
  sleeve?: string;
}

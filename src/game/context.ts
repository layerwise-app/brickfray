/**
 * The shared context every game system receives. It is the one seam between the
 * orchestrator (game.ts) and the systems it drives: entities read the world, the
 * HUD and the match rules through it instead of importing each other. The
 * player-vs-player and breakable-prop hooks are installed by session/combat and
 * session/props.
 */
import type * as THREE from 'three';
import type { Sfx } from './core/audio';
import type { Input } from './core/input';
import type { Effects } from './entities/effects';
import type { EnemyManager } from './entities/enemies';
import type { Player } from './entities/player';
import type { RemotePlayer } from './entities/remote-player';
import type { InkRenderer } from './render/ink-renderer';
import type { HUD } from './ui/hud';
import type { Level, Breakable } from './world/level';
import type { NavGrid } from './world/nav';
import type { World } from './world/physics';

/** Anything a bullet or blade can hit besides enemies. */
export type HitTarget = Player | RemotePlayer;

/** Which weapon (or hazard) dealt a hit; drives kill-feed wording and parry rules. */
export type DamageSource = 'rifle' | 'shotgun' | 'sniper' | 'revolver' | 'katana' | 'grenade' | 'deflect' | 'fall';

export interface PlayerHitInfo {
  part?: string;
  point: THREE.Vector3;
  /** Direction of travel of the shot or slash. */
  dir: THREE.Vector3;
  crit?: boolean;
  source?: DamageSource;
  /** Distance from the shooter, for hitscan hits. */
  dist?: number;
}

export interface PlayerRayHit {
  player: RemotePlayer;
  part: string;
  dist: number;
  point: THREE.Vector3;
}

/** The slice of match/wave state that systems outside the orchestrator may touch. */
export interface GameState {
  state: 'start' | 'play' | 'dying' | 'dead' | 'pause' | 'lobby' | 'over';
  mode: 'solo' | 'ffa';
  hitstop(duration: number, scale: number): void;
  addScore(points: number, label?: string): void;
  onPlayerDeath(): void;
}

export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: InkRenderer;
  world: World;
  level: Level;
  nav: NavGrid;
  input: Input;
  hud: HUD;
  effects: Effects;
  audio: Sfx;
  game: GameState;
  enemies: EnemyManager;
  player: Player;

  /** Everyone a weapon could hit besides enemies (the local player and remote players). */
  targets(): HitTarget[];
  /** Whether the local player may damage this target (only other players, only online). */
  canHurt(target: HitTarget): boolean;
  raycastPlayers(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): PlayerRayHit | null;
  playersInArc(pos: THREE.Vector3, dir: THREE.Vector3, range: number, cosHalf: number): RemotePlayer[];
  hitPlayer(target: HitTarget, damage: number, info: PlayerHitInfo): void;
  /** A katana slash cuts other players' grapple ropes; returns true if one was cut. */
  cutRopes(eye: THREE.Vector3, dir: THREE.Vector3, range: number): boolean;
  breakHit(prop: Breakable, damage: number, point: THREE.Vector3, dir: THREE.Vector3): void;
  breakablesInArc(pos: THREE.Vector3, dir: THREE.Vector3, range: number, cosHalf: number): Breakable[];
  blastBreakables(center: THREE.Vector3, radius: number): void;
  /** Called for every local shot so online peers can draw the tracer. */
  onShot(end: THREE.Vector3): void;
}

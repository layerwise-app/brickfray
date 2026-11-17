import type * as THREE from 'three';
import type { Atmosphere } from '../engine/renderer';
import type { Kit } from '../engine/kit';

export type MapId = 'plaza' | 'fortress' | 'docks';
export type Surface = 'plastic' | 'metal' | 'wood' | 'glass' | 'foliage' | 'water' | 'stone';

/** Axis-aligned box in meters. Players collide with every box; bullets skip `bulletsPass`. */
export interface Collider {
  min: [number, number, number];
  max: [number, number, number];
  surface: Surface;
  bulletsPass?: boolean;
}

export interface SpawnPoint {
  position: [number, number, number];
  /** Yaw in radians; 0 faces -Z. */
  yaw: number;
  /** Team spawns for TDM (0 or 1); undefined = free-for-all. */
  team?: 0 | 1;
}

/** Bot navigation graph node; links are indices of nodes reachable by walking or a jump. */
export interface Waypoint {
  position: [number, number, number];
  links: number[];
}

/** Collision and gameplay data; identical on every client for every quality. */
export interface MapLayout {
  id: MapId;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  colliders: Collider[];
  spawns: SpawnPoint[];
  waypoints: Waypoint[];
  /** Below this height a player dies (water, moat). */
  killY: number;
}

export interface MapVisual {
  root: THREE.Object3D;
  /** Animated bits (water, flags, crane lights). */
  update(dt: number, time: number): void;
  dispose(): void;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  atmosphere: Atmosphere;
  /** Pure data; deterministic and quality-independent. */
  layout(): MapLayout;
  /** Visual scenery for a quality tier. Must agree with layout(). */
  build(kit: Kit): MapVisual;
}

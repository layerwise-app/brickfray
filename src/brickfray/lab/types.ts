import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameRenderer } from '../engine/renderer';
import type { QualityLevel } from '../engine/quality';

export interface LabContext {
  renderer: GameRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  quality: QualityLevel;
  onFrame(fn: (dt: number, t: number) => void): void;
  /** A second scene drawn over the world after a depth clear (first-person view models). */
  setViewLayer(scene: THREE.Scene | null, camera: THREE.Camera | null): void;
}

export interface LabScene {
  /** Functions a screenshot script can call through `window.__lab.call(name, ...args)`. */
  api?: Record<string, (...args: unknown[]) => unknown>;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

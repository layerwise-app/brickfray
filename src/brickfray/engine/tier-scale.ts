import type * as THREE from 'three';
import type { TierScale } from './auto-resolution';
import { QUALITY, type QualityProfile, type Shed } from './quality';
import { SCALE_FLOOR } from './resolution-scale';

/** Small detail dissolves this much nearer once the governor gives up draw distance (high's 46 m to medium's 34). */
export const DETAIL_REACH = 0.75;

/** What the governor is doing now, for the settings panel. */
export interface GovernorState {
  /** The ratio a match renders at, and the tier's own. */
  ratio: number;
  base: number;
  /** The extras given up so far, in order. */
  shed: Shed[];
  /** Frames still miss with everything given up (or the CPU holds them back): drawn on every second refresh. */
  paced: boolean;
}

/** A tier's pixel ratio on this screen. */
export function tierRatio(profile: QualityProfile) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(dpr, profile.maxPixelRatio) * profile.resolutionScale;
}

/** The governor's range for a tier: its ratio down to the tier below's, after its extras. */
export function tierScale(profile: QualityProfile): TierScale {
  return { base: tierRatio(profile), floor: profile.below ? tierRatio(QUALITY[profile.below]) : SCALE_FLOOR, saves: profile.sheds.map((s) => s.saves) };
}

/** The tier's shadow map and reach, or once shadows are given up the tier below's (half the texels, high's reach down to medium's). */
export function fitSunShadow(sun: THREE.DirectionalLight, p: QualityProfile, shed: boolean) {
  if (!p.shadows) return;
  const size = shed ? p.shadowMapSize / 2 : p.shadowMapSize;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  const cam = sun.shadow.camera;
  const half = p.level === 'high' && !shed ? 34 : 26;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 1;
  cam.far = 160;
  cam.updateProjectionMatrix();
  sun.shadow.radius = p.shadowRadius;
}

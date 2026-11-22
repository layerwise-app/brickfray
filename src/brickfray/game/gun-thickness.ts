import * as THREE from 'three';
import type { Remote } from './remotes';

/** A barrel's width (m) and the fewest pixels it may be drawn across, and how far a gun may be widened for that. */
const BARREL = 0.024;
const PIXELS = 1.4;
const MOST = 3;

/**
 * Past a dozen metres a barrel is under a pixel wide, so it breaks into dots (or vanishes on tiers without MSAA).
 * Other players' guns are widened across the barrel, never lengthened, just enough to keep it about this many pixels
 * wide; `pixel` is the view's height of one pixel at 1 m (radians).
 */
export function thickenGuns(remotes: Iterable<Remote>, eye: THREE.Vector3, pixel: number) {
  for (const r of remotes) {
    if (!r.visible) continue;
    const f = THREE.MathUtils.clamp((PIXELS * pixel * r.position.distanceTo(eye)) / BARREL, 1, MOST);
    for (const gun of Object.values(r.guns)) gun?.root.scale.set(f, f, 1);
  }
}

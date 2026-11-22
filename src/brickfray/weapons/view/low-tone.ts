import * as THREE from 'three';
import type { Kit } from '../../engine/kit';

/**
 * Without reflections (the tier with no PBR) a dark gun has only its diffuse light to show its faces by, and a near-black
 * receiver crushes to one flat silhouette. Its dark colours are lifted (linear luminance under DARK by LIFT, easing back
 * to unchanged at PLAIN), keeping their order and hue, so it reads as dark slate the way the reflective tiers show it.
 */
const DARK = 0.04;
const PLAIN = 0.16;
const LIFT = 2.5;
const SLOPE = (PLAIN - LIFT * DARK) / (PLAIN - DARK);

const lifted = new WeakSet<THREE.BufferGeometry>();

export function liftDarks(root: THREE.Object3D, kit: Kit) {
  if (kit.profile.pbr) return;
  root.traverse((o) => {
    const geometry = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null;
    const color = geometry?.getAttribute('color');
    if (!geometry || !color || lifted.has(geometry)) return;
    lifted.add(geometry);
    for (let i = 0; i < color.count; i++) {
      const r = color.getX(i);
      const g = color.getY(i);
      const b = color.getZ(i);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l <= 1e-5 || l >= PLAIN) continue;
      const k = (l < DARK ? LIFT * l : Math.max(l, LIFT * DARK + (l - DARK) * SLOPE)) / l;
      color.setXYZ(i, r * k, g * k, b * k);
    }
    color.needsUpdate = true;
  });
}

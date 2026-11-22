import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { chamferBox } from '../engine/geometry';

/**
 * The holster in the gun's space: a leather sheath that narrows and lifts toward the muzzle, a lighter stitched welt
 * down each side and a retention strap over the back of the slide with a brass snap.
 */
export function holsterShape(x: number, top: number, bottom: number, front: number, back: number) {
  const paint = (g: THREE.BufferGeometry, color: string) => {
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]!), 3));
    return g;
  };
  const h = top - bottom;
  const body = chamferBox(x * 2, h, back - front, 0.008).translate(0, (top + bottom) / 2, (front + back) / 2);
  const pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((back - pos.getZ(i)) / (back - front), 0, 1);
    pos.setX(i, pos.getX(i) * (1 - 0.22 * t));
    if (pos.getY(i) < top - h * 0.5) pos.setY(i, pos.getY(i) + h * 0.3 * t * t);
  }
  body.computeVertexNormals();
  const parts = [paint(body, '#3a2a20')];
  for (const side of [-1, 1]) {
    parts.push(paint(chamferBox(0.003, 0.006, (back - front) * 0.72, 0).translate(side * (x * 0.9 + 0.001), bottom + h * 0.42, front + (back - front) * 0.52), '#8a6a48'));
  }
  parts.push(paint(chamferBox(x * 2 + 0.006, 0.01, 0.018, 0.003).translate(0, top + 0.003, back - 0.012), '#5c4330'));
  parts.push(paint(chamferBox(0.012, 0.012, 0.008, 0.003).translate(x + 0.003, top - 0.004, back - 0.012), '#c9b27a'));
  return mergeGeometries(parts)!;
}

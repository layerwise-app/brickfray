import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalizeGeometry } from '../../engine/geometry';
import type { Outline } from '../shapes';

const RIM = 0.0006;

/**
 * A ground blade: a side outline [z, y] extruded across X like `slab`, with
 * both faces inset by `edge` so every rim tapers to a thin cutting line.
 */
export function bladeSlab(outline: Outline, thick: number, edge: number, holes: Outline[] = []): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: RIM,
    bevelEnabled: true,
    bevelThickness: (thick - RIM) / 2,
    bevelSize: edge,
    bevelOffset: -edge,
    bevelSegments: 1,
    curveSegments: 1
  });
  g.translate(0, 0, -RIM / 2);
  g.rotateY(-Math.PI / 2);
  return normalizeGeometry(toCreasedNormals(g, 0.3));
}

/** Points along a circular arc in the [z, y] plane, angles in radians from +Z toward +Y. */
export function arc(cz: number, cy: number, r: number, from: number, to: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}


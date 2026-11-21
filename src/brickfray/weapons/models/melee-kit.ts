import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalizeGeometry } from '../../engine/geometry';
import type { Lod, Outline } from '../shapes';
import type { Surface } from '../surface';

/** What a melee model needs from its builder; a costume can stand in for it to wear the same model stowed. */
export interface MeleeBuilder {
  readonly lod: Lod;
  readonly detail: Lod['detail'];
  add(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, surface: Surface, matrix?: THREE.Matrix4): unknown;
}

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = normalizeGeometry(make());
    cache.set(key, g);
  }
  return g;
}

/** Segments around a part wide enough that a tier's tube segments would show as facets on its outline. */
export function wide(lod: Lod): number {
  return lod.detail >= 2 ? 40 : lod.detail === 1 ? 24 : lod.seg;
}

/** A wrap or rib around a handle: a torus about Z with a few-sided section, far cheaper than `torus` for something this thin. */
export function ring(radius: number, thickness: number, lod: Lod): THREE.BufferGeometry {
  const around = lod.detail >= 2 ? 18 : lod.detail === 1 ? 12 : 8;
  const sides = lod.detail >= 2 ? 6 : 4;
  return cached(`ring:${radius}:${thickness}:${around}:${sides}`, () => new THREE.TorusGeometry(radius, thickness, sides, around));
}

/** A solid of revolution around Z like `latheZ`, with exactly `seg` segments whatever the tier's tube count. `profile` is [radius, z]. */
export function turned(profile: readonly (readonly [number, number])[], seg: number): THREE.BufferGeometry {
  return cached(`turned:${seg}:${profile.map((p) => p.join(',')).join(';')}`, () => {
    const area = profile.reduce((sum, [r, z], i) => {
      const [r2, z2] = profile[(i + 1) % profile.length]!;
      return sum + r * z2 - r2 * z;
    }, 0);
    const ordered = area < 0 ? [...profile].reverse() : profile;
    const g = new THREE.LatheGeometry(ordered.map(([r, z]) => new THREE.Vector2(Math.max(r, 0), z)), Math.max(4, seg));
    g.rotateX(Math.PI / 2);
    return toCreasedNormals(g, Math.min(1.2, Math.max(0.5, ((Math.PI * 2) / seg) * 1.25)));
  });
}

/**
 * A side outline [z, y] extruded across X like `slab`, its thickness set point by point:
 * `thick(z, y)` is the full width there, so a head can thin from eye to edge.
 */
export function wedge(outline: Outline, thick: (z: number, y: number) => number, key: string, steps = 1): THREE.BufferGeometry {
  return cached(`wedge:${key}:${steps}:${JSON.stringify(outline)}`, () => {
    const shape = new THREE.Shape(outline.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1, steps });
    g.translate(0, 0, -0.5);
    g.rotateY(-Math.PI / 2);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * thick(pos.getZ(i), pos.getY(i)));
    g.deleteAttribute('normal');
    g.computeVertexNormals();
    return toCreasedNormals(g, 0.5);
  });
}

import * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';

const MIN_HEIGHT = 0.3;
const DARKEST = 0.46;
const scratch: number[] = [];

/**
 * Static contact shading for tiers without shadow maps: a soft dark skirt on the floor around
 * every solid box that stands on something, so buildings and props sit on the ground instead of
 * floating over it. Built once from the collision boxes into a single unlit mesh.
 */
export function buildGroundContact(world: CollisionWorld): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const b = world.boxes;

  const topAt = (x: number, z: number, y: number) => {
    for (const i of world.overlaps(x - 0.02, y - 0.06, z - 0.02, x + 0.02, y - 0.001, z + 0.02, scratch)) {
      if (Math.abs(b[i * 6 + 4]! - y) < 0.03) return true;
    }
    return false;
  };
  const blocked = (x: number, z: number, y: number) => world.overlaps(x - 0.02, y + 0.05, z - 0.02, x + 0.02, y + 0.2, z + 0.02, scratch).length > 0;
  const vertex = (x: number, y: number, z: number, a: number) => {
    positions.push(x, y, z);
    colors.push(0.03, 0.04, 0.08, a);
  };
  const quad = (y: number, p: [number, number, number][]) => {
    for (const k of [0, 1, 2, 0, 2, 3]) vertex(p[k]![0], y, p[k]![1], p[k]![2]);
  };

  for (let i = 0; i < world.count; i++) {
    const c = world.colliders[i]!;
    const o = i * 6;
    const x0 = b[o]!, y0 = b[o + 1]!, z0 = b[o + 2]!, x1 = b[o + 3]!, y1 = b[o + 4]!, z1 = b[o + 5]!;
    const height = y1 - y0;
    if (c.surface === 'water' || height < MIN_HEIGHT) continue;
    if (!topAt((x0 + x1) / 2, (z0 + z1) / 2, y0)) continue;
    const w = THREE.MathUtils.clamp(0.2 + height * 0.12, 0.26, 0.7);
    const y = y0 + 0.012;
    const a = DARKEST;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const open = (x: number, z: number) => topAt(x, z, y0) && !blocked(x, z, y0);
    const sides = { west: open(x0 - w * 0.5, mz), east: open(x1 + w * 0.5, mz), north: open(mx, z0 - w * 0.5), south: open(mx, z1 + w * 0.5) };
    if (sides.west) quad(y, [[x0, z0, a], [x0 - w, z0, 0], [x0 - w, z1, 0], [x0, z1, a]]);
    if (sides.east) quad(y, [[x1, z1, a], [x1 + w, z1, 0], [x1 + w, z0, 0], [x1, z0, a]]);
    if (sides.north) quad(y, [[x1, z0, a], [x1, z0 - w, 0], [x0, z0 - w, 0], [x0, z0, a]]);
    if (sides.south) quad(y, [[x0, z1, a], [x0, z1 + w, 0], [x1, z1 + w, 0], [x1, z1, a]]);
    if (sides.west && sides.north) quad(y, [[x0, z0, a], [x0, z0 - w, 0], [x0 - w, z0 - w, 0], [x0 - w, z0, 0]]);
    if (sides.east && sides.north) quad(y, [[x1, z0, a], [x1 + w, z0, 0], [x1 + w, z0 - w, 0], [x1, z0 - w, 0]]);
    if (sides.east && sides.south) quad(y, [[x1, z1, a], [x1, z1 + w, 0], [x1 + w, z1 + w, 0], [x1 + w, z1, 0]]);
    if (sides.west && sides.south) quad(y, [[x0, z1, a], [x0 - w, z1, 0], [x0 - w, z1 + w, 0], [x0, z1 + w, 0]]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ground-contact';
  mesh.renderOrder = 1;
  return mesh;
}

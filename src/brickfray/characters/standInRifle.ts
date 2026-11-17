import * as THREE from 'three';
import { chamferBox, mergeWithTransforms, normalizeGeometry } from '../engine/geometry';
import type { Kit } from '../engine/kit';

/**
 * Lab-only rifle following the WeaponModel conventions: origin at the pistol
 * grip, barrel along -Z, support grip 0.22 m forward and 0.04 m below the bore.
 */
export function standInRifle(kit: Kit) {
  const root = new THREE.Group();
  const m = (x: number, y: number, z: number, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1));
  const barrel = normalizeGeometry(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 10));
  barrel.rotateX(Math.PI / 2);
  const dark = mergeWithTransforms([
    { geometry: chamferBox(0.03, 0.11, 0.045, 0.006), matrix: m(0, -0.03, 0.005, -0.25) },
    { geometry: chamferBox(0.05, 0.075, 0.34, 0.008), matrix: m(0, 0.06, -0.06) },
    { geometry: barrel, matrix: m(0, 0.065, -0.4) },
    { geometry: chamferBox(0.028, 0.13, 0.06, 0.006), matrix: m(0, -0.04, -0.12, 0.25) },
    { geometry: chamferBox(0.04, 0.075, 0.2, 0.008), matrix: m(0, 0.045, 0.19) },
    { geometry: chamferBox(0.03, 0.035, 0.12, 0.005), matrix: m(0, 0.115, -0.04) }
  ]);
  const accent = mergeWithTransforms([
    { geometry: chamferBox(0.046, 0.05, 0.2, 0.008), matrix: m(0, 0.033, -0.24) },
    { geometry: chamferBox(0.044, 0.1, 0.03, 0.008), matrix: m(0, 0.035, 0.3) }
  ]);
  root.add(new THREE.Mesh(dark, kit.materials.get('#30363c')), new THREE.Mesh(accent, kit.materials.get('#e2762a')));
  const supportGrip = new THREE.Object3D();
  supportGrip.name = 'supportGrip';
  supportGrip.position.set(0, 0.025, -0.22);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.065, -0.56);
  root.add(supportGrip, muzzle);
  for (const c of root.children) c.castShadow = kit.profile.shadows;
  return { root, supportGrip, muzzle };
}

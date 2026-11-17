import * as THREE from 'three';

/**
 * Hides small detail instances of a batched mesh beyond `range` meters from
 * the rendering camera; re-evaluated only after the camera moves 1.5 m.
 */
export function detailLod(mesh: THREE.BatchedMesh, range: number, maxRadius = 1.6) {
  const n = mesh.instanceCount;
  const centers = new Float32Array(n * 3);
  const small = new Uint8Array(n);
  const m = new THREE.Matrix4();
  const s = new THREE.Sphere();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    mesh.getBoundingSphereAt(mesh.getGeometryIdAt(i), s);
    s.applyMatrix4(m);
    centers[i * 3] = s.center.x;
    centers[i * 3 + 1] = s.center.y;
    centers[i * 3 + 2] = s.center.z;
    small[i] = s.radius < maxRadius ? 1 : 0;
  }
  const last = new THREE.Vector3(1e9, 0, 0);
  const cam = new THREE.Vector3();
  const r2 = range * range;
  const base = mesh.onBeforeRender.bind(mesh);
  mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    cam.setFromMatrixPosition(camera.matrixWorld);
    if (cam.distanceToSquared(last) > 2.25) {
      last.copy(cam);
      for (let i = 0; i < n; i++) {
        if (!small[i]) continue;
        const dx = centers[i * 3]! - cam.x;
        const dy = centers[i * 3 + 1]! - cam.y;
        const dz = centers[i * 3 + 2]! - cam.z;
        const visible = dx * dx + dy * dy + dz * dz < r2;
        if (mesh.getVisibleAt(i) !== visible) mesh.setVisibleAt(i, visible);
      }
    }
    base(renderer, scene, camera, geometry, material, group);
  };
}

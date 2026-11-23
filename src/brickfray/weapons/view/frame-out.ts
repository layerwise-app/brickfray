import * as THREE from 'three';

/** Vertices tested per mesh at most: enough that no visible part of a gun is missed by more than a sliver. */
const SAMPLES = 600;

const frustum = new THREE.Frustum();
const viewProj = new THREE.Matrix4();
const mvp = new THREE.Matrix4();
const instance = new THREE.Matrix4();
const corner = new THREE.Vector3();
const v = new THREE.Vector4();

/** Whether a mesh's own box, as posed, lies wholly behind one of the frame's planes (the cheap, conservative test). */
function boxOutside(mesh: THREE.Mesh) {
  const inst = mesh as THREE.InstancedMesh;
  if (inst.isInstancedMesh && !inst.boundingBox) inst.computeBoundingBox();
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const box = (inst.isInstancedMesh ? inst.boundingBox : mesh.geometry.boundingBox)!;
  for (const plane of frustum.planes) {
    let behind = 0;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(mesh.matrixWorld);
      if (plane.distanceToPoint(corner) < 0) behind++;
    }
    if (behind === 8) return true;
  }
  return false;
}

/** Whether any of a sample of the mesh's vertices (all of them when `exact`) lands inside the frame: a long gun's box still crosses a corner of the frustum after the gun itself has left. */
function vertexInside(mesh: THREE.Mesh, exact: boolean) {
  const pos = mesh.geometry.getAttribute('position');
  const inst = mesh as THREE.InstancedMesh;
  const copies = inst.isInstancedMesh ? inst.count : 1;
  const step = exact ? 1 : Math.max(1, Math.floor((pos.count * copies) / SAMPLES));
  for (let k = 0; k < copies; k++) {
    mvp.multiplyMatrices(viewProj, mesh.matrixWorld);
    if (inst.isInstancedMesh) {
      inst.getMatrixAt(k, instance);
      mvp.multiply(instance);
    }
    for (let i = k % step; i < pos.count; i += step) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i), 1).applyMatrix4(mvp);
      if (v.w > 0 && Math.abs(v.x) <= v.w && Math.abs(v.y) <= v.w) return true;
    }
  }
  return false;
}

const widen = new THREE.Matrix4();

/** Whether a model, as last posed, has nothing left inside the camera's frame, grown `margin` times about its center; `exact` tests every vertex, not a sample. */
export function outOfFrame(root: THREE.Object3D, camera: THREE.Camera, margin = 1, exact = false) {
  viewProj.multiplyMatrices(widen.makeScale(1 / margin, 1 / margin, 1), camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProj);
  let seen = false;
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    if (!seen && mesh.isMesh && !boxOutside(mesh) && vertexInside(mesh, exact)) seen = true;
  });
  return !seen;
}

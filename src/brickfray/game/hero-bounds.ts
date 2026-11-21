import * as THREE from 'three';
import type { CharacterRig } from '../characters/types';

export const IDLE_STATE = {
  localVelocity: { x: 0, z: 0 },
  speed: 0,
  grounded: true,
  verticalVelocity: 0,
  crouch: 0,
  sprint: false,
  aimPitch: 0,
  ads: 0,
  weapon: 'ar' as const,
  sinceShot: 99,
  reload: -1,
  melee: -1,
  grenade: -1,
  sinceHurt: 99,
  hurtDirection: { x: 0, z: 0 }
};

const BOXES = new WeakMap<THREE.BufferGeometry, { bone: number; box: THREE.Box3 }[]>();

/** A box around the vertices each bone carries, in that bone's frame. The skin is rigid, so the posed figure is these boxes moved by their bones. */
function boneBoxes(mesh: THREE.SkinnedMesh) {
  const known = BOXES.get(mesh.geometry);
  if (known) return known;
  const position = mesh.geometry.getAttribute('position').array;
  const skin = mesh.geometry.getAttribute('skinIndex').array;
  const toBone = mesh.skeleton.boneInverses.map((inverse) => new THREE.Matrix4().multiplyMatrices(inverse, mesh.bindMatrix).elements);
  const boxes = toBone.map((_, bone) => ({ bone, box: new THREE.Box3() }));
  // Tens of thousands of vertices on the frame a character is first shown: plain arithmetic, no vector objects.
  for (let i = 0, n = position.length / 3; i < n; i++) {
    const { min, max } = boxes[skin[i * 4]!]!.box;
    const m = toBone[skin[i * 4]!]!;
    const px = position[i * 3]!;
    const py = position[i * 3 + 1]!;
    const pz = position[i * 3 + 2]!;
    const x = m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!;
    const y = m[1]! * px + m[5]! * py + m[9]! * pz + m[13]!;
    const z = m[2]! * px + m[6]! * py + m[10]! * pz + m[14]!;
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
  }
  const used = boxes.filter(({ box }) => !box.isEmpty());
  BOXES.set(mesh.geometry, used);
  return used;
}

const OUTLINE_SAMPLES = 6;
/** Animation steps between samples; the animator takes steps of at most 0.1 s, so the samples span half a breath. */
const OUTLINE_STRIDE = 3;

/** Runs the idle forward and collects `HeroDisplay.outline`; the figure is left in a settled pose. */
export function measure(rig: CharacterRig, figure: THREE.Object3D) {
  const parts: { node: THREE.Object3D; box: THREE.Box3 }[] = [];
  const collect = (o: THREE.Object3D) => {
    if (!o.visible) return;
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      for (const { bone, box } of boneBoxes(mesh)) parts.push({ node: mesh.skeleton.bones[bone]!, box });
    } else if (mesh.isMesh) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      parts.push({ node: mesh, box: mesh.geometry.boundingBox! });
    }
    for (const child of o.children) collect(child);
  };
  collect(rig.root);
  const points = new Float32Array(OUTLINE_SAMPLES * parts.length * 24);
  const toFigure = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let n = 0;
  for (let step = 1; step <= OUTLINE_SAMPLES * OUTLINE_STRIDE; step++) {
    rig.update(0.1, IDLE_STATE);
    if (step % OUTLINE_STRIDE) continue;
    figure.updateWorldMatrix(true, true);
    toFigure.copy(figure.matrixWorld).invert();
    for (const { node, box } of parts) {
      for (let corner = 0; corner < 8; corner++) {
        v.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z);
        v.applyMatrix4(node.matrixWorld).applyMatrix4(toFigure);
        points[n++] = v.x;
        points[n++] = v.y;
        points[n++] = v.z;
      }
    }
  }
  return points;
}

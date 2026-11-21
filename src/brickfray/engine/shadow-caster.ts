import * as THREE from 'three';

type Parts = Pick<THREE.BatchedMesh, 'geometry' | 'instanceCount' | 'getVisibleAt' | 'getGeometryIdAt' | 'getGeometryRangeAt' | 'getMatrixAt'>;

/** One mesh with every visible part of `batch` in place: positions only, unindexed. */
function mergedPositions(batch: Parts) {
  const position = batch.geometry.getAttribute('position');
  const index = batch.geometry.index;
  const ranges: (THREE.BatchedMeshGeometryRange | null)[] = [];
  let count = 0;
  for (let i = 0; i < batch.instanceCount; i++) {
    const range = batch.getVisibleAt(i) ? batch.getGeometryRangeAt(batch.getGeometryIdAt(i)) : null;
    if (range) count += range.count;
    ranges.push(range);
  }
  const out = new Float32Array(count * 3);
  const matrix = new THREE.Matrix4();
  let n = 0;
  ranges.forEach((range, i) => {
    if (!range) return;
    const e = batch.getMatrixAt(i, matrix).elements;
    for (let k = range.start; k < range.start + range.count; k++) {
      const v = index ? index.getX(k) : k;
      const x = position.getX(v);
      const y = position.getY(v);
      const z = position.getZ(v);
      out[n++] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
      out[n++] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
      out[n++] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A batch whose shadow is drawn by one merged mesh. ANGLE's Metal backend draws each part of a batch separately,
 * and the sun's frustum takes in most of a map: 1,800 shadow draws a frame on the plaza, about a third of medium's
 * GPU time. The merge waits for the first shadow pass because callers settle `castShadow` after building; parts
 * moved or hidden after that keep their old shadow.
 */
export class SceneryBatch extends THREE.BatchedMesh {
  private caster: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;

  override onBeforeShadow(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    shadowCamera: THREE.Camera,
    geometry: THREE.BufferGeometry,
    depthMaterial: THREE.Material,
    group: THREE.Group
  ) {
    super.onBeforeShadow(renderer, scene, camera, shadowCamera, geometry, depthMaterial, group);
    if (this.caster) return;
    const source = this.material as THREE.Material;
    const merged = mergedPositions(this);
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: source.side });
    material.shadowSide = source.shadowSide;
    const caster = new THREE.Mesh(merged, material);
    caster.castShadow = true;
    // Hit tests read the batch's own part colours.
    caster.raycast = () => {};
    // Every other pass (the main one, ambient occlusion's) draws none of it.
    caster.onBeforeRender = () => merged.setDrawRange(0, 0);
    caster.onBeforeShadow = () => merged.setDrawRange(0, Infinity);
    this.caster = caster;
    this.add(caster);
    this.castShadow = false;
  }

  override dispose() {
    super.dispose();
    this.caster?.geometry.dispose();
    this.caster?.material.dispose();
    return this;
  }
}

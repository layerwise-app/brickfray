import * as THREE from 'three';

/** `near`: detail shown up close and dissolved with distance; `far`: its cheap stand-in, shown where the detail is gone. */
export type LodMode = 'near' | 'far';

/** Metres over which a part dissolves; the stand-in fills in the pixels it leaves, so nothing pops. */
const BAND = 6;
/** Visibility is re-checked after the camera moves this far. */
const RECHECK = 1.5;

const VERTEX = /* glsl */ `#include <project_vertex>
#ifdef USE_BATCHING
{
  vec3 lodAt = (modelMatrix * batchingMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vLodFade = clamp((uLodRange - distance(lodAt, cameraPosition)) / uLodBand, 0.0, 1.0);
}
#else
vLodFade = 1.0;
#endif`;

/** Ordered 4x4 dither: the detail keeps the pixels above its fade, the stand-in exactly the others. */
const FRAGMENT = /* glsl */ `#include <clipping_planes_fragment>
{
  vec2 lodA = floor(gl_FragCoord.xy);
  vec2 lodB = floor(lodA * 0.5);
  float lodD = fract(dot(lodB, vec2(0.5, lodB.y * 0.75))) * 0.25 + fract(dot(lodA, vec2(0.5, lodA.y * 0.75))) + 1.0 / 32.0;
  #ifdef LOD_FAR
  if (vLodFade > lodD) discard;
  #else
  if (vLodFade <= lodD) discard;
  #endif
}`;

function lodMaterial(base: THREE.Material, mode: LodMode, range: number) {
  const m = base.clone();
  const uniforms = { uLodRange: { value: range }, uLodBand: { value: BAND } };
  m.onBeforeCompile = (shader, renderer) => {
    base.onBeforeCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const pars = 'uniform float uLodRange;\nuniform float uLodBand;\nflat varying float vLodFade;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${pars}`).replace('#include <project_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${mode === 'far' ? '#define LOD_FAR\n' : ''}flat varying float vLodFade;`)
      .replace('#include <clipping_planes_fragment>', FRAGMENT);
  };
  m.customProgramCacheKey = () => `${base.customProgramCacheKey()}|lod-${mode}`;
  m.userData.lodClone = true;
  m.userData.lodBase = base;
  return m;
}

/** three r170 BatchedMesh internals a twin shares with its source. */
interface BatchInternals {
  _instanceInfo: { visible: boolean; active: boolean; geometryIndex: number }[];
  _geometryInfo: unknown[];
  _geometryCount: number;
  _geometryInitialized: boolean;
  _maxInstanceCount: number;
  _maxVertexCount: number;
  _maxIndexCount: number;
  _matricesTexture: THREE.DataTexture;
  _indirectTexture: THREE.DataTexture;
  _colorsTexture: THREE.DataTexture | null;
}

/** A second draw of a baked batch with another material: same buffers, matrices and colours, its own visibility. */
function twin(mesh: THREE.BatchedMesh, material: THREE.Material) {
  const src = mesh as unknown as BatchInternals;
  const t = new THREE.BatchedMesh(src._maxInstanceCount, src._maxVertexCount, src._maxIndexCount, material);
  const dst = t as unknown as BatchInternals;
  dst._matricesTexture.dispose();
  t.geometry = mesh.geometry;
  dst._geometryInfo = src._geometryInfo;
  dst._geometryCount = src._geometryCount;
  dst._geometryInitialized = true;
  dst._instanceInfo = src._instanceInfo.map((info) => ({ ...info }));
  dst._matricesTexture = src._matricesTexture;
  dst._colorsTexture = src._colorsTexture;
  t.name = mesh.name;
  t.position.copy(mesh.position);
  t.quaternion.copy(mesh.quaternion);
  t.scale.copy(mesh.scale);
  t.receiveShadow = mesh.receiveShadow;
  t.perObjectFrustumCulled = mesh.perObjectFrustumCulled;
  t.sortObjects = mesh.sortObjects;
  t.computeBoundingBox();
  t.computeBoundingSphere();
  t.dispose = () => {
    dst._indirectTexture.dispose();
    return t;
  };
  return t;
}

/**
 * Small detail instances of a batched mesh dissolve between `range - 6` and `range` metres from the camera
 * (`near`), or appear there as the detail goes (`far`). Instances inside that band draw from a twin batch with a
 * dithering material; the rest stay in `mesh` with its plain material (a shader that can discard costs the whole
 * draw its hidden-surface removal on tile-based GPUs) or are left out. Returns the twin, for the caller to add.
 */
export function detailLod(mesh: THREE.BatchedMesh, range: number, mode: LodMode = 'near') {
  const blend = twin(mesh, lodMaterial(mesh.material as THREE.Material, mode, range));
  const n = (mesh as unknown as BatchInternals)._instanceInfo.length;
  const origins = new Float32Array(n * 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    origins.set([m.elements[12]!, m.elements[13]!, m.elements[14]!], i * 3);
  }
  // Between re-checks the camera moves under RECHECK, so a plain instance never reaches the band unseen.
  const bandIn = range - BAND - RECHECK;
  const bandOut = range + RECHECK;
  const last = new THREE.Vector3(1e9, 0, 0);
  const cam = new THREE.Vector3();
  const recheck = (camera: THREE.Camera) => {
    cam.setFromMatrixPosition(camera.matrixWorld);
    if (cam.distanceToSquared(last) <= RECHECK * RECHECK) return;
    last.copy(cam);
    for (let i = 0; i < n; i++) {
      const dist = Math.hypot(origins[i * 3]! - cam.x, origins[i * 3 + 1]! - cam.y, origins[i * 3 + 2]! - cam.z);
      const inBand = dist >= bandIn && dist < bandOut;
      const plain = mode === 'near' ? dist < bandIn : dist >= bandOut;
      if (mesh.getVisibleAt(i) !== plain) mesh.setVisibleAt(i, plain);
      if (blend.getVisibleAt(i) !== inBand) blend.setVisibleAt(i, inBand);
    }
  };
  for (const target of [mesh, blend]) {
    const base = target.onBeforeRender.bind(target);
    target.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      recheck(camera);
      base(renderer, scene, camera, geometry, material, group);
    };
  }
  return blend;
}

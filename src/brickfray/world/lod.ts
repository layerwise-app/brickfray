import * as THREE from 'three';

/** `near`: detail shown up close and dissolved with distance; `far`: its cheap stand-in, shown where the detail is gone. */
export type LodMode = 'near' | 'far';

/** Metres over which a part dissolves. */
const BAND = 6;
/** Metres over which a stand-in fades in, just before its detail starts to dissolve. */
const FAR_BAND = 4;
/** Visibility is re-checked after the camera moves this far. */
const RECHECK = 1.5;

/** Distances (from the camera) where a mode's fade runs from opaque to gone (`near`) or gone to opaque (`far`). */
function fadeSpan(mode: LodMode, range: number) {
  return mode === 'near' ? { from: range - BAND, to: range } : { from: range - BAND - FAR_BAND, to: range - BAND };
}

const VERTEX = /* glsl */ `#include <project_vertex>
#ifdef USE_BATCHING
{
  vec3 lodAt = (modelMatrix * batchingMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float lodT = clamp((distance(lodAt, cameraPosition) - uLodFrom) / (uLodTo - uLodFrom), 0.0, 1.0);
  #ifdef LOD_FAR
  vLodAlpha = lodT;
  #else
  vLodAlpha = 1.0 - lodT;
  #endif
}
#else
vLodAlpha = 1.0;
#endif`;

/**
 * In its band a part is alpha blended: only its nearest surface (laid down by a depth-only pass just before)
 * blends over what is behind it, so it fades without a screen pattern or seeing through itself. A stand-in
 * fades in over its detail first (it sits on or in front of it) and the detail dissolves after, so the two
 * never leave a gap between them.
 */
const FRAGMENT = '#include <opaque_fragment>';
const FRAGMENT_LOD = 'diffuseColor.a *= vLodAlpha;\n#include <opaque_fragment>';
/** After glass (2), before smoke and sparks (3+). */
const BLEND_ORDER = 2.5;

function lodMaterial(base: THREE.Material, mode: LodMode, range: number, colorWrite: boolean) {
  const m = base.clone();
  const span = fadeSpan(mode, range);
  const uniforms = { uLodFrom: { value: span.from }, uLodTo: { value: span.to } };
  m.transparent = true;
  m.colorWrite = colorWrite;
  m.depthWrite = !colorWrite;
  if (mode === 'far') {
    // Fully faded in while its detail dissolves: faces the two share go to the detail.
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1;
    m.polygonOffsetUnits = 1;
  }
  m.onBeforeCompile = (shader, renderer) => {
    base.onBeforeCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const pars = 'uniform float uLodFrom;\nuniform float uLodTo;\nflat varying float vLodAlpha;';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${mode === 'far' ? '#define LOD_FAR\n' : ''}${pars}`)
      .replace('#include <project_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nflat varying float vLodAlpha;').replace(FRAGMENT, FRAGMENT_LOD);
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
 * (`near`); their stand-ins fade in just before that (`far`). Instances inside their band draw from twin batches
 * (a depth pass, then a blended one); the rest stay in `mesh` with its plain material or are left out, so the
 * blending costs only what is fading. Returns the twins, for the caller to add.
 */
export function detailLod(mesh: THREE.BatchedMesh, range: number, mode: LodMode = 'near') {
  const base = mesh.material as THREE.Material;
  const twins = [twin(mesh, lodMaterial(base, mode, range, true))];
  if (!base.transparent) twins.unshift(twin(mesh, lodMaterial(base, mode, range, false)));
  // Same z and order: the depth twin, created first, draws right before its blend twin.
  for (const t of twins) t.renderOrder = BLEND_ORDER;
  const n = (mesh as unknown as BatchInternals)._instanceInfo.length;
  const origins = new Float32Array(n * 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    origins.set([m.elements[12]!, m.elements[13]!, m.elements[14]!], i * 3);
  }
  // Between re-checks the camera moves under RECHECK, so a plain instance never reaches the band unseen.
  const span = fadeSpan(mode, range);
  const bandIn = span.from - RECHECK;
  const bandOut = span.to + RECHECK;
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
      for (const t of twins) if (t.getVisibleAt(i) !== inBand) t.setVisibleAt(i, inBand);
    }
  };
  for (const target of [mesh, ...twins]) {
    const before = target.onBeforeRender.bind(target);
    target.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      recheck(camera);
      before(renderer, scene, camera, geometry, material, group);
    };
  }
  return twins;
}

import * as THREE from 'three';
import { SceneryChunk } from '../engine/scenery-chunks';

/** `near`: detail shown up close and dissolved with distance; `far`: its cheap stand-in, shown where the detail is gone. */
export type LodMode = 'near' | 'far';

/** How a chunk draws: its opaque parts, or the depth then blended pass of the parts inside the fade band. */
type Role = 'plain' | 'depth' | 'blend';

/** Metres over which a part dissolves. */
const BAND = 6;
/** Metres over which a stand-in fades in, just before its detail starts to dissolve. */
const FAR_BAND = 4;
/** After glass (2), before smoke and sparks (3+). */
const BLEND_ORDER = 2.5;

/** Distances (from the camera) where a mode's fade runs from opaque to gone (`near`) or gone to opaque (`far`). */
function fadeSpan(mode: LodMode, range: number) {
  return mode === 'near' ? { from: range - BAND, to: range } : { from: range - BAND - FAR_BAND, to: range - BAND };
}

/**
 * Each vertex carries its part's origin (`lodOrigin`), so a whole part is in or out together. Plain draws the parts
 * that are fully opaque at their distance, the twins the ones inside the band; the rest of the chunk's parts collapse
 * behind the far plane.
 */
const VERTEX = /* glsl */ `#include <project_vertex>
{
  float lodD = distance((modelMatrix * vec4(lodOrigin, 1.0)).xyz, cameraPosition);
  float lodT = clamp((lodD - uLodFrom) / (uLodTo - uLodFrom), 0.0, 1.0);
  bool lodBand = lodD >= uLodFrom && lodD < uLodTo;
  #ifdef LOD_FAR
  vLodAlpha = lodT;
  bool lodShown = LOD_PLAIN ? lodD >= uLodTo : lodBand;
  #else
  vLodAlpha = 1.0 - lodT;
  bool lodShown = LOD_PLAIN ? lodD < uLodFrom : lodBand;
  #endif
  if (!lodShown) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;

/**
 * In its band a part is alpha blended: only its nearest surface (laid down by the depth twin just before) blends
 * over what is behind it, so it fades without a screen pattern or seeing through itself. A stand-in fades in over its
 * detail first (it sits on or in front of it) and the detail dissolves after, so the two never leave a gap.
 */
const FRAGMENT = '#include <opaque_fragment>';
const FRAGMENT_LOD = 'diffuseColor.a *= vLodAlpha;\n#include <opaque_fragment>';

function lodMaterial(base: THREE.Material, mode: LodMode, range: number, role: Role) {
  const m = base.clone();
  const span = fadeSpan(mode, range);
  const uniforms = { uLodFrom: { value: span.from }, uLodTo: { value: span.to } };
  m.userData.lodSpan = (reach: number) => {
    const s = fadeSpan(mode, range * reach);
    uniforms.uLodFrom.value = s.from;
    uniforms.uLodTo.value = s.to;
  };
  if (role !== 'plain') {
    m.transparent = true;
    m.colorWrite = role === 'blend';
    m.depthWrite = role === 'depth';
    if (mode === 'far') {
      // Fully faded in while its detail dissolves: faces the two share go to the detail.
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
    }
  }
  m.onBeforeCompile = (shader, renderer) => {
    base.onBeforeCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const defines = `${mode === 'far' ? '#define LOD_FAR\n' : ''}#define LOD_PLAIN ${role === 'plain'}\n`;
    const pars = 'attribute vec3 lodOrigin;\nuniform float uLodFrom;\nuniform float uLodTo;\nflat varying float vLodAlpha;';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${defines}${pars}`).replace('#include <project_vertex>', VERTEX);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nflat varying float vLodAlpha;');
    if (role !== 'plain') shader.fragmentShader = shader.fragmentShader.replace(FRAGMENT, FRAGMENT_LOD);
  };
  m.customProgramCacheKey = () => `${base.customProgramCacheKey()}|lod-${mode}-${role}`;
  m.userData.lodClone = true;
  m.userData.lodBase = base;
  return m;
}

/** Metres the per-chunk distance checks are padded by: they run a frame late and must never hide a part in range. */
const MARGIN = 2;

const eye = new THREE.Vector3();

/** Farthest distance from `p` to the box. */
function farthest(box: THREE.Box3, p: THREE.Vector3) {
  const x = Math.max(Math.abs(p.x - box.min.x), Math.abs(p.x - box.max.x));
  const y = Math.max(Math.abs(p.y - box.min.y), Math.abs(p.y - box.max.y));
  const z = Math.max(Math.abs(p.z - box.min.z), Math.abs(p.z - box.max.z));
  return Math.sqrt(x * x + y * y + z * z);
}

interface Draw {
  mesh: SceneryChunk;
  role: Role;
  mode: LodMode;
  origins: THREE.Box3;
}

/**
 * Small detail parts dissolve between `range - 6` and `range` metres from the camera (`near`); their stand-ins fade
 * in just before that (`far`). Each merged chunk of them draws its opaque parts and, where the band crosses it, a
 * depth then a blended twin; the shader decides per part, and a draw none of whose parts can show is hidden.
 */
export class DetailFades {
  /** Add to the scene: once a frame it hides the draws that cannot show for the next frame's camera. */
  readonly tracker: THREE.Mesh;
  private readonly materials = new Map<string, THREE.Material>();
  private readonly draws: Draw[] = [];
  /** Share of `range` in use: the renderer lowers it (scene.userData.detailReach) when frames can't keep up. */
  private reach = 1;

  constructor(private readonly range: number) {
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
    this.tracker = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3)), material);
    this.tracker.frustumCulled = false;
    this.tracker.raycast = () => {};
    this.tracker.onBeforeRender = (_renderer, scene, camera) => this.track(camera, (scene.userData.detailReach as number | undefined) ?? 1);
  }

  /** Turns a chunk built with origins into its plain draw; returns the twins, for the caller to add. */
  apply(chunk: SceneryChunk, mode: LodMode): SceneryChunk[] {
    const base = chunk.material;
    const origins = chunk.geometry.userData.origins as THREE.Box3;
    const roles: Role[] = base.transparent ? ['blend'] : ['depth', 'blend'];
    const twins = roles.map((role) => {
      const twin = new SceneryChunk(chunk.geometry, this.material(base, mode, role));
      twin.name = chunk.name;
      twin.receiveShadow = chunk.receiveShadow;
      // Same z and order: the depth twin, made first, draws right before its blend twin.
      twin.renderOrder = BLEND_ORDER;
      twin.userData.noAO = true;
      this.draws.push({ mesh: twin, role, mode, origins });
      return twin;
    });
    chunk.material = this.material(base, mode, 'plain');
    // The AO pass draws every part of a chunk: stand-ins would cover the detail up close.
    chunk.userData.noAO = mode === 'far';
    this.draws.push({ mesh: chunk, role: 'plain', mode, origins });
    return twins;
  }

  dispose() {
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    this.tracker.geometry.dispose();
    (this.tracker.material as THREE.Material).dispose();
  }

  private track(camera: THREE.Camera, reach: number) {
    if (reach !== this.reach) {
      this.reach = reach;
      for (const m of this.materials.values()) (m.userData.lodSpan as (reach: number) => void)(reach);
    }
    eye.setFromMatrixPosition(camera.matrixWorld);
    for (const d of this.draws) {
      const span = fadeSpan(d.mode, this.range * this.reach);
      const near = d.origins.distanceToPoint(eye);
      const far = farthest(d.origins, eye);
      if (d.role !== 'plain') d.mesh.visible = near < span.to + MARGIN && far >= span.from - MARGIN;
      else d.mesh.visible = d.mode === 'near' ? near < span.from + MARGIN : far >= span.to - MARGIN;
    }
  }

  private material(base: THREE.Material, mode: LodMode, role: Role) {
    const key = `${base.uuid}|${mode}|${role}`;
    let m = this.materials.get(key);
    if (!m) this.materials.set(key, (m = lodMaterial(base, mode, this.range, role)));
    return m;
  }
}

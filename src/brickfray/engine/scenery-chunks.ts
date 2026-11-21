import * as THREE from 'three';

/** One placed part: a shared geometry (position, normal and optional bevel), its placement and its colour. */
export interface ChunkPart {
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  color: THREE.Color;
}

export interface MergeOptions {
  /** World directions of the two faces each bevel facet rounds off (`bevelA`, `bevelB`), for the bevel shading. */
  edges: boolean;
  /** Each part's origin on all its vertices (`lodOrigin`), for fades by distance. */
  origins: boolean;
}

/** Side of the ground cells parts are merged by, in metres: a cell is one draw, culled as a whole. */
export const CHUNK_CELL = 12;

/** A merged chunk of static scenery: drawn, never hit-tested (the builder's parts proxy answers rays). */
export class SceneryChunk extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    super(geometry, material);
    this.matrixAutoUpdate = false;
  }

  override raycast() {}
}

/** The two face normals a bevel facet with object-space normal `n` lies between, as the bevel shader expects them. */
export function bevelFaces(n: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  const sx = Math.sign(n.x);
  const sy = Math.sign(n.y);
  const sz = Math.sign(n.z);
  if (ax >= ay && ax >= az) {
    a.set(sx, 0, 0);
    if (ay >= az) b.set(0, sy, 0);
    else b.set(0, 0, sz);
  } else if (ay >= az) {
    a.set(0, sy, 0);
    if (ax >= az) b.set(sx, 0, 0);
    else b.set(0, 0, sz);
  } else {
    a.set(0, 0, sz);
    if (ax >= ay) b.set(sx, 0, 0);
    else b.set(0, sy, 0);
  }
}

interface Source {
  count: number;
  position: ArrayLike<number>;
  normal: ArrayLike<number>;
  bevel: ArrayLike<number> | null;
  center: THREE.Vector3;
}

/** A geometry's vertices as flat arrays, unindexed. */
function source(geometry: THREE.BufferGeometry): Source {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const read = (name: string, size: number) => {
    const attribute = g.getAttribute(name);
    if (!attribute) return null;
    const out = new Float32Array(attribute.count * size);
    for (let i = 0; i < attribute.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = attribute.getComponent(i, k);
    return out;
  };
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  return {
    count: g.getAttribute('position').count,
    position: read('position', 3)!,
    normal: read('normal', 3)!,
    bevel: read('bevel', 1),
    center: geometry.boundingSphere!.center
  };
}

/** Once on the GPU, the merged arrays are not needed again (chunks are never hit-tested or re-bounded). */
function dropArray(this: { array: unknown }) {
  this.array = null;
}

const normalMatrix = new THREE.Matrix3();
const n = new THREE.Vector3();
const fa = new THREE.Vector3();
const fb = new THREE.Vector3();
const center = new THREE.Vector3();

const snorm = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 127);

/**
 * Bakes placed parts into one geometry per CHUNK_CELL square (by the centre of each part): world positions and
 * normals, the part colour on every vertex, the bevel flag, and what `options` asks for. ANGLE's Metal backend draws
 * every part of a batched mesh separately, so thousands of parts cost thousands of draws a frame; a chunk is one.
 */
export function mergeChunks(parts: readonly ChunkPart[], options: MergeOptions): THREE.BufferGeometry[] {
  const sources = new Map<THREE.BufferGeometry, Source>();
  const cells = new Map<string, { parts: ChunkPart[]; count: number }>();
  for (const part of parts) {
    let s = sources.get(part.geometry);
    if (!s) sources.set(part.geometry, (s = source(part.geometry)));
    center.copy(s.center).applyMatrix4(part.matrix);
    const key = `${Math.floor(center.x / CHUNK_CELL)},${Math.floor(center.z / CHUNK_CELL)}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { parts: [], count: 0 }));
    cell.parts.push(part);
    cell.count += s.count;
  }
  const out: THREE.BufferGeometry[] = [];
  for (const cell of cells.values()) {
    const count = cell.count;
    const position = new Float32Array(count * 3);
    const normal = new Int8Array(count * 4);
    const color = new Float32Array(count * 3);
    const bevel = new Float32Array(count);
    const edgeA = options.edges ? new Int8Array(count * 4) : null;
    const edgeB = options.edges ? new Int8Array(count * 4) : null;
    const origin = options.origins ? new Float32Array(count * 3) : null;
    const origins = new THREE.Box3();
    let v = 0;
    for (const part of cell.parts) {
      const s = sources.get(part.geometry)!;
      const e = part.matrix.elements;
      const m = normalMatrix.getNormalMatrix(part.matrix).elements;
      origins.expandByPoint(center.set(e[12]!, e[13]!, e[14]!));
      for (let i = 0; i < s.count; i++, v++) {
        const x = s.position[i * 3]!;
        const y = s.position[i * 3 + 1]!;
        const z = s.position[i * 3 + 2]!;
        position[v * 3] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        position[v * 3 + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        position[v * 3 + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
        n.set(s.normal[i * 3]!, s.normal[i * 3 + 1]!, s.normal[i * 3 + 2]!);
        const nx = m[0]! * n.x + m[3]! * n.y + m[6]! * n.z;
        const ny = m[1]! * n.x + m[4]! * n.y + m[7]! * n.z;
        const nz = m[2]! * n.x + m[5]! * n.y + m[8]! * n.z;
        const len = Math.hypot(nx, ny, nz) || 1;
        normal[v * 4] = snorm(nx / len);
        normal[v * 4 + 1] = snorm(ny / len);
        normal[v * 4 + 2] = snorm(nz / len);
        color[v * 3] = part.color.r;
        color[v * 3 + 1] = part.color.g;
        color[v * 3 + 2] = part.color.b;
        const b = s.bevel ? s.bevel[i]! : 0;
        bevel[v] = b;
        if (edgeA && edgeB && b > 0.5) {
          bevelFaces(n, fa, fb);
          fa.applyMatrix3(normalMatrix).normalize();
          fb.applyMatrix3(normalMatrix).normalize();
          edgeA[v * 4] = snorm(fa.x);
          edgeA[v * 4 + 1] = snorm(fa.y);
          edgeA[v * 4 + 2] = snorm(fa.z);
          edgeB[v * 4] = snorm(fb.x);
          edgeB[v * 4 + 1] = snorm(fb.y);
          edgeB[v * 4 + 2] = snorm(fb.z);
        }
        if (origin) {
          origin[v * 3] = e[12]!;
          origin[v * 3 + 1] = e[13]!;
          origin[v * 3 + 2] = e[14]!;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normal, 4, true));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute('bevel', new THREE.BufferAttribute(bevel, 1));
    if (edgeA && edgeB) {
      g.setAttribute('bevelA', new THREE.BufferAttribute(edgeA, 4, true));
      g.setAttribute('bevelB', new THREE.BufferAttribute(edgeB, 4, true));
    }
    if (origin) g.setAttribute('lodOrigin', new THREE.BufferAttribute(origin, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    g.userData.origins = origins;
    for (const attribute of Object.values(g.attributes)) (attribute as THREE.BufferAttribute).onUpload(dropArray);
    out.push(g);
  }
  return out;
}

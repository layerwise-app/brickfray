import * as THREE from 'three';

/**
 * Showroom extras made offline in Blender by `scripts/hero-bake`: ambient occlusion baked per vertex for each
 * posed figure, and cloth draped over it by simulation. They are optional: a figure built without them is the
 * plain procedural one.
 */
export type Drape = Record<string, THREE.BufferGeometry>;

interface Manifest {
  occlusion: { id: string; vertices: number }[];
  drapes: { name: string; vertices: number; groups: { name: string; indices: number }[] }[];
}

const occlusion = new Map<string, Uint8Array>();
const drapes = new Map<string, Drape>();
let pending: Promise<void> | null = null;

export const heroOcclusion = (id: string) => occlusion.get(id);
export const heroDrape = (name: string) => drapes.get(name);

/** Fetches every asset once; resolves when they are usable, also when some are missing. */
export function loadHeroAssets(options: { occlusion?: boolean; drapes?: boolean } = {}, base = '/models/hero') {
  pending ??= load(base, options.occlusion ?? true, options.drapes ?? true).catch((error: unknown) => console.error('Showroom assets failed to load; using the plain models', error));
  return pending;
}

/** `draped` false leaves every draped piece off the figure: the bare body the cloth is simulated against. */
async function load(base: string, shaded: boolean, draped: boolean) {
  const bytes = async (file: string) => {
    const response = await fetch(`${base}/${file}`);
    if (!response.ok) throw new Error(`${file}: ${response.status}`);
    return response.arrayBuffer();
  };
  const manifest = JSON.parse(new TextDecoder().decode(await bytes('manifest.json'))) as Manifest;
  await Promise.all([
    ...(shaded ? manifest.occlusion : []).map(async ({ id, vertices }) => occlusion.set(id, unpack(new Uint8Array(await bytes(`${id}.ao`)), vertices))),
    ...manifest.drapes.map(async (drape) =>
      drapes.set(drape.name, draped ? readDrape(drape, await bytes(`${drape.name}.bin`)) : readDrape({ ...drape, vertices: 0, groups: drape.groups.map((g) => ({ ...g, indices: 0 })) }, new ArrayBuffer(0)))
    )
  ]);
}

/** Occlusion is stored in sixteen levels, two vertices per byte, low nibble first. */
function unpack(packed: Uint8Array, vertices: number) {
  const out = new Uint8Array(vertices);
  for (let i = 0; i < vertices; i++) out[i] = ((packed[i >> 1]! >> ((i & 1) * 4)) & 15) * 17;
  return out;
}

/** Layout: float32 positions, int8 normals (padded to 4 bytes per vertex), then uint16 indices group after group. */
function readDrape(drape: Manifest['drapes'][number], data: ArrayBuffer): Drape {
  const n = drape.vertices;
  const position = new Float32Array(data, 0, n * 3);
  const normal = new Int8Array(data, n * 12, n * 4);
  let offset = n * 16;
  const out: Drape = {};
  for (const group of drape.groups) {
    const index = new Uint16Array(data, offset, group.indices);
    offset += group.indices * 2;
    // Characters are baked from unindexed parts.
    const p = new Float32Array(group.indices * 3);
    const nm = new Float32Array(group.indices * 3);
    index.forEach((v, i) => {
      p.set(position.subarray(v * 3, v * 3 + 3), i * 3);
      nm.set([normal[v * 4]! / 127, normal[v * 4 + 1]! / 127, normal[v * 4 + 2]! / 127], i * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(nm, 3));
    out[group.name] = geometry;
  }
  return out;
}

/** Darkens a baked figure's colours by its occlusion, one byte per vertex across the given geometries in order. */
export function occlude(id: string, geometries: THREE.BufferGeometry[]) {
  const ao = occlusion.get(id);
  if (!ao) return;
  const colors = geometries.map((g) => g.getAttribute('color') as THREE.BufferAttribute);
  if (colors.reduce((sum, c) => sum + c.count, 0) !== ao.length) {
    console.warn(`Occlusion for ${id} was baked for a different model; run scripts/hero-bake again`);
    return;
  }
  let at = 0;
  for (const color of colors) {
    const rgb = color.array as Float32Array;
    for (let i = 0; i < color.count; i++) {
      const k = ao[at + i]! / 255;
      rgb[i * 3] = rgb[i * 3]! * k;
      rgb[i * 3 + 1] = rgb[i * 3 + 1]! * k;
      rgb[i * 3 + 2] = rgb[i * 3 + 2]! * k;
    }
    at += color.count;
    color.needsUpdate = true;
  }
}

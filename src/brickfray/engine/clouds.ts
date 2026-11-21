import * as THREE from 'three';

export interface CloudSky {
  zenith: string;
  horizon: string;
  sunColor: string;
  sunDirection: THREE.Vector3;
  clouds?: { count: number; seed: number };
}

/** Turn rate of the cloud ring, radians per second: about a metre a second at its distance. */
export const CLOUD_DRIFT = 0.0035;

const WHITE = new THREE.Color('#ffffff');
/** Box faces: outward normal and corner loop (bottom 0-3, top 4-7); winding is fixed up per face. */
const FACES: [number, number, number, number[]][] = [
  [0, 1, 0, [4, 5, 6, 7]],
  [0, -1, 0, [0, 1, 2, 3]],
  [1, 0, 0, [1, 2, 6, 5]],
  [-1, 0, 0, [0, 3, 7, 4]],
  [0, 0, 1, [3, 2, 6, 7]],
  [0, 0, -1, [0, 1, 5, 4]]
];

/**
 * A ring of flat, stacked-slab clouds a few hundred metres out, coloured per face at build time (sunlit sides,
 * sky-tinted undersides, hazier near the horizon) so they draw unlit in one call. Centred on the camera every
 * frame like the sky; the ring turns slowly.
 */
export function buildClouds(sky: CloudSky): THREE.Mesh | null {
  const spec = sky.clouds;
  if (!spec) return null;
  let seed = spec.seed * 7919 + 13;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const zenith = new THREE.Color(sky.zenith);
  const horizon = new THREE.Color(sky.horizon);
  const sun = sky.sunDirection.clone().setY(0).normalize();
  const lit = WHITE.clone().lerp(new THREE.Color(sky.sunColor), 0.25).multiplyScalar(1.12);
  const shadow = WHITE.clone().lerp(zenith, 0.22).multiplyScalar(0.9);
  const under = WHITE.clone().lerp(zenith, 0.2).multiplyScalar(0.86);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const slabBox = (cx: number, cy: number, cz: number, w: number, h: number, d: number, yaw: number) => {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const corner = (i: number) => {
      const x = [0, 3, 4, 7].includes(i) ? -w / 2 : w / 2;
      const z = [0, 1, 4, 5].includes(i) ? -d / 2 : d / 2;
      return new THREE.Vector3(cx + x * cos + z * sin, cy + (i >= 4 ? h : 0), cz - x * sin + z * cos);
    };
    const elevation = Math.atan2(cy + h / 2, Math.hypot(cx, cz));
    const haze = THREE.MathUtils.clamp(1 - elevation / 0.42, 0, 1) * 0.45;
    for (const [nx, ny, nz, quad] of FACES) {
      n.set(nx * cos + nz * sin, ny, -nx * sin + nz * cos);
      if (ny > 0) c.copy(lit);
      else if (ny < 0) c.copy(under);
      else c.copy(shadow).lerp(lit, THREE.MathUtils.clamp(0.5 + 0.5 * n.dot(sun), 0, 1));
      c.lerp(horizon, haze);
      const p = quad.map(corner);
      const facing = e1.subVectors(p[1]!, p[0]!).cross(e2.subVectors(p[2]!, p[0]!)).dot(n);
      for (const k of facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) {
        pos.push(p[k]!.x, p[k]!.y, p[k]!.z);
        nor.push(n.x, n.y, n.z);
        col.push(c.r, c.g, c.b);
      }
    }
  };
  for (let i = 0; i < spec.count; i++) {
    const azimuth = ((i + rand() * 0.6) / spec.count) * Math.PI * 2;
    const dist = 320 + rand() * 80;
    const base = 105 + rand() * 65;
    const yaw = azimuth;
    const w = 40 + rand() * 32;
    const d = 16 + rand() * 10;
    // Local (along, out) to world: a flat-bottomed cluster of slabs, wider below and stepping in above.
    const at = (u: number, v: number) => [Math.sin(azimuth) * (dist + v) + Math.cos(yaw) * u, Math.cos(azimuth) * (dist + v) - Math.sin(yaw) * u] as const;
    const put = (u: number, v: number, y: number, sw: number, sh: number, sd: number) => {
      const [x, z] = at(u, v);
      slabBox(x, base + y, z, sw, sh, sd, yaw);
    };
    put(0, 0, 0, w, 6, d);
    const lobes = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < lobes; k++) {
      const side = k % 2 ? 1 : -1;
      put(side * w * (0.35 + rand() * 0.2), (rand() - 0.5) * d * 0.5, 0, w * (0.35 + rand() * 0.25), 6, d * (0.55 + rand() * 0.35));
    }
    put((rand() - 0.5) * w * 0.3, (rand() - 0.5) * d * 0.3, 6, w * (0.5 + rand() * 0.2), 6, d * 0.75);
    put((rand() - 0.5) * w * 0.25, (rand() - 0.5) * d * 0.2, 12, w * (0.22 + rand() * 0.14), 5, d * 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // GTAO's normal pass reads a mesh without normals as a deep occluder.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  mesh.name = 'clouds';
  mesh.frustumCulled = false;
  return mesh;
}

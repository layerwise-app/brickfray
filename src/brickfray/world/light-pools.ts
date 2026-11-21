import * as THREE from 'three';

const GRID = 10;

/**
 * Pools of lamp light on floors: additive patches that fade from the centre, each clipped to the surface it lies on.
 * All pools of a map share one mesh.
 */
export class LightPools {
  private pos: number[] = [];
  private col: number[] = [];
  private index: number[] = [];

  /** Pool of radius r at (x, z) on the surface at height y, clipped to [x0, z0, x1, z1] when given. */
  add(x: number, z: number, y: number, r: number, color: string, strength: number, clip?: [number, number, number, number]) {
    const [cx0, cz0, cx1, cz1] = clip ?? [-Infinity, -Infinity, Infinity, Infinity];
    const ax = Math.max(cx0, x - r);
    const bx = Math.min(cx1, x + r);
    const az = Math.max(cz0, z - r);
    const bz = Math.min(cz1, z + r);
    if (bx <= ax || bz <= az) return;
    const c = new THREE.Color(color);
    const base = this.pos.length / 3;
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) {
        const px = ax + ((bx - ax) * i) / GRID;
        const pz = az + ((bz - az) * j) / GRID;
        const fall = Math.max(0, 1 - Math.hypot(px - x, pz - z) / r);
        const k = strength * fall * fall * (3 - 2 * fall);
        this.pos.push(px, y, pz);
        this.col.push(c.r * k, c.g * k, c.b * k);
      }
    }
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = base + j * (GRID + 1) + i;
        this.index.push(a, a + GRID + 1, a + 1, a + 1, a + GRID + 1, a + GRID + 2);
      }
    }
  }

  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    // GTAO redraws the scene with a normal material; without normals the pools read as deep occluders.
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(this.pos.length / 3).fill([0, 1, 0]).flat(), 3));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'light-pools';
    mesh.renderOrder = 1;
    return {
      mesh,
      dispose() {
        g.dispose();
        material.dispose();
      }
    };
  }
}

import * as THREE from 'three';
import type { CollisionWorld } from '../sim/collision';

const SIDES = 16;
/** Share of a billow's half-size that is dense enough to hide what is behind it. */
const DENSE = 0.6;
/** Opacity a billow needs before it hides the scenery's occlusion. */
const OPAQUE = 0.45;
/** How far a patch stands off the wall: past window frames and sills, too little to cast occlusion of its own. */
const STANDOFF = 0.22;
const REACH = 80;

const eye = new THREE.Vector3();
const ray = new THREE.Vector3();
const n = new THREE.Vector3();
const u = new THREE.Vector3();
const w = new THREE.Vector3();
const c = new THREE.Vector3();

/**
 * Flat patches of wall laid just in front of the scenery behind thick smoke and fire, drawn only into the ambient-
 * occlusion pass's depth and normals (never into the picture). Without them the occlusion of window frames and ledges
 * behind a smoke cloud is multiplied over the cloud as dark dotted outlines; with them the pass sees a plain wall
 * there. They lie on the wall rather than at the smoke, so their edges make no depth step for the pass to outline.
 */
export class AoMask {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;
  private count = 0;

  constructor(
    private readonly capacity: number,
    private readonly world: CollisionWorld | null
  ) {
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(capacity * SIDES * 9), 3);
    this.normal = new THREE.BufferAttribute(new Float32Array(capacity * SIDES * 9), 3);
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.normal.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('normal', this.normal);
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    this.mesh.name = 'smoke-ao-mask';
    this.mesh.frustumCulled = false;
    // Only a pass that swaps every material (the occlusion pass's normal buffer) draws the patches.
    this.mesh.onBeforeRender = (_r, scene, _c, g) => g.setDrawRange(0, scene.overrideMaterial ? this.count * SIDES * 3 : 0);
  }

  begin(camera: THREE.Camera) {
    camera.getWorldPosition(eye);
    this.count = 0;
  }

  /** One billow at `p` of full width `size` and current opacity. */
  add(p: THREE.Vector3, size: number, opacity: number) {
    if (opacity < OPAQUE || this.count >= this.capacity || !this.world) return;
    const dist = ray.subVectors(p, eye).length();
    if (dist < 0.5) return;
    ray.divideScalar(dist);
    const hit = this.world.raycast(eye.x, eye.y, eye.z, ray.x, ray.y, ray.z, REACH, false);
    if (!hit || hit.t < dist) return;
    n.set(...hit.normal);
    const facing = Math.abs(n.dot(ray));
    if (facing < 0.25) return;
    // The billow's dense disc as seen from the eye, carried back onto the wall and widened where the wall is slanted.
    const r = (((size * 0.5 * DENSE) / dist) * hit.t) / facing;
    c.copy(eye).addScaledVector(ray, hit.t).addScaledVector(n, STANDOFF);
    u.set(Math.abs(n.y) > 0.9 ? 1 : 0, Math.abs(n.y) > 0.9 ? 0 : 1, 0).cross(n).normalize();
    w.crossVectors(n, u);
    const pos = this.position.array as Float32Array;
    const nrm = this.normal.array as Float32Array;
    let o = this.count * SIDES * 9;
    for (let i = 0; i < SIDES; i++) {
      const a0 = (i / SIDES) * Math.PI * 2;
      const a1 = ((i + 1) / SIDES) * Math.PI * 2;
      for (const [x, y] of [[0, 0], [Math.cos(a0) * r, Math.sin(a0) * r], [Math.cos(a1) * r, Math.sin(a1) * r]] as const) {
        pos[o] = c.x + u.x * x + w.x * y;
        pos[o + 1] = c.y + u.y * x + w.y * y;
        pos[o + 2] = c.z + u.z * x + w.z * y;
        nrm[o] = n.x;
        nrm[o + 1] = n.y;
        nrm[o + 2] = n.z;
        o += 3;
      }
    }
    this.count++;
  }

  end() {
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
  }
}

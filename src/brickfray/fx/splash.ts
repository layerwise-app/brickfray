import * as THREE from 'three';
import type { Shockwaves } from './shockwave';
import type { SpritePool } from './sprites';

interface Surface {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
}

/** Splashes farther than this from the camera (m) are not drawn. */
const SEEN = 120;
/** How far under a drawn surface a pool's floor collider can lie (m). */
const DEPTH = 0.5;
const jitter = (spread: number) => (Math.random() - 0.5) * spread;
const p = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();

/** Bullets into water: a white column and spray where the shot goes in, and a ring spreading on the surface. */
export class Splashes {
  private surfaces: Surface[] | null = null;

  constructor(
    private readonly smoke: SpritePool,
    private readonly rings: Shockwaves
  ) {}

  /** Reads every water surface off the drawn water meshes (six vertices per rectangle, opposite corners 0 and 2). */
  find(scene: THREE.Object3D) {
    const surfaces: Surface[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.name !== 'water') return;
      const pos = mesh.geometry.getAttribute('position');
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i + 5 < pos.count; i += 6) {
        a.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, i + 2).applyMatrix4(mesh.matrixWorld);
        surfaces.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), y: a.y });
      }
    });
    this.surfaces = surfaces;
  }

  get ready() {
    return this.surfaces !== null;
  }

  /** A shot from `from` to `to`: a splash where it first goes down into water, unless it ends right there (a hit on a water collider splashes by itself). */
  shot(from: THREE.Vector3, to: THREE.Vector3, eye: THREE.Vector3 | null, small: boolean) {
    if (!this.surfaces?.length || from.y <= to.y) return;
    let best = Infinity;
    for (const s of this.surfaces) {
      if (from.y <= s.y || to.y >= s.y) continue;
      const k = (from.y - s.y) / (from.y - to.y);
      if (k >= best) continue;
      const x = from.x + (to.x - from.x) * k;
      const z = from.z + (to.z - from.z) * k;
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      best = k;
      p.set(x, s.y, z);
    }
    // A shot that stops just under the surface hit the pool's floor, which splashes on the surface by itself.
    if (best === Infinity || this.under(to)) return;
    if (eye && p.distanceTo(eye) > SEEN) return;
    this.splash(p, small);
  }

  /** A hit on a pool's floor (its collider) splashes on the drawn surface above it. */
  lift(point: THREE.Vector3) {
    const s = this.under(point);
    return s ? point.clone().setY(s.y) : point;
  }

  /** The water surface `point` lies just under, if any. */
  private under(point: THREE.Vector3) {
    for (const s of this.surfaces ?? []) {
      if (point.y < s.y && point.y > s.y - DEPTH && point.x >= s.x0 && point.x <= s.x1 && point.z >= s.z0 && point.z <= s.z1) return s;
    }
    return null;
  }

  splash(at: THREE.Vector3, small = false) {
    const column = small ? 4 : 10;
    for (let i = 0; i < column; i++) {
      this.smoke.emit({
        position: at,
        velocity: new THREE.Vector3(jitter(0.6), (small ? 2.2 : 3.4) + Math.random() * 2.8, jitter(0.6)),
        size: (small ? 0.07 : 0.1) + Math.random() * 0.04,
        grow: 0.5,
        color: '#f4fbff',
        alpha: 0.95,
        life: 0.5 + Math.random() * 0.15,
        gravity: 9.8
      });
    }
    for (let i = 0; i < (small ? 2 : 6); i++) {
      this.smoke.emit({ position: at, velocity: new THREE.Vector3(jitter(3), 1.5 + Math.random() * 1.6, jitter(3)), size: 0.035, color: '#ffffff', life: 0.45, gravity: 9.8 });
    }
    this.smoke.emit({ position: a.copy(at).setY(at.y + 0.03), velocity: new THREE.Vector3(0, 0.25, 0), size: small ? 0.16 : 0.26, grow: 0.9, color: '#e6f4fa', alpha: 0.75, life: 0.55, drag: 2 });
    this.rings.add(a.copy(at).setY(at.y + 0.01), 0.05, small ? 0.35 : 0.8, 0.65, '#86bfd2');
  }
}

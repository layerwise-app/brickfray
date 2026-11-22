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
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const p = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();

/** Bullets into water: a jet thrown up where the shot goes in, a crown of droplets arcing out, foam and rings on the surface. */
export class Splashes {
  private surfaces: Surface[] | null = null;
  /** The end of the last shot whose path splashed, so its hit on the pool's floor does not splash again. */
  private readonly splashedEnd = new THREE.Vector3(Infinity, 0, 0);

  constructor(
    private readonly smoke: SpritePool,
    private readonly glow: SpritePool,
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

  /** A shot from `from` to `to`: a splash where it first goes down into water, whatever it hits under it. */
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
    if (best === Infinity) return;
    this.splashedEnd.copy(to);
    if (eye && p.distanceTo(eye) > SEEN) return;
    this.splash(p, small);
  }

  /** A hit on a pool's floor (its collider) splashes on the drawn surface above it, unless the shot's path already did. */
  hit(point: THREE.Vector3) {
    if (point.distanceToSquared(this.splashedEnd) < 1e-6) return;
    const s = this.under(point);
    this.splash(s ? a.copy(point).setY(s.y) : point);
  }

  /** The water surface `point` lies just under, if any. */
  private under(point: THREE.Vector3) {
    for (const s of this.surfaces ?? []) {
      if (point.y < s.y && point.y > s.y - DEPTH && point.x >= s.x0 && point.x <= s.x1 && point.z >= s.z0 && point.z <= s.z1) return s;
    }
    return null;
  }

  splash(at: THREE.Vector3, small = false) {
    const k = small ? 0.6 : 1;
    // The jet: tall streaks of water thrown straight up, leaning a little, falling back.
    for (let i = 0; i < (small ? 3 : 5); i++) {
      this.smoke.emit({
        position: b.copy(at).setY(at.y + 0.12 * k),
        velocity: v(jitter(0.5), (2.4 + Math.random() * 1.6) * k, jitter(0.5)),
        size: (0.34 + Math.random() * 0.22) * k,
        color: '#eef8ff',
        alpha: 0.92,
        life: 0.38 + Math.random() * 0.12,
        gravity: 9.8,
        shape: 'spark',
        rotation: Math.PI / 2 + jitter(0.5)
      });
    }
    // The crown: droplets flung out in a ring, arcing back down to the water.
    const crown = small ? 7 : 14;
    for (let i = 0; i < crown; i++) {
      const turn = ((i + Math.random() * 0.6) / crown) * Math.PI * 2;
      const out = (0.8 + Math.random() * 1.5) * k;
      this.smoke.emit({
        position: at,
        velocity: v(Math.cos(turn) * out, (1.8 + Math.random() * 2.2) * k, Math.sin(turn) * out),
        size: 0.04 + Math.random() * 0.035,
        color: '#ffffff',
        alpha: 0.95,
        life: 0.45 + Math.random() * 0.2,
        gravity: 9.8
      });
    }
    // A glint where it went in, foam on the surface and rings racing out across it.
    this.glow.emit({ position: b.copy(at).setY(at.y + 0.05), size: 0.22 * k, color: '#dff4ff', alpha: 0.5, life: 0.08 });
    this.smoke.emit({ position: b.copy(at).setY(at.y + 0.03), velocity: v(0, 0.12, 0), size: 0.24 * k, grow: 1.1, color: '#e6f4fa', alpha: 0.8, life: 0.65, drag: 2 });
    b.copy(at).setY(at.y + 0.01);
    this.rings.add(b, 0.05, 0.75 * k, 0.55, '#d8eef7');
    this.rings.add(b, 0.05, 1.25 * k, 1.0, '#86bfd2');
  }
}

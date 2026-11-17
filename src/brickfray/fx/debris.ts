import * as THREE from 'three';
import { chamferBox } from '../engine/geometry';
import type { Kit } from '../engine/kit';
import type { CollisionWorld } from '../sim/collision';
import { collideSphere } from './physics';

interface Chip {
  slot: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  w: THREE.Vector3;
  size: THREE.Vector3;
  life: number;
  maxLife: number;
  resting: boolean;
  bounced: number;
}

const GRAVITY = 18;
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpM = new THREE.Matrix4();

/**
 * Plastic chips and brick chunks: instanced, lit, bouncing on the collision
 * boxes, then shrinking away. Oldest pieces recycle when the pool is full.
 */
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  private chips: Chip[] = [];
  private free: number[] = [];
  onBounce: ((position: THREE.Vector3, speed: number) => void) | null = null;

  constructor(
    kit: Kit,
    private readonly world: CollisionWorld | null,
    readonly capacity = kit.profile.maxDebris
  ) {
    const geometry = chamferBox(1, 1, 1, kit.profile.bevel > 0 ? 0.08 : 0);
    this.mesh = new THREE.InstancedMesh(geometry, kit.materials.get('#ffffff'), capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.castShadow = kit.profile.shadows;
    this.mesh.frustumCulled = false;
    this.mesh.count = capacity;
    for (let i = 0; i < capacity; i++) {
      this.free.push(i);
      this.mesh.setMatrixAt(i, tmpM.makeScale(0, 0, 0));
    }
  }

  spawn(position: THREE.Vector3, velocity: THREE.Vector3, size: THREE.Vector3, color: THREE.ColorRepresentation, life = 2.5) {
    let slot = this.free.pop();
    if (slot === undefined) {
      const oldest = this.chips.shift()!;
      slot = oldest.slot;
    }
    this.mesh.setColorAt(slot, new THREE.Color(color));
    this.mesh.instanceColor!.needsUpdate = true;
    this.chips.push({
      slot,
      p: position.clone(),
      v: velocity.clone(),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
      w: new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24),
      size: size.clone(),
      life,
      maxLife: life,
      resting: false,
      bounced: 0
    });
  }

  /** A spray of small chips leaving a surface along its normal. */
  burst(point: THREE.Vector3, normal: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed = 3.2, size = 0.05) {
    for (let i = 0; i < count; i++) {
      const v = normal.clone().multiplyScalar(speed * (0.5 + Math.random()));
      v.x += (Math.random() - 0.5) * speed;
      v.y += Math.random() * speed * 0.9;
      v.z += (Math.random() - 0.5) * speed;
      const s = size * (0.6 + Math.random() * 0.8);
      this.spawn(point.clone().addScaledVector(normal, 0.03), v, tmpS.set(s, s * 0.6, s), color, 1.6 + Math.random() * 1.2);
    }
  }

  update(dt: number) {
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i]!;
      c.life -= dt;
      if (c.life <= 0) {
        this.mesh.setMatrixAt(c.slot, tmpM.makeScale(0, 0, 0));
        this.free.push(c.slot);
        this.chips.splice(i, 1);
        continue;
      }
      if (!c.resting) {
        c.v.y -= GRAVITY * dt;
        c.p.addScaledVector(c.v, dt);
        tmpQ.setFromAxisAngle(tmpE.copy(c.w).normalize(), c.w.length() * dt);
        c.q.premultiply(tmpQ);
        this.collide(c);
      }
      const fade = Math.min(1, c.life / Math.min(0.6, c.maxLife * 0.3));
      tmpM.compose(c.p, c.q, tmpS.copy(c.size).multiplyScalar(fade));
      this.mesh.setMatrixAt(c.slot, tmpM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private collide(c: Chip) {
    const r = Math.max(c.size.x, c.size.y, c.size.z) * 0.5;
    const { impact, floor } = collideSphere(this.world, c.p, c.v, r);
    if (impact <= 0) return;
    c.w.multiplyScalar(0.6);
    if (impact > 1.5 && c.bounced < 3) {
      c.bounced++;
      this.onBounce?.(c.p, impact);
    }
    if (floor && c.v.lengthSq() < 0.25) {
      c.resting = true;
      c.v.set(0, 0, 0);
      const e = new THREE.Euler().setFromQuaternion(c.q);
      e.x = Math.round(e.x / (Math.PI / 2)) * (Math.PI / 2);
      e.z = Math.round(e.z / (Math.PI / 2)) * (Math.PI / 2);
      c.q.setFromEuler(e);
    }
  }

  clear() {
    for (const c of this.chips) {
      this.mesh.setMatrixAt(c.slot, tmpM.makeScale(0, 0, 0));
      this.free.push(c.slot);
    }
    this.chips = [];
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

import * as THREE from 'three';
import type { ShatterPiece } from '../characters/types';
import type { CollisionWorld } from '../sim/collision';
import { collideSphere } from './physics';

interface Piece extends ShatterPiece {
  radius: number;
  life: number;
  resting: boolean;
  baseScale: THREE.Vector3;
}

const GRAVITY = 18;
const LIFE = 7;
const tmpQ = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();

/** A character's parts tumbling after death; they settle, then shrink away. */
export class ShatterField {
  readonly group = new THREE.Group();
  private pieces: Piece[] = [];
  onClatter: ((position: THREE.Vector3, speed: number) => void) | null = null;

  constructor(
    private readonly world: CollisionWorld | null,
    private readonly maxPieces: number
  ) {
    this.group.name = 'shatter';
  }

  add(pieces: ShatterPiece[]) {
    for (const piece of pieces) {
      const box = new THREE.Box3().setFromObject(piece.mesh);
      const size = box.getSize(new THREE.Vector3());
      piece.mesh.castShadow = true;
      this.group.add(piece.mesh);
      this.pieces.push({ ...piece, radius: Math.max(0.03, Math.min(size.x, size.y, size.z) * 0.5), life: LIFE + Math.random(), resting: false, baseScale: piece.mesh.scale.clone() });
    }
    while (this.pieces.length > this.maxPieces) this.remove(0);
  }

  private remove(index: number) {
    const [piece] = this.pieces.splice(index, 1);
    if (!piece) return;
    this.group.remove(piece.mesh);
  }

  update(dt: number) {
    let clatters = 0;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.remove(i);
        continue;
      }
      const mesh = p.mesh;
      if (!p.resting) {
        p.velocity.y -= GRAVITY * dt;
        mesh.position.addScaledVector(p.velocity, dt);
        const spin = p.angularVelocity.length();
        if (spin > 1e-3) {
          tmpQ.setFromAxisAngle(tmpAxis.copy(p.angularVelocity).divideScalar(spin), spin * dt);
          mesh.quaternion.premultiply(tmpQ);
        }
        const { impact, floor } = collideSphere(this.world, mesh.position, p.velocity, p.radius, 0.3, 0.7);
        if (impact > 0) {
          p.angularVelocity.multiplyScalar(0.55);
          if (impact > 2 && clatters++ < 3) this.onClatter?.(mesh.position, impact);
          if (floor && p.velocity.lengthSq() < 0.2) p.resting = true;
        }
      }
      const shrink = Math.min(1, p.life / 0.8);
      mesh.scale.copy(p.baseScale).multiplyScalar(shrink);
    }
  }

  clear() {
    while (this.pieces.length) this.remove(0);
  }
}

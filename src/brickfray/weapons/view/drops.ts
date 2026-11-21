import * as THREE from 'three';

const GRAVITY = 9.5;
const LIFE = 0.9;

interface Drop {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

const turn = new THREE.Quaternion();
const e = new THREE.Euler();
/** Every drop starts falling at once, a little out to the left and toward the body. */
const nudge = new THREE.Vector3(-0.15, -0.6, 0.05);

/** Fastest a dropped thing leaves the hand sideways (m/s): it was carried, not thrown, and a hand that lets go never lifts it. */
const MAX_SPEED = 1.2;

/** Things let go of mid-action (a magazine or a spear nobody finished loading) that tumble out of view. */
export class Drops {
  private live: Drop[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  /** Leave a copy of `part` falling from where it is now, keeping the `speed` it had; the caller hides or moves the original. */
  add(part: THREE.Object3D, speed: THREE.Vector3) {
    const object = part.clone();
    part.updateWorldMatrix(true, false);
    part.matrixWorld.decompose(object.position, object.quaternion, object.scale);
    object.visible = true;
    this.scene.add(object);
    const velocity = speed.clone();
    velocity.y = Math.min(0, velocity.y);
    this.live.push({ object, velocity: velocity.clampLength(0, MAX_SPEED).add(nudge), spin: new THREE.Vector3(2.5, 0.6, -3), age: 0 });
  }

  update(dt: number) {
    for (const d of this.live) {
      d.age += dt;
      d.velocity.y -= GRAVITY * dt;
      d.object.position.addScaledVector(d.velocity, dt);
      d.object.quaternion.premultiply(turn.setFromEuler(e.set(d.spin.x * dt, d.spin.y * dt, d.spin.z * dt)));
    }
    if (this.live.some((d) => d.age > LIFE)) {
      for (const d of this.live) if (d.age > LIFE) d.object.removeFromParent();
      this.live = this.live.filter((d) => d.age <= LIFE);
    }
  }

  clear() {
    for (const d of this.live) d.object.removeFromParent();
    this.live = [];
  }
}

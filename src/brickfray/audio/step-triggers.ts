import * as THREE from 'three';

/** Ankle height (m, at body scale 1) under which a foot is down (heel contact; flat is 0.085), and over which it is lifted again. */
const DOWN = 0.1;
const LIFTED = 0.13;
/** Phase of the view model's gait bob (weapons/view/motion.ts, 2π per two steps) at which the gun bottoms out: a foot lands. */
export const STRIKE_PHASE = 0.735 * Math.PI;
const BOB_WRAP = 4 * Math.PI;

/**
 * Heel strikes of an animated character, read from its ankle bones after the rig has posed: a foot that comes
 * down under DOWN after being lifted over LIFTED lands once.
 */
export class FootStrikes {
  private readonly feet: THREE.Object3D[];
  private readonly body: THREE.Object3D | null;
  private readonly lifted = [false, false];
  private readonly at = new THREE.Vector3();

  constructor(root: THREE.Object3D) {
    this.feet = ['footL', 'footR'].map((name) => root.getObjectByName(name)).filter((f): f is THREE.Object3D => !!f);
    this.body = root.getObjectByName('pelvis')?.parent ?? null;
  }

  /** Feet that touched down since the last call (0, 1 or 2). */
  update(): number {
    const body = this.body;
    if (!body) return 0;
    let landed = 0;
    this.feet.forEach((foot, i) => {
      const h = body.worldToLocal(foot.getWorldPosition(this.at)).y;
      if (h > LIFTED) this.lifted[i] = true;
      else if (h < DOWN && this.lifted[i]) {
        this.lifted[i] = false;
        landed++;
      }
    });
    return landed;
  }

  reset(): void {
    this.lifted.fill(false);
  }
}

/**
 * The local player's steps, on the first-person gait bob so each one lands as the gun bottoms out. Reads the
 * view model's bob phase each frame; without one it runs the same clock (weapons/view/motion.ts Motion.update).
 */
export class OwnSteps {
  private last: number | null = null;
  private phase = 0;
  private freq = 1.9;

  /** True when a foot lands this frame. */
  update(dt: number, bob: number | null, walking: boolean, sprint: boolean, crouch: boolean): boolean {
    if (bob === null) {
      const target = sprint ? 2.6 : crouch ? 1.6 : 1.9;
      this.freq = target + (this.freq - target) * Math.exp(-5 * dt);
      this.phase = (this.phase + dt * Math.PI * this.freq) % BOB_WRAP;
    } else this.phase = bob;
    const prev = this.last;
    this.last = this.phase;
    if (!walking || prev === null) return false;
    const moved = (((this.phase - prev) % BOB_WRAP) + BOB_WRAP) % BOB_WRAP;
    return Math.floor((prev - STRIKE_PHASE) / Math.PI) !== Math.floor((prev + moved - STRIKE_PHASE) / Math.PI);
  }
}


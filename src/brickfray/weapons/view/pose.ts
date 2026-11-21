import * as THREE from 'three';
import type { GunAction } from './action';
import type { Arms } from './arms';
import type { Carry } from './blend';
import type { Frame } from './clip';
import { followPath, goalMatrix, type Goal } from './goals';
import type { Held } from './held';
import type { Motion } from './motion';
import type { Parts } from './parts';
import type { GunRig } from './rig';

/** Seconds the left hand takes to come off a stowed melee weapon onto the gun. */
const UNSTOW = 0.12;

/**
 * Places the gun and both hands each frame: the clip's offsets through the cut blend, the procedural motion, the sight
 * held on the screen center when aimed, and the hands on their goals.
 */
export class ViewPose {
  private readonly basePos = new THREE.Vector3();
  private readonly baseQuat = new THREE.Quaternion();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpE = new THREE.Euler();
  private readonly tmpM = new THREE.Matrix4();
  private stowing = false;

  constructor(
    private readonly arms: Arms,
    private readonly held: Held,
    private readonly carry: Carry,
    private readonly motion: Motion,
    private readonly parts: Parts,
    private readonly action: GunAction,
    private readonly camera: THREE.Camera
  ) {}

  gun(rig: GunRig, f: Frame, ads: number, dt: number) {
    this.motion.rest(rig.sight, ads, this.basePos, this.baseQuat);
    const root = rig.rigged.model.root;
    root.position.copy(this.basePos).add(this.carry.gunPos.apply(f.gunPos, dt)).add(this.motion.pos);
    // An aimed shot's kick turns the gun about the eye (below), so the sights rise together and come back; the rest turns it about the sight.
    const kick = this.motion.kickRot;
    this.tmpV.copy(this.carry.gunRot.apply(f.gunRot, dt)).add(this.motion.rot).addScaledVector(kick, -ads);
    root.quaternion.copy(this.baseQuat).multiply(this.tmpQ.setFromEuler(this.tmpE.set(this.tmpV.x, this.tmpV.y, this.tmpV.z)));

    // Moving parts: clip offsets, or the action a shot sets off (slide kick, hammer and cylinder).
    this.parts.apply(rig, dt, f, this.action);
    root.updateMatrixWorld(true);
    // Shots leave from the screen center, so an aimed sight must stay on it; sway, bob and the clip swing the gun around the dot.
    const dot = rig.rigged.model.sight;
    if (ads > 0 && dot) {
      dot.getWorldPosition(this.tmpV);
      root.position.x -= this.tmpV.x * ads;
      root.position.y -= this.tmpV.y * ads;
      this.tmpQ.setFromEuler(this.tmpE.set(kick.x * ads, kick.y * ads, kick.z * ads));
      root.position.applyQuaternion(this.tmpQ);
      root.quaternion.premultiply(this.tmpQ);
      root.updateMatrixWorld(true);
    }
    this.parts.settle(rig, dt, this.camera);
  }

  hands(rig: GunRig, f: Frame, goals: Record<string, Goal>, dt: number) {
    const grip = rig.tuning.fingers;
    const held = this.held.update(f, dt) ?? grip.left;
    const onGrip = !f.right || (f.right.from === goals.rightRest && f.right.to === goals.rightRest);
    this.arms.setFingers(f.rightFingers ?? grip.right, f.leftFingers ?? held, dt, onGrip, f.rightFingers ? 0 : this.action.squeeze());
    if (this.stowing && !this.held.stowing) this.carry.left.cut(UNSTOW);
    this.stowing = this.held.stowing;
    const left = this.carry.left.apply(this.stowing ? goalMatrix(goals.meleeStow!, this.tmpM) : f.left ? followPath(f.left, this.tmpM) : goalMatrix(goals.leftRest!, this.tmpM), dt);
    const hand = this.arms.left.hand;
    left.decompose(hand.position, hand.quaternion, hand.scale);
    hand.updateMatrixWorld(true);
    const right = this.carry.right.apply(f.right ? followPath(f.right, this.tmpM) : goalMatrix(goals.rightRest!, this.tmpM), dt);
    this.arms.pose(right, left, this.tmpV.copy(this.motion.pos).multiplyScalar(0.4));
    this.held.settle(f);
  }
}

import * as THREE from 'three';
import type { Kit } from '../../engine/kit';
import type { MeleeId } from '../defs';
import { createRiggedModel, type RiggedModel } from '../model';
import { surfaceMaterial } from '../surface';
import type { Frame } from './clip';
import { FINGERS, type FingerPose } from './fingers';
import { goal, type Goal } from './goals';

/** Where a tool handle's axis sits in the left hand's frame once the fingers close on it. */
const HANDLE_IN_FIST = new THREE.Vector3(-0.001, 0, -0.0075);
/** A small weapon is shown larger in the hand than worn, so its blade still reads at arm's length. */
const IN_HAND: Partial<Record<MeleeId, number>> = { knife: 1.3 };
/** A melee weapon whose strike is cut short stays in the fist until the hand is this far down, out of the picture. */
const BELOW_FRAME = -0.27;
/** …or this many seconds at most, if the hand never goes down. */
const PUT_AWAY = 0.35;
/** Seconds a flicked pin is shown, its launch speed (view space) and the pull on it. */
const PIN_LIFE = 0.4;
const PIN_FLICK = new THREE.Vector3(-0.25, 1.1, -0.2);
const PIN_GRAVITY = 9;

/** How far down the thumb's last joint the ring sits. */
const HOOK_DEPTH = -0.011;

const at = new THREE.Vector3();
const to = new THREE.Vector3();
const seat = new THREE.Matrix4();
const scale = new THREE.Vector3();
const spin = new THREE.Quaternion();
const e = new THREE.Euler();

/** What the left hand holds besides the gun: the melee weapon, the grenade and its pin, a shotgun shell. */
export class Held {
  readonly shell: THREE.Mesh;
  private melee: RiggedModel;
  private readonly grenade: RiggedModel;
  private readonly pin: THREE.Object3D | undefined;
  private readonly pinSeat = new THREE.Matrix4();
  private readonly ring: THREE.Vector3;
  private readonly flyFrom = new THREE.Vector3();
  private readonly pinTurn = new THREE.Quaternion();
  private hooked = false;
  private meleeShown = false;
  private linger = 0;

  /** `space` is the view scene; `hook` is the gun hand's thumb tip, which pulls the pin. */
  constructor(
    private readonly kit: Kit,
    space: THREE.Object3D,
    private readonly hand: THREE.Object3D,
    private readonly hook: THREE.Object3D,
    shellGeometry: THREE.BufferGeometry
  ) {
    this.melee = this.take('mallet');
    this.grenade = createRiggedModel('grenade', kit, 'first');
    hand.add(this.grenade.model.root);
    this.grenade.model.root.position.set(0.0165, 0.016, -0.002);
    this.shell = new THREE.Mesh(shellGeometry, surfaceMaterial(kit.materials));
    this.shell.position.set(0.042, 0.028, 0.0005);
    this.shell.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    hand.add(this.shell);
    // The pin leaves the bomb, so it lives in view space and is put on its seat every frame.
    this.pin = this.grenade.parts.get('pin');
    this.ring = this.grenade.nodes.get('ring')?.position.clone() ?? new THREE.Vector3();
    if (this.pin) {
      this.pinSeat.compose(this.pin.position, this.pin.quaternion, this.pin.scale);
      space.add(this.pin);
    }
  }

  get meleeId() {
    return this.melee.model.id as MeleeId;
  }

  setMelee(id: MeleeId) {
    if (this.melee.model.id === id) return;
    this.melee.model.root.removeFromParent();
    this.melee = this.take(id);
  }

  private take(id: MeleeId) {
    const melee = createRiggedModel(id, this.kit, 'first');
    melee.model.root.position.copy(HANDLE_IN_FIST);
    melee.model.root.scale.setScalar(IN_HAND[id] ?? 1);
    this.hand.add(melee.model.root);
    return melee;
  }

  /** Where the pin's ring rests on the bomb, in the bomb's own frame. */
  ringSeat(): Goal {
    at.copy(this.ring).applyMatrix4(this.pinSeat);
    return goal(this.grenade.model.root, [at.x, at.y, at.z], new THREE.Quaternion());
  }

  /** Where the gun hand's thumb takes the ring. */
  ringHook(): Goal {
    return goal(this.hook, [0, 0, HOOK_DEPTH], new THREE.Quaternion());
  }

  /** Another clip cuts in: a weapon still in the hand goes down with it instead of vanishing. */
  interrupt() {
    if (this.meleeShown) this.linger = PUT_AWAY;
  }

  /** A cut-off strike's weapon is still in the fist: the hand takes it down out of the picture before doing anything else. */
  get stowing() {
    return this.linger > 0 && !this.meleeShown;
  }

  reset() {
    this.linger = 0;
    this.meleeShown = false;
  }

  /** Shows what the frame asks for and returns the fingers that hold it (null for an empty hand). */
  update(f: Frame, dt: number): FingerPose | null {
    this.linger = this.hand.position.y < BELOW_FRAME ? 0 : Math.max(0, this.linger - dt);
    this.meleeShown = f.show.mallet > 0;
    const melee = this.meleeShown || this.linger > 0;
    this.melee.model.root.visible = melee;
    this.grenade.model.root.visible = f.show.grenade > 0;
    this.shell.visible = f.show.shell > 0;
    return melee ? FINGERS.handle : f.show.grenade ? FINGERS.ball : f.show.shell ? FINGERS.pinch : null;
  }

  /** Once both hands are placed: the pin sits on the bomb, hangs from the thumb that hooked it, or flies off. */
  settle(f: Frame) {
    this.hook.updateWorldMatrix(true, false);
    const pin = this.pin;
    if (!pin) return;
    const fly = f.pin.fly;
    pin.visible = f.show.pin && (fly >= 0 ? fly < PIN_LIFE : f.show.grenade > 0);
    if (fly >= 0) {
      pin.position.copy(this.flyFrom).addScaledVector(PIN_FLICK, fly);
      pin.position.y -= PIN_GRAVITY * 0.5 * fly * fly;
      pin.quaternion.copy(this.pinTurn).multiply(spin.setFromEuler(e.set(fly * 9, fly * 4, fly * 14)));
      return;
    }
    const bomb = this.grenade.model.root;
    bomb.updateWorldMatrix(true, false);
    seat.multiplyMatrices(bomb.matrixWorld, this.pinSeat).decompose(pin.position, pin.quaternion, scale);
    if (f.pin.hook > 0) {
      // The ring slides over the thumb; the pin keeps the way it pointed when it was hooked, whatever the bomb does.
      if (this.hooked) pin.quaternion.copy(this.pinTurn);
      at.copy(this.ring).applyQuaternion(pin.quaternion).add(pin.position);
      pin.position.addScaledVector(to.set(0, 0, HOOK_DEPTH).applyMatrix4(this.hook.matrixWorld).sub(at), f.pin.hook);
    }
    this.hooked = f.pin.hook > 0;
    this.flyFrom.copy(pin.position);
    this.pinTurn.copy(pin.quaternion);
  }
}

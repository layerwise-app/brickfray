import * as THREE from 'three';
import type { Kit } from '../../engine/kit';
import { SIDEARMS, type WeaponId } from '../defs';
import { createRiggedModel, type RiggedModel } from '../model';
import { revolverGoals } from './clips-revolver';
import type { FlashStyle } from './flash';
import type { CasingKind } from './fx';
import { goal, gripQuat, type Goal, type V3 } from './goals';
import { SHELL_HOLD } from './held';
import { TUNING, type Tuning } from './tuning';

/** A first-person gun with everything the view model animates. */
export interface GunRig {
  id: WeaponId;
  rigged: RiggedModel;
  tuning: Tuning;
  /** Rest transform of each moving part. */
  rest: Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>;
  goals: Record<string, Goal>;
  /** Sight-line point in model space. */
  sight: THREE.Vector3;
  flash: FlashStyle;
  /** Casing thrown on every shot (null when the pump or bolt ejects instead). */
  casing: CasingKind | null;
}

const FLASH: Record<WeaponId, FlashStyle> = {
  ar: { kind: 'powder', prongs: 3, star: 0.11, petal: 0.26, width: 0.12, side: 0, smoke: 0.06 },
  shotgun: { kind: 'blast', prongs: 5, star: 0.16, petal: 0.3, width: 0.19, side: 0, smoke: 0.12 },
  sniper: { kind: 'long', prongs: 2, star: 0.1, petal: 0.62, width: 0.1, side: 0.09, smoke: 0.14 },
  pistol: { kind: 'powder', prongs: 2, star: 0.07, petal: 0.15, width: 0.09, side: 0, smoke: 0.04 },
  nailer: { kind: 'spark', prongs: 7, star: 0.05, petal: 0.2, width: 0.03, side: 0, smoke: 0.03 },
  pulse: { kind: 'energy', prongs: 2, star: 0.07, petal: 0.14, width: 0.022, side: 0, smoke: 0 },
  harpoon: { kind: 'air', prongs: 0, star: 0.04, petal: 0, width: 0, side: 0, smoke: 0.11 },
  cannon: { kind: 'powder', prongs: 3, star: 0.12, petal: 0.26, width: 0.15, side: 0.06, smoke: 0.16 },
  buzzer: { kind: 'powder', prongs: 4, star: 0.055, petal: 0.11, width: 0.06, side: 0, smoke: 0.03 }
};

const CASING: Record<WeaponId, CasingKind | null> = {
  ar: 'brass',
  shotgun: null,
  sniper: null,
  pistol: 'brass',
  nailer: null,
  pulse: null,
  harpoon: null,
  cannon: null,
  buzzer: 'brass'
};

const CHARGE_GRIP = { pos: [-0.045, 0, -0.004], back: [-0.25, 0.45, 0.85], axis: [1, 0, 0] } as const;

const SLIDE_GRIP: V3 = [0, 0.008, 0.015];
/** How far a carrier shell is drawn down out of its slot before the hand takes it to the port. */
const SADDLE_PULL = 0.05;
const SADDLE_BACK: V3 = [-0.6, -1, 0.1];
const SADDLE_AXIS: V3 = [0.1, 0.2, -1];
/** Where the fingers take a carrier shell, from its slot: low on the hull, under the gun's roll. */
const SADDLE_PICK: V3 = [0, -0.016, 0];

/** A loaded shell's center from the loading port node: under the opening, through it, and in the tube. */
const SHELL_MOUTH: V3 = [0, -0.0115, 0.002];
const SHELL_UP: V3 = [0, 0.012, -0.004];
const SHELL_INSIDE: V3 = [0, 0.029, -0.04];

export function buildGunRig(id: WeaponId, kit: Kit): GunRig {
  const rigged = createRiggedModel(id, kit, 'first');
  const tuning = TUNING[id];
  const root = rigged.model.root;
  const node = (name: string) => rigged.nodes.get(name) ?? root;
  // The nailer's strip feeds inside its magazine and leaves the gun with it.
  const strip = rigged.parts.get('strip');
  if (strip) rigged.parts.get('magazine')?.attach(strip);
  const rest = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>();
  for (const [name, part] of rigged.parts) {
    if (part !== root) rest.set(name, { pos: part.position.clone(), quat: part.quaternion.clone() });
  }
  /** A fixed point on the body where a moving part's node sits at an offset (hand stays put while the part snaps back). */
  const anchor = (name: string, offset: V3) => {
    const o = new THREE.Object3D();
    const n = node(name);
    root.updateMatrixWorld(true);
    o.position.copy(n.getWorldPosition(new THREE.Vector3())).applyMatrix4(root.matrixWorld.clone().invert()).add(new THREE.Vector3(...offset));
    root.add(o);
    return o;
  };
  const L = (back: V3, axis: V3) => gripQuat(back, axis, -1);
  const goals: Record<string, Goal> = {
    rightRest: goal(node('grip'), tuning.right, gripQuat(tuning.rightBack ?? [1, 0, 0], [0, 1, 0], 1)),
    leftRest: goal(node('support'), tuning.left.pos, L(tuning.left.back, tuning.left.axis)),
    // Let go of and slid down off the support, riding the gun: where a melee strike's hand leaves it, under the frame.
    leftOff: goal(node('support'), [tuning.left.pos[0] - 0.015, tuning.left.pos[1] - 0.075, tuning.left.pos[2] + 0.02], L(tuning.left.back, tuning.left.axis)),
    low: goal(root, [-0.02, -0.38, 0.1], L([-0.5, -1, 0], [0, 0.3, -1]))
  };
  if (rigged.nodes.has('magHold')) {
    goals.mag = SIDEARMS.has(id) ? goal(node('magHold'), [-0.006, 0.02, 0.002], L([-1, 0, 0.2], [0, 0.15, 1])) : goal(node('magHold'), tuning.mag ?? [-0.004, 0, -0.004], L([-1, -0.15, -0.5], [0, 1, 0.25]));
  }
  if (rigged.nodes.has('charge')) {
    // From behind and above, knuckles up: index and middle curl over the handle's left wing so the fist pulls it
    // straight back, the forearm hanging below in view.
    const q = L(CHARGE_GRIP.back, CHARGE_GRIP.axis);
    goals.charge = goal(node('charge'), CHARGE_GRIP.pos, q);
    goals.chargeBack = goal(anchor('charge', [0, 0, 0.068]), CHARGE_GRIP.pos, q);
    // On the way back to the handguard the fist drops forward along the left of the receiver, its back to the eye, and
    // only rolls onto its grip at the end.
    goals.chargeOut = goal(root, [-0.07, 0.0, -0.18], q.clone().slerp(goals.leftRest!.quat, 0.3));
  }
  if (rigged.nodes.has('boltKnob')) {
    // Cupped over the knob from behind, forearm along the stock. The clip moves this frame with the knob
    // without the bolt's full turn: the wrist stays put while the handle swings up through the palm.
    const palm = new THREE.Object3D();
    root.add(palm);
    goals.bolt = goal(palm, [0.004, 0, 0.004], gripQuat([0.45, 0.7, 0.55], [-1, 0.1, 0], 1));
    goals.boltKnob = goal(node('boltKnob'), [0, 0, 0], new THREE.Quaternion());
  }
  if (rigged.nodes.has('slideRear')) {
    // Saddled over the rear of the slide, index rearmost: the fingertips hook the far serrations, the thumb clamps the near ones.
    const q = L([0, 1, 0], [0, 0, 1]);
    goals.slide = goal(node('slideRear'), SLIDE_GRIP, q);
    goals.slideBack = goal(anchor('slideRear', [0, 0, 0.036]), SLIDE_GRIP, q);
  }
  if (rigged.nodes.has('port')) {
    // The shell's way in, in the port's frame: lying under the opening, pushed up through it, and on forward into the tube (hidden by the receiver).
    const port = node('port');
    const flat = new THREE.Quaternion();
    goals.shellMouth = goal(port, SHELL_MOUTH, flat);
    goals.shellUp = goal(port, SHELL_UP, flat);
    goals.shellInside = goal(port, SHELL_INSIDE, flat);
    // From below, palm toward the camera side, index along the tube, placed so the shell in its fingers lies right under the port; the thumb then follows it up.
    const q = L([1, 0, 0], [0, 0.15, -1]);
    const reach = SHELL_HOLD.pos.clone().applyQuaternion(q);
    const at = (shell: V3, k = 1): V3 => [shell[0] - reach.x * k, shell[1] - reach.y * k, shell[2] - reach.z * k];
    const mouth = at(SHELL_MOUTH);
    goals.port = goal(port, mouth, q);
    goals.portNear = goal(port, [mouth[0] - 0.004, mouth[1] - 0.054, mouth[2] + 0.03], q);
    goals.portIn = goal(port, [mouth[0] + (SHELL_UP[0] - SHELL_MOUTH[0]) * 0.8, mouth[1] + (SHELL_UP[1] - SHELL_MOUTH[1]) * 0.8, mouth[2] + (SHELL_UP[2] - SHELL_MOUTH[2]) * 0.8], q);
  }
  // The side carrier: each slot (the shell standing in it), and the left hand come up under the rolled receiver, back of
  // the hand down, pinching that shell low, then drawing it down and out like the port's shells, the forearm out of view below.
  const pinch = L(SADDLE_BACK, SADDLE_AXIS);
  const reach = SHELL_HOLD.pos.clone().applyQuaternion(pinch);
  for (let i = 0; rigged.nodes.has(`saddle${i}`); i++) {
    const slot = anchor(`saddle${i}`, [SADDLE_PICK[0] - reach.x, SADDLE_PICK[1] - reach.y, SADDLE_PICK[2] - reach.z]);
    goals[`saddle${i}`] = goal(node(`saddle${i}`), [0, 0, 0], new THREE.Quaternion());
    goals[`saddleHand${i}`] = goal(slot, [0, 0, 0], pinch);
    goals[`saddleOut${i}`] = goal(slot, [-0.015, -SADDLE_PULL, 0.01], pinch);
  }
  if (rigged.nodes.has('spearHold')) {
    // Underhand on the shaft, wrist below and to the left, index toward the tip.
    const q = L([0.7, -0.7, 0], [0, 0, -1]);
    goals.spear = goal(node('spearHold'), [-0.008, 0.008, 0], q);
    goals.spearHead = goal(node('spearHead'), [-0.008, 0.008, 0], q);
  }
  if (rigged.nodes.has('cylHold')) Object.assign(goals, revolverGoals(node));
  // Where each hand-carried part sits when seated, so clips can hand it over to the hand in view space.
  for (const name of ['magazine', 'spear', 'speedloader', 'bolt', 'slide']) {
    const seat = rest.get(name);
    if (seat) goals[`${name}Seat`] = goal(root, [seat.pos.x, seat.pos.y, seat.pos.z], seat.quat);
  }
  const sight = node('sight').position.clone();
  return { id, rigged, tuning, rest, goals, sight, flash: FLASH[id], casing: CASING[id] };
}

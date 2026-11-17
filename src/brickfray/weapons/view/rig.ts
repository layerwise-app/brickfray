import * as THREE from 'three';
import type { Kit } from '../../engine/kit';
import { SIDEARMS, type WeaponId } from '../defs';
import { createRiggedModel, type RiggedModel } from '../model';
import { revolverGoals } from './clips-revolver';
import type { CasingKind, FlashStyle } from './fx';
import { goal, gripQuat, type Goal, type V3 } from './goals';
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
  ar: { star: 0.12, petal: 0.28, width: 0.14, side: 0 },
  shotgun: { star: 0.15, petal: 0.36, width: 0.2, side: 0 },
  sniper: { star: 0.12, petal: 0.3, width: 0.14, side: 0.09 },
  pistol: { star: 0.07, petal: 0.15, width: 0.09, side: 0 },
  nailer: { star: 0.06, petal: 0.13, width: 0.08, side: 0.04 },
  pulse: { star: 0.07, petal: 0.15, width: 0.1, side: 0 },
  harpoon: { star: 0.042, petal: 0.075, width: 0.075, side: 0 },
  cannon: { star: 0.11, petal: 0.24, width: 0.13, side: 0.05 },
  buzzer: { star: 0.06, petal: 0.13, width: 0.08, side: 0 }
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

export function buildGunRig(id: WeaponId, kit: Kit): GunRig {
  const rigged = createRiggedModel(id, kit, 'first');
  const tuning = TUNING[id];
  const root = rigged.model.root;
  const node = (name: string) => rigged.nodes.get(name) ?? root;
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
    rightRest: goal(node('grip'), tuning.right, gripQuat([1, 0, 0], [0, 1, 0], 1)),
    leftRest: goal(node('support'), tuning.left.pos, L(tuning.left.back, tuning.left.axis)),
    low: goal(root, [-0.02, -0.38, 0.1], L([-0.5, -1, 0], [0, 0.3, -1]))
  };
  if (rigged.nodes.has('magHold')) {
    goals.mag = SIDEARMS.has(id) ? goal(node('magHold'), [-0.004, -0.012, 0.004], L([-0.4, -1, 0], [0, 0.25, -1])) : goal(node('magHold'), [-0.004, 0, -0.004], L([-1, -0.15, -0.5], [0, 1, 0.25]));
  }
  if (rigged.nodes.has('charge')) {
    const q = L([0, 1, 0.35], [1, 0, 0]);
    goals.charge = goal(node('charge'), [0.0, 0.026, 0.012], q);
    goals.chargeBack = goal(anchor('charge', [0, 0, 0.068]), [0.0, 0.026, 0.012], q);
  }
  if (rigged.nodes.has('boltKnob')) goals.bolt = goal(node('boltKnob'), [0.012, 0.012, 0], gripQuat([0.4, 1, 0], [0, 0, 1], 1));
  if (rigged.nodes.has('slideRear')) {
    const q = L([-0.75, 0.65, 0.1], [0, 0.2, 1]);
    goals.slide = goal(node('slideRear'), [-0.018, 0.012, 0.004], q);
    goals.slideBack = goal(anchor('slideRear', [0, 0, 0.036]), [-0.018, 0.012, 0.004], q);
  }
  if (rigged.nodes.has('port')) {
    const q = L([-0.25, -1, 0], [0, 0, -1]);
    goals.port = goal(node('port'), [0.004, -0.03, 0.012], q);
    goals.portNear = goal(node('port'), [-0.01, -0.075, 0.03], q);
    goals.shellLow = goal(node('port'), [-0.04, -0.3, 0.08], q);
  }
  if (rigged.nodes.has('spearHold')) {
    const q = L([-0.2, -1, 0], [0, 0, 1]);
    goals.spear = goal(node('spearHold'), [-0.004, -0.02, 0], q);
    goals.spearHead = goal(node('spearHead'), [-0.004, -0.02, 0], q);
  }
  if (rigged.nodes.has('cylHold')) Object.assign(goals, revolverGoals(node));
  const sight = node('sight').position.clone();
  return { id, rigged, tuning, rest, goals, sight, flash: FLASH[id], casing: CASING[id] };
}

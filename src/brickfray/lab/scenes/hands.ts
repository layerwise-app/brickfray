import * as THREE from 'three';
import { ROSTER } from '../../characters/roster';
import type { CharacterId } from '../../characters/types';
import { Arms } from '../../weapons/view/arms';
import { FINGERS, type FingerPose, type FingerShape } from '../../weapons/view/fingers';
import type { LabContext } from '../types';

const AT = new THREE.Vector3(0, 1.5, 0);

/**
 * Bare first-person hands held still for inspection: both hands in one finger
 * shape around an optional reference prop on the grip axis. Orbit with --cam / --target
 * (the right hand's frame origin is at 0.1, 1.5, 0; the left at -0.1, 1.5, 0).
 */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  const kit = { profile: gr.profile, materials: gr.materials };
  const arms = new Arms(kit);
  arms.root.position.set(0, AT.y + 0.1, 0.5);
  scene.add(arms.root);
  arms.setColors(ROSTER.rivet);
  const props = new THREE.Group();
  scene.add(props);
  const material = new THREE.MeshStandardMaterial({ color: 0x8a2be2, roughness: 0.6 });
  const right = new THREE.Matrix4();
  const left = new THREE.Matrix4();
  let solo = 0;
  const place = () => {
    right.makeTranslation(0.1, -0.1, -0.5);
    left.makeTranslation(-0.1, solo > 0 ? -0.7 : -0.1, -0.5);
    if (solo < 0) right.makeTranslation(0.1, -0.7, -0.5);
    arms.pose(right, left, new THREE.Vector3());
  };
  arms.setFingers(FINGERS.relaxed, FINGERS.relaxed, 0);
  place();
  ctx.camera.near = 0.01;
  ctx.camera.fov = 30;
  ctx.camera.position.set(-0.25, 1.62, -0.35);
  ctx.controls.target.copy(AT);
  ctx.camera.updateProjectionMatrix();
  ctx.controls.update();

  return {
    api: {
      /** A preset name or a full FingerPose. */
      shape: (value: unknown) => {
        const shape = typeof value === 'string' ? FINGERS[value as FingerShape] : (value as FingerPose);
        arms.setFingers(shape, shape, 0);
        place();
      },
      /** Show one hand only: 1 right, -1 left, 0 both. */
      solo: (side: unknown) => {
        solo = Number(side);
        place();
      },
      /** Joints and tip of each right-hand digit (thumb, index … pinky) in its hand frame, millimetres. */
      digits: () => {
        arms.root.updateMatrixWorld(true);
        const inv = arms.right.hand.matrixWorld.clone().invert();
        const mm = (v: THREE.Vector3) => v.applyMatrix4(inv).toArray().map((n) => Math.round(n * 10000) / 10);
        return [13, 1, 4, 7, 10].map((first) => {
          const out = [0, 1, 2].map((k) => mm(arms.right.joints[first + k]!.getWorldPosition(new THREE.Vector3())));
          out.push(mm(new THREE.Vector3(0, 0, -0.019).applyMatrix4(arms.right.joints[first + 2]!.matrixWorld)));
          return out;
        });
      },
      setCharacter: (id: unknown) => arms.setColors(ROSTER[id as CharacterId]),
      /** Reference prop on both grip axes: 'handle' (radius), 'ball' (radius, x, y, z offset in the right hand's frame), 'grip' (pistol grip section) or 'none'. */
      prop: (kind: unknown, radius: unknown = 0.0145, ox: unknown = 0, oy: unknown = 0, oz: unknown = 0) => {
        props.clear();
        if (kind === 'none') return;
        for (const side of [1, -1]) {
          const g = kind === 'ball' ? new THREE.SphereGeometry(Number(radius), 24, 16) : kind === 'grip' ? new THREE.BoxGeometry(0.03, 0.12, 0.05) : new THREE.CylinderGeometry(Number(radius), Number(radius), 0.3, 20);
          const m = new THREE.Mesh(g, material);
          m.position.set(side * (0.1 + Number(ox)), AT.y + Number(oy), Number(oz));
          props.add(m);
        }
      }
    }
  };
}

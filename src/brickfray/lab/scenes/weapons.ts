import * as THREE from 'three';
import { BrickBuilder } from '../../engine/bricks';
import { buildGround } from '../../engine/ground';
import { PLASTIC } from '../../engine/palette';
import { createWeaponModel } from '../../weapons';
import type { LabContext } from '../types';

type Id = 'ar' | 'shotgun' | 'sniper' | 'pistol' | 'grenade' | 'mallet';

/** Where each model hangs on the rack (first-person build); third-person copies sit 2.4 m to the right. */
const SLOTS: Record<Id, [number, number]> = {
  ar: [-0.45, 1.95],
  shotgun: [-0.4, 1.5],
  sniper: [-0.3, 1.02],
  pistol: [0.62, 1.98],
  grenade: [0.55, 1.5],
  mallet: [0.78, 1.32]
};
const THIRD_X = 2.4;

/** Display rack of every weapon model, first-person builds on the left, third-person on the right. */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  const kit = { profile: gr.profile, materials: gr.materials };
  scene.add(buildGround([{ x0: -4, z0: -3, x1: 6, z1: 3, y: 0, color: PLASTIC.sandGreen }], gr.profile));

  const display = new THREE.Group();
  // Face the display toward the sun so the guns' right sides are lit like a product shot.
  display.rotation.y = Math.atan2(gr.atmosphere.sunDirection.x, gr.atmosphere.sunDirection.z) * 0.7;
  scene.add(display);
  const wall = new BrickBuilder(gr.profile, gr.materials);
  const colors = [PLASTIC.white, PLASTIC.offWhite, PLASTIC.white];
  for (let layer = 0; layer < 18; layer += 3) {
    for (let x = -8; x < 12; x += 2) {
      wall.grid({ w: 2, d: 1, h: 3 }, x + ((layer / 3) % 2), layer, -2, { color: colors[(x + layer) & 1 ? 1 : 0]! });
    }
  }
  wall.grid({ w: 10, d: 2, h: 1 }, -3, 18, -3, { color: PLASTIC.orange });
  wall.grid({ w: 8, d: 2, h: 1 }, 3, 18, -3, { color: PLASTIC.azure });
  display.add(wall.build());

  const models: { id: Id; view: 'first' | 'third'; root: THREE.Object3D }[] = [];
  for (const id of Object.keys(SLOTS) as Id[]) {
    for (const view of ['first', 'third'] as const) {
      const model = createWeaponModel(id, kit, view);
      const [x, y] = SLOTS[id];
      model.root.position.set(x + (view === 'third' ? THIRD_X : 0), y, 0);
      if (id === 'grenade' || id === 'mallet') model.root.rotation.set(0, -0.6, 0);
      else model.root.rotation.set(0, -Math.PI / 2, 0);
      display.add(model.root);
      models.push({ id, view, root: model.root });
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 10), gr.materials.get(PLASTIC.silver, 'metal'));
      peg.rotation.x = Math.PI / 2;
      peg.position.set(model.root.position.x, y - 0.075, -0.21);
      if (id !== 'grenade' && id !== 'mallet') display.add(peg);
    }
  }

  ctx.camera.fov = 40;
  ctx.controls.target.set(1.1, 1.45, 0).applyQuaternion(display.quaternion);
  ctx.camera.position.set(1.1, 1.55, 4.2).applyQuaternion(display.quaternion);

  const stats = () =>
    models.map(({ id, view, root }) => {
      let tris = 0;
      let meshes = 0;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        meshes++;
        const g = mesh.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      });
      return { id, view, tris, meshes };
    });

  return {
    api: {
      stats,
      /** Frame one model close up: focus('ar', 'first'). */
      focus: (id: unknown, view: unknown = 'first', side: unknown = 'right') => {
        const m = models.find((e) => e.id === id && e.view === view);
        if (!m) return 'unknown';
        display.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(m.root);
        const c = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        const dz = side === 'left' ? -1 : 1;
        ctx.camera.fov = 30;
        const offset = new THREE.Vector3(-size * 0.18, size * 0.22, dz * size * 1.05).applyQuaternion(display.quaternion);
        ctx.camera.position.copy(c).add(offset);
        ctx.controls.target.copy(c);
        ctx.camera.updateProjectionMatrix();
        ctx.controls.update();
        return { size };
      }
    }
  };
}

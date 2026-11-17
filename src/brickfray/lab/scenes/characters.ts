import * as THREE from 'three';
import { buildGround } from '../../engine/ground';
import type { Kit } from '../../engine/kit';
import { PLASTIC } from '../../engine/palette';
import { BOT_KINDS, CHARACTER_IDS, createCharacter, type AnimState, type CharacterRig } from '../../characters';
import { idleState, mergeState } from '../../characters/labState';
import { standInRifle } from '../../characters/standInRifle';
import type { LabContext } from '../types';

/** Full lineup: six playable characters and four bot kinds, idling with stand-in rifles. */
export default function setup(ctx: LabContext) {
  const { renderer: gr, scene } = ctx;
  scene.add(buildGround([{ x0: -12, z0: -8, x1: 12, z1: 8, y: 0, color: PLASTIC.sandGreen }], gr.profile));
  const kit: Kit = { profile: gr.profile, materials: gr.materials };
  const ids = [...CHARACTER_IDS, ...BOT_KINDS];
  const rigs: CharacterRig[] = [];
  let x = -6.2;
  for (const id of ids) {
    const rig = createCharacter(id, kit);
    const gun = standInRifle(kit);
    if (id === 'boss') gun.root.scale.setScalar(1);
    rig.setWeapon(gun.root, gun.supportGrip);
    x += id === 'boss' ? 0.9 : 0;
    rig.root.position.set(x, 0, 0);
    rig.root.rotation.y = Math.PI;
    x += id === 'boss' ? 2.1 : 1.3;
    scene.add(rig.root);
    rigs.push(rig);
  }
  let state = idleState();
  let frozen = false;
  ctx.onFrame((dt) => {
    if (!frozen) for (const r of rigs) r.update(dt, state);
  });
  ctx.camera.position.set(0, 1.6, 9.5);
  ctx.controls.target.set(0, 1.0, 0);
  const simulate = (t: number) => {
    frozen = true;
    for (const r of rigs) {
      r.reset();
      for (let k = 0; k < Math.round(t * 120); k++) r.update(1 / 120, state);
    }
  };
  simulate(1);
  frozen = false;
  return {
    api: {
      setState: (patch: unknown) => {
        state = mergeState(idleState(), patch as Partial<AnimState>);
      },
      setTime: (t: unknown) => simulate(Number(t)),
      tint: (color: unknown) => rigs.forEach((r, i) => r.setTint(color === 'team' ? (i % 2 ? '#e8473d' : '#3a7bf0') : (color as string | null))),
      ids: () => ids,
      tris: () => rigs.map((r) => `${r.id}:${Math.round(((r as unknown as { mesh: THREE.Mesh }).mesh.geometry.getAttribute('position').count) / 3)}`),
      head: (i: unknown) => rigs[Number(i)]!.headPosition(new THREE.Vector3()).toArray()
    }
  };
}

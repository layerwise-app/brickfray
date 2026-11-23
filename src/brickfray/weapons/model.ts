import type * as THREE from 'three';
import type { Kit } from '../engine/kit';
import { instantiate, lodFor, ModelBuilder, type Instance, type Template, type View } from './builder';
import type { MeleeId, WeaponId } from './defs';
import { buildAnchor } from './models/anchor';
import { buildAr } from './models/ar';
import { buildBuzzer } from './models/buzzer';
import { buildCannon } from './models/cannon';
import { buildGrenade } from './models/grenade';
import { buildHarpoon } from './models/harpoon';
import { buildHatchet } from './models/hatchet';
import { buildKnife } from './models/knife';
import { buildMallet } from './models/mallet';
import { buildNailer } from './models/nailer';
import { buildPistol } from './models/pistol';
import { buildPulse } from './models/pulse';
import { buildShotgun } from './models/shotgun';
import { buildSniper } from './models/sniper';
import { buildSword } from './models/sword';
import { buildWrench } from './models/wrench';
import type { WeaponModel } from './types';

export type ModelId = WeaponId | MeleeId | 'grenade';

export function createWeaponModel(id: ModelId, kit: Kit, view: View): WeaponModel {
  return createRiggedModel(id, kit, view).model;
}

/** The model plus every named node, for the view model's hand and part animation. */
export interface RiggedModel {
  model: WeaponModel;
  nodes: Map<string, THREE.Object3D>;
  parts: Map<string, THREE.Group>;
}

const BUILDERS: Record<ModelId, (b: ModelBuilder) => void> = {
  ar: buildAr,
  shotgun: buildShotgun,
  sniper: buildSniper,
  pistol: buildPistol,
  grenade: buildGrenade,
  mallet: buildMallet,
  nailer: buildNailer,
  pulse: buildPulse,
  harpoon: buildHarpoon,
  cannon: buildCannon,
  buzzer: buildBuzzer,
  sword: buildSword,
  knife: buildKnife,
  anchor: buildAnchor,
  hatchet: buildHatchet,
  wrench: buildWrench
};

const templates = new Map<string, Template>();

export function createRiggedModel(id: ModelId, kit: Kit, view: View): RiggedModel {
  const key = `${id}:${view}:${kit.profile.level}`;
  let template = templates.get(key);
  if (!template) {
    const builder = new ModelBuilder(lodFor(kit, view));
    BUILDERS[id](builder);
    template = builder.bake();
    templates.set(key, template);
  }
  const inst: Instance = instantiate(template, kit, view === 'first');
  inst.root.name = `weapon:${id}`;
  const node = (name: string) => inst.nodes.get(name) ?? null;
  const part = (name: string) => inst.parts.get(name);
  const model: WeaponModel = {
    id,
    root: inst.root,
    muzzle: node('muzzle') ?? inst.root,
    ejectPort: node('eject'),
    supportGrip: node('support'),
    sight: node('sight'),
    parts: {
      magazine: part('magazine'),
      bolt: part('bolt'),
      pump: part('pump'),
      slide: part('slide'),
      hammer: part('hammer'),
      pin: part('pin')
    },
    // Geometry is shared by every instance of this template and kept for reuse.
    dispose() {
      inst.root.removeFromParent();
    }
  };
  return { model, nodes: inst.nodes, parts: inst.parts };
}

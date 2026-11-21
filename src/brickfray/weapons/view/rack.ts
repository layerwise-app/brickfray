import type * as THREE from 'three';
import type { Kit } from '../../engine/kit';
import type { WeaponId } from '../defs';
import type { Loadout } from '../loadouts';
import { buildGunRig, type GunRig } from './rig';

/**
 * The first-person guns built so far. The character's own stay in the view scene, hidden until drawn, so a match's
 * warm-up frame compiles and uploads every one of them before the first spawn.
 */
export class GunRack {
  private readonly guns = new Map<WeaponId, GunRig>();
  private stocked: WeaponId[] = [];

  constructor(
    private readonly kit: Kit,
    private readonly scene: THREE.Scene
  ) {}

  /** Puts the loadout's guns in the scene; any other gun leaves it unless it is `held`. */
  stock(loadout: Loadout, held: GunRig | undefined) {
    this.stocked = [loadout.primary, loadout.secondary];
    for (const [id, rig] of this.guns) if (rig !== held && !this.stocked.includes(id)) rig.rigged.model.root.removeFromParent();
    for (const id of this.stocked) this.get(id);
  }

  /** Gun `id` takes over from `from`, shown or hidden as `from` was. */
  swap(from: GunRig | undefined, id: WeaponId): GunRig {
    const rig = this.get(id);
    rig.rigged.model.root.visible = from?.rigged.model.root.visible ?? true;
    if (from && from !== rig) {
      from.rigged.model.root.visible = false;
      if (!this.stocked.includes(from.id)) from.rigged.model.root.removeFromParent();
    }
    return rig;
  }

  dispose() {
    for (const rig of this.guns.values()) rig.rigged.model.dispose();
  }

  private get(id: WeaponId) {
    let rig = this.guns.get(id);
    if (!rig) {
      rig = buildGunRig(id, this.kit);
      rig.rigged.model.root.visible = false;
      this.guns.set(id, rig);
    }
    this.scene.add(rig.rigged.model.root);
    return rig;
  }
}

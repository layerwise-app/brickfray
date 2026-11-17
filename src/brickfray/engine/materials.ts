import * as THREE from 'three';
import type { QualityProfile } from './quality';

export type Finish = 'plastic' | 'glass' | 'rubber' | 'metal' | 'glow' | 'chrome';

/**
 * Plastic materials for a quality tier. Batched scenery takes its color per
 * instance, so batch materials stay white; meshes ask for a colored copy.
 */
export class Materials {
  private colored = new Map<string, THREE.Material>();
  readonly batch: Record<Finish, THREE.Material>;

  constructor(readonly profile: QualityProfile) {
    this.batch = {
      plastic: this.make('plastic', '#ffffff'),
      glass: this.make('glass', '#ffffff'),
      rubber: this.make('rubber', '#ffffff'),
      metal: this.make('metal', '#ffffff'),
      glow: this.make('glow', '#ffffff'),
      chrome: this.make('chrome', '#ffffff')
    };
  }

  /** A shared material of one color and finish, for characters, guns and props. */
  get(color: THREE.ColorRepresentation, finish: Finish = 'plastic'): THREE.Material {
    const hex = new THREE.Color(color).getHexString();
    const key = `${finish}:${hex}`;
    let material = this.colored.get(key);
    if (!material) {
      material = this.make(finish, `#${hex}`);
      this.colored.set(key, material);
    }
    return material;
  }

  /** A private copy that can flash on hit without touching other meshes. */
  unique(color: THREE.ColorRepresentation, finish: Finish = 'plastic'): THREE.Material {
    return this.make(finish, color);
  }

  /**
   * White material that takes its colors from a `color` vertex attribute, so a
   * whole multi-colored model (e.g. a rigidly skinned character) is one draw call.
   * Shared unless `unique` (needed when the caller animates emissive for hit flashes).
   */
  vertexColored(finish: Finish = 'plastic', unique = false): THREE.Material {
    const key = `vc:${finish}`;
    if (!unique) {
      const hit = this.colored.get(key);
      if (hit) return hit;
    }
    const material = this.make(finish, '#ffffff');
    (material as THREE.MeshStandardMaterial).vertexColors = true;
    if (!unique) this.colored.set(key, material);
    return material;
  }

  private make(finish: Finish, color: THREE.ColorRepresentation): THREE.Material {
    const p = this.profile;
    if (finish === 'glow') {
      return new THREE.MeshBasicMaterial({ color, toneMapped: false });
    }
    if (!p.pbr) {
      if (finish === 'glass') {
        return new THREE.MeshPhongMaterial({ color, specular: 0x666666, shininess: 90, transparent: true, opacity: 0.55, depthWrite: false });
      }
      return new THREE.MeshPhongMaterial({
        color,
        specular: finish === 'rubber' ? 0x080808 : finish === 'metal' || finish === 'chrome' ? 0x777777 : 0x2a2a2a,
        shininess: finish === 'rubber' ? 6 : finish === 'metal' || finish === 'chrome' ? 70 : 34
      });
    }
    switch (finish) {
      case 'glass':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.4 });
      case 'rubber':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, envMapIntensity: 0.4 });
      case 'metal':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.75, envMapIntensity: 1 });
      case 'chrome':
        return new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 1, envMapIntensity: 1.2 });
      default:
        if (p.clearcoat) {
          return new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 0.85 });
        }
        return new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0, envMapIntensity: 0.8 });
    }
  }

  dispose() {
    for (const m of Object.values(this.batch)) m.dispose();
    for (const m of this.colored.values()) m.dispose();
    this.colored.clear();
  }
}

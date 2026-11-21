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
    if (!profile.shadows) for (const f of ['plastic', 'rubber', 'metal', 'chrome'] as const) contactShade(this.batch[f]);
    if (profile.pbr && profile.bevel > 0) for (const f of ['plastic', 'rubber', 'metal', 'chrome'] as const) bevelAA(this.batch[f]);
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

const CONTACT_VERTEX = /* glsl */ `#include <project_vertex>
vec4 contactP = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
contactP = batchingMatrix * contactP;
#endif
#ifdef USE_INSTANCING
contactP = instanceMatrix * contactP;
#endif
vContactY = ( modelMatrix * contactP ).y;`;

/**
 * Without shadow maps scenery floats on the ground; darkening its lowest metre and a bit stands in for contact
 * shadow and ambient occlusion, so walls, props and ground separate.
 */
function contactShade(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vContactY;').replace('#include <project_vertex>', CONTACT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vContactY;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix( 0.5, 1.0, smoothstep( 0.0, 1.1, vContactY ) );');
  };
  m.customProgramCacheKey = () => 'contact-shade';
}

const BEVEL_VERTEX = /* glsl */ `#include <defaultnormal_vertex>
vBevelS = bevel;
vBevelOn = step(0.5, bevel);
vBevelA = vec3(0.0);
vBevelB = vec3(0.0);
if (bevel > 0.5) {
  vec3 an = abs(objectNormal);
  vec3 sn = sign(objectNormal);
  vec3 eA = vec3(0.0, 0.0, sn.z);
  vec3 eB = an.x >= an.y ? vec3(sn.x, 0.0, 0.0) : vec3(0.0, sn.y, 0.0);
  if (an.x >= an.y && an.x >= an.z) {
    eA = vec3(sn.x, 0.0, 0.0);
    eB = an.y >= an.z ? vec3(0.0, sn.y, 0.0) : vec3(0.0, 0.0, sn.z);
  } else if (an.y >= an.z) {
    eA = vec3(0.0, sn.y, 0.0);
    eB = an.x >= an.z ? vec3(sn.x, 0.0, 0.0) : vec3(0.0, 0.0, sn.z);
  }
  #ifdef USE_BATCHING
  vec3 bmScale = vec3(dot(bm[0], bm[0]), dot(bm[1], bm[1]), dot(bm[2], bm[2]));
  eA = bm * (eA / bmScale);
  eB = bm * (eB / bmScale);
  #endif
  vBevelA = normalMatrix * eA;
  vBevelB = normalMatrix * eB;
}`;

const BEVEL_FRAGMENT = /* glsl */ `#include <normal_fragment_begin>
{
  float bevelPx = 1.0 / max(fwidth(vBevelS), 1e-4);
  float bevelK = vBevelOn * (1.0 - smoothstep(1.2, 3.0, bevelPx));
  if (bevelK > 0.0) {
    vec3 toEye = normalize(vViewPosition);
    vec3 bevelFa = normalize(vBevelA);
    vec3 bevelFb = normalize(vBevelB);
    normal = normalize(mix(normal, dot(bevelFa, toEye) >= dot(bevelFb, toEye) ? bevelFa : bevelFb, bevelK));
    nonPerturbedNormal = normal;
  }
}`;

/**
 * A bevel thinner than a couple of pixels lands on scattered MSAA samples and its highlight breaks into dashes
 * along brick courses and cornices; below three pixels it fades to the shading of the face the camera sees.
 * The bevel flag is flat: a sub-pixel strip is shaded at the pixel centre, outside the strip, where an interpolated
 * flag would be extrapolated below zero and leave the dashes in.
 */
function bevelAA(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bevel;\nvarying float vBevelS;\nflat varying float vBevelOn;\nvarying vec3 vBevelA;\nvarying vec3 vBevelB;')
      .replace('#include <defaultnormal_vertex>', BEVEL_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBevelS;\nflat varying float vBevelOn;\nvarying vec3 vBevelA;\nvarying vec3 vBevelB;')
      .replace('#include <normal_fragment_begin>', BEVEL_FRAGMENT);
  };
  m.customProgramCacheKey = () => 'bevel-aa';
}

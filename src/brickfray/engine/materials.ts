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
    // Scenery is merged into chunks that carry each part's colour on its vertices.
    for (const m of Object.values(this.batch)) (m as THREE.MeshStandardMaterial).vertexColors = true;
    if (!profile.shadows) for (const f of ['plastic', 'rubber', 'metal', 'chrome'] as const) contactShade(this.batch[f], profile.detail === 0);
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

// Below ground level (moat banks, quay walls) only a narrow band under the rim darkens, as under a coping.
const CONTACT_FRAGMENT = /* glsl */ `
diffuseColor.rgb *= vContactY >= 0.0 ? mix( 0.5, 1.0, smoothstep( 0.0, 1.1, vContactY ) ) : mix( 0.72, 1.0, smoothstep( 0.0, 0.3, -vContactY ) );`;

/**
 * Bed joints of the seamless low-tier masonry (see withCourses): a dark line at the bottom of each course, 4.5% of
 * its height, drawn at least 1.25 px wide and dimmed by its pixel coverage so far walls keep their tone instead of
 * breaking into dashes.
 */
const COURSE_FRAGMENT = /* glsl */ `
if (vCourse > -0.5) {
  float courseFw = max(fwidth(vCourse), 1e-5);
  float courseW = max(0.045, 1.25 * courseFw);
  float courseLine = 1.0 - smoothstep(courseW - courseFw, courseW, vCourse);
  diffuseColor.rgb *= 1.0 - 0.6 * courseLine * (0.045 / courseW);
}`;

/**
 * Without shadow maps scenery floats on the ground; darkening its lowest metre and a bit stands in for contact
 * shadow and ambient occlusion, so walls, props and ground separate. `courses` adds the flat masonry's bed joints.
 */
function contactShade(m: THREE.Material, courses: boolean) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vContactY;${courses ? '\nattribute float bevel;\nvarying float vCourse;' : ''}`)
      .replace('#include <project_vertex>', `${CONTACT_VERTEX}${courses ? '\nvCourse = bevel < -0.5 ? -bevel - 1.0 : -1.0;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vContactY;${courses ? '\nvarying float vCourse;' : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${CONTACT_FRAGMENT}${courses ? COURSE_FRAGMENT : ''}`);
  };
  m.customProgramCacheKey = () => (courses ? 'contact-shade-courses' : 'contact-shade');
}

const BEVEL_VERTEX = /* glsl */ `#include <defaultnormal_vertex>
vBevelS = bevel;
vBevelOn = step(0.5, bevel);
vBevelA = bevel > 0.5 ? normalMatrix * bevelA : vec3(0.0);
vBevelB = bevel > 0.5 ? normalMatrix * bevelB : vec3(0.0);`;

const BEVEL_FRAGMENT = /* glsl */ `#include <normal_fragment_begin>
float bevelEnv = 1.0;
vec3 bevelAmbN = normal;
{
  float bevelPx = 1.0 / max(fwidth(vBevelS), 1e-4);
  float bevelK = vBevelOn * (1.0 - smoothstep(1.2, 3.0, bevelPx));
  float bevelSeen = vBevelOn * (1.0 - bevelK);
  if (vBevelOn > 0.0) {
    vec3 toEye = normalize(vViewPosition);
    vec3 bevelFa = normalize(vBevelA);
    vec3 bevelFb = normalize(vBevelB);
    vec3 bevelFace = dot(bevelFa, toEye) >= dot(bevelFb, toEye) ? bevelFa : bevelFb;
    vec3 bevelUp = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
    bevelAmbN = normalize(mix(normal, abs(dot(bevelFa, bevelUp)) <= abs(dot(bevelFb, bevelUp)) ? bevelFa : bevelFb, 0.75 * bevelSeen));
    bevelEnv = 1.0 - 0.5 * bevelSeen;
    normal = normalize(mix(normal, bevelFace, bevelK));
    nonPerturbedNormal = normal;
    bevelAmbN = normalize(mix(bevelAmbN, normal, bevelK));
  }
}`;

/**
 * A bevel tilts toward the sky: lit by it like a face of its own it drew every course joint as a pale-blue line. It
 * takes most of the sky light of the wall face it rounds off (direct sun still models it) and half its sky reflection.
 */
const BEVEL_ENV = /* glsl */ `
#if defined( RE_IndirectSpecular )
radiance *= bevelEnv;
#ifdef USE_CLEARCOAT
clearcoatRadiance *= bevelEnv;
#endif
#endif`;

const BEVEL_AMBIENT_BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal )',
  'getHemisphereLightIrradiance( hemisphereLights[ i ], bevelAmbN )'
);
const BEVEL_AMBIENT_MAPS = THREE.ShaderChunk.lights_fragment_maps.replace('getIBLIrradiance( geometryNormal )', 'getIBLIrradiance( bevelAmbN )');
if (BEVEL_AMBIENT_BEGIN === THREE.ShaderChunk.lights_fragment_begin || BEVEL_AMBIENT_MAPS === THREE.ShaderChunk.lights_fragment_maps) {
  throw new Error('three light chunks changed: bevel ambient not patched');
}

/**
 * A bevel thinner than a couple of pixels lands on scattered MSAA samples and its highlight breaks into dashes
 * along brick courses and cornices; below three pixels it fades to the shading of the face the camera sees.
 * The bevel flag is flat: a sub-pixel strip is shaded at the pixel centre, outside the strip, where an interpolated
 * flag would be extrapolated below zero and leave the dashes in.
 */
function bevelAA(m: THREE.Material) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bevel;\nattribute vec3 bevelA;\nattribute vec3 bevelB;\nvarying float vBevelS;\nflat varying float vBevelOn;\nvarying vec3 vBevelA;\nvarying vec3 vBevelB;')
      .replace('#include <defaultnormal_vertex>', BEVEL_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBevelS;\nflat varying float vBevelOn;\nvarying vec3 vBevelA;\nvarying vec3 vBevelB;')
      .replace('#include <normal_fragment_begin>', BEVEL_FRAGMENT)
      .replace('#include <lights_fragment_begin>', BEVEL_AMBIENT_BEGIN)
      .replace('#include <lights_fragment_maps>', `${BEVEL_AMBIENT_MAPS}\n${BEVEL_ENV}`);
  };
  m.customProgramCacheKey = () => 'bevel-aa';
  // Merged scenery stores the two faces each bevel rounds off (scenery-chunks.ts bevelFaces).
  m.userData.bevelEdges = true;
}

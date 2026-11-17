import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { Materials } from './materials';

export interface Atmosphere {
  zenith: string;
  horizon: string;
  ground: string;
  sunColor: string;
  sunIntensity: number;
  /** Direction the light travels from (points toward the sun). */
  sunDirection: THREE.Vector3;
  fogNear: number;
}

export const DEFAULT_ATMOSPHERE: Atmosphere = {
  zenith: '#5fa8f0',
  horizon: '#dbeaf4',
  ground: '#9c9688',
  sunColor: '#fff2dc',
  sunIntensity: 2.7,
  sunDirection: new THREE.Vector3(0.55, 0.78, 0.32).normalize(),
  fogNear: 70
};

const WHITE = new THREE.Color('#ffffff');

/**
 * Lights for the non-PBR tier, which has no sky reflections: a brighter,
 * less tinted ambient stands in for them so warm skies don't turn the map muddy.
 */
export function plainLights(a: Atmosphere) {
  return {
    sky: new THREE.Color(a.horizon).lerp(new THREE.Color(a.zenith), 0.5).lerp(WHITE, 0.35),
    ground: new THREE.Color(a.ground).lerp(WHITE, 0.25),
    sun: new THREE.Color(a.sunColor).lerp(WHITE, 0.3),
    hemi: 2.4,
    sunIntensity: a.sunIntensity * 0.85
  };
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.62, h), 0.8));
  col = mix(col, uGround, smoothstep(0.0, -0.08, h));
  float s = max(dot(d, uSun), 0.0);
  col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.18 + pow(s, 4.0) * 0.06);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  profile: QualityProfile;
  materials: Materials;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;
  private worldPass: RenderPass | null = null;
  private viewPass: RenderPass | null = null;
  private aoPass: GTAOPass | null = null;
  private width = 1;
  private height = 1;
  atmosphere: Atmosphere = DEFAULT_ATMOSPHERE;

  constructor(
    readonly canvas: HTMLCanvasElement,
    level: QualityLevel
  ) {
    this.profile = QUALITY[level];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    // GTAO renders the scene a second time; shadows only need one update per frame.
    this.renderer.shadowMap.autoUpdate = false;
    this.materials = new Materials(this.profile);

    this.hemi = new THREE.HemisphereLight('#dbeeff', '#8d806c', 1);
    this.sun = new THREE.DirectionalLight('#fff2dc', 2.7);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uGround: { value: new THREE.Color() },
          uSun: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() }
        }
      })
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.applyProfile();
  }

  /** Lights, sky and fog for a scene; call once per scene and after setAtmosphere. */
  dress(scene: THREE.Scene) {
    scene.add(this.hemi, this.sun, this.sun.target, this.sky);
    this.applyAtmosphere(scene);
  }

  setAtmosphere(scene: THREE.Scene, atmosphere: Atmosphere) {
    this.atmosphere = atmosphere;
    this.applyAtmosphere(scene);
  }

  private applyAtmosphere(scene: THREE.Scene) {
    const a = this.atmosphere;
    const u = this.sky.material.uniforms;
    u.uZenith!.value.set(a.zenith);
    u.uHorizon!.value.set(a.horizon);
    u.uGround!.value.set(a.ground);
    u.uSun!.value.copy(a.sunDirection);
    u.uSunColor!.value.set(a.sunColor);
    if (this.profile.pbr) {
      this.sun.color.set(a.sunColor);
      this.sun.intensity = a.sunIntensity;
      this.hemi.color.set(a.horizon).lerp(new THREE.Color(a.zenith), 0.3);
      this.hemi.groundColor.set(a.ground);
      this.hemi.intensity = 0.55;
    } else {
      const l = plainLights(a);
      this.sun.color.copy(l.sun);
      this.sun.intensity = l.sunIntensity;
      this.hemi.color.copy(l.sky);
      this.hemi.groundColor.copy(l.ground);
      this.hemi.intensity = l.hemi;
    }
    scene.fog = new THREE.Fog(a.horizon, a.fogNear, this.profile.drawDistance);
    this.buildEnvironment(scene);
  }

  /** Reflections come from the same sky, so plastic picks up blue on top and warm bounce below. */
  private buildEnvironment(scene: THREE.Scene) {
    this.envTarget?.dispose();
    this.envTarget = null;
    scene.environment = null;
    if (!this.profile.pbr) return;
    const envScene = new THREE.Scene();
    const sky = this.sky.clone();
    sky.material = this.sky.material.clone();
    sky.material.uniforms.uSunColor!.value.multiplyScalar(0.35);
    envScene.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshBasicMaterial({ color: this.atmosphere.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    envScene.add(ground);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(envScene, 0.035);
    pmrem.dispose();
    scene.environment = this.envTarget.texture;
    sky.material.dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
  }

  /** Swap quality tiers; returns true when scenery must be rebuilt with the new materials. */
  setQuality(level: QualityLevel, scene?: THREE.Scene): boolean {
    if (level === this.profile.level) return false;
    this.profile = QUALITY[level];
    this.materials.dispose();
    this.materials = new Materials(this.profile);
    this.applyProfile();
    if (scene) this.applyAtmosphere(scene);
    return true;
  }

  private applyProfile() {
    const p = this.profile;
    this.renderer.shadowMap.enabled = p.shadows;
    this.sun.castShadow = p.shadows;
    if (p.shadows) {
      this.sun.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      const cam = this.sun.shadow.camera;
      const half = p.level === 'high' ? 34 : 26;
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 1;
      cam.far = 160;
      cam.updateProjectionMatrix();
      this.sun.shadow.radius = p.shadowRadius;
    }
    this.composer?.dispose();
    this.composer = null;
    this.aoPass = null;
    this.resize(this.width, this.height);
  }

  get pixelRatio() {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.min(dpr, this.profile.maxPixelRatio) * this.profile.resolutionScale;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer?.setPixelRatio(this.pixelRatio);
    this.composer?.setSize(this.width, this.height);
  }

  /** Keep the shadow frustum centered on the player, snapped to texels so edges don't crawl. */
  followShadow(focus: THREE.Vector3) {
    const dir = this.atmosphere.sunDirection;
    const cam = this.sun.shadow.camera;
    const texel = (cam.right - cam.left) / Math.max(1, this.profile.shadowMapSize);
    const snapped = focus.clone();
    snapped.x = Math.round(snapped.x / texel) * texel;
    snapped.z = Math.round(snapped.z / texel) * texel;
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(dir, 80);
    this.sun.target.updateMatrixWorld();
  }

  private ensureComposer(scene: THREE.Scene, camera: THREE.Camera, viewScene: THREE.Scene | null, viewCamera: THREE.Camera | null) {
    if (!this.composer) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.worldPass = new RenderPass(scene, camera);
      this.composer.addPass(this.worldPass);
      this.aoPass = new GTAOPass(scene, camera, this.width, this.height);
      this.aoPass.blendIntensity = 0.85;
      this.aoPass.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 12 });
      this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.composer.addPass(this.aoPass);
      this.viewPass = new RenderPass(scene, camera);
      this.viewPass.clear = false;
      this.viewPass.clearDepth = true;
      this.composer.addPass(this.viewPass);
      this.composer.addPass(new OutputPass());
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.width, this.height);
    }
    this.worldPass!.scene = scene;
    this.worldPass!.camera = camera;
    this.aoPass!.scene = scene;
    this.aoPass!.camera = camera;
    this.viewPass!.enabled = !!viewScene && !!viewCamera;
    if (viewScene && viewCamera) {
      this.viewPass!.scene = viewScene;
      this.viewPass!.camera = viewCamera;
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera, viewScene: THREE.Scene | null = null, viewCamera: THREE.Camera | null = null) {
    this.sky.position.copy((camera as THREE.PerspectiveCamera).position);
    this.renderer.info.reset();
    this.renderer.shadowMap.needsUpdate = this.profile.shadows;
    if (this.profile.ambientOcclusion) {
      this.ensureComposer(scene, camera, viewScene, viewCamera);
      this.composer!.render();
      return;
    }
    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(scene, camera);
    if (viewScene && viewCamera) {
      this.renderer.clearDepth();
      this.renderer.render(viewScene, viewCamera);
    }
  }

  dispose() {
    this.composer?.dispose();
    this.envTarget?.dispose();
    this.materials.dispose();
    this.renderer.dispose();
  }
}

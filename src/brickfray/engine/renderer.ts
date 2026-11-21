import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { Materials } from './materials';
import { FrameTimer } from './frame-timer';
import { AutoResolution } from './auto-resolution';
import { installSmoothShadows } from './shadow-filter';
import { PostAA } from './post-aa';
import { buildClouds, CLOUD_DRIFT } from './clouds';
import { createSky, DEFAULT_ATMOSPHERE, plainLights, type Atmosphere } from './atmosphere';

export { DEFAULT_ATMOSPHERE, plainLights, type Atmosphere };

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly timer: FrameTimer;
  profile: QualityProfile;
  materials: Materials;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly clouds = new THREE.Group();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private composer: EffectComposer | null = null;
  private worldPass: RenderPass | null = null;
  private viewPass: RenderPass | null = null;
  private aoPass: GTAOPass | null = null;
  private postAA: PostAA | null = null;
  private width = 1;
  private height = 1;
  private readonly resolution: AutoResolution;
  atmosphere: Atmosphere = DEFAULT_ATMOSPHERE;

  constructor(
    readonly canvas: HTMLCanvasElement,
    level: QualityLevel
  ) {
    this.profile = QUALITY[level];
    installSmoothShadows();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.timer = new FrameTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.resolution = new AutoResolution(this.renderer, this.timer, this.pixelRatio);
    // GTAO renders the scene a second time; shadows only need one update per frame.
    this.renderer.shadowMap.autoUpdate = false;
    this.materials = new Materials(this.profile);

    this.hemi = new THREE.HemisphereLight('#dbeeff', '#8d806c', 1);
    this.sun = new THREE.DirectionalLight('#fff2dc', 2.7);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;

    this.sky = createSky();
    this.sky.frustumCulled = false;
    // Last of the opaque pass: drawn first it shades the whole screen before the scenery covers most of it.
    this.sky.renderOrder = 1e6;
    this.applyProfile();
  }

  /** Lights, sky and fog for a scene; call once per scene and after setAtmosphere. */
  dress(scene: THREE.Scene) {
    scene.add(this.hemi, this.sun, this.sun.target, this.sky, this.clouds);
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
    for (const c of [...this.clouds.children] as THREE.Mesh[]) {
      this.clouds.remove(c);
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
    const clouds = buildClouds(a);
    if (clouds) this.clouds.add(clouds);
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
    this.resolution.restart(this.pixelRatio);
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
    if (p.antialias) {
      this.postAA?.dispose();
      this.postAA = null;
    }
    this.resize(this.width, this.height);
  }

  /** The tier's pixel ratio on this screen: the canvas's during a match. */
  get pixelRatio() {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.min(dpr, this.profile.maxPixelRatio) * this.profile.resolutionScale;
  }

  /** What a match renders at: the tier's ratio, or lower while automatic resolution keeps frames on the refresh. */
  get drawRatio() {
    return this.resolution.ratio(this.pixelRatio);
  }

  get autoScale() {
    return this.resolution.enabled;
  }

  set autoScale(on: boolean) {
    if (on === this.resolution.enabled) return;
    this.resolution.enabled = on;
    this.resolution.restart(this.pixelRatio);
    this.composer?.setPixelRatio(this.drawRatio);
  }

  /** For the stats overlay: frames delivered against the display's rate, the longest gap, then what a frame costs. */
  statsLine() {
    const t = this.timer;
    const hz = t.refresh ? `/${Math.round(1000 / t.refresh)}` : '';
    const gpu = t.gpuMs === null ? '' : `gpu ${t.gpuMs.toFixed(1)} · `;
    return `${t.fps}${hz} fps · worst ${t.worstMs.toFixed(1)} ms · ${gpu}cpu ${t.cpuMs.toFixed(1)} ms · res ${+this.drawRatio.toFixed(2)}x`;
  }

  /** `ratio` is what the canvas is drawn at now (the menu draws sharper than a match); post-processing keeps the match's. */
  resize(width: number, height: number, ratio?: number) {
    width = Math.max(1, width);
    height = Math.max(1, height);
    if (width !== this.width || height !== this.height) this.timer.remeasure();
    this.width = width;
    this.height = height;
    this.resolution.setBase(this.pixelRatio);
    // One call: setPixelRatio followed by setSize reallocates the canvas twice.
    this.renderer.setDrawingBufferSize(this.width, this.height, ratio ?? this.drawRatio);
    this.composer?.setPixelRatio(this.drawRatio);
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
      this.composer.setPixelRatio(this.drawRatio);
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
    this.clouds.position.copy(this.sky.position);
    this.clouds.rotation.y = (performance.now() / 1000) * CLOUD_DRIFT;
    const before = this.drawRatio;
    if (!this.resolution.prepare(this.pixelRatio, this.width, this.height)) return;
    if (this.drawRatio !== before) this.composer?.setPixelRatio(this.drawRatio);
    this.renderer.info.reset();
    this.renderer.shadowMap.needsUpdate = this.profile.shadows;
    const scale = this.resolution.viewport(this.drawRatio);
    if (this.profile.ambientOcclusion) {
      this.ensureComposer(scene, camera, viewScene, viewCamera);
      this.composer!.render();
    } else {
      const post = this.profile.antialias ? null : (this.postAA ??= new PostAA());
      post?.begin(this.renderer, scale);
      this.renderer.autoClear = false;
      this.renderer.clear();
      this.renderer.render(scene, camera);
      if (viewScene && viewCamera) {
        this.renderer.clearDepth();
        this.renderer.render(viewScene, viewCamera);
      }
      post?.end(this.renderer);
    }
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.resolution.drawn();
  }

  dispose() {
    this.resolution.dispose();
    this.composer?.dispose();
    this.postAA?.dispose();
    this.envTarget?.dispose();
    this.materials.dispose();
    this.renderer.dispose();
  }
}

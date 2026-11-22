import * as THREE from 'three';
import { QUALITY, type QualityLevel, type QualityProfile } from './quality';
import { Materials } from './materials';
import { FrameTimer } from './frame-timer';
import { FramePacer } from './frame-pacer';
import { AutoResolution } from './auto-resolution';
import { installSmoothShadows } from './shadow-filter';
import { PostAA } from './post-aa';
import { CanvasAO } from './canvas-ao';
import { buildClouds, CLOUD_DRIFT } from './clouds';
import { createSky, DEFAULT_ATMOSPHERE, plainLights, type Atmosphere } from './atmosphere';

export { DEFAULT_ATMOSPHERE, plainLights, type Atmosphere };

type View = [THREE.Scene, THREE.Camera];

/** How far the environment's zenith is pulled to a grey of the same luminance (0 = sky blue, 1 = grey). */
const ENV_ZENITH_GREY = 0.45;

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
  private ao: CanvasAO | null = null;
  private postAA: PostAA | null = null;
  private width = 1;
  private height = 1;
  private readonly resolution: AutoResolution;
  private readonly pacer = new FramePacer();
  /** The timer's frame at the last match render: the next one follows it in the game loop. */
  private loopFrame = -1;
  /** Each scene drawn so far, with the view-model scene its programs were compiled with. */
  private readonly warmed = new WeakMap<THREE.Scene, THREE.Scene | null>();
  /** The view model last drawn: compiled with a new scene before the player spawns into it. */
  private lastView: View | null = null;
  private readonly shadowFocus = new THREE.Vector3();
  private readonly bufferSize = new THREE.Vector2();
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
    // AO renders the scene a second time; shadows only need one update per frame.
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

  /**
   * Reflections and shade light come from the same sky with its zenith turned mostly grey: the full zenith blue
   * lit every shadowed top saturated blue, so shade stays a slightly cool grey and the sun keeps the warmth.
   */
  private buildEnvironment(scene: THREE.Scene) {
    this.envTarget?.dispose();
    this.envTarget = null;
    scene.environment = null;
    if (!this.profile.pbr) return;
    const envScene = new THREE.Scene();
    const sky = this.sky.clone();
    sky.material = this.sky.material.clone();
    sky.material.uniforms.uSunColor!.value.multiplyScalar(0.35);
    const zenith: THREE.Color = sky.material.uniforms.uZenith!.value;
    zenith.lerp(new THREE.Color().setScalar(0.2126 * zenith.r + 0.7152 * zenith.g + 0.0722 * zenith.b), ENV_ZENITH_GREY);
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
    this.pacer.restart();
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
    this.ao?.dispose();
    this.ao = null;
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
  }

  /** For the stats overlay: frames delivered against the display's rate, the longest gap, then what a frame costs. */
  statsLine() {
    const t = this.timer;
    const hz = t.refresh ? `/${Math.round(1000 / t.refresh)}` : '';
    const gpu = t.gpuMs === null ? '' : `gpu ${t.gpuMs.toFixed(1)} · `;
    return `${t.fps}${hz} fps · worst ${t.worstMs.toFixed(1)} ms · ${gpu}cpu ${t.cpuMs.toFixed(1)} ms · res ${+this.drawRatio.toFixed(2)}x`;
  }

  /** `ratio` is what the canvas is drawn at now (the menu draws sharper than a match). */
  resize(width: number, height: number, ratio?: number) {
    width = Math.max(1, width);
    height = Math.max(1, height);
    if (width !== this.width || height !== this.height) {
      this.timer.remeasure();
      this.pacer.restart();
    }
    this.width = width;
    this.height = height;
    this.resolution.setBase(this.pixelRatio);
    // One call: setPixelRatio followed by setSize reallocates the canvas twice.
    this.renderer.setDrawingBufferSize(this.width, this.height, ratio ?? this.drawRatio);
  }

  /** The view model drawn over matches: compiled with each new match scene, before the player first spawns in it. */
  prepareView(scene: THREE.Scene, camera: THREE.Camera) {
    this.lastView = [scene, camera];
  }

  /** Keep the shadow frustum centered on the player, snapped to texels so edges don't crawl. */
  followShadow(focus: THREE.Vector3) {
    const dir = this.atmosphere.sunDirection;
    const cam = this.sun.shadow.camera;
    const texel = (cam.right - cam.left) / Math.max(1, this.profile.shadowMapSize);
    const snapped = this.shadowFocus.copy(focus);
    snapped.x = Math.round(snapped.x / texel) * texel;
    snapped.z = Math.round(snapped.z / texel) * texel;
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(dir, 80);
    this.sun.target.updateMatrixWorld();
  }

  render(scene: THREE.Scene, camera: THREE.Camera, viewScene: THREE.Scene | null = null, viewCamera: THREE.Camera | null = null) {
    const t = this.timer;
    // The lab draws without the game loop's timer: never paced or rescaled.
    const looped = t.frame === this.loopFrame + 1;
    this.loopFrame = t.frame;
    this.resolution.mark();
    if (looped && !this.pacer.due(t.sinceDrawn, t.refresh)) return t.skip();
    const interval = looped ? t.interval : 0;
    this.pacer.frame(interval, t.refresh, { cpu: t.cpuMs, gpu: t.gpuMs }, this.resolution.exhausted(t.refresh));
    this.sky.position.copy((camera as THREE.PerspectiveCamera).position);
    this.clouds.position.copy(this.sky.position);
    this.clouds.rotation.y = (performance.now() / 1000) * CLOUD_DRIFT;
    if (!this.resolution.prepare(this.pixelRatio, this.width, this.height, interval, t.refresh * this.pacer.divisor, this.pacer.divisor === 1)) return t.skip();
    this.renderer.info.reset();
    this.renderer.shadowMap.needsUpdate = this.profile.shadows;
    const scale = this.resolution.viewport(this.drawRatio);
    const views: View[] = viewScene && viewCamera ? [[scene, camera], [viewScene, viewCamera]] : [[scene, camera]];
    if (viewScene && viewCamera) this.lastView = [viewScene, viewCamera];
    // A new scene, or the view model first drawn in it (its sky is prefiltered and every weapon compiled at once).
    const known = this.warmed.get(scene);
    const warm = known === undefined || (viewScene !== null && known !== viewScene);
    const compiled = warm && !viewScene && this.lastView ? [...views, this.lastView] : views;
    if (warm) this.warmed.set(scene, compiled[1]?.[0] ?? null);
    const draw = (drawn: View[], compile: boolean) => {
      const post = this.profile.antialias ? null : (this.postAA ??= new PostAA());
      if (compile) {
        // Programs depend on the target drawn into, and the shadow map (drawn in the AO pass when there is one) is
        // drawn with the lights compiling sets up: on a scene's first frame they are not set up yet.
        post?.begin(this.renderer, scale);
        for (const [s, c] of drawn) this.renderer.compile(s, c);
      }
      // Everything off the canvas first (shadow map, AO), so the canvas is drawn in one pass and its samples stay on tile.
      if (this.profile.ambientOcclusion) {
        const size = this.renderer.getDrawingBufferSize(this.bufferSize);
        (this.ao ??= new CanvasAO(scene, camera)).draw(this.renderer, scene, camera, size.x * scale, size.y * scale);
      }
      post?.begin(this.renderer, scale);
      this.renderer.autoClear = false;
      this.renderer.clear();
      this.renderer.render(scene, camera);
      if (this.profile.ambientOcclusion) this.ao!.composite(this.renderer);
      for (const [s, c] of drawn.slice(1)) {
        this.renderer.clearDepth();
        this.renderer.render(s, c);
      }
      post?.end(this.renderer);
    };
    if (warm) this.warm(compiled, () => draw(compiled, true), () => draw(views, false));
    else draw(views, false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.resolution.drawn();
  }

  /**
   * A scene's first frame. `prime` draws it once with hidden objects shown too (weapons not in hand, muzzle flash,
   * casings, effect pools) and nothing culled, then `draw` paints the real frame over it, so nothing primed is seen.
   * Compiling alone is not enough: a program first drawn mid-match stalls that frame for up to ~200 ms on
   * ANGLE/Metal even when it was compiled long before.
   */
  private warm(views: View[], prime: () => void, draw: () => void) {
    const undo: (() => void)[] = [];
    for (const [scene] of views) {
      scene.traverse((o) => {
        if (o.frustumCulled) {
          o.frustumCulled = false;
          undo.push(() => (o.frustumCulled = true));
        }
        // Hidden batches are raycast stand-ins (scenery part colours), never drawn; a light shown would key every
        // program to a light count the match never has.
        if (!o.visible && !(o as THREE.BatchedMesh).isBatchedMesh && !(o as THREE.Light).isLight) {
          o.visible = true;
          undo.push(() => (o.visible = false));
        }
        const instances = o as THREE.InstancedMesh;
        if (instances.isInstancedMesh && instances.count === 0 && instances.instanceMatrix.count > 0) {
          instances.count = 1;
          undo.push(() => (instances.count = 0));
        }
      });
    }
    prime();
    for (const u of undo) u();
    this.renderer.shadowMap.needsUpdate = this.profile.shadows;
    draw();
  }

  dispose() {
    this.resolution.dispose();
    this.ao?.dispose();
    this.postAA?.dispose();
    this.envTarget?.dispose();
    this.materials.dispose();
    this.renderer.dispose();
  }
}
